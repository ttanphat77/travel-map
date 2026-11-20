import { useEffect, useRef } from 'react';
import L from './leafletGlobal';
import { displayName, getProvince } from '../data/provinces';
import type { MarkStatus, Place } from '../domain/types';
import { VIETNAM_ID } from '../domain/types';
import { createIslandLabelsLayer } from './layers/islandLabels';
import { createOldBordersLayer } from './layers/oldBorders';
import { createPlacesLayer, type PlacesLayer } from './layers/places';
import { createRegionLayer, type RegionLayer } from './layers/regions';
import type { CountryProps, MapData, ProvinceProps } from './mapData';
import {
  INITIAL_CENTER,
  INITIAL_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  VN_DETAIL_ZOOM,
  tileOpacityForZoom,
  visibilityForZoom,
} from './zoom';

export type Selection =
  | { kind: 'country'; id: string; name: string }
  | { kind: 'vietnam' }
  | { kind: 'province'; code: string }
  | { kind: 'place'; id: string }
  | { kind: 'placeForm'; mode: 'new'; lat: number; lng: number; name?: string }
  | { kind: 'placeForm'; mode: 'edit'; id: string };

export type StatusTable = Readonly<Record<string, MarkStatus | undefined>>;

export interface MapStatuses {
  countries: StatusTable;
  provinces: StatusTable;
  vietnam: MarkStatus | undefined;
}

export interface MapControls {
  /** Bay tới Việt Nam, kể cả hai quần đảo, ở mức zoom đủ để thấy 34 tỉnh. */
  zoomToVietnam: () => void;
  /** Bay tới một tọa độ. Promise xong khi bản đồ dừng di chuyển. */
  flyTo: (lat: number, lng: number, zoom: number) => Promise<void>;
  /** Mở popup tại một tọa độ với nội dung cho trước. */
  openAt: (lat: number, lng: number, selection: Selection) => void;
  /** Tính lại kích thước popup sau khi nội dung React thay đổi. */
  updatePopup: () => void;
  closePopup: () => void;
}

interface Options {
  /** Phần tử DOM chứa nội dung popup. React vẽ vào phần tử này bằng createPortal. */
  popupElement: HTMLElement;
  statuses: MapStatuses;
  places: readonly Place[];
  /** Đang ở chế độ đặt ghim: bấm lên bản đồ sẽ gọi `onPlace` thay vì chọn vùng. */
  placing: boolean;
  onSelect: (selection: Selection | null) => void;
  onPlace: (lat: number, lng: number) => void;
  controls: React.RefObject<MapControls | null>;
}

/** Popup của vùng mở ngay tại điểm bấm. Popup của ghim mở phía trên biểu tượng ghim. */
const REGION_POPUP_OFFSET = L.point(0, 7);
const PIN_POPUP_OFFSET = L.point(0, -30);

/** Tạo pane với z-index cho trước. Pane không bấm được thì chuột đi xuyên qua xuống lớp dưới. */
function createPane(map: L.Map, name: string, zIndex: number, interactive: boolean): void {
  const pane = map.createPane(name);
  pane.style.zIndex = String(zIndex);
  if (!interactive) pane.style.pointerEvents = 'none';
}

interface MapLayers {
  otherCountries: RegionLayer;
  vietnamCountry: RegionLayer;
  provinces: RegionLayer;
  places: PlacesLayer;
}

function applyStatuses(layers: MapLayers, statuses: MapStatuses): void {
  layers.otherCountries.setStatuses(statuses.countries);
  layers.vietnamCountry.setStatuses({ [VIETNAM_ID]: statuses.vietnam });
  layers.provinces.setStatuses(statuses.provinces);
}

/**
 * Tạo bản đồ Leaflet đúng một lần khi có dữ liệu, và hủy khi component bị gỡ.
 * Quốc gia và tỉnh dùng chung một canvas, vì canvas ở trên sẽ chặn chuột của canvas ở dưới.
 */
