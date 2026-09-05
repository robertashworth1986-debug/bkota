import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import { dirname, isAbsolute, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const publicFiles = Object.freeze([
  '.nojekyll', 'index.html', 'styles.css', 'app.js', 'community.js', 'social-video.js',
  'config.js', 'merch.html', 'merch.css', 'merch.js', 'kindness-cards.html', 'cards.js',
  'privacy.html', 'privacy.js', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml',
  'sw.js', 'register-sw.js', 'output/pdf/BKOTA-scripture-cards.pdf'
]);

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

async function inventory(root) {
  const expected = new Map();
  async function add(path, type, recursive = false) {
    const actual = safeType(await inspect(resolve(root, path)), path);
    if (actual !== type) throw new Error(`Static source type conflict: ${path} must be a ${type}.`);
    expected.set(path, type);
    if (type === 'directory' && recursive) {
      for (const name of (await readdir(resolve(root, path))).sort()) {
        const child = `${path}/${name}`;
        const childType = safeType(await inspect(resolve(root, child)), child);
        await add(child, childType, true);
      }
    }
  }
  for (const path of publicFiles) {
    // Inspect every parent as well: an allowlisted PDF must not follow a linked output/ directory.
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index += 1) await add(parts.slice(0, index).join('/'), 'directory');
    await add(path, 'file');
  }
  await add('assets', 'directory', true);
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

export async function buildStatic({ rootDir = defaultRoot, outputDir } = {}) {
  const root = resolve(rootDir);
  const output = resolve(outputDir ?? resolve(root, 'dist'));
  const outputRelative = relative(root, output);
  // A direct child output prevents an uninspected ancestor from redirecting writes outside the checkout.
  if (!outputRelative || isAbsolute(outputRelative) || outputRelative.includes('/') || outputRelative.includes('\\') || outputRelative === '..') {
    throw new Error('Static output must be a direct child directory of the source checkout.');
  }
  const expected = await inventory(root);
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
