const { parseSocialVideoUrl } = globalThis.BKOTA_SOCIAL_VIDEO;
const { STORY_KEY: STORAGE_KEY, VIDEO_KEY: VIDEO_STORAGE_KEY, readCollection, appendCollection, clearCollection, exportCollection, storageErrorMessage } = globalThis.BKOTA_COMMUNITY;

const MAX_STORIES = 50;
const MAX_VIDEOS = 24;
const PUBLIC_FEED_LIMIT = 100;
const PRODUCTION_ORIGIN = "https://bkota.co";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTINENTS = new Set(["Africa", "Asia", "Europe", "North America", "South America", "Oceania", "Antarctica"]);
const UNSAFE_PUBLIC_TEXT = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
let backendAvailable = false;
let impactAvailable = false;
let approvedStories = [];
let approvedVideos = [];
let showStoryExamples = false;
let showVideoExamples = false;
let storySubmitting = false;
let videoSubmitting = false;
const pageUrl = (() => { try { return new URL(location.href); } catch { return null; } })();
const isProductionOrigin = pageUrl?.origin === PRODUCTION_ORIGIN && !pageUrl.username && !pageUrl.password;
const sharedPreviewOrigin = pageUrl?.hostname.toLowerCase().endsWith(".github.io") === true;
const tabValues = new Map();
const tabStorage = Object.freeze({
  getItem(key) { return tabValues.has(key) ? tabValues.get(key) : null; },
  setItem(key, value) { tabValues.set(key, String(value)); },
  removeItem(key) { tabValues.delete(key); }
});
const browserStorage = () => sharedPreviewOrigin ? tabStorage : globalThis.localStorage;
const privateEntryLabel = sharedPreviewOrigin ? "Temporary in this tab · not submitted" : "Private on this browser · not submitted";
const privatePlace = sharedPreviewOrigin ? "this open tab" : "this browser";
const config = Object.hasOwn(globalThis, "BKOTA_CONFIG") && Object.isFrozen(globalThis.BKOTA_CONFIG)
  ? globalThis.BKOTA_CONFIG
  : Object.freeze({});
const validCampaignCode = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{22}$/.test(value);
const configuredCampaignCode = validCampaignCode(config.shareCampaignCode) ? config.shareCampaignCode : "";
const MOTION_STORAGE_KEY = "bkota_motion_paused_v1";
const saveDataRequested = navigator.connection?.saveData === true;
document.documentElement.classList.toggle("save-data", saveDataRequested);

