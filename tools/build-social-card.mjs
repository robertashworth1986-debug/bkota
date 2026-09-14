import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'design-sources', 'social-v1', 'bkota-social-card-source-v1.png');
const output = resolve(root, 'assets', 'bkota-social-card-v1.png');
const expectedSourceSha256 = 'd862fef0eaf2751bdb1f767666cc4cbb84ff89f3b7538677a5af39c006a95b6c';

const sourceBytes = await readFile(source);
const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(`Social-card source SHA-256 mismatch: expected ${expectedSourceSha256}, got ${sourceSha256}`);
}
const sourceMetadata = await sharp(sourceBytes).metadata();
if (sourceMetadata.format !== 'png' || sourceMetadata.width !== 1730 || sourceMetadata.height !== 909) {
  throw new Error(`Unexpected social-card source: ${sourceMetadata.width}x${sourceMetadata.height} ${sourceMetadata.format}`);
}

const overlay = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#020914" stop-opacity="0.92"/>
      <stop offset="0.46" stop-color="#061426" stop-opacity="0.75"/>
      <stop offset="0.70" stop-color="#061426" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#061426" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="#000814" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <circle cx="74" cy="74" r="30" fill="#081426" fill-opacity="0.62" stroke="#f3d790" stroke-width="2"/>
  <text x="74" y="86" fill="#f3d790" font-family="Georgia, serif" font-size="35" text-anchor="middle">B</text>
  <text x="121" y="82" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="5">BKOTA</text>
  <line x1="60" y1="145" x2="118" y2="145" stroke="#dba843" stroke-width="3"/>
  <text x="60" y="192" fill="#f3d790" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">ARTHUR FARMER'S ORIGINAL VISION</text>
  <text x="54" y="315" fill="#ffffff" font-family="Georgia, serif" font-size="104" font-weight="700" filter="url(#shadow)">Be kind.</text>
  <text x="54" y="405" fill="#f3d790" font-family="Georgia, serif" font-size="72" font-style="italic" filter="url(#shadow)">One to another.</text>
  <text x="60" y="482" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4">EPHESIANS 4:32</text>
  <text x="60" y="537" fill="#d9e2ec" font-family="Arial, sans-serif" font-size="22">One kind act. Pass it on.</text>
</svg>`);

await sharp(sourceBytes)
  .resize(1200, 630, { fit: 'cover', position: 'centre', withoutEnlargement: true })
  .composite([{ input: overlay, blend: 'over' }])
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(output);

const metadata = await sharp(output).metadata();
if (metadata.width !== 1200 || metadata.height !== 630 || metadata.format !== 'png') {
  throw new Error(`Unexpected social-card output: ${metadata.width}x${metadata.height} ${metadata.format}`);
}
console.log(`BKOTA social card prepared: ${metadata.width}x${metadata.height} PNG`);
