import type { RegionLookup } from '../domain/region';

export interface SearchResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  /**
   * Nhóm địa điểm theo cách chia của bản đồ nền: "place" là địa danh lớn như thành phố,
   * "water_name" là mặt nước, "poi" là địa điểm nhỏ như quán hay chùa.
   */
  group: string;
  /** Loại chi tiết theo thẻ của OpenStreetMap, ví dụ "restaurant" hay "city". */
  type: string;
  /** Nhóm thẻ của OpenStreetMap, ví dụ "amenity", "tourism" hay "shop". */
  poiClass: string;
}

export class SearchError extends Error {}

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
/** Chính sách của Nominatim cho phép tối đa 1 yêu cầu mỗi giây. */
export const MIN_INTERVAL_MS = 1000;
export const TIMEOUT_MS = 8000;

interface NominatimItem {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  /** Nhóm thẻ của OpenStreetMap, ví dụ "amenity" hay "place". */
  category?: string;
  /** Giá trị thẻ của OpenStreetMap, ví dụ "restaurant" hay "city". */
  type?: string;
}

/** Mặt nước như hồ, vịnh hay eo biển. Trang thông tin coi đây là địa danh lớn. */
const WATER_TYPES = new Set(['water', 'bay', 'strait', 'lake', 'reservoir']);

/** Đổi nhóm thẻ của OpenStreetMap sang nhóm địa điểm của bản đồ nền. */
export function searchGroup(category: string, type: string): string {
  if (category === 'place' || category === 'boundary') return 'place';
  if (category === 'waterway' || (category === 'natural' && WATER_TYPES.has(type))) return 'water_name';
  return 'poi';
}

export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': 'vi' });
  return `${NOMINATIM_URL}?${params.toString()}`;
}

