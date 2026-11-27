import type { PlaceRegion } from './types';
import { VIETNAM_ID } from './types';
import { PROVINCES, type ProvinceCode } from '../data/provinces';

/** Phần kết quả của Nominatim mà app cần để biết nước và tỉnh của một tọa độ. */
export interface RegionLookup {
  /** Mã nước ISO 3166-1 hai chữ, ví dụ "vn". */
  countryCode?: string;
  /** Mã vùng ISO 3166-2 của các cấp hành chính, ví dụ "VN-13" hay "CN-HK". */
  subdivisionCodes: string[];
  /** Tên tỉnh hoặc bang, ví dụ "Tỉnh An Giang". */
  stateName?: string;
}

/**
 * Mã ISO 3166-2 mà OpenStreetMap đang gắn cho 34 tỉnh mới, đổi sang mã tỉnh của app.
 * OpenStreetMap giữ mã ISO cũ cho tỉnh mới, nên mã không trùng với mã tỉnh của app.
 */
const VN_ISO_PROVINCES: Record<string, ProvinceCode> = {
  'VN-HN': '01',
  'VN-04': '04',
  'VN-07': '08',
  'VN-71': '11',
  'VN-01': '12',
  'VN-05': '14',
  'VN-02': '15',
  'VN-69': '19',
  'VN-09': '20',
  'VN-13': '22',
  'VN-56': '24',
  'VN-68': '25',
  'VN-HP': '31',
  'VN-66': '33',
  'VN-18': '37',
  'VN-21': '38',
  'VN-22': '40',
  'VN-23': '42',
  'VN-25': '44',
  'VN-26': '46',
  'VN-DN': '48',
  'VN-29': '51',
  'VN-30': '52',
  'VN-34': '56',
  'VN-33': '66',
  'VN-35': '68',
  'VN-39': '75',
  'VN-SG': '79',
  'VN-37': '80',
  'VN-45': '82',
  'VN-49': '86',
  'VN-44': '91',
  'VN-CT': '92',
  'VN-59': '96',
};

/**
 * Vùng mà OpenStreetMap xếp vào một nước, nhưng bản đồ của app tách thành vùng riêng.
 * Ví dụ Nominatim trả về Hồng Kông thuộc Trung Quốc với mã "CN-HK", còn bản đồ có vùng Hồng Kông riêng.
 */
const SEPARATE_SUBDIVISIONS: Record<string, string> = {
  'CN-HK': 'HK',
  'CN-MO': 'MO',
  'US-PR': 'PR',
  'US-GU': 'GU',
  'US-VI': 'VI',
  'US-AS': 'AS',
  'US-MP': 'MP',
};

/** Vùng có mã nước riêng, nhưng bản đồ của app gộp vào nước chủ quản. */
const MERGED_COUNTRIES: Record<string, string> = {
  RE: 'FR',
  GF: 'FR',
  GP: 'FR',
  MQ: 'FR',
  YT: 'FR',
  SJ: 'NO',
  BQ: 'NL',
};

/** Bỏ tiền tố "Tỉnh" hay "Thành phố" và đưa về chữ thường, để so tên tỉnh. */
function provinceKey(name: string): string {
  return name
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/^(tỉnh|thành phố|tp\.)\s+/u, '')
    .trim();
}

const provincesByName = new Map(PROVINCES.map((p) => [provinceKey(p.name), p.code]));

function vietnamProvince(lookup: RegionLookup): ProvinceCode | undefined {
  for (const code of lookup.subdivisionCodes) {
    const province = VN_ISO_PROVINCES[code];
    if (province) return province;
  }
  // Dự phòng khi OpenStreetMap đổi mã ISO: so theo tên tỉnh.
  return lookup.stateName ? provincesByName.get(provinceKey(lookup.stateName)) : undefined;
}

/**
 * Đổi kết quả của Nominatim thành nước và tỉnh theo mã của app.
 * `countryIdOf` đổi mã nước hai chữ sang mã vùng của bản đồ, ví dụ "VN" thành "VNM".
 * Kết quả null nghĩa là Nominatim không tìm thấy nước nào chứa tọa độ.
 */
export function resolveRegion(lookup: RegionLookup | null, countryIdOf: (iso2: string) => string | undefined): PlaceRegion {
  if (!lookup?.countryCode) return {};
  const separate = lookup.subdivisionCodes.map((code) => SEPARATE_SUBDIVISIONS[code]).find(Boolean);
  const iso2 = lookup.countryCode.toUpperCase();
  const countryId = countryIdOf(separate ?? MERGED_COUNTRIES[iso2] ?? iso2);
  if (!countryId) return {};
  if (countryId !== VIETNAM_ID) return { countryId };
  const provinceCode = vietnamProvince(lookup);
  return provinceCode ? { countryId, provinceCode } : { countryId };
}
