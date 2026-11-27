import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  MapLibreMap,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import { VIETNAM_ID } from '../domain/types';
import { COLORS } from './styles';
import { FILL_FADE_END_ZOOM, FILL_FADE_START_ZOOM, VN_DETAIL_ZOOM } from './zoom';

/** Bản đồ nền vector miễn phí, không cần khóa API. Nguồn dữ liệu là OpenStreetMap. */
export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export const SOURCES = {
  countries: 'tm-countries',
  provinces: 'tm-provinces',
  oldBorders: 'tm-old-borders',
  islandLabels: 'tm-island-labels',
} as const;

/** Các lớp vùng bấm được, xếp từ trên xuống dưới. Tỉnh nằm trên Việt Nam, Việt Nam nằm trên các nước khác. */
export const ZONE_LAYERS = {
  provinces: 'tm-provinces-fill',
  vietnam: 'tm-vietnam-fill',
  countries: 'tm-countries-fill',
} as const;

/**
 * Lớp chữ của bản đồ nền có thể bấm được để xem địa điểm.
 * Nhãn quốc gia và nhãn vùng lớn không nằm trong danh sách, vì bấm vào đó nên chọn cả vùng.
 * Trạm xe buýt và ga tàu (lớp poi_transit) cũng bị bỏ ra. Các trạm này rất dày và thường mang tên
 * địa điểm gần đó, ví dụ trạm "Văn Miếu - Quốc Tử Giám", nên dễ bị bấm nhầm thay cho địa điểm thật.
 */
const CLICKABLE_SOURCE_LAYERS = new Set(['poi', 'place', 'mountain_peak', 'aerodrome_label', 'water_name']);
const NON_CLICKABLE_LAYER_IDS = /^(label_(country|state)|poi_transit)/;

// Trạng thái của vùng lưu trong feature-state, gồm "status", "hover" và "selected".
const status: ExpressionSpecification = ['coalesce', ['feature-state', 'status'], ''];
const isMarked: ExpressionSpecification = ['match', status, ['visited', 'wishlist'], true, false];
const isHover: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];
const isSelected: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];

const fillColor: ExpressionSpecification = ['match', status, 'visited', COLORS.visited, 'wishlist', COLORS.wishlist, COLORS.accent];

/** Nền đậm 55% đến FILL_FADE_START_ZOOM, rồi nhạt dần và về 0 ở FILL_FADE_END_ZOOM. Rê chuột thì đậm thêm 15%. */
const fillOpacity: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  FILL_FADE_START_ZOOM,
  ['+', ['case', isMarked, 0.55, 0], ['case', isHover, 0.15, 0]],
  FILL_FADE_END_ZOOM,
  0,
];

const lineColor: ExpressionSpecification = [
  'match',
  status,
  'visited',
  COLORS.visitedStroke,
  'wishlist',
  COLORS.wishlistStroke,
  COLORS.unmarkedStroke,
];

/** Khi nền nhạt dần, viền màu trạng thái dày dần từ 0,8 lên 2 px để vẫn nhận ra vùng đã đánh dấu. */
const lineWidth: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  FILL_FADE_START_ZOOM,
  0.8,
  FILL_FADE_END_ZOOM,
  ['case', isMarked, 2, 0.8],
];

const highlightOpacity: ExpressionSpecification = ['case', isSelected, 1, isHover, 1, 0];
const highlightWidth: ExpressionSpecification = ['case', isSelected, 2.5, 2];

const notVietnam: FilterSpecification = ['!=', ['get', 'id'], VIETNAM_ID];
const onlyVietnam: FilterSpecification = ['==', ['get', 'id'], VIETNAM_ID];

