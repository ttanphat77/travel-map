import rawProvinces from './provinces-34.json';

export type ProvinceCode = string;
export type OldProvinceCode = string;
export type AdminKind = 'thanh-pho' | 'tinh';

export interface OldProvinceInfo {
  oldCode: OldProvinceCode;
  name: string;
  kind: AdminKind;
}

export interface ProvinceInfo {
  code: ProvinceCode;
  name: string;
  kind: AdminKind;
  /** Mã `matinh` trong dữ liệu sapnhap.bando.com.vn. Chỉ script dữ liệu dùng mã này. */
  bandoId: string;
  oldProvinces: OldProvinceInfo[];
}

export const PROVINCES: readonly ProvinceInfo[] = rawProvinces as ProvinceInfo[];

const byCode = new Map(PROVINCES.map((p) => [p.code, p]));

export function getProvince(code: ProvinceCode): ProvinceInfo | undefined {
  return byCode.get(code);
}

/** Ghép tên hiển thị. Thành phố có thêm tiền tố "TP.". */
export function displayName(item: { name: string; kind: AdminKind }): string {
  return item.kind === 'thanh-pho' ? `TP. ${item.name}` : item.name;
}
