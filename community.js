(() => {
  "use strict";

  // These keys contain the visitor's private collection, never a public-feed cache.
  const STORY_KEY = "bkota_feed_v2";
  const VIDEO_KEY = "bkota_video_wall_v1";
  const isRecord = (item) => item !== null && typeof item === "object" && !Array.isArray(item);
  const failure = (code) => ({ ok: false, code, items: [] });

  function readCollection(storageProvider, key) {
    let raw;
    try { raw = storageProvider().getItem(key); }
    catch { return failure("storage_unavailable"); }
    if (raw === null) return { ok: true, items: [] };
    try {
      const items = JSON.parse(raw);
      // Fail closed instead of replacing a corrupt collection with an empty one.
      if (!Array.isArray(items) || !items.every(isRecord)) return failure("invalid_collection");
      return { ok: true, items };
    } catch { return failure("invalid_collection"); }
  }

  function appendCollection(storageProvider, key, item, limit) {
    if (!isRecord(item) || !Number.isInteger(limit) || limit < 1) return failure("invalid_entry");
    const current = readCollection(storageProvider, key);
    if (!current.ok) return current;
    // Never silently trim a visitor's older stories to make room for a new one.
    if (current.items.length >= limit) return failure("collection_full");
    const items = [...current.items, item];
    let serialized;
    try { serialized = JSON.stringify(items); }
    catch { return failure("invalid_entry"); }
    try { storageProvider().setItem(key, serialized); }
    catch { return failure("storage_write_failed"); }
    return { ok: true, items };
  }

  function clearCollection(storageProvider, key) {
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
    if (code === "invalid_collection") return "This browser's saved collection could not be read. It has not been overwritten. Keep this tab open and ask a trusted helper to recover the browser data.";
    if (code === "collection_full") return "This private collection is full. Download your collection before clearing entries to make room. Your new entry is still in the form.";
    if (code === "storage_unavailable" || code === "storage_write_failed") return "This browser could not save or access your private collection. Storage may be blocked or full. Your form has not been cleared; copy your text somewhere safe before leaving.";
    return "This entry could not be saved. Your form has not been cleared; copy your text somewhere safe before leaving.";
  }

  Object.defineProperty(globalThis, "BKOTA_COMMUNITY", {
    value: Object.freeze({ STORY_KEY, VIDEO_KEY, readCollection, appendCollection, clearCollection, exportCollection, storageErrorMessage }),
    writable: false,
    configurable: false
  });
})();
