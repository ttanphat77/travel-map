import path from 'node:path';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import provinces from '../../src/data/provinces-34.json';
import oldNames from './old-names.json';
import { extractIslands, labelPosition } from './islands';
import { featureCollection, polygonsOf, readJson, runMapshaper, single, toMultiPolygon, writeText } from './lib';
import area from '@turf/area';
import { DATA_DIR, OLD_PROVINCES_SOURCE, OUTPUT_DIR, PROVINCE_SOURCES, WORLD_SOURCE, cachePath } from './sources';

/** Mức giản lược của lớp tỉnh. Chỉnh số này để đạt ngân sách dung lượng. */
const PROVINCE_SIMPLIFY = '100%';
const DA_NANG = '48';
const KHANH_HOA = '56';

const normalize = (name: string) => name.normalize('NFC').trim().toLowerCase();

async function loadNewProvinces(): Promise<FeatureCollection> {
  const byBandoId = new Map(provinces.map((p) => [p.bandoId, p]));
  const features: Feature[] = [];
  for (const source of PROVINCE_SOURCES) {
    const fc = await readJson<FeatureCollection>(cachePath(source));
    for (const feature of fc.features) {
      const matinh = String(feature.properties?.matinh ?? '');
      const info = byBandoId.get(matinh);
      if (!info) throw new Error(`Không nối được matinh "${matinh}" trong ${source.file}`);
      features.push({
        type: 'Feature',
        properties: { code: info.code, name: info.name },
        geometry: toMultiPolygon(polygonsOf(feature.geometry)),
      });
    }
  }
  const codes = new Set(features.map((f) => f.properties?.code));
  if (features.length !== 34 || codes.size !== 34) {
    throw new Error(`Cần 34 tỉnh khác nhau, nhận được ${features.length} vùng và ${codes.size} mã`);
  }
  return featureCollection(features);
}

async function loadOldProvinces(): Promise<FeatureCollection> {
  const raw = await readJson<FeatureCollection>(cachePath(OLD_PROVINCES_SOURCE));
  const aliases = new Map(Object.entries(oldNames.aliases).map(([k, v]) => [normalize(k), v]));
  const byName = new Map<string, { oldCode: string; code: string }>();
  const codeOf = new Map<string, string>();
  for (const p of provinces) {
    for (const o of p.oldProvinces) {
      byName.set(normalize(o.name), { oldCode: o.oldCode, code: p.code });
      codeOf.set(o.oldCode, p.code);
    }
  }
  const features: Feature[] = raw.features.map((feature) => {
    const name = String(feature.properties?.shapeName ?? '');
    const oldCode = aliases.get(normalize(name)) ?? byName.get(normalize(name))?.oldCode;
    const code = oldCode ? codeOf.get(oldCode) : undefined;
    if (!oldCode || !code) throw new Error(`Không nối được tên tỉnh cũ "${name}"`);
    return { type: 'Feature', properties: { oldCode, code }, geometry: feature.geometry };
  });
  // Gộp Côn Đảo vào Bà Rịa - Vũng Tàu bằng cách gộp theo mã cũ.
  const dissolved = await runMapshaper(
    '-i old.json -dissolve oldCode copy-fields=code -o old.json format=geojson',
    { 'old.json': featureCollection(features) },
  );
  const result = JSON.parse(single(dissolved)) as FeatureCollection;
  if (result.features.length !== 63) {
    throw new Error(`Cần 63 tỉnh cũ sau khi gộp, nhận được ${result.features.length}`);
  }
  return result;
}

/**
 * Cắt mỗi nhóm tỉnh cũ theo đúng tỉnh mới chứa nhóm đó.
 * Tỉnh mới chỉ có một tỉnh cũ thì dùng luôn hình dạng của tỉnh mới.
 */
async function clipOldProvinces(newFc: FeatureCollection, oldFc: FeatureCollection): Promise<FeatureCollection> {
  const result: Feature[] = [];
  for (const province of provinces) {
    const newFeature = newFc.features.find((f) => f.properties?.code === province.code);
    if (!newFeature) throw new Error(`Thiếu tỉnh mới ${province.code}`);
    if (province.oldProvinces.length === 1) {
      const only = province.oldProvinces[0]!;
      result.push({ type: 'Feature', properties: { oldCode: only.oldCode, code: province.code }, geometry: newFeature.geometry });
      continue;
    }
    const group = oldFc.features.filter((f) => f.properties?.code === province.code);
    const clipped = await runMapshaper(
      '-i old.json -clip new.json remove-slivers -o out.json format=geojson',
      { 'old.json': featureCollection(group), 'new.json': featureCollection([newFeature]) },
    );
    result.push(...(JSON.parse(single(clipped)) as FeatureCollection).features);
  }
  return featureCollection(result);
}

/** Tạo các đường chia giữa những tỉnh cũ nằm trong cùng một tỉnh mới. Mỗi đường mang mã tỉnh mới. */
async function buildOldBorders(clipped: FeatureCollection): Promise<FeatureCollection<Geometry>> {
  const lines: Feature<Geometry>[] = [];
  for (const province of provinces) {
    if (province.oldProvinces.length < 2) continue;
    const group = clipped.features.filter((f) => f.properties?.code === province.code);
    const output = await runMapshaper('-i old.json -innerlines -o lines.json format=geojson geojson-type=FeatureCollection', {
      'old.json': featureCollection(group),
    });
    const fc = JSON.parse(single(output)) as FeatureCollection<Geometry>;
    if (fc.features.length === 0) throw new Error(`Tỉnh ${province.code} không có đường chia nào`);
    for (const feature of fc.features) {
      lines.push({ type: 'Feature', properties: { code: province.code }, geometry: feature.geometry });
    }
  }
  return featureCollection(lines);
}

