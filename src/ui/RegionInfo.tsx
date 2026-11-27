import {
  Banknote,
  Car,
  ChevronRight,
  Clock,
  Globe,
  History,
  Landmark,
  Languages,
  Link,
  Map as MapIcon,
  MapPin,
  Mountain,
  Phone,
  Signpost,
  ZoomIn,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { displayName, getProvince } from '../data/provinces';
import type { RegionKind } from '../domain/store';
import { VIETNAM_ID, type Mark, type Place, type PlaceRegion, type UserData } from '../domain/types';
import { summarizeVietnam } from '../domain/vietnam';
import type { ProvinceGeo } from '../map/mapData';
import type { Selection } from '../map/useMap';
import {
  fetchAttractionsInProvince,
  fetchFacts,
  fetchSummary,
  fetchWorldHeritage,
  type Attraction,
  type EntityFacts,
} from '../services/wiki';
import type { MarkActions } from './actions';
import { formatDay, formatMonth } from './format';
import MarkEditor from './MarkEditor';
import StatusBadge from './StatusBadge';
import { AttractionList, Details, HeroImage, Intro, SourceNote, Stats, formatNumber, formatPopulation } from './WikiBlocks';
import { useRemote, type Remote } from './useRemote';

export type RegionSelection = Extract<Selection, { kind: 'country' | 'vietnam' | 'province' }>;

interface Props {
  selection: RegionSelection;
  userData: UserData;
  actions: MarkActions;
  provinceGeo: Record<string, ProvinceGeo>;
  countryWikidata: (id: string) => string | undefined;
  onZoomToVietnam: () => void;
  onPickPlace: (place: Place) => void;
  onPickRegion: (kind: RegionKind, key: string) => void;
  onPickAttraction: (attraction: Attraction) => void;
}

/** Tên bài Wikipedia khác với tên tỉnh. Các tỉnh còn lại dùng đúng tên tỉnh. */
const WIKI_TITLES: Record<string, string> = { '79': 'Thành phố Hồ Chí Minh' };

/** Ghim có nằm trong vùng đang chọn không. Ghim ở Việt Nam thuộc cả tỉnh lẫn Việt Nam. */
function isInRegion(selection: RegionSelection, region: PlaceRegion | undefined): boolean {
  switch (selection.kind) {
    case 'province':
      return region?.provinceCode === selection.code;
    case 'country':
      return region?.countryId === selection.id;
    case 'vietnam':
      return region?.countryId === VIETNAM_ID;
  }
}

const ready = <T,>(remote: Remote<T> | null): T | undefined => (remote?.status === 'ready' ? remote.data : undefined);

function factsNote(remote: Remote<EntityFacts> | null, ok?: string): string | undefined {
  if (remote?.status === 'error') return 'Không tải được số liệu từ Wikidata.';
  return ok;
}

const areaText = (f: EntityFacts | undefined) => (f?.areaKm2 ? `${formatNumber(f.areaKm2)} km²` : undefined);
/** Ô dân số. Năm của số liệu nằm ở nhãn để giá trị ngắn gọn, ví dụ "Dân số 2024" và "3,3 triệu". */
const populationStat = (f: EntityFacts | undefined) => ({
  label: f?.population?.year ? `Dân số ${f.population.year}` : 'Dân số',
  value: f?.population ? formatPopulation(f.population.value) : undefined,
});

function websiteLink(url: string | undefined): ReactNode {
  if (!url) return undefined;
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Giữ nguyên địa chỉ nếu không đọc được.
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {host}
    </a>
  );
}

function Head({ title, subtitle, flag }: { title: string; subtitle?: string; flag?: string }) {
  return (
    <div className="info-head">
      <h2 className="info-title">
        {flag && <img className="info-flag" src={flag} alt="" />}
        {title}
      </h2>
      {subtitle && <p className="info-subtitle">{subtitle}</p>}
    </div>
  );
}

