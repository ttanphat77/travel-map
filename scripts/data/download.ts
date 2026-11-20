import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALL_SOURCES, CACHE_DIR, DATA_DIR, cachePath } from './sources';

/** Checksum được đưa vào dự án để phát hiện khi nguồn thay đổi. */
const CHECKSUM_FILE = path.join(DATA_DIR, 'checksums.json');

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function main(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const known: Record<string, string> = existsSync(CHECKSUM_FILE)
    ? JSON.parse(await readFile(CHECKSUM_FILE, 'utf8'))
    : {};
  const current: Record<string, string> = {};
  const changed: string[] = [];

  for (const source of ALL_SOURCES) {
    const target = cachePath(source);
    let buffer: Buffer;
    if (existsSync(target)) {
      buffer = await readFile(target);
    } else {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Tải thất bại (${response.status}): ${source.url}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(target, buffer);
      console.log(`Đã tải ${source.file} (${Math.round(buffer.length / 1024)} KB)`);
    }
    current[source.file] = sha256(buffer);
    const expected = known[source.file];
    if (expected && expected !== current[source.file]) {
      changed.push(source.file);
    }
  }

  if (changed.length > 0) {
    throw new Error(
      `Checksum đã thay đổi ở các file sau: ${changed.join(', ')}. ` +
        'Hãy kiểm tra nguồn rồi xóa checksums.json nếu thay đổi là đúng.',
    );
  }
  if (Object.keys(known).length === 0) {
    await writeFile(CHECKSUM_FILE, JSON.stringify(current, null, 2) + '\n');
    console.log('Đã ghi checksums.json lần đầu.');
  }
  console.log(`Đủ ${ALL_SOURCES.length} file nguồn, checksum khớp.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
