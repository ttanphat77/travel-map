import { displayName, getProvince } from '../data/provinces';
import type { RegionKind } from '../domain/store';
import type { MarkStatus, UserData } from '../domain/types';
import { summarizeVietnam } from '../domain/vietnam';
import type { Selection } from '../map/useLeafletMap';
import MarkEditor from './MarkEditor';

export interface MarkActions {
  setStatus: (kind: RegionKind, key: string, status: MarkStatus) => void;
  clear: (kind: RegionKind, key: string, name: string) => void;
  updateDetails: (kind: RegionKind, key: string, details: { date?: string; note?: string }) => void;
}

interface Props {
  selection: Selection;
  userData: UserData;
  actions: MarkActions;
  onZoomToVietnam: () => void;
}

/** Nội dung popup của quốc gia, của Việt Nam ở mức thế giới, hoặc của một tỉnh. */
export default function RegionDetail({ selection, userData, actions, onZoomToVietnam }: Props) {
  if (selection.kind === 'vietnam') {
    const summary = summarizeVietnam(userData.provinces);
    return (
      <div className="region-detail">
        <h2 className="detail-title">Việt Nam</h2>
        <p className="detail-text">
          Đã đến {summary.visited}/{summary.total} tỉnh
        </p>
        {summary.wishlist > 0 && <p className="detail-text">Muốn đến {summary.wishlist} tỉnh</p>}
        <button type="button" className="primary-button" onClick={onZoomToVietnam}>
          Phóng to Việt Nam
        </button>
      </div>
    );
  }

  if (selection.kind === 'country') {
    const key = selection.id;
    return (
      <div className="region-detail">
        <h2 className="detail-title">{selection.name}</h2>
        <MarkEditor
          mark={userData.countries[key]}
          onSetStatus={(status) => actions.setStatus('country', key, status)}
          onClear={() => actions.clear('country', key, selection.name)}
          onDetails={(details) => actions.updateDetails('country', key, details)}
        />
      </div>
    );
  }

  if (selection.kind !== 'province') return null;
  const province = getProvince(selection.code);
  if (!province) return null;
  const name = displayName(province);
  const key = province.code;
  return (
    <div className="region-detail">
      <h2 className="detail-title">{name}</h2>
      <MarkEditor
        mark={userData.provinces[key]}
        onSetStatus={(status) => actions.setStatus('province', key, status)}
        onClear={() => actions.clear('province', key, name)}
        onDetails={(details) => actions.updateDetails('province', key, details)}
      />
      <div className="old-provinces">
        <p className="old-provinces-title">
          {province.oldProvinces.length > 1
            ? `Gồm ${province.oldProvinces.length} tỉnh cũ`
            : 'Không sáp nhập với tỉnh khác'}
        </p>
        {province.oldProvinces.length > 1 && (
          <ul className="old-provinces-list">
            {province.oldProvinces.map((old) => (
              <li key={old.oldCode}>{displayName(old)}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
