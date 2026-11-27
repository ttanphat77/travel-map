/**
 * Lấy thông tin tổng hợp sẵn từ Wikipedia tiếng Việt và Wikidata.
 * Cả hai dịch vụ cho trình duyệt gọi thẳng. Kết quả được giữ trong bộ nhớ để không gọi lại.
 */

const WIKIPEDIA = 'https://vi.wikipedia.org';
const SPARQL = 'https://query.wikidata.org/sparql';
const TIMEOUT_MS = 15000;
/** Wikimedia đề nghị ứng dụng chạy trên trình duyệt gửi tên ứng dụng qua header này. */
const WIKI_HEADERS = { 'Api-User-Agent': 'MapViewer/0.1' };
/** Mã đơn vị km² trên Wikidata. */
const SQUARE_KILOMETRE = 'http://www.wikidata.org/entity/Q712226';

const cache = new Map<string, unknown>();

/** Gọi một địa chỉ trả về JSON. Kết quả 404 được trả về là null. */
async function getJson<T>(url: string, signal: AbortSignal, headers?: Record<string, string>): Promise<T | null> {
  if (cache.has(url)) return cache.get(url) as T | null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  const timer = setTimeout(abort, TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (response.status === 404) {
      cache.set(url, null);
      return null;
    }
    if (!response.ok) throw new Error(`${new URL(url).host} trả về mã lỗi ${response.status}`);
    const data = (await response.json()) as T;
    cache.set(url, data);
    return data;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

type Binding = Record<string, { value: string } | undefined>;

async function sparql(query: string, signal: AbortSignal): Promise<Binding[]> {
  const url = `${SPARQL}?format=json&query=${encodeURIComponent(query)}`;
  const data = await getJson<{ results: { bindings: Binding[] } }>(url, signal);
  return data?.results.bindings ?? [];
}

const entityId = (uri: string) => uri.replace('http://www.wikidata.org/entity/', '');

/** Đổi "Point(139.69 35.68)" thành [vĩ độ, kinh độ]. */
function parsePoint(text: string | undefined): [number, number] | undefined {
  const match = text?.match(/Point\(([-\d.e]+) ([-\d.e]+)\)/);
  return match ? [Number(match[2]), Number(match[1])] : undefined;
}

// ---------- Bài viết Wikipedia ----------

export interface WikiSummary {
  title: string;
  /** Mô tả ngắn, ví dụ "tỉnh thuộc vùng Đông Bắc Bộ của Việt Nam". */
  description?: string;
  extract: string;
  image?: string;
  url: string;
  wikidataId?: string;
}

interface RawSummary {
  type: string;
  title: string;
  description?: string;
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
  wikibase_item?: string;
}

/** Đoạn mở đầu, ảnh và đường dẫn của một bài Wikipedia tiếng Việt. */
export async function fetchSummary(title: string, signal: AbortSignal): Promise<WikiSummary | null> {
  const path = encodeURIComponent(title.replace(/ /g, '_'));
  const raw = await getJson<RawSummary>(`${WIKIPEDIA}/api/rest_v1/page/summary/${path}`, signal, WIKI_HEADERS);
  if (!raw || raw.type === 'disambiguation' || !raw.extract) return null;
  return {
    title: raw.title,
    description: raw.description,
    extract: raw.extract,
    image: raw.thumbnail?.source,
    url: raw.content_urls?.desktop?.page ?? `${WIKIPEDIA}/wiki/${path}`,
    wikidataId: raw.wikibase_item,
  };
}

// ---------- Số liệu Wikidata ----------

/** Các thuộc tính Wikidata được dùng. */
const PROPS = {
  area: 'P2046',
  population: 'P1082',
  capital: 'P36',
  flag: 'P41',
  borders: 'P47',
  highestPoint: 'P610',
  timezone: 'P421',
  website: 'P856',
  languages: 'P37',
  currencies: 'P38',
  continents: 'P30',
  callingCode: 'P474',
  drivingSide: 'P1622',
  plate: 'P395',
  phoneCode: 'P473',
} as const;

export interface EntityFacts {
  /** Tên bài Wikipedia tiếng Việt của thực thể, nếu có. */
  articleTitle?: string;
  areaKm2?: number;
  population?: { value: number; year?: string };
  capital?: { name: string; coord?: [number, number] };
  flag?: string;
  borders: string[];
  highestPoint?: string;
  timezone?: string;
  website?: string;
  languages: string[];
  currencies: string[];
  continents: string[];
  callingCode?: string;
  drivingSide?: string;
  plate?: string;
  phoneCode?: string;
}

interface Row {
  pid: string;
  value: string;
  label: string;
  preferred: boolean;
  /** Thời điểm của số liệu, dùng để chọn số dân mới nhất. */
  date?: string;
  /** Giá trị đã hết hiệu lực, ví dụ thủ đô cũ. */
  ended: boolean;
  unit?: string;
  coord?: [number, number];
}

function factsQuery(qid: string): string {
  const values = Object.values(PROPS)
    .map((p) => `("${p}" p:${p} ps:${p} psv:${p})`)
    .join(' ');
  return `SELECT ?pid ?val ?valLabel ?rank ?date ?end ?unit ?coord WHERE {
    {
      VALUES (?pid ?p ?ps ?psv) { ${values} }
      wd:${qid} ?p ?st . ?st ?ps ?val ; wikibase:rank ?rank .
      FILTER(?rank != wikibase:DeprecatedRank)
      OPTIONAL { ?st pq:P585 ?date }
      OPTIONAL { ?st pq:P582 ?end }
      OPTIONAL { ?st ?psv ?node . ?node wikibase:quantityUnit ?unit }
      OPTIONAL { ?val wdt:P625 ?coord }
    } UNION {
      ?val schema:about wd:${qid} ; schema:isPartOf <https://vi.wikipedia.org/> .
      BIND("article" AS ?pid)
    }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "vi,en". }
  }`;
}

/** Giá trị còn hiệu lực. Nếu có giá trị được Wikidata ưu tiên thì chỉ lấy các giá trị đó. */
function current(rows: Row[], pid: string): Row[] {
  const live = rows.filter((r) => r.pid === pid && !r.ended);
  const preferred = live.filter((r) => r.preferred);
  return preferred.length > 0 ? preferred : live;
}

function newest(rows: Row[]): Row | undefined {
  return [...rows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
}

/** Nhãn của các giá trị, bỏ nhãn trùng và bỏ giá trị chưa có tên (chỉ có mã Q). */
function labels(rows: Row[]): string[] {
  return [...new Set(rows.map((r) => r.label).filter((label) => label && !/^Q\d+$/.test(label)))];
}

/** Số liệu địa lý và thông tin hữu ích của một tỉnh hoặc quốc gia. */
export async function fetchFacts(qid: string, signal: AbortSignal): Promise<EntityFacts> {
  const rows: Row[] = (await sparql(factsQuery(qid), signal)).map((b) => ({
    pid: b.pid?.value ?? '',
    value: b.val?.value ?? '',
    label: b.valLabel?.value ?? '',
    preferred: b.rank?.value.endsWith('PreferredRank') ?? false,
    date: b.date?.value,
    ended: b.end !== undefined,
    unit: b.unit?.value,
    coord: parsePoint(b.coord?.value),
  }));
  const first = (pid: string) => current(rows, pid)[0];

  const area = newest(current(rows, PROPS.area).filter((r) => r.unit === SQUARE_KILOMETRE));
  const population = newest(current(rows, PROPS.population));
  const capital = first(PROPS.capital);
  const flag = first(PROPS.flag);
  const article = rows.find((r) => r.pid === 'article');
  // Múi giờ có nhiều cách ghi. Cách ghi "UTC+9" dễ hiểu nhất với người đọc.
  const timezones = labels(current(rows, PROPS.timezone));

  return {
    articleTitle: article ? decodeURIComponent(article.value.split('/wiki/')[1] ?? '').replace(/_/g, ' ') : undefined,
    areaKm2: area ? Number(area.value) : undefined,
    population: population ? { value: Number(population.value), year: population.date?.slice(0, 4) } : undefined,
    capital: capital && !/^Q\d+$/.test(capital.label) ? { name: capital.label, coord: capital.coord } : undefined,
    flag: flag ? `${flag.value.replace('http://', 'https://')}?width=64` : undefined,
    borders: labels(current(rows, PROPS.borders)),
    highestPoint: labels(current(rows, PROPS.highestPoint))[0],
    timezone: timezones.find((t) => t.startsWith('UTC')) ?? timezones[0],
    website: first(PROPS.website)?.value,
    languages: labels(current(rows, PROPS.languages)),
    currencies: labels(current(rows, PROPS.currencies)),
    continents: labels(current(rows, PROPS.continents)),
    callingCode: first(PROPS.callingCode)?.value,
    drivingSide: labels(current(rows, PROPS.drivingSide))[0],
    plate: first(PROPS.plate)?.value,
    phoneCode: first(PROPS.phoneCode)?.value,
  };
}

// ---------- Điểm đến nổi bật ----------

/** Nhóm loại địa điểm, dùng để chọn biểu tượng. */
export type AttractionCategory =
  | 'attraction'
  | 'heritage'
  | 'museum'
  | 'beach'
  | 'religious'
  | 'park'
  | 'mountain'
  | 'water'
  | 'island'
  | 'cave'
  | 'market'
  | 'monument'
  | 'castle'
  | 'zoo'
  | 'fun'
  | 'tower';

export interface Attraction {
  id: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
  category: AttractionCategory;
  /** Đường dẫn bài Wikipedia tiếng Việt, nếu có. */
  article?: string;
}

/**
 * Các loại địa điểm được coi là điểm du lịch: điểm tham quan, bảo tàng, bãi biển, đền chùa, nhà thờ,
 * công viên, vườn quốc gia, núi, thác, hồ, đảo, hang động, chợ, tượng đài, di tích, cung điện, thành cổ,
 * vườn thú, khu vui chơi, ngọn hải đăng, lăng mộ, tháp, phố cổ và quảng trường.
 */
const TYPE_CATEGORY: Record<string, AttractionCategory> = {
  Q570116: 'attraction',
  Q33506: 'museum',
  Q40080: 'beach',
  Q44539: 'religious',
  Q5393308: 'religious',
  Q16970: 'religious',
  Q2977: 'religious',
  Q22698: 'park',
  Q46169: 'park',
  Q1107656: 'park',
  Q8502: 'mountain',
  Q34038: 'water',
  Q23397: 'water',
  Q23442: 'island',
  Q35509: 'cave',
  Q37654: 'market',
  Q4989906: 'monument',
  Q1081138: 'monument',
  Q839954: 'monument',
  Q381885: 'monument',
  Q162875: 'monument',
  Q16560: 'castle',
  Q57821: 'castle',
  Q23413: 'castle',
  Q43501: 'zoo',
  Q194195: 'fun',
  Q39715: 'tower',
  Q12518: 'tower',
  Q174782: 'attraction',
  Q2319498: 'attraction',
};
const TRAVEL_TYPES = Object.keys(TYPE_CATEGORY);
/** Nhóm chung chung. Khi một địa điểm thuộc nhiều loại, app ưu tiên nhóm cụ thể hơn. */
const GENERIC_CATEGORIES = new Set<AttractionCategory>(['attraction', 'heritage']);
const TRAVEL_FILTER = `{ VALUES ?type { ${TRAVEL_TYPES.map((t) => `wd:${t}`).join(' ')} } ?item wdt:P31 ?type . }
  UNION { ?item wdt:P1435 wd:Q9259 . }`;

/** Câu truy vấn chung. `where` chọn địa điểm và gắn tọa độ vào ?coord. Kết quả xếp theo số ngôn ngữ có bài viết. */
function attractionQuery(where: string, limit: number): string {
  return `SELECT ?item ?itemLabel ?itemDescription ?sitelinks ?coord ?article ?type WHERE {
    ${where}
    ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= 2)
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://vi.wikipedia.org/> . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "vi,en". }
  } ORDER BY DESC(?sitelinks) LIMIT ${limit}`;
}

async function fetchAttractions(query: string, signal: AbortSignal): Promise<Attraction[]> {
  const byId = new Map<string, Attraction>();
  const result: Attraction[] = [];
  for (const b of await sparql(query, signal)) {
    const id = entityId(b.item?.value ?? '');
    const name = b.itemLabel?.value ?? '';
    const coord = parsePoint(b.coord?.value);
    // Địa điểm chỉ được ghi là di sản UNESCO thì không có loại cụ thể.
    const category: AttractionCategory = TYPE_CATEGORY[entityId(b.type?.value ?? '')] ?? 'heritage';
    // Một địa điểm có thể thuộc nhiều loại nên xuất hiện nhiều lần. Lần sau chỉ dùng để lấy loại cụ thể hơn.
    const existing = byId.get(id);
    if (existing) {
      if (GENERIC_CATEGORIES.has(existing.category) && !GENERIC_CATEGORIES.has(category)) existing.category = category;
      continue;
    }
    // Địa điểm chưa có tên hoặc chưa có tọa độ thì bỏ qua.
    if (!id || !coord || /^Q\d+$/.test(name)) continue;
    const attraction: Attraction = {
      id,
      name,
      description: b.itemDescription?.value,
      lat: coord[0],
      lng: coord[1],
      category,
      article: b.article?.value,
    };
    byId.set(id, attraction);
    result.push(attraction);
  }
  return result;
}

/**
 * Điểm du lịch thuộc một tỉnh, theo thông tin "nằm trong đơn vị hành chính" (P131) của Wikidata.
 * Wikidata ghi địa điểm nằm trong xã hay huyện nào, rồi xã hay huyện đó nằm trong tỉnh nào.
 * Sau đợt sáp nhập năm 2025, tỉnh mới giữ mục Wikidata của một tỉnh cũ, và ghi các tỉnh cũ còn lại
 * trong mục "thay thế cho" (P1365). Nhiều địa điểm vẫn chỉ ghi tỉnh cũ, nên câu truy vấn lấy cả các tỉnh đó.
 */
export function fetchAttractionsInProvince(provinceQid: string, signal: AbortSignal): Promise<Attraction[]> {
  // Một tỉnh có hàng nghìn mục con. Wikidata cần đi từ tỉnh xuống trước rồi mới lọc theo loại,
  // nên câu truy vấn tắt bộ tối ưu để giữ đúng thứ tự viết.
  // Bộ lọc loại dùng FILTER IN thay cho VALUES, vì VALUES sẽ quét mọi địa điểm cùng loại trên thế giới.
  const where = `hint:Query hint:optimizer "None" .
    { BIND(wd:${provinceQid} AS ?area) } UNION { wd:${provinceQid} wdt:P1365 ?area . }
    ?item wdt:P131+ ?area .
    ?item wdt:P625 ?coord .
    { ?item wdt:P31 ?type . FILTER(?type IN (${TRAVEL_TYPES.map((t) => `wd:${t}`).join(', ')})) }
    UNION { ?item wdt:P1435 wd:Q9259 . }`;
  return fetchAttractions(attractionQuery(where, 60), signal);
}

/** Điểm du lịch trong bán kính `km` quanh một tọa độ. */
export function fetchAttractionsAround(lat: number, lng: number, km: number, signal: AbortSignal): Promise<Attraction[]> {
  const where = `SERVICE wikibase:around {
      ?item wdt:P625 ?coord .
      bd:serviceParam wikibase:center "Point(${lng.toFixed(4)} ${lat.toFixed(4)})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "${km}" .
    }
    ${TRAVEL_FILTER}`;
  return fetchAttractions(attractionQuery(where, 12), signal);
}

/** Di sản thế giới UNESCO của một quốc gia. */
export function fetchWorldHeritage(countryQid: string, signal: AbortSignal): Promise<Attraction[]> {
  const where = `?item wdt:P1435 wd:Q9259 ; wdt:P17 wd:${countryQid} . OPTIONAL { ?item wdt:P625 ?coord }`;
  return fetchAttractions(attractionQuery(where, 12), signal);
}
