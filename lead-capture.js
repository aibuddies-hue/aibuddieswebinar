/**
 * Lead capture — shared by the landing page and the confirmation page.
 *
 * Loaded before landing.js / thank-you.js on both pages, so a registration
 * that could not be delivered at submit gets another attempt when the
 * visitor lands on the thank-you page.
 */

/**
 * Google Sheets lead capture.
 *
 * Paste the Apps Script web app URL here — the one ending in /exec. Setup
 * steps are in google-apps-script.gs. While this is empty, registrations
 * are still queued locally and will be delivered the first time someone
 * loads the page after a URL is set, so nothing is lost in the meantime.
 */
const LEAD_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwyaxLckcxho0yAr7vgfNrOF2sns2czF-imps0KweoRquJDSo3PpEiGq6qIBzajeksO/exec";

const LEAD_QUEUE_KEY = "pending_leads";
const ATTRIBUTION_KEY = "lead_attribution";
const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Bumped whenever a new field is added below, so a visitor who was already
 * recorded under an older shape still gets the new columns filled in.
 */
const ATTRIBUTION_VERSION = 2;

/**
 * Records where the visitor came from, on their first landing.
 * Captured on arrival rather than at submit because a visitor may open
 * the page from an ad, wander off, and come back without the parameters.
 *
 * First touch wins: anything already recorded is kept, and only fields that
 * were never collected before are filled in. That way the ad that actually
 * brought them in stays credited even if they return through a direct visit.
 */
function captureAttribution() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh = {
      v: ATTRIBUTION_VERSION,
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      // Click ids. Meta and Google use these to match a lead back to the exact
      // click, which is what makes offline conversion uploads work.
      fbclid: params.get("fbclid") || "",
      gclid: params.get("gclid") || "",
      device: deviceType(),
      referrer: document.referrer || "",
      page: window.location.href
    };

    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "null");
    } catch (err) {
      stored = null;
    }

    const record = (stored && typeof stored === "object")
      ? Object.assign({}, fresh, stored, { v: ATTRIBUTION_VERSION })
      : fresh;

    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(record));
  } catch (err) {
    // Storage unavailable; the lead just goes out without attribution.
  }
}

/** Coarse device bucket — enough to see where registrations come from. */
function deviceType() {
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return "Tablet";
  }
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "Mobile";
  return "Desktop";
}

function readAttribution() {
  try {
    return JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "{}");
  } catch (err) {
    return {};
  }
}

function newLeadId() {
  if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "lead-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function readQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem(LEAD_QUEUE_KEY) || "[]");
    return Array.isArray(queue) ? queue : [];
  } catch (err) {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(LEAD_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    // Nothing useful to do; delivery is attempted regardless.
  }
}

/**
 * Persists the lead before any network call. The sheet is the only real
 * record of a registration, so it is written down locally first and only
 * removed once delivery is confirmed or clearly hopeless.
 */
function queueLead(lead) {
  const queue = readQueue();
  queue.push({ lead: lead, attempts: 0 });
  writeQueue(queue);
}

/**
 * Tries to deliver everything still queued.
 *
 * keepalive lets the request finish after the page navigates away, which is
 * exactly what happens at submit — so the send survives the redirect to the
 * thank-you page. The response cannot be read once the page is gone, so the
 * entry stays queued and is retried when the thank-you page loads; that
 * retry is what normally confirms and clears it.
 *
 * Content-Type is text/plain deliberately: it keeps this a "simple" request
 * so the browser sends no preflight, which Apps Script cannot answer.
 *
 * Retrying is safe because every lead carries an id and the Apps Script side
 * skips one it has already written, so a repeat can never add a second row.
 */
function flushLeadQueue() {
  const url = (LEAD_WEBHOOK_URL || "").trim();
  const queue = readQueue();
  if (!url || !queue.length) return;

  const remaining = [];

  queue.forEach((entry) => {
    entry.attempts = (entry.attempts || 0) + 1;

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(entry.lead),
      keepalive: true
    })
      .then((res) => {
        // A readable ok response means the row is written; drop it now.
        if (res && res.ok) dequeueLead(entry.lead.id);
      })
      .catch(() => {
        // Network or CORS failure. It stays queued for the next page load.
      });

    // Give up only after several tries, so an entry that can never be
    // delivered cannot pile up forever.
    if (entry.attempts < MAX_DELIVERY_ATTEMPTS) remaining.push(entry);
  });

  writeQueue(remaining);
}

function dequeueLead(id) {
  if (!id) return;
  writeQueue(readQueue().filter((entry) => entry.lead.id !== id));
}