/** Các lớp vùng, đặt dưới các lớp chữ của bản đồ nền để tên địa danh luôn đọc được. */
function zoneLayers(): LayerSpecification[] {
  const fill = (id: string, source: string, filter?: FilterSpecification, zoom?: { minzoom?: number; maxzoom?: number }) =>
    ({ id, type: 'fill', source, ...(filter ? { filter } : {}), ...zoom, paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity } }) as LayerSpecification;
  const line = (id: string, source: string, filter?: FilterSpecification, zoom?: { minzoom?: number; maxzoom?: number }) =>
    ({ id, type: 'line', source, ...(filter ? { filter } : {}), ...zoom, paint: { 'line-color': lineColor, 'line-width': lineWidth } }) as LayerSpecification;
  const highlight = (id: string, source: string, filter?: FilterSpecification, zoom?: { minzoom?: number; maxzoom?: number }) =>
    ({
      id,
      type: 'line',
      source,
      ...(filter ? { filter } : {}),
      ...zoom,
      paint: { 'line-color': COLORS.accent, 'line-width': highlightWidth, 'line-opacity': highlightOpacity },
    }) as LayerSpecification;
  const vietnamZoom = { maxzoom: VN_DETAIL_ZOOM };
  const provinceZoom = { minzoom: VN_DETAIL_ZOOM };

  return [
    fill(ZONE_LAYERS.countries, SOURCES.countries, notVietnam),
    fill(ZONE_LAYERS.vietnam, SOURCES.countries, onlyVietnam, vietnamZoom),
    fill(ZONE_LAYERS.provinces, SOURCES.provinces, undefined, provinceZoom),
    line('tm-countries-line', SOURCES.countries, notVietnam),
    line('tm-vietnam-line', SOURCES.countries, onlyVietnam, vietnamZoom),
    line('tm-provinces-line', SOURCES.provinces, undefined, provinceZoom),
    {
      id: 'tm-old-borders',
      type: 'line',
      source: SOURCES.oldBorders,
      minzoom: VN_DETAIL_ZOOM,
      paint: { 'line-color': COLORS.oldBorder, 'line-width': 1, 'line-opacity': 0.6, 'line-dasharray': [3, 3] },
    },
    highlight('tm-countries-highlight', SOURCES.countries, notVietnam),
    highlight('tm-vietnam-highlight', SOURCES.countries, onlyVietnam, vietnamZoom),
    highlight('tm-provinces-highlight', SOURCES.provinces, undefined, provinceZoom),
  ];
}

