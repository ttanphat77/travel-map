export type CountryId = string;
export type MarkStatus = 'visited' | 'wishlist';

export interface Mark {
  status: MarkStatus;
  /** Dạng "YYYY-MM", ví dụ "2024-03". */
  date?: string;
  /** Tối đa 1000 ký tự. */
  note?: string;
  /** ISO 8601. */
  updatedAt: string;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: MarkStatus;
  date?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserData {
  schemaVersion: 1;
  /** Không bao giờ chứa khóa "VNM". Trạng thái Việt Nam được tính từ `provinces`. */
  countries: Record<CountryId, Mark>;
  /** Khóa là mã tỉnh mới. */
  provinces: Record<string, Mark>;
  places: Place[];
}

export const NOTE_MAX_LENGTH = 1000;
export const PLACE_NAME_MAX_LENGTH = 120;
export const VIETNAM_ID = 'VNM';

export function emptyUserData(): UserData {
  return { schemaVersion: 1, countries: {}, provinces: {}, places: [] };
}

export const STATUS_LABELS: Record<MarkStatus, string> = {
  visited: 'Đã đến',
  wishlist: 'Muốn đến',
};
