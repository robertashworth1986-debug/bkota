"use strict";
const CACHE = "bkota-shell-v5";
const SHELL = ["./", "index.html", "kindness-cards.html", "cards.js", "styles.css", "app.js", "config.js", "privacy.html", "privacy.js", "manifest.webmanifest", "robots.txt", "sitemap.xml", "assets/bkota-mark.svg", "assets/hands-of-kindness-hero.png", "assets/hands-of-kindness-hero.webp", "assets/hands-of-kindness-hero.avif", "assets/hands-of-kindness-hero-mobile.png", "assets/hands-of-kindness-hero-mobile.webp", "assets/hands-of-kindness-hero-mobile.avif"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/api/") || url.pathname.endsWith("/admin.html")) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("index.html"))));
});
