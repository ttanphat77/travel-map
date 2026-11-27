import { ChevronRight, Search } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SUGGESTED_SPECIES, groupLabel, type SpeciesHit } from '../domain/species';
import { OFFLINE_MESSAGE, SpeciesError, speciesService } from '../services/species';
import { IucnBadge, speciesIcon } from './species';

/** Trạng thái của ô tìm loài. SidePanel giữ trạng thái này, để kết quả còn nguyên khi người dùng mở một loài rồi quay lại. */
export interface SpeciesSearchState {
  query: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  hits: SpeciesHit[];
  /** Wikidata đang bận, nên kết quả chỉ có phần của iNaturalist. */
  partial: boolean;
  message?: string;
}

export const EMPTY_SPECIES_SEARCH: SpeciesSearchState = { query: '', status: 'idle', hits: [], partial: false };

interface Props {
  state: SpeciesSearchState;
  onStateChange: (update: (state: SpeciesSearchState) => SpeciesSearchState) => void;
  onPick: (hit: SpeciesHit) => void;
}

/** Một dòng trong danh sách loài: ảnh nhỏ, tên, tên khoa học, nhóm và mức Sách đỏ. */
function SpeciesRow({ hit, onPick }: { hit: SpeciesHit; onPick: (hit: SpeciesHit) => void }) {
  const Icon = speciesIcon(hit.group);
  return (
    <li>
      <button type="button" className="list-item" onClick={() => onPick(hit)}>
        {hit.thumbnail ? (
          <img className="list-item-thumb" src={hit.thumbnail} alt="" loading="lazy" />
        ) : (
          <span className="list-item-icon">
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
        <span className="list-item-body">
          <span className="list-item-title">{hit.name}</span>
          <span className="list-item-meta">
            {hit.name !== hit.scientificName && (
              <>
                <i>{hit.scientificName}</i> ·{' '}
              </>
            )}
            {groupLabel(hit.group)}
          </span>
        </span>
        {hit.iucn && <IucnBadge status={hit.iucn} short />}
        <ChevronRight size={16} className="list-item-end" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Nội dung tab "Loài": ô tìm loài động vật, loài gợi ý và danh sách kết quả.
 * App chỉ tìm khi người dùng bấm Enter hoặc nút Tìm, vì Wikidata chặn khi bị gọi dồn dập.
 */
export default function SpeciesSearch({ state, onStateChange, onPick }: Props) {
  const controller = useRef<AbortController | null>(null);

  // Khi tab bị đóng giữa chừng, yêu cầu đang chạy bị hủy và ô tìm trở về trạng thái chờ.
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const query = state.query;
    onStateChange((s) => ({ ...s, status: 'loading', message: undefined }));
    speciesService
      .search(query, current.signal)
      .then(({ hits, partial }) => {
        if (!current.signal.aborted) onStateChange((s) => ({ ...s, status: 'done', hits, partial }));
      })
      .catch((error: unknown) => {
        if (current.signal.aborted) {
          onStateChange((s) => (s.status === 'loading' ? { ...s, status: 'idle' } : s));
          return;
        }
        const message = error instanceof SpeciesError ? error.message : OFFLINE_MESSAGE;
        onStateChange((s) => ({ ...s, status: 'error', message }));
      });
  };

  const { status, hits, partial, message } = state;
  return (
    <div className="species-search">
      <form className="species-form" role="search" onSubmit={submit}>
        <input
          className="input"
          type="search"
          placeholder="Tên loài, ví dụ voọc"
          aria-label="Tìm loài động vật"
          value={state.query}
          onChange={(e) => {
            const query = e.target.value;
            // Xóa hết chữ thì quay về danh sách loài gợi ý.
            onStateChange((s) => (query.trim() === '' ? { ...EMPTY_SPECIES_SEARCH } : { ...s, query }));
          }}
        />
        <button type="submit" className="button button-primary" disabled={status === 'loading'}>
          <Search size={16} aria-hidden="true" />
          Tìm
        </button>
      </form>

      {status === 'loading' && <p className="info-text muted list-note">Đang tìm…</p>}
      {status === 'error' && (
        <p className="field-error list-note" role="alert">
          {message}
        </p>
      )}
      {status === 'done' && partial && (
        <p className="info-text muted list-note">
          Wikidata đang bận, nên kết quả có thể thiếu loài và thiếu tên tiếng Việt. Thử lại sau ít phút.
        </p>
      )}
      {status === 'done' && hits.length === 0 && (
        <p className="info-text muted list-note">Không tìm thấy loài động vật nào. Thử tên khác hoặc tên khoa học.</p>
      )}

      {status === 'idle' && <p className="list-group-title">Loài gợi ý</p>}
      {(status === 'idle' || (status === 'done' && hits.length > 0)) && (
        <ul className="list">
          {(status === 'idle' ? SUGGESTED_SPECIES : hits).map((hit) => (
            <SpeciesRow key={hit.inatId} hit={hit} onPick={onPick} />
          ))}
        </ul>
      )}

      <p className="species-note">Tên loài bạn gõ được gửi tới Wikidata và iNaturalist để tìm kiếm.</p>
    </div>
  );
}
