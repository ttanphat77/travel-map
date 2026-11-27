import { useEffect, useRef, useState } from 'react';

export type Remote<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

/**
 * Tải dữ liệu từ dịch vụ bên ngoài theo một khóa.
 * Khi khóa đổi, yêu cầu cũ bị hủy. Khi khóa là null, hook không tải gì và trả về null.
 */
export function useRemote<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>): Remote<T> | null {
  const [state, setState] = useState<{ key: string; remote: Remote<T> } | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    setState({ key, remote: { status: 'loading' } });
    loadRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, remote: { status: 'ready', data } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setState({ key, remote: { status: 'error' } });
      });
    return () => controller.abort();
  }, [key]);

  if (key === null) return null;
  // Trong lần vẽ ngay sau khi khóa đổi, trạng thái cũ thuộc về khóa khác nên coi như đang tải.
  return state && state.key === key ? state.remote : { status: 'loading' };
}
