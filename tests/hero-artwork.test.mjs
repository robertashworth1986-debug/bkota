import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url));

test('retained hero masters match the measured, non-upscaled dimensions', async () => {
  for (const [name, width, height] of [
    ['hands-of-kindness-v2.png', 1672, 941],
    ['hands-of-kindness-v2-mobile.png', 1122, 1402]
  ]) {
    const buffer = await read(`assets/${name}`);
    assert.equal(buffer.subarray(1, 4).toString(), 'PNG');
    assert.equal(buffer.readUInt32BE(16), width);
    assert.equal(buffer.readUInt32BE(20), height);
  }
});

test('all responsive hero candidates exist and are available to the offline shell', async () => {
  const html = (await read('index.html')).toString();
  const worker = (await read('sw.js')).toString();
  const picture = html.match(/<picture class="hero-media">([\s\S]*?)<\/picture>/)?.[1];
  assert.ok(picture);
  const candidates = [...picture.matchAll(/assets\/hands-of-kindness-v2[\w.-]*\.(?:avif|webp)/g)].map(([path]) => path);
  assert.equal(new Set(candidates).size, 6);
  for (const path of candidates) {
    assert.ok((await read(path)).length > 0);
    assert.ok(worker.includes(`"${path}"`), `Offline shell misses ${path}`);
  }
  assert.match(picture, /width="1672" height="941"/);
  for (const attribute of ['oil-x', 'oil-y', 'oil-mobile-x', 'oil-mobile-y']) {
    const value = Number(picture.match(new RegExp(`data-${attribute}="([^"]+)"`))?.[1]);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `Missing measured ${attribute}`);
  }
});

test('the original landscape and portrait artwork are preserved', async () => {
  for (const name of ['hands-of-kindness-hero.png', 'hands-of-kindness-hero-mobile.png']) {
    assert.ok((await read(`assets/${name}`)).length > 0);
  }
});
