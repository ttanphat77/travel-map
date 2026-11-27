import type { FeatureCollection, Point } from 'geojson';
import { LngLatBounds, MapLibreMap, Marker, setWorkerUrl, type PointLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { displayName, getProvince } from '../data/provinces';
import { wrapLng } from '../domain/locate';
import type { ActiveSpecies, LngLatBox } from '../domain/species';
import type { RegionKind } from '../domain/store';
import { VIETNAM_ID, type MarkStatus, type Place, type PlaceCategory } from '../domain/types';
import { boxOfRings, mainBox, outerRings, type Box } from './geometry';
import type { MapData } from './mapData';
import { BASE_STYLE_URL, SOURCES, ZONE_LAYERS, prepareStyle } from './mapStyle';
import { createDraftElement, createPinElement, createPoiRingElement, updatePinElement } from './markers';
import { poiFromFeature, type PoiInfo } from './poi';
import { createSpeciesLayers } from './speciesLayers';
import { INITIAL_CENTER, INITIAL_ZOOM, MAX_ZOOM, MIN_ZOOM, VN_DETAIL_ZOOM } from './zoom';

/** Thứ đang được chọn. Khung bên trái hiện thông tin và thao tác của thứ này. */
export type Selection =
  | { kind: 'country'; id: string; name: string }
  | { kind: 'vietnam' }
  | { kind: 'province'; code: string }
  | { kind: 'place'; id: string }
  | ({ kind: 'poi' } & PoiInfo)
  | {
      kind: 'placeForm';
      mode: 'new';
      lat: number;
      lng: number;
      name?: string;
      /** Loại ghim chọn sẵn khi mở form, ví dụ theo loại địa điểm của bản đồ nền. */
      category?: PlaceCategory;
    }
  | { kind: 'placeForm'; mode: 'edit'; id: string }
  /** Trang thông tin của một loài, theo mã iNaturalist. */
  | { kind: 'species'; inatId: number };

type ZoneTarget = { kind: 'country'; id: string; name: string } | { kind: 'vietnam' } | { kind: 'province'; code: string };

/** Thứ nằm dưới con trỏ khi bấm chuột phải. "map" là chỗ trống, ví dụ biển. */
export type ContextTarget = ZoneTarget | { kind: 'place'; id: string } | ({ kind: 'poi' } & PoiInfo) | { kind: 'map' };

export interface ContextMenuRequest {
  target: ContextTarget;
  lat: number;
  lng: number;
  /** Vị trí con trỏ, tính bằng pixel từ góc trên bên trái của khung bản đồ. */
  x: number;
  y: number;
}

export type StatusTable = Readonly<Record<string, MarkStatus | undefined>>;

export interface MapStatuses {
  countries: StatusTable;
  provinces: StatusTable;
  vietnam: MarkStatus | undefined;
}

export interface MapControls {
  /** Bay tới Việt Nam, kể cả hai quần đảo, ở mức zoom đủ để thấy 34 tỉnh. */
  zoomToVietnam: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Bay tới một tọa độ. Promise xong khi bản đồ dừng di chuyển. */
  flyTo: (lat: number, lng: number, zoom: number) => Promise<void>;
  /**
   * Bay tới phần đất lớn nhất của một quốc gia hoặc một tỉnh.
   * Hàm trả về lựa chọn ứng với vùng đó, để App đặt làm thứ đang chọn.
   */
  showRegion: (kind: RegionKind, key: string) => Selection | null;
  /** Bay tới một khung bao, ví dụ vùng có một loài. Bản đồ không zoom gần hơn mức SPECIES_FIT_MAX_ZOOM. */
  fitBox: (box: LngLatBox) => void;
}

interface Options {
  statuses: MapStatuses;
  places: readonly Place[];
  selection: Selection | null;
  /** Đang ở chế độ đặt ghim: bấm lên bản đồ sẽ gọi `onPlace` thay vì chọn. */
  placing: boolean;
  onSelect: (selection: Selection | null) => void;
  onPlace: (lat: number, lng: number) => void;
  onContextMenu: (request: ContextMenuRequest) => void;
  /** Bản đồ bắt đầu di chuyển hoặc zoom. App dùng sự kiện này để đóng menu chuột phải. */
  onMapMove: () => void;
  /** Loài đang hiện trên bản đồ, kèm trạng thái bật tắt của hai lớp. Null là không hiện loài nào. */
  species: ActiveSpecies | null;
  controls: React.RefObject<MapControls | null>;
}

// MapLibre tự tìm worker cạnh file JavaScript của nó, nhưng sau khi đóng gói thì đường dẫn đó không còn đúng.
// File worker được chép vào public/maplibre bởi scripts/copy-maplibre-worker.mjs trước mỗi lần dev và build.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

/**
 * Bề rộng phần bản đồ bị khung nổi bên trái che, tính cả lề.
 * Phải khớp với --panel-width và --overlay-gap trong tokens.css.
 */
const PANEL_COVER_PX = 360 + 2 * 12;
/** Lề chừa quanh một vùng khi bản đồ bay tới vùng đó. */
const FIT_PADDING_PX = 40;
/**
 * Khi bay tới vùng có một loài, bản đồ không zoom gần hơn mức này.
 * Khung bao của loài có thể chỉ là một điểm, ví dụ sao la chỉ có một điểm quan sát trên GBIF.
 */
const SPECIES_FIT_MAX_ZOOM = 7;
/** Bán kính quanh con trỏ để bắt trúng một nhãn địa điểm, tính bằng pixel. */
const LABEL_HIT_PX = 6;

interface FeatureRef {
  source: string;
  id: string;
}

interface MapApi {
  applyStatuses: (statuses: MapStatuses) => void;
  setPlaces: (places: readonly Place[]) => void;
  applySelection: (selection: Selection | null) => void;
  applySpecies: (species: ActiveSpecies | null) => void;
}

const isZone = (selection: Selection | null): selection is ZoneTarget =>
  selection?.kind === 'country' || selection?.kind === 'vietnam' || selection?.kind === 'province';

const zoneRef = (zone: ZoneTarget): FeatureRef =>
  zone.kind === 'province'
    ? { source: SOURCES.provinces, id: zone.code }
    : { source: SOURCES.countries, id: zone.kind === 'vietnam' ? VIETNAM_ID : zone.id };

const sameRef = (a: FeatureRef | null, b: FeatureRef | null) => a?.source === b?.source && a?.id === b?.id;

/** Nhãn Hoàng Sa và Trường Sa kèm tên tỉnh, ví dụ "Quần đảo Hoàng Sa (TP. Đà Nẵng)". */
function islandLabelData(data: MapData): FeatureCollection<Point, { label: string }> {
  return {
    type: 'FeatureCollection',
    features: data.islandLabels.map((feature) => {
      const province = getProvince(feature.properties.code);
      const label = province ? `${feature.properties.name} (${displayName(province)})` : feature.properties.name;
      return { type: 'Feature', geometry: feature.geometry, properties: { label } };
    }),
  };
}

/**
 * Tạo bản đồ MapLibre đúng một lần khi có dữ liệu, và hủy khi component bị gỡ.
 * Bản đồ nền là bản đồ vector, nên mọi nhãn địa điểm trên nền đều bấm được.
 * Bấm vào nhãn địa điểm thì chọn địa điểm. Bấm vào chỗ khác thì chọn tỉnh hoặc quốc gia.
 */
export function useMap(container: React.RefObject<HTMLDivElement | null>, data: MapData | null, options: Options): void {
  const apiRef = useRef<MapApi | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const element = container.current;
    if (!element || !data) return;
    const { controls } = optionsRef.current;

    const map = new MapLibreMap({
      container: element,
      style: BASE_STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      // Chuột phải dùng cho menu thao tác, nên tắt kiểu kéo chuột phải để xoay bản đồ.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    // Khung nổi che phần bên trái. Phần đệm này làm mọi thao tác bay và căn giữa tính theo phần bản đồ còn thấy được.
    map.setPadding({ top: 0, right: 0, bottom: 0, left: PANEL_COVER_PX });

    let ready = false;
    let labelLayers: string[] = [];
    const countryNames = new Map(data.countries.features.map((f) => [f.properties.id, f.properties.name || f.properties.nameEn]));

    // ---------- Thứ nằm dưới con trỏ ----------

    const zoneAt = (point: PointLike): ZoneTarget | null => {
      if (!ready) return null;
      const feature = map.queryRenderedFeatures(point, {
        layers: [ZONE_LAYERS.provinces, ZONE_LAYERS.vietnam, ZONE_LAYERS.countries],
      })[0];
      if (!feature) return null;
      const props = feature.properties as Record<string, string>;
      if (feature.layer.id === ZONE_LAYERS.provinces) return { kind: 'province', code: String(props.code) };
      if (feature.layer.id === ZONE_LAYERS.vietnam) return { kind: 'vietnam' };
      const id = String(props.id);
      return { kind: 'country', id, name: countryNames.get(id) ?? id };
    };

    const poiAt = (point: { x: number; y: number }, at: { lat: number; lng: number }): PoiInfo | null => {
      if (!ready || labelLayers.length === 0) return null;
      const box: [PointLike, PointLike] = [
        [point.x - LABEL_HIT_PX, point.y - LABEL_HIT_PX],
        [point.x + LABEL_HIT_PX, point.y + LABEL_HIT_PX],
      ];
      for (const feature of map.queryRenderedFeatures(box, { layers: labelLayers })) {
        const poi = poiFromFeature(feature, at);
        if (poi) return poi;
      }
      return null;
    };

    // ---------- Rê chuột ----------

    let hovered: FeatureRef | null = null;
    const setHover = (next: FeatureRef | null) => {
      if (sameRef(hovered, next)) return;
      if (hovered) map.setFeatureState(hovered, { hover: false });
      hovered = next;
      if (next) map.setFeatureState(next, { hover: true });
    };
    map.on('mousemove', (event) => {
      if (optionsRef.current.placing) {
        setHover(null);
        map.getCanvas().style.cursor = 'crosshair';
        return;
      }
      const poi = poiAt(event.point, event.lngLat);
      const zone = poi ? null : zoneAt(event.point);
      setHover(zone ? zoneRef(zone) : null);
      map.getCanvas().style.cursor = poi || zone ? 'pointer' : '';
    });
    map.on('mouseout', () => setHover(null));

    // ---------- Bấm trái và bấm phải ----------

    map.on('click', (event) => {
      const { placing, onPlace, onSelect } = optionsRef.current;
      if (placing) {
        onPlace(event.lngLat.lat, wrapLng(event.lngLat.lng));
        return;
      }
      const poi = poiAt(event.point, event.lngLat);
      onSelect(poi ? { kind: 'poi', ...poi } : zoneAt(event.point));
    });
    map.on('contextmenu', (event) => {
      event.originalEvent.preventDefault();
      const poi = poiAt(event.point, event.lngLat);
      const target: ContextTarget = poi ? { kind: 'poi', ...poi } : (zoneAt(event.point) ?? { kind: 'map' });
      optionsRef.current.onContextMenu({
        target,
        lat: event.lngLat.lat,
        lng: wrapLng(event.lngLat.lng),
        x: event.point.x,
        y: event.point.y,
      });
    });
    map.on('movestart', () => optionsRef.current.onMapMove());

    // ---------- Trạng thái của vùng ----------

    const appliedStatus = new Map<string, Map<string, MarkStatus>>([
      [SOURCES.countries, new Map()],
      [SOURCES.provinces, new Map()],
    ]);
    const syncStatuses = (source: string, table: StatusTable) => {
      const applied = appliedStatus.get(source);
      if (!applied) return;
      for (const key of [...applied.keys()]) {
        if (!table[key]) {
          map.removeFeatureState({ source, id: key }, 'status');
          applied.delete(key);
        }
      }
      for (const [key, status] of Object.entries(table)) {
        if (status && applied.get(key) !== status) {
          map.setFeatureState({ source, id: key }, { status });
          applied.set(key, status);
        }
      }
    };
    const applyStatuses = (statuses: MapStatuses) => {
      if (!ready) return;
      syncStatuses(SOURCES.countries, { ...statuses.countries, [VIETNAM_ID]: statuses.vietnam });
      syncStatuses(SOURCES.provinces, statuses.provinces);
    };

    // ---------- Ghim ----------

    const pins = new Map<string, { marker: Marker; place: Place; element: HTMLButtonElement }>();
    let selectedPinId: string | null = null;
    const setPlaces = (places: readonly Place[]) => {
      const seen = new Set<string>();
      for (const place of places) {
        seen.add(place.id);
        const existing = pins.get(place.id);
        if (existing) {
          if (existing.place !== place) {
            existing.marker.setLngLat([place.lng, place.lat]);
            updatePinElement(existing.element, place);
            existing.place = place;
          }
          continue;
        }
        const id = place.id;
        const pinElement = createPinElement(place);
        pinElement.classList.toggle('is-selected', id === selectedPinId);
        // Cú bấm vào ghim không được lan xuống bản đồ. Nếu lan xuống, bản đồ sẽ chọn vùng nằm dưới ghim.
        pinElement.addEventListener('click', (event) => {
          event.stopPropagation();
          if (!optionsRef.current.placing) optionsRef.current.onSelect({ kind: 'place', id });
        });
        pinElement.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const entry = pins.get(id);
          const box = map.getContainer().getBoundingClientRect();
          optionsRef.current.onContextMenu({
            target: { kind: 'place', id },
            lat: entry?.place.lat ?? place.lat,
            lng: entry?.place.lng ?? place.lng,
            x: event.clientX - box.left,
            y: event.clientY - box.top,
          });
        });
        // Ghim là biểu tượng tròn đều, nên tâm biểu tượng nằm đúng vị trí của ghim.
        const marker = new Marker({ element: pinElement, anchor: 'center' }).setLngLat([place.lng, place.lat]).addTo(map);
        pins.set(id, { marker, place, element: pinElement });
      }
      for (const [id, entry] of pins) {
        if (!seen.has(id)) {
          entry.marker.remove();
          pins.delete(id);
        }
      }
    };

    // ---------- Thứ đang chọn ----------

    let selectedZone: FeatureRef | null = null;
    const draft = new Marker({ element: createDraftElement(), anchor: 'bottom' });
    const poiRing = new Marker({ element: createPoiRingElement() });
    let draftShown = false;
    let ringShown = false;

    /** Tô viền vùng đang chọn, làm nổi ghim đang chọn, hiện ghim tạm khi thêm ghim, và khoanh địa điểm đang chọn. */
    const applySelection = (selection: Selection | null) => {
      if (ready) {
        const zone = isZone(selection) ? zoneRef(selection) : null;
        if (!sameRef(selectedZone, zone)) {
          if (selectedZone) map.setFeatureState(selectedZone, { selected: false });
          if (zone) map.setFeatureState(zone, { selected: true });
          selectedZone = zone;
        }
      }

      const pinId =
        selection?.kind === 'place' || (selection?.kind === 'placeForm' && selection.mode === 'edit') ? selection.id : null;
      if (pinId !== selectedPinId) {
        if (selectedPinId) pins.get(selectedPinId)?.element.classList.remove('is-selected');
        if (pinId) pins.get(pinId)?.element.classList.add('is-selected');
        selectedPinId = pinId;
      }

      if (selection?.kind === 'placeForm' && selection.mode === 'new') {
        draft.setLngLat([selection.lng, selection.lat]);
        if (!draftShown) draft.addTo(map);
        draftShown = true;
      } else if (draftShown) {
        draft.remove();
        draftShown = false;
      }

      if (selection?.kind === 'poi') {
        poiRing.setLngLat([selection.lng, selection.lat]);
        if (!ringShown) poiRing.addTo(map);
        ringShown = true;
      } else if (ringShown) {
        poiRing.remove();
        ringShown = false;
      }
    };

    // ---------- Lớp của loài ----------

    const speciesLayers = createSpeciesLayers(map);
    const applySpecies = (species: ActiveSpecies | null) => {
      if (ready) speciesLayers.sync(species);
    };

    apiRef.current = { applyStatuses, setPlaces, applySelection, applySpecies };
    setPlaces(optionsRef.current.places);
    applySelection(optionsRef.current.selection);

    map.on('load', () => {
      map.addSource(SOURCES.countries, { type: 'geojson', data: data.countries, promoteId: 'id' });
      map.addSource(SOURCES.provinces, { type: 'geojson', data: data.provinces, promoteId: 'code' });
      map.addSource(SOURCES.oldBorders, { type: 'geojson', data: data.oldBorders });
      map.addSource(SOURCES.islandLabels, { type: 'geojson', data: islandLabelData(data) });
      labelLayers = prepareStyle(map);
      ready = true;
      applyStatuses(optionsRef.current.statuses);
      applySelection(optionsRef.current.selection);
      applySpecies(optionsRef.current.species);
    });

    // ---------- Điều khiển từ bên ngoài ----------

    const vietnamBox = boxOfRings(
      data.countries.features.filter((f) => f.properties.id === VIETNAM_ID).flatMap((f) => outerRings(f.geometry)),
    );
    const flyToBox = (box: Box, minZoom = 0, maxZoom = MAX_ZOOM) => {
      const camera = map.cameraForBounds(new LngLatBounds([box[0], box[1]], [box[2], box[3]]), { padding: FIT_PADDING_PX });
      if (!camera?.center) return;
      const zoom = Math.min(Math.max(camera.zoom ?? map.getZoom(), minZoom), maxZoom);
      map.flyTo({ center: camera.center, zoom, duration: 1000 });
    };

    controls.current = {
      zoomToVietnam: () => {
        if (vietnamBox) flyToBox(vietnamBox, VN_DETAIL_ZOOM);
      },
      zoomIn: () => map.zoomIn(),
      zoomOut: () => map.zoomOut(),
      flyTo: (lat, lng, zoom) =>
        new Promise<void>((resolve) => {
          map.once('moveend', () => resolve());
          map.flyTo({ center: [lng, lat], zoom, duration: 1000 });
        }),
      showRegion: (kind, key) => {
        const geometries =
          kind === 'province'
            ? data.provinces.features.filter((f) => f.properties.code === key).map((f) => f.geometry)
            : data.countries.features.filter((f) => f.properties.id === key).map((f) => f.geometry);
        const box = mainBox(geometries);
        if (!box) return null;
        // Tỉnh chỉ hiện từ mức zoom VN_DETAIL_ZOOM trở lên.
        flyToBox(box, kind === 'province' ? VN_DETAIL_ZOOM : 0);
        return kind === 'province' ? { kind: 'province', code: key } : { kind: 'country', id: key, name: countryNames.get(key) ?? key };
      },
      fitBox: (box) => flyToBox(box, 0, SPECIES_FIT_MAX_ZOOM),
    };

    return () => {
      controls.current = null;
      apiRef.current = null;
      map.remove();
    };
  }, [container, data]);

  useEffect(() => {
    apiRef.current?.applyStatuses(options.statuses);
  }, [options.statuses]);

  useEffect(() => {
    apiRef.current?.setPlaces(options.places);
  }, [options.places]);

  useEffect(() => {
    apiRef.current?.applySelection(options.selection);
  }, [options.selection]);

  useEffect(() => {
    apiRef.current?.applySpecies(options.species);
  }, [options.species]);
}
