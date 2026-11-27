import { PLACE_CATEGORIES, type Place, type PlaceCategory } from './types';

const CATEGORY_SET: ReadonlySet<string> = new Set(PLACE_CATEGORIES);

export const isPlaceCategory = (value: unknown): value is PlaceCategory => typeof value === 'string' && CATEGORY_SET.has(value);

export interface CategoryCount {
  category: PlaceCategory;
  count: number;
}

/** Các loại đang có ghim, kèm số ghim. Thứ tự giống thứ tự trong form. */
export function countCategories(places: readonly Place[]): CategoryCount[] {
  const counts = new Map<PlaceCategory, number>();
  for (const place of places) {
    if (place.category) counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
  }
  return PLACE_CATEGORIES.flatMap((category) => {
    const count = counts.get(category);
    return count ? [{ category, count }] : [];
  });
}

/** Tra bảng chỉ theo khóa của chính bảng. Nhờ vậy khóa lạ như "constructor" không trả về hàm có sẵn của object. */
const lookup = (table: Record<string, PlaceCategory>, key: string): PlaceCategory | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/** Loại ghim theo loại địa điểm của bản đồ nền (mã của OpenMapTiles). */
const POI_TYPE_CATEGORIES: Record<string, PlaceCategory> = {
  restaurant: 'food',
  fast_food: 'food',
  bakery: 'food',
  ice_cream: 'food',
  bar: 'food',
  pub: 'food',
  beer: 'food',
  cafe: 'cafe',
  lodging: 'stay',
  hotel: 'stay',
  hostel: 'stay',
  guest_house: 'stay',
  motel: 'stay',
  monument: 'heritage',
  memorial: 'heritage',
  castle: 'heritage',
  ruins: 'heritage',
  archaeological_site: 'heritage',
  historic: 'heritage',
  museum: 'museum',
  gallery: 'museum',
  art_gallery: 'museum',
  place_of_worship: 'religion',
  temple: 'religion',
  church: 'religion',
  peak: 'nature',
  volcano: 'nature',
  campsite: 'nature',
  lake: 'nature',
  river: 'nature',
  bay: 'nature',
  lagoon: 'nature',
  beach: 'beach',
  island: 'beach',
  islet: 'beach',
  park: 'park',
  garden: 'park',
  attraction: 'sightseeing',
  viewpoint: 'sightseeing',
  artwork: 'sightseeing',
  shop: 'shopping',
  grocery: 'shopping',
  supermarket: 'shopping',
  marketplace: 'shopping',
  clothing_store: 'shopping',
  alcohol_shop: 'shopping',
  books: 'shopping',
  zoo: 'fun',
  aquarium: 'fun',
  theme_park: 'fun',
  theatre: 'fun',
  cinema: 'fun',
};

/** Loại ghim theo nhóm điểm đến của Wikidata. */
const ATTRACTION_CATEGORIES: Record<string, PlaceCategory> = {
  heritage: 'heritage',
  monument: 'heritage',
  castle: 'heritage',
  museum: 'museum',
  religious: 'religion',
  mountain: 'nature',
  cave: 'nature',
  water: 'nature',
  beach: 'beach',
  island: 'beach',
  park: 'park',
  attraction: 'sightseeing',
  tower: 'sightseeing',
  market: 'shopping',
  zoo: 'fun',
  fun: 'fun',
};

/**
 * Loại ghim chọn sẵn cho một địa điểm của bản đồ nền. Không đoán được thì trả về undefined.
 * Hàm xét loại chi tiết trước, ví dụ "books". Nếu không khớp, hàm xét nhóm loại, ví dụ "shop".
 */
export const categoryForPoi = (type: string, kind = ''): PlaceCategory | undefined =>
  lookup(POI_TYPE_CATEGORIES, type) ?? lookup(POI_TYPE_CATEGORIES, kind);

/** Loại ghim chọn sẵn cho một điểm đến lấy từ Wikidata. */
export const categoryForAttraction = (category: string): PlaceCategory | undefined => lookup(ATTRACTION_CATEGORIES, category);
