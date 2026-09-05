import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../merch.js', import.meta.url), 'utf8');
const { VERSE, PALETTES, TYPEFACES, normalizeSettings, createArtwork, createShirt, artworkFilename } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const html = await readFile(new URL('../merch.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../merch.css', import.meta.url), 'utf8');
const exactVerse = 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ’s sake hath forgiven you.';

test('scripture remains the complete Ephesians 4:32 KJV text', () => {
  assert.equal(VERSE, exactVerse);
  assert.ok(html.includes(exactVerse));
  const back = createArtwork({ side: 'back' });
  const verseGroup = back.match(/<g text-anchor="middle"[^>]*>([\s\S]*?)<\/g>/)[1];
  const printableText = [...verseGroup.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(match => match[1]).join(' ');
  assert.equal(printableText, exactVerse);
});

test('every palette and typeface has both complete editable artwork sides', () => {
  for (const palette of Object.keys(PALETTES)) for (const typeface of Object.keys(TYPEFACES)) for (const side of ['front', 'back']) {
    const svg = createArtwork({ side, palette, typeface });
    assert.ok(svg.includes('viewBox="0 0 4000 5000"'));
    assert.ok(svg.includes('width="12in" height="15in"'));
    assert.ok(svg.includes(PALETTES[palette].ink));
    assert.ok(svg.includes(TYPEFACES[typeface].family));
    assert.ok(svg.includes('physical proof'));
    assert.ok(!/<image|<script|<foreignObject|<style/i.test(svg));
    if (side === 'front') for (const text of ['BE KIND', 'ONE TO', 'ANOTHER', 'EPHESIANS 4:32']) assert.ok(svg.includes(text));
    else assert.ok(svg.includes('EPHESIANS 4:32 · KJV'));
  }
});

test('unknown or injected settings fail to fixed safe defaults', () => {
  assert.deepEqual(normalizeSettings({ side: '<script>', palette: '__proto__', typeface: 'constructor' }), { side: 'front', palette: 'midnight', typeface: 'sans' });
  assert.ok(!createArtwork({ idPrefix: '" onload="alert(1)' }).includes('onload'));
  assert.equal(artworkFilename({ side: 'back', palette: 'ivory', typeface: 'serif' }), 'bkota-back-ivory-serif.svg');
});

test('static no-JavaScript SVG downloads match the canonical design generator', async () => {
  for (const side of ['front', 'back']) {
    const staticSvg = await readFile(new URL(`../assets/merch/bkota-${side}-midnight.svg`, import.meta.url), 'utf8');
    assert.equal(staticSvg.trim(), createArtwork({ side }).trim());
  }
});

test('garment preview labels its model limits and keeps readable source art', () => {
  const svg = createShirt({ side: 'back', palette: 'forest' });
  assert.ok(svg.includes('not a photograph or a physically accurate three-dimensional garment model'));
  assert.ok(svg.includes('x="264" y="272" width="472" height="590"'));
  assert.ok(svg.includes(exactVerse));
});

test('studio includes accessible controls, flat mode, downloads, and reduced motion', () => {
  assert.match(html, /<dialog[^>]*aria-labelledby="dialogTitle"/);
  assert.ok(html.includes('data-mode="art"'));
  assert.ok(html.includes('name="palette"'));
  assert.ok(html.includes('name="typeface"'));
  assert.ok(html.includes('id="downloadFront"'));
  assert.ok(html.includes('id="downloadBack"'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(source.includes('ArrowLeft'));
  assert.ok(source.includes('URL.revokeObjectURL'));
  assert.ok(source.includes("dialog.addEventListener('close'"));
  assert.ok(!/fetch\(|localStorage|sessionStorage|XMLHttpRequest|navigator\.sendBeacon/.test(source));
});

test('all palette artwork inks have strong screen contrast against garment color', () => {
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(pair => parseInt(pair, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  }
  for (const palette of Object.values(PALETTES)) for (const ink of [palette.ink, palette.accent]) {
    const values = [luminance(ink), luminance(palette.garment)].sort((a, b) => b - a);
    assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${palette.name} ink must meet 4.5:1 screen contrast`);
  }
});
