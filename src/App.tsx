import {
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Info,
  MapPin,
  MapPinPlus,
  Minus,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { APP_TITLE } from './appInfo';
import { displayName, getProvince } from './data/provinces';
import { categoryForAttraction, categoryForPoi } from './domain/categories';
import type { ActiveSpecies, LngLatBox, SpeciesHit, SpeciesInfo } from './domain/species';
import { userReducer, type RegionKind } from './domain/store';
import {
  CATEGORY_LABELS,
  emptyUserData,
  VIETNAM_ID,
  type Place,
  type PlaceCategory,
  type PlaceRegion,
  type UserData,
} from './domain/types';
import MapView, { type MapFilters } from './map/MapView';
import { loadMapData, type MapData } from './map/mapData';
import type { ContextMenuRequest, MapControls, Selection } from './map/useMap';
import { PLACE_ZOOM } from './map/zoom';
import type { SearchResult } from './services/nominatim';
import { loadUserData, saveUserData } from './services/userDataApi';
import type { Attraction } from './services/wiki';
import type { Actions } from './ui/actions';
import { CATEGORY_ICONS, CategorySprite } from './ui/categories';
import { useRegionLookup } from './ui/useRegionLookup';
import ContextMenu, { type MenuEntry } from './ui/ContextMenu';
import SidePanel from './ui/SidePanel';
import type { SpeciesLayer } from './ui/SpeciesInfo';
import { speciesIcon } from './ui/species';
import Toast, { type ToastMessage } from './ui/Toast';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: MapData };

