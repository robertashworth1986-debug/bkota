import assert from 'node:assert/strict';
import { access, link, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { buildStatic, publicFiles } from '../tools/build-static.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bkota-build-test-'));
  // Only remove the exact temporary directory created by this test, never a project directory.
  t.after(async () => {
    assert.ok(resolve(root).startsWith(resolve(tmpdir(), 'bkota-build-test-')));
    await rm(root, { recursive: true, force: true });
  });
  const put = async (path, text) => {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  };
  for (const path of publicFiles) await put(path, path.endsWith('.webmanifest') ? '{}' : '');
  await put('assets/nested/mark.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  await put('assets/nested/photo one.webp', 'image fixture');
  await put('output/pdf/BKOTA-scripture-cards.pdf', '%PDF-1.4\nPUBLIC SCRIPTURE CARD FIXTURE');
  await put('output/private-not-for-publication.txt', 'DO NOT COPY');
  await put('index.html', '<html><head><link rel="stylesheet" href="styles.css"></head><body><a href="kindness-cards.html">Cards</a><img src="assets/nested/mark.svg"></body></html>');
  await put('kindness-cards.html', '<a href="output/pdf/BKOTA-scripture-cards.pdf">Scripture-card PDF</a>');
  return { root, put, output: join(root, 'dist'), read: (path) => readFile(join(root, path), 'utf8') };
}

test('clean static build includes the exact public PDF and validates packaged links', async (t) => {
  const f = await fixture(t);
  const result = await buildStatic({ rootDir: f.root });
  assert.equal(result.output, f.output);
  assert.ok(result.checkedLinks >= 4);
  assert.equal(await f.read('dist/output/pdf/BKOTA-scripture-cards.pdf'), await f.read('output/pdf/BKOTA-scripture-cards.pdf'));
  await assert.rejects(access(join(f.output, 'output/private-not-for-publication.txt')));
  assert.equal(await f.read('dist/index.html'), await f.read('index.html'));
  // Rebuilding expected files is supported and never requires deleting the output directory.
  await f.put('index.html', '<a href="kindness-cards.html">Updated page</a>');
  await buildStatic({ rootDir: f.root });
  assert.match(await f.read('dist/index.html'), /Updated page/);
});

test('a stale nested asset aborts before any existing output is overwritten', async (t) => {
  const f = await fixture(t);
  await f.put('dist/index.html', 'PREVIOUS BUILD');
  await f.put('dist/assets/nested/stale-private.txt', 'PRESERVE FOR REVIEW');
  await assert.rejects(buildStatic({ rootDir: f.root }), /Unexpected existing build entry: assets\/nested\/stale-private.txt/);
  assert.equal(await f.read('dist/index.html'), 'PREVIOUS BUILD');
  assert.equal(await f.read('dist/assets/nested/stale-private.txt'), 'PRESERVE FOR REVIEW');
});

test('unexpected nested output files and directories are not silently included', async (t) => {
  for (const path of ['dist/output/pdf/other.pdf', 'dist/assets/private-folder']) {
    const f = await fixture(t);
    await f.put('dist/index.html', 'PREVIOUS BUILD');
    if (path.endsWith('private-folder')) await mkdir(join(f.root, path), { recursive: true });
    else await f.put(path, 'DO NOT PUBLISH');
    await assert.rejects(buildStatic({ rootDir: f.root }), /Unexpected existing build entry/);
    assert.equal(await f.read('dist/index.html'), 'PREVIOUS BUILD');
    assert.ok(await lstat(join(f.root, path)));
  }
});

test('file-versus-directory output conflicts fail before copying', async (t) => {
  for (const conflict of ['directory-at-file', 'file-at-directory', 'file-at-output']) {
    const f = await fixture(t);
    if (conflict === 'directory-at-file') await mkdir(join(f.output, 'index.html'), { recursive: true });
    if (conflict === 'file-at-directory') await f.put('dist/assets', 'NOT A DIRECTORY');
    if (conflict === 'file-at-output') await f.put('dist', 'NOT A DIRECTORY');
    await assert.rejects(buildStatic({ rootDir: f.root }), /type conflict|output must be a directory/);
  }
});

test('source symlinks are rejected inside assets', async (t) => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'private-source'), { recursive: true });
  await f.put('private-source/secret.txt', 'PRIVATE');
  try { await symlink(join(f.root, 'private-source'), join(f.root, 'assets/linked'), 'junction'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('This environment cannot create test symlinks.'); throw error; }
  await assert.rejects(buildStatic({ rootDir: f.root }), /Symbolic links are not allowed.*assets\/linked/);
  await assert.rejects(access(f.output));
  assert.equal(await f.read('private-source/secret.txt'), 'PRIVATE');
});

