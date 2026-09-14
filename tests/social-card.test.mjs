import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';

const cardUrl = new URL('../assets/bkota-social-card-v1.png', import.meta.url);

test('Arthur social card is an exact, bounded 1200 by 630 PNG used by both preview protocols', async () => {
  const metadata = await sharp(fileURLToPath(cardUrl)).metadata();
  const details = await stat(cardUrl);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.ok(details.size > 50_000 && details.size <= 1_500_000, `Unexpected social-card size: ${details.size}`);
  assert.match(html, /<meta property="og:image" content="https:\/\/bkota\.co\/assets\/bkota-social-card-v1\.png">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/bkota\.co\/assets\/bkota-social-card-v1\.png">/);
});
