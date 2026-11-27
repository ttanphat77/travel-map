import type { MapGeoJSONFeature } from 'maplibre-gl';
import { wrapLng } from '../domain/locate';

/** Một địa điểm trên bản đồ nền, ví dụ một ngôi chùa, một quán ăn hay một thành phố. */
export interface PoiInfo {
  name: string;
  lat: number;
  lng: number;
  /** Lớp dữ liệu của OpenMapTiles, ví dụ "poi", "place" hay "mountain_peak". */
  group: string;
  /** Loại chi tiết, ví dụ "place_of_worship", "museum" hay "city". */
  type: string;
  /** Nhóm loại của OpenMapTiles, ví dụ "shop" khi loại chi tiết là "books". */
  poiClass: string;
  /** Độ cao, chỉ có ở đỉnh núi. */
  ele?: number;
}

/** Tên tiếng Việt của các loại địa điểm thường gặp trong dữ liệu OpenMapTiles. */
const TYPE_LABELS: Record<string, string> = {
  attraction: 'Điểm tham quan',
  viewpoint: 'Điểm ngắm cảnh',
  museum: 'Bảo tàng',
  gallery: 'Phòng tranh',
  artwork: 'Tác phẩm nghệ thuật',
  monument: 'Tượng đài',
  memorial: 'Đài tưởng niệm',
  castle: 'Thành cổ',
  ruins: 'Di tích',
  archaeological_site: 'Di chỉ khảo cổ',
  historic: 'Di tích lịch sử',
  place_of_worship: 'Nơi thờ tự',
  temple: 'Đền, chùa',
  church: 'Nhà thờ',
  theatre: 'Nhà hát',
  cinema: 'Rạp chiếu phim',
  zoo: 'Vườn thú',
  aquarium: 'Thủy cung',
  theme_park: 'Công viên giải trí',
  park: 'Công viên',
  garden: 'Vườn',
  beach: 'Bãi biển',
  campsite: 'Khu cắm trại',
  restaurant: 'Nhà hàng',
  fast_food: 'Đồ ăn nhanh',
  cafe: 'Quán cà phê',
  bar: 'Quán bar',
  pub: 'Quán rượu',
  ice_cream: 'Kem',
  bakery: 'Tiệm bánh',
  lodging: 'Chỗ ở',
  hotel: 'Khách sạn',
  hostel: 'Nhà nghỉ tập thể',
  guest_house: 'Nhà nghỉ',
  motel: 'Nhà nghỉ',
  shop: 'Cửa hàng',
  grocery: 'Tạp hóa',
  supermarket: 'Siêu thị',
  marketplace: 'Chợ',
  clothing_store: 'Cửa hàng quần áo',
  hospital: 'Bệnh viện',
  pharmacy: 'Nhà thuốc',
  school: 'Trường học',
  college: 'Trường cao đẳng',
  university: 'Trường đại học',
  library: 'Thư viện',
  town_hall: 'Cơ quan hành chính',
  police: 'Công an',
  post: 'Bưu điện',
  bank: 'Ngân hàng',
  fuel: 'Trạm xăng',
  parking: 'Bãi đỗ xe',
  bus: 'Bến xe buýt',
  bus_stop: 'Trạm xe buýt',
  railway: 'Ga tàu',
  ferry_terminal: 'Bến phà',
  harbor: 'Cảng',
  stadium: 'Sân vận động',
  sports_centre: 'Trung tâm thể thao',
  swimming_pool: 'Hồ bơi',
  golf: 'Sân golf',
  city: 'Thành phố',
  town: 'Thị trấn',
  village: 'Làng',
  hamlet: 'Xóm',
  suburb: 'Khu vực',
  quarter: 'Khu phố',
  neighbourhood: 'Khu dân cư',
  island: 'Đảo',
  islet: 'Đảo nhỏ',
  peak: 'Đỉnh núi',
  volcano: 'Núi lửa',
  aerodrome: 'Sân bay',
  international: 'Sân bay quốc tế',
  regional: 'Sân bay',
  lake: 'Hồ',
  sea: 'Biển',
  bay: 'Vịnh',
  ocean: 'Đại dương',
  river: 'Sông',
  lagoon: 'Đầm phá',
};

const GROUP_LABELS: Record<string, string> = {
  poi: 'Địa điểm',
  place: 'Địa danh',
  mountain_peak: 'Đỉnh núi',
  aerodrome_label: 'Sân bay',
  water_name: 'Mặt nước',
};

/** Tên loại địa điểm bằng tiếng Việt. Loại chưa có bản dịch thì dùng tên nhóm. */
export function poiTypeLabel(poi: Pick<PoiInfo, 'group' | 'type'>): string {
  return TYPE_LABELS[poi.type] ?? GROUP_LABELS[poi.group] ?? 'Địa điểm';
}

/**
 * Đọc địa điểm từ một đối tượng trên lớp chữ của bản đồ nền.
 * Nhãn chạy dọc theo đường, ví dụ tên sông, không có một điểm cố định, nên dùng vị trí con trỏ.
 */
export function poiFromFeature(feature: MapGeoJSONFeature, fallback: { lat: number; lng: number }): PoiInfo | null {
  const props = feature.properties as Record<string, unknown>;
  const text = (key: string) => (typeof props[key] === 'string' && props[key] !== '' ? (props[key] as string) : undefined);
  const name = text('name:vi') ?? text('name:latin') ?? text('name');
  if (!name) return null;
  const [lng, lat] =
    feature.geometry.type === 'Point'
      ? (feature.geometry.coordinates as [number, number])
      : [fallback.lng, fallback.lat];
  const ele = typeof props.ele === 'number' ? props.ele : undefined;
  return {
    name,
    lat,
    lng: wrapLng(lng),
    group: feature.sourceLayer ?? 'poi',
    type: text('subclass') ?? text('class') ?? '',
    poiClass: text('class') ?? '',
    ...(ele !== undefined ? { ele } : {}),
  };
}
