import { useEffect, useId, useRef, useState } from 'react';
import type { PlaceFields } from '../domain/store';
import { NOTE_MAX_LENGTH, PLACE_NAME_MAX_LENGTH, STATUS_LABELS, type MarkStatus } from '../domain/types';

interface Props {
  title: string;
  initial: PlaceFields;
  onSave: (fields: PlaceFields) => void;
  onCancel: () => void;
}

const STATUSES: MarkStatus[] = ['visited', 'wishlist'];

/** Form thêm hoặc sửa ghim. Tên là bắt buộc. */
export default function PlaceForm({ title, initial, onSave, onCancel }: Props) {
  const [fields, setFields] = useState<PlaceFields>(initial);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const dateId = useId();
  const noteId = useId();
  const errorId = useId();

  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (fields.name.trim() === '') {
      setError('Nhập tên địa điểm');
      nameRef.current?.focus({ preventScroll: true });
      return;
    }
    onSave(fields);
  };

  return (
    <form className="region-detail place-form" onSubmit={submit} noValidate>
      <h2 className="detail-title">{title}</h2>
      <label className="field-label" htmlFor={nameId}>
        Tên địa điểm
      </label>
      <input
        ref={nameRef}
        id={nameId}
        className="field-input"
        type="text"
        maxLength={PLACE_NAME_MAX_LENGTH}
        placeholder="Phố cổ Hội An"
        value={fields.name}
        aria-invalid={error !== ''}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setFields({ ...fields, name: e.target.value });
          if (error) setError('');
        }}
      />
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
      <div className="status-buttons" role="group" aria-label="Trạng thái">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={`status-button status-${status}${fields.status === status ? ' is-active' : ''}`}
            aria-pressed={fields.status === status}
            onClick={() => setFields({ ...fields, status })}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      <label className="field-label" htmlFor={dateId}>
        Ngày đến
      </label>
      <input
        id={dateId}
        className="field-input"
        type="month"
        value={fields.date ?? ''}
        onChange={(e) => setFields({ ...fields, date: e.target.value })}
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
        value={fields.note ?? ''}
        onChange={(e) => setFields({ ...fields, note: e.target.value })}
      />
      <div className="form-actions">
        <button type="button" className="status-button" onClick={onCancel}>
          Hủy
        </button>
        <button type="submit" className="primary-button">
          Lưu
        </button>
      </div>
    </form>
  );
}
