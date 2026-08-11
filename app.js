const { parseSocialVideoUrl } = globalThis.BKOTA_SOCIAL_VIDEO;

const STORAGE_KEY = "bkota_feed_v2";
const VIDEO_STORAGE_KEY = "bkota_video_wall_v1";
const MAX_STORIES = 50;
const MAX_VIDEOS = 24;
let backendAvailable = false;
let impactAvailable = false;
const config = Object.hasOwn(globalThis, "BKOTA_CONFIG") && Object.isFrozen(globalThis.BKOTA_CONFIG)
  ? globalThis.BKOTA_CONFIG
  : Object.freeze({});
const MOTION_STORAGE_KEY = "bkota_motion_paused_v1";

function captureAttributionCode() {
  const match = location.hash.match(/^#join\?(.+)$/);
  if (!match) return "";
  const code = new URLSearchParams(match[1]).get("c") || "";
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return "";
  history.replaceState(history.state, "", `${location.pathname}${location.search}#join`);
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
    const paused = query.matches || userPaused;
    document.documentElement.classList.toggle("motion-paused", paused);
    button.disabled = query.matches;
    button.setAttribute("aria-pressed", String(paused));
    button.textContent = query.matches ? "Background motion reduced by device setting" : userPaused ? "Resume background motion" : "Pause background motion";
    dispatchEvent(new CustomEvent("bkota-motion-change", { detail: { paused } }));
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
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  const reduceMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const saveData = navigator.connection?.saveData === true;
  let width = 0;
  let height = 0;
  let scale = 1;
  let frame = 0;
  let lastPaint = 0;
  let heroVisible = true;
  let pageVisible = !document.hidden;
  const frameInterval = 1000 / 30;
  const droplets = Array.from({ length: 10 }, (_, index) => ({
    phase: (index * 0.173) % 1,
    speed: 0.000018 + (index % 4) * 0.000004,
    radius: 0.8 + (index % 3) * 0.35,
    sway: 0.8 + (index % 4) * 0.45
  }));

  function resize() {
    const box = canvas.getBoundingClientRect();
    scale = Math.min(devicePixelRatio || 1, 2);
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function paint(now = 0) {
    context.clearRect(0, 0, width, height);
    const sourceX = width * 0.5;
    const sourceY = Math.min(24, height * 0.08);
    const streamLength = Math.max(1, height - sourceY);
    const shimmer = 0.5 + Math.sin(now * 0.0012) * 0.14;
    const stream = context.createLinearGradient(sourceX, sourceY, sourceX + 4, sourceY + streamLength);
    stream.addColorStop(0, "rgba(255,250,205,0)");
    stream.addColorStop(0.06, `rgba(255,249,184,${0.5 + shimmer * 0.18})`);
    stream.addColorStop(0.5, "rgba(255,220,102,0.48)");
    stream.addColorStop(0.86, "rgba(255,205,73,0.2)");
    stream.addColorStop(1, "rgba(255,196,47,0)");
    context.save();
    context.globalCompositeOperation = "screen";
    const sourceGlow = context.createRadialGradient(sourceX, sourceY + 4, 0, sourceX, sourceY + 4, 28);
    sourceGlow.addColorStop(0, `rgba(255,252,220,${0.22 + shimmer * 0.14})`);
    sourceGlow.addColorStop(0.38, "rgba(255,206,70,0.12)");
    sourceGlow.addColorStop(1, "rgba(255,176,20,0)");
    context.fillStyle = sourceGlow;
    context.beginPath();
    context.ellipse(sourceX, sourceY + 4, 28, 10, 0, 0, Math.PI * 2);
    context.fill();
    context.lineCap = "round";
    [{ offset: -3.5, width: 0.7 }, { offset: 0, width: 1.5 }, { offset: 3, width: 0.6 }].forEach((lane, laneIndex) => {
      context.beginPath();
      context.strokeStyle = stream;
      context.lineWidth = lane.width;
      for (let step = 0; step <= 28; step += 1) {
        const progress = step / 28;
        const x = sourceX + lane.offset + Math.sin(progress * 9 + now * 0.00075 + laneIndex) * (0.45 + progress * 1.4);
        const y = sourceY + progress * streamLength;
        if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    });
    droplets.forEach((drop, index) => {
      const staticMode = reduceMotion.matches || saveData || document.documentElement.classList.contains("motion-paused");
      const progress = staticMode ? drop.phase : (drop.phase + now * drop.speed) % 1;
      const x = sourceX + Math.sin(progress * 11 + index * 1.7) * drop.sway;
      const y = sourceY + progress * streamLength;
      const alpha = Math.sin(progress * Math.PI) * 0.48;
      const glow = context.createRadialGradient(x, y - 0.5, 0, x, y, drop.radius * 3.2);
      glow.addColorStop(0, `rgba(255,255,225,${alpha})`);
      glow.addColorStop(0.4, `rgba(255,205,62,${alpha * 0.58})`);
      glow.addColorStop(1, "rgba(196,113,10,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.ellipse(x, y, drop.radius, drop.radius * 2.1, 0, 0, Math.PI * 2);
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
    if (now - lastPaint >= frameInterval) { paint(now); lastPaint = now; }
    schedule();
  }

  function refresh() {
    cancelAnimationFrame(frame);
    frame = 0;
    paint(performance.now());
    schedule();
  }

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => { resize(); refresh(); }) : null;
  if (resizeObserver) resizeObserver.observe(canvas);
  else addEventListener("resize", () => { resize(); refresh(); }, { passive: true });

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
  addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
  }, { once: true });
  resize();
  refresh();
}

setupMotionControl();
try { startLivingOil(); } catch (error) { console.warn("BKOTA living-oil enhancement unavailable", error); }

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveList(key, items, limit) {
  localStorage.setItem(key, JSON.stringify(items.slice(-limit)));
}

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  return node;
}

function addReviewLink(card, kind, id) {
  if (!backendAvailable || !/^[0-9a-f-]{36}$/i.test(id || "")) return;
  card.id = `${kind}-${id}`;
  const reviewUrl = new URL("privacy.html", location.href);
  reviewUrl.searchParams.set("kind", kind);
  reviewUrl.searchParams.set("id", id);
  reviewUrl.hash = "removal";
  const link = element("a", { className: "review-link", text: "Request privacy or removal review" });
  link.href = reviewUrl.href;
  card.append(link);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(6000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "BKOTA service request failed.");
  return payload;
}

const feedEl = document.querySelector("#feed");
const storyForm = document.querySelector("#bkotaForm");
const storyStatus = document.querySelector("#formStatus");

function renderStories() {
  const items = readList(STORAGE_KEY).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  feedEl.replaceChildren();
  if (!items.length) {
    const card = element("article", { className: "feed-card" });
    card.append(element("div", { className: "feed-meta", text: "The wall is ready" }), element("div", { text: "Be the first to add an act of kindness." }));
    feedEl.append(card);
    return;
  }
  items.forEach((item) => {
    const name = item.anonymous ? "Anonymous" : String(item.name || "A friend").slice(0, 40);
    const city = String(item.city || "").slice(0, 60);
    const continent = String(item.continent || "").slice(0, 20);
    const date = Number.isNaN(Date.parse(item.createdAt)) ? "Recently" : new Date(item.createdAt).toLocaleDateString();
    const card = element("article", { className: "feed-card" });
    card.append(
      element("div", { className: "feed-meta", text: `${name}${city ? ` · ${city}` : ""}${continent ? ` · ${continent}` : ""} · ${date}` }),
      element("div", { text: String(item.message || "").slice(0, 280) })
    );
    addReviewLink(card, "story", item.id);
    feedEl.append(card);
  });
}

storyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
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
    website: document.querySelector("#storyWebsite").value,
    attributionCode: activeAttributionCode || undefined
  };
  if (submission.anonymous) {
    submission.name = "";
    submission.city = "";
  }
  if (backendAvailable) {
    try {
      await api("/api/stories", { method: "POST", body: JSON.stringify(submission) });
      storyForm.reset();
      storyStatus.textContent = "Thank you—your story is in Arthur's moderation queue.";
      return;
    } catch (error) {
      storyStatus.textContent = `${error.message} Your story was not sent.`;
      return;
    }
  }
  const items = readList(STORAGE_KEY);
  items.push({
    id: crypto.randomUUID?.() || crypto.getRandomValues(new Uint32Array(4)).join("-"),
    ...submission,
    createdAt: new Date().toISOString()
  });
  saveList(STORAGE_KEY, items, MAX_STORIES);
  storyForm.reset();
  storyStatus.textContent = "Your kindness was added to this private preview.";
  renderStories();
});

