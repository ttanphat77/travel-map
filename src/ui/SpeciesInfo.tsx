import { Crosshair, Eye, EyeOff, Map as MapIcon } from 'lucide-react';
import { useEffect } from 'react';
import { groupLabel, type ActiveSpecies, type LngLatBox, type SpeciesInfo as Species } from '../domain/species';
import { SpeciesError, speciesService } from '../services/species';
import { fetchSummary } from '../services/wiki';
import { IucnBadge } from './species';
import { useRemote, type Remote } from './useRemote';
import { Intro, Skeleton, Stats, formatNumber } from './WikiBlocks';

export type SpeciesLayer = 'range' | 'obs';

interface Props {
  inatId: number;
  /** Loài đang hiện trên bản đồ, để biết hai nút bật tắt đang ở trạng thái nào. */
  active: ActiveSpecies | null;
  /** Thông tin loài vừa tải xong. `requestedId` là mã đã mở, có thể khác mã thật nếu iNaturalist đổi mã. */
  onInfo: (info: Species, requestedId: number) => void;
  /**
   * Đã đếm xong điểm quan sát trên GBIF. `available` cho biết có nên thêm lớp nơi đã gặp hay không.
   * App chỉ thêm lớp sau bước này, để yêu cầu đếm không phải tranh với hàng chục ô lục giác đang tải.
   */
  onObservations: (info: Species, available: boolean) => void;
  onLayer: (info: Species, layer: SpeciesLayer, on: boolean) => void;
  /** Đã biết khung bao của vùng có loài. App quyết định có tự bay tới hay không. */
  onBox: (inatId: number, box: LngLatBox) => void;
  onFlyTo: (box: LngLatBox) => void;
}

type InfoResult = { ok: true; info: Species } | { ok: false; message: string };

const ready = <T,>(remote: Remote<T> | null): T | undefined => (remote?.status === 'ready' ? remote.data : undefined);

/** Nút bật tắt một lớp của loài trên bản đồ. */
function LayerToggle({ label, swatch, on, disabled, onToggle }: {
  label: string;
  swatch: SpeciesLayer;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`layer-toggle${on ? '' : ' is-off'}`}
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
    >
      <span className={`layer-swatch is-${swatch}`} aria-hidden="true" />
      <span className="layer-toggle-label">{label}</span>
      {on ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
    </button>
  );
}