/** Nút trạng thái, tháng đến và ghi chú của vùng. */
function MarkSection({ kind, regionKey, name, mark, actions }: {
  kind: RegionKind;
  regionKey: string;
  name: string;
  mark: Mark | undefined;
  actions: MarkActions;
}) {
  return (
    <section className="section">
      <MarkEditor
        mark={mark}
        onSetStatus={(status) => actions.setStatus(kind, regionKey, status)}
        onClear={() => actions.clear(kind, regionKey, name)}
        onDetails={(details) => actions.updateDetails(kind, regionKey, details)}
      />
      {mark && <p className="section-note">Cập nhật ngày {formatDay(mark.updatedAt)}</p>}
    </section>
  );
}

/** Các ghim của người dùng nằm trong vùng. */
function YourPlaces({ title, places, onPickPlace }: { title: string; places: Place[]; onPickPlace: (place: Place) => void }) {
  return (
    <section className="section">
      <h3 className="section-title">
        <MapPin size={14} aria-hidden="true" />
        {title} · {places.length}
      </h3>
      {places.length === 0 ? (
        <p className="info-text muted">Chưa có ghim nào ở đây.</p>
      ) : (
        <ul className="list">
          {places.map((place) => (
            <li key={place.id}>
              <button type="button" className="list-item" onClick={() => onPickPlace(place)}>
                <span className={`list-item-icon is-${place.status}`}>
                  <MapPin size={18} aria-hidden="true" />
                </span>
                <span className="list-item-body">
                  <span className="list-item-title">{place.name}</span>
                  {place.date && <span className="list-item-meta">Tháng {formatMonth(place.date)}</span>}
                </span>
                <ChevronRight size={16} className="list-item-end" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface ProvinceViewProps extends Omit<Props, 'selection' | 'countryWikidata' | 'provinceGeo' | 'onZoomToVietnam'> {
  code: string;
  geo: ProvinceGeo | undefined;
  places: Place[];
}

function ProvinceView({ code, geo, places, userData, actions, onPickPlace, onPickRegion, onPickAttraction }: ProvinceViewProps) {
  const province = getProvince(code);
  const title = WIKI_TITLES[code] ?? province?.name ?? code;
  const summary = useRemote(`summary:${title}`, (signal) => fetchSummary(title, signal));
  const qid = ready(summary)?.wikidataId;
  const facts = useRemote(qid ? `facts:${qid}` : null, (signal) => fetchFacts(qid ?? '', signal));
  // Mục Wikidata của tỉnh lấy từ bài Wikipedia, nên danh sách điểm đến chờ bài viết tải xong.
  const attractions = useRemote(qid ? `province-attractions:${qid}` : null, async (signal) =>
    (await fetchAttractionsInProvince(qid ?? '', signal)).slice(0, 8),
  );
  if (!province) return null;

  const name = displayName(province);
  const kindLabel = province.kind === 'thanh-pho' ? 'Thành phố trực thuộc trung ương' : 'Tỉnh';
  const f = ready(facts);
  const factsLoading = summary?.status === 'loading' || facts?.status === 'loading';
  const neighbors = (geo?.neighbors ?? [])
    .map((c) => getProvince(c))
    .filter((p) => p !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  return (
    <>
      <HeroImage remote={summary} />
      <Head title={name} subtitle={ready(summary)?.description ?? kindLabel} />
      <div className="info-body">
        <MarkSection kind="province" regionKey={code} name={name} mark={userData.provinces[code]} actions={actions} />
        <Stats
          loading={factsLoading}
          items={[
            { label: 'Diện tích', value: areaText(f) },
            populationStat(f),
            { label: 'Giáp với', value: neighbors.length > 0 ? `${neighbors.length} tỉnh` : undefined },
          ]}
        />
        <Intro remote={summary} />
        <Details
          title="Địa lý và hành chính"
          items={[
            { icon: Landmark, label: 'Loại', value: kindLabel },
            {
              icon: Signpost,
              label: 'Giáp với',
              value:
                neighbors.length > 0 &&
                neighbors.map((p, i) => (
                  <span key={p.code}>
                    <button type="button" className="link-button" onClick={() => onPickRegion('province', p.code)}>
                      {displayName(p)}
                    </button>
                    {i < neighbors.length - 1 && ', '}
                  </span>
                )),
            },
            { icon: Mountain, label: 'Điểm cao nhất', value: f?.highestPoint },
            {
              icon: History,
              label: 'Gộp từ',
              value:
                province.oldProvinces.length > 1
                  ? province.oldProvinces.map((old) => displayName(old)).join(', ')
                  : 'Không sáp nhập với tỉnh khác',
            },
          ]}
          note={factsNote(facts, 'Diện tích và dân số lấy từ Wikidata, có thể chưa theo ranh giới sau sáp nhập năm 2025.')}
        />
        <Details
          title="Thông tin hữu ích"
          items={[
            { icon: Phone, label: 'Mã vùng', value: f?.phoneCode },
            { icon: Car, label: 'Biển số xe', value: f?.plate },
            { icon: Link, label: 'Website', value: websiteLink(f?.website) },
          ]}
        />
        <AttractionList
          title="Điểm đến nổi bật"
          remote={attractions}
          emptyText="Chưa tìm thấy điểm đến nào trên Wikidata."
          onPick={onPickAttraction}
        />
        <YourPlaces title={`Ghim ở ${name}`} places={places} onPickPlace={onPickPlace} />
        <SourceNote />
      </div>
    </>
  );
}

interface CountryViewProps extends Pick<Props, 'onPickPlace' | 'onPickAttraction'> {
  name: string;
  wikidata: string | undefined;
  /**
   * Phần thao tác đặt ngay dưới tên nước. Quốc gia thường có nút đánh dấu.
   * Việt Nam có nút phóng to, vì trạng thái của Việt Nam được tính từ 34 tỉnh.
   */
  controls: ReactNode;
  places: Place[];
  /** Phần riêng chèn trước danh sách ghim, ví dụ tiến độ 34 tỉnh của Việt Nam. */
  extra?: ReactNode;
}

function CountryView({ name, wikidata, controls, places, extra, onPickPlace, onPickAttraction }: CountryViewProps) {
  const facts = useRemote(wikidata ? `facts:${wikidata}` : null, (signal) => fetchFacts(wikidata ?? '', signal));
  const f = ready(facts);
  // Tên bài Wikipedia lấy từ Wikidata để tránh nhầm với bài trùng tên.
  const title = wikidata ? (facts?.status === 'ready' ? (f?.articleTitle ?? name) : null) : name;
  const summary = useRemote(title ? `summary:${title}` : null, (signal) => fetchSummary(title ?? '', signal));
  const heritage = useRemote(wikidata ? `heritage:${wikidata}` : null, (signal) => fetchWorldHeritage(wikidata ?? '', signal));
  // Khi chưa biết tên bài, phần giới thiệu vẫn đang chờ số liệu nên coi như đang tải.
  const summaryRemote: Remote<Awaited<ReturnType<typeof fetchSummary>>> | null =
    summary ?? (facts?.status === 'loading' ? { status: 'loading' } : null);

  return (
    <>
      <HeroImage remote={summaryRemote} />
      <Head title={name} subtitle={ready(summaryRemote)?.description} flag={f?.flag} />
      <div className="info-body">
        {controls}
        <Stats
          loading={facts?.status === 'loading'}
          items={[
            { label: 'Thủ đô', value: f?.capital?.name },
            { label: 'Diện tích', value: areaText(f) },
            populationStat(f),
          ]}
        />
        <Intro remote={summaryRemote} />
        <Details
          title="Địa lý"
          items={[
            { icon: Globe, label: 'Châu lục', value: f?.continents.join(', ') },
            { icon: Signpost, label: 'Giáp với', value: f?.borders.join(', ') },
            { icon: Mountain, label: 'Điểm cao nhất', value: f?.highestPoint },
          ]}
          note={factsNote(facts)}
        />
        <Details
          title="Thông tin du lịch"
          items={[
            { icon: Languages, label: 'Ngôn ngữ', value: f?.languages.join(', ') },
            { icon: Banknote, label: 'Tiền tệ', value: f?.currencies.join(', ') },
            { icon: Clock, label: 'Múi giờ', value: f?.timezone },
            { icon: Phone, label: 'Mã điện thoại', value: f?.callingCode },
            { icon: Car, label: 'Lái xe', value: f?.drivingSide && `Bên ${f.drivingSide}` },
          ]}
        />
        <AttractionList
          title="Di sản thế giới UNESCO"
          remote={heritage}
          emptyText="Quốc gia này chưa có di sản thế giới trên Wikidata."
          onPick={onPickAttraction}
        />
        {extra}
        <YourPlaces title={`Ghim ở ${name}`} places={places} onPickPlace={onPickPlace} />
        <SourceNote />
      </div>
    </>
  );
}

/** Tiến độ 34 tỉnh và danh sách tỉnh đã đánh dấu, chỉ có ở trang Việt Nam. */
function VietnamProgress({ userData, onPickRegion }: { userData: UserData; onPickRegion: Props['onPickRegion'] }) {
  const summary = summarizeVietnam(userData.provinces);
  const marked = Object.entries(userData.provinces)
    .map(([code, mark]) => ({ code, mark, province: getProvince(code) }))
    .filter((row) => row.province !== undefined)
    .sort((a, b) => (a.province?.name ?? '').localeCompare(b.province?.name ?? '', 'vi'));
  return (
    <section className="section">
      <h3 className="section-title">
        <MapIcon size={14} aria-hidden="true" />
        Hành trình của bạn · đã đến {summary.visited}/{summary.total} tỉnh, muốn đến {summary.wishlist} tỉnh
      </h3>
      {marked.length === 0 ? (
        <p className="info-text muted">Phóng to Việt Nam rồi bấm vào một tỉnh để đánh dấu.</p>
      ) : (
        <ul className="list">
          {marked.map(({ code, mark, province }) => (
            <li key={code}>
              <button type="button" className="list-item" onClick={() => onPickRegion('province', code)}>
                <span className={`list-item-icon is-${mark.status}`}>
                  <MapIcon size={18} aria-hidden="true" />
                </span>
                <span className="list-item-body">
                  <span className="list-item-title">{province ? displayName(province) : code}</span>
                  {mark.date && <span className="list-item-meta">Tháng {formatMonth(mark.date)}</span>}
                </span>
                <StatusBadge status={mark.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Thông tin và thao tác của tỉnh, quốc gia, hoặc Việt Nam đang được chọn, hiện ở khung bên trái. */
export default function RegionInfo(props: Props) {
  const {
    selection,
    userData,
    actions,
    provinceGeo,
    countryWikidata,
    onZoomToVietnam,
    onPickPlace,
    onPickRegion,
    onPickAttraction,
  } = props;
  const places = useMemo(
    () => userData.places.filter((place) => isInRegion(selection, place.region)),
    [userData.places, selection],
  );

  if (selection.kind === 'province') {
    return (
      <ProvinceView
        key={selection.code}
        code={selection.code}
        geo={provinceGeo[selection.code]}
        places={places}
        userData={userData}
        actions={actions}
        onPickPlace={onPickPlace}
        onPickRegion={onPickRegion}
        onPickAttraction={onPickAttraction}
      />
    );
  }

  if (selection.kind === 'country') {
    return (
      <CountryView
        key={selection.id}
        name={selection.name}
        wikidata={countryWikidata(selection.id)}
        controls={
          <MarkSection
            kind="country"
            regionKey={selection.id}
            name={selection.name}
            mark={userData.countries[selection.id]}
            actions={actions}
          />
        }
        places={places}
        onPickPlace={onPickPlace}
        onPickAttraction={onPickAttraction}
      />
    );
  }

  return (
    <CountryView
      key={VIETNAM_ID}
      name="Việt Nam"
      wikidata={countryWikidata(VIETNAM_ID)}
      controls={
        <div className="info-actions">
          <button type="button" className="button button-primary" onClick={onZoomToVietnam}>
            <ZoomIn size={16} aria-hidden="true" />
            Phóng to xem 34 tỉnh
          </button>
        </div>
      }
      places={places}
      extra={<VietnamProgress userData={userData} onPickRegion={onPickRegion} />}
      onPickPlace={onPickPlace}
      onPickAttraction={onPickAttraction}
    />
  );
}
