import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const publicFiles = Object.freeze([
  '.nojekyll', 'CNAME', 'index.html', 'styles.css', 'app.js', 'community.js', 'social-video.js',
  'config.js', 'merch.html', 'merch.css', 'merch.js', 'kindness-cards.html', 'cards.js',
  'privacy.html', 'privacy.js', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml',
  'sw.js', 'register-sw.js', 'output/pdf/BKOTA-scripture-cards.pdf'
]);

// These files are intentionally public even when no relative HTML/CSS reference
// reaches them. Everything else under assets/ must be referenced by a packaged
// document or fail the build. Keep the reason beside the path so additions are
// reviewable rather than silently inherited from a recursive directory copy.
export const retainedPublicAssets = Object.freeze({
  'assets/bkota-social-card-v1.png': 'absolute Open Graph and Twitter preview URL',
  'assets/hands-of-kindness-hero-mobile.avif': 'audited earlier portrait artwork retained for visual provenance',
  'assets/hands-of-kindness-hero-mobile.png': 'audited earlier portrait artwork retained for visual provenance',
  'assets/hands-of-kindness-hero-mobile.webp': 'audited earlier portrait artwork retained for visual provenance',
  'assets/hands-of-kindness-hero.avif': 'audited earlier landscape artwork retained for visual provenance',
  'assets/hands-of-kindness-hero.png': 'audited earlier landscape artwork retained for visual provenance',
  'assets/hands-of-kindness-hero.webp': 'audited earlier landscape artwork retained for visual provenance',
  'assets/hands-of-kindness-v2-mobile.png': 'documented full-resolution portrait hero master used by the media builder',
  'assets/merch/bkota-concept-01-midnight-aureole-v1.png': 'Arthur merchandise concept final',
  'assets/merch/bkota-concept-02-sunday-window-v1.png': 'Arthur merchandise concept final',
  'assets/merch/bkota-concept-03-evergreen-grove-v1.png': 'Arthur merchandise concept final',
  'assets/merch/bkota-concept-04-indigo-mended-light-v1.png': 'Arthur merchandise concept final',
  'assets/merch/bkota-concept-05-oxblood-unity-v1.png': 'Arthur merchandise concept final'
});

// These generated PNG masters contain a C2PA/JUMBF content-credential box.
// That is a deliberate provenance record, not a blanket allowance for metadata
// in future images. Text, EXIF, XMP, ICC, time, and unknown PNG chunks remain
// rejected below.
const pngsWithAuditedContentCredentials = new Set([
  'assets/hands-of-kindness-hero-mobile.png',
  'assets/hands-of-kindness-hero.png',
  'assets/hands-of-kindness-v2-mobile.png',
  'assets/hands-of-kindness-v2.png',
  'assets/kindness-world-3d-v1.png',
  'assets/merch/bkota-studio-v2.png',
  'assets/shirt-bkota-classic.png',
  'assets/shirt-caught-kind.png',
  'assets/shirt-forgive-repeat.png',
  'assets/shirt-kindness-global.png',
  'assets/shirt-tenderhearted.png'
]);

const PUBLIC_ASSET_EXTENSIONS = new Set(['.avif', '.png', '.svg', '.webp']);
const MAX_PUBLIC_ASSET_BYTES = 8 * 1024 * 1024;

async function inspect(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function safeType(stat, path) {
  if (stat?.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in the static build: ${path}`);
  if (stat?.isDirectory()) return 'directory';
  if (stat?.isFile()) return 'file';
  throw new Error(`Missing or unsupported static build path: ${path}`);
}

function assetExtension(path) {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index).toLowerCase();
}

function assertPublishableAssetPath(path) {
  if (typeof path !== 'string' || path !== posix.normalize(path) || !path.startsWith('assets/')
    || path.includes('\\') || path.includes('\0') || path.endsWith('/')) {
    throw new Error(`Invalid public asset path: ${String(path)}`);
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment.startsWith('.'))) {
    throw new Error(`Hidden asset paths are not publishable: ${path}`);
  }
  if (segments.some((segment) => /^sources?$/i.test(segment))
    || /(?:^|[-_.])source(?:[-_.]|$)/i.test(posix.basename(path))) {
    throw new Error(`Raw source assets are not publishable: ${path}`);
  }
  const extension = assetExtension(path);
  if (!PUBLIC_ASSET_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported public asset extension ${extension || '(none)'}: ${path}`);
  }
}

