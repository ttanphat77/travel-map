/** Đổi tháng dạng "2024-03" thành "03/2024". */
export function formatMonth(date: string): string {
  const [year, month] = date.split('-');
  return year && month ? `${month}/${year}` : date;
}

/** Đổi thời điểm ISO thành ngày dạng "21/11/2026". */
export function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('vi-VN');
}
