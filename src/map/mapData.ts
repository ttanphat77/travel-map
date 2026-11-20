import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export interface CountryProps {
  id: string;
  name: string;
  nameEn: string;
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

/** Tải và giải nén hai file bản đồ. */
export async function loadMapData(baseUrl = import.meta.env.BASE_URL): Promise<MapData> {
  const [world, vn] = await Promise.all([
    fetchTopology(`${baseUrl}data/world.topo.json`),
    fetchTopology(`${baseUrl}data/vn.topo.json`),
  ]);
  return {
    countries: layer<CountryProps>(world, 'countries'),
    provinces: layer<ProvinceProps>(vn, 'provinces'),
    oldProvinces: layer<OldProvinceProps>(vn, 'oldProvinces'),
    oldBorders: layer<BorderProps>(vn, 'oldBorders'),
    islandLabels: layer<IslandLabelProps>(vn, 'islandLabels').features as Feature<Point, IslandLabelProps>[],
  };
}
