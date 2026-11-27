import { ChevronRight, MapPin, MapPinPlus, X } from 'lucide-react';
import { useMemo } from 'react';
import { displayName, getProvince } from '../data/provinces';
import type { CategoryCount } from '../domain/categories';
import { CATEGORY_LABELS, type Place, type PlaceCategory, type PlaceRegion } from '../domain/types';
import { CATEGORY_ICONS } from './categories';
import { formatMonth } from './format';
import StatusBadge from './StatusBadge';

interface Props {
  places: readonly Place[];
  countryName: (id: string) => string | undefined;
  /** Các loại đang có ghim, kèm số ghim. */
  categoryCounts: CategoryCount[];
  /** Loại đang dùng để lọc. Null là không lọc. */
  categoryFilter: PlaceCategory | null;
  onCategoryFilter: (category: PlaceCategory | null) => void;
  onPick: (place: Place) => void;
  onAdd: () => void;
}

/** Tên tỉnh hoặc quốc gia chứa ghim, viết ngắn để vừa một dòng trong danh sách. */
function regionName(region: PlaceRegion | undefined, countryName: (id: string) => string | undefined): string {
  if (!region) return 'Chưa xác định vị trí';
  if (region.provinceCode) {
    const province = getProvince(region.provinceCode);
    return province ? displayName(province) : 'Việt Nam';
  }
  if (region.countryId) return countryName(region.countryId) ?? region.countryId;
  return 'Không thuộc quốc gia nào';
}

/**
 * Danh sách ghim theo đúng thứ tự đang lưu, ghim mới nhất ở trên.
 * Hàng loại ở đầu danh sách dùng để lọc. Bấm lại loại đang chọn thì bỏ lọc.
 */
export default function PlaceList({
  places,
  countryName,
  categoryCounts,
  categoryFilter,
  onCategoryFilter,
  onPick,
  onAdd,
}: Props) {
  const regions = useMemo(
    () => new Map(places.map((place) => [place.id, regionName(place.region, countryName)])),
    [places, countryName],
  );
  const shown = categoryFilter ? places.filter((place) => place.category === categoryFilter) : places;

  if (places.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <MapPin size={22} aria-hidden="true" />
        </span>
        <p className="empty-state-title">Ghim địa điểm đầu tiên</p>
        <p>Tìm một nơi ở ô phía trên, hoặc bấm chuột phải lên bản đồ.</p>
        <button type="button" className="button button-primary" onClick={onAdd}>
          <MapPinPlus size={16} aria-hidden="true" />
          Thêm ghim
        </button>
      </div>
    );
  }

  return (
    <>
      {categoryCounts.length > 0 && (
        <div className="category-filter" role="group" aria-label="Lọc ghim theo loại">
          {categoryCounts.map(({ category, count }) => {
            const Icon = CATEGORY_ICONS[category];
            const active = category === categoryFilter;
            return (
              <button
                key={category}
                type="button"
                className={`chip chip-button${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => onCategoryFilter(active ? null : category)}
              >
                <Icon size={13} aria-hidden="true" />
                {CATEGORY_LABELS[category]}
                <span className="chip-count">{count}</span>
                {active && <X size={12} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
      {categoryFilter && shown.length === 0 && (
        <p className="info-text muted list-note">Không có ghim nào thuộc loại "{CATEGORY_LABELS[categoryFilter]}".</p>
      )}
      <ul className="list">
        {shown.map((place) => {
          const Icon = place.category ? CATEGORY_ICONS[place.category] : MapPin;
          return (
            <li key={place.id}>
              <button type="button" className="list-item" onClick={() => onPick(place)}>
                <span className={`list-item-icon is-${place.status}`}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="list-item-body">
                  <span className="list-item-title">{place.name}</span>
                  <span className="list-item-meta">
                    <span>{regions.get(place.id)}</span>
                    {place.date && <span>· {formatMonth(place.date)}</span>}
                  </span>
                </span>
                <StatusBadge status={place.status} />
                <ChevronRight size={16} className="list-item-end" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
