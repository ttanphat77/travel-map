import L from 'leaflet';
import type { Feature, Point } from 'geojson';
import { getProvince, displayName } from '../../data/provinces';
import type { IslandLabelProps } from '../mapData';

/** Nhãn cố định cho Hoàng Sa và Trường Sa, vì các đảo quá nhỏ để thấy ở zoom 5 đến 8. */
export function createIslandLabelsLayer(labels: Feature<Point, IslandLabelProps>[], pane: string): L.LayerGroup {
  const group = L.layerGroup();
  for (const label of labels) {
    const [lng = 0, lat = 0] = label.geometry.coordinates;
    const province = getProvince(label.properties.code);
    const text = province ? `${label.properties.name} (${displayName(province)})` : label.properties.name;
    const icon = L.divIcon({ className: 'island-label', html: text, iconSize: undefined });
    L.marker([lat, lng], { icon, pane, interactive: false, keyboard: false }).addTo(group);
  }
  return group;
}