/** Nhãn cố định của Hoàng Sa và Trường Sa, đặt trên cùng. */
const islandLabelLayer: LayerSpecification = {
  id: 'tm-island-labels',
  type: 'symbol',
  source: SOURCES.islandLabels,
  minzoom: VN_DETAIL_ZOOM,
  layout: {
    'text-field': ['get', 'label'],
    'text-font': ['Noto Sans Italic'],
    'text-size': 12,
    'text-allow-overlap': true,
  },
  paint: { 'text-color': COLORS.islandLabel, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
};

/** Tên hiển thị ưu tiên tiếng Việt, sau đó đến tên viết bằng chữ Latin, cuối cùng là tên gốc. */
const VIETNAMESE_NAME: ExpressionSpecification = ['coalesce', ['get', 'name:vi'], ['get', 'name:latin'], ['get', 'name']];

/**
 * Lớp địa điểm như quán ăn, khách sạn hay cửa hàng của bản đồ nền.
 * Bản đồ nền chia địa điểm thành vài lớp theo hạng quan trọng, mỗi lớp có mức zoom bắt đầu riêng.
 * Lớp trạm xe buýt và ga tàu (poi_transit) không có mức zoom bắt đầu, nên không thuộc nhóm này.
 */
function isRankedPoiLayer(layer: LayerSpecification): boolean {
  return layer.type === 'symbol' && layer['source-layer'] === 'poi' && layer.minzoom !== undefined;
}

/** Lớp trạm xe buýt, ga tàu và sân bay của bản đồ nền. */
const TRANSIT_LAYER_ID = 'poi_transit';
/** Lớp riêng của trạm xe buýt sau khi tách khỏi lớp trên. */
const BUS_STOP_LAYER_ID = 'tm-poi-bus';
/** Trạm xe buýt chỉ hiện từ mức zoom này. */
const BUS_STOP_MIN_ZOOM = 17;

/** Bỏ trạm xe buýt khỏi một lớp địa điểm của bản đồ nền. */
function excludeBusStops(map: MapLibreMap, layer: SymbolLayerSpecification): void {
  const notBus: FilterSpecification = ['!=', ['get', 'class'], 'bus'];
  map.setFilter(layer.id, layer.filter ? (['all', layer.filter, notBus] as FilterSpecification) : notBus);
}

/**
 * Tách trạm xe buýt khỏi lớp giao thông của bản đồ nền.
 * Trạm xe buýt rất dày. Bản đồ lại xếp chỗ cho lớp giao thông trước các lớp địa điểm,
 * nên trạm xe buýt chiếm chỗ của quán ăn và khách sạn.
 * Sau khi tách, ga tàu và sân bay vẫn hiện như cũ. Trạm xe buýt chỉ hiện từ mức zoom 17,
 * và nằm dưới các lớp địa điểm, nên bản đồ xếp chỗ cho địa điểm khác trước.
 */
function splitBusStops(map: MapLibreMap, transit: SymbolLayerSpecification, below: string | undefined): void {
  const isBus: FilterSpecification = ['==', ['get', 'class'], 'bus'];
  const base = transit.filter;
  excludeBusStops(map, transit);
  map.addLayer(
    { ...transit, id: BUS_STOP_LAYER_ID, minzoom: BUS_STOP_MIN_ZOOM, filter: base ? (['all', base, isBus] as FilterSpecification) : isBus },
    below,
  );
}

/**
 * Chỉnh bản đồ nền sau khi style tải xong:
 * - Nhãn địa danh ưu tiên tên tiếng Việt, ví dụ "Quần đảo Hoàng Sa" thay cho tên tiếng Trung.
 * - Ẩn đường biên giới của bản đồ nền. App tự vẽ biên giới theo dữ liệu Natural Earth bản góc nhìn Việt Nam.
 * - Địa điểm hiện sớm hơn một mức zoom so với bản đồ nền gốc. Bản đồ gốc chỉ hiện phần lớn quán ăn
 *   và cửa hàng từ mức zoom 17, nên khi zoom gần vẫn thấy rất ít địa điểm.
 * - Địa điểm vẫn hiện biểu tượng khi không đủ chỗ cho tên. Bản đồ gốc ẩn cả biểu tượng trong trường hợp này.
 * - Trạm xe buýt chỉ hiện từ mức zoom 17 (xem splitBusStops).
 * - Chèn các lớp vùng xuống dưới lớp chữ đầu tiên, và đặt nhãn hai quần đảo lên trên cùng.
 * Hàm trả về danh sách lớp chữ bấm được.
 */
export function prepareStyle(map: MapLibreMap): string[] {
  const layers = map.getStyle().layers;
  const clickable: string[] = [];
  let firstSymbol: string | undefined;
  let firstPoi: string | undefined;
  for (const layer of layers) {
    if ('source-layer' in layer && layer['source-layer'] === 'boundary') {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
    if (layer.type !== 'symbol') continue;
    firstSymbol ??= layer.id;
    if (layer['source-layer'] === 'poi') firstPoi ??= layer.id;
    const textField = map.getLayoutProperty(layer.id, 'text-field') as unknown;
    if (JSON.stringify(textField ?? '').includes('name')) map.setLayoutProperty(layer.id, 'text-field', VIETNAMESE_NAME);
    if (isRankedPoiLayer(layer)) {
      map.setLayerZoomRange(layer.id, Math.max(0, (layer.minzoom ?? 0) - 1), layer.maxzoom ?? 24);
      map.setLayoutProperty(layer.id, 'text-optional', true);
      // Các lớp địa điểm theo hạng cũng vẽ trạm xe buýt. Trạm xe buýt chỉ còn ở lớp riêng (xem splitBusStops).
      excludeBusStops(map, layer);
    }
    if (CLICKABLE_SOURCE_LAYERS.has(layer['source-layer'] ?? '') && !NON_CLICKABLE_LAYER_IDS.test(layer.id)) {
      clickable.push(layer.id);
    }
  }
  // Lấy lại lớp giao thông sau vòng lặp, để bản sao cho trạm xe buýt mang cả tên tiếng Việt vừa đổi.
  const transit = map.getStyle().layers.find((layer) => layer.id === TRANSIT_LAYER_ID);
  if (transit?.type === 'symbol') splitBusStops(map, transit, firstPoi);
  for (const layer of zoneLayers()) map.addLayer(layer, firstSymbol);
  map.addLayer(islandLabelLayer);
  return clickable;
}