function captureAttributionCode() {
  const match = location.hash.match(/^#(join|today)\?(.+)$/);
  if (!match) return "";
  const code = new URLSearchParams(match[2]).get("c") || "";
  if (!configuredCampaignCode || code !== configuredCampaignCode) return "";
  history.replaceState(history.state, "", `${location.pathname}${location.search}#${match[1]}`);
  return code;
}

const activeAttributionCode = captureAttributionCode();

async function sendImpact(path, payload) {
  if (!impactAvailable) return false;
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      referrerPolicy: "same-origin",
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function measureVisiblePageOnce() {
  let measured = false;
  const measure = () => {
    if (measured || document.visibilityState !== "visible" || typeof crypto.randomUUID !== "function") return;
    measured = true;
    const payload = { nonce: crypto.randomUUID() };
    if (activeAttributionCode) payload.code = activeAttributionCode;
    void sendImpact("/api/impact/page-load", payload);
    document.removeEventListener("visibilitychange", measure);
  };
  measure();
  if (!measured) document.addEventListener("visibilitychange", measure);
}

function setupMotionControl() {
  const button = document.querySelector("#motionToggle");
  if (!button) return;
  const query = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  let userPaused = false;
  try { userPaused = localStorage.getItem(MOTION_STORAGE_KEY) === "true"; } catch {}

  function applyPreference() {
    const systemPaused = query.matches || saveDataRequested;
    const paused = systemPaused || userPaused;
    document.documentElement.classList.toggle("motion-paused", paused);
    button.disabled = systemPaused;
    button.setAttribute("aria-pressed", String(paused));
    button.textContent = query.matches
      ? "Background motion reduced by device setting"
      : saveDataRequested
        ? "Background motion reduced to save data"
        : userPaused
          ? "Resume background motion"
          : "Pause background motion";
    dispatchEvent(new CustomEvent("bkota-motion-change", { detail: { paused, systemPaused } }));
  }

  button.addEventListener("click", () => {
    userPaused = !userPaused;
    try { localStorage.setItem(MOTION_STORAGE_KEY, String(userPaused)); } catch {}
    applyPreference();
  });
  if (typeof query.addEventListener === "function") query.addEventListener("change", applyPreference);
  else if (typeof query.addListener === "function") query.addListener(applyPreference);
  applyPreference();
}

function startLivingOil() {
  const canvas = document.querySelector("#livingOil");
  if (!canvas) return;
  const heroVisual = canvas.closest(".hero-visual");
  const heroImage = heroVisual?.querySelector(".hero-media img");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  const reduceMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const saveData = saveDataRequested;
  let width = 0;
  let height = 0;
  let scale = 1;
  let frame = 0;
  let lastPaint = 0;
  let frozenTime = 0;
  let heroVisible = true;
  let pageVisible = !document.hidden;
  const frameInterval = 1000 / 30;
  const droplets = Array.from({ length: 18 }, (_, index) => ({
    phase: (index * 0.137 + 0.04) % 1,
    speed: 0.000013 + (index % 5) * 0.000003,
    radius: 0.9 + (index % 4) * 0.38,
    sway: 0.7 + (index % 6) * 0.42,
    lane: ((index % 5) - 2) * 1.45
  }));

  function syncOilAnchor() {
    if (!heroVisual || !heroImage?.naturalWidth || !heroImage.naturalHeight) return;
    // Anchor in local CSS pixels. The animated parent transform must not be
    // measured here and then applied a second time to its own canvas child.
    const box = { width: heroVisual.clientWidth, height: heroVisual.clientHeight };
    if (!box.width || !box.height) return;
    const renderedScale = Math.max(box.width / heroImage.naturalWidth, box.height / heroImage.naturalHeight);
    const renderedWidth = heroImage.naturalWidth * renderedScale;
    const renderedHeight = heroImage.naturalHeight * renderedScale;
    const position = getComputedStyle(heroImage).objectPosition.split(/\s+/);
    const percent = (value, fallback) => value?.endsWith("%") ? Math.max(0, Math.min(1, Number.parseFloat(value) / 100)) : fallback;
    const positionX = percent(position[0], 0.5);
    const positionY = percent(position[1], 0.5);
    const mobileSource = /-mobile(?:[.-]|$)/.test(heroImage.currentSrc);
    const fallback = mobileSource ? { x: 0.69, y: 0.365 } : { x: 0.727, y: 0.335 };
    const ratio = (value, defaultValue) => {
      if (typeof value !== "string" || value.trim() === "") return defaultValue;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : defaultValue;
    };
    const anchor = {
      x: ratio(mobileSource ? heroImage.dataset.oilMobileX : heroImage.dataset.oilX, fallback.x),
      y: ratio(mobileSource ? heroImage.dataset.oilMobileY : heroImage.dataset.oilY, fallback.y)
    };
    const screenX = (box.width - renderedWidth) * positionX + renderedWidth * anchor.x;
    const screenY = (box.height - renderedHeight) * positionY + renderedHeight * anchor.y;
    const xValue = `${Math.max(0, Math.min(box.width, screenX)).toFixed(2)}px`;
    const yValue = `${Math.max(0, Math.min(box.height, screenY)).toFixed(2)}px`;
    heroVisual.style.setProperty("--oil-screen-x", xValue);
    heroVisual.style.setProperty("--oil-screen-y", yValue);
    canvas.style.setProperty("--oil-screen-x", xValue);
    canvas.style.setProperty("--oil-screen-y", yValue);
  }

  function resize() {
    syncOilAnchor();
    scale = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function streamPoint(progress, now, phase = 0, offset = 0, amplitude = 1) {
    const sourceX = width * 0.5;
    const sourceY = Math.min(24, height * 0.08);
    const streamLength = Math.max(1, height - sourceY);
    const broadDrift = Math.sin(progress * 8.4 + now * 0.00043 + phase) * (0.55 + progress * 2.15);
    const surfaceTension = Math.sin(progress * 22.5 - now * 0.00029 + phase * 1.8) * (0.14 + progress * 0.5);
    return {
      x: sourceX + offset + (broadDrift + surfaceTension) * amplitude,
      y: sourceY + progress * streamLength
    };
  }

  function traceStream(now, phase = 0, offset = 0, amplitude = 1, steps = 44) {
    context.beginPath();
    for (let step = 0; step <= steps; step += 1) {
      const point = streamPoint(step / steps, now, phase, offset, amplitude);
      if (step === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
  }

  function fillOilBody(now, fillStyle) {
    const steps = 44;
    context.beginPath();
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const point = streamPoint(progress, now, 0.15, 0, 0.86);
      const halfWidth = Math.max(2.7, width * 0.057 * (1 - progress * 0.5) + Math.sin(progress * 18 + now * 0.0005) * 0.35);
      if (step === 0) context.moveTo(point.x - halfWidth, point.y);
      else context.lineTo(point.x - halfWidth, point.y);
    }
    for (let step = steps; step >= 0; step -= 1) {
      const progress = step / steps;
      const point = streamPoint(progress, now, 0.15, 0, 0.86);
      const halfWidth = Math.max(2.7, width * 0.057 * (1 - progress * 0.5) + Math.sin(progress * 18 + now * 0.0005) * 0.35);
      context.lineTo(point.x + halfWidth, point.y);
    }
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
  }

  function paint(now = 0) {
    context.clearRect(0, 0, width, height);
    const sourceX = width * 0.5;
    const sourceY = Math.min(24, height * 0.08);
    const streamLength = Math.max(1, height - sourceY);
    const shimmer = 0.5 + Math.sin(now * 0.00105) * 0.14;
    const staticMode = reduceMotion.matches || saveData || document.documentElement.classList.contains("motion-paused");
    const body = context.createLinearGradient(sourceX, sourceY, sourceX + 4, sourceY + streamLength);
    body.addColorStop(0, "rgba(255,252,218,0)");
    body.addColorStop(0.045, `rgba(255,233,135,${0.13 + shimmer * 0.06})`);
    body.addColorStop(0.42, "rgba(224,145,26,0.14)");
    body.addColorStop(0.82, "rgba(173,91,7,0.08)");
    body.addColorStop(1, "rgba(137,65,2,0)");
    context.save();
    context.globalCompositeOperation = "source-over";
    context.save();
    context.filter = "blur(2.4px)";
    context.shadowColor = "rgba(201,117,9,0.24)";
    context.shadowBlur = 9;
    fillOilBody(now, body);
    context.restore();

    context.globalCompositeOperation = "screen";
    const sourceGlow = context.createRadialGradient(sourceX, sourceY + 4, 0, sourceX, sourceY + 4, 28);
    sourceGlow.addColorStop(0, `rgba(255,255,225,${0.2 + shimmer * 0.16})`);
    sourceGlow.addColorStop(0.38, "rgba(255,206,70,0.14)");
    sourceGlow.addColorStop(1, "rgba(255,176,20,0)");
    context.fillStyle = sourceGlow;
    context.beginPath();
    context.ellipse(sourceX, sourceY + 4, 28, 10, 0, 0, Math.PI * 2);
    context.fill();

    context.lineCap = "round";
    context.strokeStyle = `rgba(255,247,188,${0.16 + shimmer * 0.16})`;
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(sourceX, sourceY + 4, 16 + shimmer * 3, 4.2 + shimmer, -0.08, Math.PI * 0.08, Math.PI * 0.92);
    context.stroke();

    const stream = context.createLinearGradient(sourceX, sourceY, sourceX + 5, sourceY + streamLength);
    stream.addColorStop(0, "rgba(255,251,214,0)");
    stream.addColorStop(0.055, `rgba(255,252,203,${0.54 + shimmer * 0.18})`);
    stream.addColorStop(0.48, "rgba(255,222,107,0.5)");
    stream.addColorStop(0.84, "rgba(255,194,46,0.2)");
    stream.addColorStop(1, "rgba(255,178,20,0)");
    context.lineCap = "round";
    [
      { offset: -4.7, width: 0.85, phase: 0.2, speed: 0.014 },
      { offset: -1.5, width: 2.2, phase: 1.3, speed: 0.018 },
      { offset: 1.4, width: 1.35, phase: 2.2, speed: 0.015 },
      { offset: 4.4, width: 0.72, phase: 3.1, speed: 0.012 }
    ].forEach((lane, laneIndex) => {
      traceStream(now, lane.phase, lane.offset, 0.72 + laneIndex * 0.08);
      context.strokeStyle = stream;
      context.lineWidth = lane.width;
      context.setLineDash([10 + laneIndex * 3, 27 - laneIndex * 2]);
      context.lineDashOffset = -(now * lane.speed + laneIndex * 17);
      context.stroke();
    });
    context.setLineDash([]);

    traceStream(now, 0.7, 0.2, 0.55);
    context.strokeStyle = "rgba(255,248,202,0.24)";
    context.lineWidth = 0.65;
    context.stroke();

    droplets.forEach((drop, index) => {
      const progress = staticMode ? drop.phase : (drop.phase + now * drop.speed) % 1;
      const point = streamPoint(progress, now, index * 0.73, drop.lane, 0.46);
      const x = point.x + Math.sin(progress * 13 + index) * drop.sway * 0.35;
      const y = point.y;
      const alpha = Math.pow(Math.sin(progress * Math.PI), 1.35) * 0.5;
      const glow = context.createRadialGradient(x, y - 0.5, 0, x, y, drop.radius * 3.2);
      glow.addColorStop(0, `rgba(255,255,225,${alpha})`);
      glow.addColorStop(0.4, `rgba(255,205,62,${alpha * 0.62})`);
      glow.addColorStop(1, "rgba(196,113,10,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.ellipse(x, y, drop.radius, drop.radius * (2.15 + (index % 3) * 0.28), 0, 0, Math.PI * 2);
      context.fill();
    });
    context.restore();
  }

  function shouldAnimate() {
    return !reduceMotion.matches && !saveData && !document.documentElement.classList.contains("motion-paused") && pageVisible && heroVisible;
  }

  function schedule() {
    if (shouldAnimate() && !frame) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    if (now - lastPaint >= frameInterval) {
      frozenTime = 0;
      paint(now);
      lastPaint = now;
    }
    schedule();
  }

  function refresh() {
    cancelAnimationFrame(frame);
    frame = 0;
    const now = performance.now();
    if (shouldAnimate()) frozenTime = 0;
    else if (!frozenTime) frozenTime = now;
    paint(frozenTime || now);
    schedule();
  }

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => { resize(); refresh(); }) : null;
  if (resizeObserver) resizeObserver.observe(heroVisual || canvas);
  else addEventListener("resize", () => { resize(); refresh(); }, { passive: true });
  // Picture sources can finish loading after the resize that selected them.
  // Keep listening even when the initial image is already complete.
  const onHeroImageLoad = () => { resize(); refresh(); };
  heroImage?.addEventListener("load", onHeroImageLoad);

  const intersectionObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(([entry]) => {
    heroVisible = entry?.isIntersecting !== false;
    if (heroVisible) refresh(); else { cancelAnimationFrame(frame); frame = 0; }
  }, { threshold: 0.01 }) : null;
  if (intersectionObserver) intersectionObserver.observe(canvas);

  const onMotionChange = () => refresh();
  const onVisibilityChange = () => {
    pageVisible = !document.hidden;
    if (pageVisible) refresh(); else { cancelAnimationFrame(frame); frame = 0; }
  };
  addEventListener("bkota-motion-change", onMotionChange);
  document.addEventListener("visibilitychange", onVisibilityChange);
  if (typeof reduceMotion.addEventListener === "function") reduceMotion.addEventListener("change", onMotionChange);
  else if (typeof reduceMotion.addListener === "function") reduceMotion.addListener(onMotionChange);
  const onPageHide = (event) => {
    if (event.persisted) return;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    heroImage?.removeEventListener("load", onHeroImageLoad);
    removeEventListener("pagehide", onPageHide);
  };
  // A persisted pagehide must not consume final-cleanup registration.
  addEventListener("pagehide", onPageHide);
  resize();
  refresh();
}

function setupGlobeDepth() {
  const globe = document.querySelector("#kindnessWorld");
  if (!globe || saveDataRequested || typeof matchMedia !== "function") return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  if (reduceMotion.matches || !finePointer.matches) return;
  let frame = 0;
  let pendingX = 0;
  let pendingY = 0;
  const paint = () => {
    frame = 0;
    globe.style.setProperty("--globe-rx", `${pendingY.toFixed(2)}deg`);
    globe.style.setProperty("--globe-ry", `${pendingX.toFixed(2)}deg`);
  };
  globe.addEventListener("pointermove", (event) => {
    const box = globe.getBoundingClientRect();
    pendingX = ((event.clientX - box.left) / box.width - 0.5) * 7;
    pendingY = -((event.clientY - box.top) / box.height - 0.5) * 7;
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
  globe.addEventListener("pointerleave", () => {
    pendingX = 0;
    pendingY = 0;
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });
}

setupMotionControl();
try { startLivingOil(); } catch (error) { console.warn("BKOTA living-oil enhancement unavailable", error); }
setupGlobeDepth();

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function addReviewLink(card, kind, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return;
  card.id = `${kind}-${id}`;
  const reviewUrl = new URL("privacy.html", location.href);
  reviewUrl.searchParams.set("kind", kind);
  reviewUrl.searchParams.set("id", id);
  reviewUrl.hash = "removal";
  const link = element("a", { className: "review-link", text: "Request privacy or removal review" });
  link.href = reviewUrl.href;
  card.append(link);
}

async function api(path, options = {}, expectedSubmissionKind = "") {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(6000)
  });
  if (expectedSubmissionKind) {
    const mediaType = response.headers?.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (response.redirected || mediaType !== "application/json") throw new Error("No confirmed submission receipt.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "BKOTA service request failed.");
  if (expectedSubmissionKind) {
    // Client contract for a future verified service, not an implemented backend:
    // { accepted: true, kind: "story" | "video", id: UUID, status: "pending" }.
    // HTTP success, an empty object, or a public-feed response is not a receipt.
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || payload.accepted !== true || payload.kind !== expectedSubmissionKind
      || payload.status !== "pending" || typeof payload.id !== "string" || !uuid.test(payload.id)) {
      throw new Error("No confirmed submission receipt.");
    }
  }
  return payload;
}

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.prototype.toString.call(value) === "[object Object]";
}

function hasExactKeys(value, required, optional = []) {
  if (!isPlainRecord(value)) return false;
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
}

function isCleanPublicText(value, maxLength, allowEmpty = false) {
  return typeof value === "string"
    && value.length <= maxLength
    && value.normalize("NFC") === value
    && !UNSAFE_PUBLIC_TEXT.test(value)
    && (allowEmpty ? value === value.trim() : value.length > 0 && value === value.trim());
}

function isPublishedAt(value) {
  if (typeof value !== "string" || value.length !== 24) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isApprovedStory(item) {
  const keys = ["id", "kind", "status", "anonymous", "name", "city", "continent", "message", "publishedAt"];
  if (!hasExactKeys(item, keys)
    || !UUID.test(item.id)
    || item.kind !== "story"
    || item.status !== "approved"
    || typeof item.anonymous !== "boolean"
    || !CONTINENTS.has(item.continent)
    || !isCleanPublicText(item.message, 280)
    || !isCleanPublicText(item.name, 40, true)
    || !isCleanPublicText(item.city, 60, true)
    || !isPublishedAt(item.publishedAt)) return false;
  return item.anonymous
    ? item.name === "" && item.city === ""
    : item.name.length > 0;
}

function isApprovedVideo(item) {
  const keys = ["id", "kind", "status", "url", "provider", "platform", "caption", "publishedAt"];
  if (!hasExactKeys(item, keys)
    || !UUID.test(item.id)
    || item.kind !== "video"
    || item.status !== "approved"
    || !isCleanPublicText(item.caption, 180)
    || !isPublishedAt(item.publishedAt)) return false;
  const parsed = parseSocialVideoUrl(item.url);
  return Boolean(parsed
    && parsed.url === item.url
    && parsed.provider === item.provider
    && parsed.platform === item.platform);
}

function verifiedFeedItems(payload, validator) {
  if (!hasExactKeys(payload, ["items"])
    || !Array.isArray(payload.items)
    || payload.items.length > PUBLIC_FEED_LIMIT
    || !payload.items.every(validator)) return null;
  return payload.items;
}

function liveServiceReady(health) {
  const required = [
    "ok",
    "service",
    "contractVersion",
    "publicFeedEnabled",
    "publicSubmissionsEnabled",
    "moderationQueueEnabled",
    "privacyReportsEnabled",
    "removalRequestsEnabled",
    "supportProfileEnabled"
  ];
  if (!hasExactKeys(health, required, ["anonymousImpactEnabled"])) return false;
  return health.ok === true
    && health.service === "bkota"
    && health.contractVersion === 1
    && health.publicFeedEnabled === true
    && health.publicSubmissionsEnabled === true
    && health.moderationQueueEnabled === true
    && health.privacyReportsEnabled === true
    && health.removalRequestsEnabled === true
    && typeof health.supportProfileEnabled === "boolean"
    && (!Object.hasOwn(health, "anonymousImpactEnabled") || typeof health.anonymousImpactEnabled === "boolean");
}

function recordTimestamp(item) {
  const candidate = item.publishedAt || item.createdAt;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const feedEl = document.querySelector("#feed");
const storyForm = document.querySelector("#bkotaForm");
const storyStatus = document.querySelector("#formStatus");
const storySubmit = storyForm.querySelector('[type="submit"]');

function collectionNotice(container, text) {
  container.append(element("p", { className: "collection-notice", text }));
}

function renderStories() {
  const local = readCollection(browserStorage, STORAGE_KEY);
  const items = [
    ...approvedStories.map((item) => ({ ...item, source: "approved" })),
    ...local.items.map((item) => ({ ...item, source: "private" }))
  ].sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
  feedEl.replaceChildren();
  if (!local.ok) collectionNotice(feedEl, storageErrorMessage(local.code));
  if (showStoryExamples) {
    ["I checked on an old friend and stayed long enough to really listen.", "I chose forgiveness instead of carrying yesterday's anger into today."].forEach((message) => {
      const example = element("article", { className: "feed-card" });
      example.append(element("div", { className: "feed-meta", text: "Illustrative example · not a real submission" }), element("div", { text: message }));
      feedEl.append(example);
    });
  }
  if (!items.length) {
    const card = element("article", { className: "feed-card" });
    card.append(element("div", { className: "feed-meta", text: "Your kindness belongs here" }), element("div", { text: backendAvailable ? "No stories are available to display yet. A new submission goes to human review first." : "Save a story to your private collection. It is not sent to Arthur or posted publicly." }));
    feedEl.append(card);
    return;
  }
  items.forEach((item) => {
    const name = item.anonymous ? "Anonymous" : String(item.name || "A friend").slice(0, 40);
    const city = item.anonymous ? "" : String(item.city || "").slice(0, 60);
    const continent = String(item.continent || "").slice(0, 20);
    const itemDate = item.publishedAt || item.createdAt;
    const date = Number.isNaN(Date.parse(itemDate)) ? "Recently" : new Date(itemDate).toLocaleDateString();
    const card = element("article", { className: "feed-card" });
    card.append(
      element("div", { className: "feed-meta", text: `${name}${city ? ` · ${city}` : ""}${continent ? ` · ${continent}` : ""} · ${date}` }),
      element("div", { className: "feed-meta", text: item.source === "approved" ? "Approved community story" : item.localOnly === true ? privateEntryLabel : "Older browser copy · submission history unknown" }),
      element("div", { text: String(item.message || "").slice(0, 280) })
    );
    if (item.source === "approved") addReviewLink(card, "story", item.id);
    feedEl.append(card);
  });
}

storyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (storySubmitting) return;
  const messageInput = document.querySelector("#messageText");
  const message = messageInput.value.trim();
  if (!message) {
    storyStatus.textContent = "Please describe your act of kindness first.";
    messageInput.focus();
    return;
  }
  const consent = document.querySelector("#storyConsent").checked;
  if (!consent) {
    storyStatus.textContent = "Please confirm consent before sharing your story.";
    return;
  }
  const continentValue = document.querySelector("#continent").value;
  if (!continentValue) {
    storyStatus.textContent = "Please choose the continent where the kindness happened.";
    return;
  }
  const submission = {
    message: message.slice(0, 280),
    name: document.querySelector("#name").value.trim().slice(0, 40),
    city: document.querySelector("#city").value.trim().slice(0, 60),
    continent: continentValue,
    anonymous: document.querySelector("#anon").checked,
    consent,
    website: document.querySelector("#storyWebsite").value.slice(0, 120)
  };
  if (submission.anonymous) {
    submission.name = "";
    submission.city = "";
  }
  if (backendAvailable) {
    storySubmitting = true;
    storySubmit.disabled = true;
    storyStatus.textContent = "Sending to the private review queue…";
    try {
      const receipt = await api("/api/stories", { method: "POST", body: JSON.stringify(submission) }, "story");
      storyForm.reset();
      storyStatus.textContent = `Your story was accepted into the moderation queue. Reference: ${receipt.id}. It has not been approved or published.`;
      return;
    } catch (error) {
      storyStatus.textContent = "A submission receipt could not be confirmed. Your story is still in the form. Do not immediately resubmit: a connection problem can hide a successful delivery.";
      return;
    } finally {
      storySubmitting = false;
      storySubmit.disabled = false;
    }
  }
  const saved = appendCollection(browserStorage, STORAGE_KEY, {
    id: crypto.randomUUID?.() || crypto.getRandomValues(new Uint32Array(4)).join("-"),
    ...submission,
    localOnly: true,
    createdAt: new Date().toISOString()
  }, MAX_STORIES);
  if (!saved.ok) { storyStatus.textContent = storageErrorMessage(saved.code); return; }
  storyForm.reset();
  storyStatus.textContent = sharedPreviewOrigin
    ? "Kept temporarily in this open tab—not submitted or published. Download your collection before reloading or leaving."
    : "Saved privately in this browser—not submitted or published. Download your collection to keep a copy.";
  renderStories();
});

document.querySelector("#seedDemo").addEventListener("click", () => {
  showStoryExamples = !showStoryExamples;
  document.querySelector("#seedDemo").textContent = showStoryExamples ? "Hide examples" : "Show examples";
  storyStatus.textContent = showStoryExamples ? "Showing two illustrative examples. Your saved collection is unchanged; examples are not real submissions or public impact." : "Examples hidden. Your saved collection is unchanged.";
  renderStories();
});

document.querySelector("#clearFeed").addEventListener("click", () => {
  if (!confirm(`Clear stories kept in ${privatePlace}? Download your collection first if you want to keep it. This does not remove public stories or pending submissions.`)) return;
  const cleared = clearCollection(browserStorage, STORAGE_KEY);
  if (!cleared.ok) { storyStatus.textContent = "The private stories could not be cleared. Browser storage is unavailable; no successful removal was confirmed."; return; }
  storyStatus.textContent = `Private stories were cleared from ${privatePlace}. Public stories and pending submissions are unchanged.`;
  renderStories();
});

const videoWall = document.querySelector("#videoWall");
const videoStatus = document.querySelector("#videoStatus");
const videoForm = document.querySelector("#videoForm");

function renderVideos() {
  const local = readCollection(browserStorage, VIDEO_STORAGE_KEY);
  const items = [
    ...approvedVideos.map((item) => ({ ...item, source: "approved" })),
    ...local.items.map((item) => ({ ...item, source: "private" }))
  ].sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
  videoWall.replaceChildren();
  if (!local.ok) collectionNotice(videoWall, storageErrorMessage(local.code));
  if (showVideoExamples) {
    items.unshift(
      { example: true, caption: "A community delivered groceries and stayed to share a meal." },
      { example: true, caption: "Neighbors worked together to help someone get home safely." }
    );
  }
  if (!items.length) {
    const empty = element("div", { className: "empty-state" });
    empty.append(element("strong", { text: "Start with kindness. Ask before filming." }), document.createElement("br"), document.createTextNode(backendAvailable ? "Share a consented YouTube or TikTok link for human review." : "Save a consented YouTube or TikTok link privately. No video is uploaded or published here."));
    videoWall.append(empty);
    return;
  }
  items.forEach((item) => {
    if (item.example === true) {
      const example = element("article", { className: "video-card" });
      const body = element("div", { className: "video-card-body" });
      body.append(element("p", { text: String(item.caption || "").slice(0, 180) }), element("span", { className: "video-platform", text: "Illustrative example · not a real submission · no external video" }));
      example.append(body);
      videoWall.append(example);
      return;
    }
    const safe = parseSocialVideoUrl(item.url);
    if (!safe) return;
    const card = element("article", { className: "video-card" });
    const link = element("a", { className: "video-card-preview" });
    link.href = safe.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Watch this ${safe.platform} kindness video`);
    link.append(element("span", { className: "video-watch-label", text: `Watch on ${safe.platform} ↗` }));
    const body = element("div", { className: "video-card-body" });
    const entryStatus = item.source === "approved" ? "approved community link" : item.localOnly === true ? privateEntryLabel.toLowerCase() : "older browser copy · submission history unknown";
    body.append(element("p", { text: String(item.caption || "").slice(0, 180) }), element("span", { className: "video-platform", text: `${safe.platform} · ${entryStatus}` }));
    if (item.source === "approved") addReviewLink(body, "video", item.id);
    card.append(link, body);
    videoWall.append(card);
  });
}

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (videoSubmitting) return;
  const result = parseSocialVideoUrl(document.querySelector("#videoUrl").value.trim());
  const caption = document.querySelector("#videoCaption").value.trim();
  if (!result) {
    videoStatus.textContent = "Please use a direct HTTPS YouTube video, YouTube Short, or canonical TikTok video link.";
    return;
  }
  if (!caption) {
    videoStatus.textContent = "Please describe the act of kindness.";
    return;
  }
  const consent = document.querySelector("#videoConsent").checked;
  if (!consent) {
    videoStatus.textContent = "Please confirm permission to film and publish from everyone identifiable. A public link alone does not establish permission.";
    return;
  }
  const postingAuthorization = document.querySelector("#videoOwnership").checked;
  if (!postingAuthorization) {
    videoStatus.textContent = "Please confirm that you control the posting account or have its owner's authorization to submit this link.";
    return;
  }
  const noMinorsOrVulnerableMoments = document.querySelector("#videoSafety").checked;
  if (!noMinorsOrVulnerableMoments) {
    videoStatus.textContent = "BKOTA's initial review queue cannot accept identifiable children or private, medical, crisis, humiliating, or otherwise vulnerable moments.";
    return;
  }
  const submission = {
    ...result,
    caption: caption.slice(0, 180),
    consent,
    postingAuthorization,
    noMinorsOrVulnerableMoments,
    website: document.querySelector("#videoWebsite").value.slice(0, 120)
  };
  if (backendAvailable) {
    videoSubmitting = true;
    document.querySelector("#videoSubmit").disabled = true;
    videoStatus.textContent = "Sending to the private review queue…";
    try {
      const receipt = await api("/api/videos", { method: "POST", body: JSON.stringify(submission) }, "video");
      videoForm.reset();
      videoStatus.textContent = `Your video link was accepted into the moderation queue. Reference: ${receipt.id}. It has not been approved or published.`;
      return;
    } catch (error) {
      videoStatus.textContent = "A submission receipt could not be confirmed. The link is still in the form. Do not immediately resubmit: a connection problem can hide a successful delivery.";
      return;
    } finally {
      videoSubmitting = false;
      document.querySelector("#videoSubmit").disabled = false;
    }
  }
  const saved = appendCollection(browserStorage, VIDEO_STORAGE_KEY, { ...submission, localOnly: true, createdAt: new Date().toISOString() }, MAX_VIDEOS);
  if (!saved.ok) { videoStatus.textContent = storageErrorMessage(saved.code); return; }
  videoForm.reset();
  videoStatus.textContent = sharedPreviewOrigin
    ? "Link kept temporarily in this open tab—not submitted or published. Download your collection before reloading or leaving. The video stays on its original platform."
    : "Link saved privately in this browser—not submitted or published. The video stays on its original platform.";
  renderVideos();
});

document.querySelector("#seedVideos").addEventListener("click", () => {
  showVideoExamples = !showVideoExamples;
  document.querySelector("#seedVideos").textContent = showVideoExamples ? "Hide examples" : "Show examples";
  videoStatus.textContent = showVideoExamples ? "Showing illustrative examples only. No real videos or submissions were added; your collection is unchanged." : "Examples hidden. Your saved collection is unchanged.";
  renderVideos();
});

document.querySelector("#clearVideos").addEventListener("click", () => {
  if (!confirm(`Clear video links kept in ${privatePlace}? Download your collection first if you want to keep it. This does not delete videos from their platforms, public links, or pending submissions.`)) return;
  const cleared = clearCollection(browserStorage, VIDEO_STORAGE_KEY);
  if (!cleared.ok) { videoStatus.textContent = "The private video links could not be cleared. Browser storage is unavailable; no successful removal was confirmed."; return; }
  videoStatus.textContent = `Private video links were cleared from ${privatePlace}. External videos, public links, and pending submissions are unchanged.`;
  renderVideos();
});

document.querySelector("#downloadCollection")?.addEventListener("click", () => {
  const status = document.querySelector("#collectionStatus") || storyStatus;
  const exported = exportCollection(browserStorage, new Date().toISOString());
  if (!exported.ok) {
    status.textContent = `No download was created. ${storageErrorMessage(exported.code)}`;
    return;
  }
  let objectUrl;
  let link;
  try {
    const blob = new Blob([JSON.stringify(exported.data, null, 2)], { type: "application/json" });
    objectUrl = URL.createObjectURL(blob);
    link = element("a");
    link.href = objectUrl;
    link.download = `bkota-private-collection-${exported.data.exportedAt.slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    status.textContent = `Download requested: ${exported.data.stories.length} private stories and ${exported.data.videoLinks.length} video links. Check your Downloads folder. Video files are not included. Nothing was sent to BKOTA; keep personal information private.`;
  } catch {
    status.textContent = "The download could not be started. Your saved collection is unchanged. Keep this tab open and try another browser download setting.";
  } finally {
    link?.remove();
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }
});

const venmoButton = document.querySelector("#venmoButton");
// Financial destinations remain disabled until a live, no-store service returns
// Arthur's independently verified profile. A public config flag or valid-looking
// handle alone is never treated as proof of ownership.
venmoButton.disabled = true;

renderStories();
renderVideos();

async function initializePlatform() {
  const mode = document.querySelector("#connectionMode");
  const note = document.querySelector("#connectionNote");
  const usePrivatePreview = () => {
    backendAvailable = false;
    impactAvailable = false;
    approvedStories = [];
    approvedVideos = [];
    storySubmit.textContent = sharedPreviewOrigin ? "Keep in this tab only" : "Save privately on this device";
    document.querySelector("#videoSubmit").textContent = sharedPreviewOrigin ? "Keep link in this tab only" : "Save link privately";
    mode.textContent = sharedPreviewOrigin ? "Temporary tab collection · not a public post" : "Private collection · not a public post";
    note.textContent = sharedPreviewOrigin
    ? "This shared preview address does not write stories or links to browser storage. They last only while this particular page instance remains available and are not sent to Arthur. Download anything you want to keep. Opening a video link contacts its platform."
      : "The moderated service is offline. Stories and links stay in this browser when storage is available; they are not sent to Arthur. Download a copy before clearing browser data. Opening a video link contacts its platform.";
    renderStories();
    renderVideos();
    renderStats(null);
  };
  if (config.moderatedServiceEnabled !== true || !isProductionOrigin) {
    usePrivatePreview();
    return;
  }
  try {
    const health = await api("/api/health");
    if (!liveServiceReady(health)) throw new Error("The complete moderated service is not ready.");
    const [stories, videos, stats] = await Promise.all([api("/api/stories"), api("/api/videos"), api("/api/stats")]);
    const publicStories = verifiedFeedItems(stories, isApprovedStory);
    const publicVideos = verifiedFeedItems(videos, isApprovedVideo);
    if (!publicStories || !publicVideos) throw new Error("Public feed data is unavailable.");
    // Public content stays in memory. Never overwrite a visitor's private collection.
    approvedStories = publicStories;
    approvedVideos = publicVideos;
    backendAvailable = true;
    impactAvailable = health.anonymousImpactEnabled === true;
    if (impactAvailable) measureVisiblePageOnce();
    storySubmit.textContent = "Submit story for review";
    document.querySelector("#videoSubmit").textContent = "Submit for review";
    mode.textContent = "Moderated platform connected";
    note.textContent = "New submissions enter Arthur's private review queue before publication. Existing private entries remain on this device and are not automatically uploaded. Approved community content is labeled separately.";
    renderStories();
    renderVideos();
    renderStats(stats);
  } catch {
    usePrivatePreview();
  }
}

initializePlatform();

function renderStats(stats) {
  const isCount = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  const verified = Boolean(stats && isCount(stats.approvedDeeds) && isCount(stats.approvedVideos) && isCount(stats.continentsReached));
  const statPairs = [
    ["#approvedStoryStat", "#globalDeedCount", stats?.approvedDeeds],
    ["#approvedVideoStat", "#approvedVideoCount", stats?.approvedVideos],
    ["#continentStat", "#continentCount", stats?.continentsReached],
  ];
  statPairs.forEach(([wrapperSelector, countSelector, value]) => {
    const wrapper = document.querySelector(wrapperSelector);
    const countNode = document.querySelector(countSelector);
    if (wrapper) wrapper.hidden = !verified;
    if (countNode) countNode.textContent = verified ? value.toLocaleString() : "0";
  });
  document.querySelectorAll("[data-continent]").forEach((item) => {
    const candidate = stats?.byContinent?.[item.dataset.continent];
    const count = verified && isCount(candidate) ? candidate : 0;
    item.classList.toggle("reached", verified && count > 0);
    item.title = verified ? `${count.toLocaleString()} approved kindness ${count === 1 ? "story" : "stories"}` : "No verified public total is available yet";
  });
}

const challengeText = "Join Arthur Farmer's #CaughtBeingKind challenge: do a good deed, ask permission before filming and sharing, and invite three friends. Helping never depends on being filmed. Be Kind One To Another — Ephesians 4:32. #BKOTA";
function buildSharePayload() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const shareUrl = new URL(canonical, location.href);
  shareUrl.search = "";
  shareUrl.hash = configuredCampaignCode ? `join?c=${configuredCampaignCode}` : "join";
  return { text: challengeText, url: shareUrl.href, clipboard: `${challengeText}\n${shareUrl.href}` };
}

async function shareWithDevice({ title, text, url, clipboard, status, messages }) {
  const nativeShare = typeof navigator.share === "function";
  const method = nativeShare ? "web-share" : "clipboard";
  try {
    if (nativeShare) {
      await navigator.share({ title, text, url });
      status.textContent = messages.nativeSuccess;
    } else {
      if (typeof navigator.clipboard?.writeText !== "function") throw new Error("Clipboard sharing is unavailable.");
      await navigator.clipboard.writeText(clipboard);
      status.textContent = messages.clipboardSuccess;
    }
    return { ok: true, method };
  } catch (error) {
    status.textContent = error?.name === "AbortError" ? messages.canceled : messages.unavailable;
    return { ok: false, method };
  }
}

document.querySelector("#shareMovement").addEventListener("click", async () => {
  const status = document.querySelector("#shareStatus");
  const payload = buildSharePayload();
  const method = typeof navigator.share === "function" ? "web-share" : "clipboard";
  const actionNonce = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "";
  const intent = actionNonce ? sendImpact("/api/impact/share", { actionNonce, phase: "intent", method }) : Promise.resolve(false);
  const result = await shareWithDevice({
    title: "BKOTA — Be Kind One To Another",
    ...payload,
    status,
    messages: {
      nativeSuccess: "Your device closed its share choices. BKOTA cannot verify where or whether anything was posted.",
      clipboardSuccess: "The movement invitation and website link were copied.",
      canceled: "Sharing was canceled. Nothing was posted by BKOTA.",
      unavailable: "Sharing was unavailable. Try Copy challenge text."
    }
  });
  if (result.ok) {
    await intent;
    if (actionNonce) void sendImpact("/api/impact/share", { actionNonce, phase: "completed", method });
  }
});

document.querySelector("#copyChallenge").addEventListener("click", async () => {
  const status = document.querySelector("#shareStatus");
  const payload = buildSharePayload();
  const actionNonce = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "";
  const intent = actionNonce ? sendImpact("/api/impact/share", { actionNonce, phase: "intent", method: "clipboard" }) : Promise.resolve(false);
  try { await navigator.clipboard.writeText(payload.clipboard); await intent; if (actionNonce) void sendImpact("/api/impact/share", { actionNonce, phase: "completed", method: "clipboard" }); status.textContent = "Challenge text and the BKOTA website link were copied—invite three friends."; }
  catch { status.textContent = payload.clipboard; }
});

const DAILY_ACT_VALUES = new Set(["encourage", "listen", "help", "repair", "include"]);
const dailyActInvitation = "Arthur Farmer invites you to choose one kind act today and pass it on. Be Kind One To Another — Ephesians 4:32. #BKOTA";

function buildDailyActSharePayload() {
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  if (typeof canonical !== "string" || canonical.trim() === "") return null;
  try {
    const shareUrl = new URL(canonical, location.href);
    if (shareUrl.protocol !== "https:" || shareUrl.username || shareUrl.password) return null;
    shareUrl.search = "";
    const configuredCode = /^[A-Za-z0-9_-]{22}$/.test(config.shareCampaignCode || "") ? config.shareCampaignCode : "";
    shareUrl.hash = configuredCode ? `today?c=${configuredCode}` : "today";
    return { text: dailyActInvitation, url: shareUrl.href, clipboard: `${dailyActInvitation}\n${shareUrl.href}` };
  } catch {
    return null;
  }
}

function setupDailyActFlow() {
  const form = document.querySelector("#dailyActForm");
  const done = document.querySelector("#dailyActDone");
  const share = document.querySelector("#dailyActShare");
  const status = document.querySelector("#dailyActStatus");
  if (!form || !done || !share || !status || typeof form.querySelectorAll !== "function") return;

  const choices = Array.from(form.querySelectorAll('input[name="dailyAct"]'));
  let chosenAct = "";
  let completed = false;

  function selectedAct() {
    const selected = choices.filter((choice) => choice.checked === true);
    return selected.length === 1 && DAILY_ACT_VALUES.has(selected[0].value) ? selected[0].value : "";
  }

  function closeFlow(message) {
    chosenAct = "";
    completed = false;
    done.checked = false;
    done.disabled = true;
    share.disabled = true;
    status.textContent = message;
  }

  closeFlow("Choose one act to begin. Nothing is stored, sent, or counted.");

  choices.forEach((choice) => {
    choice.addEventListener("change", () => {
      const nextAct = selectedAct();
      if (!nextAct) {
        closeFlow("That choice is unavailable. Choose one of the five listed acts.");
        return;
      }
      chosenAct = nextAct;
      completed = false;
      done.checked = false;
      done.disabled = false;
      share.disabled = true;
      status.textContent = "Choice ready. Complete it, then check the box. Nothing has been stored or sent.";
    });
  });

  done.addEventListener("change", () => {
    const currentAct = selectedAct();
    if (!currentAct || currentAct !== chosenAct || done.disabled) {
      closeFlow("Choose one of the five listed acts before marking it complete.");
      return;
    }
    completed = done.checked === true;
    share.disabled = !completed;
    status.textContent = completed
      ? "Marked complete in this tab only. BKOTA did not store, send, count, or verify this deed."
      : "Completion cleared. Nothing has been stored, sent, counted, or verified.";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentAct = selectedAct();
    if (!completed || !done.checked || done.disabled || !currentAct || currentAct !== chosenAct || !DAILY_ACT_VALUES.has(currentAct)) {
      share.disabled = true;
      status.textContent = "Complete one of the five listed acts before sharing Arthur's invitation. Nothing was posted.";
      return;
    }
    const payload = buildDailyActSharePayload();
    if (!payload) {
      share.disabled = true;
      status.textContent = "The safe BKOTA website link is unavailable, so sharing stayed closed. Nothing was posted.";
      return;
    }
    await shareWithDevice({
      title: "BKOTA — Be Kind One To Another",
      ...payload,
      status,
      messages: {
        nativeSuccess: "Your device closed its share choices. BKOTA cannot verify where or whether anything was posted, and it does not claim your deed was verified.",
        clipboardSuccess: "Arthur's invitation and the BKOTA link were copied. BKOTA did not post anything or verify a deed.",
        canceled: "Sharing was canceled. Nothing was posted by BKOTA, and no deed was recorded or verified.",
        unavailable: "Sharing was unavailable. Nothing was posted, recorded, counted, or verified."
      }
    });
  });
}

setupDailyActFlow();
