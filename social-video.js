(() => {
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_ID = /^\d{6,30}$/;
const TIKTOK_CREATOR = /^@[A-Za-z0-9._-]{2,40}$/;

function safeUrl(raw) {
  if (typeof raw !== "string" || raw.length > 500) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

function youtubeResult(id) {
  if (!YOUTUBE_ID.test(id || "")) return null;
  return Object.freeze({
    provider: "youtube",
    platform: "YouTube",
    providerVideoId: id,
    providerCreator: "",
    url: `https://www.youtube.com/watch?v=${id}`
  });
}

function parseYouTube(url) {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  if (host === "youtu.be") {
    if (segments.length !== 1 || url.searchParams.has("v")) return null;
    return youtubeResult(segments[0]);
  }
  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) return null;
  if (url.pathname === "/watch") {
    const ids = url.searchParams.getAll("v");
    if (ids.length !== 1) return null;
    return youtubeResult(ids[0]);
  }
  if (segments.length === 2 && segments[0] === "shorts") return youtubeResult(segments[1]);
  return null;
}

function parseTikTok(url) {
  const host = url.hostname.toLowerCase();
  if (!["tiktok.com", "www.tiktok.com"].includes(host) || url.pathname.includes("%")) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 3 || segments[1] !== "video" || !TIKTOK_CREATOR.test(segments[0]) || !TIKTOK_ID.test(segments[2])) return null;
  const creator = segments[0];
  const id = segments[2];
  return Object.freeze({
    provider: "tiktok",
    platform: "TikTok",
    providerVideoId: id,
    providerCreator: creator.slice(1),
    url: `https://www.tiktok.com/${creator}/video/${id}`
  });
}

function parseSocialVideoUrl(raw) {
  const url = safeUrl(raw);
  if (!url) return null;
  return parseYouTube(url) || parseTikTok(url);
}

function youtubeVideoFromId(id) {
  return youtubeResult(id);
}

Object.defineProperty(globalThis, "BKOTA_SOCIAL_VIDEO", {
  value: Object.freeze({ parseSocialVideoUrl, youtubeVideoFromId }),
  writable: false,
  configurable: false
});
})();
