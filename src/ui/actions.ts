import type { PlaceFields, RegionKind } from '../domain/store';
import type { MarkStatus } from '../domain/types';

/** Thao tác đánh dấu một quốc gia hoặc một tỉnh. */
export interface MarkActions {
  setStatus: (kind: RegionKind, key: string, status: MarkStatus) => void;
  /** Bỏ đánh dấu. `name` dùng trong thông báo "Đã bỏ đánh dấu …". */
  clear: (kind: RegionKind, key: string, name: string) => void;
  updateDetails: (kind: RegionKind, key: string, details: { date?: string; note?: string }) => void;
}

/** Thao tác với ghim. */
export interface PlaceActions {
  /** Trả về id của ghim mới. */
  addPlace: (fields: PlaceFields) => string;
  updatePlace: (id: string, fields: PlaceFields) => void;
  deletePlace: (id: string) => void;
}

export type Actions = MarkActions & PlaceActions;