/**
 * Đo độ khớp giữa tỉnh cũ (geoBoundaries) và tỉnh mới.
 * - coverage: phần trăm diện tích tỉnh mới được các tỉnh cũ sau khi cắt phủ kín.
 * - spill: phần trăm diện tích tỉnh cũ nằm ngoài tỉnh mới và bị cắt bỏ.
 */
async function writeAlignmentReport(
  newFc: FeatureCollection,
  oldFc: FeatureCollection,
  clipped: FeatureCollection,
): Promise<void> {
  const sum = (fc: FeatureCollection, code: string) =>
    fc.features.filter((f) => f.properties?.code === code).reduce((s, f) => s + area(f), 0);
  const rows = provinces
    .filter((p) => p.oldProvinces.length > 1)
    .map((p) => {
      const newArea = sum(newFc, p.code);
      const rawArea = sum(oldFc, p.code);
      const clippedArea = sum(clipped, p.code);
      return {
        code: p.code,
        name: p.name,
        coveragePercent: Number(((clippedArea / newArea) * 100).toFixed(2)),
        spillPercent: Number((((rawArea - clippedArea) / rawArea) * 100).toFixed(2)),
      };
    });
  await writeText(path.join(DATA_DIR, 'alignment-report.json'), JSON.stringify(rows, null, 2) + '\n');
  const worstCoverage = rows.reduce((a, b) => (b.coveragePercent < a.coveragePercent ? b : a));
  const worstSpill = rows.reduce((a, b) => (b.spillPercent > a.spillPercent ? b : a));
  console.log(
    `Độ phủ thấp nhất: ${worstCoverage.name} ${worstCoverage.coveragePercent}%. ` +
      `Phần bị cắt lớn nhất: ${worstSpill.name} ${worstSpill.spillPercent}%.`,
  );
}

function islandLabels(hoangSa: ReturnType<typeof extractIslands>['hoangSa'], truongSa: typeof hoangSa): FeatureCollection<Point> {
  const point = (coords: [number, number], name: string, code: string): Feature<Point> => ({
    type: 'Feature',
    properties: { name, code },
    geometry: { type: 'Point', coordinates: coords },
  });
  return featureCollection([
    point(labelPosition(hoangSa), 'Quần đảo Hoàng Sa', DA_NANG),
    point(labelPosition(truongSa), 'Quần đảo Trường Sa', KHANH_HOA),
  ]) as FeatureCollection<Point>;
}

async function main(): Promise<void> {
  const world = await readJson<FeatureCollection>(cachePath(WORLD_SOURCE));
  const { hoangSa, truongSa } = extractIslands(world);
  console.log(`Tách được ${hoangSa.length} đảo Hoàng Sa và ${truongSa.length} đảo Trường Sa`);

  const rawNew = await loadNewProvinces();
  for (const feature of rawNew.features) {
    const code = feature.properties?.code;
    const extra = code === DA_NANG ? hoangSa : code === KHANH_HOA ? truongSa : [];
    if (extra.length > 0) {
      feature.geometry = toMultiPolygon([...polygonsOf(feature.geometry), ...extra]);
    }
  }

  // Giản lược tỉnh mới trước, để tỉnh cũ được cắt theo đúng đường viền sẽ hiện trên bản đồ.
  const simplified = await runMapshaper(
    // Tách từng đảo ra trước khi giản lược để keep-shapes giữ được các đảo nhỏ, rồi gộp lại theo mã tỉnh.
    `-i new.json -explode -simplify ${PROVINCE_SIMPLIFY} keep-shapes -dissolve code copy-fields=name ` +
      '-o new.json format=geojson precision=0.0001',
    { 'new.json': rawNew },
  );
  const newFc = JSON.parse(single(simplified)) as FeatureCollection;

  const oldFc = await loadOldProvinces();
  const clipped = await clipOldProvinces(newFc, oldFc);

  const oldBorders = await buildOldBorders(clipped);
  await writeAlignmentReport(newFc, oldFc, clipped);

  const output = await runMapshaper(
    [
      '-i provinces.json oldProvinces.json oldBorders.json islandLabels.json combine-files',
      '-o vn.topo.json format=topojson target=* quantization=100000',
    ].join(' '),
    {
      'provinces.json': newFc,
      'oldProvinces.json': clipped,
      'oldBorders.json': oldBorders,
      'islandLabels.json': islandLabels(hoangSa, truongSa),
    },
  );
  const text = single(output);
  await writeText(path.join(OUTPUT_DIR, 'vn.topo.json'), text);
  console.log(
    `Đã ghi vn.topo.json (${Math.round(Buffer.byteLength(text) / 1024)} KB): ` +
      `${newFc.features.length} tỉnh, ${clipped.features.length} tỉnh cũ, ${oldBorders.features.length} đường chia`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
