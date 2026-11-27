import { describe, expect, it, vi } from 'vitest';
import {
  BUSY_MESSAGE,
  OFFLINE_MESSAGE,
  QUEUE_INTERVAL_MS,
  SHORT_QUERY_MESSAGE,
  SPLIT_MESSAGE,
  SpeciesError,
  createSpeciesService,
  observationTileUrl,
} from './species';

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

/** `fetch` giả. Mỗi yêu cầu được trả lời theo hàm `route`, và đồng hồ giả chỉ chạy khi hàng đợi chờ. */
function fakeDeps(route: (url: URL) => Reply) {
  let clock = 0;
  const calls: { url: URL; at: number }[] = [];
  const fetchFn = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push({ url, at: clock });
    const reply = route(url);
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200, headers: reply.headers });
  });
  const deps = {
    fetch: fetchFn as unknown as typeof fetch,
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
  };
  return { calls, deps };
}

const signal = () => new AbortController().signal;

// ---------- Dữ liệu mẫu, chép theo dạng thật của từng dịch vụ ----------

const claim = (value: string, rank = 'normal') => ({ rank, mainsnak: { datavalue: { value } } });

const WIKIDATA_SEARCH = { query: { search: [{ title: 'Q1' }, { title: 'Q2' }] } };
const WIKIDATA_ENTITIES = {
  entities: {
    Q1: {
      labels: { vi: { value: 'Voọc xám' }, en: { value: 'Indochinese grey langur' } },
      claims: { P3151: [claim('100')], P846: [claim('555')] },
      sitelinks: { viwiki: { title: 'Voọc xám' } },
    },
    Q2: {
      labels: { vi: { value: 'Voọc bạc' } },
      // Mã 199 bị đánh dấu là sai, nên app chỉ dùng mã 201.
      claims: { P3151: [claim('199', 'deprecated'), claim('201')] },
    },
  },
};
const INAT_AUTOCOMPLETE = {
  results: [
    {
      id: 300,
      name: 'Trachypithecus poliocephalus',
      rank: 'species',
      iconic_taxon_name: 'Mammalia',
      preferred_common_name: 'Voọc Cát Bà',
      default_photo: { square_url: 'https://example.org/s.jpg' },
      conservation_status: { status: 'cr', authority: 'IUCN Red List' },
    },
  ],
};
const animal = (id: number, name: string) => ({ id, name, rank: 'species', ancestor_ids: [48460, 1, 2], iconic_taxon_name: 'Mammalia' });
const INAT_BATCH = { results: [animal(100, 'Trachypithecus crepusculus'), animal(201, 'Trachypithecus germaini')] };

function searchRoute(url: URL): Reply {
  if (url.host === 'www.wikidata.org') {
    return { body: url.searchParams.get('action') === 'query' ? WIKIDATA_SEARCH : WIKIDATA_ENTITIES };
  }
  if (url.pathname === '/v1/taxa/autocomplete') return { body: INAT_AUTOCOMPLETE };
  if (url.pathname === '/v1/taxa/100,201') return { body: INAT_BATCH };
  return { status: 404 };
}

