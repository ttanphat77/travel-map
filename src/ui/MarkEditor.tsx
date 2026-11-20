import { useId } from 'react';
import { NOTE_MAX_LENGTH, STATUS_LABELS, type Mark, type MarkStatus } from '../domain/types';

export interface MarkEditorProps {
  mark: Mark | undefined;
  onSetStatus: (status: MarkStatus) => void;
  onClear: () => void;
  onDetails: (details: { date?: string; note?: string }) => void;
}

const STATUSES: MarkStatus[] = ['visited', 'wishlist'];

/**
 * Hai nút trạng thái, ô ngày đến và ô ghi chú.
 * Bấm lại nút đang chọn thì bỏ đánh dấu.
 * Ô ngày đến và ô ghi chú chỉ hiện khi vùng đã có trạng thái.
 */
export default function MarkEditor({ mark, onSetStatus, onClear, onDetails }: MarkEditorProps) {
  const dateId = useId();
  const noteId = useId();
  return (
    <div className="mark-editor">
      <div className="status-buttons" role="group" aria-label="Trạng thái">
        {STATUSES.map((status) => {
          const active = mark?.status === status;
          return (
            <button
              key={status}
              type="button"
              className={`status-button status-${status}${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => (active ? onClear() : onSetStatus(status))}
            >
              {STATUS_LABELS[status]}
            </button>
          );
        })}
      </div>
      {mark && (
        <>
          <label className="field-label" htmlFor={dateId}>
            Ngày đến
          </label>
          <input
            id={dateId}
            className="field-input"
            type="month"
            value={mark.date ?? ''}
            onChange={(e) => onDetails({ date: e.target.value })}
          />
          <label className="field-label" htmlFor={noteId}>
            Ghi chú
          </label>
          <textarea
            id={noteId}
            className="field-input"
            rows={2}
            maxLength={NOTE_MAX_LENGTH}
            placeholder="Thêm ghi chú"
            value={mark.note ?? ''}
            onChange={(e) => onDetails({ note: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
