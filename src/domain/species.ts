/**
 * Logic của tính năng vùng phân bố của loài (xem docs/SPECIES-RANGE.md).
 * File này chỉ có kiểu dữ liệu và hàm thuần. Phần gọi dịch vụ nằm ở src/services/species.ts.
 */

/** Các mức trong Sách đỏ IUCN, từ ít đến nhiều nguy cơ. "DD" là thiếu dữ liệu. */
export const IUCN_STATUSES = ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX', 'DD'] as const;
export type IucnStatus = (typeof IUCN_STATUSES)[number];

const IUCN_SET: ReadonlySet<string> = new Set(IUCN_STATUSES);

/** Tên tiếng Việt của các mức trong Sách đỏ. */
export const IUCN_LABELS: Record<IucnStatus, string> = {
  LC: 'Ít quan tâm',
  NT: 'Sắp bị đe dọa',
  VU: 'Sắp nguy cấp',
  EN: 'Nguy cấp',
  CR: 'Cực kỳ nguy cấp',
  EW: 'Tuyệt chủng trong tự nhiên',
  EX: 'Tuyệt chủng',
  DD: 'Thiếu dữ liệu',
};

/**
 * Đọc mức Sách đỏ từ dữ liệu của iNaturalist.
 * iNaturalist có cả mức của các danh sách quốc gia, nên app chỉ nhận mức của IUCN.
 * Mã có thể viết thường, ví dụ "en", nên được đổi sang chữ hoa trước khi so.
 */
export function parseIucn(status: string | undefined, authority: string | undefined): IucnStatus | undefined {
  if (!status) return undefined;
  if (authority !== undefined && !/iucn/i.test(authority)) return undefined;
  const code = status.toUpperCase();
  return IUCN_SET.has(code) ? (code as IucnStatus) : undefined;
}

/** Tên tiếng Việt của các nhóm loài mà iNaturalist dùng (trường `iconic_taxon_name`). */
const GROUP_LABELS: Record<string, string> = {
  Mammalia: 'Thú',
  Aves: 'Chim',
  Reptilia: 'Bò sát',
  Amphibia: 'Lưỡng cư',
  Actinopterygii: 'Cá',
  Mollusca: 'Thân mềm',
  Arachnida: 'Hình nhện',
  Insecta: 'Côn trùng',
  Animalia: 'Động vật khác',
};

export const groupLabel = (group: string): string => (Object.hasOwn(GROUP_LABELS, group) ? GROUP_LABELS[group]! : 'Động vật');

/** Một loài trong danh sách kết quả tìm. */
export interface SpeciesHit {
  inatId: number;
  /** Tên hiển thị, chọn bằng `displayName`. */
  name: string;
  scientificName: string;
  /** Nhóm loài của iNaturalist, ví dụ "Mammalia" hay "Aves". */
  group: string;
  thumbnail?: string;
  iucn?: IucnStatus;
}

/** Thông tin đầy đủ của một loài, hiện trên trang loài. */
export interface SpeciesInfo extends SpeciesHit {
  photo?: { url: string; attribution: string; license: string };
  /** Số lần quan sát trên iNaturalist. */
  observationsCount: number;
  wikidataId?: string;
  /** Tên bài Wikipedia tiếng Việt. */
  wikipediaTitle?: string;
  gbifKey?: number;
  /** Đường dẫn ảnh bản đồ phân bố trên Wikimedia Commons. */
  rangeMapUrl?: string;
}

/** Loài đang hiện trên bản đồ. App giữ trạng thái này riêng, không nằm trong `Selection`. */
export interface ActiveSpecies {
  inatId: number;
  gbifKey?: number;
  name: string;
  group: string;
  showRange: boolean;
  showObservations: boolean;
}

/** Loài gợi ý khi tab "Loài" còn trống. Mã iNaturalist và tên đã được kiểm tra ngày 27/11/2026. */
export const SUGGESTED_SPECIES: readonly SpeciesHit[] = [
  { inatId: 74973, name: 'Sao la', scientificName: 'Pseudoryx nghetinhensis', group: 'Mammalia', iucn: 'CR' },
  { inatId: 879166, name: 'Voọc Cát Bà', scientificName: 'Trachypithecus poliocephalus', group: 'Mammalia', iucn: 'CR' },
  { inatId: 43517, name: 'Chà vá chân đỏ', scientificName: 'Pygathrix nemaeus', group: 'Mammalia', iucn: 'CR' },
  { inatId: 885131, name: 'Vượn đen má hung', scientificName: 'Nomascus gabriellae', group: 'Mammalia', iucn: 'EN' },
  { inatId: 39569, name: 'Rùa mai mềm Thượng Hải', scientificName: 'Rafetus swinhoei', group: 'Reptilia', iucn: 'CR' },
  { inatId: 1200, name: 'Công lục', scientificName: 'Pavo muticus', group: 'Aves', iucn: 'EN' },
];