describe('tìm loài', () => {
  it('gộp kết quả của Wikidata và iNaturalist bằng 4 yêu cầu', async () => {
    const { calls, deps } = fakeDeps(searchRoute);
    const { hits, partial } = await createSpeciesService(deps).search('voọc', signal());
    expect(partial).toBe(false);
    expect(hits.map((h) => `${h.inatId} ${h.name}`)).toEqual(['100 Voọc xám', '201 Voọc bạc', '300 Voọc Cát Bà']);
    expect(hits[2]).toMatchObject({ iucn: 'CR', thumbnail: 'https://example.org/s.jpg' });
    expect(calls).toHaveLength(4);
    // Wikidata chỉ được hỏi các mục có mã iNaturalist, và yêu cầu có origin=* để trình duyệt đọc được.
    const wikidataSearch = calls.find((c) => c.url.searchParams.get('action') === 'query')!.url;
    expect(wikidataSearch.searchParams.get('srsearch')).toBe('voọc haswbstatement:P3151');
    expect(wikidataSearch.searchParams.get('origin')).toBe('*');
    // iNaturalist chỉ tìm trong giới Động vật.
    expect(calls.find((c) => c.url.pathname === '/v1/taxa/autocomplete')!.url.searchParams.get('taxon_id')).toBe('1');
  });

  it('tìm lại cùng chữ thì dùng kết quả cũ', async () => {
    const { calls, deps } = fakeDeps(searchRoute);
    const service = createSpeciesService(deps);
    await service.search('voọc', signal());
    await service.search('  VOỌC ', signal());
    expect(calls).toHaveLength(4);
  });

  it('hai yêu cầu liên tiếp tới iNaturalist cách nhau ít nhất 1 giây', async () => {
    const { calls, deps } = fakeDeps(searchRoute);
    await createSpeciesService(deps).search('voọc', signal());
    const times = calls.filter((c) => c.url.host === 'api.inaturalist.org').map((c) => c.at);
    expect(times).toHaveLength(2);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(QUEUE_INTERVAL_MS);
  });

  it('báo lỗi khi chữ gõ quá ngắn, và không gọi dịch vụ', async () => {
    const { calls, deps } = fakeDeps(searchRoute);
    await expect(createSpeciesService(deps).search(' v ', signal())).rejects.toThrow(SHORT_QUERY_MESSAGE);
    expect(calls).toHaveLength(0);
  });

  it('báo dịch vụ đang bận khi iNaturalist vẫn trả lỗi 429 sau một lần thử lại', async () => {
    const { calls, deps } = fakeDeps(() => ({ status: 429 }));
    await expect(createSpeciesService(deps).search('voọc', signal())).rejects.toThrow(BUSY_MESSAGE);
    const tries = calls.filter((c) => c.url.pathname === '/v1/taxa/autocomplete').map((c) => c.at);
    expect(tries).toHaveLength(2);
    // Lỗi 429 không ghi thời gian chờ thì app chờ 2 giây.
    expect(tries[1]! - tries[0]!).toBeGreaterThanOrEqual(2000);
  });

  it('thử lại sau 2 giây khi lỗi 429 không ghi thời gian chờ, ví dụ khi GBIF bận', async () => {
    let blocked = true;
    const { deps } = fakeDeps((url) => {
      if (url.pathname === '/v1/occurrence/search' && blocked) {
        blocked = false;
        return { status: 429 };
      }
      if (url.pathname === '/v1/occurrence/search') return { body: { count: 680 } };
      return { body: { total: 0 } };
    });
    expect((await createSpeciesService(deps).observations(2436529, signal())).count).toBe(680);
  });

  it('vẫn trả kết quả của iNaturalist khi Wikidata bận, và không giữ kết quả thiếu', async () => {
    const { calls, deps } = fakeDeps((url) => (url.host === 'www.wikidata.org' ? { status: 429 } : searchRoute(url)));
    const service = createSpeciesService(deps);
    const first = await service.search('voọc', signal());
    expect(first).toEqual({ partial: true, hits: [expect.objectContaining({ inatId: 300, name: 'Voọc Cát Bà' })] });
    await service.search('voọc', signal());
    // Mỗi lần tìm hỏi Wikidata hai lần: lần đầu và lần thử lại sau 2 giây.
    expect(calls.filter((c) => c.url.host === 'www.wikidata.org')).toHaveLength(4);
  });

  it('chờ theo Retry-After ngắn rồi thử lại một lần', async () => {
    let blocked = true;
    const { calls, deps } = fakeDeps((url) => {
      if (url.host === 'www.wikidata.org' && url.searchParams.get('action') === 'query' && blocked) {
        blocked = false;
        return { status: 429, headers: { 'Retry-After': '4' } };
      }
      return searchRoute(url);
    });
    const { hits, partial } = await createSpeciesService(deps).search('voọc', signal());
    expect(partial).toBe(false);
    expect(hits).toHaveLength(3);
    const tries = calls.filter((c) => c.url.searchParams.get('action') === 'query').map((c) => c.at);
    expect(tries).toHaveLength(2);
    expect(tries[1]! - tries[0]!).toBeGreaterThanOrEqual(4000);
  });

  it('không chờ khi Retry-After quá dài', async () => {
    const { calls, deps } = fakeDeps(() => ({ status: 429, headers: { 'Retry-After': '60' } }));
    await expect(createSpeciesService(deps).search('voọc', signal())).rejects.toThrow(BUSY_MESSAGE);
    expect(calls.filter((c) => c.url.searchParams.get('action') === 'query')).toHaveLength(1);
  });

  it('báo không kết nối được khi mất mạng', async () => {
    const { deps } = fakeDeps(() => new TypeError('Failed to fetch'));
    const error = await createSpeciesService(deps)
      .search('voọc', signal())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SpeciesError);
    expect((error as Error).message).toBe(OFFLINE_MESSAGE);
  });
});

