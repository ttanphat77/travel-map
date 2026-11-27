import { useEffect, useRef, useState } from 'react';
import { resolveRegion } from '../domain/region';
import type { Place, PlaceRegion } from '../domain/types';
import { isAbort, lookupRegion } from '../services/nominatim';

/** Ghim tra lỗi vì mạng thì chờ chừng này rồi mới tra lại. */
const RETRY_MS = 60_000;

/**
 * Tra nước và tỉnh cho các ghim chưa có thông tin này, gồm ghim mới và ghim cũ.
 * Các yêu cầu đi qua hàng đợi chung của Nominatim, nên luôn cách nhau ít nhất 1 giây.
 * `places` là null khi app chưa tải xong dữ liệu. Khi đó hook chưa tra gì.
 */
export function useRegionLookup(
  places: readonly Place[] | null,
  countryIdOf: ((iso2: string) => string | undefined) | null,
  onResolved: (place: Place, region: PlaceRegion) => void,
): void {
  const pending = useRef(new Set<string>());
  const failedUntil = useRef(new Map<string, number>());
  const controller = useRef<AbortController | null>(null);
  const onResolvedRef = useRef(onResolved);
  onResolvedRef.current = onResolved;
  const [retryTick, setRetryTick] = useState(0);

  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!places || !countryIdOf) return;
    controller.current ??= new AbortController();
    const { signal } = controller.current;
    const now = Date.now();
    for (const place of places) {
      if (place.region || pending.current.has(place.id) || (failedUntil.current.get(place.id) ?? 0) > now) continue;
      pending.current.add(place.id);
      lookupRegion(place.lat, place.lng, signal)
        .then((lookup) => {
          failedUntil.current.delete(place.id);
          onResolvedRef.current(place, resolveRegion(lookup, countryIdOf));
        })
        .catch((error: unknown) => {
          if (isAbort(error)) {
            // Yêu cầu bị hủy vì hook được gắn lại, ví dụ ở chế độ phát triển của React. Khi đó tra lại ngay.
            if (controller.current && !controller.current.signal.aborted) setRetryTick((tick) => tick + 1);
            return;
          }
          console.warn(`Chưa tra được vị trí của ghim ${place.name}`, error);
          failedUntil.current.set(place.id, Date.now() + RETRY_MS);
          window.setTimeout(() => {
            if (!signal.aborted) setRetryTick((tick) => tick + 1);
          }, RETRY_MS);
        })
        .finally(() => pending.current.delete(place.id));
    }
  }, [places, countryIdOf, retryTick]);
}
