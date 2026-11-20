import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { MarkStatus } from '../../domain/types';
import { regionStyle } from '../styles';

export interface RegionLayerOptions<P> {
  data: FeatureCollection<Geometry, P>;
  pane: string;
  renderer: L.Renderer;
  /** Mã vùng dùng làm khóa, ví dụ id quốc gia hoặc mã tỉnh. */
  keyOf: (props: P) => string;
  labelOf: (props: P) => string;
  onSelect: (key: string, props: P, latlng: L.LatLng) => void;
}

export interface RegionLayer {
  group: L.GeoJSON;
  select: (key: string | null) => void;
  /** Đổi màu theo trạng thái. Chỉ những vùng có thay đổi mới được vẽ lại. */
  setStatuses: (statuses: Readonly<Record<string, MarkStatus | undefined>>) => void;
  bounds: () => L.LatLngBounds;
}

/**
 * Tạo một lớp vùng bấm được: rê chuột thì sáng viền và hiện tên, bấm thì chọn vùng.
 * Lớp giữ bảng tra từ mã vùng sang đối tượng Leaflet để đổi kiểu vẽ nhanh.
 */
export function createRegionLayer<P>(options: RegionLayerOptions<P>): RegionLayer {
  const byKey = new Map<string, L.Path[]>();
  const statuses = new Map<string, MarkStatus | undefined>();
  let selected: string | null = null;
  let hovered: string | null = null;

  const restyle = (key: string) => {
    const style = regionStyle(statuses.get(key), { hover: key === hovered, selected: key === selected });
    for (const p of byKey.get(key) ?? []) p.setStyle(style);
  };

  // Leaflet chuyển renderer xuống từng polygon, nhưng kiểu GeoJSONOptions chưa khai báo trường này.
  const geoJsonOptions: L.GeoJSONOptions<P> & { renderer: L.Renderer } = {
    pane: options.pane,
    renderer: options.renderer,
    style: () => regionStyle(undefined),
    onEachFeature: (feature: Feature<Geometry, P>, layer: L.Layer) => {
      const path = layer as L.Path;
      const key = options.keyOf(feature.properties);
      byKey.set(key, [...(byKey.get(key) ?? []), path]);
      path.bindTooltip(options.labelOf(feature.properties), { sticky: true, direction: 'top', offset: [0, -8] });
      path.on('mouseover', () => {
        hovered = key;
        restyle(key);
      });
      path.on('mouseout', () => {
        if (hovered === key) hovered = null;
        restyle(key);
      });
      path.on('click', (event: L.LeafletMouseEvent) => {
        options.onSelect(key, feature.properties, event.latlng);
      });
    },
  };
  const group = L.geoJSON(options.data as unknown as GeoJSON.GeoJsonObject, geoJsonOptions);

  const select = (key: string | null) => {
    const previous = selected;
    selected = key;
    for (const k of new Set([previous, key])) if (k) restyle(k);
  };

  const setStatuses = (next: Readonly<Record<string, MarkStatus | undefined>>) => {
    for (const key of byKey.keys()) {
      const status = next[key];
      if (statuses.get(key) !== status) {
        statuses.set(key, status);
        restyle(key);
      }
    }
  };

  return { group, select, setStatuses, bounds: () => group.getBounds() };
}
