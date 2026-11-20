import { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props {
  toast: ToastMessage | null;
  onDismiss: () => void;
  /** Thời gian hiện thông báo, tính bằng mili giây. */
  duration?: number;
}

/** Thông báo ngắn ở cuối màn hình, có thể kèm một nút như "Hoàn tác". */
export default function Toast({ toast, onDismiss, duration = 5000 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
