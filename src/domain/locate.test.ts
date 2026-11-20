import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import { createLocator, distanceToFeatureKm, wrapLng, type LocateData } from './locate';

function layer<P>(file: string, name: string): FeatureCollection<Geometry, P> {
  const topology = JSON.parse(readFileSync(path.resolve('public/data', file), 'utf8')) as Topology;
  return feature(topology, topology.objects[name] as GeometryCollection) as unknown as FeatureCollection<Geometry, P>;
}

const data: LocateData = {
  countries: layer('world.topo.json', 'countries'),
  provinces: layer('vn.topo.json', 'provinces'),
  oldProvinces: layer('vn.topo.json', 'oldProvinces'),
};
const locate = createLocator(data);

describe('locate với dữ liệu thật', () => {
  it.each([
    ['Hội An', 15.8801, 108.338, '48', '49'],
    ['Thủ Dầu Một', 10.9804, 106.6519, '79', '74'],
    ['Vũng Tàu', 10.346, 107.0843, '79', '77'],
    ['Hồ Gươm, Hà Nội', 21.0285, 105.8542, '01', '01'],
    ['Đà Lạt', 11.9404, 108.4583, '68', '68'],
  ])('%s thuộc tỉnh mới %s, tỉnh cũ %s', (_name, lat, lng, code, oldCode) => {
    expect(locate(lat, lng)).toEqual({ countryId: 'VNM', code, oldCode });
  });

  it('Tokyo thuộc Nhật Bản và không có tỉnh', () => {
    expect(locate(35.6812, 139.7671)).toEqual({ countryId: 'JPN' });
  });

  it('một điểm giữa Thái Bình Dương cho kết quả rỗng', () => {
    expect(locate(0, -150)).toEqual({});
  });

  it('kinh độ bị lệch 360 độ do kéo bản đồ vẫn cho đúng quốc gia', () => {
    expect(locate(35.6812, 139.7671 + 360)).toEqual({ countryId: 'JPN' });
  });

  it('một đảo Hoàng Sa thuộc Đà Nẵng', () => {
    const daNang = data.provinces.features.find((f) => f.properties.code === '48')!.geometry as MultiPolygon;
    const island = daNang.coordinates.find((p) => (p[0]![0]![0] ?? 0) > 111)!;
    const ring = island[0]!;
    const lng = ring.reduce((s, c) => s + (c[0] ?? 0), 0) / ring.length;
    const lat = ring.reduce((s, c) => s + (c[1] ?? 0), 0) / ring.length;
    expect(locate(lat, lng).code).toBe('48');
  });
});

describe('locate với dữ liệu giả', () => {
  const square = (x0: number, y0: number, x1: number, y1: number): Polygon => ({
    type: 'Polygon',
    coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]],
  });
  const fake: LocateData = {
    countries: { type: 'FeatureCollection', features: [] },
    provinces: {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { code: '79' }, geometry: square(0, 0, 10, 10) }],
    },
    oldProvinces: {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { oldCode: '74', code: '79' }, geometry: square(0, 0, 4, 10) },
        { type: 'Feature', properties: { oldCode: '79', code: '79' }, geometry: square(6, 0, 10, 10) },
      ],
    },
  };
  const locateFake = createLocator(fake);

  it('điểm trong chỗ hở chọn tỉnh cũ gần nhất', () => {
    expect(locateFake(5, 4.5).oldCode).toBe('74');
    expect(locateFake(5, 5.5).oldCode).toBe('79');
  });
});

describe('hàm phụ', () => {
  it('wrapLng đưa kinh độ về khoảng -180 đến 180', () => {
    expect(wrapLng(190)).toBe(-170);
    expect(wrapLng(-190)).toBe(170);
    expect(wrapLng(106)).toBe(106);
  });

  it('distanceToFeatureKm đo đúng khoảng 111 km cho 1 độ vĩ ở xích đạo', () => {
    const line: Polygon = { type: 'Polygon', coordinates: [[[0, 1], [1, 1], [1, 2], [0, 2], [0, 1]]] };
    expect(distanceToFeatureKm([0.5, 0], line)).toBeCloseTo(110.57, 1);
  });
});
