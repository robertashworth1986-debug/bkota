// Native, editable vector artwork. No payment, inventory, tracking, or upload API.
export const VERSE = 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ’s sake hath forgiven you.';
export const PALETTES = Object.freeze({
  midnight: Object.freeze({ name: 'Midnight', garment: '#101f35', shadow: '#071222', light: '#263952', ink: '#fff5dd', accent: '#f3d790' }),
  ivory: Object.freeze({ name: 'Sunday', garment: '#f7f1e5', shadow: '#d1c8b6', light: '#fffdf8', ink: '#081426', accent: '#725222' }),
  forest: Object.freeze({ name: 'Evergreen', garment: '#203d35', shadow: '#142b23', light: '#35594c', ink: '#fff5dd', accent: '#f3d790' })
});
export const TYPEFACES = Object.freeze({
  sans: Object.freeze({ family: 'Arial, Helvetica, sans-serif', name: 'bold and clear' }),
  serif: Object.freeze({ family: 'Georgia, Times New Roman, serif', name: 'classic and warm' })
});

const verseLines = Object.freeze([
  'And be ye kind', 'one to another,', 'tenderhearted,',
  'forgiving one another,', 'even as God', 'for Christ’s sake', 'hath forgiven you.'
]);

export function normalizeSettings(settings = {}) {
  return {
    side: settings.side === 'back' ? 'back' : 'front',
    palette: Object.hasOwn(PALETTES, settings.palette) ? settings.palette : 'midnight',
    typeface: Object.hasOwn(TYPEFACES, settings.typeface) ? settings.typeface : 'sans'
  };
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function createArtwork(settings = {}) {
  const { side, palette, typeface } = normalizeSettings(settings);
  const colors = PALETTES[palette];
  const font = TYPEFACES[typeface].family;
  const prefix = typeof settings.idPrefix === 'string' && /^[a-z][a-z0-9-]*$/i.test(settings.idPrefix) ? settings.idPrefix : `bkota-${side}`;
  const title = side === 'front' ? 'BKOTA — BE KIND ONE TO ANOTHER. Ephesians 4:32.' : `BKOTA — Ephesians 4:32, King James Version. ${VERSE}`;
  const mark = `<g fill="none" stroke="${colors.accent}" stroke-width="16"><circle cx="2000" cy="740" r="215"/><circle cx="2000" cy="740" r="248" stroke-width="5"/></g><text x="2000" y="850" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="325" font-weight="700" fill="${colors.accent}">B</text>`;
  const front = `${mark}
  <g text-anchor="middle" fill="${colors.ink}" font-family="${font}" font-weight="700">
    <text x="2000" y="1820" font-size="850" textLength="3310" lengthAdjust="spacingAndGlyphs">BE KIND</text>
    <text x="2000" y="2380" font-size="385" letter-spacing="32" textLength="2470" lengthAdjust="spacingAndGlyphs">ONE TO</text>
    <text x="2000" y="2865" font-size="495" textLength="3290" lengthAdjust="spacingAndGlyphs">ANOTHER</text>
  </g>
  <path d="M660 3220 H3340" fill="none" stroke="${colors.accent}" stroke-width="13"/>
  <text x="2000" y="3580" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="215" font-weight="700" letter-spacing="15" fill="${colors.accent}">EPHESIANS 4:32</text>
  <text x="2000" y="4110" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="230" font-weight="700" letter-spacing="62" fill="${colors.ink}">BKOTA</text>
  <path d="M1300 4370 Q2000 4050 2700 4370 M1030 4540 Q2000 4080 2970 4540" fill="none" stroke="${colors.accent}" stroke-width="14" stroke-linecap="round"/>`;
  const verseText = verseLines.map((line, index) => `<text x="2000" y="${1520 + index * 395}" font-size="280"${index === 3 ? ' textLength="3060" lengthAdjust="spacingAndGlyphs"' : ''}>${escapeXml(line)}</text>`).join('\n    ');
  const back = `<text x="2000" y="590" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="195" font-weight="700" letter-spacing="49" fill="${colors.accent}">BKOTA</text>
  <path d="M660 850 H3340" fill="none" stroke="${colors.accent}" stroke-width="13"/>
  <g text-anchor="middle" fill="${colors.ink}" font-family="${font}" font-weight="700">
    ${verseText}
  </g>
  <path d="M660 4230 H3340" fill="none" stroke="${colors.accent}" stroke-width="13"/>
  <text x="2000" y="4590" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="195" font-weight="700" letter-spacing="9" fill="${colors.accent}">EPHESIANS 4:32 · KJV</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="12in" height="15in" viewBox="0 0 4000 5000" role="img" aria-labelledby="${prefix}-title ${prefix}-description">
  <title id="${prefix}-title">${escapeXml(title)}</title>
  <desc id="${prefix}-description">${side === 'front' ? 'Front' : 'Back'} artwork. ${colors.name} palette; ${TYPEFACES[typeface].name} lettering. Transparent background, two spot-color design references, editable text. Font dependency: ${font}. Printer review, font verification or outlining, garment sizing, ink separations, underbase, and a physical proof are required before production. Coordinate grid 4000 by 5000; artboard 12 by 15 inches. All artwork reserved for BKOTA.</desc>
  ${side === 'front' ? front : back}
</svg>`;
}

export function createShirt(settings = {}) {
  const normalized = normalizeSettings(settings);
  const colors = PALETTES[normalized.palette];
  const id = `shirt-${normalized.side}`;
  const artwork = createArtwork({ ...normalized, idPrefix: `${id}-print` })
    .replace('width="12in" height="15in"', 'x="264" y="272" width="472" height="590"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1120" role="img" aria-labelledby="${id}-title ${id}-description">
  <title id="${id}-title">${colors.name} BKOTA shirt, ${normalized.side}.</title>
  <desc id="${id}-description">Spatial vector illustration, not a photograph or a physically accurate three-dimensional garment model. ${normalized.side === 'front' ? 'BE KIND ONE TO ANOTHER. Ephesians 4:32.' : escapeXml(VERSE)}</desc>
  <defs>
    <linearGradient id="${id}-fabric" x1="0" x2="1" y1="0" y2="0.5"><stop stop-color="${colors.shadow}"/><stop offset=".28" stop-color="${colors.garment}"/><stop offset=".55" stop-color="${colors.light}"/><stop offset=".72" stop-color="${colors.garment}"/><stop offset="1" stop-color="${colors.shadow}"/></linearGradient>
    <linearGradient id="${id}-fold" x1="0" x2="1"><stop stop-color="${colors.shadow}" stop-opacity=".7"/><stop offset=".5" stop-color="${colors.light}" stop-opacity=".25"/><stop offset="1" stop-color="${colors.garment}" stop-opacity="0"/></linearGradient>
  </defs>
  <path d="M341 123 Q389 147 427 157 Q500 204 573 157 Q611 147 659 123 L767 175 Q800 191 824 233 L945 422 Q871 481 795 488 L733 399 L754 962 Q503 1014 246 962 L267 399 L205 488 Q129 481 55 422 L176 233 Q200 191 233 175 Z" fill="url(#${id}-fabric)" stroke="${colors.shadow}" stroke-width="3"/>
  <path d="M341 124 Q380 230 500 235 Q620 230 659 124 L617 140 Q585 198 500 198 Q415 198 383 140 Z" fill="${colors.shadow}"/>
  <path d="M382 141 Q420 206 500 209 Q580 206 618 141" fill="none" stroke="${colors.light}" stroke-opacity=".65" stroke-width="5"/>
  <path d="M341 124 Q305 239 267 399 M659 124 Q695 239 733 399 M71 411 Q129 461 209 469 M929 411 Q871 461 791 469 M251 942 Q500 984 749 942" fill="none" stroke="${colors.light}" stroke-width="3" stroke-opacity=".42"/>
  <path d="M268 398 Q282 536 269 931 L317 958 Q286 552 309 365 Z M727 451 Q700 691 722 956 L748 958 Z" fill="url(#${id}-fold)"/>
  ${artwork}
</svg>`;
}

export function artworkFilename(settings = {}) {
  const { side, palette, typeface } = normalizeSettings(settings);
  return `bkota-${side}-${palette}-${typeface}.svg`;
}

function initStudio() {
  const preview = document.getElementById('designPreview');
  if (!preview) return;
  const stage = document.getElementById('previewStage');
  const dialog = document.getElementById('artworkDialog');
  const dialogArtwork = document.getElementById('dialogArtwork');
  const settings = { side: 'front', palette: 'midnight', typeface: 'sans', mode: 'shirt' };
  const downloads = new Map();
  const status = document.getElementById('studioStatus');
  const zoomButton = document.getElementById('zoomButton');

  function renderDialog() {
    const name = PALETTES[settings.palette].name;
    document.getElementById('dialogTitle').textContent = `${settings.side === 'front' ? 'Front' : 'Back / verse'} artwork · ${name}`;
    dialogArtwork.dataset.palette = settings.palette;
    dialogArtwork.innerHTML = createArtwork({ ...settings, idPrefix: 'enlarged-art' });
  }

  function render() {
    const name = PALETTES[settings.palette].name;
    stage.dataset.palette = settings.palette;
    stage.dataset.mode = settings.mode;
    stage.dataset.side = settings.side;
    preview.innerHTML = settings.mode === 'shirt' ? createShirt(settings) : createArtwork({ ...settings, idPrefix: 'flat-art' });
    document.getElementById('viewLabel').textContent = `${name} · ${settings.side === 'front' ? 'Front' : 'Back / verse'}`;
    document.getElementById('stageCaption').textContent = settings.mode === 'shirt' ? 'A spatial illustration · not a garment photograph' : 'Flat artwork · garment color shown for contrast';
    document.querySelectorAll('button[data-side]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.side === settings.side)));
    document.querySelectorAll('button[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === settings.mode)));
    for (const side of ['front', 'back']) {
      const link = document.getElementById(side === 'front' ? 'downloadFront' : 'downloadBack');
      if (downloads.has(side)) URL.revokeObjectURL(downloads.get(side));
      const url = URL.createObjectURL(new Blob([createArtwork({ ...settings, side })], { type: 'image/svg+xml;charset=utf-8' }));
      downloads.set(side, url);
      link.href = url;
      link.download = artworkFilename({ ...settings, side });
    }
    status.textContent = `${name} palette, ${TYPEFACES[settings.typeface].name} lettering. ${settings.side === 'front' ? 'Front invitation' : 'Full Ephesians 4:32 verse'} selected.`;
    if (dialog.open) renderDialog();
  }

  document.querySelectorAll('button[data-side]').forEach(button => button.addEventListener('click', () => {
    settings.side = button.dataset.side;
    render();
  }));
  document.querySelectorAll('button[data-mode]').forEach(button => button.addEventListener('click', () => {
    settings.mode = button.dataset.mode;
    render();
  }));
  document.querySelectorAll('input[name="palette"]').forEach(input => input.addEventListener('change', () => {
    settings.palette = normalizeSettings({ palette: input.value }).palette;
    render();
  }));
  document.querySelectorAll('input[name="typeface"]').forEach(input => input.addEventListener('change', () => {
    settings.typeface = normalizeSettings({ typeface: input.value }).typeface;
    render();
  }));
  stage.addEventListener('keydown', event => {
    // Do not steal arrow keys from controls inside the preview.
    if (event.target !== stage || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    settings.side = settings.side === 'front' ? 'back' : 'front';
    render();
  });
  zoomButton.addEventListener('click', () => {
    renderDialog();
    dialog.showModal();
  });
  document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => zoomButton.focus());
  window.addEventListener('pagehide', () => {
    for (const url of downloads.values()) URL.revokeObjectURL(url);
    downloads.clear();
  });
  // Rebuild download URLs after a back-forward-cache restore.
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
  render();
  for (const id of ['previewControls', 'paletteControls', 'typeControls']) document.getElementById(id).hidden = false;
  if (typeof dialog.showModal === 'function') zoomButton.hidden = false;
}

if (typeof document !== 'undefined') initStudio();
