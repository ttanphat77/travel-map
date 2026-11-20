import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import mapshaper from 'mapshaper';
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon, Position } from 'geojson';

export async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, 'utf8')) as T;
}

export async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

/**
 * Chạy lệnh mapshaper trên dữ liệu trong bộ nhớ.
 * `inputs` là bảng từ tên file ảo sang nội dung GeoJSON.
 * Kết quả là bảng từ tên file đầu ra sang nội dung dạng chuỗi.
 */
export async function runMapshaper(
  commands: string,
  inputs: Record<string, unknown>,
): Promise<Record<string, string>> {
  const output = (await mapshaper.applyCommands(commands, inputs)) as Record<string, string | Buffer>;
  const result: Record<string, string> = {};
  for (const [name, content] of Object.entries(output)) {
    result[name] = typeof content === 'string' ? content : content.toString('utf8');
  }
  return result;
}

export function single(output: Record<string, string>): string {
  const values = Object.values(output);
  if (values.length !== 1 || values[0] === undefined) {
    throw new Error(`mapshaper trả về ${values.length} file, cần đúng 1 file`);
  }
  return values[0];
}

/** Trả về danh sách polygon (mỗi polygon là mảng ring) của một geometry. */
export function polygonsOf(geometry: Geometry | null): Position[][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(polygonsOf);
  return [];
}

export function toMultiPolygon(polygons: Position[][][]): MultiPolygon {
  return { type: 'MultiPolygon', coordinates: polygons };
}

/** Tâm gần đúng của một polygon: trung bình các đỉnh của ring ngoài. Đủ dùng cho đảo nhỏ. */
export function ringCenter(polygon: Position[][]): [number, number] {
  const ring = polygon[0] ?? [];
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0] ?? 0;
    y += p[1] ?? 0;
  }
  return [x / ring.length, y / ring.length];
}

export function inBox([x, y]: [number, number], [x0, y0, x1, y1]: readonly number[]): boolean {
  return x >= (x0 ?? 0) && x <= (x1 ?? 0) && y >= (y0 ?? 0) && y <= (y1 ?? 0);
}

export function featureCollection<P>(features: Feature<Geometry, P>[]): FeatureCollection<Geometry, P> {
  return { type: 'FeatureCollection', features };
}

export type { Polygon };
