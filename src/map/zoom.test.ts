import { describe, expect, it } from 'vitest';
import { VN_DETAIL_ZOOM, tileOpacityForZoom, visibilityForZoom } from './zoom';

describe('tileOpacityForZoom', () => {
  it.each([
    [2, 0.6],
    [4, 0.6],
    [5, 0.7],
    [6, 0.8],
    [7, 0.9],
    [8, 1],
    [17, 1],
  ])('zoom %i cho độ đậm %f', (zoom, opacity) => {
    expect(tileOpacityForZoom(zoom)).toBe(opacity);
  });
});

describe('visibilityForZoom', () => {
  it('mốc tách tỉnh là zoom 5', () => {
    expect(VN_DETAIL_ZOOM).toBe(5);
  });

  it.each([2, 3, 4])('zoom %i hiện Việt Nam dạng một vùng', (zoom) => {
    expect(visibilityForZoom(zoom)).toEqual({ vietnamCountry: true, vietnamDetail: false });
  });

  it.each([5, 8, 17])('zoom %i hiện 34 tỉnh', (zoom) => {
    expect(visibilityForZoom(zoom)).toEqual({ vietnamCountry: false, vietnamDetail: true });
  });

  it('zoom lẻ như 4,5 vẫn hiện Việt Nam dạng một vùng', () => {
    expect(visibilityForZoom(4.5).vietnamDetail).toBe(false);
  });
});
