import { Search } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { createSearcher, isAbort, SearchError, type SearchResult } from '../services/nominatim';

interface Props {
  onPick: (result: SearchResult) => void;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; results: SearchResult[] }
  | { status: 'error'; message: string };

/** Ô tìm địa điểm. Theo chính sách của Nominatim, ô này chỉ gửi yêu cầu khi người dùng bấm Enter. */
export default function SearchBox({ onPick }: Props) {
  const search = useMemo(() => createSearcher(), []);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim() === '') return;
    setState({ status: 'loading' });
    try {
      const results = await search(query);
      setState({ status: 'done', results });
    } catch (error) {
      if (isAbort(error)) return;
      setState({ status: 'error', message: error instanceof SearchError ? error.message : 'Đã có lỗi khi tìm kiếm.' });
    }
  };

  const close = () => setState({ status: 'idle' });

  return (
    <form className="search-box" role="search" onSubmit={submit}>
      <label className="search-field">
        <Search size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Tìm địa điểm, ví dụ Hội An"
          aria-label="Tìm địa điểm"
          aria-controls={listId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
        />
      </label>
      {state.status !== 'idle' && (
        <div className="search-panel" id={listId}>
          {state.status === 'loading' && <p className="search-message">Đang tìm…</p>}
          {state.status === 'error' && (
            <p className="search-message search-error" role="alert">
              {state.message}
            </p>
          )}
          {state.status === 'done' && state.results.length === 0 && (
            <p className="search-message">Không tìm thấy địa điểm. Thử tên khác.</p>
          )}
          {state.status === 'done' && state.results.length > 0 && (
            <ul className="search-results">
              {state.results.map((result) => (
                <li key={`${result.lat},${result.lng},${result.displayName}`}>
                  <button
                    type="button"
                    className="search-result"
                    onClick={() => {
                      close();
                      onPick(result);
                    }}
                  >
                    <span className="search-result-name">{result.name}</span>
                    <span className="search-result-detail">{result.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="search-note">Chữ bạn gõ được gửi tới máy chủ OpenStreetMap để tìm kiếm.</p>
        </div>
      )}
    </form>
  );
}
