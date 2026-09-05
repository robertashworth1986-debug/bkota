import sharp from 'sharp';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const masters = [
  { name: 'hands-of-kindness-v2', width: 1672, height: 941, sizes: [1672, 1120] },
  { name: 'hands-of-kindness-v2-mobile', width: 1122, height: 1402, sizes: [1122] }
];

for (const master of masters) {
  const input = resolve(root, 'assets', `${master.name}.png`);
  const metadata = await sharp(input).metadata();
  if (metadata.width !== master.width || metadata.height !== master.height) {
    throw new Error(`Update image dimensions, responsive sources and artwork provenance for ${master.name} before encoding a different master.`);
  }
  for (const width of master.sizes) {
    const name = width === master.width ? master.name : `${master.name}-${width}`;
    // Mechanical encodings only: retain the inspected PNG, with no crop or enlargement.
    for (const format of ['webp', 'avif']) {
      const pipeline = sharp(input).resize({ width, withoutEnlargement: true });
      const output = resolve(root, 'assets', `${name}.${format}`);
      const result = format === 'webp'
        ? await pipeline.webp({ quality: 92, effort: 6 }).toFile(output)
        : await pipeline.avif({ quality: 68, effort: 6 }).toFile(output);
      console.log(`${name}.${format}: ${result.width}x${result.height}, ${result.size} bytes`);
    }
  }
}