interface Deps {
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

const defaultDeps: Deps = {
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Tạo hàm tìm địa điểm qua Nominatim.
 * Hàm giữ khoảng cách tối thiểu 1 giây giữa hai yêu cầu, lưu kết quả cũ trong bộ nhớ,
 * và hủy yêu cầu cũ khi có yêu cầu mới.
 */
export function createSearcher(deps: Deps = defaultDeps) {
  const cache = new Map<string, SearchResult[]>();
  let lastStart = -Infinity;
  let queue: Promise<unknown> = Promise.resolve();
  let current: AbortController | null = null;

  async function run(query: string, controller: AbortController): Promise<SearchResult[]> {
    const wait = lastStart + MIN_INTERVAL_MS - deps.now();
    if (wait > 0) await deps.sleep(wait);
    if (controller.signal.aborted) throw new DOMException('Đã hủy', 'AbortError');
    lastStart = deps.now();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await deps.fetch(buildSearchUrl(query), {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new SearchError(`Dịch vụ tìm kiếm trả về mã lỗi ${response.status}`);
      const items = (await response.json()) as NominatimItem[];
      return items.map((item) => ({
        name: item.name || item.display_name.split(',')[0]!.trim(),
        displayName: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        group: searchGroup(item.category ?? '', item.type ?? ''),
        type: item.type ?? '',
        poiClass: item.category ?? '',
      }));
    } finally {
      clearTimeout(timer);
    }
  }

  return async function search(rawQuery: string): Promise<SearchResult[]> {
    const query = rawQuery.trim();
    if (query === '') return [];
    const key = query.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    current?.abort();
    const controller = new AbortController();
    current = controller;
    const task = queue.then(() => run(query, controller));
    queue = task.catch(() => undefined);
    try {
      const results = await task;
      cache.set(key, results);
      return results;
    } catch (error) {
      if (error instanceof SearchError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError' && current !== controller) throw error;
      throw new SearchError('Không kết nối được dịch vụ tìm kiếm. Thử lại sau.');
    }
  };
}

const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const reverseCache = new Map<string, ReverseResult | null>();
let lastReverse = -Infinity;
let reverseQueue: Promise<unknown> = Promise.resolve();

interface ReverseResult {
  display_name?: string;
  name?: string;
  type?: string;
  /** Thông tin thêm của OpenStreetMap, ví dụ giờ mở cửa, điện thoại, website, Wikipedia. */
  extratags?: Record<string, string> | null;
  /** Các cấp hành chính chứa tọa độ, có cả mã nước và mã vùng ISO. */
  address?: Record<string, string>;
}

/**
 * Gửi một yêu cầu tra ngược tọa độ tới Nominatim.
 * Các yêu cầu được xếp hàng và cách nhau ít nhất 1 giây, đúng chính sách của Nominatim.
 * Kết quả được giữ trong bộ nhớ để không hỏi lại cùng một chỗ.
 */
function reverseRequest(params: Record<string, string>, signal: AbortSignal): Promise<ReverseResult | null> {
  const query = new URLSearchParams({ format: 'jsonv2', 'accept-language': 'vi', ...params }).toString();
  if (reverseCache.has(query)) return Promise.resolve(reverseCache.get(query) ?? null);
  const task = reverseQueue.then(async () => {
    const wait = lastReverse + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (signal.aborted) throw new DOMException('Đã hủy', 'AbortError');
    lastReverse = Date.now();
    const response = await fetch(`${REVERSE_URL}?${query}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Nominatim trả về mã lỗi ${response.status}`);
    const data = (await response.json()) as ReverseResult & { error?: string };
    const result = data.error ? null : data;
    reverseCache.set(query, result);
    return result;
  });
  reverseQueue = task.catch(() => undefined);
  return task;
}

/** Tra địa chỉ của một tọa độ qua Nominatim. */
export async function reverseGeocode(lat: number, lng: number, signal: AbortSignal): Promise<string | null> {
  const result = await reverseRequest({ lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: '18' }, signal);
  return result?.display_name ?? null;
}

/**
 * Tra nước và tỉnh chứa một tọa độ qua Nominatim.
 * Nominatim dùng ranh giới hành chính đầy đủ của OpenStreetMap, có cả đảo nhỏ và vùng biển.
 * Kết quả null nghĩa là tọa độ không thuộc nước nào. Lỗi mạng thì hàm ném lỗi.
 */
export async function lookupRegion(lat: number, lng: number, signal: AbortSignal): Promise<RegionLookup | null> {
  // Mức zoom 5 cho kết quả ở cấp tỉnh, nên Nominatim không trả về con phố hay tòa nhà tại tọa độ đó.
  const result = await reverseRequest({ lat: lat.toFixed(6), lon: lng.toFixed(6), zoom: '5', addressdetails: '1' }, signal);
  const address = result?.address;
  if (!address?.country_code) return null;
  return {
    countryCode: address.country_code,
    subdivisionCodes: Object.entries(address)
      .filter(([key]) => key.startsWith('ISO3166-2'))
      .map(([, value]) => value),
    stateName: address.state ?? address.city,
  };
}

export interface PlaceDetails {
  address: string | null;
  openingHours?: string;
  phone?: string;
  website?: string;
  /** Mã Wikidata của địa điểm, nếu OpenStreetMap có ghi. */
  wikidata?: string;
  /** Tên bài Wikipedia tiếng Việt, nếu OpenStreetMap có ghi. */
  wikipediaVi?: string;
}

/**
 * Tra thông tin của một địa điểm trên bản đồ qua Nominatim.
 * Với địa điểm nhỏ như quán hay chùa, app hỏi riêng lớp địa điểm để không lấy nhầm con đường bên cạnh.
 */
export async function lookupPlace(
  lat: number,
  lng: number,
  kind: 'poi' | 'area',
  signal: AbortSignal,
): Promise<PlaceDetails> {
  const params: Record<string, string> = {
    lat: lat.toFixed(6),
    lon: lng.toFixed(6),
    extratags: '1',
    // Địa danh lớn như thành phố cần mức zoom nhỏ, nếu không Nominatim sẽ trả về con phố tại tọa độ đó.
    zoom: kind === 'poi' ? '18' : '10',
  };
  if (kind === 'poi') params.layer = 'poi,natural,manmade';
  const result = await reverseRequest(params, signal);
  const tags = result?.extratags ?? {};
  const wikipedia = tags.wikipedia;
  return {
    address: result?.display_name ?? null,
    openingHours: tags.opening_hours,
    phone: tags.phone ?? tags['contact:phone'],
    website: tags.website ?? tags['contact:website'],
    wikidata: tags.wikidata,
    wikipediaVi: wikipedia?.startsWith('vi:') ? wikipedia.slice(3) : undefined,
  };
}

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
