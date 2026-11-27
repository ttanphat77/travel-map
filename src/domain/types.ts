export type CountryId = string;
export type MarkStatus = 'visited' | 'wishlist';

/** Các loại ghim, theo thứ tự hiện trong form. */
export const PLACE_CATEGORIES = [
  'food',
  'cafe',
  'stay',
  'heritage',
  'museum',
  'religion',
  'nature',
  'beach',
  'park',
  'sightseeing',
  'shopping',
  'fun',
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export interface Mark {
  status: MarkStatus;
  /** Dạng "YYYY-MM", ví dụ "2024-03". */
  date?: string;
  /** Tối đa 1000 ký tự. */
  note?: string;
  /** ISO 8601. */
  updatedAt: string;
}

/**
 * Nước và tỉnh chứa ghim. App lấy thông tin này từ Nominatim, không suy ra từ đường biên của bản đồ.
 * Object rỗng nghĩa là app đã tra nhưng ghim không thuộc nước nào, ví dụ ghim giữa đại dương.
 */
export interface PlaceRegion {
  countryId?: CountryId;
  /** Mã tỉnh mới, chỉ có khi ghim ở Việt Nam. */
  provinceCode?: string;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: MarkStatus;
  date?: string;
  note?: string;
  /** Loại ghim, quyết định biểu tượng trên bản đồ. Ghim chưa có loại thì không có trường này. */
  category?: PlaceCategory;
  /** Nước và tỉnh chứa ghim. Ghim chưa được tra thì không có trường này. */
  region?: PlaceRegion;
  /** Ghim là quê nhà. Cả dữ liệu có tối đa một ghim quê nhà. Ghim khác thì không có trường này. */
  hometown?: boolean;
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

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  food: 'Ăn uống',
  cafe: 'Cà phê',
  stay: 'Lưu trú',
  heritage: 'Di tích',
  museum: 'Bảo tàng',
  religion: 'Tâm linh',
  nature: 'Thiên nhiên',
  beach: 'Biển',
  park: 'Công viên',
  sightseeing: 'Ngắm cảnh',
  shopping: 'Mua sắm',
  fun: 'Vui chơi',
};
