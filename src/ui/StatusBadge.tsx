import { Check, Star } from 'lucide-react';
import { STATUS_LABELS, type MarkStatus } from '../domain/types';

/** Nhãn trạng thái "Đã đến" hoặc "Muốn đến". Khi chưa có trạng thái, nhãn ghi "Chưa đánh dấu". */
export default function StatusBadge({ status }: { status: MarkStatus | undefined }) {
  if (!status) return <span className="badge">Chưa đánh dấu</span>;
  const Icon = status === 'visited' ? Check : Star;
  return (
    <span className={`badge is-${status}`}>
      <Icon size={12} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