// ---------- Thông tin loài ----------

const DOUC = {
  id: 43517,
  name: 'Pygathrix nemaeus',
  rank: 'species',
  is_active: true,
  ancestor_ids: [48460, 1],
  iconic_taxon_name: 'Mammalia',
  preferred_common_name: 'Chà vá chân đỏ',
  english_common_name: 'Red-shanked Douc Langur',
  observations_count: 855,
  default_photo: {
    square_url: 'https://example.org/sq.jpg',
    medium_url: 'https://example.org/md.jpg',
    attribution: '(c) the_taxanaut, some rights reserved (CC BY-NC)',
    license_code: 'cc-by-nc',
  },
  conservation_status: { status: 'CR', authority: 'IUCN Red List' },
  wikipedia_url: 'https://vi.wikipedia.org/wiki/Chà_vá_chân_đỏ',
};

const sparqlRow = (row: Record<string, string>) => ({
  results: { bindings: [Object.fromEntries(Object.entries(row).map(([k, value]) => [k, { value }]))] },
});

describe('thông tin loài', () => {
  it('ghép thông tin của iNaturalist và Wikidata', async () => {
    const { calls, deps } = fakeDeps((url) => {
      if (url.pathname === '/v1/taxa/43517') return { body: { results: [DOUC] } };
      if (url.host === 'query.wikidata.org') {
        return {
          body: sparqlRow({
            item: 'http://www.wikidata.org/entity/Q1052539',
            vi: 'Chà vá chân đỏ',
            article: 'https://vi.wikipedia.org/wiki/Ch%C3%A0_v%C3%A1_ch%C3%A2n_%C4%91%E1%BB%8F',
            gbif: '2436529',
            map: 'http://commons.wikimedia.org/wiki/Special:FilePath/Red-shanked%20Douc%20area.png',
          }),
        };
      }
      return { status: 404 };
    });
    const info = await createSpeciesService(deps).info(43517, signal());
    expect(info).toEqual({
      inatId: 43517,
      name: 'Chà vá chân đỏ',
      scientificName: 'Pygathrix nemaeus',
      group: 'Mammalia',
      observationsCount: 855,
      thumbnail: 'https://example.org/sq.jpg',
      iucn: 'CR',
      photo: { url: 'https://example.org/md.jpg', attribution: DOUC.default_photo.attribution, license: 'CC-BY-NC' },
      wikidataId: 'Q1052539',
      wikipediaTitle: 'Chà vá chân đỏ',
      gbifKey: 2436529,
      rangeMapUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Red-shanked%20Douc%20area.png?width=640',
    });
    // Mã GBIF đã có trên Wikidata, nên app không hỏi GBIF.
    expect(calls.some((c) => c.url.host === 'api.gbif.org')).toBe(false);
  });

  it('hỏi GBIF theo tên khoa học khi Wikidata không có mã GBIF', async () => {
    const { deps } = fakeDeps((url) => {
      if (url.pathname === '/v1/taxa/43517') return { body: { results: [DOUC] } };
      if (url.host === 'query.wikidata.org') return { body: { results: { bindings: [] } } };
      if (url.pathname === '/v1/species/match') return { body: { usageKey: 2436529, matchType: 'EXACT' } };
      return { status: 404 };
    });
    expect((await createSpeciesService(deps).info(43517, signal())).gbifKey).toBe(2436529);
  });

  it('vẫn mở được trang loài khi Wikidata bận', async () => {
    const { calls, deps } = fakeDeps((url) => {
      if (url.pathname === '/v1/taxa/43517') return { body: { results: [DOUC] } };
      if (url.host === 'query.wikidata.org') return { status: 429 };
      if (url.pathname === '/v1/species/match') return { body: { usageKey: 2436529, matchType: 'EXACT' } };
      return { status: 404 };
    });
    const service = createSpeciesService(deps);
    const info = await service.info(43517, signal());
    expect(info).toMatchObject({ name: 'Chà vá chân đỏ', gbifKey: 2436529, wikipediaTitle: 'Chà vá chân đỏ' });
    expect(info.wikidataId).toBeUndefined();
    await service.info(43517, signal());
    // Mỗi lần mở hỏi Wikidata hai lần: lần đầu và lần thử lại sau 2 giây.
    expect(calls.filter((c) => c.url.host === 'query.wikidata.org')).toHaveLength(4);
  });

  it('chuyển sang mã mới khi mã cũ chỉ có một mã thay thế', async () => {
    const { deps } = fakeDeps((url) => {
      if (url.pathname === '/v1/taxa/1') return { body: { results: [{ ...DOUC, id: 1, is_active: false, current_synonymous_taxon_ids: [43517] }] } };
      if (url.pathname === '/v1/taxa/43517') return { body: { results: [DOUC] } };
      if (url.host === 'query.wikidata.org') return { body: sparqlRow({ gbif: '2436529' }) };
      return { status: 404 };
    });
    expect((await createSpeciesService(deps).info(1, signal())).inatId).toBe(43517);
  });

  it('báo lỗi khi loài đã bị tách thành nhiều loài', async () => {
    const { deps } = fakeDeps(() => ({
      body: { results: [{ ...DOUC, id: 74779, is_active: false, current_synonymous_taxon_ids: [696629, 885131] }] },
    }));
    await expect(createSpeciesService(deps).info(74779, signal())).rejects.toThrow(SPLIT_MESSAGE);
  });
});

