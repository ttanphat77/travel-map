import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { countCategories } from '../domain/categories';
import type { ActiveSpecies, LngLatBox, SpeciesHit, SpeciesInfo as Species } from '../domain/species';
import type { PlaceFields, RegionKind } from '../domain/store';
import type { Place, PlaceCategory, UserData } from '../domain/types';
import type { ProvinceGeo } from '../map/mapData';
import type { Selection } from '../map/useMap';
import type { SearchResult } from '../services/nominatim';
import type { Attraction } from '../services/wiki';
import type { Actions } from './actions';
import MarkList from './MarkList';
import PlaceForm from './PlaceForm';
import PlaceInfo from './PlaceInfo';
import PlaceList from './PlaceList';
import PoiInfo from './PoiInfo';
import RegionInfo from './RegionInfo';
import SearchBox from './SearchBox';
import SpeciesInfo, { type SpeciesLayer } from './SpeciesInfo';
import SpeciesSearch, { EMPTY_SPECIES_SEARCH, type SpeciesSearchState } from './SpeciesSearch';

type Tab = 'places' | 'marks' | 'species';

interface Props {
  userData: UserData;
  actions: Actions;
  countryName: (id: string) => string | undefined;
  onPickSearchResult: (result: SearchResult) => void;
  onPickPlace: (place: Place) => void;
  onPickRegion: (kind: RegionKind, key: string) => void;
  onAddPlace: () => void;
  /** Ghim hoặc vùng đang được chọn. Khi có, khung hiện thông tin và thao tác của nó thay cho danh sách. */
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  onZoomToVietnam: () => void;
  provinceGeo: Record<string, ProvinceGeo>;
  countryWikidata: (id: string) => string | undefined;
  /** Bấm một điểm đến gợi ý thì bản đồ bay tới đó và mở form thêm ghim. */
  onPickAttraction: (attraction: Attraction) => void;
  /** Loại đang dùng để lọc danh sách ghim và ghim trên bản đồ. Null là không lọc. */
  categoryFilter: PlaceCategory | null;
  onCategoryFilter: (category: PlaceCategory | null) => void;
  /** Loài đang hiện trên bản đồ. */
  activeSpecies: ActiveSpecies | null;
  /** Bấm một loài trong danh sách thì mở trang loài và bật hai lớp của loài trên bản đồ. */
  onOpenSpecies: (hit: SpeciesHit) => void;
  onSpeciesInfo: (info: Species, requestedId: number) => void;
  onSpeciesObservations: (info: Species, available: boolean) => void;
  onSpeciesLayer: (info: Species, layer: SpeciesLayer, on: boolean) => void;
  onSpeciesBox: (inatId: number, box: LngLatBox) => void;
  onFlyToBox: (box: LngLatBox) => void;
}

/**
 * Khung nổi bên trái.
 * Hàng đầu luôn có ô tìm kiếm. Phần dưới hiện danh sách, thông tin của thứ đang chọn, hoặc form ghim.
 * Khung thu gọn được để bản đồ rộng hơn. Khi người dùng chọn một thứ trên bản đồ, khung tự mở ra.
 */
