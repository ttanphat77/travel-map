import L from '../leafletGlobal';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { MarkStatus, Place } from '../../domain/types';
import { COLORS } from '../styles';

/** Từ mức zoom này trở lên, ghim không còn bị gom thành nhóm. */
export const DISABLE_CLUSTER_ZOOM = 9;

const iconCache = new Map<MarkStatus, L.DivIcon>();

function pinIcon(status: MarkStatus): L.DivIcon {
  const cached = iconCache.get(status);
  if (cached) return cached;
  const fill = status === 'visited' ? COLORS.visited : COLORS.wishlist;
  const stroke = status === 'visited' ? COLORS.visitedStroke : COLORS.wishlistStroke;
  const icon = L.divIcon({
    className: 'place-pin',
    html:
      `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true">` +
      `<path d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.5 14 35 14 35s12.5-12.5 12.5-21.8C26.5 6.4 21 1 14 1z" ` +
      `fill="${fill}" stroke="${stroke}" stroke-width="2"/>` +
      `<circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 35],
  });
  iconCache.set(status, icon);
  return icon;
}

export interface PlacesLayer {
  group: L.MarkerClusterGroup;
  setPlaces: (places: readonly Place[]) => void;
}

/** Lớp ghim, có gom nhóm khi zoom nhỏ. Lớp chỉ tạo lại những ghim có thay đổi. */
export function createPlacesLayer(onSelect: (place: Place, latlng: L.LatLng) => void): PlacesLayer {
  const group = L.markerClusterGroup({
    disableClusteringAtZoom: DISABLE_CLUSTER_ZOOM,
    showCoverageOnHover: false,
    maxClusterRadius: 50,
  });
  const markers = new Map<string, { marker: L.Marker; place: Place }>();

  const setPlaces = (places: readonly Place[]) => {
    const seen = new Set<string>();
    for (const place of places) {
      seen.add(place.id);
      const existing = markers.get(place.id);
      if (existing && existing.place === place) continue;
      if (existing) group.removeLayer(existing.marker);
      const marker = L.marker([place.lat, place.lng], {
        icon: pinIcon(place.status),
        title: place.name,
        alt: place.name,
        keyboard: true,
      });
      marker.on('click', () => onSelect(place, marker.getLatLng()));
      markers.set(place.id, { marker, place });
      group.addLayer(marker);
    }
    for (const [id, entry] of markers) {
      if (!seen.has(id)) {
        group.removeLayer(entry.marker);
        markers.delete(id);
      }
    }
  };

  return { group, setPlaces };
}