describe('điểm quan sát trên GBIF', () => {
  it('lấy số điểm đã lọc và khung bao', async () => {
    const { calls, deps } = fakeDeps((url) => {
      if (url.pathname === '/v1/occurrence/search') return { body: { count: 640 } };
      if (url.pathname.endsWith('/capabilities.json')) return { body: { total: 699, minLng: 104, minLat: 11, maxLng: 112, maxLat: 24 } };
      return { status: 404 };
    });
    expect(await createSpeciesService(deps).observations(2436529, signal())).toEqual({ count: 640, box: [104, 11, 112, 24] });
    const search = calls[0]!.url;
    expect(search.searchParams.getAll('basisOfRecord')).toEqual(['HUMAN_OBSERVATION', 'MACHINE_OBSERVATION']);
    expect(search.searchParams.get('hasCoordinate')).toBe('true');
  });

  it('không hỏi khung bao khi loài chưa có điểm nào', async () => {
    const { calls, deps } = fakeDeps(() => ({ body: { count: 0 } }));
    expect(await createSpeciesService(deps).observations(1, signal())).toEqual({ count: 0 });
    expect(calls).toHaveLength(1);
  });

  it('ô bản đồ có bộ lọc nguồn dữ liệu và lưới lục giác', () => {
    const url = new URL(observationTileUrl(2436529).replace('{z}/{x}/{y}', '3/6/3'));
    expect(url.searchParams.getAll('basisOfRecord')).toEqual(['HUMAN_OBSERVATION', 'MACHINE_OBSERVATION']);
    expect(url.searchParams.get('bin')).toBe('hex');
  });
});

describe('vùng phân bố', () => {
  it('đọc ô ở mức zoom 0 một lần rồi giữ kết quả', async () => {
    const { deps } = fakeDeps(() => ({ status: 404 }));
    // Ô 2 x 2: chỉ điểm ở góc dưới bên phải có màu.
    const load = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.inaturalist.org/v1/taxon_ranges/43517/0/0/0.png');
      return { data: Uint8ClampedArray.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 128]), width: 2, height: 2 };
    });
    const service = createSpeciesService(deps, load);
    const first = await service.range(43517, signal());
    expect(first.available).toBe(true);
    expect(first.box?.map((v) => Math.round(v))).toEqual([0, -85, 180, 0]);
    expect(await service.range(43517, signal())).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('báo không có vùng phân bố khi ô rỗng', async () => {
    const { deps } = fakeDeps(() => ({ status: 404 }));
    const service = createSpeciesService(deps, async () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }));
    expect(await service.range(879166, signal())).toEqual({ available: false });
  });
});
