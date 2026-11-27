import {
  displayName,
  mergeSearchResults,
  normalizeName,
  opaqueBox,
  parseIucn,
  type LngLatBox,
  type SpeciesHit,
  type SpeciesInfo,
  type TaxonRecord,
  type WikidataTaxon,
} from '../domain/species';

/**
 * Gọi các dịch vụ của tính năng vùng phân bố của loài (xem docs/SPECIES-RANGE.md, mục 6).
 * Cả ba dịch vụ đều cho trình duyệt gọi thẳng, nên app không cần server trung gian.
 */

export class SpeciesError extends Error {}

export const MIN_QUERY_LENGTH = 2;
export const SHORT_QUERY_MESSAGE = 'Gõ ít nhất 2 chữ cái.';
export const BUSY_MESSAGE = 'Dịch vụ đang bận. Thử lại sau ít phút.';
export const OFFLINE_MESSAGE = 'Không kết nối được dịch vụ tìm loài. Thử lại sau.';
export const NOT_FOUND_MESSAGE = 'Không tìm thấy loài này.';
export const SPLIT_MESSAGE = 'iNaturalist đã tách hoặc gộp loài này. Hãy tìm lại theo tên.';

const INAT_API = 'https://api.inaturalist.org/v1';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';
const GBIF_API = 'https://api.gbif.org';

/** Hai yêu cầu liên tiếp tới cùng một dịch vụ cách nhau ít nhất chừng này. */
export const QUEUE_INTERVAL_MS = 1000;
/**
 * Khi dịch vụ trả lỗi 429 kèm thời gian chờ không quá chừng này giây, app chờ rồi thử lại một lần.
 * Wikidata chặn tìm kiếm toàn văn sau khoảng 5 lần tìm trong 30 giây, và thường chỉ bắt chờ 4 đến 8 giây.
 */
export const MAX_RETRY_AFTER_S = 10;
/**
 * Khi dịch vụ trả lỗi 429 mà không ghi thời gian chờ, app chờ chừng này giây rồi thử lại một lần.
 * GBIF đôi khi chặn yêu cầu đếm điểm đúng lúc bản đồ đang tải nhiều ô lục giác, và không ghi thời gian chờ.
 */
export const DEFAULT_RETRY_AFTER_S = 2;
const TIMEOUT_MS = 15000;
/** Số mã iNaturalist tối đa trong một yêu cầu lấy nhiều loài. */
const MAX_BATCH = 30;

/** Chỉ lấy quan sát của người và của máy, ví dụ bẫy ảnh. Mẫu vật trong bảo tàng bị bỏ. */
export const GBIF_BASIS_FILTER = 'basisOfRecord=HUMAN_OBSERVATION&basisOfRecord=MACHINE_OBSERVATION';

/** Ô bản đồ vùng phân bố của iNaturalist, cỡ 256 px. */
export const rangeTileUrl = (inatId: number) => `${INAT_API}/taxon_ranges/${inatId}/{z}/{x}/{y}.png`;

/** Ô bản đồ nơi đã gặp loài của GBIF, dạng lưới lục giác, cỡ 512 px. */
export const observationTileUrl = (gbifKey: number) =>
  `${GBIF_API}/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?taxonKey=${gbifKey}&${GBIF_BASIS_FILTER}&style=classic.poly&bin=hex&hexPerTile=30`;

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const defaultDeps: Deps = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const abortError = () => new DOMException('Đã hủy', 'AbortError');

/**
 * Hàng đợi của một dịch vụ. Các yêu cầu chạy lần lượt và cách nhau ít nhất `minIntervalMs`.
 * Cách làm giống hàng đợi Nominatim trong src/services/nominatim.ts.
 */
