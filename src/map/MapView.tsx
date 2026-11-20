import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import 'leaflet/dist/leaflet.css';
import type { LocateResult } from '../domain/locate';
import type { PlaceFields } from '../domain/store';
import type { MarkStatus, UserData } from '../domain/types';
import { summarizeVietnam } from '../domain/vietnam';
import PlaceDetail from '../ui/PlaceDetail';
import PlaceForm from '../ui/PlaceForm';
import RegionDetail, { type MarkActions } from '../ui/RegionDetail';
import type { MapData } from './mapData';
import { useLeafletMap, type MapControls, type MapStatuses, type Selection } from './useLeafletMap';

export interface PlaceActions {
  /** Trả về id của ghim mới. */
  addPlace: (fields: PlaceFields) => string;
  updatePlace: (id: string, fields: PlaceFields) => void;
  deletePlace: (id: string) => void;
}

interface Props {
  data: MapData;
  userData: UserData;
  actions: MarkActions & PlaceActions;
  placing: boolean;
  onPlace: (lat: number, lng: number) => void;
  controls: React.RefObject<MapControls | null>;
  locate: (lat: number, lng: number) => LocateResult;
  countryName: (id: string) => string | undefined;
}

const statusTable = (marks: UserData['countries']): Record<string, MarkStatus> =>
  Object.fromEntries(Object.entries(marks).map(([key, mark]) => [key, mark.status]));

export default function MapView({ data, userData, actions, placing, onPlace, controls, locate, countryName }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const popupElement = useMemo(() => document.createElement('div'), []);
  const [selection, setSelection] = useState<Selection | null>(null);

  const statuses = useMemo<MapStatuses>(
    () => ({
      countries: statusTable(userData.countries),
      provinces: statusTable(userData.provinces),
      vietnam: summarizeVietnam(userData.provinces).status,
    }),
    [userData.countries, userData.provinces],
  );

  useLeafletMap(container, data, {
    popupElement,
    statuses,
    places: userData.places,
    placing,
    onSelect: setSelection,
    onPlace,
    controls,
  });

  // Nội dung popup đổi chiều cao khi hiện thêm ô nhập, nên popup phải tính lại vị trí.
  useLayoutEffect(() => {
    controls.current?.updatePopup();
  }, [controls, selection, userData]);

  const renderPopup = (current: Selection) => {
    if (current.kind === 'place') {
      const place = userData.places.find((p) => p.id === current.id);
      if (!place) return null;
      return (
        <PlaceDetail
          place={place}
          location={locate(place.lat, place.lng)}
          countryName={countryName}
          onEdit={() => controls.current?.openAt(place.lat, place.lng, { kind: 'placeForm', mode: 'edit', id: place.id })}
          onDelete={() => {
            controls.current?.closePopup();
            actions.deletePlace(place.id);
          }}
        />
      );
    }
    if (current.kind === 'placeForm') {
      const editing = current.mode === 'edit' ? userData.places.find((p) => p.id === current.id) : undefined;
      if (current.mode === 'edit' && !editing) return null;
      const initial: PlaceFields = editing
        ? { name: editing.name, lat: editing.lat, lng: editing.lng, status: editing.status, date: editing.date, note: editing.note }
        : current.mode === 'new'
          ? { name: current.name ?? '', lat: current.lat, lng: current.lng, status: 'visited' }
          : { name: '', lat: 0, lng: 0, status: 'visited' };
      return (
        <PlaceForm
          key={editing ? `edit-${editing.id}` : `new-${initial.lat},${initial.lng}`}
          title={editing ? 'Sửa địa điểm' : 'Thêm địa điểm'}
          initial={initial}
          onCancel={() => controls.current?.closePopup()}
          onSave={(fields) => {
            const id = editing ? editing.id : actions.addPlace(fields);
            if (editing) actions.updatePlace(editing.id, fields);
            controls.current?.openAt(fields.lat, fields.lng, { kind: 'place', id });
          }}
        />
      );
    }
    return (
      <RegionDetail
        selection={current}
        userData={userData}
        actions={actions}
        onZoomToVietnam={() => controls.current?.zoomToVietnam()}
      />
    );
  };

  return (
    <>
      {/* Class của chế độ đặt ghim nằm ở khung bọc. Nếu đặt trên khung bản đồ, React sẽ xóa các class Leaflet tự thêm vào. */}
      <div className={`map-shell${placing ? ' is-placing' : ''}`}>
        <div ref={container} className="map-view" aria-label="Bản đồ" />
      </div>
      {selection && createPortal(renderPopup(selection), popupElement)}
    </>
  );
}
