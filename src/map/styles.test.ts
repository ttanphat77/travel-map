import { describe, expect, it } from 'vitest';
import { COLORS, regionStyle } from './styles';

describe('regionStyle', () => {
  it('vùng chưa đánh dấu có nền trong suốt và viền xám', () => {
    expect(regionStyle(undefined)).toMatchObject({ fillOpacity: 0, color: COLORS.unmarkedStroke, weight: 0.8 });
  });

  it('vùng "Đã đến" màu xanh lá, độ đậm 0,55', () => {
    expect(regionStyle('visited')).toMatchObject({
      fillColor: COLORS.visited,
      fillOpacity: 0.55,
      color: COLORS.visitedStroke,
    });
  });

  it('vùng "Muốn đến" màu cam', () => {
    expect(regionStyle('wishlist')).toMatchObject({ fillColor: COLORS.wishlist, color: COLORS.wishlistStroke });
  });

  it('rê chuột thì viền xanh dương dày 2 px và nền đậm thêm 0,15', () => {
    expect(regionStyle('visited', { hover: true })).toMatchObject({ color: COLORS.accent, weight: 2, fillOpacity: 0.7 });
    expect(regionStyle(undefined, { hover: true }).fillOpacity).toBe(0.15);
  });

  it('đang chọn thì viền xanh dương dày 2,5 px và giữ màu nền', () => {
    expect(regionStyle('wishlist', { selected: true })).toMatchObject({
      color: COLORS.accent,
      weight: 2.5,
      fillColor: COLORS.wishlist,
      fillOpacity: 0.55,
    });
  });
});
