"use strict";

const STORAGE_KEY = "bkota_feed_v2";
const VIDEO_STORAGE_KEY = "bkota_video_wall_v1";
const MAX_STORIES = 50;
const MAX_VIDEOS = 24;
let backendAvailable = false;
const config = Object.hasOwn(globalThis, "BKOTA_CONFIG") && Object.isFrozen(globalThis.BKOTA_CONFIG)
  ? globalThis.BKOTA_CONFIG
  : Object.freeze({});

function startLivingOil() {
  const canvas = document.querySelector("#livingOil");
  if (!canvas) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0;
  let height = 0;
  let scale = 1;
  let frame = 0;
  const droplets = Array.from({ length: 34 }, (_, index) => ({
    lane: (index % 7) / 6,
    phase: (index * 0.137) % 1,
    speed: 0.000035 + (index % 5) * 0.000006,
    radius: 1.2 + (index % 4) * 0.55,
    sway: 2 + (index % 6) * 0.8
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

  function draw(now = 0) {
    context.clearRect(0, 0, width, height);
    const mobile = width < 900;
    const sourceX = width * (mobile ? 0.705 : 0.753);
    const sourceY = height * (mobile ? 0.31 : 0.335);
    const streamLength = height * (mobile ? 0.44 : 0.59);
    const shimmer = 0.5 + Math.sin(now * 0.0017) * 0.12;
    const stream = context.createLinearGradient(sourceX, sourceY, sourceX + 8, sourceY + streamLength);
    stream.addColorStop(0, "rgba(255,249,194,0)");
    stream.addColorStop(0.08, `rgba(255,244,154,${0.82 + shimmer * 0.12})`);
    stream.addColorStop(0.48, "rgba(231,166,39,0.82)");
    stream.addColorStop(0.84, "rgba(255,205,73,0.34)");
    stream.addColorStop(1, "rgba(255,196,47,0)");
    context.lineCap = "round";
    [0, 1, 2].forEach((lane) => {
      context.beginPath();
      context.strokeStyle = stream;
      context.lineWidth = 1.4 + lane * 1.2;
      for (let step = 0; step <= 24; step += 1) {
        const progress = step / 24;
        const x = sourceX + lane * 3.5 + Math.sin(progress * 10 + now * 0.0011 + lane) * (1.2 + progress * 3);
        const y = sourceY + progress * streamLength;
        if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    });
    droplets.forEach((drop, index) => {
      const progress = reduceMotion.matches ? drop.phase : (drop.phase + now * drop.speed) % 1;
      const x = sourceX - 5 + drop.lane * 15 + Math.sin(progress * 13 + index) * drop.sway;
      const y = sourceY + progress * streamLength;
      const alpha = Math.sin(progress * Math.PI) * 0.82;
      const glow = context.createRadialGradient(x - 0.5, y - 0.8, 0, x, y, drop.radius * 3.4);
      glow.addColorStop(0, `rgba(255,255,211,${alpha})`);
      glow.addColorStop(0.35, `rgba(255,205,62,${alpha * 0.75})`);
      glow.addColorStop(1, "rgba(196,113,10,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.ellipse(x, y, drop.radius, drop.radius * 2.5, 0, 0, Math.PI * 2);
      context.fill();
    });
    if (!reduceMotion.matches) frame = requestAnimationFrame(draw);
  }

  const observer = new ResizeObserver(() => { resize(); if (reduceMotion.matches) draw(0); });
  observer.observe(canvas);
  reduceMotion.addEventListener("change", () => { cancelAnimationFrame(frame); draw(0); });
  resize();
  draw();
}

startLivingOil();

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
    website: document.querySelector("#storyWebsite").value
  };
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

function classifyVideo(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) return { platform: "YouTube", url: url.href };
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return { platform: "TikTok", url: url.href };
    return null;
  } catch {
    return null;
  }
}

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
    const safe = classifyVideo(item.url);
    if (!safe) return;
    const card = element("article", { className: "video-card" });
    const link = element("a", { className: "video-card-preview" });
    link.href = safe.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Watch this ${safe.platform} kindness video`);
    const body = element("div", { className: "video-card-body" });
    body.append(element("p", { text: String(item.caption || "").slice(0, 180) }), element("span", { className: "video-platform", text: `${safe.platform} · private preview link` }));
    card.append(link, body);
    videoWall.append(card);
  });
}

videoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = classifyVideo(document.querySelector("#videoUrl").value.trim());
  const caption = document.querySelector("#videoCaption").value.trim();
  if (!result) {
    videoStatus.textContent = "Please use a valid HTTPS YouTube or TikTok link.";
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
  const submission = { ...result, caption: caption.slice(0, 180), consent, website: document.querySelector("#videoWebsite").value };
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
    { platform: "YouTube", url: "https://www.youtube.com/", caption: "A community delivered groceries and stayed to share a meal." },
    { platform: "TikTok", url: "https://www.tiktok.com/", caption: "Strangers worked together to help a neighbor get home safely." }
  ], MAX_VIDEOS);
  videoStatus.textContent = "Two clearly labeled example stories were added.";
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
  try {
    await api("/api/health");
    backendAvailable = true;
    document.querySelector("#videoSubmit").textContent = "Submit for review";
    mode.textContent = "Moderated platform connected";
    note.textContent = "Submissions enter Arthur's private review queue before publication.";
    const [stories, videos, stats] = await Promise.all([api("/api/stories"), api("/api/videos"), api("/api/stats")]);
    if (stories.items.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories.items.map((item) => ({ ...item, anonymous: item.name === "Anonymous" }))));
      renderStories();
    }
    if (videos.items.length) {
      localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos.items));
      renderVideos();
    }
    renderStats(stats);
  } catch {
    backendAvailable = false;
    document.querySelector("#videoSubmit").textContent = "Add to private preview";
    mode.textContent = "Private browser preview";
    note.textContent = "Nothing leaves this browser while the moderated service is offline.";
  }
}

initializePlatform();

function renderStats(stats) {
  document.querySelector("#globalDeedCount").textContent = Number(stats.approvedDeeds || 0).toLocaleString();
  document.querySelector("#continentCount").textContent = String(stats.continentsReached || 0);
  document.querySelectorAll("[data-continent]").forEach((item) => {
    const count = Number(stats.byContinent?.[item.dataset.continent] || 0);
    item.classList.toggle("reached", count > 0);
    item.title = `${count.toLocaleString()} approved ${count === 1 ? "deed" : "deeds"}`;
  });
}

const challengeText = "I joined Arthur Farmer's #CaughtBeingKind challenge: notice a good deed, ask permission, share it, and invite three friends. Be Kind One To Another — Ephesians 4:32. #BKOTA";
document.querySelector("#shareMovement").addEventListener("click", async () => {
  const status = document.querySelector("#shareStatus");
  const shareUrl = new URL(location.href); shareUrl.hash = "join"; shareUrl.searchParams.set("ref", "share");
  try {
    if (navigator.share) await navigator.share({ title: "BKOTA — Be Kind One To Another", text: challengeText, url: shareUrl.href });
    else { await navigator.clipboard.writeText(`${challengeText}\n${shareUrl.href}`); status.textContent = "The movement invitation was copied."; }
  } catch (error) {
    if (error.name !== "AbortError") status.textContent = "Sharing was unavailable. Try Copy challenge text.";
  }
});

document.querySelector("#copyChallenge").addEventListener("click", async () => {
  const status = document.querySelector("#shareStatus");
  try { await navigator.clipboard.writeText(challengeText); status.textContent = "Challenge text copied—invite three friends."; }
  catch { status.textContent = challengeText; }
});