document.querySelector("#seedDemo").addEventListener("click", () => {
  saveList(STORAGE_KEY, [
    { name: "Arthur", city: "Tennessee", continent: "North America", message: "I checked on an old friend and stayed long enough to really listen.", anonymous: false, createdAt: new Date().toISOString() },
    { name: "", city: "", continent: "Europe", message: "I chose forgiveness instead of carrying yesterday's anger into today.", anonymous: true, createdAt: new Date(Date.now() - 86400000).toISOString() }
  ], MAX_STORIES);
  storyStatus.textContent = "Two example stories were added.";
  renderStories();
});

document.querySelector("#clearFeed").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  storyStatus.textContent = "The private preview was cleared.";
  renderStories();
});

const videoWall = document.querySelector("#videoWall");
const videoStatus = document.querySelector("#videoStatus");
const videoForm = document.querySelector("#videoForm");

function renderVideos() {
  const items = readList(VIDEO_STORAGE_KEY).reverse();
  videoWall.replaceChildren();
  if (!items.length) {
    const empty = element("div", { className: "empty-state" });
    empty.append(element("strong", { text: "Kindness TV is ready for its first story." }), document.createElement("br"), document.createTextNode("Add a public YouTube or TikTok link to preview the future community wall."));
    videoWall.append(empty);
    return;
  }
  items.forEach((item) => {
    if (item.example === true) {
      const example = element("article", { className: "video-card" });
      const body = element("div", { className: "video-card-body" });
      body.append(element("p", { text: String(item.caption || "").slice(0, 180) }), element("span", { className: "video-platform", text: "Illustrative example · no external video" }));
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
    const body = element("div", { className: "video-card-body" });
    body.append(element("p", { text: String(item.caption || "").slice(0, 180) }), element("span", { className: "video-platform", text: `${safe.platform} · ${backendAvailable ? "approved moderated link" : "private browser-preview link"}` }));
    addReviewLink(body, "video", item.id);
    card.append(link, body);
    videoWall.append(card);
  });
}

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
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
    videoStatus.textContent = "Please confirm you have permission to share this public link.";
    return;
  }
  const submission = { ...result, caption: caption.slice(0, 180), consent, website: document.querySelector("#videoWebsite").value, attributionCode: activeAttributionCode || undefined };
  if (backendAvailable) {
    try {
      await api("/api/videos", { method: "POST", body: JSON.stringify(submission) });
      videoForm.reset();
      videoStatus.textContent = "Thank you—the link is in Arthur's moderation queue.";
      return;
    } catch (error) {
      videoStatus.textContent = `${error.message} The link was not sent.`;
      return;
    }
  }
  const items = readList(VIDEO_STORAGE_KEY);
  items.push({ ...submission, createdAt: new Date().toISOString() });
  saveList(VIDEO_STORAGE_KEY, items, MAX_VIDEOS);
  videoForm.reset();
  videoStatus.textContent = "Added to this browser's private Kindness TV preview.";
  renderVideos();
});

