"use strict";
const CACHE = "bkota-shell-v12";
const SHELL = [
  "./", "index.html", "kindness-cards.html", "cards.js", "styles.css", "app.js",
  "community.js", "social-video.js", "merch.html", "merch.css", "merch.js",
  "privacy.html", "privacy.js", "manifest.webmanifest", "robots.txt", "sitemap.xml",
  "assets/bkota-mark.svg", "assets/merch/bkota-front-midnight.svg", "assets/merch/bkota-back-midnight.svg",
  "assets/merch/bkota-studio-v2.webp", "assets/merch/bkota-studio-v2-800.webp",
  "assets/hands-of-kindness-v2.webp", "assets/hands-of-kindness-v2.avif",
  "assets/hands-of-kindness-v2-1120.webp", "assets/hands-of-kindness-v2-1120.avif",
  "assets/hands-of-kindness-v2-mobile.webp", "assets/hands-of-kindness-v2-mobile.avif",
  "assets/kindness-world-3d-v1.webp"
];
const scopeUrl = new URL("./", self.location.href);
const shellPaths = new Set(SHELL.map((path) => new URL(path, scopeUrl).pathname));
const documentPaths = new Set(["./", "index.html", "kindness-cards.html", "merch.html", "privacy.html"].map((path) => new URL(path, scopeUrl).pathname));
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});
self.addEventListener("activate", (event) => {
  // Other applications may share a GitHub Pages origin. Never delete their caches.
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("bkota-shell-") && key !== CACHE).map((key) => caches.delete(key)))));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Configuration and private/API routes always go to the network, never the shell.
  if (url.pathname.includes("/api/") || /\/(?:config|admin)\.(?:js|html)$/.test(url.pathname)) return;
  const isDocument = documentPaths.has(url.pathname);
  const isAsset = url.pathname.startsWith(`${scopeUrl.pathname}assets/`) && /\.(?:png|webp|avif|svg|jpe?g|woff2?)$/i.test(url.pathname);
  if (!shellPaths.has(url.pathname) && !isAsset) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && !url.search && !response.redirected && response.type !== "opaque") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {}));
      }
      return response;
    } catch {
      const cached = await caches.match(event.request, { ignoreSearch: isDocument });
      if (cached) return cached;
      // HTML is only a navigation fallback. Never return index.html as a script/image.
      if (event.request.mode === "navigate" && isDocument) {
        const fallback = await caches.match(new URL("index.html", scopeUrl).href);
        if (fallback) return fallback;
      }
      return new Response("This resource is unavailable offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