test('the exact allowlisted PDF cannot follow a symlinked source output directory', async (t) => {
  const f = await fixture(t);
  await rename(join(f.root, 'output'), join(f.root, 'source-output'));
  try { await symlink(join(f.root, 'source-output'), join(f.root, 'output'), 'junction'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('This environment cannot create test symlinks.'); throw error; }
  await assert.rejects(buildStatic({ rootDir: f.root }), /Symbolic links are not allowed.*output/);
  await assert.rejects(access(f.output));
});

test('output symlinks and directory junctions never redirect copying', async (t) => {
  for (const destination of ['dist', 'dist/assets/nested']) {
    const f = await fixture(t);
    await f.put('outside-target/keep.txt', 'UNCHANGED');
    await mkdir(dirname(join(f.root, destination)), { recursive: true });
    try { await symlink(join(f.root, 'outside-target'), join(f.root, destination), 'junction'); }
    catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('This environment cannot create test symlinks.'); throw error; }
    await assert.rejects(buildStatic({ rootDir: f.root }), /Symbolic links are not allowed/);
    assert.equal(await f.read('outside-target/keep.txt'), 'UNCHANGED');
    await assert.rejects(access(join(f.root, 'outside-target/index.html')));
  }
});

test('hard-linked output files are not overwritten through another name', async (t) => {
  const f = await fixture(t);
  await f.put('outside-target/keep.txt', 'UNCHANGED');
  await mkdir(f.output);
  try { await link(join(f.root, 'outside-target/keep.txt'), join(f.output, 'index.html')); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('This environment cannot create test hard links.'); throw error; }
  await assert.rejects(buildStatic({ rootDir: f.root }), /multiple hard links/);
  assert.equal(await f.read('outside-target/keep.txt'), 'UNCHANGED');
});

test('a link to an existing but non-allowlisted source file fails the release preflight', async (t) => {
  const f = await fixture(t);
  await f.put('index.html', '<a href="output/private-not-for-publication.txt">Private output must not ship</a>');
  await assert.rejects(buildStatic({ rootDir: f.root }), /Missing packaged local link/);
  await assert.rejects(access(f.output));
});

test('responsive HTML, CSS, and manifest links are checked against the packaged files', async (t) => {
  const f = await fixture(t);
  await f.put('index.html', '<img srcset="assets/nested/mark.svg 1x,assets/nested/photo%20one.webp 2x"><a href="kindness-cards.html?one=1&amp;two=2#cards">Cards</a>');
  await f.put('styles.css', 'body { background: url("assets/nested/photo%20one.webp"); }');
  await f.put('manifest.webmanifest', JSON.stringify({ start_url: './?source=pwa', icons: [{ src: 'assets/nested/mark.svg' }] }));
  const result = await buildStatic({ rootDir: f.root });
  assert.ok(result.checkedLinks >= 7);
  await f.put('styles.css', 'body { background: url("assets/missing.webp"); }');
  await assert.rejects(buildStatic({ rootDir: f.root }), /Missing packaged local link: styles.css/);
});

test('missing responsive candidates are not hidden by a valid first candidate', async (t) => {
  const f = await fixture(t);
  await f.put('index.html', '<img srcset="assets/nested/mark.svg 1x,assets/missing.webp 2x">');
  await assert.rejects(buildStatic({ rootDir: f.root }), /Missing packaged local link/);
});

test('external links and fragment-only references do not require local files', async (t) => {
  const f = await fixture(t);
  await f.put('index.html', '<a href="https://example.test/about">External</a><a href="#section">Section</a><img src="data:image/svg+xml,test"><img srcset="data:image/png;base64,AA== 1x, assets/nested/mark.svg 2x">');
  await buildStatic({ rootDir: f.root });
});

test('root-relative, escaping, and malformed local references are rejected', async (t) => {
  for (const href of ['/styles.css', '../outside.txt', '%2e%2e/outside.txt', '%00.txt', '%E0%A4%A']) {
    const f = await fixture(t);
    await f.put('index.html', `<a href="${href}">Invalid target</a>`);
    await assert.rejects(buildStatic({ rootDir: f.root }), /local link|Local link/);
    await assert.rejects(access(f.output));
  }
});

test('build output cannot replace its source root, assets, or an external directory', async (t) => {
  const f = await fixture(t);
  for (const outputDir of [f.root, join(f.root, 'assets'), dirname(f.root), join(f.root, 'nested/dist')]) {
    await assert.rejects(buildStatic({ rootDir: f.root, outputDir }), /Static output/);
  }
});
