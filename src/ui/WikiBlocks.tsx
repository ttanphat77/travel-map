import {
  Castle,
  Church,
  Droplets,
  ExternalLink,
  FerrisWheel,
  Landmark,
  MapPin,
  MapPinPlus,
  Mountain,
  MountainSnow,
  PawPrint,
  Store,
  TowerControl,
  TreePalm,
  Trees,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Attraction, AttractionCategory, WikiSummary } from '../services/wiki';
import type { Remote } from './useRemote';

/** Định dạng số theo kiểu Việt Nam, ví dụ 11.860. */
export const formatNumber = (value: number) => Math.round(value).toLocaleString('vi-VN');

/** Viết số dân ngắn gọn để vừa ô số liệu, ví dụ 3,3 triệu. */
export function formatPopulation(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ`;
  if (value >= 1e6) return `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;
  return formatNumber(value);
}

const ready = <T,>(remote: Remote<T> | null): T | undefined => (remote?.status === 'ready' ? remote.data : undefined);

export function Skeleton({ width = '100%', height = 12 }: { width?: number | string; height?: number }) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}

/**
 * Ảnh lớn ở đầu trang, lấy từ bài Wikipedia. Khi đang tải, ảnh là khung xám nhấp nháy.
 * Bài về quốc gia thường lấy lá cờ làm ảnh đại diện. Lá cờ đã hiện cạnh tên nước, nên app không hiện ảnh đó lần nữa.
 */
export function HeroImage({ remote }: { remote: Remote<WikiSummary | null> | null }) {
  if (remote?.status === 'loading') return <span className="skeleton info-hero is-skeleton" aria-hidden="true" />;
  const summary = ready(remote);
  if (!summary?.image || /Flag_of/i.test(summary.image)) return null;
  return <img className="info-hero" src={summary.image} alt={summary.title} />;
}

/** Đoạn giới thiệu từ Wikipedia. Đoạn dài được rút gọn, bấm "Xem thêm" để mở hết. */
export function Intro({ remote }: { remote: Remote<WikiSummary | null> | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!remote) return null;
  if (remote.status === 'loading') {
    return (
      <div aria-label="Đang tải giới thiệu">
        <Skeleton />
        <Skeleton />
        <Skeleton width="70%" />
      </div>
    );
  }
  if (remote.status === 'error') return <p className="info-text muted">Không tải được giới thiệu từ Wikipedia.</p>;
  const summary = remote.data;
  if (!summary) return null;
  return (
    <section className="section">
      <p className={`info-extract${expanded ? ' is-expanded' : ''}`}>{summary.extract}</p>
      <p className="section-note">
        {!expanded && summary.extract.length > 280 && (
          <>
            <button type="button" className="link-button" onClick={() => setExpanded(true)}>
              Xem thêm
            </button>
            {' · '}
          </>
        )}
        <a href={summary.url} target="_blank" rel="noopener noreferrer">
          Đọc trên Wikipedia
        </a>
      </p>
    </section>
  );
}

export interface StatItem {
  label: string;
  value: string | undefined;
}

/** Ba ô số liệu chính. Ô chưa có dữ liệu hiện khung xám khi đang tải, hoặc dấu gạch khi không có. */
export function Stats({ items, loading }: { items: StatItem[]; loading: boolean }) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <span className="stat-label">{item.label}</span>
          {item.value ? (
            <span className="stat-value" title={item.value}>
              {item.value}
            </span>
          ) : loading ? (
            <Skeleton height={16} width="80%" />
          ) : (
            <span className="stat-value muted">—</span>
          )}
        </div>
      ))}
    </div>
  );
}

export interface DetailItem {
  icon: LucideIcon;
  label: string;
  value: ReactNode | undefined | null | false;
}

/** Nhóm thông tin có tiêu đề. Dòng không có giá trị thì không hiện. Nhóm không có dòng nào thì ẩn. */
export function Details({ title, items, note }: { title: string; items: DetailItem[]; note?: string }) {
  const visible = items.filter((item) => item.value !== undefined && item.value !== null && item.value !== false && item.value !== '');
  if (visible.length === 0 && !note) return null;
  return (
    <section className="section">
      <h3 className="section-title">{title}</h3>
      <dl className="details">
        {visible.map(({ icon: Icon, label, value }) => (
          <div key={label} className="detail">
            <Icon size={16} className="detail-icon" aria-hidden="true" />
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="section-note">{note}</p>}
    </section>
  );
}

const CATEGORY_ICONS: Record<AttractionCategory, LucideIcon> = {
  attraction: MapPin,
  heritage: Landmark,
  museum: Landmark,
  beach: Waves,
  religious: Church,
  park: Trees,
  mountain: Mountain,
  water: Droplets,
  island: TreePalm,
  cave: MountainSnow,
  market: Store,
  monument: Landmark,
  castle: Castle,
  zoo: PawPrint,
  fun: FerrisWheel,
  tower: TowerControl,
};

interface AttractionListProps {
  title: string;
  remote: Remote<Attraction[]> | null;
  emptyText: string;
  /** Bấm một địa điểm thì bản đồ bay tới đó và mở form thêm ghim. */
  onPick: (attraction: Attraction) => void;
}

/** Danh sách điểm đến lấy từ Wikidata, xếp theo độ nổi tiếng. */
export function AttractionList({ title, remote, emptyText, onPick }: AttractionListProps) {
  if (!remote) return null;
  return (
    <section className="section">
      <h3 className="section-title">{title}</h3>
      {remote.status === 'loading' && (
        <div aria-label="Đang tìm điểm đến">
          {[0, 1, 2].map((i) => (
            <div key={i} className="list-item" aria-hidden="true">
              <Skeleton width={34} height={34} />
              <div className="list-item-body">
                <Skeleton width="70%" />
                <Skeleton width="40%" height={10} />
              </div>
            </div>
          ))}
        </div>
      )}
      {remote.status === 'error' && <p className="info-text muted">Không tải được danh sách. Thử lại sau.</p>}
      {remote.status === 'ready' && remote.data.length === 0 && <p className="info-text muted">{emptyText}</p>}
      {remote.status === 'ready' && remote.data.length > 0 && (
        <ul className="list">
          {remote.data.map((attraction) => {
            const Icon = CATEGORY_ICONS[attraction.category];
            return (
              <li key={attraction.id} className="attraction">
                <button
                  type="button"
                  className="list-item"
                  title="Xem trên bản đồ và thêm ghim"
                  onClick={() => onPick(attraction)}
                >
                  <span className="list-item-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="list-item-body">
                    <span className="list-item-title">{attraction.name}</span>
                    {attraction.description && <span className="list-item-meta">{attraction.description}</span>}
                  </span>
                  <MapPinPlus size={18} className="list-item-end" aria-label="Thêm ghim" />
                </button>
                {attraction.article && (
                  <a
                    className="attraction-link"
                    href={attraction.article}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Bài Wikipedia về ${attraction.name}`}
                    title="Mở bài Wikipedia"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Dòng ghi nguồn, theo yêu cầu giấy phép của Wikipedia, Wikidata và OpenStreetMap. */
export function SourceNote({ address = false }: { address?: boolean }) {
  return (
    <p className="source-note">
      Nguồn:{' '}
      <a href="https://vi.wikipedia.org" target="_blank" rel="noopener noreferrer">
        Wikipedia
      </a>{' '}
      (CC BY-SA),{' '}
      <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer">
        Wikidata
      </a>{' '}
      (CC0)
      {address && (
        <>
          ,{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>{' '}
          (ODbL)
        </>
      )}
      . Số liệu có thể chưa cập nhật.
    </p>
  );
}
