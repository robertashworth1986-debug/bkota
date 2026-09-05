import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import "../community.js";
import "../social-video.js";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const receiptId = "00000000-0000-4000-8000-000000000001";
const acceptedReceipt = (kind) => ({ accepted: true, kind, id: receiptId, status: "pending" });
const jsonResponse = (payload, options = {}) => new Response(JSON.stringify(payload), {
  status: 200, headers: { "content-type": "application/json; charset=utf-8" }, ...options,
});

// Deterministic DOM facade; no browser, real endpoint, or personal data is used.
class Node {
  constructor() {
    this.children = []; this.listeners = {}; this.value = ""; this.textContent = "";
    this.checked = false; this.disabled = false; this.resetCount = 0; this.dataset = {};
    this.classList = { toggle() {}, contains: () => false };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelector(selector) { return selector === '[type="submit"]' ? this.submit : null; }
  reset() { this.resetCount += 1; }
  focus() {}
}

async function page({ postResponse, connected = true } = {}) {
  const ids = ["feed", "bkotaForm", "formStatus", "messageText", "storyConsent", "continent", "name", "city", "anon", "storyWebsite", "seedDemo", "clearFeed", "videoWall", "videoStatus", "videoForm", "videoUrl", "videoCaption", "videoConsent", "videoWebsite", "videoSubmit", "seedVideos", "clearVideos", "downloadCollection", "collectionStatus", "venmoButton", "connectionMode", "connectionNote", "globalDeedCount", "continentCount", "shareMovement", "shareStatus", "copyChallenge"];
  const nodes = Object.fromEntries(ids.map((id) => [id, new Node()]));
  nodes.bkotaForm.submit = new Node();
  nodes.messageText.value = "I helped a neighbor.";
  nodes.storyConsent.checked = true;
  nodes.continent.value = "North America";
  nodes.videoUrl.value = "https://www.youtube.com/watch?v=abcdefghijk";
  nodes.videoCaption.value = "A helping hand";
  nodes.videoConsent.checked = true;
  const requests = [];
  const values = new Map();
  const context = {
    BKOTA_COMMUNITY: globalThis.BKOTA_COMMUNITY,
    BKOTA_SOCIAL_VIDEO: globalThis.BKOTA_SOCIAL_VIDEO,
    BKOTA_CONFIG: Object.freeze({ moderatedServiceEnabled: connected }),
    document: {
      documentElement: new Node(), body: new Node(), visibilityState: "visible",
      querySelector: (selector) => nodes[selector.slice(1)] || null,
      querySelectorAll: () => [], createElement: () => new Node(), createTextNode: (text) => text,
      addEventListener() {},
    },
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
    navigator: {}, location: { hash: "", href: "https://example.test/", pathname: "/", search: "" },
    crypto: { randomUUID: () => receiptId }, URL, URLSearchParams, Blob, AbortSignal, console,
    fetch: async (path, options = {}) => {
      requests.push({ path, options });
      if (options.method === "POST") return postResponse(path, options);
      if (path === "/api/health") return jsonResponse({ publicSubmissionsEnabled: true });
      return jsonResponse(path === "/api/stats" ? {} : { items: [] });
    },
  };
  vm.runInNewContext(appSource, context);
  await new Promise(setImmediate);
  return { nodes, requests, values, submit: (form) => nodes[form].listeners.submit({ preventDefault() {} }) };
}

const scenarios = [
  { kind: "story", form: "bkotaForm", status: "formStatus", input: "messageText", original: "I helped a neighbor.", path: "/api/stories" },
  { kind: "video", form: "videoForm", status: "videoStatus", input: "videoCaption", original: "A helping hand", path: "/api/videos" },
];

for (const scenario of scenarios) {
  test(`${scenario.kind}: a valid explicit pending receipt confirms acceptance, not publication`, async () => {
    const view = await page({ postResponse: () => jsonResponse(acceptedReceipt(scenario.kind), { status: 202 }) });
    await view.submit(scenario.form);
    assert.equal(view.nodes[scenario.form].resetCount, 1);
    assert.match(view.nodes[scenario.status].textContent, /accepted into the moderation queue/);
    assert.match(view.nodes[scenario.status].textContent, /not been approved or published/);
    assert.ok(view.nodes[scenario.status].textContent.includes(receiptId));
    assert.equal(view.requests.at(-1).path, scenario.path);
    assert.equal(view.requests.at(-1).options.cache, "no-store");
    assert.equal(view.values.size, 0, "An accepted online submission must not become a private or public feed entry");
  });

  test(`${scenario.kind}: HTML, missing content type, malformed JSON, redirects, and HTTP errors preserve the form`, async () => {
    const factories = [
      () => new Response("<html>not a receipt</html>", { headers: { "content-type": "text/html" } }),
      () => new Response(JSON.stringify(acceptedReceipt(scenario.kind))),
      () => new Response("broken JSON", { headers: { "content-type": "application/json" } }),
      () => new Response(null, { status: 204, headers: { "content-type": "application/json" } }),
      () => jsonResponse(acceptedReceipt(scenario.kind), { status: 500 }),
      () => ({ ok: true, redirected: true, headers: new Headers({ "content-type": "application/json" }), json: async () => acceptedReceipt(scenario.kind) }),
      () => { throw new Error("Connection lost after dispatch"); },
    ];
    for (const postResponse of factories) {
      const view = await page({ postResponse });
      await view.submit(scenario.form);
      assert.equal(view.nodes[scenario.form].resetCount, 0);
      assert.equal(view.nodes[scenario.input].value, scenario.original);
      assert.match(view.nodes[scenario.status].textContent, /receipt could not be confirmed/);
      assert.match(view.nodes[scenario.status].textContent, /Do not immediately resubmit/);
      assert.doesNotMatch(view.nodes[scenario.status].textContent, /was not sent|accepted into|has been published/);
      assert.equal(view.values.size, 0);
      await new Promise(setImmediate);
      assert.equal(view.requests.filter(({ options }) => options.method === "POST").length, 1, "Never retry automatically");
    }
  });

  test(`${scenario.kind}: missing, ambiguous, wrong-kind, and non-pending receipts are rejected`, async () => {
    const accepted = acceptedReceipt(scenario.kind);
    for (const payload of [
      {}, { items: [] }, null, [], "accepted", { ...accepted, accepted: "true" },
      { ...accepted, accepted: false }, { ...accepted, kind: scenario.kind === "story" ? "video" : "story" },
      { ...accepted, kind: undefined }, { ...accepted, id: undefined }, { ...accepted, id: "-".repeat(36) },
      { ...accepted, status: undefined }, { ...accepted, status: "approved" }, { ...accepted, status: "published" },
    ]) {
      const view = await page({ postResponse: () => jsonResponse(payload) });
      await view.submit(scenario.form);
      assert.equal(view.nodes[scenario.form].resetCount, 0);
      assert.match(view.nodes[scenario.status].textContent, /receipt could not be confirmed/);
      assert.equal(view.values.size, 0);
    }
  });

  test(`${scenario.kind}: a second click while awaiting a receipt cannot create a second POST`, async () => {
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    const view = await page({ postResponse: () => pending });
    const first = view.submit(scenario.form);
    await view.submit(scenario.form);
    assert.equal(view.requests.filter(({ options }) => options.method === "POST").length, 1);
    assert.equal(view.nodes[scenario.form].resetCount, 0);
    finish(jsonResponse(acceptedReceipt(scenario.kind)));
    await first;
    assert.equal(view.nodes[scenario.form].resetCount, 1);
  });
}

test("receipt checks do not activate the disabled service or change private-only saves", async () => {
  const view = await page({ connected: false, postResponse: () => { throw new Error("Unexpected network request"); } });
  for (const scenario of scenarios) await view.submit(scenario.form);
  assert.equal(view.requests.length, 0);
  assert.equal(view.values.size, 2);
  assert.match(view.nodes.formStatus.textContent, /not submitted or published/);
  assert.match(view.nodes.videoStatus.textContent, /not submitted or published/);
});
