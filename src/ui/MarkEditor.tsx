import { Calendar, StickyNote } from 'lucide-react';
import { useId } from 'react';
import { NOTE_MAX_LENGTH, type Mark, type MarkStatus } from '../domain/types';
import StatusSegmented from './StatusSegmented';

export interface MarkEditorProps {
  mark: Mark | undefined;
  onSetStatus: (status: MarkStatus) => void;
  onClear: () => void;
  onDetails: (details: { date?: string; note?: string }) => void;
}

/**
 * Nút trạng thái, ô tháng đến và ô ghi chú của một vùng.
 * Bấm lại nút đang chọn thì bỏ đánh dấu.
 * Ô tháng đến và ô ghi chú chỉ hiện khi vùng đã có trạng thái.
 */
export default function MarkEditor({ mark, onSetStatus, onClear, onDetails }: MarkEditorProps) {
  const dateId = useId();
  const noteId = useId();
  return (
    <div className="field-row">
      <StatusSegmented value={mark?.status} onChange={onSetStatus} onClear={onClear} />
      {mark && (
        <>
          <div className="field">
            <label className="field-label" htmlFor={dateId}>
              <Calendar size={14} aria-hidden="true" />
              Tháng đến
            </label>
            <input
              id={dateId}
              className="input"
              type="month"
              value={mark.date ?? ''}
              onChange={(e) => onDetails({ date: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor={noteId}>
              <StickyNote size={14} aria-hidden="true" />
              Ghi chú
            </label>
            <textarea
              id={noteId}
              className="input"
              rows={3}
              maxLength={NOTE_MAX_LENGTH}
              placeholder="Đi cùng ai, ăn gì ngon, nhớ điều gì…"
              value={mark.note ?? ''}
              onChange={(e) => onDetails({ note: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
