import path from 'node:path';
import type { FeatureCollection } from 'geojson';
import { readJson, runMapshaper, single, writeText } from './lib';
import { OUTPUT_DIR, WORLD_SOURCE, cachePath } from './sources';

/** Mức giản lược: tỉ lệ đỉnh được giữ lại. Chỉnh số này để đạt ngân sách dung lượng. */
const WORLD_SIMPLIFY = '4%';

async function main(): Promise<void> {
  const world = await readJson<FeatureCollection>(cachePath(WORLD_SOURCE));
  const output = await runMapshaper(
    [
      '-i world.json',
      '-filter-fields ADM0_A3,NAME_VI,NAME',
      '-rename-fields id=ADM0_A3,name=NAME_VI,nameEn=NAME',
      // keep-shapes chỉ giữ mỗi đối tượng không biến mất, không giữ từng đảo.
      // Vì vậy script tách từng đảo ra trước khi giản lược, rồi gộp lại theo id.
      '-explode',
      `-simplify ${WORLD_SIMPLIFY} keep-shapes`,
      '-dissolve id copy-fields=name,nameEn',
      '-rename-layers countries',
      '-o world.topo.json format=topojson quantization=100000',
    ].join(' '),
    { 'world.json': world },
  );
  const text = single(output);
  const file = path.join(OUTPUT_DIR, 'world.topo.json');
  await writeText(file, text);
  console.log(`Đã ghi world.topo.json (${Math.round(Buffer.byteLength(text) / 1024)} KB)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
