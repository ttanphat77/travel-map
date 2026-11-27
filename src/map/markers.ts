import type { Place, PlaceCategory } from '../domain/types';
import { CATEGORY_COLORS, COLORS } from './styles';

const PIN_PATH = 'M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.5 14 35 14 35s12.5-12.5 12.5-21.8C26.5 6.4 21 1 14 1z';
const DRAFT_FILL = '#9ca3af';

/** Cỡ khung của ghim trên bản đồ, tính bằng px. Biểu tượng chiếm phần lớn khung, phần còn lại dành cho vòng tròn. */
const PIN_SIZE = 40;
/** Ghim quê nhà to hơn ghim thường. */
const HOMETOWN_SIZE = 46;
/** Khung vẽ của ghim. Biểu tượng nằm trong ô 0 đến 24, vòng tròn bao quanh có bán kính 15,5. */
const VIEW_BOX = '-5 -5 34 34';

/** Id của biểu tượng loại ghim trong bộ biểu tượng ẩn của trang (xem CategorySprite). */
export const categorySymbolId = (category: PlaceCategory) => `place-icon-${category}`;

/** Id của biểu tượng dùng cho ghim chưa có loại. */
export const DEFAULT_SYMBOL_ID = 'place-icon-default';

/** Id của biểu tượng ngôi nhà của ghim quê nhà. */
export const HOMETOWN_SYMBOL_ID = 'place-icon-hometown';

export type PinPlace = Pick<Place, 'name' | 'status' | 'category' | 'hometown'>;

/**
 * Ghim thường là chính biểu tượng của loại ghim, vẽ ở cỡ lớn với màu riêng của loại.
 * Ghim "Đã đến" vẽ đậm. Ghim "Muốn đến" vẽ mờ và có vòng nét đứt bao quanh.
 * Viền trắng quanh nét vẽ nằm trong CSS.
 */
function iconSvg(place: PinPlace): string {
  const color = place.category ? CATEGORY_COLORS[place.category] : COLORS.uncategorized;
  const symbol = place.category ? categorySymbolId(place.category) : DEFAULT_SYMBOL_ID;
  const wishlist = place.status === 'wishlist';
  const ring = wishlist
    ? `<circle cx="12" cy="12" r="15.5" fill="#fff" fill-opacity="0.75" stroke="${color}" stroke-width="1.6" stroke-dasharray="3.2 2.4"/>`
    : '';
  return (
    `<svg width="${PIN_SIZE}" height="${PIN_SIZE}" viewBox="${VIEW_BOX}" aria-hidden="true">` +
    `${ring}<use href="#${symbol}" width="24" height="24" color="${color}"${wishlist ? ' opacity="0.6"' : ''}/></svg>`
  );
}

/** Ghim quê nhà là hình tròn màu đỏ, có viền trắng và ngôi nhà trắng ở giữa. */
function hometownSvg(): string {
  return (
    `<svg width="${HOMETOWN_SIZE}" height="${HOMETOWN_SIZE}" viewBox="${VIEW_BOX}" aria-hidden="true">` +
    `<circle cx="12" cy="12" r="15.5" fill="${COLORS.hometown}" stroke="#fff" stroke-width="2"/>` +
    `<use href="#${HOMETOWN_SYMBOL_ID}" x="2" y="2" width="20" height="20" color="#fff"/></svg>`
  );
}

/** Hình ghim giọt nước có chấm trắng ở giữa. App chỉ dùng hình này cho ghim tạm khi đang thêm ghim. */
function pinSvg(fill: string, stroke: string): string {
  return (
    `<svg width="32" height="41" viewBox="0 0 28 36" aria-hidden="true">` +
    `<path class="pin-shape" d="${PIN_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
    `<circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`
  );
}

/**
 * Phần tử DOM của một ghim. Phần tử là nút bấm để dùng được bằng bàn phím.
 * Ghim đang chọn được làm nổi bằng class "is-selected" trong CSS.
 */
export function createPinElement(place: PinPlace): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  updatePinElement(element, place);
  return element;
}

export function updatePinElement(element: HTMLElement, place: PinPlace): void {
  element.classList.add('map-pin', 'is-icon');
  element.classList.toggle('is-hometown', place.hometown === true);
  element.innerHTML = place.hometown ? hometownSvg() : iconSvg(place);
  const label = place.hometown ? `${place.name} (quê nhà)` : place.name;
  element.setAttribute('aria-label', label);
  element.title = label;
}

/** Ghim tạm màu xám, đánh dấu vị trí của ghim đang được thêm. */
export function createDraftElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'map-pin is-draft';
  element.innerHTML = pinSvg(DRAFT_FILL, COLORS.accent);
  return element;
}

/** Vòng tròn xanh đánh dấu địa điểm của bản đồ nền đang được chọn. */
export function createPoiRingElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'map-poi-ring';
  return element;
}
