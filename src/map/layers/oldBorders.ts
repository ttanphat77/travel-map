import L from 'leaflet';
import type { FeatureCollection, Geometry } from 'geojson';
import type { BorderProps } from '../mapData';
import { OLD_BORDER_STYLE } from '../styles';

/** Nét đứt tỉnh cũ. Lớp này không bấm được. */
export function createOldBordersLayer(
  data: FeatureCollection<Geometry, BorderProps>,
  pane: string,
  renderer: L.Renderer,
): L.GeoJSON {
  // Leaflet chuyển renderer xuống từng đường, nhưng kiểu GeoJSONOptions chưa khai báo trường này.
  const options: L.GeoJSONOptions & { renderer: L.Renderer } = {
    pane,
    renderer,
    style: () => OLD_BORDER_STYLE,
    interactive: false,
  };
  return L.geoJSON(data, options);
}