function pngChunkTypes(buffer, path) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < signature.length || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error(`Invalid PNG signature: ${path}`);
  }
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error(`Truncated PNG chunk in ${path}`);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error(`Invalid PNG chunk type in ${path}`);
    chunks.push(type);
    offset = end;
    if (type === 'IEND') break;
  }
  if (chunks[0] !== 'IHDR' || !chunks.includes('IDAT') || chunks.at(-1) !== 'IEND' || offset !== buffer.length) {
    throw new Error(`Incomplete or trailing PNG data: ${path}`);
  }
  return chunks;
}

function assertMetadataSafePng(buffer, path) {
  const safeChunks = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'pHYs', 'cHRM', 'gAMA', 'sRGB', 'bKGD', 'sBIT']);
  for (const type of pngChunkTypes(buffer, path)) {
    if (safeChunks.has(type)) continue;
    if (type === 'caBX' && pngsWithAuditedContentCredentials.has(path)) continue;
    throw new Error(`Unapproved PNG metadata or chunk ${type}: ${path}`);
  }
}

function assertMetadataSafeWebp(buffer, path) {
  if (buffer.length < 20 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF'
    || buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
    || buffer.readUInt32LE(4) + 8 !== buffer.length) {
    throw new Error(`Invalid WebP container: ${path}`);
  }
  const safeChunks = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF']);
  let offset = 12;
  let hasImage = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    const length = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > buffer.length) throw new Error(`Truncated WebP chunk in ${path}`);
    if (!safeChunks.has(type)) throw new Error(`Unapproved WebP metadata or chunk ${type}: ${path}`);
    if (type === 'VP8 ' || type === 'VP8L' || type === 'ANMF') hasImage = true;
    offset = end;
  }
  if (!hasImage || offset !== buffer.length) throw new Error(`Incomplete or trailing WebP data: ${path}`);
}

function assertMetadataSafeAvif(buffer, path) {
  if (buffer.length < 16 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') {
    throw new Error(`Invalid AVIF container: ${path}`);
  }
  const brands = buffer.subarray(8, Math.min(buffer.length, 64)).toString('latin1');
  if (!brands.includes('avif') && !brands.includes('avis')) throw new Error(`Missing AVIF brand: ${path}`);
  const latin = buffer.toString('latin1');
  if (/(?:Exif|<\?xpacket|http:\/\/ns\.adobe\.com\/xap\/1\.0\/|application\/rdf\+xml|c2pa)/i.test(latin)) {
    throw new Error(`Unapproved AVIF EXIF, XMP, or content-credential metadata: ${path}`);
  }
}

