"use strict";

const form = document.querySelector("#reportForm");
const status = document.querySelector("#reportStatus");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const reference = document.querySelector("#reportReference").value.trim();
  const details = document.querySelector("#reportDetails").value.trim();
  const consent = document.querySelector("#reportConsent").checked;
  if (!reference.startsWith("https://") || !details || !consent) {
    status.textContent = "Please provide the public HTTPS link, explain the concern, and confirm the request.";
    return;
  }
  status.textContent = "Sending securely…";
  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference, details, consent, contact: document.querySelector("#reportContact").value.trim(), website: document.querySelector("#reportWebsite").value }),
      signal: AbortSignal.timeout(8000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "The request could not be sent.");
    form.reset();
    status.textContent = "Your private request is in the moderator queue.";
  } catch (error) {
    status.textContent = `${error.message} Please try again later.`;
  }
});