export default function SidePanel(props: Props) {
  const { userData, actions, countryName, selection, onSelect } = props;
  const [tab, setTab] = useState<Tab>('places');
  const [collapsed, setCollapsed] = useState(false);
  // Ô tìm loài nằm ở đây, để kết quả còn nguyên khi người dùng mở một loài rồi quay lại.
  const [speciesSearch, setSpeciesSearch] = useState<SpeciesSearchState>(EMPTY_SPECIES_SEARCH);

  useEffect(() => {
    if (selection) setCollapsed(false);
    // Từ trang loài quay lại thì về tab "Loài", kể cả khi trang loài được mở từ nút ở góc phải.
    if (selection?.kind === 'species') setTab('species');
  }, [selection]);

  const categoryCounts = useMemo(() => countCategories(userData.places), [userData.places]);
  /** Bấm vào loại của một ghim thì quay về danh sách ghim và lọc theo loại đó. */
  const pickCategory = (category: PlaceCategory | null) => {
    props.onCategoryFilter(category);
    setTab('places');
    onSelect(null);
  };

  let content: ReactNode;
  let back: (() => void) | null = () => onSelect(null);

  const editing =
    selection?.kind === 'placeForm' && selection.mode === 'edit' ? userData.places.find((p) => p.id === selection.id) : undefined;
  const selectedPlace = selection?.kind === 'place' ? userData.places.find((p) => p.id === selection.id) : undefined;

  if (selection?.kind === 'placeForm' && selection.mode === 'new') {
    const initial: PlaceFields = {
      name: selection.name ?? '',
      lat: selection.lat,
      lng: selection.lng,
      status: 'visited',
      category: selection.category,
    };
    content = (
      <PlaceForm
        key={`new-${selection.lat},${selection.lng}`}
        title="Thêm ghim"
        hint="Ghim xám trên bản đồ là vị trí sẽ lưu."
        initial={initial}
        onCancel={() => onSelect(null)}
        onSave={(fields) => onSelect({ kind: 'place', id: actions.addPlace(fields) })}
      />
    );
  } else if (editing) {
    const { name, lat, lng, status, date, note, category, hometown } = editing;
    back = () => onSelect({ kind: 'place', id: editing.id });
    content = (
      <PlaceForm
        key={`edit-${editing.id}`}
        title="Sửa ghim"
        initial={{ name, lat, lng, status, date, note, category, hometown }}
        onCancel={() => onSelect({ kind: 'place', id: editing.id })}
        onSave={(fields) => {
          actions.updatePlace(editing.id, fields);
          onSelect({ kind: 'place', id: editing.id });
        }}
      />
    );
  } else if (selectedPlace) {
    content = (
      <PlaceInfo
        key={selectedPlace.id}
        place={selectedPlace}
        userData={userData}
        countryName={countryName}
        onEdit={() => onSelect({ kind: 'placeForm', mode: 'edit', id: selectedPlace.id })}
        onDelete={() => {
          onSelect(null);
          actions.deletePlace(selectedPlace.id);
        }}
        onPickRegion={props.onPickRegion}
        onPickAttraction={props.onPickAttraction}
        onPickCategory={pickCategory}
      />
    );
  } else if (selection?.kind === 'poi') {
    content = (
      <PoiInfo
        key={`${selection.lat},${selection.lng}`}
        poi={selection}
        places={userData.places}
        addPlace={actions.addPlace}
        onSelect={onSelect}
        onPickAttraction={props.onPickAttraction}
      />
    );
  } else if (selection?.kind === 'species') {
    content = (
      <SpeciesInfo
        inatId={selection.inatId}
        active={props.activeSpecies}
        onInfo={props.onSpeciesInfo}
        onObservations={props.onSpeciesObservations}
        onLayer={props.onSpeciesLayer}
        onBox={props.onSpeciesBox}
        onFlyTo={props.onFlyToBox}
      />
    );
  } else if (selection?.kind === 'country' || selection?.kind === 'province' || selection?.kind === 'vietnam') {
    content = (
      <RegionInfo
        selection={selection}
        userData={userData}
        actions={actions}
        provinceGeo={props.provinceGeo}
        countryWikidata={props.countryWikidata}
        onZoomToVietnam={props.onZoomToVietnam}
        onPickPlace={props.onPickPlace}
        onPickRegion={props.onPickRegion}
        onPickAttraction={props.onPickAttraction}
      />
    );
  } else {
    back = null;
    const markCount = Object.keys(userData.provinces).length + Object.keys(userData.countries).length;
    const tabButton = (value: Tab, label: string, count?: number) => (
      <button
        type="button"
        role="tab"
        id={`panel-tab-${value}`}
        aria-selected={tab === value}
        aria-controls="panel-tabpanel"
        className={`tab${tab === value ? ' is-active' : ''}`}
        onClick={() => setTab(value)}
      >
        {label}
        {count !== undefined && <span className="tab-count">{count}</span>}
      </button>
    );
    content = (
      <>
        <div className="tabs" role="tablist">
          {tabButton('places', 'Địa điểm', userData.places.length)}
          {tabButton('marks', 'Vùng', markCount)}
          {tabButton('species', 'Loài')}
        </div>
        <div role="tabpanel" id="panel-tabpanel" aria-labelledby={`panel-tab-${tab}`}>
          {tab === 'species' ? (
            <SpeciesSearch
              state={speciesSearch}
              onStateChange={setSpeciesSearch}
              onPick={props.onOpenSpecies}
            />
          ) : tab === 'places' ? (
            <PlaceList
              places={userData.places}
              countryName={countryName}
              categoryCounts={categoryCounts}
              categoryFilter={props.categoryFilter}
              onCategoryFilter={props.onCategoryFilter}
              onPick={props.onPickPlace}
              onAdd={props.onAddPlace}
            />
          ) : (
            <MarkList userData={userData} countryName={countryName} onPick={props.onPickRegion} />
          )}
        </div>
      </>
    );
  }

  return (
    <aside className={`panel${collapsed ? ' is-collapsed' : ''}`} aria-label="Thông tin hành trình">
      <div className="panel-header">
        {back && !collapsed && (
          <button type="button" className="icon-button" onClick={back} aria-label="Quay lại" title="Quay lại (Esc)">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        )}
        <SearchBox onPick={props.onPickSearchResult} />
        <button
          type="button"
          className="icon-button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Mở khung' : 'Thu gọn khung'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Mở khung' : 'Thu gọn khung'}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>
      {/* Khóa đổi theo thứ đang chọn, nên khi đổi trang, phần nội dung cuộn về đầu. */}
      {!collapsed && (
        <div className="panel-content" key={selection ? JSON.stringify(selection) : 'list'}>
          {content}
        </div>
      )}
    </aside>
  );
}
