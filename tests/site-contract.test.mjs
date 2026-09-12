import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Dependency-free release contracts, not a substitute for browser or print QA.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const pages = readdirSync(root).filter((name) => name.endsWith(".html"));
const attributes = (tag) => Object.fromEntries(
  [...tag.matchAll(/\b([\w-]+)\s*=\s*(["'])(.*?)\2/gs)].map((match) => [match[1].toLowerCase(), match[3]])
);

for (const page of pages) {
  const html = read(page);
  test(`${page}: accessible document shell, unique IDs, and named image dimensions`, () => {
    assert.match(html, /<html\b[^>]*\blang=["']en["']/i);
    assert.match(html, /<meta\b[^>]*name=["']viewport["']/i);
    assert.match(html, /<title>[^<]+<\/title>/i);
    assert.equal([...html.matchAll(/<h1\b/gi)].length, 1);
    const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, "Duplicate IDs break labels and controls");
    for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
      const attrs = attributes(tag);
      assert.ok(Object.hasOwn(attrs, "alt"), `Image has no alt attribute: ${tag}`);
      assert.ok(Number(attrs.width) > 0 && Number(attrs.height) > 0, `Image needs intrinsic dimensions: ${tag}`);
    }
    for (const [tag] of html.matchAll(/<label\b[^>]*>/gi)) {
      const target = attributes(tag).for;
      if (target) assert.ok(ids.includes(target), `Label references missing #${target}`);
    }
  });

  test(`${page}: static local resource links resolve`, () => {
    const resources = [];
    for (const [tag] of html.matchAll(/<(?:script|img|source|link|a)\b[^>]*>/gi)) {
      const attrs = attributes(tag);
      if (attrs.src) resources.push(attrs.src);
      if (attrs.href) resources.push(attrs.href);
      if (attrs.srcset) resources.push(...attrs.srcset.split(",").map((item) => item.trim().split(/\s+/)[0]));
    }
    for (const resource of resources) {
      if (!resource || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(resource)) continue;
      const relative = resource.split(/[?#]/)[0];
      if (!relative) continue;
      assert.ok(!relative.startsWith("/"), `Root-relative resource breaks GitHub Pages project paths: ${resource}`);
      assert.ok(existsSync(resolve(root, relative)), `Missing local resource: ${resource}`);
    }
    const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
    for (const [, fragment] of html.matchAll(/\bhref=["']#([^"']+)["']/g)) {
      assert.ok(ids.has(fragment), `Dead in-page anchor: #${fragment}`);
    }
  });

  test(`${page}: no external frames/scripts or inline script execution`, () => {
    const cspTag = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag))
      .find((attrs) => attrs["http-equiv"]?.toLowerCase() === "content-security-policy");
    assert.ok(cspTag, "Missing Content Security Policy");
    const directives = new Map(cspTag.content.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")];
    }));
    assert.equal(directives.get("default-src"), "'self'");
    assert.equal(directives.get("script-src"), "'self'");
    assert.equal(directives.get("frame-src"), "'none'");
    assert.equal(directives.get("object-src"), "'none'");
    assert.equal(directives.get("base-uri"), "'none'");
    assert.doesNotMatch(html, /<iframe\b|\bon\w+\s*=/i);
    for (const [, tag, body] of html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)) {
      const src = attributes(tag).src;
      assert.ok(src && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(src), "Scripts must be local external files");
      assert.equal(body.trim(), "", "CSP blocks inline scripts");
    }
  });
}

test("public configuration keeps submissions, provider APIs, and payments disabled", () => {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(read("config.js"), sandbox);
  const config = sandbox.BKOTA_CONFIG;
  assert.ok(Object.isFrozen(config));
  for (const key of ["moderatedServiceEnabled", "venmoApproved", "youtubeApiEnabled", "tiktokApiEnabled"]) {
    assert.equal(config[key], false, `${key} needs a separately verified service/account launch`);
  }
  assert.equal(config.venmoHandle, "");
});

test("root-domain launch metadata consistently targets bkota.co while support stays fail-closed", () => {
  assert.equal(read("CNAME").trim(), "bkota.co");
  const html = read("index.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/bkota\.co\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/bkota\.co\/">/);
  assert.match(html, /one-time payment/i);
  assert.match(html, /not a charitable or tax-deductible contribution/i);
  assert.match(html, /<button[^>]+id="venmoButton"[^>]+disabled/i);
  assert.match(read("robots.txt"), /Sitemap: https:\/\/bkota\.co\/sitemap\.xml/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/bkota\.co\//);
});

test("social-video parser canonicalizes public provider links and removes tracking parameters", () => {
  const sandbox = { URL };
  vm.runInNewContext(read("social-video.js"), sandbox);
  const parse = sandbox.BKOTA_SOCIAL_VIDEO.parseSocialVideoUrl;
  const expected = "https://www.youtube.com/watch?v=abcdefghijk";
  for (const input of [
    "https://youtu.be/abcdefghijk?si=tracking",
    "https://www.youtube.com/watch?v=abcdefghijk&utm_source=test",
    "https://m.youtube.com/shorts/abcdefghijk",
  ]) assert.equal(parse(input)?.url, expected);
  assert.equal(parse("https://www.tiktok.com/@kindness/video/123456789?tracking=1")?.url,
    "https://www.tiktok.com/@kindness/video/123456789");
});

test("social-video parser rejects non-provider, credentialed, ambiguous, and executable URLs", () => {
  const sandbox = { URL };
  vm.runInNewContext(read("social-video.js"), sandbox);
  const parse = sandbox.BKOTA_SOCIAL_VIDEO.parseSocialVideoUrl;
  for (const input of [
    "javascript:alert(1)", "data:text/html,test", "http://youtu.be/abcdefghijk",
    "https://youtube.com.evil.example/watch?v=abcdefghijk",
    "https://youtube.com@evil.example/watch?v=abcdefghijk",
    "https://person:secret@youtube.com/watch?v=abcdefghijk",
    "https://youtube.com:8443/watch?v=abcdefghijk",
    "https://youtube.com/watch?v=abcdefghijk&v=zzzzzzzzzzz",
    "https://youtu.be/abcdefghijk/extra", "https://youtu.be/abcdefghijk#fragment",
    "https://youtube.com/embed/abcdefghijk", "https://www.tiktok.com/@kindness/video/abc",
    "https://www.tiktok.com/@kindness/video/%31%32%33%34%35%36", "x".repeat(501), null, {},
  ]) assert.equal(parse(input), null, `Unexpectedly accepted ${String(input)}`);
});

test("service worker does not intercept private/configuration, API, external, or mutation requests", () => {
  const handlers = new Map();
  const sandbox = {
    URL,
    self: { location: new URL("https://example.test/bkota/sw.js"), addEventListener: (type, handler) => handlers.set(type, handler) },
  };
  vm.runInNewContext(read("sw.js"), sandbox);
  const handleFetch = handlers.get("fetch");
  assert.equal(typeof handleFetch, "function");
  for (const [path, method] of [
    ["/api/stories", "GET"], ["/bkota/api/videos", "GET"], ["/bkota/config.js", "GET"],
    ["/bkota/config.js?v=2", "GET"], ["/bkota/admin.html", "GET"], ["/bkota/admin.js", "GET"],
    ["https://external.test/image.webp", "GET"], ["/bkota/index.html", "POST"],
  ]) {
    let intercepted = false;
    handleFetch({ request: { url: new URL(path, sandbox.self.location).href, method }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, `Service worker intercepted ${method} ${path}`);
  }
});

function workerHarness({ online = false, cachedIndex = true } = {}) {
  const handlers = new Map();
  const deleted = [];
  const cachedWrites = [];
  const waits = [];
  const sandbox = {
    URL, Response,
    self: { location: new URL("https://example.test/bkota/sw.js"), addEventListener: (type, handler) => handlers.set(type, handler) },
    fetch: async () => { if (!online) throw new Error("Offline"); return new Response("asset bytes", { status: 200 }); },
    caches: {
      keys: async () => ["unrelated-app-v3", "bkota-shell-v1", "bkota-shell-v11"],
      delete: async (key) => { deleted.push(key); return true; },
      open: async () => ({ put: async (...args) => cachedWrites.push(args), addAll: async () => {} }),
      match: async (request) => cachedIndex && String(request) === "https://example.test/bkota/index.html"
        ? new Response("<html>cached shell</html>", { headers: { "Content-Type": "text/html" } }) : undefined,
    },
  };
  vm.runInNewContext(read("sw.js"), sandbox);
  return {
    handlers, deleted, cachedWrites, waits,
    fetch(path, mode = "cors") {
      let response;
      handlers.get("fetch")({ request: { url: new URL(path, sandbox.self.location).href, method: "GET", mode },
        respondWith: (promise) => { response = promise; }, waitUntil: (promise) => waits.push(promise) });
      return response;
    },
  };
}

test("service worker missing scripts/images return an explicit offline error, never HTML", async () => {
  const worker = workerHarness();
  for (const path of ["app.js", "assets/not-cached.webp"]) {
    const response = await worker.fetch(path);
    assert.equal(response.status, 503);
    assert.match(response.headers.get("content-type"), /^text\/plain/);
    assert.doesNotMatch(await response.text(), /<html>/);
  }
});

test("service worker navigation fallback is limited to known public documents", async () => {
  const worker = workerHarness();
  const response = await worker.fetch("merch.html?offline=1", "navigate");
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.match(await response.text(), /cached shell/);
  for (const path of ["/other-app/index.html", "unknown.html", "private-export.json", "private-export.pdf"]) {
    assert.equal(worker.fetch(path, "navigate"), undefined, `Unknown route intercepted: ${path}`);
  }
});

test("service worker activation preserves other applications' caches", async () => {
  const worker = workerHarness();
  let activation;
  worker.handlers.get("activate")({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.ok(worker.deleted.includes("bkota-shell-v1"));
  assert.ok(worker.deleted.every((key) => key.startsWith("bkota-shell-")));
  assert.ok(!worker.deleted.includes("unrelated-app-v3"));
});

test("service worker caches successful public assets but not query-bearing variants", async () => {
  const worker = workerHarness({ online: true });
  assert.equal((await worker.fetch("assets/bkota-mark.svg")).status, 200);
  await Promise.all(worker.waits);
  assert.equal(worker.cachedWrites.length, 1);
  assert.equal((await worker.fetch("assets/bkota-mark.svg?private=123")).status, 200);
  await Promise.all(worker.waits);
  assert.equal(worker.cachedWrites.length, 1);
});

test("motion preference and readable scripture remain part of the public page", () => {
  assert.match(read("styles.css"), /prefers-reduced-motion\s*:\s*reduce/);
  assert.match(read("index.html"), /id=["']motionToggle["']/);
  assert.match(read("index.html"), /Ephesians 4:32/);
  assert.match(read("index.html"), /King James Version|\bKJV\b/);
});

const reportUuid = "11111111-2222-4333-8444-555555555555";
async function privacyHarness({ config, search = `?kind=story&id=${reportUuid}`, health = {}, receipt = {}, contentType = "application/json" } = {}) {
  const elements = new Map();
  const requests = [];
  const listeners = new Map();
  const getElement = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      value: "", checked: false, disabled: true, textContent: "",
      addEventListener: (type, handler) => listeners.set(`${selector}:${type}`, handler), reset() {},
    });
    return elements.get(selector);
  };
  getElement("#reportDetails").value = "Please review my consent.";
  getElement("#reportConsent").checked = true;
  getElement("#reportRequestType").value = "privacy";
  getElement("#reporterRole").value = "featured-person";
  const sandbox = {
    URLSearchParams, AbortSignal,
    document: { querySelector: getElement }, location: { search },
    fetch: async (url, options = {}) => {
      requests.push({ url, options });
      const payload = url.endsWith("/health") ? health : receipt;
      return { ok: true, headers: { get: () => contentType }, json: async () => payload };
    },
  };
  if (config !== undefined) sandbox.BKOTA_CONFIG = config;
  vm.runInNewContext(read("privacy.js"), sandbox);
  await new Promise(setImmediate);
  return { elements, requests, submit: () => listeners.get("#reportForm:submit")({ preventDefault() {} }) };
}

test("privacy reports stay disabled and make no network calls without explicit frozen enabled configuration", async () => {
  for (const config of [undefined, {}, Object.freeze({}), Object.freeze({ moderatedServiceEnabled: false }),
    Object.freeze({ moderatedServiceEnabled: "true" }), { moderatedServiceEnabled: true }]) {
    const run = await privacyHarness({ config });
    assert.equal(run.elements.get("#reportFields").disabled, true);
    assert.equal(run.elements.get("#reportSubmit").disabled, true);
    run.elements.get("#reportSubmit").disabled = false;
    await run.submit();
    assert.equal(run.requests.length, 0, "A valid-looking report URL must not enable a disconnected service");
  }
});

test("privacy reporting requires a valid target and an explicit JSON report capability response", async () => {
  const config = Object.freeze({ moderatedServiceEnabled: true });
  for (const search of ["", `?kind=other&id=${reportUuid}`, `?kind=story&id=${"-".repeat(36)}`]) {
    const run = await privacyHarness({ config, search });
    assert.equal(run.requests.length, 0);
    assert.equal(run.elements.get("#reportSubmit").disabled, true);
  }
  for (const [health, contentType] of [
    [{}, "application/json"], [{ publicSubmissionsEnabled: true }, "application/json"],
    [{ publicSubmissionsEnabled: true, privacyReportsEnabled: "true" }, "application/json"],
    [{ publicSubmissionsEnabled: true, privacyReportsEnabled: true }, "text/html"],
  ]) {
    const run = await privacyHarness({ config, health, contentType });
    await run.submit();
    assert.equal(run.requests.length, 1);
    assert.equal(run.requests[0].url, "/api/health");
    assert.equal(run.elements.get("#reportSubmit").disabled, true);
  }
});

test("privacy success requires an explicit receipt and does not claim automatic removal", async () => {
  const run = await privacyHarness({ config: Object.freeze({ moderatedServiceEnabled: true }),
    health: { publicSubmissionsEnabled: false, privacyReportsEnabled: true },
    receipt: { accepted: true, reportId: reportUuid } });
  assert.equal(run.elements.get("#reportSubmit").disabled, false);
  await Promise.all([run.submit(), run.submit()]);
  assert.equal(run.requests.filter((request) => request.options.method === "POST").length, 1);
  const request = run.requests.find((request) => request.options.method === "POST");
  assert.equal(JSON.parse(request.options.body).targetId, reportUuid);
  assert.equal(request.options.cache, "no-store");
  assert.equal(run.elements.get("#reportFields").disabled, true);
  assert.match(run.elements.get("#reportStatus").textContent, /confirms receipt, not removal/);
});

test("privacy empty or malformed response never invents a successful report receipt", async () => {
  for (const receipt of [{}, { accepted: true }, { accepted: true, reportId: "not-a-reference" }]) {
    const run = await privacyHarness({ config: Object.freeze({ moderatedServiceEnabled: true }),
      health: { publicSubmissionsEnabled: true, privacyReportsEnabled: true }, receipt });
    await run.submit();
    assert.match(run.elements.get("#reportStatus").textContent, /Receipt could not be confirmed/);
    assert.doesNotMatch(run.elements.get("#reportStatus").textContent, /Report received/);
  }
});
