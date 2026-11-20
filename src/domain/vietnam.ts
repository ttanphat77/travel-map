import { PROVINCES } from '../data/provinces';
import type { Mark, MarkStatus } from './types';

export interface VietnamSummary {
  /** Trạng thái của Việt Nam, tính từ các tỉnh. `undefined` là chưa đánh dấu. */
  status: MarkStatus | undefined;
  visited: number;
  wishlist: number;
  total: number;
}

/**
 * Việt Nam là "Đã đến" khi có ít nhất một tỉnh "Đã đến".
 * Nếu không có tỉnh nào "Đã đến" nhưng có tỉnh "Muốn đến", Việt Nam là "Muốn đến".
 */
export function summarizeVietnam(provinces: Record<string, Mark>): VietnamSummary {
  let visited = 0;
  let wishlist = 0;
  for (const province of PROVINCES) {
    const status = provinces[province.code]?.status;
    if (status === 'visited') visited++;
    if (status === 'wishlist') wishlist++;
  }
  const status: MarkStatus | undefined = visited > 0 ? 'visited' : wishlist > 0 ? 'wishlist' : undefined;
  return { status, visited, wishlist, total: PROVINCES.length };
}
