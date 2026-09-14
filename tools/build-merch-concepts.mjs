import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const canvas = Object.freeze({ width: 1122, height: 1402 });
const exactText = Object.freeze({
  brand: 'BKOTA',
  message: 'Be Kind One To Another',
  scripture: 'Ephesians 4:32',
});

const concepts = [
  {
    source: 'design-sources/merch-v1/bkota-concept-01-midnight-aureole-source-v1.png',
    output: 'assets/merch/bkota-concept-01-midnight-aureole-v1.png',
    preview: 'assets/merch/bkota-concept-01-midnight-aureole-560-v1.webp',
    sourceSha256: '2b81b9d9948a2532d17400b3d7151aef2f2c8ac02cfa755684d1416b10944739',
    family: "Georgia, 'Times New Roman', serif",
    primary: '#f5ead2',
    accent: '#d9a93b',
    outline: '#091529',
    ornament: 'aureole',
  },
  {
    source: 'design-sources/merch-v1/bkota-concept-02-sunday-window-source-v1.png',
    output: 'assets/merch/bkota-concept-02-sunday-window-v1.png',
    preview: 'assets/merch/bkota-concept-02-sunday-window-560-v1.webp',
    sourceSha256: 'bf36fa1127e2f4b057e3c46b3fabe019e8de8c2a6acec5d2a0510f656b260f81',
    family: "Arial, Helvetica, sans-serif",
    primary: '#102c55',
    accent: '#a46a16',
    outline: '#fff8e9',
    ornament: 'window',
  },
  {
    source: 'design-sources/merch-v1/bkota-concept-03-evergreen-grove-source-v1.png',
    output: 'assets/merch/bkota-concept-03-evergreen-grove-v1.png',
    preview: 'assets/merch/bkota-concept-03-evergreen-grove-560-v1.webp',
    sourceSha256: '380db41a59e94d8112ef6a5d7d3c0b7fd12231b16d5f1a489ac43622884e722a',
    family: "Georgia, 'Times New Roman', serif",
    primary: '#fff3d5',
    accent: '#d8b56b',
    outline: '#0e352a',
    ornament: 'grove',
  },
  {
    source: 'design-sources/merch-v1/bkota-concept-04-indigo-mended-light-source-v1.png',
    output: 'assets/merch/bkota-concept-04-indigo-mended-light-v1.png',
    preview: 'assets/merch/bkota-concept-04-indigo-mended-light-560-v1.webp',
    sourceSha256: '2c23bd15b6f778f695d9d185832dfee2ac5f3eb6f6a5167b2c7871ca294159a7',
    family: "'Arial Narrow', Arial, sans-serif",
    primary: '#f2ead7',
    accent: '#d69a58',
    outline: '#102a49',
    ornament: 'mended',
  },
  {
    source: 'design-sources/merch-v1/bkota-concept-05-oxblood-unity-source-v1.png',
    output: 'assets/merch/bkota-concept-05-oxblood-unity-v1.png',
    preview: 'assets/merch/bkota-concept-05-oxblood-unity-560-v1.webp',
    sourceSha256: '7ad5f0623446cf35a78552256b0d1a4c2eedda709f63c6abe07353a6b4bc4d45',
    family: "'Trebuchet MS', Arial, sans-serif",
    primary: '#ffe8dc',
    accent: '#e3b45b',
    outline: '#4a101b',
    ornament: 'unity',
  },
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function ornamentMarkup(kind, accent) {
  if (kind === 'aureole') {
    return `<g fill="none" stroke="${accent}" opacity="0.82">
      <path d="M365 477 H757" stroke-width="2"/>
      <circle cx="343" cy="477" r="4" fill="${accent}" stroke="none"/>
      <circle cx="779" cy="477" r="4" fill="${accent}" stroke="none"/>
      <path d="M417 620 H705" stroke-width="1.5"/>
    </g>`;
  }
  if (kind === 'window') {
    return `<g fill="none" stroke="${accent}" opacity="0.9" stroke-width="2">
      <path d="M561 355 l12 12 -12 12 -12 -12 Z"/>
      <path d="M411 477 H711 M437 620 H685"/>
    </g>`;
  }
  if (kind === 'grove') {
    return `<g fill="none" stroke="${accent}" opacity="0.9" stroke-width="2">
      <path d="M405 477 C455 461 505 461 541 477 M581 477 C617 461 667 461 717 477"/>
      <path d="M417 620 H705"/>
      <ellipse cx="391" cy="478" rx="10" ry="4" transform="rotate(-25 391 478)"/>
      <ellipse cx="731" cy="478" rx="10" ry="4" transform="rotate(25 731 478)"/>
    </g>`;
  }
  if (kind === 'mended') {
    return `<g fill="none" stroke="${accent}" opacity="0.9">
      <path d="M371 477 H751" stroke-width="2" stroke-dasharray="6 8"/>
      <path d="M421 620 H701" stroke-width="2" stroke-dasharray="3 7"/>
      <path d="M389 469 v16 M733 469 v16" stroke-width="2"/>
    </g>`;
  }
  return `<g fill="none" stroke="${accent}" opacity="0.9" stroke-width="2">
    <path d="M388 477 C438 451 477 451 521 477 M601 477 C645 451 684 451 734 477"/>
    <path d="M421 620 C470 638 514 638 561 620 C608 638 652 638 701 620"/>
    <circle cx="561" cy="477" r="4" fill="${accent}" stroke="none"/>
  </g>`;
}

function overlaySvg(concept) {
  const { family, primary, accent, outline, ornament } = concept;
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.4" flood-color="${outline}" flood-opacity="0.32"/>
      </filter>
    </defs>
    ${ornamentMarkup(ornament, accent)}
    <g text-anchor="middle" font-family="${family}" filter="url(#shadow)" style="paint-order:stroke fill">
      <text x="561" y="447" fill="${accent}" stroke="${outline}" stroke-width="1.2" font-size="78" font-weight="700" letter-spacing="13" textLength="420" lengthAdjust="spacingAndGlyphs">${exactText.brand}</text>
      <text x="561" y="579" fill="${primary}" stroke="${outline}" stroke-width="1.4" font-size="54" font-weight="700" textLength="650" lengthAdjust="spacingAndGlyphs">${exactText.message}</text>
      <text x="561" y="676" fill="${accent}" stroke="${outline}" stroke-width="1" font-size="30" font-weight="700" letter-spacing="4" textLength="338" lengthAdjust="spacingAndGlyphs">${exactText.scripture}</text>
    </g>
  </svg>`);
}

for (const concept of concepts) {
  const sourcePath = resolve(root, concept.source);
  const outputPath = resolve(root, concept.output);
  const source = await readFile(sourcePath);
  const actualSourceHash = sha256(source);
  if (actualSourceHash !== concept.sourceSha256) {
    throw new Error(`${concept.source}: source SHA-256 mismatch; refusing to build`);
  }

  const metadata = await sharp(source).metadata();
  if (metadata.width !== canvas.width || metadata.height !== canvas.height) {
    throw new Error(`${concept.source}: expected ${canvas.width}x${canvas.height}, got ${metadata.width}x${metadata.height}`);
  }

  await sharp(source)
    .composite([{ input: overlaySvg(concept), left: 0, top: 0 }])
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  const output = await readFile(outputPath);
  const previewPath = resolve(root, concept.preview);
  await sharp(output)
    .resize({ width: 560, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(previewPath);
  const preview = await readFile(previewPath);
  console.log(JSON.stringify({
    output: concept.output.replaceAll('\\\\', '/'),
    preview: concept.preview.replaceAll('\\\\', '/'),
    width: canvas.width,
    height: canvas.height,
    bytes: output.byteLength,
    sha256: sha256(output),
    previewBytes: preview.byteLength,
    previewSha256: sha256(preview),
    text: exactText,
  }));
}
