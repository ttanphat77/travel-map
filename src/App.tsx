import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { APP_TITLE } from './appInfo';
import { displayName, getProvince } from './data/provinces';
import { createLocator, type LocateResult } from './domain/locate';
import { userReducer, type PlaceFields, type RegionKind } from './domain/store';
import { emptyUserData, VIETNAM_ID } from './domain/types';
import MapView, { type PlaceActions } from './map/MapView';
import { loadMapData, type MapData } from './map/mapData';
import type { MapControls } from './map/useLeafletMap';
import type { SearchResult } from './services/nominatim';
import type { MarkActions } from './ui/RegionDetail';
import SearchBox from './ui/SearchBox';
import Toast, { type ToastMessage } from './ui/Toast';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: MapData };

/** Mức zoom khi bay tới một kết quả tìm kiếm. */
const SEARCH_RESULT_ZOOM = 14;

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [userData, dispatch] = useReducer(userReducer, undefined, emptyUserData);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [placing, setPlacing] = useState(false);
  const controls = useRef<MapControls | null>(null);
  const toastId = useRef(0);
  const userDataRef = useRef(userData);
  userDataRef.current = userData;

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadMapData()
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        console.error(error);
        setState({ status: 'error' });
      });
  }, []);

  useEffect(load, [load]);

  const mapData = state.status === 'ready' ? state.data : null;
  const locate = useMemo(
    (): ((lat: number, lng: number) => LocateResult) => (mapData ? createLocator(mapData) : () => ({})),
    [mapData],
  );
  const countryNames = useMemo(
    () => new Map(mapData?.countries.features.map((f) => [f.properties.id, f.properties.name || f.properties.nameEn]) ?? []),
    [mapData],
  );
  const countryName = useCallback((id: string) => countryNames.get(id), [countryNames]);

  const showToast = useCallback((text: string, actionLabel?: string, onAction?: () => void) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, actionLabel, onAction });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  /** Sau khi lưu ghim "Đã đến", gợi ý đánh dấu tỉnh hoặc quốc gia chứa ghim nếu vùng đó chưa được đánh dấu. */
  const suggestRegion = useCallback(
    (fields: PlaceFields) => {
      if (fields.status !== 'visited') return;
      const where = locate(fields.lat, fields.lng);
      const data = userDataRef.current;
      let target: { kind: RegionKind; key: string; name: string } | null = null;
      if (where.code) {
        const province = getProvince(where.code);
        if (province && !data.provinces[where.code]) target = { kind: 'province', key: where.code, name: displayName(province) };
      } else if (where.countryId && where.countryId !== VIETNAM_ID && !data.countries[where.countryId]) {
        target = { kind: 'country', key: where.countryId, name: countryName(where.countryId) ?? where.countryId };
      }
      if (!target) return;
      const { kind, key, name } = target;
      showToast(`Đánh dấu ${name} là Đã đến?`, 'Đánh dấu', () =>
        dispatch({ type: 'setStatus', kind, key, status: 'visited', now: new Date().toISOString() }),
      );
    },
    [locate, countryName, showToast],
  );

  const actions = useMemo<MarkActions & PlaceActions>(
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
        suggestRegion(fields);
        return id;
      },
      updatePlace: (id, fields) => {
        dispatch({ type: 'updatePlace', id, fields, now: new Date().toISOString() });
        suggestRegion(fields);
      },
      deletePlace: (id) => {
        const index = userDataRef.current.places.findIndex((p) => p.id === id);
        const place = userDataRef.current.places[index];
        if (!place) return;
        dispatch({ type: 'deletePlace', id });
        showToast(`Đã xóa ${place.name}.`, 'Hoàn tác', () => dispatch({ type: 'restorePlace', place, index }));
      },
    }),
    [showToast, suggestRegion],
  );

  // Phím Esc hủy chế độ đặt ghim.
  useEffect(() => {
    if (!placing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlacing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [placing]);

  const onPlace = useCallback((lat: number, lng: number) => {
    setPlacing(false);
    controls.current?.openAt(lat, lng, { kind: 'placeForm', mode: 'new', lat, lng });
  }, []);

  const onPickSearchResult = useCallback(async (result: SearchResult) => {
    setPlacing(false);
    await controls.current?.flyTo(result.lat, result.lng, SEARCH_RESULT_ZOOM);
    controls.current?.openAt(result.lat, result.lng, {
      kind: 'placeForm',
      mode: 'new',
      lat: result.lat,
      lng: result.lng,
      name: result.name,
    });
  }, []);

  return (
    <div className="app">
      <header className="top-bar">
        <span className="app-title">{APP_TITLE}</span>
        {mapData && (
          <>
            <SearchBox onPick={onPickSearchResult} />
            <button
              type="button"
              className={`primary-button add-place-button${placing ? ' is-active' : ''}`}
              aria-pressed={placing}
              onClick={() => {
                controls.current?.closePopup();
                setPlacing((p) => !p);
              }}
            >
              {placing ? 'Hủy đặt ghim' : 'Thêm địa điểm'}
            </button>
          </>
        )}
      </header>
      <main className="app-main">
        {mapData && (
          <MapView
            data={mapData}
            userData={userData}
            actions={actions}
            placing={placing}
            onPlace={onPlace}
            controls={controls}
            locate={locate}
            countryName={countryName}
          />
        )}
        {placing && (
          <div className="placing-banner" role="status">
            Bấm lên bản đồ để đặt ghim. Nhấn Esc để hủy.
          </div>
        )}
        {state.status === 'loading' && <p className="app-message">Đang tải bản đồ…</p>}
        {state.status === 'error' && (
          <div className="app-message" role="alert">
            <p>Không tải được dữ liệu bản đồ.</p>
            <button type="button" onClick={load}>
              Thử lại
            </button>
          </div>
        )}
        <Toast toast={toast} onDismiss={dismissToast} />
      </main>
    </div>
  );
}
