"use strict";

(() => {
  const form = document.querySelector("#reportForm");
  const fields = document.querySelector("#reportFields");
  const status = document.querySelector("#reportStatus");
  const submitButton = document.querySelector("#reportSubmit");
  const targetSummary = document.querySelector("#reportTarget");
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const config = Object.hasOwn(globalThis, "BKOTA_CONFIG") && Object.isFrozen(globalThis.BKOTA_CONFIG)
    ? globalThis.BKOTA_CONFIG : Object.freeze({});
  const params = new URLSearchParams(location.search);
  const targetKind = params.get("kind") || "";
  const targetId = params.get("id") || "";
  const validTarget = ["story", "video"].includes(targetKind) && UUID_PATTERN.test(targetId);
  let reportingAvailable = false;
  let sending = false;

  fields.disabled = true;
  submitButton.disabled = true;
  if (validTarget) targetSummary.textContent = `Review requested for BKOTA ${targetKind} ${targetId.toLowerCase()}`;

  async function initializeReporting() {
    if (config.moderatedServiceEnabled !== true) {
      status.textContent = "Online reports are not connected on this site. This form cannot send a report. Clear private entries on the home page; report a YouTube or TikTok video directly to that platform.";
      return;
    }
    if (!validTarget) {
      status.textContent = "Use the privacy or removal review link beside a published BKOTA item first.";
      return;
    }
    status.textContent = "Checking whether the reporting service is available…";
    try {
      const response = await fetch("/api/health", { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(5000) });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Unavailable");
      const health = await response.json();
      // A future backend must explicitly advertise its report capability; a
      // reachable static HTML page or general submissions endpoint is not enough.
      // Reporting may remain available even when new public submissions are paused.
      if (health.privacyReportsEnabled !== true) throw new Error("Unavailable");
      reportingAvailable = true;
      fields.disabled = false;
      submitButton.disabled = false;
      status.textContent = "Reporting service connected. Sending a request does not by itself confirm removal.";
    } catch {
      status.textContent = "The reporting service could not be verified. This form is disabled and no report has been sent. For a YouTube or TikTok video, use that platform's reporting tools.";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!reportingAvailable || sending || submitButton.disabled || !validTarget) return;
    const details = document.querySelector("#reportDetails").value.trim();
    const consent = document.querySelector("#reportConsent").checked;
    const requestType = document.querySelector("#reportRequestType").value;
    const reporterRole = document.querySelector("#reporterRole").value;
    if (!details || details.length > 500 || !consent
      || !["consent-withdrawal", "privacy", "safety", "removal"].includes(requestType)
      || !["submitter", "featured-person", "parent-or-guardian", "other"].includes(reporterRole)) {
      status.textContent = "Choose a request type and your connection to the item, explain the concern in 500 characters or fewer, and confirm the request.";
      return;
    }
    sending = true;
    submitButton.disabled = true;
    status.textContent = "Sending your review request…";
    try {
      const response = await fetch("/api/reports", {
        method: "POST", cache: "no-store", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetKind, targetId: targetId.toLowerCase(), requestType, reporterRole, details, consent,
          contact: document.querySelector("#reportContact").value.trim().slice(0, 120),
          website: document.querySelector("#reportWebsite").value.slice(0, 120) }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("No receipt");
      const receipt = await response.json();
      if (receipt.accepted !== true || !UUID_PATTERN.test(receipt.reportId || "")) throw new Error("No receipt");
      form.reset();
      fields.disabled = true;
      reportingAvailable = false;
      status.textContent = `Report received. Reference: ${receipt.reportId}. This confirms receipt, not removal or a moderator's decision.`;
    } catch {
      status.textContent = "Receipt could not be confirmed. No removal has been confirmed. A connection failure may occur after a request reaches the service; avoid repeated submissions.";
    } finally {
      sending = false;
      submitButton.disabled = !reportingAvailable;
    }
  });

  void initializeReporting();
})();
