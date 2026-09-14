import assert from "node:assert/strict";
import test from "node:test";
import "../social-video.js";
import "../community.js";

const {
  STORY_KEY,
  VIDEO_KEY,
  STORY_LIMIT,
  VIDEO_LIMIT,
  RAW_COLLECTION_BYTE_LIMIT,
  readCollection,
  appendCollection,
  clearCollection,
  exportCollection
} = globalThis.BKOTA_COMMUNITY;

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    reads: 0,
    writes: 0,
    removes: 0,
    getItem(key) { this.reads += 1; return values.get(key) ?? null; },
    setItem(key, value) { this.writes += 1; values.set(key, String(value)); },
    removeItem(key) { this.removes += 1; values.delete(key); }
  };
}

const story = (message = "A neighbor was heard") => ({ message });
const video = (caption = "A neighbor was helped") => ({
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  caption
});

const currentStory = () => ({
  id: "00000000-0000-4000-8000-000000000001",
  message: "I helped a neighbor carry groceries.",
  name: "Art",
  city: "Nashville, TN",
  continent: "North America",
  anonymous: false,
  consent: true,
  website: "",
  localOnly: true,
  createdAt: "2026-09-12T12:00:00.000Z"
});

const currentVideo = () => ({
  provider: "youtube",
  platform: "YouTube",
  providerVideoId: "abcdefghijk",
  providerCreator: "",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  caption: "A helping hand",
  consent: true,
  postingAuthorization: true,
  noMinorsOrVulnerableMoments: true,
  website: "",
  localOnly: true,
  createdAt: "2026-09-12T12:00:00.000Z"
});

function assertRejectedWithoutMutation(key, raw, code = "invalid_collection") {
  const local = storage({ [key]: raw });
  assert.equal(readCollection(() => local, key).code, code);
  assert.equal(local.values.get(key), raw);
  assert.equal(local.writes, 0);
  assert.equal(local.removes, 0);
  return local;
}

test("raw collections have a UTF-8 byte ceiling before JSON parsing or mutation", () => {
  const oversized = JSON.stringify([{ message: "x".repeat(RAW_COLLECTION_BYTE_LIMIT) }]);
  const local = assertRejectedWithoutMutation(STORY_KEY, oversized, "collection_too_large");
  assert.equal(appendCollection(() => local, STORY_KEY, story("Still in the form"), STORY_LIMIT).code, "collection_too_large");
  assert.equal(local.values.get(STORY_KEY), oversized);
  assert.equal(local.writes, 0);
  assert.equal(local.removes, 0);

  // UTF-8, not character count: this stays below the JS length shortcut but
  // exceeds the byte cap because every code point occupies multiple bytes.
  const multiByteOversized = JSON.stringify([{ ...video(), caption: "é".repeat(RAW_COLLECTION_BYTE_LIMIT / 2) }]);
  assert.ok(multiByteOversized.length < RAW_COLLECTION_BYTE_LIMIT);
  assertRejectedWithoutMutation(VIDEO_KEY, multiByteOversized, "collection_too_large");
});

test("reads reject 51 stories and 25 videos without trimming or rewriting", () => {
  const storiesRaw = JSON.stringify(Array.from({ length: STORY_LIMIT + 1 }, (_, index) => story(`Kind act ${index}`)));
  const videosRaw = JSON.stringify(Array.from({ length: VIDEO_LIMIT + 1 }, (_, index) => video(`Kind video ${index}`)));
  assertRejectedWithoutMutation(STORY_KEY, storiesRaw);
  assertRejectedWithoutMutation(VIDEO_KEY, videosRaw);
});

test("reads accept exactly the bounded rendering maxima and no more", () => {
  const stories = Array.from({ length: STORY_LIMIT }, (_, index) => story(`${index}: ${"K".repeat(270)}`));
  const videos = Array.from({ length: VIDEO_LIMIT }, (_, index) => video(`${index}: ${"V".repeat(170)}`));
  const local = storage({ [STORY_KEY]: JSON.stringify(stories), [VIDEO_KEY]: JSON.stringify(videos) });
  const storyResult = readCollection(() => local, STORY_KEY);
  const videoResult = readCollection(() => local, VIDEO_KEY);
  assert.equal(storyResult.ok, true);
  assert.equal(storyResult.items.length, STORY_LIMIT);
  assert.ok(storyResult.items.every((item) => item.message.length <= 280));
  assert.equal(videoResult.ok, true);
  assert.equal(videoResult.items.length, VIDEO_LIMIT);
  assert.ok(videoResult.items.every((item) => item.caption.length <= 180));
  assert.equal(local.writes, 0);
  assert.equal(local.removes, 0);
});

