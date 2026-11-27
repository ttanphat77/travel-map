import { Bird, Bug, Fish, PawPrint, Shell, Squirrel, Turtle, type LucideIcon } from 'lucide-react';
import { IUCN_LABELS, type IucnStatus } from '../domain/species';

/** Biểu tượng theo nhóm loài của iNaturalist. Nhóm không có trong bảng dùng dấu chân thú. */
const GROUP_ICONS: Record<string, LucideIcon> = {
  Mammalia: Squirrel,
  Aves: Bird,
  Reptilia: Turtle,
  Actinopterygii: Fish,
  Insecta: Bug,
  Arachnida: Bug,
  Mollusca: Shell,
};

export const speciesIcon = (group: string): LucideIcon => (Object.hasOwn(GROUP_ICONS, group) ? GROUP_ICONS[group]! : PawPrint);

/**
 * Nhãn mức Sách đỏ. Màu đi từ xanh (ít quan tâm) đến đỏ (cực kỳ nguy cấp).
 * Nhãn luôn có chữ, nên không chỉ dựa vào màu. Dạng ngắn chỉ ghi mã, ví dụ "CR", và có tên đầy đủ khi rê chuột.
 */
export function IucnBadge({ status, short = false }: { status: IucnStatus; short?: boolean }) {
  const label = IUCN_LABELS[status];
  return (
    <span className={`iucn-badge is-${status.toLowerCase()}`} title={`Sách đỏ IUCN: ${label}`} aria-label={`Sách đỏ IUCN: ${label}`}>
      {short ? status : label}
    </span>
  );
}