/** Đưa tên về dạng để so: chuẩn hóa Unicode, chữ thường, bỏ khoảng trắng thừa. */
export function normalizeName(name: string): string {
  return name.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
}

/** Bỏ dấu của tên, ví dụ "Chà vá" thành "cha va", để so khi người dùng gõ không dấu. */
export function foldName(name: string): string {
  return normalizeName(name).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

/**
 * Một trong các tên có chứa chữ người dùng gõ hay không.
 * Nếu chữ gõ có dấu, app so cả dấu. Nếu chữ gõ không dấu, app bỏ dấu của tên trước khi so.
 * Hai dịch vụ tìm kiếm đều trả về cả tên chỉ gần giống, ví dụ "Lacrau-de-São-Vicente" khi tìm "sao la".
 */
export function matchesQuery(names: readonly (string | undefined)[], query: string): boolean {
  const wanted = normalizeName(query);
  const plain = foldName(query) === wanted;
  return names.some((name) => name !== undefined && (plain ? foldName(name) : normalizeName(name)).includes(wanted));
}

/** Khung bao [tây, nam, đông, bắc], tính bằng độ. */
export type LngLatBox = [number, number, number, number];

/**
 * Khung bao của các điểm có màu trong ô bản đồ ở mức zoom 0.
 * Ô này phủ cả thế giới theo phép chiếu Web Mercator, nên mỗi điểm ảnh ứng với một vùng cố định.
 * Hàm trả về undefined khi mọi điểm đều trong suốt, tức là loài không có vùng phân bố.
 */
export function opaqueBox(rgba: ArrayLike<number>, width: number, height: number): LngLatBox | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return undefined;
  const lng = (x: number) => (x / width) * 360 - 180;
  const lat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / height))) * 180) / Math.PI;
  // Cạnh phải và cạnh dưới lấy mép ngoài của điểm ảnh cuối cùng.
  return [lng(minX), lat(maxY + 1), lng(maxX + 1), lat(minY)];
}

/**
 * Tên có viết bằng chữ Latin hay không.
 * iNaturalist đôi khi trả về tên tiếng Trung trong trường tên tiếng Việt, ví dụ "金龜" cho Rafetus swinhoei.
 */
export function isLatinName(name: string): boolean {
  return /^[\p{Script=Latin}\p{M}\d\s'’.,()-]+$/u.test(name);
}

/** Các nguồn tên của một loài, theo thứ tự ưu tiên. */
export interface NameSources {
  /** Nhãn tiếng Việt trên Wikidata. */
  wikidataVi?: string;
  /** Tên bài Wikipedia tiếng Việt. */
  wikipediaVi?: string;
  /** Tên tiếng Việt trên iNaturalist. */
  inatVi?: string;
  english?: string;
  scientific: string;
}

/**
 * Chọn tên hiển thị của một loài.
 * Thứ tự là nhãn tiếng Việt trên Wikidata, tên bài Wikipedia tiếng Việt, tên tiếng Việt trên iNaturalist,
 * tên tiếng Anh, rồi tên khoa học. Tên trùng tên khoa học hoặc không viết bằng chữ Latin bị bỏ qua.
 * Ví dụ, nhãn tiếng Việt của chim công trên Wikidata là "Pavo muticus", nên app dùng tên bài "Công lục".
 */
export function displayName(sources: NameSources): string {
  const scientific = normalizeName(sources.scientific);
  // Tên bài Wikipedia có thể kèm phần phân biệt trong ngoặc, ví dụ "Công (động vật)".
  const article = sources.wikipediaVi?.replace(/_/g, ' ').replace(/\s*\([^)]*\)\s*$/, '');
  for (const candidate of [sources.wikidataVi, article, sources.inatVi, sources.english]) {
    const name = candidate?.trim();
    if (name && isLatinName(name) && normalizeName(name) !== scientific) return name;
  }
  return sources.scientific;
}

