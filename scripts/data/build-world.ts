import path from 'node:path';
import type { FeatureCollection } from 'geojson';
import { readJson, runMapshaper, single, writeText } from './lib';
import { OUTPUT_DIR, WORLD_SOURCE, cachePath } from './sources';

/** Mức giản lược: tỉ lệ đỉnh được giữ lại. Chỉnh số này để đạt ngân sách dung lượng. */
const WORLD_SIMPLIFY = '4%';

/**
 * Gắn mã nước hai chữ (ISO 3166-1) vào vùng chính của mỗi mã, trong trường MAIN_ISO2.
 * App dùng mã này để đổi kết quả của Nominatim sang mã vùng của bản đồ.
 * Một mã có thể ứng với nhiều vùng, ví dụ Pháp và đảo Clipperton cùng mã "FR". Khi đó vùng đông dân nhất được giữ mã.
 */
function markMainIso2(world: FeatureCollection): void {
  const main = new Map<string, Record<string, unknown>>();
  for (const feature of world.features) {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const code = [props.ISO_A2_EH, props.ISO_A2].find((value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value));
    if (typeof code !== 'string') continue;
    const current = main.get(code);
    if (!current || Number(props.POP_EST) > Number(current.POP_EST)) main.set(code, props);
  }
  for (const [code, props] of main) props.MAIN_ISO2 = code;
}

async function main(): Promise<void> {
  const world = await readJson<FeatureCollection>(cachePath(WORLD_SOURCE));
  markMainIso2(world);
  const output = await runMapshaper(
    [
      '-i world.json',
      '-filter-fields ADM0_A3,NAME_VI,NAME,WIKIDATAID,MAIN_ISO2',
      '-rename-fields id=ADM0_A3,name=NAME_VI,nameEn=NAME,wikidata=WIKIDATAID,iso2=MAIN_ISO2',
      // keep-shapes chỉ giữ mỗi đối tượng không biến mất, không giữ từng đảo.
      // Vì vậy script tách từng đảo ra trước khi giản lược, rồi gộp lại theo id.
      '-explode',
      `-simplify ${WORLD_SIMPLIFY} keep-shapes`,
      '-dissolve id copy-fields=name,nameEn,wikidata,iso2',
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
