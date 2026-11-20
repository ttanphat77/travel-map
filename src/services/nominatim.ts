export interface SearchResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
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

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
