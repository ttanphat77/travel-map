import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { feature, neighbors } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { boxOfRings, outerRings, ringArea, type Box } from './geometry';

export interface CountryProps {
  id: string;
  name: string;
  nameEn: string;
  /** Mã Wikidata, lấy từ Natural Earth. */
  wikidata?: string;
  /** Mã nước hai chữ (ISO 3166-1), ví dụ "VN". Vùng phụ có chung mã với nước chính thì không có trường này. */
  iso2?: string;
}

/** Thông tin địa lý tính từ ranh giới 34 tỉnh. */
export interface ProvinceGeo {
  /** Mã các tỉnh có chung đường ranh giới. */
  neighbors: string[];
  /** Khung bao [tây, nam, đông, bắc], không tính các đảo rất nhỏ ở xa như Hoàng Sa và Trường Sa. */
  box: Box;
}

export interface ProvinceProps {
  code: string;
  name: string;
}

export interface OldProvinceProps {
  oldCode: string;
  code: string;
}

export interface BorderProps {
  code: string;
}

export interface IslandLabelProps {
  name: string;
  code: string;
}

export interface MapData {
  countries: FeatureCollection<Geometry, CountryProps>;
  provinces: FeatureCollection<Geometry, ProvinceProps>;
  oldProvinces: FeatureCollection<Geometry, OldProvinceProps>;
  oldBorders: FeatureCollection<Geometry, BorderProps>;
  islandLabels: Feature<Point, IslandLabelProps>[];
  provinceGeo: Record<string, ProvinceGeo>;
}

/**
 * Khung bao của các phần đất có diện tích từ 0,5% phần đất lớn nhất trở lên.
 * Cách này giữ Phú Quốc và Côn Đảo, nhưng bỏ các đảo nhỏ ở Hoàng Sa và Trường Sa.
 */
function landBox(geometry: Geometry): Box {
  const rings = outerRings(geometry);
  const largest = Math.max(...rings.map(ringArea));
  return boxOfRings(rings.filter((ring) => ringArea(ring) >= largest * 0.005)) ?? [0, 0, 0, 0];
}

function provinceGeography(topology: Topology, provinces: FeatureCollection<Geometry, ProvinceProps>): Record<string, ProvinceGeo> {
  const object = topology.objects.provinces as GeometryCollection<ProvinceProps>;
  // Kiểu của thư viện cho phép một hình không có thuộc tính, nên mã tỉnh được đọc qua hàm này.
  const codeAt = (index: number) => (object.geometries[index]?.properties as ProvinceProps | undefined)?.code;
  // Hai tỉnh giáp nhau khi dùng chung ít nhất một đoạn ranh giới trong dữ liệu TopoJSON.
  const adjacency = neighbors(object.geometries);
  const result: Record<string, ProvinceGeo> = {};
  object.geometries.forEach((_, index) => {
    const code = codeAt(index);
    const shape = provinces.features.find((f) => f.properties.code === code);
    if (!code || !shape) return;
    result[code] = {
      neighbors: (adjacency[index] ?? []).map(codeAt).filter((c): c is string => !!c),
      box: landBox(shape.geometry),
    };
  });
  return result;
}

function layer<P>(topology: Topology, name: string): FeatureCollection<Geometry, P> {
  const object = topology.objects[name] as GeometryCollection | undefined;
  if (!object) throw new Error(`Dữ liệu bản đồ thiếu lớp "${name}"`);
  return feature(topology, object) as unknown as FeatureCollection<Geometry, P>;
}

async function fetchTopology(url: string): Promise<Topology> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không tải được ${url} (mã lỗi ${response.status})`);
  return (await response.json()) as Topology;
}

/** Tải và giải nén hai file bản đồ. Next.js phục vụ thư mục `public` tại gốc trang web. */
export async function loadMapData(): Promise<MapData> {
  const [world, vn] = await Promise.all([
    fetchTopology('/data/world.topo.json'),
    fetchTopology('/data/vn.topo.json'),
  ]);
  const provinces = layer<ProvinceProps>(vn, 'provinces');
  return {
    countries: layer<CountryProps>(world, 'countries'),
    provinces,
    provinceGeo: provinceGeography(vn, provinces),
    oldProvinces: layer<OldProvinceProps>(vn, 'oldProvinces'),
    oldBorders: layer<BorderProps>(vn, 'oldBorders'),
    islandLabels: layer<IslandLabelProps>(vn, 'islandLabels').features as Feature<Point, IslandLabelProps>[],
  };
}