export function useLeafletMap(
  container: React.RefObject<HTMLDivElement | null>,
  data: MapData | null,
  options: Options,
): void {
  const layersRef = useRef<MapLayers | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const element = container.current;
    if (!element || !data) return;
    const { popupElement, controls } = optionsRef.current;

    const map = L.map(element, {
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      worldCopyJump: true,
      maxBounds: [[-85, -540], [85, 540]],
      maxBoundsViscosity: 1,
    });

    createPane(map, 'regions', 400, true);
    createPane(map, 'oldBorders', 420, false);
    createPane(map, 'islandLabels', 430, false);
    const regionRenderer = L.canvas({ pane: 'regions', tolerance: 2 });
    const borderRenderer = L.canvas({ pane: 'oldBorders' });

    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: tileOpacityForZoom(INITIAL_ZOOM),
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Gõ phím trong ô nhập của popup không được làm bản đồ di chuyển hay zoom.
    // Leaflet chỉ nghe phím Esc khi khung bản đồ đang được chọn, nên popup tự đóng khi nhấn Esc.
    const stopKeys = (event: Event) => {
      event.stopPropagation();
      if ((event as KeyboardEvent).key === 'Escape') map.closePopup();
    };
    popupElement.addEventListener('keydown', stopKeys);
    // Khi bấm nút trong popup, React có thể gỡ nút đó khỏi trang ngay trong lúc xử lý cú bấm.
    // Leaflet sẽ không nhận ra cú bấm thuộc popup nữa và coi đó là cú bấm lên bản đồ, rồi đóng popup.
    // Vì vậy cú bấm được chặn lại ngay tại khung nội dung popup.
    const stopClick = (event: Event) => event.stopPropagation();
    popupElement.addEventListener('click', stopClick);
    L.DomEvent.disableScrollPropagation(popupElement);
    const popup = L.popup({ autoPan: true, minWidth: 240, maxWidth: 300 }).setContent(popupElement);

    const all: RegionLayer[] = [];
    let currentKind: Selection['kind'] | null = null;
    const open = (latlng: L.LatLng, selection: Selection, offset: L.Point) => {
      // Leaflet gỡ popup đang mở rồi gắn lại, và sự kiện "remove" sẽ xóa nội dung đã chọn.
      // Vì vậy popup cũ phải được đóng trước khi đặt nội dung mới.
      if (map.hasLayer(popup)) map.closePopup(popup);
      currentKind = selection.kind;
      optionsRef.current.onSelect(selection);
      popup.options.offset = offset;
      popup.setLatLng(latlng).openOn(map);
    };
    const choose = (layer: RegionLayer, key: string, selection: Selection, latlng: L.LatLng) => {
      if (optionsRef.current.placing) {
        optionsRef.current.onPlace(latlng.lat, latlng.wrap().lng);
        return;
      }
      for (const l of all) l.select(l === layer ? key : null);
      open(latlng, selection, REGION_POPUP_OFFSET);
    };
    map.on('click', (event: L.LeafletMouseEvent) => {
      if (optionsRef.current.placing) optionsRef.current.onPlace(event.latlng.lat, event.latlng.wrap().lng);
    });

    const countryLabel = (p: CountryProps) => p.name || p.nameEn;
    const onlyVietnam = (keep: boolean) => ({
      ...data.countries,
      features: data.countries.features.filter((f) => (f.properties.id === VIETNAM_ID) === keep),
    });
    const otherCountries: RegionLayer = createRegionLayer<CountryProps>({
      data: onlyVietnam(false),
      pane: 'regions',
      renderer: regionRenderer,
      keyOf: (p) => p.id,
      labelOf: countryLabel,
      onSelect: (key, p, latlng) => choose(otherCountries, key, { kind: 'country', id: key, name: countryLabel(p) }, latlng),
    });
    const vietnamCountry: RegionLayer = createRegionLayer<CountryProps>({
      data: onlyVietnam(true),
      pane: 'regions',
      renderer: regionRenderer,
      keyOf: (p) => p.id,
      labelOf: countryLabel,
      onSelect: (key, _p, latlng) => choose(vietnamCountry, key, { kind: 'vietnam' }, latlng),
    });
    const provinceLabel = (p: ProvinceProps) => {
      const info = getProvince(p.code);
      return info ? displayName(info) : p.name;
    };
    const provinces: RegionLayer = createRegionLayer<ProvinceProps>({
      data: data.provinces,
      pane: 'regions',
      renderer: regionRenderer,
      keyOf: (p) => p.code,
      labelOf: provinceLabel,
      onSelect: (key, _p, latlng) => choose(provinces, key, { kind: 'province', code: key }, latlng),
    });
    all.push(otherCountries, vietnamCountry, provinces);

    const places = createPlacesLayer((place, latlng) => {
      if (optionsRef.current.placing) return;
      for (const l of all) l.select(null);
      open(latlng, { kind: 'place', id: place.id }, PIN_POPUP_OFFSET);
    });
    places.group.addTo(map);

    layersRef.current = { otherCountries, vietnamCountry, provinces, places };
    applyStatuses(layersRef.current, optionsRef.current.statuses);
    places.setPlaces(optionsRef.current.places);

    popup.on('remove', () => {
      currentKind = null;
      for (const l of all) l.select(null);
      optionsRef.current.onSelect(null);
    });

    const oldBorders = createOldBordersLayer(data.oldBorders, 'oldBorders', borderRenderer);
    const islandLabels = createIslandLabelsLayer(data.islandLabels, 'islandLabels');

    otherCountries.group.addTo(map);
    const applyZoom = () => {
      const zoom = map.getZoom();
      const visible = visibilityForZoom(zoom);
      tiles.setOpacity(tileOpacityForZoom(zoom));
      const toggle = (layer: L.Layer, show: boolean) => {
        if (show && !map.hasLayer(layer)) layer.addTo(map);
        if (!show && map.hasLayer(layer)) map.removeLayer(layer);
      };
      // Popup của một vùng vừa bị ẩn theo mức zoom thì đóng lại.
      if ((currentKind === 'province' && !visible.vietnamDetail) || (currentKind === 'vietnam' && !visible.vietnamCountry)) {
        map.closePopup();
      }
      toggle(vietnamCountry.group, visible.vietnamCountry);
      toggle(provinces.group, visible.vietnamDetail);
      toggle(oldBorders, visible.vietnamDetail);
      toggle(islandLabels, visible.vietnamDetail);
    };
    applyZoom();
    map.on('zoomend', applyZoom);

    controls.current = {
      zoomToVietnam: () => {
        map.closePopup();
        const bounds = vietnamCountry.bounds();
        const zoom = Math.max(map.getBoundsZoom(bounds), VN_DETAIL_ZOOM);
        map.flyTo(bounds.getCenter(), zoom);
      },
      flyTo: (lat, lng, zoom) =>
        new Promise<void>((resolve) => {
          map.closePopup();
          map.once('moveend', () => resolve());
          map.flyTo([lat, lng], zoom, { duration: 1 });
        }),
      openAt: (lat, lng, selection) => {
        for (const l of all) l.select(null);
        const offset = selection.kind === 'place' || selection.kind === 'placeForm' ? PIN_POPUP_OFFSET : REGION_POPUP_OFFSET;
        open(L.latLng(lat, lng), selection, offset);
      },
      updatePopup: () => {
        if (map.hasLayer(popup)) popup.update();
      },
      closePopup: () => map.closePopup(),
    };

    return () => {
      controls.current = null;
      layersRef.current = null;
      popupElement.removeEventListener('keydown', stopKeys);
      popupElement.removeEventListener('click', stopClick);
      map.remove();
    };
  }, [container, data]);

  useEffect(() => {
    if (layersRef.current) applyStatuses(layersRef.current, options.statuses);
  }, [options.statuses]);

  useEffect(() => {
    layersRef.current?.places.setPlaces(options.places);
  }, [options.places]);
}
