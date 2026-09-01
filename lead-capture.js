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
const LEAD_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxikMz7LGmdp_j7y3n_LLTmL5TbNiok5FlvhJxOrkQ5Phu8AU15Xbzxk4vL_-uNHmT-/exec";

const LEAD_QUEUE_KEY = "pending_leads";
const ATTRIBUTION_KEY = "lead_attribution";
const MAX_DELIVERY_ATTEMPTS = 5;

/**
 * Records where the visitor came from, once, on their first landing.
 * Captured on arrival rather than at submit because a visitor may open
 * the page from an ad, wander off, and come back without the parameters.
 */
function captureAttribution() {
  try {
    if (localStorage.getItem(ATTRIBUTION_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const attribution = {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || "",
      referrer: document.referrer || "",
      page: window.location.href
    };
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch (err) {
    // Storage unavailable; the lead just goes out without attribution.
  }
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