function assertPassiveSvg(buffer, path) {
  const svg = buffer.toString('utf8');
  if (!/<svg\b/i.test(svg) || svg.includes('\0')) throw new Error(`Invalid SVG document: ${path}`);
  const active = /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|object|embed|audio|video|canvas|link|meta|style)\b|\bon[a-z][\w:.-]*\s*=|javascript\s*:|data\s*:\s*text\/html/i;
  const externalReference = /\b(?:href|xlink:href)\s*=\s*(["'])\s*(?:[a-z][a-z\d+.-]*:|\/\/)/i;
  const externalCssUrl = /url\(\s*(["']?)\s*(?:[a-z][a-z\d+.-]*:|\/\/)/i;
  if (active.test(svg) || externalReference.test(svg) || externalCssUrl.test(svg)) {
    throw new Error(`Active or external SVG content is not publishable: ${path}`);
  }
}

async function auditAssetFile(root, path, stat) {
  if (stat.nlink > 1) throw new Error(`Public asset has multiple hard links: ${path}`);
  const buffer = await readFile(resolve(root, path));
  if (!buffer.length || buffer.length > MAX_PUBLIC_ASSET_BYTES) {
    throw new Error(`Public asset size is outside the allowed range: ${path}`);
  }
  const extension = assetExtension(path);
  if (extension === '.png') assertMetadataSafePng(buffer, path);
  else if (extension === '.webp') assertMetadataSafeWebp(buffer, path);
  else if (extension === '.avif') assertMetadataSafeAvif(buffer, path);
  else if (extension === '.svg') assertPassiveSvg(buffer, path);
}

async function addExpected(root, expected, path, type) {
  const parts = path.split('/');
  for (let index = 1; index < parts.length; index += 1) {
    const parent = parts.slice(0, index).join('/');
    const actual = safeType(await inspect(resolve(root, parent)), parent);
    if (actual !== 'directory') throw new Error(`Static source type conflict: ${parent} must be a directory.`);
    expected.set(parent, 'directory');
  }
  const actual = safeType(await inspect(resolve(root, path)), path);
  if (actual !== type) throw new Error(`Static source type conflict: ${path} must be a ${type}.`);
  expected.set(path, type);
}

async function validateFixedPublicFiles(root) {
  const cname = await readFile(resolve(root, 'CNAME'), 'utf8');
  if (!/^bkota\.co(?:\r?\n)?$/.test(cname)) {
    throw new Error('CNAME must contain exactly bkota.co, with at most one final newline.');
  }
}

async function discoverReferencedAssets(root, expected) {
  const queue = publicFiles.filter((path) => /\.(?:html|svg|css|webmanifest)$/i.test(path));
  const visited = new Set();
  while (queue.length) {
    const from = queue.shift();
    if (visited.has(from)) continue;
    visited.add(from);
    for (const reference of resourceReferences(from, await readFile(resolve(root, from), 'utf8'))) {
      const target = resolveLocalReference(from, reference);
      if (target === null || !target.startsWith('assets/')) continue;
      assertPublishableAssetPath(target);
      // Leave absent targets out of the inventory so the link validator can
      // report the referring document and original URL in its error.
      if (!await inspect(resolve(root, target))) continue;
      await addExpected(root, expected, target, 'file');
      if (/\.svg$/i.test(target)) queue.push(target);
    }
  }
}

async function auditAssetTree(root, expected) {
  const approvedFiles = new Set([...expected].filter(([path, type]) => path.startsWith('assets/') && type === 'file').map(([path]) => path));
  const approvedDirectories = new Set(['assets']);
  for (const path of approvedFiles) {
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index += 1) approvedDirectories.add(parts.slice(0, index).join('/'));
  }

  async function visit(directory, prefix) {
    for (const name of (await readdir(directory)).sort()) {
      const path = `${prefix}/${name}`;
      // Reject source/hidden paths before considering whether a file happened to
      // be referenced. They are custody inputs, never public release inputs.
      if (name.startsWith('.')) throw new Error(`Hidden asset paths are not publishable: ${path}`);
      if (/^sources?$/i.test(name) || /(?:^|[-_.])source(?:[-_.]|$)/i.test(name)) {
        throw new Error(`Raw source assets are not publishable: ${path}`);
      }
      const stat = await inspect(resolve(root, path));
      const type = safeType(stat, path);
      if (type === 'directory') {
        if (!approvedDirectories.has(path)) throw new Error(`Unapproved public asset directory: ${path}`);
        await visit(resolve(root, path), path);
        continue;
      }
      assertPublishableAssetPath(path);
      if (!approvedFiles.has(path)) throw new Error(`Unapproved or unreferenced public asset: ${path}`);
      await auditAssetFile(root, path, stat);
    }
  }

  await visit(resolve(root, 'assets'), 'assets');
}

async function inventory(root, retainedAssets) {
  const expected = new Map();
  for (const path of publicFiles) await addExpected(root, expected, path, 'file');
  await validateFixedPublicFiles(root);
  await addExpected(root, expected, 'assets', 'directory');
  await discoverReferencedAssets(root, expected);

  if (!retainedAssets || typeof retainedAssets !== 'object' || Array.isArray(retainedAssets)) {
    throw new Error('The retained public asset manifest must be an object of path-to-reason entries.');
  }
  for (const [path, reason] of Object.entries(retainedAssets)) {
    assertPublishableAssetPath(path);
    if (typeof reason !== 'string' || reason.trim().length < 8) throw new Error(`Retained public asset needs an audit reason: ${path}`);
    await addExpected(root, expected, path, 'file');
  }
  await auditAssetTree(root, expected);
  return expected;
}

async function checkExistingOutput(output, expected) {
  const rootStat = await inspect(output);
  if (!rootStat) return;
  if (safeType(rootStat, output) !== 'directory') throw new Error('Static output must be a directory.');
  async function visit(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const path = prefix ? `${prefix}/${name}` : name;
      const stat = await inspect(resolve(directory, name));
      const type = safeType(stat, path);
      if (!expected.has(path)) throw new Error(`Unexpected existing build entry: ${path}. Review it before publishing; nothing was deleted.`);
      if (expected.get(path) !== type) throw new Error(`Existing build type conflict: ${path} must be a ${expected.get(path)}.`);
      if (type === 'file' && stat.nlink > 1) throw new Error(`Existing build file has multiple hard links: ${path}. Refusing to overwrite another file through an alias.`);
      if (type === 'directory') await visit(resolve(directory, name), path);
    }
  }
  await visit(output);
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const numeric = entity.slice(2, -1);
    const code = numeric[0].toLowerCase() === 'x' ? Number.parseInt(numeric.slice(1), 16) : Number(numeric);
    return code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
  });
}

