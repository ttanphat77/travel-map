import { describe, expect, it } from 'vitest';
import {
  MAX_SPECIES_RESULTS,
  SUGGESTED_SPECIES,
  displayName,
  isLatinName,
  mergeSearchResults,
  opaqueBox,
  parseIucn,
  type TaxonRecord,
  type WikidataTaxon,
} from './species';

const record = (inatId: number, scientificName: string, extra: Partial<TaxonRecord> = {}): TaxonRecord => ({
  inatId,
  scientificName,
  rank: 'species',
  isAnimal: true,
  active: true,
  group: 'Mammalia',
  ...extra,
});

describe('mức Sách đỏ', () => {
  it('nhận mã viết thường của IUCN', () => {
    expect(parseIucn('en', 'IUCN Red List')).toBe('EN');
    expect(parseIucn('CR', undefined)).toBe('CR');
  });

  it('bỏ mức của danh sách khác và mã lạ', () => {
    expect(parseIucn('E', 'NatureServe')).toBeUndefined();
    expect(parseIucn('S1', 'IUCN Red List')).toBeUndefined();
    expect(parseIucn(undefined, 'IUCN Red List')).toBeUndefined();
  });
});

describe('tên hiển thị', () => {
  it('nhận tên tiếng Việt có dấu và bỏ tên chữ Trung', () => {
    expect(isLatinName('Voọc Cát Bà')).toBe(true);
    expect(isLatinName('Red-shanked Douc')).toBe(true);
    expect(isLatinName('金龜')).toBe(false);
  });

  it('ưu tiên nhãn tiếng Việt trên Wikidata', () => {
    expect(displayName({ wikidataVi: 'Vượn đen má hung', wikipediaVi: 'Vượn_đen_má_vàng_Nam', scientific: 'Nomascus gabriellae' })).toBe(
      'Vượn đen má hung',
    );
  });

  it('dùng tên bài Wikipedia khi nhãn Wikidata chỉ là tên khoa học', () => {
    expect(displayName({ wikidataVi: 'Pavo muticus', wikipediaVi: 'Công_lục', english: 'Green Peafowl', scientific: 'Pavo muticus' })).toBe(
      'Công lục',
    );
    expect(displayName({ wikipediaVi: 'Công (động vật)', scientific: 'Pavo' })).toBe('Công');
  });

  it('bỏ tên chữ Trung của iNaturalist rồi dùng tên tiếng Anh', () => {
    expect(displayName({ inatVi: '金龜', english: 'Yangtze Giant Softshell Turtle', scientific: 'Rafetus swinhoei' })).toBe(
      'Yangtze Giant Softshell Turtle',
    );
  });

  it('dùng tên khoa học khi không có tên nào khác', () => {
    expect(displayName({ wikidataVi: 'copsychus malabaricus', scientific: 'Copsychus malabaricus' })).toBe('Copsychus malabaricus');
  });
});

