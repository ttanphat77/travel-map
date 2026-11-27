import { Check, Star } from 'lucide-react';
import { STATUS_LABELS, type MarkStatus } from '../domain/types';

const OPTIONS: { status: MarkStatus; icon: typeof Check }[] = [
  { status: 'visited', icon: Check },
  { status: 'wishlist', icon: Star },
];

interface Props {
  value: MarkStatus | undefined;
  onChange: (status: MarkStatus) => void;
  /** Có thì bấm lại lựa chọn đang chọn sẽ bỏ chọn. Form ghim không cho bỏ chọn, vì ghim luôn có trạng thái. */
  onClear?: () => void;
}

/** Hai nút "Đã đến" và "Muốn đến" đặt liền nhau. */
export default function StatusSegmented({ value, onChange, onClear }: Props) {
  return (
    <div className="segmented" role="group" aria-label="Trạng thái">
      {OPTIONS.map(({ status, icon: Icon }) => {
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            className={`segmented-option is-${status}${active ? ' is-active' : ''}`}
            aria-pressed={active}
            title={active && onClear ? 'Bấm lần nữa để bỏ đánh dấu' : undefined}
            onClick={() => (active ? onClear?.() : onChange(status))}
          >
            <Icon size={16} aria-hidden="true" />
            {STATUS_LABELS[status]}
          </button>
        );
      })}
    </div>
  );
}
