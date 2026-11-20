/** Từ mức zoom này trở lên, Việt Nam tách thành 34 tỉnh. */
export const VN_DETAIL_ZOOM = 5;

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 17;
export const INITIAL_CENTER: [number, number] = [20, 100];
export const INITIAL_ZOOM = 2;

export interface LayerVisibility {
  /** Việt Nam hiện thành một vùng trong lớp thế giới. */
  vietnamCountry: boolean;
  /** 34 tỉnh, nét đứt tỉnh cũ và nhãn hai quần đảo. */
  vietnamDetail: boolean;
}

/**
 * Độ đậm của nền OpenStreetMap theo mức zoom.
 * Ở mức thế giới nền mờ để màu đánh dấu nổi rõ. Khi zoom sâu, nền rõ dần để đọc được đường phố.
 */
export function tileOpacityForZoom(zoom: number): number {
  if (zoom <= 4) return 0.6;
  if (zoom >= 8) return 1;
  return Number((0.6 + ((zoom - 4) / 4) * 0.4).toFixed(2));
}

export function visibilityForZoom(zoom: number): LayerVisibility {
  const detail = zoom >= VN_DETAIL_ZOOM;
  return { vietnamCountry: !detail, vietnamDetail: detail };
}
