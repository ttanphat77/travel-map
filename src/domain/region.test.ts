import { describe, expect, it } from 'vitest';
import { PROVINCES } from '../data/provinces';
import { resolveRegion, type RegionLookup } from './region';

/** Bảng mã nước giả, đủ cho các ca thử. Trong app, bảng này lấy từ dữ liệu bản đồ. */
const COUNTRY_IDS: Record<string, string> = { VN: 'VNM', CN: 'CHN', HK: 'HKG', EC: 'ECU', US: 'USA', FR: 'FRA' };
const countryIdOf = (iso2: string) => COUNTRY_IDS[iso2];

const lookup = (countryCode: string, subdivisionCodes: string[], stateName?: string): RegionLookup => ({
  countryCode,
  subdivisionCodes,
  stateName,
});

describe('đổi kết quả Nominatim thành nước và tỉnh', () => {
  // Các kết quả dưới đây chép từ Nominatim (zoom 5) cho những điểm mà đường biên của bản đồ nhận sai.
  it.each([
    ['ghim giữa vịnh Hạ Long', lookup('vn', ['VN-13'], 'Thành phố Quảng Ninh'), { countryId: 'VNM', provinceCode: '22' }],
    ['Bãi Sao, Phú Quốc', lookup('vn', ['VN-44'], 'Tỉnh An Giang'), { countryId: 'VNM', provinceCode: '91' }],
    ['Hòn Bảy Cạnh, Côn Đảo', lookup('vn', ['VN-SG'], 'Thành phố Hồ Chí Minh'), { countryId: 'VNM', provinceCode: '79' }],
    ['giữa cảng Victoria', lookup('cn', ['CN-HK'], 'Hồng Kông'), { countryId: 'HKG' }],
    ['sân bay Baltra, Galápagos', lookup('ec', ['EC-W'], 'Galápagos'), { countryId: 'ECU' }],
    ['Molokini, Hawaii', lookup('us', ['US-HI'], 'Hạ Uy Di'), { countryId: 'USA' }],
    ['Réunion, gộp vào Pháp trên bản đồ', lookup('re', ['FR-974']), { countryId: 'FRA' }],
  ])('%s', (_name, input, expected) => {
    expect(resolveRegion(input, countryIdOf)).toEqual(expected);
  });

  it('trả về object rỗng khi Nominatim không tìm thấy nước nào, ví dụ giữa Biển Đông', () => {
    expect(resolveRegion(null, countryIdOf)).toEqual({});
  });

  it('trả về object rỗng khi bản đồ không có nước đó', () => {
    expect(resolveRegion(lookup('xk', []), countryIdOf)).toEqual({});
  });

  it('tìm tỉnh theo tên khi mã ISO không có trong bảng', () => {
    expect(resolveRegion(lookup('vn', ['VN-99'], 'Tỉnh Lâm Đồng'), countryIdOf)).toEqual({ countryId: 'VNM', provinceCode: '68' });
    expect(resolveRegion(lookup('vn', [], 'Thành phố Huế'), countryIdOf)).toEqual({ countryId: 'VNM', provinceCode: '46' });
  });

  it('bảng mã ISO phủ đủ 34 tỉnh, mỗi tỉnh đúng một lần', () => {
    // Mã ISO của 34 tỉnh cấp 4 trong OpenStreetMap, lấy qua Overpass.
    const osmCodes = [
      'VN-04', 'VN-59', 'VN-CT', 'VN-44', 'VN-45', 'VN-49', 'VN-30', 'VN-33', 'VN-35', 'VN-34', 'VN-29', 'VN-DN',
      'VN-26', 'VN-25', 'VN-23', 'VN-22', 'VN-21', 'VN-37', 'VN-18', 'VN-66', 'VN-HP', 'VN-56', 'VN-68', 'VN-13',
      'VN-69', 'VN-05', 'VN-01', 'VN-71', 'VN-02', 'VN-07', 'VN-HN', 'VN-39', 'VN-SG', 'VN-09',
    ];
    const mapped = osmCodes.map((iso) => resolveRegion(lookup('vn', [iso]), countryIdOf).provinceCode);
    expect(mapped.sort()).toEqual(PROVINCES.map((p) => p.code).sort());
  });
});