document.querySelector("#seedVideos").addEventListener("click", () => {
  saveList(VIDEO_STORAGE_KEY, [
    { example: true, caption: "A community delivered groceries and stayed to share a meal." },
    { example: true, caption: "Strangers worked together to help a neighbor get home safely." }
  ], MAX_VIDEOS);
  videoStatus.textContent = "Two non-clickable, clearly labeled example stories were added.";
  renderVideos();
});

document.querySelector("#clearVideos").addEventListener("click", () => {
  localStorage.removeItem(VIDEO_STORAGE_KEY);
  videoStatus.textContent = "The private video preview was cleared.";
  renderVideos();
});

const venmoButton = document.querySelector("#venmoButton");
if (config.venmoApproved === true && /^[A-Za-z0-9_-]{5,30}$/.test(config.venmoHandle || "")) {
  venmoButton.disabled = false;
  venmoButton.textContent = "Support Arthur on Venmo";
  venmoButton.addEventListener("click", () => {
    const destination = new URL(`/u/${encodeURIComponent(config.venmoHandle)}`, "https://venmo.com");
    location.assign(destination.href);
  });
}

renderStories();
renderVideos();

async function initializePlatform() {
  const mode = document.querySelector("#connectionMode");
  const note = document.querySelector("#connectionNote");
  const usePrivatePreview = () => {
    backendAvailable = false;
    document.querySelector("#videoSubmit").textContent = "Add to private preview";
    mode.textContent = "Private browser preview";
    note.textContent = "Nothing leaves this browser while the moderated service is offline.";
  };
  if (config.moderatedServiceEnabled !== true) {
    usePrivatePreview();
    return;
  }
  try {
    const health = await api("/api/health");
    if (health.publicSubmissionsEnabled !== true) throw new Error("Public submissions are not enabled.");
    backendAvailable = true;
    impactAvailable = health.anonymousImpactEnabled === true;
    if (impactAvailable) measureVisiblePageOnce();
    document.querySelector("#videoSubmit").textContent = "Submit for review";
    mode.textContent = "Moderated platform connected";
    note.textContent = "Submissions enter Arthur's private review queue before publication.";
    const [stories, videos, stats] = await Promise.all([api("/api/stories"), api("/api/videos"), api("/api/stats")]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories.items.map((item) => ({ ...item, anonymous: item.anonymous === true }))));
    renderStories();
    localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos.items));
    renderVideos();
    renderStats(stats);
  } catch {
    usePrivatePreview();
  }
}

