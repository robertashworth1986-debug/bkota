(() => {
  "use strict";

  // These keys contain the visitor's private collection, never a public-feed cache.
  const STORY_KEY = "bkota_feed_v2";
  const VIDEO_KEY = "bkota_video_wall_v1";
  const STORY_LIMIT = 50;
  const VIDEO_LIMIT = 24;
  const RAW_COLLECTION_BYTE_LIMIT = 128 * 1024;
  const CONTINENTS = new Set(["Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America"]);
  const LEGACY_ATTRIBUTION = /^[A-Za-z0-9_-]{22}$/;
  const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
  // Keep normal tabs/newlines available for stories, but reject hidden direction
  // controls and other control bytes that can disguise what is rendered/exported.
  const UNSAFE_MULTILINE_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
  const UNSAFE_SINGLE_LINE_TEXT = /[\u0000-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
  const STORY_FIELDS = new Set(["id", "message", "name", "city", "continent", "anonymous", "consent", "website", "attributionCode", "localOnly", "createdAt", "example"]);
  const VIDEO_FIELDS = new Set(["id", "url", "provider", "platform", "providerVideoId", "providerCreator", "caption", "consent", "postingAuthorization", "noMinorsOrVulnerableMoments", "website", "attributionCode", "localOnly", "createdAt", "example"]);
  const isRecord = (item) => item !== null && typeof item === "object" && !Array.isArray(item);
  const hasOwn = (item, field) => Object.prototype.hasOwnProperty.call(item, field);
  const failure = (code) => ({ ok: false, code, items: [] });

  function utf8BytesAtMost(value, maximum) {
    // Raw browser storage is a JS string. Count its UTF-8 representation with an
    // early exit so an oversized value is rejected before JSON.parse allocates.
    if (typeof value !== "string" || value.length > maximum) return false;
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
      const unit = value.charCodeAt(index);
      if (unit <= 0x7f) bytes += 1;
      else if (unit <= 0x7ff) bytes += 2;
      else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < value.length) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) { bytes += 4; index += 1; }
        else bytes += 3;
      } else bytes += 3;
      if (bytes > maximum) return false;
    }
    return true;
  }

  function isWellFormedText(value) {
    for (let index = 0; index < value.length; index += 1) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (next < 0xdc00 || next > 0xdfff) return false;
        index += 1;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    }
    return true;
  }

  function safeText(value, maximum, { required = false, multiline = false } = {}) {
    return typeof value === "string"
      && value.length <= maximum
      && (!required || value.trim().length > 0)
      && isWellFormedText(value)
      && value.normalize("NFC") === value
      && !(multiline ? UNSAFE_MULTILINE_TEXT : UNSAFE_SINGLE_LINE_TEXT).test(value);
  }

  function exactFields(item, allowed) {
    let fields;
    try { fields = Object.keys(item); }
    catch { return false; }
    return fields.every((field) => allowed.has(field));
  }

  function optionalText(item, field, maximum) {
    return !hasOwn(item, field) || safeText(item[field], maximum);
  }

  function optionalTrue(item, field) {
    return !hasOwn(item, field) || item[field] === true;
  }

  function canonicalDate(value) {
    if (!safeText(value, 32, { required: true })) return false;
    try { return new Date(value).toISOString() === value; }
    catch { return false; }
  }

  function commonRecordFields(item) {
    if (hasOwn(item, "id") && (!safeText(item.id, 128, { required: true }) || !SAFE_ID.test(item.id))) return false;
    if (hasOwn(item, "createdAt") && !canonicalDate(item.createdAt)) return false;
    if (!optionalTrue(item, "consent") || !optionalTrue(item, "localOnly") || !optionalTrue(item, "example")) return false;
    if (!optionalText(item, "website", 120)) return false;
    if (hasOwn(item, "attributionCode") && (typeof item.attributionCode !== "string" || !LEGACY_ATTRIBUTION.test(item.attributionCode))) return false;
    return true;
  }

  function validStory(item) {
    if (!isRecord(item) || !exactFields(item, STORY_FIELDS) || !commonRecordFields(item)) return false;
    if (!safeText(item.message, 280, { required: true, multiline: true })) return false;
    if (item.example === true) {
      return Object.keys(item).every((field) => field === "example" || field === "message");
    }
    if (!optionalText(item, "name", 40) || !optionalText(item, "city", 60)) return false;
    if (hasOwn(item, "continent") && (!safeText(item.continent, 20, { required: true }) || !CONTINENTS.has(item.continent))) return false;
    if (hasOwn(item, "anonymous") && typeof item.anonymous !== "boolean") return false;
    // Early private-preview records did not always carry consent/date metadata.
    // Missing legacy fields are tolerated; any field that is present is strict.
    return true;
  }

  function canonicalSocialVideo(item) {
    const parser = globalThis.BKOTA_SOCIAL_VIDEO?.parseSocialVideoUrl;
    if (typeof parser !== "function" || !safeText(item.url, 500, { required: true })) return null;
    let parsed;
    try { parsed = parser(item.url); }
    catch { return null; }
    if (!parsed || parsed.url !== item.url) return null;
    return parsed;
  }

  function validVideo(item) {
    if (!isRecord(item) || !exactFields(item, VIDEO_FIELDS) || !commonRecordFields(item)) return false;
    if (!safeText(item.caption, 180, { required: true })) return false;
    if (!optionalTrue(item, "postingAuthorization") || !optionalTrue(item, "noMinorsOrVulnerableMoments")) return false;
    // The two newer authorization declarations are an all-or-nothing pair.
    if (hasOwn(item, "postingAuthorization") !== hasOwn(item, "noMinorsOrVulnerableMoments")) return false;
    if (item.example === true && !hasOwn(item, "url")) {
      return Object.keys(item).every((field) => field === "example" || field === "caption");
    }
    const parsed = canonicalSocialVideo(item);
    if (!parsed) return false;
    const metadata = ["provider", "platform", "providerVideoId", "providerCreator"];
    const metadataCount = metadata.filter((field) => hasOwn(item, field)).length;
    if (metadataCount !== 0 && metadataCount !== metadata.length) return false;
    if (metadataCount === metadata.length && (
      item.provider !== parsed.provider
      || item.platform !== parsed.platform
      || item.providerVideoId !== parsed.providerVideoId
      || item.providerCreator !== parsed.providerCreator
    )) return false;
    return true;
  }

  function collectionSchema(key) {
    if (key === STORY_KEY) return { maximum: STORY_LIMIT, validate: validStory };
    if (key === VIDEO_KEY) return { maximum: VIDEO_LIMIT, validate: validVideo };
    return null;
  }

  function readCollection(storageProvider, key) {
    const schema = collectionSchema(key);
    if (!schema) return failure("invalid_collection_key");
    let raw;
    try { raw = storageProvider().getItem(key); }
    catch { return failure("storage_unavailable"); }
    if (raw === null) return { ok: true, items: [] };
    if (!utf8BytesAtMost(raw, RAW_COLLECTION_BYTE_LIMIT)) return failure("collection_too_large");
    try {
      const items = JSON.parse(raw);
      // Fail closed instead of replacing a corrupt collection with an empty one.
      if (!Array.isArray(items) || items.length > schema.maximum || !items.every(schema.validate)) return failure("invalid_collection");
      return { ok: true, items };
    } catch { return failure("invalid_collection"); }
  }

  function appendCollection(storageProvider, key, item, limit) {
    const schema = collectionSchema(key);
    if (!schema || !Number.isInteger(limit) || limit < 1 || limit > schema.maximum) return failure("invalid_entry");
    try { if (!schema.validate(item)) return failure("invalid_entry"); }
    catch { return failure("invalid_entry"); }
    const current = readCollection(storageProvider, key);
    if (!current.ok) return current;
    // Never silently trim a visitor's older stories to make room for a new one.
    if (current.items.length >= limit) return failure("collection_full");
    const items = [...current.items, item];
    let serialized;
    try { serialized = JSON.stringify(items); }
    catch { return failure("invalid_entry"); }
    if (!utf8BytesAtMost(serialized, RAW_COLLECTION_BYTE_LIMIT)) return failure("collection_too_large");
    try { storageProvider().setItem(key, serialized); }
    catch { return failure("storage_write_failed"); }
    return { ok: true, items };
  }

  function clearCollection(storageProvider, key) {
    if (!collectionSchema(key)) return failure("invalid_collection_key");
    try { storageProvider().removeItem(key); }
    catch { return failure("storage_write_failed"); }
    return { ok: true, items: [] };
  }

  function exportCollection(storageProvider, exportedAt) {
    const stories = readCollection(storageProvider, STORY_KEY);
    const videos = readCollection(storageProvider, VIDEO_KEY);
    if (!stories.ok) return { ...stories, collection: "stories" };
    if (!videos.ok) return { ...videos, collection: "video links" };
    if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt))) return failure("invalid_export_date");
    const copyFields = (item, fields) => Object.fromEntries(fields
      .filter((field) => typeof item[field] === "string" || typeof item[field] === "boolean")
      .map((field) => [field, item[field]]));
    const privateStories = stories.items.filter((item) => item.example !== true).map((item) => {
      const record = copyFields(item, ["id", "message", "name", "city", "continent", "anonymous", "createdAt"]);
      if (record.anonymous === true) { record.name = ""; record.city = ""; }
      return { ...record, submissionStatus: item.localOnly === true ? "not-submitted" : "unknown-legacy-record" };
    });
    const videoLinks = videos.items.filter((item) => item.example !== true).map((item) =>
      ({ ...copyFields(item, ["url", "provider", "platform", "caption", "createdAt"]), submissionStatus: item.localOnly === true ? "not-submitted" : "unknown-legacy-record" }));
    return {
      ok: true,
      data: {
        format: "bkota-private-collection",
        version: 1,
        exportedAt,
        publicationStatus: "not-established-by-this-backup",
        notice: "Personal browser backup only. Exporting does not send, publish, moderate, or verify these entries. Older records may be saved previews or cached content; their submission history is unknown. Video links are included; video files are not downloaded. Keep this file private if it contains personal information.",
        stories: privateStories,
        videoLinks
      }
    };
  }

  function storageErrorMessage(code) {
    if (code === "invalid_collection" || code === "collection_too_large") return "This browser's saved collection could not be read safely. It has not been overwritten. Keep this tab open and ask a trusted helper to recover the browser data.";
    if (code === "collection_full") return "This private collection is full. Download your collection before clearing entries to make room. Your new entry is still in the form.";
    if (code === "storage_unavailable" || code === "storage_write_failed") return "This browser could not save or access your private collection. Storage may be blocked or full. Your form has not been cleared; copy your text somewhere safe before leaving.";
    return "This entry could not be saved. Your form has not been cleared; copy your text somewhere safe before leaving.";
  }

  Object.defineProperty(globalThis, "BKOTA_COMMUNITY", {
    value: Object.freeze({ STORY_KEY, VIDEO_KEY, STORY_LIMIT, VIDEO_LIMIT, RAW_COLLECTION_BYTE_LIMIT, readCollection, appendCollection, clearCollection, exportCollection, storageErrorMessage }),
    writable: false,
    configurable: false
  });
})();