/** Trang thông tin của một loài, kèm hai nút bật tắt lớp trên bản đồ (xem docs/SPECIES-RANGE.md, mục 5.2). */
export default function SpeciesInfo({ inatId, active, onInfo, onObservations, onLayer, onBox, onFlyTo }: Props) {
  const infoRemote = useRemote<InfoResult>(`species:${inatId}`, async (signal) => {
    try {
      return { ok: true, info: await speciesService.info(inatId, signal) };
    } catch (error) {
      // Lỗi có lời giải thích, ví dụ loài đã bị tách, được hiện nguyên văn cho người dùng.
      if (error instanceof SpeciesError) return { ok: false, message: error.message };
      throw error;
    }
  });
  const result = ready(infoRemote);
  const info = result?.ok ? result.info : undefined;
  const range = useRemote(info ? `species-range:${info.inatId}` : null, (signal) => speciesService.range(info!.inatId, signal));
  const obs = useRemote(info?.gbifKey ? `species-obs:${info.gbifKey}` : null, (signal) =>
    speciesService.observations(info!.gbifKey!, signal),
  );
  const title = info?.wikipediaTitle;
  const summary = useRemote(title ? `summary:${title}` : null, (signal) => fetchSummary(title!, signal));

  const rangeData = ready(range);
  const obsData = ready(obs);
  // Khung bao ưu tiên vùng phân bố. Chỉ khi loài không có vùng phân bố, app mới dùng khung bao của các điểm GBIF.
  const rangeSettled = range?.status === 'ready' || range?.status === 'error';
  const box = rangeData?.box ?? (rangeSettled ? obsData?.box : undefined);

  // Hai effect chỉ báo cho App khi thông tin loài hoặc khung bao đổi, không báo lại mỗi lần vẽ.
  useEffect(() => {
    if (info) onInfo(info, inatId);
  }, [info]);

  useEffect(() => {
    if (info && box) onBox(info.inatId, box);
  }, [box]);

  // Nếu không đếm được điểm, app vẫn thêm lớp, vì ô bản đồ có thể vẫn tải được.
  useEffect(() => {
    if (!info?.gbifKey) return;
    if (obs?.status === 'ready') onObservations(info, obs.data.count > 0);
    if (obs?.status === 'error') onObservations(info, true);
  }, [obs?.status]);

  if (!infoRemote || infoRemote.status === 'loading') {
    return (
      <>
        <span className="skeleton info-hero is-skeleton" aria-hidden="true" />
        <div className="info-head" aria-label="Đang tải thông tin loài">
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" />
        </div>
      </>
    );
  }
  if (infoRemote.status === 'error' || !result || !result.ok) {
    return (
      <div className="info-head">
        <h2 className="info-title">Không mở được loài này</h2>
        <p className="field-error" role="alert">
          {result && !result.ok ? result.message : 'Không tải được thông tin loài. Thử lại sau.'}
        </p>
      </div>
    );
  }

  const species = result.info;
  // Trạng thái bật tắt chỉ có nghĩa khi loài đang hiện trên bản đồ chính là loài của trang này.
  const shown = active?.inatId === species.inatId ? active : null;
  const rangeOn = shown?.showRange ?? false;
  const obsOn = shown?.showObservations ?? false;
  const rangeMissing = rangeData?.available === false;
  const obsMissing = !species.gbifKey || obsData?.count === 0;

  return (
    <>
      {species.photo && (
        <figure className="species-photo">
          <img className="info-hero" src={species.photo.url} alt={species.name} />
          <figcaption className="photo-credit">{species.photo.attribution} · iNaturalist</figcaption>
        </figure>
      )}
      <div className="info-head">
        <h2 className="info-title">{species.name}</h2>
        <p className="info-subtitle">
          {species.name !== species.scientificName && (
            <>
              <i>{species.scientificName}</i> ·{' '}
            </>
          )}
          {groupLabel(species.group)}
        </p>
        {species.iucn && (
          <p className="info-category">
            <IucnBadge status={species.iucn} />
          </p>
        )}
      </div>
      <div className="info-body">
        <Stats
          loading={obs?.status === 'loading'}
          items={[
            { label: 'Quan sát iNaturalist', value: formatNumber(species.observationsCount) },
            { label: 'Điểm trên GBIF', value: obsData ? formatNumber(obsData.count) : species.gbifKey ? undefined : 'Không có' },
            { label: 'Sách đỏ IUCN', value: species.iucn ?? 'Chưa có' },
          ]}
        />

        <section className="section">
          <h3 className="section-title">
            <MapIcon size={14} aria-hidden="true" />
            Trên bản đồ
          </h3>
          <div className="layer-toggles">
            <LayerToggle
              label="Vùng phân bố"
              swatch="range"
              on={rangeOn && !rangeMissing}
              disabled={rangeMissing}
              onToggle={() => onLayer(species, 'range', !rangeOn)}
            />
            <LayerToggle
              label="Nơi đã gặp"
              swatch="obs"
              on={obsOn && !obsMissing}
              disabled={obsMissing}
              onToggle={() => onLayer(species, 'obs', !obsOn)}
            />
          </div>
          {rangeMissing && <p className="section-note">iNaturalist chưa có vùng phân bố của loài này.</p>}
          {obsMissing && <p className="section-note">GBIF chưa có điểm quan sát của loài này.</p>}
          {box && (
            <button type="button" className="button button-small" onClick={() => onFlyTo(box)}>
              <Crosshair size={14} aria-hidden="true" />
              Bay tới vùng có loài này
            </button>
          )}
          <p className="section-note">Một số điểm quan sát bị làm lệch vị trí để bảo vệ loài quý hiếm.</p>
        </section>

        <Intro remote={summary} />

        {species.rangeMapUrl && (
          <section className="section">
            <h3 className="section-title">Bản đồ phân bố (Wikimedia Commons)</h3>
            <img className="range-map" src={species.rangeMapUrl} alt={`Bản đồ phân bố của ${species.name}`} loading="lazy" />
          </section>
        )}

        <p className="source-note">
          Nguồn:{' '}
          <a href={`https://www.inaturalist.org/taxa/${species.inatId}`} target="_blank" rel="noopener noreferrer">
            iNaturalist
          </a>
          , {species.gbifKey ? (
            <a href={`https://www.gbif.org/species/${species.gbifKey}`} target="_blank" rel="noopener noreferrer">
              GBIF.org
            </a>
          ) : (
            'GBIF.org'
          )}
          ,{' '}
          <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer">
            Wikidata
          </a>{' '}
          (CC0),{' '}
          <a href="https://vi.wikipedia.org" target="_blank" rel="noopener noreferrer">
            Wikipedia
          </a>{' '}
          (CC BY-SA). Ảnh dùng theo giấy phép ghi dưới ảnh.
        </p>
      </div>
    </>
  );
}
