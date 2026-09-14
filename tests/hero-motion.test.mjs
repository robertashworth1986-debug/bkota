import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const oilSource = source.slice(source.indexOf('function startLivingOil()'), source.indexOf('function setupGlobeDepth()'));

function startOil(options = {}) {
  const properties = new Map();
  const heroVisualProperties = new Map();
  const paintTransforms = [];
  const events = new Map();
  const imageEvents = new Map();
  const listenerOptions = new Map();
  let observerCallback;
  let resizeCallback;
  let disconnectedObservers = 0;
  let requestedFrames = 0;
  let canceledFrames = 0;
  let paintedPaths = 0;
  let paintCount = 0;
  let ellipseCount = 0;
  let closedPaths = 0;
  let dashedLanes = 0;
  let paintSignature = [];
  let queuedFrame;
  let clock = 0;
  const record = (name, values = []) => {
    paintSignature.push([name, ...values.map((value) => typeof value === 'number' ? Number(value.toFixed(5)) : value)]);
  };
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    setTransform(...args) { paintTransforms.push(args); },
    createLinearGradient() { return gradient; },
    createRadialGradient() { return gradient; },
    clearRect() { paintCount += 1; paintSignature = []; },
    beginPath() { paintedPaths += 1; },
    moveTo(...args) { record('moveTo', args); },
    lineTo(...args) { record('lineTo', args); },
    ellipse(...args) { ellipseCount += 1; record('ellipse', args); },
    closePath() { closedPaths += 1; record('closePath'); },
    setLineDash(values) { if (values.length) dashedLanes += 1; record('setLineDash', values); }
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const heroImage = {
    naturalWidth: options.naturalWidth ?? 2000,
    naturalHeight: options.naturalHeight ?? 1000,
    currentSrc: options.currentSrc ?? 'https://example.test/assets/hands-hero-v2.webp',
    dataset: options.dataset ?? {},
    complete: options.complete ?? true,
    addEventListener(name, callback) { imageEvents.set(name, callback); },
    removeEventListener(name, callback) { if (imageEvents.get(name) === callback) imageEvents.delete(name); }
  };
  const heroVisual = {
    clientWidth: options.width ?? 1000,
    clientHeight: options.height ?? 500,
    querySelector() { return heroImage; },
    style: { setProperty(key, value) { heroVisualProperties.set(key, value); } },
    getBoundingClientRect() { throw new Error('Do not use a transformed visual rectangle for local positioning'); }
  };
  const canvas = {
    clientWidth: options.canvasWidth ?? 160,
    clientHeight: options.canvasHeight ?? 350,
    width: 0,
    height: 0,
    closest() { return heroVisual; },
    getContext() { return context; },
    style: { setProperty(key, value) { properties.set(key, value); } },
    getBoundingClientRect() { throw new Error('Do not use a transformed canvas rectangle for its bitmap'); }
  };
  let paused = options.paused ?? false;
  const reducedMotion = { matches: options.reducedMotion ?? false, addEventListener() {} };
  const document = {
    hidden: options.hidden ?? false,
    querySelector() { return canvas; },
    documentElement: { classList: { contains() { return paused; } } },
    addEventListener(name, callback) { events.set(name, callback); }
  };
  const sandbox = {
    document,
    saveDataRequested: options.saveData ?? false,
    matchMedia() { return reducedMotion; },
    getComputedStyle() { return { objectPosition: options.objectPosition ?? '50% 50%' }; },
    devicePixelRatio: options.dpr ?? 3,
    performance: { now() { clock += options.clockStep ?? 100; return clock; } },
    requestAnimationFrame(callback) { requestedFrames += 1; queuedFrame = callback; return requestedFrames; },
    cancelAnimationFrame() { canceledFrames += 1; queuedFrame = undefined; },
    addEventListener(name, callback, options) { events.set(name, callback); listenerOptions.set(name, options); },
    removeEventListener(name, callback) { if (events.get(name) === callback) events.delete(name); },
    ResizeObserver: class { constructor(callback) { resizeCallback = callback; } observe() {} disconnect() { disconnectedObservers += 1; } },
    IntersectionObserver: class { constructor(callback) { observerCallback = callback; } observe() {} disconnect() { disconnectedObservers += 1; } }
  };
  vm.runInNewContext(`${oilSource}\nstartLivingOil();`, sandbox);
  return {
    properties, heroVisualProperties, canvas, paintTransforms, heroImage, heroVisual, document,
    get requestedFrames() { return requestedFrames; },
    get canceledFrames() { return canceledFrames; },
    get paintedPaths() { return paintedPaths; },
    get paintCount() { return paintCount; },
    get ellipseCount() { return ellipseCount; },
    get closedPaths() { return closedPaths; },
    get dashedLanes() { return dashedLanes; },
    get paintSignature() { return JSON.stringify(paintSignature); },
    get disconnectedObservers() { return disconnectedObservers; },
    get imageLoadListenerCount() { return imageEvents.has('load') ? 1 : 0; },
    get pagehideListenerCount() { return events.has('pagehide') ? 1 : 0; },
    setPaused(value) { paused = value; events.get('bkota-motion-change')(); },
    setVisible(value) { observerCallback([{ isIntersecting: value }]); },
    setHidden(value) { document.hidden = value; events.get('visibilitychange')(); },
    loadImage(values = {}) { Object.assign(heroImage, values); imageEvents.get('load')?.(); },
    pagehide(persisted) {
      const callback = events.get('pagehide');
      if (listenerOptions.get('pagehide')?.once) events.delete('pagehide');
      callback?.({ persisted });
    },
    runFrame(now) {
      const callback = queuedFrame;
      queuedFrame = undefined;
      callback?.(now);
    },
    resize() { resizeCallback(); }
  };
}