/** Thời gian chờ để gom các thay đổi liên tiếp thành một lần lưu. */
const SAVE_DELAY_MS = 500;

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [userData, dispatch] = useReducer(userReducer, undefined, emptyUserData);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [placing, setPlacing] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [menu, setMenu] = useState<ContextMenuRequest | null>(null);
  const [filters, setFilters] = useState<MapFilters>({ visited: true, wishlist: true, places: true });
  /** Loại đang dùng để lọc ghim, cả trong danh sách lẫn trên bản đồ. Null là không lọc. */
  const [categoryFilter, setCategoryFilter] = useState<PlaceCategory | null>(null);
  /** Loài đang hiện trên bản đồ. Giá trị này giữ nguyên khi người dùng rời trang loài, cho đến khi bấm nút tắt ở góc phải. */
  const [activeSpecies, setActiveSpecies] = useState<ActiveSpecies | null>(null);
  const controls = useRef<MapControls | null>(null);
  const toastId = useRef(0);
  const userDataRef = useRef(userData);
  userDataRef.current = userData;
  /**
   * Dữ liệu đang có trên server. Giá trị là null khi chưa tải được dữ liệu từ server.
   * Khi còn null, app không lưu gì, để dữ liệu rỗng ban đầu không ghi đè file trên server.
   */
  const serverData = useRef<UserData | null>(null);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([loadMapData(), loadUserData()])
      .then(([data, saved]) => {
        serverData.current = saved;
        dispatch({ type: 'replaceAll', data: saved });
        setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        console.error(error);
        setState({ status: 'error' });
      });
  }, []);

  useEffect(load, [load]);

  // Mỗi khi dữ liệu đổi, chờ một chút để gom các thay đổi liên tiếp, rồi gửi lên server một lần.
  useEffect(() => {
    if (serverData.current === null || userData === serverData.current) return;
    const timer = window.setTimeout(() => {
      saveUserData(userData)
        .then(() => {
          serverData.current = userData;
          setSaveFailed(false);
        })
        .catch((error: unknown) => {
          console.error(error);
          setSaveFailed(true);
        });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [userData]);

  const mapData = state.status === 'ready' ? state.data : null;
  const countryNames = useMemo(
    () => new Map(mapData?.countries.features.map((f) => [f.properties.id, f.properties.name || f.properties.nameEn]) ?? []),
    [mapData],
  );
  const countryName = useCallback((id: string) => countryNames.get(id), [countryNames]);
  const countryWikidataIds = useMemo(
    () => new Map(mapData?.countries.features.map((f) => [f.properties.id, f.properties.wikidata]) ?? []),
    [mapData],
  );
  const countryWikidata = useCallback((id: string) => countryWikidataIds.get(id), [countryWikidataIds]);
  /** Đổi mã nước hai chữ, ví dụ "VN", sang mã vùng của bản đồ, ví dụ "VNM". Null khi chưa tải xong bản đồ. */
  const countryIdOf = useMemo(() => {
    if (!mapData) return null;
    const ids = new Map(mapData.countries.features.flatMap((f) => (f.properties.iso2 ? [[f.properties.iso2, f.properties.id]] : [])));
    return (iso2: string) => ids.get(iso2);
  }, [mapData]);

  const showToast = useCallback((text: string, actionLabel?: string, onAction?: () => void) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, actionLabel, onAction });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  /** Sau khi lưu ghim "Đã đến", gợi ý đánh dấu tỉnh hoặc quốc gia chứa ghim nếu vùng đó chưa được đánh dấu. */
  const suggestRegion = useCallback(
    (region: PlaceRegion) => {
      const data = userDataRef.current;
      const { countryId, provinceCode } = region;
      let target: { kind: RegionKind; key: string; name: string } | null = null;
      if (provinceCode) {
        const province = getProvince(provinceCode);
        if (province && !data.provinces[provinceCode]) target = { kind: 'province', key: provinceCode, name: displayName(province) };
      } else if (countryId && countryId !== VIETNAM_ID && !data.countries[countryId]) {
        target = { kind: 'country', key: countryId, name: countryName(countryId) ?? countryId };
      }
      if (!target) return;
      const { kind, key, name } = target;
      showToast(`Đánh dấu ${name} là Đã đến?`, 'Đánh dấu', () =>
        dispatch({ type: 'setStatus', kind, key, status: 'visited', now: new Date().toISOString() }),
      );
    },
    [countryName, showToast],
  );

  /** Ghim "Đã đến" vừa thêm hoặc vừa sửa, đang chờ tra xong vùng để gợi ý đánh dấu vùng đó. */
  const suggestWhenLocated = useRef(new Set<string>());
  const onRegionResolved = useCallback(
    (place: Place, region: PlaceRegion) => {
      dispatch({ type: 'setPlaceRegion', id: place.id, lat: place.lat, lng: place.lng, region });
      if (!suggestWhenLocated.current.delete(place.id)) return;
      const current = userDataRef.current.places.find((p) => p.id === place.id);
      if (current?.status === 'visited' && current.lat === place.lat && current.lng === place.lng) suggestRegion(region);
    },
    [suggestRegion],
  );
  useRegionLookup(mapData ? userData.places : null, countryIdOf, onRegionResolved);

  const actions = useMemo<Actions>(
    () => ({
      setStatus: (kind, key, status) =>
        dispatch({ type: 'setStatus', kind, key, status, now: new Date().toISOString() }),
      updateDetails: (kind, key, details) =>
        dispatch({ type: 'updateDetails', kind, key, ...details, now: new Date().toISOString() }),
      clear: (kind, key, name) => {
        const table = kind === 'country' ? userDataRef.current.countries : userDataRef.current.provinces;
        const previous = table[key];
        dispatch({ type: 'clear', kind, key });
        showToast(`Đã bỏ đánh dấu ${name}.`, 'Hoàn tác', () =>
          dispatch({ type: 'restoreMark', kind, key, mark: previous }),
        );
      },
      addPlace: (fields) => {
        const id = crypto.randomUUID();
        dispatch({ type: 'addPlace', id, fields, now: new Date().toISOString() });
        // Ghim mới chưa có vùng. Gợi ý được đưa ra khi tra xong vùng của ghim.
        if (fields.status === 'visited') suggestWhenLocated.current.add(id);
        return id;
      },
      updatePlace: (id, fields) => {
        const before = userDataRef.current.places.find((p) => p.id === id);
        dispatch({ type: 'updatePlace', id, fields, now: new Date().toISOString() });
        if (fields.status !== 'visited') return;
        const region = before && before.lat === fields.lat && before.lng === fields.lng ? before.region : undefined;
        if (region) suggestRegion(region);
        else suggestWhenLocated.current.add(id);
      },
      deletePlace: (id) => {
        const index = userDataRef.current.places.findIndex((p) => p.id === id);
        const place = userDataRef.current.places[index];
        if (!place) return;
        dispatch({ type: 'deletePlace', id });
        // Ghim vừa xóa không còn được chọn nữa.
        setSelection((current) =>
          (current?.kind === 'place' || (current?.kind === 'placeForm' && current.mode === 'edit')) && current.id === id
            ? null
            : current,
        );
        showToast(`Đã xóa ${place.name}.`, 'Hoàn tác', () => dispatch({ type: 'restorePlace', place, index }));
      },
    }),
    [showToast, suggestRegion],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  // Phím Esc hủy chế độ đặt ghim, hoặc bỏ chọn vùng hay ghim đang chọn.
  // Khi con trỏ đang ở ô nhập, phím Esc không bỏ chọn, để người dùng không mất phần đang gõ.
  useEffect(() => {
    if (menu) return; // Menu chuột phải tự đóng khi nhấn Esc.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (placing) {
        setPlacing(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      setSelection(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing, menu]);

  const onSelect = useCallback((next: Selection | null) => {
    setMenu(null);
    setSelection(next);
  }, []);

  const onPlace = useCallback((lat: number, lng: number) => {
    setMenu(null);
    setPlacing(false);
    setSelection({ kind: 'placeForm', mode: 'new', lat, lng });
  }, []);

  // Kết quả tìm kiếm mở trang thông tin địa điểm, giống khi bấm vào địa điểm trên bản đồ.
  // Người dùng xem trước rồi mới lưu, vì nhiều khi họ chỉ muốn xem chỗ đó ở đâu.
  const onPickSearchResult = useCallback(async (result: SearchResult) => {
    setPlacing(false);
    const { name, lat, lng, group, type, poiClass } = result;
    setSelection({ kind: 'poi', name, lat, lng, group, type, poiClass });
    await controls.current?.flyTo(lat, lng, PLACE_ZOOM);
  }, []);

  // Điểm đến gợi ý: bản đồ bay tới đó và mở form thêm ghim, với loại ghim chọn sẵn theo loại điểm đến.
  const onPickAttraction = useCallback(async (attraction: Attraction) => {
    setPlacing(false);
    const { name, lat, lng, category } = attraction;
    setSelection({ kind: 'placeForm', mode: 'new', lat, lng, name, category: categoryForAttraction(category) });
    await controls.current?.flyTo(lat, lng, PLACE_ZOOM);
  }, []);

  const onPickPlace = useCallback(async (place: Place) => {
    setPlacing(false);
    setSelection({ kind: 'place', id: place.id });
    await controls.current?.flyTo(place.lat, place.lng, PLACE_ZOOM);
  }, []);

  const onPickRegion = useCallback((kind: RegionKind, key: string) => {
    setPlacing(false);
    const next = controls.current?.showRegion(kind, key);
    if (next) setSelection(next);
  }, []);

  const startPlacing = useCallback(() => {
    setSelection(null);
    setPlacing(true);
  }, []);

  const zoomToVietnam = useCallback(() => controls.current?.zoomToVietnam(), []);

  // ---------- Loài ----------

  /** Mã của loài vừa được bật. Khi biết khung bao của loài này, bản đồ tự bay tới một lần. */
  const autoFitSpecies = useRef<number | null>(null);

  /**
   * Mở trang của một loài. Nếu loài này chưa hiện trên bản đồ, app bật cả hai lớp của nó.
   * Mở lại loài đang hiện, ví dụ từ nút ở góc phải, thì giữ nguyên trạng thái bật tắt và không bay lại.
   */
  const openSpecies = useCallback((hit: Pick<SpeciesHit, 'inatId' | 'name' | 'group'>) => {
    setPlacing(false);
    setSelection({ kind: 'species', inatId: hit.inatId });
    setActiveSpecies((current) => {
      if (current?.inatId === hit.inatId) return current;
      autoFitSpecies.current = hit.inatId;
      return { inatId: hit.inatId, name: hit.name, group: hit.group, showRange: true, showObservations: true };
    });
  }, []);

  /** Trang loài đã tải xong. App cập nhật tên và nhóm của loài đang hiện theo thông tin đầy đủ. */
  const onSpeciesInfo = useCallback((info: SpeciesInfo, requestedId: number) => {
    setActiveSpecies((current) => {
      if (current?.inatId !== requestedId) return current;
      // iNaturalist có thể đã chuyển loài sang mã mới. Khi đó việc tự bay tới cũng theo mã mới.
      if (autoFitSpecies.current === requestedId) autoFitSpecies.current = info.inatId;
      return { ...current, inatId: info.inatId, name: info.name, group: info.group };
    });
  }, []);

  /**
   * GBIF đã đếm xong điểm quan sát. Lúc này app mới gắn khóa GBIF để thêm lớp nơi đã gặp.
   * Nếu thêm lớp sớm hơn, hàng chục ô lục giác tải cùng lúc với yêu cầu đếm, và GBIF có thể từ chối yêu cầu đếm.
   */
  const onSpeciesObservations = useCallback((info: SpeciesInfo, available: boolean) => {
    setActiveSpecies((current) =>
      current?.inatId === info.inatId && available && info.gbifKey ? { ...current, gbifKey: info.gbifKey } : current,
    );
  }, []);

  /** Bật hoặc tắt một lớp. Nếu loài của trang chưa hiện trên bản đồ, app bật loài đó với đúng lớp này. */
  const onSpeciesLayer = useCallback((info: SpeciesInfo, layer: SpeciesLayer, on: boolean) => {
    setActiveSpecies((current) => {
      const base: ActiveSpecies =
        current?.inatId === info.inatId
          ? current
          : { inatId: info.inatId, gbifKey: info.gbifKey, name: info.name, group: info.group, showRange: false, showObservations: false };
      return layer === 'range' ? { ...base, showRange: on } : { ...base, showObservations: on };
    });
  }, []);

  const onSpeciesBox = useCallback((inatId: number, box: LngLatBox) => {
    if (autoFitSpecies.current !== inatId) return;
    autoFitSpecies.current = null;
    controls.current?.fitBox(box);
  }, []);

  const flyToBox = useCallback((box: LngLatBox) => controls.current?.fitBox(box), []);

  /** Các mục của menu chuột phải, tùy theo thứ nằm dưới con trỏ. */
  const menuContent = useMemo((): { title?: string; items: MenuEntry[] } | null => {
    if (!menu) return null;
    const { target, lat, lng } = menu;
    const addHere: MenuEntry = {
      label: 'Thêm ghim tại đây',
      icon: MapPinPlus,
      onSelect: () => {
        setPlacing(false);
        setSelection({ kind: 'placeForm', mode: 'new', lat, lng });
      },
    };
    if (target.kind === 'country' || target.kind === 'province') {
      const kind = target.kind;
      const key = target.kind === 'country' ? target.id : target.code;
      const province = target.kind === 'province' ? getProvince(target.code) : undefined;
      const name = target.kind === 'country' ? target.name : province ? displayName(province) : key;
      const mark = (kind === 'country' ? userData.countries : userData.provinces)[key];
      const items: MenuEntry[] = [
        { label: 'Đã đến', icon: Check, checked: mark?.status === 'visited', onSelect: () => actions.setStatus(kind, key, 'visited') },
        { label: 'Muốn đến', icon: Star, checked: mark?.status === 'wishlist', onSelect: () => actions.setStatus(kind, key, 'wishlist') },
      ];
      if (mark) items.push({ label: 'Bỏ đánh dấu', icon: X, danger: true, onSelect: () => actions.clear(kind, key, name) });
      items.push(
        'divider',
        {
          label: 'Xem thông tin',
          icon: Info,
          onSelect: () => setSelection(kind === 'country' ? { kind: 'country', id: key, name } : { kind: 'province', code: key }),
        },
        addHere,
      );
      return { title: name, items };
    }
    if (target.kind === 'vietnam') {
      return {
        title: 'Việt Nam',
        items: [
          { label: 'Phóng to Việt Nam', icon: ZoomIn, onSelect: zoomToVietnam },
          { label: 'Xem thông tin', icon: Info, onSelect: () => setSelection({ kind: 'vietnam' }) },
          'divider',
          addHere,
        ],
      };
    }
    if (target.kind === 'place') {
      const place = userData.places.find((p) => p.id === target.id);
      if (!place) return null;
      return {
        title: place.name,
        items: [
          { label: 'Xem thông tin', icon: Info, onSelect: () => setSelection({ kind: 'place', id: place.id }) },
          { label: 'Sửa', icon: Pencil, onSelect: () => setSelection({ kind: 'placeForm', mode: 'edit', id: place.id }) },
          'divider',
          { label: 'Xóa', icon: Trash2, danger: true, onSelect: () => actions.deletePlace(place.id) },
        ],
      };
    }
    if (target.kind === 'poi') {
      // Lưu địa điểm của bản đồ nền thành ghim, rồi chọn ghim vừa tạo.
      const { kind: _kind, ...poi } = target;
      const saveAs = (status: 'visited' | 'wishlist') => () =>
        setSelection({ kind: 'place', id: actions.addPlace({ name: poi.name, lat: poi.lat, lng: poi.lng, status }) });
      return {
        title: poi.name,
        items: [
          { label: 'Xem thông tin', icon: Info, onSelect: () => setSelection(target) },
          { label: 'Đã đến', icon: Check, onSelect: saveAs('visited') },
          { label: 'Muốn đến', icon: Star, onSelect: saveAs('wishlist') },
          'divider',
          {
            label: 'Thêm ghim kèm ghi chú',
            icon: MapPinPlus,
            onSelect: () =>
              setSelection({
                kind: 'placeForm',
                mode: 'new',
                lat: poi.lat,
                lng: poi.lng,
                name: poi.name,
                category: categoryForPoi(poi.type, poi.poiClass),
              }),
          },
        ],
      };
    }
    return { items: [addHere] };
  }, [menu, userData, actions, zoomToVietnam]);

  /** Số vùng theo từng trạng thái, hiện trên các nút lọc. */
  const counts = useMemo(() => {
    const marks = [...Object.values(userData.provinces), ...Object.values(userData.countries)];
    return {
      visited: marks.filter((m) => m.status === 'visited').length,
      wishlist: marks.filter((m) => m.status === 'wishlist').length,
      places: userData.places.length,
    };
  }, [userData]);
  const toggleFilter = (key: keyof MapFilters) => setFilters((current) => ({ ...current, [key]: !current[key] }));
  /** Mô tả những gì đang bị ẩn. Khi mọi ghim đã ẩn, nút trạng thái chỉ còn ẩn thêm vùng. */
  const hiddenParts = (Object.keys(FILTER_TARGETS) as (keyof MapFilters)[])
    .filter((key) => !filters[key])
    .map((key) => (key !== 'places' && !filters.places ? FILTER_TARGETS[key].replace('vùng và ghim', 'vùng') : FILTER_TARGETS[key]));

  /**
   * Nút bật tắt một lớp trên bản đồ. Biểu tượng con mắt cho biết đây là nút bật tắt, không phải số thống kê.
   * `unit` ghi rõ số đếm là gì, ví dụ "vùng", vì nút trạng thái đếm vùng còn nút ghim đếm ghim.
   */
  const filterChip = (key: keyof MapFilters, label: string, count: number, marker: React.ReactNode, unit?: string) => (
    <button
      type="button"
      className={`filter-chip${filters[key] ? '' : ' is-off'}`}
      aria-pressed={filters[key]}
      title={filters[key] ? `Ẩn ${FILTER_TARGETS[key]} trên bản đồ` : `Hiện ${FILTER_TARGETS[key]} trên bản đồ`}
      onClick={() => toggleFilter(key)}
    >
      {marker}
      {label}
      <span className="filter-count">
        {count}
        {unit ? ` ${unit}` : ''}
      </span>
      {filters[key] ? (
        <Eye size={14} className="filter-eye" aria-hidden="true" />
      ) : (
        <EyeOff size={14} className="filter-eye" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <div className="app">
      <h1 className="sr-only">{APP_TITLE}</h1>
      <CategorySprite />
      {mapData && (
        <MapView
          data={mapData}
          userData={userData}
          filters={filters}
          categoryFilter={categoryFilter}
          selection={selection}
          placing={placing}
          onSelect={onSelect}
          onPlace={onPlace}
          onContextMenu={setMenu}
          onMapMove={closeMenu}
          species={activeSpecies}
          controls={controls}
        />
      )}
      {mapData && (
        <SidePanel
          userData={userData}
          actions={actions}
          countryName={countryName}
          onPickSearchResult={onPickSearchResult}
          onPickPlace={onPickPlace}
          onPickRegion={onPickRegion}
          onAddPlace={startPlacing}
          selection={selection}
          onSelect={onSelect}
          onZoomToVietnam={zoomToVietnam}
          provinceGeo={mapData.provinceGeo}
          countryWikidata={countryWikidata}
          onPickAttraction={onPickAttraction}
          categoryFilter={categoryFilter}
          onCategoryFilter={setCategoryFilter}
          activeSpecies={activeSpecies}
          onOpenSpecies={openSpecies}
          onSpeciesInfo={onSpeciesInfo}
          onSpeciesObservations={onSpeciesObservations}
          onSpeciesLayer={onSpeciesLayer}
          onSpeciesBox={onSpeciesBox}
          onFlyToBox={flyToBox}
        />
      )}
      {mapData && (
        <div className="map-filters">
          <div className="map-filter-row" role="group" aria-label="Hiện trên bản đồ">
            {filterChip('visited', 'Đã đến', counts.visited, <span className="filter-dot is-visited" aria-hidden="true" />, 'vùng')}
            {filterChip('wishlist', 'Muốn đến', counts.wishlist, <span className="filter-dot is-wishlist" aria-hidden="true" />, 'vùng')}
            {filterChip('places', 'Ghim', counts.places, <MapPin size={14} aria-hidden="true" />)}
            {categoryFilter && <CategoryFilterChip category={categoryFilter} onClear={() => setCategoryFilter(null)} />}
            {activeSpecies && (
              <SpeciesFilterChip species={activeSpecies} onOpen={() => openSpecies(activeSpecies)} onClear={() => setActiveSpecies(null)} />
            )}
          </div>
          {hiddenParts.length > 0 && (
            <p className="map-filter-notice" role="status">
              <EyeOff size={14} aria-hidden="true" />
              Bản đồ đang ẩn {hiddenParts.join(', ')}.
              <button
                type="button"
                className="link-button"
                onClick={() => setFilters({ visited: true, wishlist: true, places: true })}
              >
                Hiện lại
              </button>
            </p>
          )}
        </div>
      )}
      {mapData && (
        <div className="map-controls">
          <div className="zoom-group">
            <button type="button" className="icon-button" aria-label="Phóng to" onClick={() => controls.current?.zoomIn()}>
              <Plus size={18} aria-hidden="true" />
            </button>
            <button type="button" className="icon-button" aria-label="Thu nhỏ" onClick={() => controls.current?.zoomOut()}>
              <Minus size={18} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className={`fab${placing ? ' is-active' : ''}`}
            aria-pressed={placing}
            onClick={() => {
              setSelection(null);
              setPlacing((p) => !p);
            }}
          >
            {placing ? <X size={18} aria-hidden="true" /> : <MapPinPlus size={18} aria-hidden="true" />}
            {placing ? 'Hủy đặt ghim' : 'Thêm ghim'}
          </button>
        </div>
      )}
      {menu && menuContent && (
        <ContextMenu x={menu.x} y={menu.y} title={menuContent.title} items={menuContent.items} onClose={closeMenu} />
      )}
      {placing && (
        <div className="placing-banner" role="status">
          <MapPinPlus size={16} aria-hidden="true" />
          Bấm lên bản đồ để đặt ghim. Nhấn Esc để hủy.
        </div>
      )}
      {saveFailed && (
        <div className="save-error" role="alert">
          <CircleAlert size={16} aria-hidden="true" />
          Không lưu được dữ liệu lên server.
        </div>
      )}
      {state.status === 'loading' && <p className="app-message">Đang tải bản đồ…</p>}
      {state.status === 'error' && (
        <div className="app-message" role="alert">
          <CircleAlert size={24} aria-hidden="true" />
          <p>Không tải được dữ liệu bản đồ hoặc dữ liệu đã lưu trên server.</p>
          <button type="button" className="button button-primary" onClick={load}>
            Thử lại
          </button>
        </div>
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

/** Nút cho biết bản đồ đang lọc ghim theo loại. Bấm để bỏ lọc. */
/** Những gì bị ẩn khỏi bản đồ khi tắt từng nút. Nút trạng thái ẩn cả vùng lẫn ghim có trạng thái đó. */
const FILTER_TARGETS: Record<keyof MapFilters, string> = {
  visited: 'vùng và ghim Đã đến',
  wishlist: 'vùng và ghim Muốn đến',
  places: 'mọi ghim',
};

/**
 * Nút cho biết loài nào đang hiện trên bản đồ.
 * Bấm tên loài thì mở lại trang loài. Bấm dấu × thì gỡ cả hai lớp của loài khỏi bản đồ.
 */
function SpeciesFilterChip({ species, onOpen, onClear }: { species: ActiveSpecies; onOpen: () => void; onClear: () => void }) {
  const Icon = speciesIcon(species.group);
  return (
    <span className="filter-chip is-category species-chip">
      <button type="button" className="species-chip-name" title="Mở trang loài" onClick={onOpen}>
        <Icon size={14} aria-hidden="true" />
        {species.name}
      </button>
      <button type="button" className="species-chip-clear" aria-label={`Tắt lớp của ${species.name} trên bản đồ`} title="Tắt lớp của loài" onClick={onClear}>
        <X size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

function CategoryFilterChip({ category, onClear }: { category: PlaceCategory; onClear: () => void }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <button type="button" className="filter-chip is-category" title="Bỏ lọc theo loại" onClick={onClear}>
      <Icon size={14} aria-hidden="true" />
      {CATEGORY_LABELS[category]}
      <X size={14} aria-hidden="true" />
    </button>
  );
}
