import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.join(DATA_DIR, '.cache');
export const PROJECT_DIR = path.resolve(DATA_DIR, '..', '..');
export const OUTPUT_DIR = path.join(PROJECT_DIR, 'public', 'data');

/** Commit cố định của từng nguồn. Đổi commit thì checksum cũng phải đổi. */
const NATURAL_EARTH_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19';
const PROVINCES_DB_COMMIT = '8b78ba5118715e1fa81769286724db79346abf52';
const GEOBOUNDARIES_COMMIT = '9469f09';

/** Tên thư mục chỉ dùng để tải file. Script nối dữ liệu bằng `matinh` trong file, không dùng tên thư mục. */
const PROVINCE_FOLDERS = [
  '1_thu_đo_ha_noi', '2_tinh_cao_bang', '3_tinh_tuyen_quang', '4_tinh_lao_cai',
  '5_tinh_đien_bien', '6_tinh_lai_chau', '7_tinh_son_la', '8_tinh_thai_nguyen',
  '9_tinh_lang_son', '10_tinh_quang_ninh', '11_tinh_phu_tho', '12_tinh_bac_ninh',
  '13_hai_phong', '14_tinh_hung_yen', '15_tinh_ninh_binh', '16_tinh_thanh_hoa',
  '17_tinh_nghe_an', '18_tinh_ha_tinh', '19_tinh_quang_tri', '20_hue',
  '21_đa_nang', '22_tinh_quang_ngai', '23_tinh_khanh_hoa', '24_tinh_gia_lai',
  '25_tinh_đak_lak', '26_tinh_lam_đong', '27_tinh_tay_ninh', '28_tinh_đong_nai',
  '29_ho_chi_minh', '30_tinh_vinh_long', '31_tinh_đong_thap', '32_tinh_an_giang',
  '33_can_tho', '34_tinh_ca_mau',
];

export interface Source {
  /** Tên file trong thư mục .cache */
  file: string;
  url: string;
}

export const WORLD_SOURCE: Source = {
  file: 'ne_10m_admin_0_countries_vnm.geojson',
  url: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_COMMIT}/geojson/ne_10m_admin_0_countries_vnm.geojson`,
};

export const OLD_PROVINCES_SOURCE: Source = {
  file: 'geoBoundaries-VNM-ADM1.geojson',
  url: `https://github.com/wmgeolab/geoBoundaries/raw/${GEOBOUNDARIES_COMMIT}/releaseData/gbOpen/VNM/ADM1/geoBoundaries-VNM-ADM1.geojson`,
};

export const PROVINCE_SOURCES: Source[] = PROVINCE_FOLDERS.map((folder) => ({
  file: `province-${folder.split('_')[0]}.geojson`,
  url:
    `https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/${PROVINCES_DB_COMMIT}` +
    `/dataset-generation-scripts/resources/gis/geojson_11Mar2026/${encodeURIComponent(folder)}/province.geojson`,
}));

export const ALL_SOURCES: Source[] = [WORLD_SOURCE, OLD_PROVINCES_SOURCE, ...PROVINCE_SOURCES];

export function cachePath(source: Source): string {
  return path.join(CACHE_DIR, source.file);
}
