import { describe, expect, it, vi } from 'vitest';
import { MIN_INTERVAL_MS, SearchError, buildSearchUrl, createSearcher } from './nominatim';

function fakeDeps(responses: Record<string, unknown> = {}) {
  let clock = 0;
  const starts: number[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request) => {
    starts.push(clock);
    const q = new URL(String(url)).searchParams.get('q') ?? '';
    const body = responses[q];
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body ?? []), { status: 200 });
  });
  return {
    starts,
    fetchFn,
    deps: {
      fetch: fetchFn as unknown as typeof fetch,
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms;
      },
    },
  };
}

const HOI_AN = [{ name: 'Hội An', display_name: 'Hội An, Đà Nẵng, Việt Nam', lat: '15.88', lon: '108.33' }];

describe('buildSearchUrl', () => {
  it('có q, jsonv2, limit 5 và accept-language=vi', () => {
    const url = new URL(buildSearchUrl('Hội An'));
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(url.searchParams.get('q')).toBe('Hội An');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('accept-language')).toBe('vi');
  });
});

describe('createSearcher', () => {
  it('đổi kết quả sang tên, tọa độ dạng số', async () => {
    const { deps } = fakeDeps({ 'Hội An': HOI_AN });
    const search = createSearcher(deps);
    expect(await search('Hội An')).toEqual([
      { name: 'Hội An', displayName: 'Hội An, Đà Nẵng, Việt Nam', lat: 15.88, lng: 108.33 },
    ]);
  });

  it('hai yêu cầu liên tiếp cách nhau ít nhất 1 giây', async () => {
    const { deps, starts } = fakeDeps({ a: [], b: [] });
    const search = createSearcher(deps);
    await search('a');
    await search('b');
    expect(starts).toHaveLength(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(MIN_INTERVAL_MS);
  });

  it('tìm lại cùng một chữ thì dùng kết quả cũ, không gọi lại dịch vụ', async () => {
    const { deps, fetchFn } = fakeDeps({ 'Hội An': HOI_AN });
    const search = createSearcher(deps);
    await search('Hội An');
    await search('  hội an ');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('chữ rỗng thì không gọi dịch vụ', async () => {
    const { deps, fetchFn } = fakeDeps();
    expect(await createSearcher(deps)('   ')).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('lỗi mạng trả về thông báo tiếng Việt', async () => {
    const { deps } = fakeDeps({ x: new TypeError('Failed to fetch') });
    await expect(createSearcher(deps)('x')).rejects.toEqual(
      new SearchError('Không kết nối được dịch vụ tìm kiếm. Thử lại sau.'),
    );
  });

  it('mã lỗi HTTP trả về SearchError', async () => {
    const deps = {
      fetch: (async () => new Response('', { status: 503 })) as unknown as typeof fetch,
      now: () => 0,
      sleep: async () => undefined,
    };
    await expect(createSearcher(deps)('x')).rejects.toBeInstanceOf(SearchError);
  });
});
