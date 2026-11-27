import { Crosshair, Flag, House, Map as MapIcon, MapPin, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { displayName, getProvince } from '../data/provinces';
import type { RegionKind } from '../domain/store';
import type { Place, PlaceCategory, UserData } from '../domain/types';
import { reverseGeocode } from '../services/nominatim';
import { fetchAttractionsAround, type Attraction } from '../services/wiki';
import { formatDay, formatMonth } from './format';
import { CategoryChip } from './categories';
import StatusBadge from './StatusBadge';
import { AttractionList, Details, Skeleton, SourceNote } from './WikiBlocks';
import { useRemote } from './useRemote';

interface Props {
  place: Place;
  userData: UserData;
  countryName: (id: string) => string | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onPickRegion: (kind: RegionKind, key: string) => void;
  onPickAttraction: (attraction: Attraction) => void;
  /** Bấm vào loại của ghim thì quay về danh sách ghim và lọc theo loại đó. */
  onPickCategory: (category: PlaceCategory) => void;
}

/** Bán kính tìm điểm nổi bật quanh ghim. Bán kính lớn hơn làm truy vấn chậm ở các thành phố đông địa điểm. */
const NEARBY_KM = 3;

/** Thông tin và thao tác của ghim đang được chọn, hiện ở khung bên trái. */
export default function PlaceInfo({
  place,
  userData,
  countryName,
  onEdit,
  onDelete,
  onPickRegion,
  onPickAttraction,
  onPickCategory,
}: Props) {
  const coordKey = `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
  const address = useRemote(`address:${coordKey}`, (signal) => reverseGeocode(place.lat, place.lng, signal));
  const nearby = useRemote(`around:${coordKey}`, (signal) => fetchAttractionsAround(place.lat, place.lng, NEARBY_KM, signal));

  // Nước và tỉnh của ghim đã được tra qua Nominatim. Ghim chưa tra xong thì chưa có `region`.
  const region = place.region;
  const province = region?.provinceCode ? getProvince(region.provinceCode) : undefined;
  const countryId = region?.countryId;
  const country = countryId ? (countryName(countryId) ?? countryId) : undefined;

  return (
    <>
      <div className="info-head">
        <h2 className="info-title">{place.name}</h2>
        <p className="info-subtitle list-item-meta">
          <StatusBadge status={place.status} />
          {place.date && <span>Tháng {formatMonth(place.date)}</span>}
          <span>· Thêm ngày {formatDay(place.createdAt)}</span>
        </p>
        {(place.category || place.hometown) && (
          <p className="info-category">
            {place.hometown && (
              <span className="chip">
                <House size={14} aria-hidden="true" />
                Quê nhà
              </span>
            )}{' '}
            {place.category && <CategoryChip category={place.category} onPick={onPickCategory} />}
          </p>
        )}
      </div>
      <div className="info-body">
        <div className="info-actions">
          <button type="button" className="button button-small" onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" />
            Sửa
          </button>
          <button type="button" className="button button-small button-danger" onClick={onDelete}>
            <Trash2 size={14} aria-hidden="true" />
            Xóa
          </button>
        </div>

        <Details
          title="Vị trí"
          items={[
            {
              icon: MapPin,
              label: 'Địa chỉ',
              value:
                address?.status === 'loading' ? (
                  <Skeleton width="90%" />
                ) : address?.status === 'error' ? (
                  <span className="muted">Không tra được địa chỉ.</span>
                ) : (
                  address?.status === 'ready' && address.data
                ),
            },
            {
              icon: MapIcon,
              label: 'Tỉnh',
              value: province && (
                <>
                  <button type="button" className="link-button" onClick={() => onPickRegion('province', province.code)}>
                    {displayName(province)}
                  </button>{' '}
                  <StatusBadge status={userData.provinces[province.code]?.status} />
                </>
              ),
            },
            {
              icon: Flag,
              label: 'Quốc gia',
              value:
                region === undefined ? (
                  'Chưa xác định vị trí'
                ) : country === undefined ? (
                  'Không thuộc quốc gia nào'
                ) : province ? (
                  country
                ) : (
                  // Việt Nam không đánh dấu trực tiếp, nên chỉ ghim ở nước khác mới hiện trạng thái quốc gia.
                  <>
                    <button type="button" className="link-button" onClick={() => countryId && onPickRegion('country', countryId)}>
                      {country}
                    </button>{' '}
                    <StatusBadge status={countryId ? userData.countries[countryId]?.status : undefined} />
                  </>
                ),
            },
            {
              icon: Crosshair,
              label: 'Tọa độ',
              value: (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                </a>
              ),
            },
          ]}
        />

        <section className="section">
          <h3 className="section-title">
            <StickyNote size={14} aria-hidden="true" />
            Ghi chú của bạn
          </h3>
          {place.note ? <p className="info-text">{place.note}</p> : <p className="info-text muted">Chưa có ghi chú. Bấm "Sửa" để thêm.</p>}
        </section>

        <AttractionList
          title={`Điểm nổi bật trong ${NEARBY_KM} km`}
          remote={nearby}
          emptyText="Không tìm thấy điểm nổi bật nào gần đây trên Wikidata."
          onPick={onPickAttraction}
        />
        <SourceNote address />
      </div>
    </>
  );
}
