import { Calendar, House, MapPin, StickyNote } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { PlaceFields } from '../domain/store';
import { NOTE_MAX_LENGTH, PLACE_NAME_MAX_LENGTH } from '../domain/types';
import { CategoryPicker } from './categories';
import StatusSegmented from './StatusSegmented';

interface Props {
  title: string;
  /** Dòng phụ dưới tiêu đề, ví dụ vị trí của ghim. */
  hint?: string;
  initial: PlaceFields;
  onSave: (fields: PlaceFields) => void;
  onCancel: () => void;
}

/** Form thêm hoặc sửa ghim. Tên là bắt buộc. */
export default function PlaceForm({ title, hint, initial, onSave, onCancel }: Props) {
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
    <form className="form" onSubmit={submit} noValidate>
      <h2 className="form-title">{title}</h2>
      {hint && <p className="form-hint">{hint}</p>}
      <div className="field">
        <label className="field-label" htmlFor={nameId}>
          <MapPin size={14} aria-hidden="true" />
          Tên địa điểm
        </label>
        <input
          ref={nameRef}
          id={nameId}
          className="input"
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
      </div>
      <StatusSegmented value={fields.status} onChange={(status) => setFields({ ...fields, status })} />
      <CategoryPicker value={fields.category} onChange={(category) => setFields({ ...fields, category })} />
      <label className="check-field">
        <input
          type="checkbox"
          checked={fields.hometown === true}
          onChange={(e) => setFields({ ...fields, hometown: e.target.checked })}
        />
        <House size={14} aria-hidden="true" />
        Đây là quê nhà
      </label>
      {fields.hometown && <p className="form-hint">Chỉ một ghim là quê nhà. Ghim quê nhà cũ, nếu có, sẽ bỏ dấu này.</p>}
      <div className="field">
        <label className="field-label" htmlFor={dateId}>
          <Calendar size={14} aria-hidden="true" />
          Tháng đến
        </label>
        <input
          id={dateId}
          className="input"
          type="month"
          value={fields.date ?? ''}
          onChange={(e) => setFields({ ...fields, date: e.target.value })}
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
          value={fields.note ?? ''}
          onChange={(e) => setFields({ ...fields, note: e.target.value })}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="button" onClick={onCancel}>
          Hủy
        </button>
        <button type="submit" className="button button-primary">
          Lưu
        </button>
      </div>
    </form>
  );
}