test('oil anchor and bitmap use untransformed local CSS pixels, with capped DPR', () => {
  const oil = startOil();
  assert.equal(oil.properties.get('--oil-screen-x'), '727.00px');
  assert.equal(oil.properties.get('--oil-screen-y'), '167.50px');
  assert.equal(oil.heroVisualProperties.get('--oil-screen-x'), '727.00px');
  assert.equal(oil.heroVisualProperties.get('--oil-screen-y'), '167.50px');
  assert.equal(oil.canvas.width, 320);
  assert.equal(oil.canvas.height, 700);
  assert.deepEqual(oil.paintTransforms[0], [2, 0, 0, 2, 0, 0]);
  assert.ok(oil.paintedPaths > 0);
});

test('oil rendering includes a tapered body, four moving caustic lanes, a source glint, and 18 droplets', () => {
  const oil = startOil();
  assert.ok(oil.closedPaths >= 1, 'tapered oil body is a closed filled shape');
  assert.equal(oil.dashedLanes, 4, 'four animated caustic lanes');
  assert.equal(oil.ellipseCount, 20, 'source glow, source glint, and 18 oil droplets');
});

test('animation painting is capped at 30 frames per second', () => {
  const oil = startOil();
  assert.equal(oil.paintCount, 1);
  oil.runFrame(10);
  oil.runFrame(20);
  assert.equal(oil.paintCount, 1);
  oil.runFrame(34);
  assert.equal(oil.paintCount, 2);
  oil.runFrame(50);
  assert.equal(oil.paintCount, 2);
  oil.runFrame(68);
  assert.equal(oil.paintCount, 3);
});

test('measured desktop anchors override old image coordinates', () => {
  const oil = startOil({ dataset: { oilX: '0.8', oilY: '0.25' }, dpr: 1 });
  assert.equal(oil.properties.get('--oil-screen-x'), '800.00px');
  assert.equal(oil.properties.get('--oil-screen-y'), '125.00px');
  assert.equal(oil.canvas.width, 160);
  assert.equal(oil.canvas.height, 350);
});

test('optional anchor endpoints zero and one are retained', () => {
  const oil = startOil({ dataset: { oilX: '0', oilY: '1' } });
  assert.equal(oil.properties.get('--oil-screen-x'), '0.00px');
  assert.equal(oil.properties.get('--oil-screen-y'), '500.00px');
});

test('invalid and missing attributes independently fall back instead of becoming zero', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', '-0.1', '1.1', '0.2oops', undefined]) {
    const oil = startOil({ dataset: { oilX: value, oilY: '0.4' } });
    assert.equal(oil.properties.get('--oil-screen-x'), '727.00px', `Rejected ${String(value)}`);
    assert.equal(oil.properties.get('--oil-screen-y'), '200.00px');
  }
});

test('both original and versioned portrait sources use mobile-specific anchor metadata', () => {
  for (const file of ['hands-hero-mobile.webp', 'hands-hero-mobile-v2.webp', 'hands-hero-v2-mobile.avif']) {
    const oil = startOil({ currentSrc: `https://example.test/assets/${file}`, dataset: { oilX: '0.1', oilY: '0.2', oilMobileX: '0.8', oilMobileY: '0.4' } });
    assert.equal(oil.properties.get('--oil-screen-x'), '800.00px');
    assert.equal(oil.properties.get('--oil-screen-y'), '200.00px');
  }
  const fallback = startOil({ currentSrc: 'https://example.test/assets/hands-hero-mobile.webp' });
  assert.equal(fallback.properties.get('--oil-screen-x'), '690.00px');
  assert.equal(fallback.properties.get('--oil-screen-y'), '182.50px');
});

test('cover crop and percentage object position are included in local anchor placement', () => {
  const oil = startOil({ width: 400, height: 800, naturalWidth: 1000, naturalHeight: 1250, objectPosition: '75% 50%', dataset: { oilX: '0.8', oilY: '0.25' } });
  // Cover gives a 640 x 800 image; 75% horizontal positioning offsets it -180 px.
  assert.equal(oil.properties.get('--oil-screen-x'), '332.00px');
  assert.equal(oil.properties.get('--oil-screen-y'), '200.00px');
});

