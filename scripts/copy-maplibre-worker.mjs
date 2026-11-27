// Chép file worker của MapLibre vào public/maplibre để Next.js phục vụ như một file tĩnh.
// MapLibre tự tìm worker cạnh file JavaScript của nó. Sau khi Turbopack đóng gói, đường dẫn đó không còn đúng,
// nên app chỉ đường cho MapLibre bằng setWorkerUrl('/maplibre/maplibre-gl-worker.mjs').
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const targetDir = path.join(root, 'public', 'maplibre');
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, path.join(targetDir, 'maplibre-gl-worker.mjs'));
console.log('Đã chép worker của MapLibre vào public/maplibre');
