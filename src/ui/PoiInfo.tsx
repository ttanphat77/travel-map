import { Clock, Link, MapPin, MapPinCheck, MapPinPlus, Mountain, Phone } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PlaceFields } from '../domain/store';
import { categoryForPoi } from '../domain/categories';
import type { MarkStatus, Place, PlaceCategory } from '../domain/types';
import { poiTypeLabel, type PoiInfo as Poi } from '../map/poi';
import type { Selection } from '../map/useMap';
import { lookupPlace } from '../services/nominatim';
import { fetchAttractionsAround, fetchFacts, fetchSummary, type Attraction } from '../services/wiki';
import { CategoryChip, CategoryPicker } from './categories';
import StatusSegmented from './StatusSegmented';
import { AttractionList, Details, HeroImage, Intro, Skeleton, SourceNote, formatNumber } from './WikiBlocks';
import { useRemote, type Remote } from './useRemote';

interface Props {
  poi: Poi;
  places: readonly Place[];
  addPlace: (fields: PlaceFields) => string;
  onSelect: (selection: Selection | null) => void;
  onPickAttraction: (attraction: Attraction) => void;
}

/** Bán kính tìm điểm nổi bật quanh địa điểm. */
const NEARBY_KM = 2;
/** Ghim cách địa điểm không quá khoảng cách này và cùng tên thì coi là đã ghim nơi này. */
const SAME_PLACE_METERS = 150;

const ready = <T,>(remote: Remote<T> | null): T | undefined => (remote?.status === 'ready' ? remote.data : undefined);

/** Khoảng cách gần đúng giữa hai tọa độ, tính bằng mét. Đủ chính xác cho khoảng cách ngắn. */
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = Math.PI / 180;
  const x = (b.lng - a.lng) * radians * Math.cos(((a.lat + b.lat) / 2) * radians);
  const y = (b.lat - a.lat) * radians;
  return Math.hypot(x, y) * 6_371_000;
}

function websiteLink(url: string | undefined) {
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

/** Thông tin và thao tác của một địa điểm trên bản đồ nền, ví dụ một ngôi chùa hay một thành phố. */
export default function PoiInfo({ poi, places, addPlace, onSelect, onPickAttraction }: Props) {
  // Loại ghim được chọn sẵn theo loại địa điểm. Người dùng đổi được trước khi lưu.
  const [category, setCategory] = useState<PlaceCategory | undefined>(() => categoryForPoi(poi.type, poi.poiClass));
  const [pickingCategory, setPickingCategory] = useState(false);

  const key = `${poi.lat.toFixed(5)},${poi.lng.toFixed(5)}`;
  // Thành phố, làng hay mặt nước là địa danh lớn. Các nhãn còn lại là địa điểm nhỏ như quán hay chùa.
  const isArea = poi.group === 'place' || poi.group === 'water_name';
  const details = useRemote(`lookup:${poi.group}:${key}`, (signal) => lookupPlace(poi.lat, poi.lng, isArea ? 'area' : 'poi', signal));
  const info = ready(details);
  const qid = info?.wikidata;
  const facts = useRemote(qid ? `facts:${qid}` : null, (signal) => fetchFacts(qid ?? '', signal));
  // Tên bài Wikipedia lấy theo thứ tự: từ Wikidata, từ thẻ wikipedia của OpenStreetMap, rồi tên địa danh lớn.
  const title = ((): string | null => {
    if (!info) return null;
    if (qid) return facts?.status === 'ready' ? (facts.data.articleTitle ?? null) : null;
    return info.wikipediaVi ?? (isArea ? poi.name : null);
  })();
  const summary = useRemote(title ? `summary:${title}` : null, (signal) => fetchSummary(title ?? '', signal));
  const nearby = useRemote(`around:${poi.lat.toFixed(4)},${poi.lng.toFixed(4)}:${NEARBY_KM}`, async (signal) =>
    (await fetchAttractionsAround(poi.lat, poi.lng, NEARBY_KM, signal)).filter((a) => a.name !== poi.name),
  );
  // Trong lúc chưa biết có bài Wikipedia hay không, ảnh và giới thiệu hiện ở trạng thái đang tải.
  const summaryRemote: Remote<Awaited<ReturnType<typeof fetchSummary>>> | null =
    summary ?? (details?.status === 'loading' || facts?.status === 'loading' ? { status: 'loading' } : null);

  const existing = useMemo(
    () => places.find((p) => p.name === poi.name && distanceMeters(p, poi) <= SAME_PLACE_METERS),
    [places, poi],
  );

  const save = (status: MarkStatus) =>
    onSelect({ kind: 'place', id: addPlace({ name: poi.name, lat: poi.lat, lng: poi.lng, status, category }) });

  return (
    <>
      <HeroImage remote={summaryRemote} />
      <div className="info-head">
        <h2 className="info-title">{poi.name}</h2>
        <p className="info-subtitle">
          {poiTypeLabel(poi)}
          {ready(summaryRemote)?.description ? ` · ${ready(summaryRemote)?.description}` : ''}
        </p>
      </div>
      <div className="info-body">
        {existing ? (
          <section className="section">
            <p className="info-text">
              <MapPinCheck size={14} aria-hidden="true" /> Bạn đã ghim nơi này.
            </p>
            <div className="info-actions">
              <button type="button" className="button button-small" onClick={() => onSelect({ kind: 'place', id: existing.id })}>
                Xem ghim của bạn
              </button>
            </div>
          </section>
        ) : (
          <section className="section">
            <p className="category-line">
              {category ? (
                <>
                  Lưu với loại <CategoryChip category={category} />
                </>
              ) : (
                'Chưa chọn loại ghim.'
              )}
              <button
                type="button"
                className="link-button"
                aria-expanded={pickingCategory}
                onClick={() => setPickingCategory((open) => !open)}
              >
                {pickingCategory ? 'Đóng' : category ? 'Đổi loại' : 'Chọn loại'}
              </button>
            </p>
            {pickingCategory && (
              <CategoryPicker
                value={category}
                onChange={(next) => {
                  setCategory(next);
                  setPickingCategory(false);
                }}
              />
            )}
            <StatusSegmented value={undefined} onChange={save} />
            <p className="section-note">
              Bấm "Đã đến" hoặc "Muốn đến" để lưu nơi này thành ghim.{' '}
              <button
                type="button"
                className="link-button"
                onClick={() =>
                  onSelect({
                    kind: 'placeForm',
                    mode: 'new',
                    lat: poi.lat,
                    lng: poi.lng,
                    name: poi.name,
                    category,
                  })
                }
              >
                <MapPinPlus size={12} aria-hidden="true" /> Thêm kèm ghi chú
              </button>
            </p>
          </section>
        )}

        <Intro remote={summaryRemote} />

        <Details
          title="Thông tin"
          items={[
            {
              icon: MapPin,
              label: 'Địa chỉ',
              value: details?.status === 'loading' ? <Skeleton width="90%" /> : (info?.address ?? (details?.status === 'error' && 'Không tra được địa chỉ.')),
            },
            { icon: Mountain, label: 'Độ cao', value: poi.ele !== undefined && `${formatNumber(poi.ele)} m` },
            { icon: Clock, label: 'Giờ mở cửa', value: info?.openingHours },
            { icon: Phone, label: 'Điện thoại', value: info?.phone },
            { icon: Link, label: 'Website', value: websiteLink(info?.website) },
          ]}
        />

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
