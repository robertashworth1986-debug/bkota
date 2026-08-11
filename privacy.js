"use strict";

const form = document.querySelector("#reportForm");
const status = document.querySelector("#reportStatus");
const submitButton = document.querySelector("#reportSubmit");
const targetKindInput = document.querySelector("#reportTargetKind");
const targetIdInput = document.querySelector("#reportTargetId");
const targetSummary = document.querySelector("#reportTarget");
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

const params = new URLSearchParams(location.search);
const targetKind = params.get("kind") || "";
const targetId = params.get("id") || "";
if (["story", "video"].includes(targetKind) && UUID_PATTERN.test(targetId)) {
  targetKindInput.value = targetKind;
  targetIdInput.value = targetId.toLowerCase();
  targetSummary.textContent = `Private review for BKOTA ${targetKind} ${targetId}`;
  submitButton.disabled = false;
} else {
  status.textContent = "Use the Request privacy or removal review link beside the BKOTA item you want reviewed.";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const details = document.querySelector("#reportDetails").value.trim();
  const consent = document.querySelector("#reportConsent").checked;
  const requestType = document.querySelector("#reportRequestType").value;
  const reporterRole = document.querySelector("#reporterRole").value;
  if (!submitButton.disabled && details && consent && requestType && reporterRole) {
    status.textContent = "Sending securely…";
  } else {
    status.textContent = "Choose the item, request type, your role, explain the concern, and confirm the request.";
    return;
  }
  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetKind: targetKindInput.value,
        targetId: targetIdInput.value,
        requestType,
        reporterRole,
        details,
        consent,
        contact: document.querySelector("#reportContact").value.trim(),
        website: document.querySelector("#reportWebsite").value
      }),
      signal: AbortSignal.timeout(8000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The request could not be sent.");
    form.reset();
    submitButton.disabled = true;
    status.textContent = "The item is on hold and your private request is in the moderator queue.";
  } catch (error) {
    status.textContent = `${error.message} Please try again later.`;
  }
});
