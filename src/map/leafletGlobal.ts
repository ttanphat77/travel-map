import L from 'leaflet';

/**
 * leaflet.markercluster tìm Leaflet qua biến toàn cục `L`.
 * Module này phải được import trước 'leaflet.markercluster'.
 */
(globalThis as unknown as { L: typeof L }).L = L;

export default L;
