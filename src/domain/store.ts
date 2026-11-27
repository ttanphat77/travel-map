import { isPlaceCategory } from './categories';
import { NOTE_MAX_LENGTH, PLACE_NAME_MAX_LENGTH, VIETNAM_ID, type Mark, type MarkStatus, type Place, type PlaceCategory, type PlaceRegion, type UserData } from './types';

export type PlaceFields = Pick<Place, 'name' | 'lat' | 'lng' | 'status'> & {
  date?: string;
  note?: string;
  category?: PlaceCategory;
  hometown?: boolean;
};

export type RegionKind = 'country' | 'province';

export type UserAction =
  | { type: 'setStatus'; kind: RegionKind; key: string; status: MarkStatus; now: string }
  | { type: 'updateDetails'; kind: RegionKind; key: string; date?: string; note?: string; now: string }
  | { type: 'clear'; kind: RegionKind; key: string }
  | { type: 'restoreMark'; kind: RegionKind; key: string; mark: Mark | undefined }
  | { type: 'addPlace'; id: string; fields: PlaceFields; now: string }
  | { type: 'updatePlace'; id: string; fields: PlaceFields; now: string }
  | { type: 'deletePlace'; id: string }
  | { type: 'restorePlace'; place: Place; index: number }
  /** Lưu nước và tỉnh vừa tra được của ghim. Tọa độ đi kèm để bỏ qua kết quả cũ nếu ghim đã đổi vị trí. */
  | { type: 'setPlaceRegion'; id: string; lat: number; lng: number; region: PlaceRegion }
  | { type: 'replaceAll'; data: UserData };

/** Chuẩn hóa dữ liệu ghim: cắt khoảng trắng, giới hạn độ dài, bỏ loại không hợp lệ, bỏ trường rỗng. */
export function cleanPlaceFields(fields: PlaceFields): PlaceFields {
  const cleaned: PlaceFields = {
    name: fields.name.trim().slice(0, PLACE_NAME_MAX_LENGTH),
    lat: fields.lat,
    lng: fields.lng,
    status: fields.status,
  };
  if (fields.date?.trim()) cleaned.date = fields.date.trim();
  const note = fields.note?.slice(0, NOTE_MAX_LENGTH);
  if (note?.trim()) cleaned.note = note;
  if (isPlaceCategory(fields.category)) cleaned.category = fields.category;
  if (fields.hometown === true) cleaned.hometown = true;
  return cleaned;
}

/** Bỏ đánh dấu quê nhà của một ghim. Cả dữ liệu chỉ có một ghim quê nhà, nên ghim cũ mất dấu khi có ghim mới. */
function withoutHometown(place: Place): Place {
  if (!place.hometown) return place;
  const copy = { ...place };
  delete copy.hometown;
  return copy;
}

function placeReducer(state: UserData, action: UserAction): UserData | undefined {
  switch (action.type) {
    case 'addPlace': {
      const fields = cleanPlaceFields(action.fields);
      if (fields.name === '') return state;
      const place: Place = { id: action.id, ...fields, createdAt: action.now, updatedAt: action.now };
      const others = fields.hometown ? state.places.map(withoutHometown) : state.places;
      return { ...state, places: [place, ...others] };
    }
    case 'updatePlace': {
      const fields = cleanPlaceFields(action.fields);
      if (fields.name === '') return state;
      return {
        ...state,
        places: state.places.map((p) => {
          if (p.id !== action.id) return fields.hometown ? withoutHometown(p) : p;
          // Vùng đã tra chỉ còn đúng khi ghim giữ nguyên tọa độ.
          const keepRegion = p.region && p.lat === fields.lat && p.lng === fields.lng;
          return { id: p.id, createdAt: p.createdAt, ...fields, ...(keepRegion ? { region: p.region } : {}), updatedAt: action.now };
        }),
      };
    }
    case 'setPlaceRegion': {
      const target = state.places.find((p) => p.id === action.id);
      if (!target || target.lat !== action.lat || target.lng !== action.lng) return state;
      const region: PlaceRegion = {};
      if (action.region.countryId) region.countryId = action.region.countryId;
      if (action.region.provinceCode) region.provinceCode = action.region.provinceCode;
      return { ...state, places: state.places.map((p) => (p === target ? { ...p, region } : p)) };
    }
    case 'deletePlace':
      return { ...state, places: state.places.filter((p) => p.id !== action.id) };
    case 'restorePlace': {
      if (state.places.some((p) => p.id === action.place.id)) return state;
      // Nếu người dùng đã chọn quê nhà khác sau khi xóa, lựa chọn mới đó được giữ.
      const restored = state.places.some((p) => p.hometown) ? withoutHometown(action.place) : action.place;
      const places = [...state.places];
      places.splice(Math.min(action.index, places.length), 0, restored);
      return { ...state, places };
    }
    default:
      return undefined;
  }
}

const tableOf = (kind: RegionKind) => (kind === 'country' ? 'countries' : 'provinces');

/** Việt Nam không được đánh dấu trực tiếp, vì trạng thái của Việt Nam được tính từ 34 tỉnh. */
function isForbidden(kind: RegionKind, key: string): boolean {
  return kind === 'country' && key === VIETNAM_ID;
}

function withMark(state: UserData, kind: RegionKind, key: string, mark: Mark | undefined): UserData {
  const table = tableOf(kind);
  const next = { ...state[table] };
  if (mark) next[key] = mark;
  else delete next[key];
  return { ...state, [table]: next };
}

/** Trường rỗng nghĩa là xóa trường đó khỏi dấu. */
function applyField(mark: Mark, field: 'date' | 'note', value: string | undefined): Mark {
  if (value === undefined) return mark;
  const next = { ...mark };
  const trimmed = field === 'note' ? value.slice(0, NOTE_MAX_LENGTH) : value;
  if (trimmed.trim() === '') delete next[field];
  else next[field] = trimmed;
  return next;
}

export function userReducer(state: UserData, action: UserAction): UserData {
  // Nạp dữ liệu tải từ server, thay toàn bộ dữ liệu đang có.
  if (action.type === 'replaceAll') return action.data;
  const placeResult = placeReducer(state, action);
  if (placeResult) return placeResult;
  if (!('kind' in action)) return state;
  if (isForbidden(action.kind, action.key)) return state;
  const current = state[tableOf(action.kind)][action.key];
  switch (action.type) {
    case 'setStatus':
      return withMark(state, action.kind, action.key, {
        ...current,
        status: action.status,
        updatedAt: action.now,
      });
    case 'updateDetails': {
      if (!current) return state;
      let next = applyField(current, 'date', action.date);
      next = applyField(next, 'note', action.note);
      return withMark(state, action.kind, action.key, { ...next, updatedAt: action.now });
    }
    case 'clear':
      return current ? withMark(state, action.kind, action.key, undefined) : state;
    case 'restoreMark':
      return withMark(state, action.kind, action.key, action.mark);
  }
}
