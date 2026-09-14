import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import "../community.js";
import "../social-video.js";

const { STORY_KEY, VIDEO_KEY, readCollection, appendCollection, clearCollection, exportCollection } = globalThis.BKOTA_COMMUNITY;
const READY_HEALTH = Object.freeze({
  ok: true,
  service: "bkota",
  contractVersion: 1,
  publicFeedEnabled: true,
  publicSubmissionsEnabled: true,
  moderationQueueEnabled: true,
  privacyReportsEnabled: true,
  removalRequestsEnabled: true,
  supportProfileEnabled: false,
  anonymousImpactEnabled: false
});
const APPROVED_STORY = Object.freeze({
  id: "00000000-0000-4000-8000-000000000011",
  kind: "story",
  status: "approved",
  anonymous: false,
  name: "A friend",
  city: "Nashville",
  continent: "North America",
  message: "Approved shared story",
  publishedAt: "2026-09-05T12:00:00.000Z"
});
const APPROVED_VIDEO = Object.freeze({
  id: "00000000-0000-4000-8000-000000000012",
  kind: "video",
  status: "approved",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  provider: "youtube",
  platform: "YouTube",
  caption: "A helping hand",
  publishedAt: "2026-09-05T12:01:00.000Z"
});

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    writes: 0,
    readKeys: [],
    writeKeys: [],
    removeKeys: [],
    getItem(key) { this.readKeys.push(key); return values.get(key) ?? null; },
    setItem(key, value) { this.writes += 1; this.writeKeys.push(key); values.set(key, String(value)); },
    removeItem(key) { this.removeKeys.push(key); values.delete(key); }
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
      { id: "local-id", message: "Someone listened", name: "Name", city: "City", anonymous: true, continent: "Europe", website: "trap", attributionCode: "Campaign_Code_12345678", consent: true, localOnly: true },
      { example: true, message: "Example only" }
    ]),
    [VIDEO_KEY]: JSON.stringify([
      { url: "https://www.youtube.com/watch?v=abcdefghijk", caption: "Helping", website: "trap", attributionCode: "Campaign_Code_12345678" },
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

async function page({ local = storage(), connected = false, responses = {}, storageGetterFails = false, navigatorOverrides = {}, href = "", configOverrides = {} } = {}) {
  href ||= connected ? "https://bkota.co/" : "https://example.test/";
  const ids = ["feed", "bkotaForm", "formStatus", "messageText", "storyConsent", "continent", "name", "city", "anon", "storyWebsite", "seedDemo", "clearFeed", "videoWall", "videoStatus", "videoForm", "videoUrl", "videoCaption", "videoConsent", "videoOwnership", "videoSafety", "videoWebsite", "videoSubmit", "seedVideos", "clearVideos", "downloadCollection", "collectionStatus", "venmoButton", "connectionMode", "connectionNote", "globalDeedCount", "approvedVideoCount", "continentCount", "approvedStoryStat", "approvedVideoStat", "continentStat", "shareMovement", "shareStatus", "copyChallenge"];
  const nodes = Object.fromEntries(ids.map((id) => [id, new Node()]));
  nodes.bkotaForm.submit = new Node("button");
  nodes.messageText.value = "I helped my neighbor carry groceries.";
  nodes.storyConsent.checked = true;
  nodes.continent.value = "North America";
  nodes.videoUrl.value = "https://www.youtube.com/watch?v=abcdefghijk";
  nodes.videoCaption.value = "A helping hand";
  nodes.videoConsent.checked = true;
  nodes.videoOwnership.checked = true;
  nodes.videoSafety.checked = true;
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
    BKOTA_CONFIG: Object.freeze({ ...configOverrides, moderatedServiceEnabled: connected }),
    document,
    navigator: navigatorOverrides,
    location: { hash: new URL(href).hash, href, pathname: new URL(href).pathname, search: new URL(href).search },
    history: { state: null, replaceState() {} },
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
    "/api/health": READY_HEALTH,
    "/api/stories": { items: [APPROVED_STORY] },
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
  assert.equal(view.nodes.approvedStoryStat.hidden, false);
  assert.equal(view.nodes.approvedVideoStat.hidden, false);
  assert.equal(view.nodes.continentStat.hidden, false);
  assert.equal(exportCollection(() => local, "2026-09-05T12:00:00Z").data.stories.length, 2);
});

test("moderated mode never contacts an API outside the exact credential-free production origin", async () => {
  for (const href of [
    "https://robertashworth1986-debug.github.io/bkota/",
    "http://bkota.co/",
    "https://www.bkota.co/",
    "https://user@bkota.co/",
    "https://bkota.co:8443/"
  ]) {
    const view = await page({ connected: true, href, responses: { "/api/health": READY_HEALTH } });
    assert.equal(view.requests.length, 0, href);
    assert.match(view.nodes.connectionMode.textContent, /Private collection|Temporary tab collection/);
    assert.equal(view.nodes.bkotaForm.submit.textContent.includes("Submit"), false);
  }
});

test("every public service identity and safety capability is required before activation", async () => {
  const required = ["ok", "service", "contractVersion", "publicFeedEnabled", "publicSubmissionsEnabled", "moderationQueueEnabled", "privacyReportsEnabled", "removalRequestsEnabled", "supportProfileEnabled"];
  const invalidHealth = required.map((key) => {
    const health = { ...READY_HEALTH };
    delete health[key];
    return health;
  });
  invalidHealth.push(
    { ...READY_HEALTH, service: "another-service" },
    { ...READY_HEALTH, contractVersion: "1" },
    { ...READY_HEALTH, moderationQueueEnabled: false },
    { ...READY_HEALTH, anonymousImpactEnabled: "false" },
    { ...READY_HEALTH, unexpectedCapability: true }
  );
  for (const health of invalidHealth) {
    const view = await page({ connected: true, responses: { "/api/health": health } });
    assert.equal(view.requests.length, 1);
    assert.equal(view.requests[0].path, "/api/health");
    assert.match(view.nodes.connectionMode.textContent, /Private collection/);
  }
});

test("public feeds accept only exact approved records and fail the whole mode closed on drift", async () => {
  const invalidCases = [
    { stories: { items: [{ ...APPROVED_STORY, status: "pending" }] }, videos: { items: [] } },
    { stories: { items: [{ ...APPROVED_STORY, privateNote: "must never render" }] }, videos: { items: [] } },
    { stories: { items: [{ ...APPROVED_STORY, anonymous: true, name: "Retained", city: "Private" }] }, videos: { items: [] } },
    { stories: { items: [{ ...APPROVED_STORY, message: `safe\u202Ehidden` }] }, videos: { items: [] } },
    { stories: { items: [] }, videos: { items: [{ ...APPROVED_VIDEO, url: "https://youtu.be/abcdefghijk" }] } },
    { stories: { items: Array.from({ length: 101 }, () => APPROVED_STORY) }, videos: { items: [] } },
    { stories: { items: [] }, videos: { items: [], extra: true } }
  ];
  for (const candidate of invalidCases) {
    const view = await page({ connected: true, responses: {
      "/api/health": READY_HEALTH,
      "/api/stories": candidate.stories,
      "/api/videos": candidate.videos,
      "/api/stats": { approvedDeeds: 1, approvedVideos: 1, continentsReached: 1 }
    } });
    assert.match(view.nodes.connectionMode.textContent, /Private collection/);
    assert.doesNotMatch(collectText(view.nodes.feed), /Approved community story|must never render|Retained|Private/);
    assert.equal(view.nodes.approvedStoryStat.hidden, true);
  }

  const valid = await page({ connected: true, responses: {
    "/api/health": READY_HEALTH,
    "/api/stories": { items: [APPROVED_STORY] },
    "/api/videos": { items: [APPROVED_VIDEO] },
    "/api/stats": { approvedDeeds: 1, approvedVideos: 1, continentsReached: 1 }
  } });
  assert.match(valid.nodes.connectionMode.textContent, /Moderated platform connected/);
  assert.match(collectText(valid.nodes.feed), /Approved community story/);
  assert.match(collectText(valid.nodes.videoWall), /approved community link/);
});

test("shared GitHub Pages preview keeps personal entries tab-only and never reads its origin-wide collection", async () => {
  const legacyStory = JSON.stringify([{ message: "An older private preview" }]);
  const legacyVideo = JSON.stringify([{ url: "https://youtu.be/abcdefghijk", caption: "Older link" }]);
  const local = storage({ [STORY_KEY]: legacyStory, [VIDEO_KEY]: legacyVideo });
  const view = await page({ local, href: "https://robertashworth1986-debug.github.io/bkota/" });
  assert.equal(local.readKeys.includes(STORY_KEY), false);
  assert.equal(local.readKeys.includes(VIDEO_KEY), false);
  assert.equal(view.nodes.bkotaForm.submit.textContent, "Keep in this tab only");
  assert.equal(view.nodes.videoSubmit.textContent, "Keep link in this tab only");
  assert.match(view.nodes.connectionMode.textContent, /Temporary tab collection/i);

  await view.submit("bkotaForm");
  assert.equal(view.nodes.bkotaForm.resetCount, 1);
  assert.equal(local.values.get(STORY_KEY), legacyStory);
  assert.equal(local.values.get(VIDEO_KEY), legacyVideo);
  assert.equal(local.writes, 0);
  assert.match(view.nodes.formStatus.textContent, /temporarily in this open tab/i);
  assert.match(collectText(view.nodes.feed), /Temporary in this tab · not submitted/);

  const reloaded = await page({ local, href: "https://robertashworth1986-debug.github.io/bkota/" });
  assert.doesNotMatch(collectText(reloaded.nodes.feed), /I helped my neighbor carry groceries|An older private preview/);
  assert.equal(local.readKeys.includes(STORY_KEY), false);
  assert.equal(local.readKeys.includes(VIDEO_KEY), false);
});

test("public counters reject coercible non-number values", async () => {
  const view = await page({ connected: true, responses: {
    "/api/health": READY_HEALTH,
    "/api/stories": { items: [] },
    "/api/videos": { items: [] },
    "/api/stats": { approvedDeeds: "8", approvedVideos: true, continentsReached: [], byContinent: { Africa: "2" } }
  } });
  assert.equal(view.nodes.globalDeedCount.textContent, "0");
  assert.equal(view.nodes.approvedVideoCount.textContent, "0");
  assert.equal(view.nodes.continentCount.textContent, "0");
  assert.equal(view.nodes.approvedStoryStat.hidden, true);
  assert.equal(view.nodes.approvedVideoStat.hidden, true);
  assert.equal(view.nodes.continentStat.hidden, true);
});

test("offline launch hides unverified public counters", async () => {
  const view = await page();
  assert.equal(view.nodes.approvedStoryStat.hidden, true);
  assert.equal(view.nodes.approvedVideoStat.hidden, true);
  assert.equal(view.nodes.continentStat.hidden, true);
});

test("native sharing reports only the share-sheet outcome and never includes a private story", async () => {
  let payload;
  const view = await page({ navigatorOverrides: { share: async (value) => { payload = value; } } });
  await view.nodes.shareMovement.listeners.click();
  assert.match(payload.text, /Arthur Farmer/);
  assert.doesNotMatch(`${payload.text}\n${payload.url}`, /I helped my neighbor carry groceries/);
  assert.match(view.nodes.shareStatus.textContent, /cannot verify where or whether anything was posted/i);
});

test("canceling the native share sheet never claims that BKOTA posted", async () => {
  const canceled = new Error("Canceled");
  canceled.name = "AbortError";
  const view = await page({ navigatorOverrides: { share: async () => { throw canceled; } } });
  await view.nodes.shareMovement.listeners.click();
  assert.match(view.nodes.shareStatus.textContent, /canceled.*Nothing was posted/i);
});

test("clipboard sharing copies only Arthur's public challenge and canonical link", async () => {
  let copied = "";
  const view = await page({ navigatorOverrides: { clipboard: { writeText: async (value) => { copied = value; } } } });
  await view.nodes.shareMovement.listeners.click();
  assert.match(copied, /#BKOTA/);
  assert.match(copied, /#join$/);
  assert.doesNotMatch(copied, /I helped my neighbor carry groceries/);
  assert.match(view.nodes.shareStatus.textContent, /copied/i);
});

test("confirmed online submission enters review without being added to the local or public feed", async () => {
  const view = await page({ connected: true, responses: {
    "/api/health": READY_HEALTH,
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

test("campaign attribution is never attached to a personal story or video submission", async () => {
  const code = "Campaign_Code_12345678";
  assert.equal(code.length, 22);
  const view = await page({
    connected: true,
    href: `https://bkota.co/#today?c=${code}`,
    configOverrides: { shareCampaignCode: code },
    responses: {
      "/api/health": READY_HEALTH,
      "/api/stories": { items: [] },
      "/api/videos": { items: [] },
      "/api/stats": {},
      "POST /api/stories": { accepted: true, kind: "story", id: "00000000-0000-4000-8000-000000000021", status: "pending" },
      "POST /api/videos": { accepted: true, kind: "video", id: "00000000-0000-4000-8000-000000000022", status: "pending" }
    }
  });
  await view.submit("bkotaForm");
  await view.submit("videoForm");
  const posts = view.requests.filter((request) => request.options?.method === "POST");
  assert.equal(posts.length, 2);
  for (const request of posts) {
    const payload = JSON.parse(request.options.body);
    assert.equal(Object.hasOwn(payload, "attributionCode"), false);
    assert.equal(JSON.stringify(payload).includes(code), false);
  }
});

test("video links require publication consent, posting authorization, and a non-vulnerable-subject declaration", async () => {
  for (const missing of ["videoConsent", "videoOwnership", "videoSafety"]) {
    const view = await page();
    view.nodes[missing].checked = false;
    await view.submit("videoForm");
    assert.equal(view.nodes.videoForm.resetCount, 0);
    assert.equal(view.local.values.size, 0);
    assert.match(view.nodes.videoStatus.textContent, /permission|posting account|cannot accept/i);
  }
});

test("unconfirmed online delivery preserves forms and does not pretend nothing was sent", async () => {
  const responses = {
    "/api/health": READY_HEALTH,
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
  assert.match(view.nodes.videoStatus.textContent, /permission to film and publish/);
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
