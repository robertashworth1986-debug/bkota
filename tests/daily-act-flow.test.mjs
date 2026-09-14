import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import "../community.js";
import "../social-video.js";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const allowedActs = ["encourage", "listen", "help", "repair", "include"];
const invitation = "Arthur Farmer invites you to choose one kind act today and pass it on. Be Kind One To Another — Ephesians 4:32. #BKOTA";

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
  dispatchEvent(event) { return this.listeners[event.type]?.(event); }
  querySelector(selector) { return selector === '[type="submit"]' ? this.submit : null; }
  querySelectorAll(selector) { return selector === 'input[name="dailyAct"]' ? (this.radios || []) : []; }
  reset() { this.resetCount += 1; }
  focus() {}
  click() { this.clicked = true; }
  remove() {}
}

function storage() {
  const values = new Map();
  return {
    values,
    reads: 0,
    writes: 0,
    getItem(key) { this.reads += 1; return values.get(key) ?? null; },
    setItem(key, value) { this.writes += 1; values.set(key, String(value)); },
    removeItem(key) { this.writes += 1; values.delete(key); }
  };
}

async function page({ navigatorOverrides = {}, canonicalHref = "https://bkota.co/?campaign=unsafe#old", radioValues = allowedActs, includeDailyFlow = true, locationHash = "", shareCampaignCode = "" } = {}) {
  const ids = ["feed", "bkotaForm", "formStatus", "messageText", "storyConsent", "continent", "name", "city", "anon", "storyWebsite", "seedDemo", "clearFeed", "videoWall", "videoStatus", "videoForm", "videoUrl", "videoCaption", "videoConsent", "videoOwnership", "videoSafety", "videoWebsite", "videoSubmit", "seedVideos", "clearVideos", "downloadCollection", "collectionStatus", "venmoButton", "connectionMode", "connectionNote", "globalDeedCount", "approvedVideoCount", "continentCount", "approvedStoryStat", "approvedVideoStat", "continentStat", "shareMovement", "shareStatus", "copyChallenge"];
  if (includeDailyFlow) ids.push("dailyActForm", "dailyActDone", "dailyActShare", "dailyActStatus");
  const nodes = Object.fromEntries(ids.map((id) => [id, new Node()]));
  nodes.bkotaForm.submit = new Node("button");
  nodes.messageText.value = "Private visitor story";
  nodes.storyConsent.checked = true;
  nodes.continent.value = "North America";
  nodes.videoUrl.value = "https://www.youtube.com/watch?v=abcdefghijk";
  nodes.videoCaption.value = "Private video caption";
  nodes.videoConsent.checked = true;
  nodes.videoOwnership.checked = true;
  nodes.videoSafety.checked = true;

  const radios = includeDailyFlow ? radioValues.map((value) => {
    const radio = new Node("input");
    radio.name = "dailyAct";
    radio.value = value;
    return radio;
  }) : [];
  if (includeDailyFlow) nodes.dailyActForm.radios = radios;

  const local = storage();
  const requests = [];
  const replacements = [];
  const document = {
    documentElement: new Node("html"),
    body: new Node("body"),
    querySelector(selector) {
      if (selector === 'link[rel="canonical"]') return canonicalHref === null ? null : { href: canonicalHref };
      return selector.startsWith("#") ? (nodes[selector.slice(1)] || null) : null;
    },
    querySelectorAll() { return []; },
    createElement(tag) { return new Node(tag); },
    createTextNode(text) { return text; },
    addEventListener() {},
    visibilityState: "visible"
  };
  const context = {
    BKOTA_COMMUNITY: globalThis.BKOTA_COMMUNITY,
    BKOTA_SOCIAL_VIDEO: globalThis.BKOTA_SOCIAL_VIDEO,
    BKOTA_CONFIG: Object.freeze({ moderatedServiceEnabled: false, shareCampaignCode }),
    document,
    navigator: navigatorOverrides,
    location: { hash: locationHash, href: `https://preview.example.test/path?private=1${locationHash}`, pathname: "/path", search: "?private=1" },
    history: { state: null, replaceState(state, title, url) { replacements.push({ state, title, url }); } },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    URL,
    URLSearchParams,
    Blob,
    setTimeout(callback) { callback(); },
    AbortSignal,
    console,
    confirm: () => true,
    fetch: async (path, options) => {
      requests.push({ path, options });
      return { ok: true, redirected: false, headers: { get: () => "application/json" }, json: async () => ({}) };
    }
  };
  Object.defineProperty(context, "localStorage", { get() { return local; } });
  vm.runInNewContext(appSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  return { nodes, radios, local, requests, replacements };
}

function choose(view, value) {
  view.radios.forEach((radio) => { radio.checked = radio.value === value; });
  const selected = view.radios.find((radio) => radio.value === value);
  assert.ok(selected, `missing test radio: ${value}`);
  selected.listeners.change();
}

function complete(view) {
  view.nodes.dailyActDone.checked = true;
  view.nodes.dailyActDone.listeners.change();
}

async function submitDaily(view) {
  let prevented = false;
  await view.nodes.dailyActForm.dispatchEvent({ type: "submit", preventDefault() { prevented = true; } });
  assert.equal(prevented, true, "daily-act form submission must prevent navigation");
}

test("the daily act funnel is tab-local and changing a valid choice clears completion", async () => {
  const view = await page();
  assert.equal(view.nodes.dailyActDone.disabled, true);
  assert.equal(view.nodes.dailyActShare.disabled, true);
  assert.match(view.nodes.dailyActStatus.textContent, /Nothing is stored, sent, or counted/i);
  const before = {
    reads: view.local.reads,
    writes: view.local.writes,
    requests: view.requests.length,
    counters: [view.nodes.globalDeedCount.textContent, view.nodes.approvedVideoCount.textContent, view.nodes.continentCount.textContent]
  };

  choose(view, "encourage");
  assert.equal(view.nodes.dailyActDone.disabled, false);
  assert.equal(view.nodes.dailyActDone.checked, false);
  assert.equal(view.nodes.dailyActShare.disabled, true);
  complete(view);
  assert.equal(view.nodes.dailyActShare.disabled, false);
  assert.match(view.nodes.dailyActStatus.textContent, /this tab only/i);
  assert.match(view.nodes.dailyActStatus.textContent, /did not store, send, count, or verify/i);

  choose(view, "listen");
  assert.equal(view.nodes.dailyActDone.checked, false);
  assert.equal(view.nodes.dailyActDone.disabled, false);
  assert.equal(view.nodes.dailyActShare.disabled, true);
  assert.deepEqual({
    reads: view.local.reads,
    writes: view.local.writes,
    requests: view.requests.length,
    counters: [view.nodes.globalDeedCount.textContent, view.nodes.approvedVideoCount.textContent, view.nodes.continentCount.textContent]
  }, before);
});

test("only the fixed whitelist can unlock completion or sharing", async () => {
  let shareCalls = 0;
  const view = await page({
    radioValues: [...allowedActs, "publish-private-deed"],
    navigatorOverrides: { share: async () => { shareCalls += 1; } }
  });
  choose(view, "publish-private-deed");
  assert.equal(view.nodes.dailyActDone.disabled, true);
  assert.equal(view.nodes.dailyActDone.checked, false);
  assert.equal(view.nodes.dailyActShare.disabled, true);
  assert.match(view.nodes.dailyActStatus.textContent, /unavailable|five listed acts/i);

  view.nodes.dailyActDone.checked = true;
  view.nodes.dailyActDone.listeners.change();
  await submitDaily(view);
  assert.equal(shareCalls, 0);
  assert.match(view.nodes.dailyActStatus.textContent, /Nothing was posted/i);
  assert.equal(view.local.writes, 0);
  assert.equal(view.requests.length, 0);
});

test("completed flow shares only Arthur's fixed invitation and the clean canonical #today URL", async () => {
  const shared = [];
  const view = await page({ navigatorOverrides: { share: async (payload) => { shared.push(payload); } } });
  choose(view, "repair");
  complete(view);
  await submitDaily(view);

  assert.deepEqual(JSON.parse(JSON.stringify(shared)), [{
    title: "BKOTA — Be Kind One To Another",
    text: invitation,
    url: "https://bkota.co/#today"
  }]);
  assert.doesNotMatch(JSON.stringify(shared), /repair|Private visitor story|Private video caption/i);
  assert.match(view.nodes.dailyActStatus.textContent, /cannot verify where or whether anything was posted/i);
  assert.match(view.nodes.dailyActStatus.textContent, /does not claim your deed was verified/i);
  assert.equal(view.local.writes, 0);
  assert.equal(view.requests.length, 0);
});

test("clipboard fallback and native cancellation make no posting or verification claim", async () => {
  let copied = "";
  const clipboardView = await page({ navigatorOverrides: { clipboard: { writeText: async (value) => { copied = value; } } } });
  choose(clipboardView, "help");
  complete(clipboardView);
  await submitDaily(clipboardView);
  assert.equal(copied, `${invitation}\nhttps://bkota.co/#today`);
  assert.doesNotMatch(copied, /help|Private visitor story|Private video caption/i);
  assert.match(clipboardView.nodes.dailyActStatus.textContent, /copied/i);
  assert.match(clipboardView.nodes.dailyActStatus.textContent, /did not post anything or verify a deed/i);

  const canceled = new Error("Canceled");
  canceled.name = "AbortError";
  const canceledView = await page({ navigatorOverrides: { share: async () => { throw canceled; } } });
  choose(canceledView, "include");
  complete(canceledView);
  await submitDaily(canceledView);
  assert.match(canceledView.nodes.dailyActStatus.textContent, /canceled/i);
  assert.match(canceledView.nodes.dailyActStatus.textContent, /Nothing was posted/i);
  assert.match(canceledView.nodes.dailyActStatus.textContent, /no deed was recorded or verified/i);
});

test("missing daily markup or an unsafe canonical URL fails closed", async () => {
  await assert.doesNotReject(() => page({ includeDailyFlow: false }));

  let shareCalls = 0;
  const view = await page({
    canonicalHref: "javascript:alert(1)",
    navigatorOverrides: { share: async () => { shareCalls += 1; } }
  });
  choose(view, "encourage");
  complete(view);
  await submitDaily(view);
  assert.equal(shareCalls, 0);
  assert.equal(view.nodes.dailyActShare.disabled, true);
  assert.match(view.nodes.dailyActStatus.textContent, /link is unavailable|sharing stayed closed/i);
  assert.match(view.nodes.dailyActStatus.textContent, /Nothing was posted/i);
  assert.equal(view.local.writes, 0);
  assert.equal(view.requests.length, 0);
});

test("valid campaign attribution accepts and preserves both daily and legacy anchors", async () => {
  const code = "abcdefghijklmnopqrstuv";
  for (const anchor of ["today", "join"]) {
    const view = await page({ locationHash: `#${anchor}?c=${code}`, shareCampaignCode: code });
    assert.deepEqual(view.replacements, [{ state: null, title: "", url: `/path?private=1#${anchor}` }]);
  }
  const invalid = await page({ locationHash: "#today?c=too-short" });
  assert.deepEqual(invalid.replacements, []);
  const unissued = await page({ locationHash: `#today?c=${code}`, shareCampaignCode: "zyxwvutsrqponmlkjihgfe" });
  assert.deepEqual(unissued.replacements, []);
});

test("daily sharing keeps a valid configured campaign on #today and discards invalid codes", async () => {
  const code = "abcdefghijklmnopqrstuv";
  for (const [shareCampaignCode, expectedHash] of [[code, `#today?c=${code}`], ["bad/code", "#today"]]) {
    let sharedUrl = "";
    const view = await page({ shareCampaignCode, navigatorOverrides: { share: async ({ url }) => { sharedUrl = url; } } });
    choose(view, "listen");
    complete(view);
    await submitDaily(view);
    assert.equal(sharedUrl, `https://bkota.co/${expectedHash}`);
  }
});
