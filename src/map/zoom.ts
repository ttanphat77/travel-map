/**
 * Các mốc zoom của MapLibre.
 * Bản đồ vector dùng ô 512 px, nên mỗi mốc nhỏ hơn mốc tương ứng của Leaflet một bậc.
 */

/** Từ mức zoom này trở lên, Việt Nam tách thành 34 tỉnh. */
export const VN_DETAIL_ZOOM = 4;

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 18;
/** Tâm ban đầu [kinh độ, vĩ độ]. */
export const INITIAL_CENTER: [number, number] = [100, 20];
export const INITIAL_ZOOM = 1.3;

/** Đến mức zoom này, nền màu của vùng đã đánh dấu vẫn đậm như bình thường. */
export const FILL_FADE_START_ZOOM = 5;
/** Từ mức zoom này, nền màu biến mất hẳn để không che chi tiết của bản đồ nền. Chỉ còn viền màu trạng thái. */
export const FILL_FADE_END_ZOOM = 9;

/** Mức zoom khi bay tới một địa điểm, ví dụ kết quả tìm kiếm hoặc ghim trong danh sách. */
export const PLACE_ZOOM = 14;
