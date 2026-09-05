import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(root, 'assets/merch/bkota-studio-v2.png');
const metadata = await sharp(input).metadata();
if (metadata.width !== 1536 || metadata.height !== 1024) {
  throw new Error('Update responsive dimensions and source attribution before using a different master.');
}
// Mechanical delivery encodings only. Do not alter the retained generated master.
for (const [width, filename] of [[1536, 'bkota-studio-v2.webp'], [800, 'bkota-studio-v2-800.webp']]) {
  const result = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 91, effort: 6 }).toFile(resolve(root, 'assets/merch', filename));
  console.log(`${filename}: ${result.width}x${result.height}, ${result.size} bytes`);
}