export function createQueue(minIntervalMs: number, deps: Deps) {
  let lastStart = -Infinity;
  let tail: Promise<unknown> = Promise.resolve();
  return function run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    const result = tail.then(async () => {
      const wait = lastStart + minIntervalMs - deps.now();
      if (wait > 0) await deps.sleep(wait);
      if (signal.aborted) throw abortError();
      lastStart = deps.now();
      return task();
    });
    tail = result.catch(() => undefined);
    return result;
  };
}

type Queue = ReturnType<typeof createQueue>;

// ---------- Dạng dữ liệu thô của các dịch vụ ----------

interface InatTaxon {
  id: number;
  name: string;
  rank: string;
  is_active?: boolean;
  ancestor_ids?: number[];
  iconic_taxon_name?: string;
  preferred_common_name?: string;
  english_common_name?: string;
  default_photo?: { square_url?: string; medium_url?: string; attribution?: string; license_code?: string } | null;
  conservation_status?: { status?: string; authority?: string } | null;
  observations_count?: number;
  wikipedia_url?: string | null;
  current_synonymous_taxon_ids?: number[] | null;
  /** Chỉ có ở kết quả tìm: tên đã khớp với chữ gõ, có thể ở bất kỳ ngôn ngữ nào. */
  matched_term?: string;
}

interface WikidataClaim {
  rank?: string;
  mainsnak?: { datavalue?: { value?: unknown } };
}

interface WikidataEntity {
  labels?: Record<string, { value: string } | undefined>;
  claims?: Record<string, WikidataClaim[] | undefined>;
  sitelinks?: Record<string, { title: string } | undefined>;
}

type SparqlRow = Record<string, { value: string } | undefined>;

/** Rút gọn một loài của iNaturalist. `assumeAnimal` dùng khi kết quả không có `ancestor_ids`. */
function toRecord(raw: InatTaxon, assumeAnimal: boolean): TaxonRecord {
  const record: TaxonRecord = {
    inatId: raw.id,
    scientificName: raw.name,
    rank: raw.rank,
    isAnimal: raw.ancestor_ids ? raw.ancestor_ids.includes(1) : assumeAnimal,
    active: raw.is_active !== false,
    group: raw.iconic_taxon_name ?? 'Animalia',
  };
  if (raw.preferred_common_name) record.inatVi = raw.preferred_common_name;
  if (raw.english_common_name) record.english = raw.english_common_name;
  if (raw.default_photo?.square_url) record.thumbnail = raw.default_photo.square_url;
  const iucn = parseIucn(raw.conservation_status?.status, raw.conservation_status?.authority);
  if (iucn) record.iucn = iucn;
  if (raw.matched_term) record.matchedTerm = raw.matched_term;
  return record;
}

/** Các giá trị dạng chuỗi của một thuộc tính Wikidata, bỏ các giá trị bị đánh dấu là sai. */
function claimValues(entity: WikidataEntity, property: string): string[] {
  return (entity.claims?.[property] ?? [])
    .filter((claim) => claim.rank !== 'deprecated')
    .map((claim) => claim.mainsnak?.datavalue?.value)
    .filter((value): value is string => typeof value === 'string');
}

const toInt = (value: string | undefined): number | undefined => {
  const n = Number(value);
  return value !== undefined && Number.isInteger(n) && n > 0 ? n : undefined;
};

/** Đổi đường dẫn bài Wikipedia tiếng Việt thành tên bài. */
function viArticleTitle(url: string | null | undefined): string | undefined {
  const prefix = 'https://vi.wikipedia.org/wiki/';
  if (!url?.startsWith(prefix)) return undefined;
  return decodeURIComponent(url.slice(prefix.length)).replace(/_/g, ' ');
}

/** Đường dẫn ảnh bản đồ phân bố trên Commons, thu nhỏ còn rộng 640 px. */
function commonsImageUrl(value: string): string {
  return `${value.replace(/^http:/, 'https:')}?width=640`;
}

