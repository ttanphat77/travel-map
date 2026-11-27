import { useMemo, useRef } from 'react';
import type { ActiveSpecies } from '../domain/species';
import type { MarkStatus, PlaceCategory, UserData } from '../domain/types';
import { summarizeVietnam } from '../domain/vietnam';
import type { MapData } from './mapData';
import {
  useMap,
  type ContextMenuRequest,
  type MapControls,
  type MapStatuses,
  type Selection,
} from './useMap';

/** Loại nào được hiện trên bản đồ. Bộ lọc chỉ đổi cách hiện, không đổi dữ liệu. */
export interface MapFilters {
  visited: boolean;
  wishlist: boolean;
  places: boolean;
}

interface Props {
  data: MapData;
  userData: UserData;
  filters: MapFilters;
  /** Chỉ hiện ghim thuộc loại này. Null là hiện mọi ghim. */
  categoryFilter: PlaceCategory | null;
  selection: Selection | null;
  placing: boolean;
  onSelect: (selection: Selection | null) => void;
  onPlace: (lat: number, lng: number) => void;
  onContextMenu: (request: ContextMenuRequest) => void;
  onMapMove: () => void;
  /** Loài đang hiện trên bản đồ. Null là không hiện loài nào. */
  species: ActiveSpecies | null;
  controls: React.RefObject<MapControls | null>;
}

/** Bảng trạng thái của các vùng, chỉ giữ những trạng thái đang được bật trong bộ lọc. */
const statusTable = (marks: UserData['countries'], shown: (status: MarkStatus) => boolean): Record<string, MarkStatus> =>
  Object.fromEntries(Object.entries(marks).flatMap(([key, mark]) => (shown(mark.status) ? [[key, mark.status]] : [])));

/** Khung bản đồ. Mọi thông tin và thao tác của vùng hoặc ghim đang chọn nằm ở khung bên trái. */
export default function MapView({
  data,
  userData,
  filters,
  categoryFilter,
  selection,
  placing,
  onSelect,
  onPlace,
  onContextMenu,
  onMapMove,
  species,
  controls,
}: Props) {
  const container = useRef<HTMLDivElement>(null);

  const statuses = useMemo<MapStatuses>(() => {
    const shown = (status: MarkStatus) => filters[status];
    const provinces = Object.fromEntries(Object.entries(userData.provinces).filter(([, mark]) => shown(mark.status)));
    return {
      countries: statusTable(userData.countries, shown),
      provinces: statusTable(userData.provinces, shown),
      vietnam: summarizeVietnam(provinces).status,
    };
  }, [userData.countries, userData.provinces, filters]);

  const places = useMemo(
    () =>
      filters.places
        ? userData.places.filter((place) => filters[place.status] && (categoryFilter === null || place.category === categoryFilter))
        : [],
    [userData.places, filters, categoryFilter],
  );

  useMap(container, data, {
    statuses,
    places,
    selection,
    placing,
    onSelect,
    onPlace,
    onContextMenu,
    onMapMove,
    species,
    controls,
  });

  return (
    // Class của chế độ đặt ghim nằm ở khung bọc. Nếu đặt trên khung bản đồ, React sẽ xóa các class MapLibre tự thêm vào.
    <div className={`map-shell${placing ? ' is-placing' : ''}`}>
      <div ref={container} className="map-view" aria-label="Bản đồ" />
    </div>
  );
}