/** Một loài trên iNaturalist, đã được rút gọn còn các trường app cần. */
export interface TaxonRecord {
  inatId: number;
  scientificName: string;
  rank: string;
  /** Có thuộc giới Động vật hay không. */
  isAnimal: boolean;
  /** Mã còn được dùng hay đã bị thay sau khi đổi cách phân loại. */
  active: boolean;
  group: string;
  inatVi?: string;
  english?: string;
  thumbnail?: string;
  iucn?: IucnStatus;
  /** Tên mà iNaturalist dùng để khớp với chữ gõ. Chỉ có ở kết quả tìm của iNaturalist. */
  matchedTerm?: string;
}

/** Một mục loài tìm được trên Wikidata. */
export interface WikidataTaxon {
  qid: string;
  /** Mã iNaturalist (P3151). Một mục có thể có nhiều mã sau khi iNaturalist đổi cách phân loại. */
  inatIds: number[];
  vi?: string;
  en?: string;
  wikipediaVi?: string;
  /** Khóa loài trên GBIF (P846). */
  gbifKey?: number;
}

/** Số kết quả tối đa trong danh sách tìm. */
export const MAX_SPECIES_RESULTS = 10;

/**
 * Gộp kết quả tìm của Wikidata và iNaturalist thành một danh sách.
 * - `wikidata` và `inat` giữ đúng thứ tự mà hai dịch vụ trả về.
 * - `records` chứa thông tin iNaturalist của mọi mã xuất hiện trong kết quả Wikidata.
 * Danh sách chỉ giữ loài (bậc species) thuộc giới Động vật và còn được dùng, có một tên chứa chữ gõ.
 * Loài có tên trùng hẳn với chữ gõ đứng đầu. Sau đó là kết quả của Wikidata, rồi đến kết quả của iNaturalist.
 */
export function mergeSearchResults(
  query: string,
  wikidata: readonly WikidataTaxon[],
  inat: readonly TaxonRecord[],
  records: ReadonlyMap<number, TaxonRecord>,
): SpeciesHit[] {
  const recordOf = (id: number) => records.get(id) ?? inat.find((record) => record.inatId === id);
  const isWanted = (record: TaxonRecord) => record.rank === 'species' && record.isAnimal && record.active;
  const entries: { record: TaxonRecord; taxon?: WikidataTaxon }[] = [];
  const seen = new Set<number>();

  for (const taxon of wikidata) {
    // Khi một mục có nhiều mã, app chọn mã đầu tiên còn được dùng.
    const record = taxon.inatIds.map(recordOf).find((r) => r !== undefined && r.active);
    if (!record || seen.has(record.inatId)) continue;
    seen.add(record.inatId);
    entries.push({ record, taxon });
  }
  for (const record of inat) {
    if (seen.has(record.inatId)) continue;
    seen.add(record.inatId);
    entries.push({ record, taxon: wikidata.find((t) => t.inatIds.includes(record.inatId)) });
  }

  const names = (record: TaxonRecord, taxon: WikidataTaxon | undefined) => [
    taxon?.vi,
    taxon?.en,
    taxon?.wikipediaVi,
    record.scientificName,
    record.matchedTerm,
    record.inatVi,
    record.english,
  ];
  const hits = entries
    .filter(({ record, taxon }) => isWanted(record) && matchesQuery(names(record, taxon), query))
    .map(({ record, taxon }): SpeciesHit => {
      const hit: SpeciesHit = {
        inatId: record.inatId,
        name: displayName({
          wikidataVi: taxon?.vi,
          wikipediaVi: taxon?.wikipediaVi,
          inatVi: record.inatVi,
          english: record.english ?? taxon?.en,
          scientific: record.scientificName,
        }),
        scientificName: record.scientificName,
        group: record.group,
      };
      if (record.thumbnail) hit.thumbnail = record.thumbnail;
      if (record.iucn) hit.iucn = record.iucn;
      return hit;
    });

  const wanted = normalizeName(query);
  const isExact = (hit: SpeciesHit) => normalizeName(hit.name) === wanted || normalizeName(hit.scientificName) === wanted;
  // Array.prototype.sort giữ nguyên thứ tự của các phần tử bằng nhau.
  return hits.sort((a, b) => Number(isExact(b)) - Number(isExact(a))).slice(0, MAX_SPECIES_RESULTS);
}
