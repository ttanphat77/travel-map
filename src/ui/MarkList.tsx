import { ChevronRight, Flag, Globe, Map as MapIcon } from 'lucide-react';
import { useMemo } from 'react';
import { displayName, getProvince } from '../data/provinces';
import type { RegionKind } from '../domain/store';
import type { Mark, UserData } from '../domain/types';
import { formatMonth } from './format';
import StatusBadge from './StatusBadge';

interface Props {
  userData: UserData;
  countryName: (id: string) => string | undefined;
  onPick: (kind: RegionKind, key: string) => void;
}

interface Row {
  kind: RegionKind;
  key: string;
  name: string;
  /** Tên dùng để sắp xếp. Tên tỉnh không kèm tiền tố "TP." để TP. Hồ Chí Minh nằm ở vần H. */
  sortName: string;
  mark: Mark;
}

const byName = (a: Row, b: Row) => a.sortName.localeCompare(b.sortName, 'vi');

function Group({ title, rows, onPick }: { title: string; rows: Row[]; onPick: Props['onPick'] }) {
  return (
    <section>
      <h3 className="list-group-title">{title}</h3>
      <ul className="list">
        {rows.map((row) => (
          <li key={row.key}>
            <button type="button" className="list-item" onClick={() => onPick(row.kind, row.key)}>
              <span className={`list-item-icon is-${row.mark.status}`}>
                {row.kind === 'province' ? <MapIcon size={18} aria-hidden="true" /> : <Flag size={18} aria-hidden="true" />}
              </span>
              <span className="list-item-body">
                <span className="list-item-title">{row.name}</span>
                {row.mark.date && <span className="list-item-meta">Tháng {formatMonth(row.mark.date)}</span>}
              </span>
              <StatusBadge status={row.mark.status} />
              <ChevronRight size={16} className="list-item-end" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Danh sách tỉnh và quốc gia đã đánh dấu, mỗi nhóm xếp theo tên từ A đến Z. */
export default function MarkList({ userData, countryName, onPick }: Props) {
  const provinces = useMemo(
    () =>
      Object.entries(userData.provinces)
        .map(([key, mark]): Row => {
          const province = getProvince(key);
          return {
            kind: 'province',
            key,
            name: province ? displayName(province) : key,
            sortName: province?.name ?? key,
            mark,
          };
        })
        .sort(byName),
    [userData.provinces],
  );
  const countries = useMemo(
    () =>
      Object.entries(userData.countries)
        .map(([key, mark]): Row => {
          const name = countryName(key) ?? key;
          return { kind: 'country', key, name, sortName: name, mark };
        })
        .sort(byName),
    [userData.countries, countryName],
  );

  if (provinces.length === 0 && countries.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <Globe size={22} aria-hidden="true" />
        </span>
        <p className="empty-state-title">Chưa đánh dấu vùng nào</p>
        <p>Bấm vào một quốc gia hoặc tỉnh trên bản đồ, rồi chọn "Đã đến" hoặc "Muốn đến".</p>
      </div>
    );
  }

  return (
    <>
      {provinces.length > 0 && <Group title={`Tỉnh Việt Nam · ${provinces.length}/34`} rows={provinces} onPick={onPick} />}
      {countries.length > 0 && <Group title={`Quốc gia · ${countries.length}`} rows={countries} onPick={onPick} />}
    </>
  );
}
