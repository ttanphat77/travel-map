import type { PathOptions } from 'leaflet';
import type { MarkStatus } from '../domain/types';

export const COLORS = {
  accent: '#2563eb',
  unmarkedStroke: '#8a8f98',
  visited: '#3fa36b',
  visitedStroke: '#2f7d52',
  wishlist: '#f0a33a',
  wishlistStroke: '#b87717',
  oldBorder: '#6b7280',
} as const;

const STATUS_FILL_OPACITY = 0.55;
const HOVER_EXTRA_OPACITY = 0.15;

/**
 * Kiểu vẽ của một vùng theo trạng thái đánh dấu, đang rê chuột hay đang chọn.
 * Vùng chưa đánh dấu có nền trong suốt nhưng vẫn bấm được, vì Leaflet dùng hình học để xác định vùng được bấm.
 */
export function regionStyle(
  status: MarkStatus | undefined,
  state: { hover?: boolean; selected?: boolean } = {},
): PathOptions {
  const base: PathOptions =
    status === 'visited'
      ? { fillColor: COLORS.visited, fillOpacity: STATUS_FILL_OPACITY, color: COLORS.visitedStroke }
      : status === 'wishlist'
        ? { fillColor: COLORS.wishlist, fillOpacity: STATUS_FILL_OPACITY, color: COLORS.wishlistStroke }
        : { fillColor: COLORS.accent, fillOpacity: 0, color: COLORS.unmarkedStroke };
  const style: PathOptions = { ...base, weight: 0.8, opacity: 1 };
  if (state.hover) {
    style.color = COLORS.accent;
    style.weight = 2;
    style.fillOpacity = Math.round(((base.fillOpacity ?? 0) + HOVER_EXTRA_OPACITY) * 100) / 100;
  }
  if (state.selected) {
    style.color = COLORS.accent;
    style.weight = 2.5;
  }
  return style;
}

export const OLD_BORDER_STYLE: PathOptions = {
  color: COLORS.oldBorder,
  weight: 1,
  opacity: 0.6,
  dashArray: '4 4',
  interactive: false,
};