test("story schema rejects unknown, oversized, unnormalized, unsafe, and inconsistent entries", () => {
  const invalid = [
    { message: "K".repeat(281) },
    { message: "Kindness", unknown: "field" },
    { message: "Cafe\u0301" },
    { message: "Kind\u202Ehidden" },
    { message: "Kind\u0000hidden" },
    { message: 42 },
    { message: "Kindness", continent: "Atlantis" },
    { message: "Kindness", website: "x".repeat(121) },
    { message: "Kindness", anonymous: "yes" },
    { ...currentStory(), consent: false },
    { ...currentStory(), createdAt: "September 12, 2026" },
    { ...currentStory(), attributionCode: "not-valid" }
  ];
  for (const item of invalid) {
    const raw = JSON.stringify([item]);
    const local = assertRejectedWithoutMutation(STORY_KEY, raw);
    assert.equal(appendCollection(() => local, STORY_KEY, currentStory(), STORY_LIMIT).ok, false);
    assert.equal(local.values.get(STORY_KEY), raw);
  }
});

test("video schema requires canonical provider URLs and internally consistent metadata", () => {
  const invalid = [
    { ...video(), url: "https://youtu.be/abcdefghijk" },
    { ...video(), url: "https://www.youtube.com/watch?v=abcdefghijk&utm_source=tracker" },
    { ...video(), url: "https://www.tiktok.com/@kindness/video/123456789?tracking=1" },
    { ...currentVideo(), provider: "tiktok" },
    { ...currentVideo(), providerCreator: "someone" },
    { ...currentVideo(), providerVideoId: "wrongid0000" },
    { ...currentVideo(), platform: "You Tube" },
    { ...currentVideo(), postingAuthorization: false },
    { ...currentVideo(), noMinorsOrVulnerableMoments: false },
    (() => { const item = currentVideo(); delete item.noMinorsOrVulnerableMoments; return item; })(),
    { ...currentVideo(), caption: "V".repeat(181) },
    { ...currentVideo(), caption: "First line\nsecond line" },
    { ...currentVideo(), caption: "Safe\u2066disguised\u2069" },
    { ...currentVideo(), surprise: true }
  ];
  for (const item of invalid) assertRejectedWithoutMutation(VIDEO_KEY, JSON.stringify([item]));
});

test("current story and video records pass their key-specific schemas", () => {
  const local = storage({
    [STORY_KEY]: JSON.stringify([currentStory()]),
    [VIDEO_KEY]: JSON.stringify([currentVideo()])
  });
  assert.deepEqual(readCollection(() => local, STORY_KEY).items, [currentStory()]);
  assert.deepEqual(readCollection(() => local, VIDEO_KEY).items, [currentVideo()]);
  assert.equal(local.writes, 0);
  assert.equal(local.removes, 0);
});

test("current records append within their fixed collection capacities", () => {
  const local = storage();
  assert.equal(appendCollection(() => local, STORY_KEY, currentStory(), STORY_LIMIT).ok, true);
  assert.equal(appendCollection(() => local, VIDEO_KEY, currentVideo(), VIDEO_LIMIT).ok, true);
  assert.deepEqual(readCollection(() => local, STORY_KEY).items, [currentStory()]);
  assert.deepEqual(readCollection(() => local, VIDEO_KEY).items, [currentVideo()]);
  assert.equal(local.writes, 2);
  assert.equal(local.removes, 0);
});

test("invalid append entries fail before reading, writing, or deleting storage", () => {
  const local = storage({ unrelated_origin_key: "private data from another app" });
  assert.equal(appendCollection(() => local, STORY_KEY, { message: "Kind", extra: true }, STORY_LIMIT).code, "invalid_entry");
  assert.equal(appendCollection(() => local, VIDEO_KEY, { ...video(), url: "https://youtu.be/abcdefghijk" }, VIDEO_LIMIT).code, "invalid_entry");
  assert.equal(appendCollection(() => local, "unrelated_origin_key", story(), 1).code, "invalid_entry");
  assert.equal(clearCollection(() => local, "unrelated_origin_key").code, "invalid_collection_key");
  assert.equal(local.values.get("unrelated_origin_key"), "private data from another app");
  assert.equal(local.reads, 0);
  assert.equal(local.writes, 0);
  assert.equal(local.removes, 0);
});

test("legacy campaign attribution is accepted only in its narrow format and never exported", () => {
  const valid = { ...story(), attributionCode: "abcdefghijklmnopqrstuv" };
  const local = storage({ [STORY_KEY]: JSON.stringify([valid]), [VIDEO_KEY]: "[]" });
  assert.equal(readCollection(() => local, STORY_KEY).ok, true);
  const exported = exportCollection(() => local, "2026-09-12T12:00:00.000Z");
  assert.equal(exported.ok, true);
  assert.equal("attributionCode" in exported.data.stories[0], false);

  const malformedRaw = JSON.stringify([{ ...story(), attributionCode: "not-a-valid-token" }]);
  assertRejectedWithoutMutation(STORY_KEY, malformedRaw);
});
