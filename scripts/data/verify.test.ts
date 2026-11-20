import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import provinces from '../../src/data/provinces-34.json';
import bando from './reference/bando-34.json';
import official34 from './reference/official-34.json';
import official63 from './reference/official-63.json';
import { HOANG_SA_BOX, TRUONG_SA_BOX } from './islands';
import { polygonsOf, ringCenter, inBox } from './lib';
import { OUTPUT_DIR } from './sources';

const WORLD_FILE = path.join(OUTPUT_DIR, 'world.topo.json');
const VN_FILE = path.join(OUTPUT_DIR, 'vn.topo.json');

/** Bỏ dấu để so tên giữa các nguồn viết dấu khác nhau, ví dụ "Hoá" và "Hóa". */
const plain = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

function load(file: string): Topology {
  if (!existsSync(file)) throw new Error(`Chưa có ${file}. Hãy chạy "npm run data" trước.`);
  return JSON.parse(readFileSync(file, 'utf8')) as Topology;
}

function layer(topology: Topology, name: string): FeatureCollection<Geometry> {
  const object = topology.objects[name];
  if (!object) throw new Error(`Thiếu đối tượng ${name}`);
  return feature(topology, object) as FeatureCollection<Geometry>;
}

const world = load(WORLD_FILE);
const vn = load(VN_FILE);
const countries = layer(world, 'countries');
const vnProvinces = layer(vn, 'provinces');
const oldProvinces = layer(vn, 'oldProvinces');
const oldBorders = layer(vn, 'oldBorders');

const allOld = provinces.flatMap((p) => p.oldProvinces.map((o) => ({ ...o, code: p.code })));

function partsInBox(f: Feature<Geometry>, box: readonly number[]): number {
  return polygonsOf(f.geometry).filter((p) => inBox(ringCenter(p), box)).length;
}

describe('bảng tham chiếu provinces-34.json', () => {
  it('có đủ 34 tỉnh mới, mã không trùng', () => {
    expect(provinces).toHaveLength(34);
    expect(new Set(provinces.map((p) => p.code)).size).toBe(34);
  });

  it('mã, tên và loại của 34 tỉnh khớp danh mục chính thức', () => {
    const official = new Map(official34.data.map((o) => [o.code, o]));
    for (const p of provinces) {
      const o = official.get(p.code);
      expect(o, `mã ${p.code}`).toBeDefined();
      expect(plain(p.name), `tên ${p.code}`).toBe(plain(o!.name));
      expect(p.kind, `loại ${p.code}`).toBe(o!.administrativeUnitId === 1 ? 'thanh-pho' : 'tinh');
    }
  });

  it('có đủ 63 tỉnh cũ, mỗi tỉnh cũ thuộc đúng một tỉnh mới', () => {
    expect(allOld).toHaveLength(63);
    expect(new Set(allOld.map((o) => o.oldCode)).size).toBe(63);
  });

  it('mã và tên của 63 tỉnh cũ khớp danh mục trước 01/07/2025', () => {
    const official = new Map(official63.data.map((o) => [o.oldCode, o]));
    expect(official.size).toBe(63);
    for (const o of allOld) {
      expect(official.get(o.oldCode), `mã cũ ${o.oldCode}`).toBeDefined();
      expect(plain(o.name), `tên cũ ${o.oldCode}`).toBe(plain(official.get(o.oldCode)!.name));
    }
  });

  it('có đúng 11 tỉnh mới giữ nguyên từ một tỉnh cũ', () => {
    expect(provinces.filter((p) => p.oldProvinces.length === 1)).toHaveLength(11);
  });

  it('danh sách tỉnh cũ khớp cột "trước sáp nhập" của sapnhap.bando.com.vn', () => {
    const byId = new Map(bando.data.map((b) => [b.bandoId, b]));
    for (const p of provinces) {
      const b = byId.get(p.bandoId);
      expect(b, `bandoId ${p.bandoId}`).toBeDefined();
      expect(plain(b!.name).endsWith(plain(p.name)), `tên ${p.code}`).toBe(true);
      const expected =
        b!.beforeMerger === 'giữ nguyên'
          ? [p.name]
          : b!.beforeMerger
              .split(/, | và /)
              .map((s) => s.replace(/^(tỉnh|thành phố) /i, '').replace('TPHCM', 'Hồ Chí Minh'));
      expect(p.oldProvinces.map((o) => plain(o.name)).sort(), `tỉnh cũ của ${p.code}`).toEqual(
        expected.map(plain).sort(),
      );
    }
  });
});