test('resize recalculates coordinates without transformed geometry', () => {
  const oil = startOil();
  oil.heroVisual.clientWidth = 600;
  oil.heroVisual.clientHeight = 300;
  oil.canvas.clientWidth = 130;
  oil.resize();
  assert.equal(oil.properties.get('--oil-screen-x'), '436.20px');
  assert.equal(oil.properties.get('--oil-screen-y'), '100.50px');
  assert.equal(oil.canvas.width, 260);
});

test('already-complete hero keeps refreshing each portrait and desktop source load', () => {
  const oil = startOil({ complete: true, dataset: { oilX: '0.8', oilY: '0.25', oilMobileX: '0.6', oilMobileY: '0.4' } });
  assert.equal(oil.imageLoadListenerCount, 1);
  const initialPaints = oil.paintedPaths;
  oil.heroVisual.clientWidth = 400;
  oil.heroVisual.clientHeight = 500;
  // A new portrait source finishes after layout, without a second resize.
  oil.loadImage({ currentSrc: 'https://example.test/assets/hero-mobile-v2.webp', naturalWidth: 800, naturalHeight: 1000 });
  assert.equal(oil.properties.get('--oil-screen-x'), '240.00px');
  assert.equal(oil.properties.get('--oil-screen-y'), '200.00px');
  assert.ok(oil.paintedPaths > initialPaints);
  assert.equal(oil.imageLoadListenerCount, 1);
  oil.heroVisual.clientWidth = 1000;
  oil.heroVisual.clientHeight = 500;
  oil.loadImage({ currentSrc: 'https://example.test/assets/hero-v2.webp', naturalWidth: 2000, naturalHeight: 1000 });
  assert.equal(oil.properties.get('--oil-screen-x'), '800.00px');
  assert.equal(oil.properties.get('--oil-screen-y'), '125.00px');
  assert.equal(oil.imageLoadListenerCount, 1);
});

test('initially-incomplete image also receives the persistent load listener', () => {
  const oil = startOil({ complete: false, naturalWidth: 0, naturalHeight: 0 });
  assert.equal(oil.imageLoadListenerCount, 1);
  assert.equal(oil.properties.has('--oil-screen-x'), false);
  oil.loadImage({ complete: true, naturalWidth: 2000, naturalHeight: 1000 });
  assert.equal(oil.properties.get('--oil-screen-x'), '727.00px');
  assert.equal(oil.imageLoadListenerCount, 1);
});

test('BFCache preserves load refresh and final pagehide removes its listener and observers', () => {
  const oil = startOil({ dataset: { oilX: '0.8', oilY: '0.25' } });
  oil.pagehide(true);
  assert.equal(oil.imageLoadListenerCount, 1);
  assert.equal(oil.pagehideListenerCount, 1);
  assert.equal(oil.disconnectedObservers, 0);
  oil.loadImage({ dataset: { oilX: '0.7', oilY: '0.3' } });
  assert.equal(oil.properties.get('--oil-screen-x'), '700.00px');
  oil.pagehide(false);
  assert.equal(oil.imageLoadListenerCount, 0);
  assert.equal(oil.pagehideListenerCount, 0);
  assert.equal(oil.disconnectedObservers, 2);
  const finalPaints = oil.paintedPaths;
  oil.loadImage({ dataset: { oilX: '0.4', oilY: '0.2' } });
  assert.equal(oil.properties.get('--oil-screen-x'), '700.00px');
  assert.equal(oil.paintedPaths, finalPaints);
});

test('reduced motion, saved data, user pause, and hidden pages retain static-only painting', () => {
  for (const option of ['reducedMotion', 'saveData', 'paused', 'hidden']) {
    const oil = startOil({ [option]: true });
    assert.equal(oil.requestedFrames, 0, option);
    assert.ok(oil.paintedPaths > 0, option);
    const frozenSignature = oil.paintSignature;
    oil.resize();
    assert.equal(oil.paintSignature, frozenSignature, `${option} frame remains visually frozen`);
  }
});

test('a manually paused frame remains frozen across repeated refresh events', () => {
  const oil = startOil();
  oil.setPaused(true);
  const frozenSignature = oil.paintSignature;
  oil.setPaused(true);
  assert.equal(oil.paintSignature, frozenSignature);
});

test('offscreen and user pause controls still stop and resume animation scheduling', () => {
  const oil = startOil();
  assert.equal(oil.requestedFrames, 1);
  oil.setVisible(false);
  assert.ok(oil.canceledFrames > 0);
  oil.setPaused(true);
  assert.equal(oil.requestedFrames, 1);
  oil.setVisible(true);
  assert.equal(oil.requestedFrames, 1);
  oil.setPaused(false);
  assert.equal(oil.requestedFrames, 2);
  oil.setHidden(true);
  oil.setHidden(false);
  assert.equal(oil.requestedFrames, 3);
});
