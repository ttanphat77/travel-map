import type { Geometry, Position } from 'geojson';

/** Khung bao [tây, nam, đông, bắc], tính bằng độ. */
export type Box = [number, number, number, number];

/** Diện tích gần đúng của một vòng, tính theo độ. Kết quả chỉ dùng để so sánh các phần đất với nhau. */
export function ringArea(ring: Position[]): number {
  let sum = 0;
  let previous = ring[ring.length - 1];
  for (const point of ring) {
    if (previous) sum += (previous[0] ?? 0) * (point[1] ?? 0) - (point[0] ?? 0) * (previous[1] ?? 0);
    previous = point;
  }
  return Math.abs(sum) / 2;
}

/** Vòng ngoài của từng polygon trong một geometry. */
export function outerRings(geometry: Geometry): Position[][] {
  if (geometry.type === 'Polygon') return geometry.coordinates.slice(0, 1);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((polygon) => polygon[0]).filter((ring): ring is Position[] => ring !== undefined);
  }
  return [];
}

/** Khung bao của một nhóm vòng. Trả về null nếu nhóm rỗng. */
export function boxOfRings(rings: Position[][]): Box | null {
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) {
    for (const [lng = 0, lat = 0] of ring) {
      box[0] = Math.min(box[0], lng);
      box[1] = Math.min(box[1], lat);
      box[2] = Math.max(box[2], lng);
      box[3] = Math.max(box[3], lat);
    }
  }
  return Number.isFinite(box[0]) ? box : null;
}

/**
 * Khung bao của phần đất lớn nhất trong các geometry.
 * Đà Nẵng có Hoàng Sa, Khánh Hòa có Trường Sa, và một số nước có lãnh thổ ở rất xa.
 * Nếu tính cả các phần đó, khung bao sẽ quá rộng. Vì vậy chỉ lấy phần đất lớn nhất.
 */
export function mainBox(geometries: Geometry[]): Box | null {
  let best: Position[] | undefined;
  let bestArea = -1;
  for (const geometry of geometries) {
    for (const ring of outerRings(geometry)) {
      const area = ringArea(ring);
      if (area > bestArea) {
        best = ring;
        bestArea = area;
      }
    }
  }
  return best ? boxOfRings([best]) : null;
}