describe('lớp 34 tỉnh (vn.topo.json)', () => {
  it('có đúng 34 vùng, mã khớp bảng tham chiếu và có tên', () => {
    expect(vnProvinces.features).toHaveLength(34);
    const codes = vnProvinces.features.map((f) => f.properties?.code as string);
    expect(new Set(codes)).toEqual(new Set(provinces.map((p) => p.code)));
    for (const f of vnProvinces.features) expect(f.properties?.name).toBeTruthy();
  });

  it('Hoàng Sa nằm trong Đà Nẵng (48) và chỉ trong Đà Nẵng', () => {
    for (const f of vnProvinces.features) {
      const n = partsInBox(f, HOANG_SA_BOX);
      if (f.properties?.code === '48') expect(n).toBeGreaterThan(0);
      else expect(n, `tỉnh ${f.properties?.code}`).toBe(0);
    }
  });

  it('Trường Sa nằm trong Khánh Hòa (56) và chỉ trong Khánh Hòa', () => {
    for (const f of vnProvinces.features) {
      const n = partsInBox(f, TRUONG_SA_BOX);
      if (f.properties?.code === '56') expect(n).toBeGreaterThan(0);
      else expect(n, `tỉnh ${f.properties?.code}`).toBe(0);
    }
  });

  it('có hai nhãn quần đảo', () => {
    const labels = layer(vn, 'islandLabels').features.map((f) => f.properties?.name);
    expect(labels.sort()).toEqual(['Quần đảo Hoàng Sa', 'Quần đảo Trường Sa']);
  });
});

describe('lớp tỉnh cũ (vn.topo.json)', () => {
  it('nối đủ 63 tỉnh cũ, Côn Đảo đã gộp vào mã 77', () => {
    const codes = oldProvinces.features.map((f) => f.properties?.oldCode as string);
    expect(codes).toHaveLength(63);
    expect(new Set(codes)).toEqual(new Set(allOld.map((o) => o.oldCode)));
  });

  it('mọi đường chia tỉnh cũ nằm trong tỉnh mới của nó, sai lệch không quá khoảng 100 m', () => {
    const NUDGE = 0.0009;
    const offsets = [[0, 0], [NUDGE, 0], [-NUDGE, 0], [0, NUDGE], [0, -NUDGE]];
    for (const line of oldBorders.features) {
      const province = vnProvinces.features.find((f) => f.properties?.code === line.properties?.code);
      expect(province, `đường của tỉnh ${line.properties?.code}`).toBeDefined();
      const geometry = province!.geometry as Polygon | MultiPolygon;
      const points: Position[] =
        line.geometry.type === 'LineString'
          ? line.geometry.coordinates
          : line.geometry.type === 'MultiLineString'
            ? line.geometry.coordinates.flat()
            : [];
      for (const [x = 0, y = 0] of points) {
        const ok = offsets.some(([dx = 0, dy = 0]) => booleanPointInPolygon([x + dx, y + dy], geometry));
        expect(ok, `điểm ${x},${y} của tỉnh ${line.properties?.code}`).toBe(true);
      }
    }
  });

  it('tổng diện tích tỉnh cũ sau khi cắt đạt ít nhất 98% diện tích tỉnh mới', () => {
    const failures: string[] = [];
    for (const p of provinces) {
      const newArea = vnProvinces.features.filter((f) => f.properties?.code === p.code).reduce((s, f) => s + area(f), 0);
      const oldArea = oldProvinces.features.filter((f) => f.properties?.code === p.code).reduce((s, f) => s + area(f), 0);
      const ratio = oldArea / newArea;
      if (ratio < 0.98) failures.push(`${p.name} ${(ratio * 100).toFixed(1)}%`);
    }
    expect(failures).toEqual([]);
  });
});

describe('lớp thế giới (world.topo.json)', () => {
  it('mọi quốc gia có id không trùng và có tên tiếng Việt', () => {
    const ids = countries.features.map((f) => f.properties?.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of countries.features) expect(f.properties?.name, `${f.properties?.id}`).toBeTruthy();
  });

  it('vùng VNM chứa cả Hoàng Sa và Trường Sa, không quốc gia nào khác chứa hai quần đảo này', () => {
    for (const f of countries.features) {
      const hs = partsInBox(f, HOANG_SA_BOX);
      const ts = partsInBox(f, TRUONG_SA_BOX);
      if (f.properties?.id === 'VNM') {
        expect(hs).toBeGreaterThan(0);
        expect(ts).toBeGreaterThan(0);
      } else {
        expect(hs + ts, `${f.properties?.id}`).toBe(0);
      }
    }
  });
});

describe('ngân sách dung lượng', () => {
  const kb = (file: string) => statSync(file).size / 1024;
  it('world.topo.json không quá 700 KB', () => expect(kb(WORLD_FILE)).toBeLessThanOrEqual(700));
  it('vn.topo.json không quá 700 KB', () => expect(kb(VN_FILE)).toBeLessThanOrEqual(700));
  it('tổng không quá 1,5 MB', () => expect(kb(WORLD_FILE) + kb(VN_FILE)).toBeLessThanOrEqual(1536));
});
