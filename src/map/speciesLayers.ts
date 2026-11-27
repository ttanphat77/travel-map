import type { ExpressionSpecification, MapLibreMap } from 'maplibre-gl';
import type { ActiveSpecies } from '../domain/species';
import { observationTileUrl, rangeTileUrl } from '../services/species';

/**
 * Hai lớp của loài đang xem (xem docs/SPECIES-RANGE.md, mục 5.3).
 * - Lớp vùng phân bố lấy ô của iNaturalist. App chỉ tải ô đến mức zoom 4, vì vùng phân bố rất thô.
 *   Ở mức zoom lớn hơn, MapLibre phóng to ô của mức 4. Nhờ vậy app gửi rất ít yêu cầu tới iNaturalist.
 * - Lớp nơi đã gặp lấy ô của GBIF, dạng lưới lục giác.
 * Hai lớp nằm trên lớp màu của vùng, và nằm dưới lớp chữ đầu tiên của bản đồ nền. Ghim là HTML nên luôn nằm trên cùng.
 */

type Kind = 'range' | 'obs';
const KINDS: readonly Kind[] = ['range', 'obs'];

interface LayerSpec {
  id: string;
  tileSize: number;
  maxzoom: number;
  opacity: number | ExpressionSpecification;
  attribution: string;
}

/**
 * Vùng phân bố đậm 0,6 đến mức zoom 6, rồi nhạt dần về 0,25 ở mức zoom 10.
 * Khi zoom gần, vùng phân bố thường phủ kín màn hình. Nếu giữ đậm, đường và địa hình bên dưới bị mờ.
 */
const RANGE_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 6, 0.6, 10, 0.25];

const SPECS: Record<Kind, LayerSpec> = {
  range: { id: 'tm-species-range', tileSize: 256, maxzoom: 4, opacity: RANGE_OPACITY, attribution: 'Vùng phân bố © iNaturalist' },
  obs: { id: 'tm-species-obs', tileSize: 512, maxzoom: 12, opacity: 0.85, attribution: 'Điểm quan sát © GBIF.org' },
};

/** Id của hai lớp, để nơi khác biết mà không phải đọc cấu hình bên trong. */
export const SPECIES_RANGE_LAYER = SPECS.range.id;
export const SPECIES_OBS_LAYER = SPECS.obs.id;

/** Các hàm của bản đồ mà file này dùng. Test truyền vào một bản đồ giả có đúng các hàm này. */
export type SpeciesMap = Pick<
  MapLibreMap,
  'getLayersOrder' | 'getLayer' | 'getSource' | 'addSource' | 'removeSource' | 'addLayer' | 'removeLayer' | 'setLayoutProperty'
>;

/**
 * Tạo bộ điều khiển hai lớp của loài cho một bản đồ.
 * Gọi `sync` mỗi khi loài đang xem đổi, hoặc khi người dùng bật tắt một lớp.
 * Hàm chỉ gỡ và thêm lại lớp khi loài đổi. Khi chỉ bật tắt, hàm đổi `visibility`, nên ô đã tải không phải tải lại.
 */
export function createSpeciesLayers(map: SpeciesMap) {
  /** Đường dẫn ô của lớp đang có trên bản đồ. Null là lớp chưa có. */
  const applied: Record<Kind, string | null> = { range: null, obs: null };

  /** Lớp chữ đầu tiên của bản đồ nền. Hai lớp loài được chèn ngay dưới lớp này. */
  const firstSymbolId = () => map.getLayersOrder().find((id) => map.getLayer(id)?.type === 'symbol');

  const remove = (kind: Kind) => {
    const { id } = SPECS[kind];
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
    applied[kind] = null;
  };

  const add = (kind: Kind, url: string) => {
    const { id, tileSize, maxzoom, opacity, attribution } = SPECS[kind];
    map.addSource(id, { type: 'raster', tiles: [url], tileSize, minzoom: 0, maxzoom, attribution });
    // Vùng phân bố luôn nằm dưới lớp nơi đã gặp, để các ô lục giác không bị vùng màu che.
    const before = kind === 'range' && map.getLayer(SPECS.obs.id) ? SPECS.obs.id : firstSymbolId();
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': opacity } }, before);
    applied[kind] = url;
  };

  function sync(species: ActiveSpecies | null): void {
    const wanted: Record<Kind, string | null> = {
      range: species ? rangeTileUrl(species.inatId) : null,
      obs: species?.gbifKey ? observationTileUrl(species.gbifKey) : null,
    };
    for (const kind of KINDS) {
      const url = wanted[kind];
      if (applied[kind] === url) continue;
      if (applied[kind]) remove(kind);
      if (url) add(kind, url);
    }
    const shown: Record<Kind, boolean> = { range: species?.showRange ?? false, obs: species?.showObservations ?? false };
    for (const kind of KINDS) {
      if (applied[kind]) map.setLayoutProperty(SPECS[kind].id, 'visibility', shown[kind] ? 'visible' : 'none');
    }
  }

  return { sync };
}
