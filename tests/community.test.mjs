import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import "../community.js";
import "../social-video.js";

const { STORY_KEY, VIDEO_KEY, readCollection, appendCollection, clearCollection, exportCollection } = globalThis.BKOTA_COMMUNITY;

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    writes: 0,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { this.writes += 1; values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("private storage reads and appends without mutating older entries", () => {
  const local = storage();
  assert.deepEqual(readCollection(() => local, STORY_KEY), { ok: true, items: [] });
  assert.equal(appendCollection(() => local, STORY_KEY, { message: "A meal shared" }, 50).ok, true);
  assert.equal(appendCollection(() => local, STORY_KEY, { message: "A patient conversation" }, 50).ok, true);
  assert.deepEqual(readCollection(() => local, STORY_KEY).items, [{ message: "A meal shared" }, { message: "A patient conversation" }]);
});

test("unavailable localStorage getter and reader fail without a pretend empty success", () => {
  const unavailable = () => { throw new Error("SecurityError"); };
  assert.equal(readCollection(unavailable, STORY_KEY).code, "storage_unavailable");
  assert.equal(appendCollection(unavailable, STORY_KEY, { message: "Keep me" }, 50).ok, false);
  assert.equal(readCollection(() => ({ getItem() { throw new Error("Blocked"); } }), STORY_KEY).ok, false);
});

test("corrupt, null, primitive, and malformed collections cannot be overwritten", () => {
  for (const raw of ["not json", "null", "{}", '[null]', '["story"]', "[[]]"]) {
    const local = storage({ [STORY_KEY]: raw });
    assert.equal(readCollection(() => local, STORY_KEY).code, "invalid_collection");
    assert.equal(appendCollection(() => local, STORY_KEY, { message: "Keep me" }, 50).ok, false);
    assert.equal(local.getItem(STORY_KEY), raw);
    assert.equal(local.writes, 0);
  }
});

test("quota failure does not replace existing private entries", () => {
  const original = JSON.stringify([{ message: "Existing story" }]);
  const local = storage({ [STORY_KEY]: original });
  local.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(appendCollection(() => local, STORY_KEY, { message: "Unsaved story" }, 50).code, "storage_write_failed");
  assert.equal(local.getItem(STORY_KEY), original);
});

test("capacity is explicit and never silently drops the oldest story", () => {
  const local = storage({ [STORY_KEY]: '[{"message":"First"},{"message":"Second"}]' });
  const before = local.getItem(STORY_KEY);
  assert.equal(appendCollection(() => local, STORY_KEY, { message: "Third" }, 2).code, "collection_full");
  assert.equal(local.getItem(STORY_KEY), before);
  assert.equal(local.writes, 0);
});

test("invalid entries and limits never write", () => {
  const local = storage();
  for (const item of [null, "story", []]) assert.equal(appendCollection(() => local, STORY_KEY, item, 50).ok, false);
  for (const limit of [0, -1, 1.2, "50"]) assert.equal(appendCollection(() => local, STORY_KEY, {}, limit).ok, false);
  const circular = {};
  circular.self = circular;
  assert.equal(appendCollection(() => local, STORY_KEY, circular, 50).code, "invalid_entry");
  assert.equal(local.writes, 0);
});

test("clear reports storage errors and only deletes its selected collection", () => {
  const local = storage({ [STORY_KEY]: "[]", [VIDEO_KEY]: "[]" });
  assert.equal(clearCollection(() => local, STORY_KEY).ok, true);
  assert.equal(local.values.has(STORY_KEY), false);
  assert.equal(local.values.has(VIDEO_KEY), true);
  local.removeItem = () => { throw new Error("Blocked"); };
  assert.equal(clearCollection(() => local, VIDEO_KEY).ok, false);
  assert.equal(local.values.has(VIDEO_KEY), true);
});

test("backup is private, excludes examples and internal fields, and contains links not video files", () => {
  const local = storage({
    [STORY_KEY]: JSON.stringify([
      { id: "local-id", message: "Someone listened", name: "Name", city: "City", anonymous: true, continent: "Europe", website: "trap", attributionCode: "not-exported", consent: true, localOnly: true },
      { example: true, message: "Example only" }
    ]),
    [VIDEO_KEY]: JSON.stringify([
      { url: "https://www.youtube.com/watch?v=abcdefghijk", caption: "Helping", website: "trap", attributionCode: "not-exported" },
      { example: true, caption: "Example only" }
    ])
  });
  const result = exportCollection(() => local, "2026-09-05T12:00:00.000Z");
  assert.equal(result.ok, true);
  assert.equal(result.data.publicationStatus, "not-established-by-this-backup");
  assert.deepEqual(result.data.stories, [{ id: "local-id", message: "Someone listened", name: "", city: "", continent: "Europe", anonymous: true, submissionStatus: "not-submitted" }]);
  assert.deepEqual(result.data.videoLinks, [{ url: "https://www.youtube.com/watch?v=abcdefghijk", caption: "Helping", submissionStatus: "unknown-legacy-record" }]);
  assert.match(result.data.notice, /video files are not downloaded/);
  assert.equal(local.writes, 0);
});

test("backup fails rather than quietly exporting a partial or unreadable collection", () => {
  const local = storage({ [STORY_KEY]: "[]", [VIDEO_KEY]: "broken" });
  assert.deepEqual(exportCollection(() => local, "2026-09-05T12:00:00Z"), { ok: false, code: "invalid_collection", items: [], collection: "video links" });
  assert.equal(exportCollection(() => storage(), "not a date").ok, false);
});

// Small deterministic DOM facade: integration coverage without a framework or network.
class Node {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.listeners = {};
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.dataset = {};
    this.resetCount = 0;
    this.classList = { toggle() {}, contains() { return false; } };
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelector(selector) { return selector === '[type="submit"]' ? this.submit : null; }
  reset() { this.resetCount += 1; }
  focus() {}
  click() { this.clicked = true; }
  remove() {}
}

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const collectText = (node) => [node.textContent, ...node.children.map((child) => typeof child === "string" ? child : collectText(child))].join(" ");

async function page({ local = storage(), connected = false, responses = {}, storageGetterFails = false } = {}) {
  const ids = ["feed", "bkotaForm", "formStatus", "messageText", "storyConsent", "continent", "name", "city", "anon", "storyWebsite", "seedDemo", "clearFeed", "videoWall", "videoStatus", "videoForm", "videoUrl", "videoCaption", "videoConsent", "videoWebsite", "videoSubmit", "seedVideos", "clearVideos", "downloadCollection", "collectionStatus", "venmoButton", "connectionMode", "connectionNote", "globalDeedCount", "approvedVideoCount", "continentCount", "shareMovement", "shareStatus", "copyChallenge"];
  const nodes = Object.fromEntries(ids.map((id) => [id, new Node()]));
  nodes.bkotaForm.submit = new Node("button");
  nodes.messageText.value = "I helped my neighbor carry groceries.";
  nodes.storyConsent.checked = true;
  nodes.continent.value = "North America";
  nodes.videoUrl.value = "https://www.youtube.com/watch?v=abcdefghijk";
  nodes.videoCaption.value = "A helping hand";
  nodes.videoConsent.checked = true;
  const requests = [];
  const downloads = [];
  class DownloadURL extends URL {
    static createObjectURL(blob) { downloads.push(blob); return "blob:https://example.test/private-collection"; }
    static revokeObjectURL() {}
  }
  const document = {
    documentElement: new Node("html"),
    body: new Node("body"),
    querySelector: (selector) => nodes[selector.slice(1)] || null,
    querySelectorAll: () => [],
    createElement: (tag) => new Node(tag),
    createTextNode: (text) => text,
    addEventListener() {},
    visibilityState: "visible"
  };
  const context = {
    BKOTA_COMMUNITY: globalThis.BKOTA_COMMUNITY,
    BKOTA_SOCIAL_VIDEO: globalThis.BKOTA_SOCIAL_VIDEO,
    BKOTA_CONFIG: Object.freeze({ moderatedServiceEnabled: connected }),
    document,
    navigator: {},
    location: { hash: "", href: "https://example.test/", pathname: "/", search: "" },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    URL: DownloadURL,
    URLSearchParams,
    Blob,
    setTimeout(callback) { callback(); },
    AbortSignal,
    console,
    confirm: () => true,
    fetch: async (path, options) => {
      requests.push({ path, options });
      const body = responses[`${options?.method || "GET"} ${path}`] ?? responses[path];
      if (body instanceof Error) throw body;
      return { ok: true, redirected: false, headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json" : null }, json: async () => body ?? {} };
    }
  };
  Object.defineProperty(context, "localStorage", { get() { if (storageGetterFails) throw new Error("Blocked"); return local; } });
  vm.runInNewContext(appSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  return { nodes, local, requests, downloads, submit: (id) => nodes[id].listeners.submit({ preventDefault() {} }) };
}

test("offline story save is honestly private and does not contact any service", async () => {
  const view = await page();
  await view.submit("bkotaForm");
  assert.equal(view.nodes.bkotaForm.resetCount, 1);
  assert.equal(readCollection(() => view.local, STORY_KEY).items.length, 1);
  assert.match(view.nodes.formStatus.textContent, /not submitted or published/);
  assert.match(collectText(view.nodes.feed), /Private on this browser/);
  assert.equal(view.requests.length, 0);
});

test("story and video forms stay intact when storage fails", async () => {
  const local = storage();
  local.setItem = () => { throw new Error("QuotaExceededError"); };
  const view = await page({ local });
  await view.submit("bkotaForm");
  await view.submit("videoForm");
  assert.equal(view.nodes.bkotaForm.resetCount, 0);
  assert.equal(view.nodes.videoForm.resetCount, 0);
  assert.equal(view.nodes.messageText.value, "I helped my neighbor carry groceries.");
  assert.match(view.nodes.formStatus.textContent, /has not been cleared/);
  assert.match(view.nodes.videoStatus.textContent, /has not been cleared/);
  assert.equal(view.local.values.size, 0);
});

test("blocked storage does not crash startup and the form explains save failure", async () => {
  const view = await page({ storageGetterFails: true });
  assert.match(collectText(view.nodes.feed), /Storage may be blocked or full/);
  await view.submit("bkotaForm");
  assert.equal(view.nodes.bkotaForm.resetCount, 0);
  assert.match(view.nodes.formStatus.textContent, /has not been cleared/);
});

test("showing examples never replaces visitor stories or creates pretend submissions", async () => {
  const original = JSON.stringify([{ message: "A real saved memory" }]);
  const local = storage({ [STORY_KEY]: original });
  const view = await page({ local });
  view.nodes.seedDemo.listeners.click();
  view.nodes.seedVideos.listeners.click();
  assert.equal(local.getItem(STORY_KEY), original);
  assert.equal(local.getItem(VIDEO_KEY), null);
  assert.match(collectText(view.nodes.feed), /A real saved memory/);
  assert.match(collectText(view.nodes.feed), /Illustrative example · not a real submission/);
  assert.equal(local.writes, 0);
});

test("connected approved feeds never overwrite or relabel the private collection", async () => {
  const original = JSON.stringify([{ message: "Private memory", localOnly: true }, { message: "Legacy memory" }]);
  const local = storage({ [STORY_KEY]: original });
  const view = await page({ local, connected: true, responses: {
    "/api/health": { publicSubmissionsEnabled: true },
    "/api/stories": { items: [{ message: "Approved shared story" }] },
    "/api/videos": { items: [] },
    "/api/stats": { approvedDeeds: 8, approvedVideos: 3, continentsReached: 2 }
  } });
  assert.equal(local.getItem(STORY_KEY), original);
  assert.equal(local.getItem(VIDEO_KEY), null);
  assert.equal(local.writes, 0);
  assert.match(collectText(view.nodes.feed), /Approved community story/);
  assert.match(collectText(view.nodes.feed), /Private on this browser · not submitted/);
  assert.match(collectText(view.nodes.feed), /Older browser copy · submission history unknown/);
  assert.match(collectText(view.nodes.feed), /Private memory/);
  assert.equal(view.nodes.globalDeedCount.textContent, "8");
  assert.equal(view.nodes.approvedVideoCount.textContent, "3");
  assert.equal(exportCollection(() => local, "2026-09-05T12:00:00Z").data.stories.length, 2);
});

test("public counters reject coercible non-number values", async () => {
  const view = await page({ connected: true, responses: {
    "/api/health": { publicSubmissionsEnabled: true },
    "/api/stories": { items: [] },
    "/api/videos": { items: [] },
    "/api/stats": { approvedDeeds: "8", approvedVideos: true, continentsReached: [], byContinent: { Africa: "2" } }
  } });
  assert.equal(view.nodes.globalDeedCount.textContent, "0");
  assert.equal(view.nodes.approvedVideoCount.textContent, "0");
  assert.equal(view.nodes.continentCount.textContent, "0");
});

test("confirmed online submission enters review without being added to the local or public feed", async () => {
  const view = await page({ connected: true, responses: {
    "/api/health": { publicSubmissionsEnabled: true },
    "/api/stories": { items: [] },
    "POST /api/stories": { accepted: true, kind: "story", id: "00000000-0000-4000-8000-000000000001", status: "pending" },
    "/api/videos": { items: [] },
    "/api/stats": {}
  } });
  await view.submit("bkotaForm");
  assert.match(view.nodes.formStatus.textContent, /moderation queue/);
  assert.equal(view.nodes.bkotaForm.resetCount, 1);
  assert.equal(view.local.getItem(STORY_KEY), null);
  assert.equal(view.requests.at(-1).options.method, "POST");
  assert.doesNotMatch(collectText(view.nodes.feed), /I helped my neighbor carry groceries/);
});

test("unconfirmed online delivery preserves forms and does not pretend nothing was sent", async () => {
  const responses = {
    "/api/health": { publicSubmissionsEnabled: true },
    "/api/stories": { items: [] },
    "/api/videos": { items: [] },
    "/api/stats": {}
  };
  const view = await page({ connected: true, responses });
  responses["/api/stories"] = new Error("Network connection lost");
  responses["/api/videos"] = new Error("Network connection lost");
  await view.submit("bkotaForm");
  await view.submit("videoForm");
  for (const id of ["formStatus", "videoStatus"]) {
    assert.match(view.nodes[id].textContent, /receipt could not be confirmed/);
    assert.match(view.nodes[id].textContent, /Do not immediately resubmit/);
    assert.doesNotMatch(view.nodes[id].textContent, /was not sent/);
  }
  assert.equal(view.nodes.bkotaForm.resetCount, 0);
  assert.equal(view.nodes.videoForm.resetCount, 0);
  assert.equal(view.nodes.bkotaForm.submit.disabled, false);
  assert.equal(view.nodes.videoSubmit.disabled, false);
  assert.equal(view.local.values.size, 0);
});

test("consent is required for local stories and links, not only for future public submissions", async () => {
  const view = await page();
  view.nodes.storyConsent.checked = false;
  view.nodes.videoConsent.checked = false;
  await view.submit("bkotaForm");
  await view.submit("videoForm");
  assert.equal(view.local.values.size, 0);
  assert.equal(view.nodes.bkotaForm.resetCount, 0);
  assert.equal(view.nodes.videoForm.resetCount, 0);
  assert.match(view.nodes.videoStatus.textContent, /permission to film and share/);
});

test("download creates the requested private JSON without a network request or data mutation", async () => {
  const local = storage({ [STORY_KEY]: JSON.stringify([{ message: "My story", localOnly: true }]) });
  const view = await page({ local });
  view.nodes.downloadCollection.listeners.click();
  assert.equal(view.downloads.length, 1);
  const backup = JSON.parse(await view.downloads[0].text());
  assert.equal(backup.stories[0].message, "My story");
  assert.equal(backup.stories[0].submissionStatus, "not-submitted");
  assert.match(view.nodes.collectionStatus.textContent, /Download requested/);
  assert.match(view.nodes.collectionStatus.textContent, /Video files are not included/);
  assert.equal(view.requests.length, 0);
  assert.equal(local.writes, 0);
});

test("download does not hide corrupt video data by exporting stories only", async () => {
  const local = storage({ [STORY_KEY]: "[]", [VIDEO_KEY]: "bad-json" });
  const view = await page({ local });
  view.nodes.downloadCollection.listeners.click();
  assert.equal(view.downloads.length, 0);
  assert.match(view.nodes.collectionStatus.textContent, /No download was created/);
  assert.equal(local.getItem(VIDEO_KEY), "bad-json");
});

test("anonymous legacy records never display an accidentally retained name or city", async () => {
  const local = storage({ [STORY_KEY]: JSON.stringify([{ message: "Kindness", anonymous: true, name: "Private Person", city: "Secret City", continent: "Europe" }]) });
  const view = await page({ local });
  assert.match(collectText(view.nodes.feed), /Anonymous/);
  assert.doesNotMatch(collectText(view.nodes.feed), /Private Person|Secret City/);
});
