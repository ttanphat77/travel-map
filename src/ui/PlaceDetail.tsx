import { displayName, getProvince } from '../data/provinces';
import type { LocateResult } from '../domain/locate';
import { STATUS_LABELS, type Place } from '../domain/types';

interface Props {
  place: Place;
  location: LocateResult;
  countryName: (id: string) => string | undefined;
  onEdit: () => void;
  onDelete: () => void;
}

/** Mô tả vùng chứa ghim. Tên tỉnh cũ được ghi là gần đúng vì ranh giới tỉnh cũ lệch vài km. */
export function describeLocation(location: LocateResult, countryName: (id: string) => string | undefined): string {
  if (location.code) {
    const province = getProvince(location.code);
    if (!province) return 'Việt Nam';
    const old = province.oldProvinces.find((o) => o.oldCode === location.oldCode);
    if (province.oldProvinces.length > 1 && old) {
      return `${displayName(province)} (${displayName(old)} cũ, gần đúng)`;
    }
    return displayName(province);
  }
  if (location.countryId) return countryName(location.countryId) ?? location.countryId;
  return 'Không thuộc quốc gia nào';
}

export default function PlaceDetail({ place, location, countryName, onEdit, onDelete }: Props) {
  return (
    <div className="region-detail">
      <h2 className="detail-title">{place.name}</h2>
      <p className="detail-text">
        <span className={`status-badge status-${place.status}`}>{STATUS_LABELS[place.status]}</span>
        {place.date && <span className="detail-muted"> · {place.date.split('-').reverse().join('/')}</span>}
      </p>
      <p className="detail-text">
        {location.code || location.countryId
          ? `Thuộc ${describeLocation(location, countryName)}`
          : describeLocation(location, countryName)}
      </p>
      {place.note && <p className="detail-text detail-note">{place.note}</p>}
      <div className="form-actions">
        <button type="button" className="status-button" onClick={onDelete}>
          Xóa
        </button>
        <button type="button" className="primary-button" onClick={onEdit}>
          Sửa
        </button>
      </div>
    </div>
  );
}
