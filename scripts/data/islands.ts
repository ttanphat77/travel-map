import type { FeatureCollection, Position } from 'geojson';
import { inBox, polygonsOf, ringCenter } from './lib';

/** Khung kinh độ và vĩ độ để nhận ra từng quần đảo: [kinh độ min, vĩ độ min, kinh độ max, vĩ độ max]. */
export const HOANG_SA_BOX = [111, 15.5, 113, 17.5] as const;
/** Cạnh đông là 116,5 để không chạm các đảo ven bờ Sabah (Malaysia) ở kinh độ khoảng 117. */
export const TRUONG_SA_BOX = [111, 6, 116.5, 12] as const;

export interface Islands {
  hoangSa: Position[][][];
  truongSa: Position[][][];
}

/** Tách các đảo Hoàng Sa và Trường Sa từ vùng VNM của Natural Earth bản _vnm. */
export function extractIslands(world: FeatureCollection): Islands {
  const vietnam = world.features.find((f) => f.properties?.ADM0_A3 === 'VNM');
  if (!vietnam) throw new Error('Không tìm thấy vùng VNM trong dữ liệu thế giới');
  const polygons = polygonsOf(vietnam.geometry);
  const hoangSa = polygons.filter((p) => inBox(ringCenter(p), HOANG_SA_BOX));
  const truongSa = polygons.filter((p) => inBox(ringCenter(p), TRUONG_SA_BOX));
  if (hoangSa.length === 0 || truongSa.length === 0) {
    throw new Error(`Thiếu đảo: Hoàng Sa ${hoangSa.length}, Trường Sa ${truongSa.length}`);
  }
  return { hoangSa, truongSa };
}

/** Vị trí đặt nhãn: trung bình tâm của các đảo. */
export function labelPosition(polygons: Position[][][]): [number, number] {
  const centers = polygons.map(ringCenter);
  const x = centers.reduce((s, c) => s + c[0], 0) / centers.length;
  const y = centers.reduce((s, c) => s + c[1], 0) / centers.length;
  return [Number(x.toFixed(4)), Number(y.toFixed(4))];
}