describe('gộp kết quả tìm', () => {
  const voocXam: WikidataTaxon = { qid: 'Q1', inatIds: [100], vi: 'Voọc xám' };
  const voocBac: WikidataTaxon = { qid: 'Q2', inatIds: [200], vi: 'Voọc bạc' };

  it('giữ thứ tự Wikidata trước iNaturalist', () => {
    const inat = [record(300, 'Trachypithecus poliocephalus', { inatVi: 'Voọc Cát Bà' }), record(200, 'Trachypithecus germaini')];
    const records = new Map([
      [100, record(100, 'Trachypithecus crepusculus')],
      [200, record(200, 'Trachypithecus germaini')],
    ]);
    const hits = mergeSearchResults('voọc', [voocXam, voocBac], inat, records);
    expect(hits.map((h) => h.name)).toEqual(['Voọc xám', 'Voọc bạc', 'Voọc Cát Bà']);
  });

  it('đưa loài có tên trùng hẳn với chữ gõ lên đầu', () => {
    const records = new Map([
      [100, record(100, 'Trachypithecus margarita')],
      [200, record(200, 'Trachypithecus germaini')],
    ]);
    const wikidata = [{ qid: 'Q1', inatIds: [100], vi: 'Voọc bạc Đông Dương' }, voocBac];
    expect(mergeSearchResults('Voọc bạc', wikidata, [], records).map((h) => h.name)).toEqual(['Voọc bạc', 'Voọc bạc Đông Dương']);
  });

  it('bỏ kết quả không chứa chữ gõ, kể cả tên ở ngôn ngữ khác', () => {
    const inat = [
      record(1, 'Pseudoryx nghetinhensis', { matchedTerm: 'Sao la', inatVi: 'Sao la' }),
      record(2, 'Buthus halius', { matchedTerm: 'Lacrau-de-São-Vicente' }),
      record(3, 'Bothrops moojeni', { matchedTerm: 'Sao Paulo Lancehead' }),
    ];
    expect(mergeSearchResults('sao la', [], inat, new Map()).map((h) => h.inatId)).toEqual([1]);
  });

  it('gõ không dấu vẫn tìm ra tên có dấu, còn gõ có dấu thì so cả dấu', () => {
    const records = new Map([
      [1, record(1, 'Pygathrix nemaeus')],
      [2, record(2, 'Hylobates lar')],
    ]);
    const wikidata = [
      { qid: 'Q1', inatIds: [1], vi: 'Chà vá chân đỏ' },
      { qid: 'Q2', inatIds: [2], vi: 'Vượn tay trắng' },
    ];
    expect(mergeSearchResults('cha va', wikidata, [], records).map((h) => h.inatId)).toEqual([1]);
    expect(mergeSearchResults('vuon', wikidata, [], records).map((h) => h.inatId)).toEqual([2]);
    // "vườn" (khu vườn) khác "vượn" (con vượn).
    expect(mergeSearchResults('vườn', wikidata, [], records)).toEqual([]);
  });

  it('chỉ giữ loài động vật còn được dùng', () => {
    const records = new Map([
      [1, record(1, 'Trachypithecus', { rank: 'genus' })],
      [2, record(2, 'Oryza sativa', { isAnimal: false })],
      [3, record(3, 'Nomascus gabriellae', { active: false })],
    ]);
    const wikidata: WikidataTaxon[] = [1, 2, 3].map((id) => ({ qid: `Q${id}`, inatIds: [id] }));
    expect(mergeSearchResults('x', wikidata, [], records)).toEqual([]);
  });

  it('chọn mã còn được dùng khi một mục Wikidata có hai mã', () => {
    const records = new Map([
      [74779, record(74779, 'Nomascus gabriellae', { active: false })],
      [885131, record(885131, 'Nomascus gabriellae')],
    ]);
    const hits = mergeSearchResults('vượn', [{ qid: 'Q3', inatIds: [74779, 885131], vi: 'Vượn đen má hung' }], [], records);
    expect(hits).toEqual([{ inatId: 885131, name: 'Vượn đen má hung', scientificName: 'Nomascus gabriellae', group: 'Mammalia' }]);
  });

  it('không lặp loài có trong cả hai nguồn và giới hạn số kết quả', () => {
    const many = Array.from({ length: 15 }, (_, i) => record(i + 1, `Species ${i + 1}`));
    const hits = mergeSearchResults('species', [{ qid: 'Q1', inatIds: [1], vi: 'Loài một' }], many, new Map([[1, many[0]!]]));
    expect(hits).toHaveLength(MAX_SPECIES_RESULTS);
    expect(hits.filter((h) => h.inatId === 1)).toHaveLength(1);
    expect(hits[0]?.name).toBe('Loài một');
  });
});

describe('khung bao của vùng phân bố', () => {
  /** Ô vuông `size` x `size` điểm ảnh, chỉ các điểm trong `opaque` có màu. */
  const tile = (size: number, opaque: [number, number][]) => {
    const data = new Uint8ClampedArray(size * size * 4);
    for (const [x, y] of opaque) data[(y * size + x) * 4 + 3] = 255;
    return data;
  };

  it('trả về undefined khi ô rỗng', () => {
    expect(opaqueBox(tile(4, []), 4, 4)).toBeUndefined();
  });

  it('đổi điểm ảnh sang kinh độ và vĩ độ theo phép chiếu Web Mercator', () => {
    // Ô 4 x 4: cột 2 là kinh độ 0 đến 90, hàng 1 là vĩ độ 0 đến khoảng 66,5.
    const [west, south, east, north] = opaqueBox(tile(4, [[2, 1]]), 4, 4)!;
    expect(west).toBe(0);
    expect(east).toBe(90);
    expect(south).toBeCloseTo(0, 6);
    expect(north).toBeCloseTo(66.513, 3);
  });

  it('bao trọn mọi điểm có màu', () => {
    expect(opaqueBox(tile(4, [[0, 3], [3, 0]]), 4, 4)?.map((v) => Math.round(v))).toEqual([-180, -85, 180, 85]);
  });
});

describe('loài gợi ý', () => {
  it('có 6 loài, mã không trùng', () => {
    expect(SUGGESTED_SPECIES).toHaveLength(6);
    expect(new Set(SUGGESTED_SPECIES.map((s) => s.inatId)).size).toBe(6);
  });
});