initializePlatform();

function renderStats(stats) {
  document.querySelector("#globalDeedCount").textContent = Number(stats.approvedDeeds || 0).toLocaleString();
  document.querySelector("#continentCount").textContent = String(stats.continentsReached || 0);
  document.querySelectorAll("[data-continent]").forEach((item) => {
    const count = Number(stats.byContinent?.[item.dataset.continent] || 0);
    item.classList.toggle("reached", count > 0);
    item.title = `${count.toLocaleString()} approved kindness ${count === 1 ? "story" : "stories"}`;
  });
}

const challengeText = "I joined Arthur Farmer's #CaughtBeingKind challenge: notice a good deed, ask permission, share it, and invite three friends. Be Kind One To Another — Ephesians 4:32. #BKOTA";
document.querySelector("#shareMovement").addEventListener("click", async () => {
  const status = document.querySelector("#shareStatus");
  const shareUrl = new URL(location.href);
  shareUrl.search = "";
  const configuredCode = /^[A-Za-z0-9_-]{22}$/.test(config.shareCampaignCode || "") ? config.shareCampaignCode : "";
  shareUrl.hash = configuredCode ? `join?c=${configuredCode}` : "join";
  const method = navigator.share ? "web-share" : "clipboard";
  const actionNonce = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "";
  const intent = actionNonce ? sendImpact("/api/impact/share", { actionNonce, phase: "intent", method }) : Promise.resolve(false);
  try {
    if (navigator.share) await navigator.share({ title: "BKOTA — Be Kind One To Another", text: challengeText, url: shareUrl.href });
    else { await navigator.clipboard.writeText(`${challengeText}\n${shareUrl.href}`); status.textContent = "The movement invitation was copied."; }
    await intent;
    if (actionNonce) void sendImpact("/api/impact/share", { actionNonce, phase: "completed", method });
  } catch (error) {
    if (error.name !== "AbortError") status.textContent = "Sharing was unavailable. Try Copy challenge text.";
  }
});

document.querySelector("#copyChallenge").addEventListener("click", async () => {
  const status = document.querySelector("#shareStatus");
  const actionNonce = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : "";
  const intent = actionNonce ? sendImpact("/api/impact/share", { actionNonce, phase: "intent", method: "clipboard" }) : Promise.resolve(false);
  try { await navigator.clipboard.writeText(challengeText); await intent; if (actionNonce) void sendImpact("/api/impact/share", { actionNonce, phase: "completed", method: "clipboard" }); status.textContent = "Challenge text copied—invite three friends."; }
  catch { status.textContent = challengeText; }
});
