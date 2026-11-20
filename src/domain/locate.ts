import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';
import { getProvince } from '../data/provinces';
import { VIETNAM_ID } from './types';

export interface LocateResult {
  countryId?: string;
  /** Mã tỉnh mới, chỉ có khi điểm nằm ở Việt Nam. */
  code?: string;
  /** Mã tỉnh cũ. Kết quả này gần đúng vì ranh giới tỉnh cũ lệch vài km. */
  oldCode?: string;
}

export interface LocateData {
  countries: FeatureCollection<Geometry, { id: string }>;
  provinces: FeatureCollection<Geometry, { code: string }>;
  oldProvinces: FeatureCollection<Geometry, { oldCode: string; code: string }>;
}

type Box = [number, number, number, number];

interface Indexed<P> {
  feature: Feature<Polygon | MultiPolygon, P>;
  box: Box;
}

function boxOf(geometry: Polygon | MultiPolygon): Box {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  for (const ring of rings) {
    for (const [x = 0, y = 0] of ring) {
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (x > box[2]) box[2] = x;
      if (y > box[3]) box[3] = y;
    }
  }
  return box;
}

function index<P>(fc: FeatureCollection<Geometry, P>): Indexed<P>[] {
  return fc.features
    .filter((f): f is Feature<Polygon | MultiPolygon, P> => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
    .map((feature) => ({ feature, box: boxOf(feature.geometry) }));
}

const inBox = ([x, y]: [number, number], [x0, y0, x1, y1]: Box) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

function findContaining<P>(items: Indexed<P>[], point: [number, number]): Feature<Polygon | MultiPolygon, P> | undefined {
  return items.find((item) => inBox(point, item.box) && booleanPointInPolygon(point, item.feature.geometry))?.feature;
}

/** Khoảng cách gần đúng (km) từ một điểm tới một đoạn thẳng, dùng phép chiếu phẳng quanh điểm. */
function distanceToSegmentKm([px, py]: [number, number], a: Position, b: Position): number {
  const kx = 111.32 * Math.cos((py * Math.PI) / 180);
  const ky = 110.57;
  const ax = ((a[0] ?? 0) - px) * kx;
  const ay = ((a[1] ?? 0) - py) * ky;
  const bx = ((b[0] ?? 0) - px) * kx;
  const by = ((b[1] ?? 0) - py) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanceToFeatureKm(point: [number, number], geometry: Polygon | MultiPolygon): number {
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      best = Math.min(best, distanceToSegmentKm(point, ring[i - 1]!, ring[i]!));
    }
  }
  return best;
}

/** Đưa kinh độ về khoảng -180 đến 180, vì bản đồ cho kéo qua kinh tuyến 180. */
export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Tạo hàm tìm quốc gia, tỉnh mới và tỉnh cũ chứa một tọa độ.
 * Hàm kiểm tra 34 tỉnh trước, vì đường bờ biển của tỉnh và của lớp thế giới không trùng nhau hoàn toàn.
 */
export function createLocator(data: LocateData): (lat: number, lng: number) => LocateResult {
  const countries = index(data.countries);
  const provinces = index(data.provinces);
  const oldProvinces = index(data.oldProvinces);

  return (lat, rawLng) => {
    const point: [number, number] = [wrapLng(rawLng), lat];
    const province = findContaining(provinces, point);
    if (province) {
      const code = province.properties.code;
      const info = getProvince(code);
      let oldCode: string | undefined;
      if (info?.oldProvinces.length === 1) {
        oldCode = info.oldProvinces[0]!.oldCode;
      } else {
        const group = oldProvinces.filter((o) => o.feature.properties.code === code);
        oldCode = findContaining(group, point)?.properties.oldCode;
        if (!oldCode) {
          // Điểm rơi vào chỗ hở giữa các tỉnh cũ, nên chọn tỉnh cũ có đường viền gần nhất.
          let best = Infinity;
          for (const item of group) {
            const d = distanceToFeatureKm(point, item.feature.geometry);
            if (d < best) {
              best = d;
              oldCode = item.feature.properties.oldCode;
            }
          }
        }
      }
      return { countryId: VIETNAM_ID, code, oldCode };
    }
    const country = findContaining(countries, point);
    return country ? { countryId: country.properties.id } : {};
  };
}