/** Kết quả của một lần tìm loài. */
export interface SpeciesSearchResult {
  hits: SpeciesHit[];
  /**
   * Wikidata đang bận nên app chỉ dùng kết quả của iNaturalist.
   * Khi đó danh sách có thể thiếu loài, và thiếu tên tiếng Việt.
   */
  partial: boolean;
}

/** Tổng số điểm quan sát của một loài trên GBIF, và khung bao của các điểm. */
export interface ObservationSummary {
  count: number;
  box?: LngLatBox;
}

/** Loài có vùng phân bố trên iNaturalist hay không, và khung bao gần đúng của vùng đó. */
export interface RangeSummary {
  available: boolean;
  box?: LngLatBox;
}

/** Các điểm ảnh của một ô bản đồ, theo thứ tự đỏ, xanh lá, xanh dương, alpha. */
export interface TilePixels {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

/** Tải một ô bản đồ rồi đọc các điểm ảnh. Chỉ chạy được trên trình duyệt. */
async function loadTilePixels(url: string, signal: AbortSignal): Promise<TilePixels> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => resolve();
    image.onerror = () => reject(new SpeciesError(OFFLINE_MESSAGE));
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new SpeciesError(OFFLINE_MESSAGE);
  context.drawImage(image, 0, 0);
  return { data: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
}

/**
 * Tạo bộ hàm gọi dịch vụ. Mỗi dịch vụ có hàng đợi riêng, và kết quả được giữ trong bộ nhớ.
 * `loadPixels` chỉ thay khi chạy test.
 */
export function createSpeciesService(deps: Deps = defaultDeps, loadPixels = loadTilePixels) {
  const inatQueue = createQueue(QUEUE_INTERVAL_MS, deps);
  const wikidataQueue = createQueue(QUEUE_INTERVAL_MS, deps);
  const gbifQueue = createQueue(QUEUE_INTERVAL_MS / 4, deps);
  const searchCache = new Map<string, SpeciesSearchResult>();
  const infoCache = new Map<number, SpeciesInfo>();
  const observationCache = new Map<number, ObservationSummary>();
  const rangeCache = new Map<number, RangeSummary>();

  async function send(url: string, signal: AbortSignal, headers?: Record<string, string>): Promise<Response> {
    try {
      return await deps.fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]), headers });
    } catch (error) {
      if (signal.aborted) throw abortError();
      throw new SpeciesError(OFFLINE_MESSAGE, { cause: error });
    }
  }

  async function getJson<T>(queue: Queue, url: string, signal: AbortSignal, headers?: Record<string, string>): Promise<T> {
    return queue(async () => {
      let response = await send(url, signal, headers);
      const header = response.headers.get('retry-after');
      const retryAfter = header === null ? DEFAULT_RETRY_AFTER_S : Number(header);
      if (response.status === 429 && retryAfter > 0 && retryAfter <= MAX_RETRY_AFTER_S) {
        // Việc chờ nằm trong hàng đợi, nên các yêu cầu sau tới cùng dịch vụ cũng chờ theo.
        await deps.sleep(retryAfter * 1000);
        if (signal.aborted) throw abortError();
        response = await send(url, signal, headers);
      }
      if (response.status === 429) throw new SpeciesError(BUSY_MESSAGE);
      if (!response.ok) throw new SpeciesError(OFFLINE_MESSAGE);
      return (await response.json()) as T;
    }, signal);
  }

  const inat = <T>(path: string, signal: AbortSignal) => getJson<T>(inatQueue, `${INAT_API}${path}`, signal);
  const wikidataApi = <T>(params: Record<string, string>, signal: AbortSignal) =>
    // `origin=*` cho phép trình duyệt đọc kết quả mà không cần đăng nhập.
    getJson<T>(wikidataQueue, `${WIKIDATA_API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`, signal);
  const gbif = <T>(path: string, signal: AbortSignal) => getJson<T>(gbifQueue, `${GBIF_API}${path}`, signal);

  /** Tìm loài bằng tên tiếng Việt trên Wikidata. Chỉ lấy các mục có mã iNaturalist (P3151). */
  async function searchWikidata(query: string, signal: AbortSignal): Promise<WikidataTaxon[]> {
    const found = await wikidataApi<{ query?: { search: { title: string }[] } }>(
      { action: 'query', list: 'search', srsearch: `${query} haswbstatement:P3151`, srlimit: '10' },
      signal,
    );
    const ids = (found.query?.search ?? []).map((item) => item.title).filter((id) => /^Q\d+$/.test(id));
    if (ids.length === 0) return [];
    const { entities = {} } = await wikidataApi<{ entities?: Record<string, WikidataEntity> }>(
      { action: 'wbgetentities', ids: ids.join('|'), props: 'labels|claims|sitelinks', languages: 'vi|en', sitefilter: 'viwiki' },
      signal,
    );
    return ids.flatMap((qid): WikidataTaxon[] => {
      const entity = entities[qid];
      if (!entity) return [];
      const inatIds = claimValues(entity, 'P3151').flatMap((value) => toInt(value) ?? []);
      if (inatIds.length === 0) return [];
      const taxon: WikidataTaxon = { qid, inatIds };
      const vi = entity.labels?.vi?.value;
      const en = entity.labels?.en?.value;
      const article = entity.sitelinks?.viwiki?.title;
      const gbifKey = toInt(claimValues(entity, 'P846')[0]);
      if (vi) taxon.vi = vi;
      if (en) taxon.en = en;
      if (article) taxon.wikipediaVi = article;
      if (gbifKey) taxon.gbifKey = gbifKey;
      return [taxon];
    });
  }

  /** Tìm loài bằng tên khoa học hoặc tên tiếng Anh trên iNaturalist. Mã 1 là giới Động vật. */
  async function searchInat(query: string, signal: AbortSignal): Promise<TaxonRecord[]> {
    const params = new URLSearchParams({ q: query, taxon_id: '1', locale: 'vi', per_page: '10' });
    const { results = [] } = await inat<{ results?: InatTaxon[] }>(`/taxa/autocomplete?${params}`, signal);
    return results.map((raw) => toRecord(raw, true));
  }

  /** Lấy thông tin iNaturalist của nhiều loài trong một yêu cầu. */
  async function fetchRecords(ids: number[], signal: AbortSignal): Promise<Map<number, TaxonRecord>> {
    const records = new Map<number, TaxonRecord>();
    if (ids.length === 0) return records;
    const { results = [] } = await inat<{ results?: InatTaxon[] }>(
      `/taxa/${ids.slice(0, MAX_BATCH).join(',')}?locale=vi&per_page=${MAX_BATCH}`,
      signal,
    );
    for (const raw of results) records.set(raw.id, toRecord(raw, false));
    return records;
  }

  /**
   * Gọi Wikidata nhưng không để lỗi của Wikidata làm hỏng cả việc.
   * Wikidata chặn tìm kiếm toàn văn khá sớm, nên app vẫn chạy tiếp với dữ liệu của iNaturalist.
   */
  async function optionalWikidata<T>(task: () => Promise<T>, fallback: T): Promise<{ value: T; ok: boolean }> {
    try {
      return { value: await task(), ok: true };
    } catch (error) {
      if (error instanceof SpeciesError) return { value: fallback, ok: false };
      throw error;
    }
  }

  /** Tìm loài động vật theo tên. Hàm chỉ chạy khi người dùng bấm tìm, không chạy theo từng phím gõ. */
  async function search(rawQuery: string, signal: AbortSignal): Promise<SpeciesSearchResult> {
    const query = rawQuery.trim();
    if (query.length < MIN_QUERY_LENGTH) throw new SpeciesError(SHORT_QUERY_MESSAGE);
    const key = normalizeName(query);
    const cached = searchCache.get(key);
    if (cached) return cached;
    const [wikidata, inatHits] = await Promise.all([
      optionalWikidata(() => searchWikidata(query, signal), [] as WikidataTaxon[]),
      searchInat(query, signal),
    ]);
    const known = new Set(inatHits.map((record) => record.inatId));
    const missing = [...new Set(wikidata.value.flatMap((taxon) => taxon.inatIds))].filter((id) => !known.has(id));
    const records = await fetchRecords(missing, signal);
    const result: SpeciesSearchResult = {
      hits: mergeSearchResults(query, wikidata.value, inatHits, records),
      partial: !wikidata.ok,
    };
    // Kết quả thiếu không được giữ, để lần tìm sau hỏi lại Wikidata.
    if (wikidata.ok) searchCache.set(key, result);
    return result;
  }

  /** Thông tin Wikidata của một loài theo mã iNaturalist. */
  async function wikidataByInat(inatId: number, signal: AbortSignal) {
    // inatId là số nguyên, nên chèn thẳng vào câu truy vấn được.
    const query = `SELECT ?item ?vi ?article ?gbif ?map WHERE {
      ?item wdt:P3151 "${inatId}" .
      OPTIONAL { ?item rdfs:label ?vi FILTER(lang(?vi) = "vi") }
      OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://vi.wikipedia.org/> . }
      OPTIONAL { ?item wdt:P846 ?gbif }
      OPTIONAL { ?item wdt:P181 ?map }
    } LIMIT 1`;
    const data = await getJson<{ results?: { bindings: SparqlRow[] } }>(
      wikidataQueue,
      `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`,
      signal,
      { Accept: 'application/sparql-results+json' },
    );
    const row = data.results?.bindings[0];
    return {
      qid: row?.item?.value.split('/').pop(),
      vi: row?.vi?.value,
      wikipediaVi: viArticleTitle(row?.article?.value),
      gbifKey: toInt(row?.gbif?.value),
      rangeMapUrl: row?.map ? commonsImageUrl(row.map.value) : undefined,
    };
  }

  /** Khóa loài trên GBIF theo tên khoa học. Chỉ dùng khi Wikidata không có khóa. */
  async function gbifKeyByName(name: string, signal: AbortSignal): Promise<number | undefined> {
    const match = await gbif<{ usageKey?: number; matchType?: string }>(
      `/v1/species/match?${new URLSearchParams({ name, strict: 'true' })}`,
      signal,
    );
    return match.matchType === 'EXACT' ? match.usageKey : undefined;
  }

  /** Thông tin đầy đủ của một loài để hiện trên trang loài. */
  async function info(inatId: number, signal: AbortSignal): Promise<SpeciesInfo> {
    const cached = infoCache.get(inatId);
    if (cached) return cached;
    const { results = [] } = await inat<{ results?: InatTaxon[] }>(`/taxa/${inatId}?locale=vi`, signal);
    const raw = results[0];
    if (!raw) throw new SpeciesError(NOT_FOUND_MESSAGE);
    if (raw.is_active === false) {
      // Mã cũ chỉ có một mã thay thế thì chuyển sang mã đó. Nếu loài bị tách thành nhiều loài, app không đoán.
      const next = raw.current_synonymous_taxon_ids ?? [];
      if (next.length === 1 && next[0] !== undefined) return info(next[0], signal);
      throw new SpeciesError(SPLIT_MESSAGE);
    }
    // Nếu Wikidata bận, trang loài vẫn mở với tên của iNaturalist. Khóa GBIF khi đó tra theo tên khoa học.
    const { value: wikidata, ok: wikidataOk } = await optionalWikidata(
      () => wikidataByInat(raw.id, signal),
      {} as Awaited<ReturnType<typeof wikidataByInat>>,
    );
    const gbifKey = wikidata.gbifKey ?? (await gbifKeyByName(raw.name, signal));
    const record = toRecord(raw, false);
    const wikipediaTitle = wikidata.wikipediaVi ?? viArticleTitle(raw.wikipedia_url);
    const result: SpeciesInfo = {
      inatId: raw.id,
      name: displayName({
        wikidataVi: wikidata.vi,
        wikipediaVi: wikipediaTitle,
        inatVi: record.inatVi,
        english: record.english,
        scientific: raw.name,
      }),
      scientificName: raw.name,
      group: record.group,
      observationsCount: raw.observations_count ?? 0,
    };
    if (record.thumbnail) result.thumbnail = record.thumbnail;
    if (record.iucn) result.iucn = record.iucn;
    const photo = raw.default_photo;
    if (photo?.medium_url) {
      result.photo = {
        url: photo.medium_url,
        attribution: photo.attribution ?? '',
        license: (photo.license_code ?? '').toUpperCase(),
      };
    }
    if (wikidata.qid) result.wikidataId = wikidata.qid;
    if (wikipediaTitle) result.wikipediaTitle = wikipediaTitle;
    if (gbifKey) result.gbifKey = gbifKey;
    if (wikidata.rangeMapUrl) result.rangeMapUrl = wikidata.rangeMapUrl;
    // Thông tin thiếu phần Wikidata không được giữ, để lần mở sau hỏi lại.
    if (wikidataOk) infoCache.set(inatId, result);
    return result;
  }

  /**
   * Số điểm quan sát và khung bao của một loài trên GBIF.
   * Số điểm lấy từ API tìm kiếm, vì API này áp dụng bộ lọc nguồn dữ liệu.
   * Khung bao lấy từ `capabilities.json` của lớp bản đồ. File này bỏ qua bộ lọc, nên khung có thể rộng hơn một chút.
   */
  async function observations(gbifKey: number, signal: AbortSignal): Promise<ObservationSummary> {
    const cached = observationCache.get(gbifKey);
    if (cached) return cached;
    const { count = 0 } = await gbif<{ count?: number }>(
      `/v1/occurrence/search?taxonKey=${gbifKey}&${GBIF_BASIS_FILTER}&hasCoordinate=true&hasGeospatialIssue=false&limit=0`,
      signal,
    );
    const summary: ObservationSummary = { count };
    if (count > 0) {
      const extent = await gbif<{ total?: number; minLng?: number; minLat?: number; maxLng?: number; maxLat?: number }>(
        `/v2/map/occurrence/density/capabilities.json?taxonKey=${gbifKey}`,
        signal,
      );
      const { minLng, minLat, maxLng, maxLat } = extent;
      if ([minLng, minLat, maxLng, maxLat].every((v) => typeof v === 'number')) {
        summary.box = [minLng!, minLat!, maxLng!, maxLat!];
      }
    }
    observationCache.set(gbifKey, summary);
    return summary;
  }

  /**
   * Loài có vùng phân bố trên iNaturalist hay không, và khung bao của vùng đó.
   * App đọc ô bản đồ ở mức zoom 0, tức là một ô phủ cả thế giới (xem mục 6.4).
   * Khung bao chỉ gần đúng, vì mỗi điểm ảnh của ô này rộng khoảng 1,4 độ kinh.
   */
  async function range(inatId: number, signal: AbortSignal): Promise<RangeSummary> {
    const cached = rangeCache.get(inatId);
    if (cached) return cached;
    const url = rangeTileUrl(inatId).replace('{z}/{x}/{y}', '0/0/0');
    const { data, width, height } = await inatQueue(() => loadPixels(url, signal), signal);
    const box = opaqueBox(data, width, height);
    const result: RangeSummary = box ? { available: true, box } : { available: false };
    rangeCache.set(inatId, result);
    return result;
  }

  return { search, info, observations, range };
}

export type SpeciesService = ReturnType<typeof createSpeciesService>;

/** Bộ hàm dùng chung của app. */
export const speciesService: SpeciesService = createSpeciesService();