function srcsetUrls(value) {
  const urls = [];
  let index = 0;
  while (index < value.length) {
    while (/[\s,]/.test(value[index] || '') && index < value.length) index += 1;
    const start = index;
    while (index < value.length && !/\s/.test(value[index])) index += 1;
    let url = value.slice(start, index);
    if (!url) break;
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      // Descriptors end at the next comma. A comma inside a data URL remains part of its URL token.
      while (index < value.length && value[index] !== ',') index += 1;
    }
    if (url) urls.push(url);
  }
  return urls;
}

function resourceReferences(path, text) {
  const links = [];
  if (/\.(?:html|svg)$/i.test(path)) {
    // Covers local HTML/SVG file references, including unquoted attributes and responsive candidates.
    for (const [tag] of text.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<[a-z][^>]*>/gi)) {
      for (const match of tag.matchAll(/\s(src|href|xlink:href|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        const value = decodeEntities(match[2] ?? match[3] ?? match[4]);
        if (match[1].toLowerCase() === 'srcset') {
          links.push(...srcsetUrls(value));
        } else links.push(value);
      }
    }
  }
  if (/\.css$/i.test(path)) {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi)) links.push(match[1] ?? match[2] ?? match[3]);
    for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) links.push(match[1]);
  }
  if (path.endsWith('.webmanifest')) {
    const manifest = JSON.parse(text);
    if (manifest.start_url) links.push(manifest.start_url);
    for (const icon of manifest.icons || []) if (icon.src) links.push(icon.src);
    for (const shortcut of manifest.shortcuts || []) {
      if (shortcut.url) links.push(shortcut.url);
      for (const icon of shortcut.icons || []) if (icon.src) links.push(icon.src);
    }
  }
  return links;
}

function resolveLocalReference(from, reference) {
  const value = reference.trim();
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
  let path;
  try { path = decodeURIComponent(value.split(/[?#]/)[0]); }
  catch { throw new Error(`Malformed local link in ${from}: ${reference}`); }
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) throw new Error(`Unsafe or root-relative local link in ${from}: ${reference}`);
  const target = posix.normalize(posix.join(posix.dirname(from), path || posix.basename(from))).replace(/\/$/, '');
  if (target === '..' || target.startsWith('../')) throw new Error(`Local link escapes the release in ${from}: ${reference}`);
  return target;
}

async function validateLinks(base, expected) {
  let checked = 0;
  for (const [path, type] of expected) {
    if (type !== 'file' || !/\.(?:html|svg|css|webmanifest)$/i.test(path)) continue;
    for (const reference of resourceReferences(path, await readFile(resolve(base, path), 'utf8'))) {
      let target = resolveLocalReference(path, reference);
      if (target === null) continue;
      if (target === '.' || expected.get(target) === 'directory') target = posix.join(target, 'index.html');
      if (expected.get(target) !== 'file') throw new Error(`Missing packaged local link: ${path} -> ${reference}`);
      if (safeType(await inspect(resolve(base, target)), target) !== 'file') throw new Error(`Packaged local link is not a file: ${path} -> ${reference}`);
      checked += 1;
    }
  }
  return checked;
}

export async function buildStatic({ rootDir = defaultRoot, outputDir, retainedAssets = retainedPublicAssets } = {}) {
  const root = resolve(rootDir);
  const output = resolve(outputDir ?? resolve(root, 'dist'));
  const outputRelative = relative(root, output);
  // A direct child output prevents an uninspected ancestor from redirecting writes outside the checkout.
  if (!outputRelative || isAbsolute(outputRelative) || outputRelative.includes('/') || outputRelative.includes('\\') || outputRelative === '..') {
    throw new Error('Static output must be a direct child directory of the source checkout.');
  }
  const expected = await inventory(root, retainedAssets);
  if (expected.has(outputRelative)) throw new Error('Static output cannot replace an allowlisted source path.');
  // All preflight checks happen before the first output write. No stale content is silently deleted.
  await checkExistingOutput(output, expected);
  await validateLinks(root, expected);
  await mkdir(output, { recursive: true });
  for (const [path, type] of expected) if (type === 'directory') await mkdir(resolve(output, path), { recursive: true });
  for (const [path, type] of expected) if (type === 'file') await copyFile(resolve(root, path), resolve(output, path));
  await checkExistingOutput(output, expected);
  const checkedLinks = await validateLinks(output, expected);
  return { output, files: [...expected.values()].filter((type) => type === 'file').length, checkedLinks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await buildStatic();
  console.log(`BKOTA static release prepared in dist/: ${result.files} files; ${result.checkedLinks} packaged local links verified. No account, DNS, payment, or backend setting changed.`);
}
