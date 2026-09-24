/**
 * AI Creator Summit — Thank-you / confirmation page
 */

/* ==========================================
   CONFIG — the only two values you edit here
   ========================================== */

/**
 * WhatsApp group invite link.
 *
 * Leave this as an empty string until the group exists. While it is empty
 * the join button is disabled and a short "link coming shortly" note is
 * shown instead, so the page never hands anyone a dead link.
 *
 * When the group is ready, paste the invite here, e.g.
 *   "https://chat.whatsapp.com/XXXXXXXXXXXXXXXXX"
 */
const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/Ethbpg4gOCh8G7rGjYj3it";

const SUMMIT_TITLE = "AI Creator Summit — Live with Rudra Sahu";
const SUMMIT_DETAILS =
  "3 hours, live on Zoom. Build an ad creative, an AI video, your AI avatar, " +
  "a brand jingle, a voice agent and an n8n automation. The Zoom link is shared " +
  "on WhatsApp before the session.";

/* ==========================================
   HELPERS
   ========================================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {
  // Nothing on this page is shown until the seat is known to be paid for.
  checkPayment().then((paid) => {
    if (!paid) return;

    // Anything the landing page could not deliver gets another attempt here.
    flushLeadQueue();
    trackLeadOnce();
    greetByName();
    renderDates();
    initGroupLink();
    initGroupPopup();
    initCalendarLinks();
    initCountdown();
    initScrollReveal();
  });
});

/* ==========================================
   PAYMENT GATE
   ========================================== */
/**
 * Decides whether this visitor actually has a seat.
 *
 * The answer comes from Cashfree by way of Apps Script, never from the
 * address bar — an "?order_id=" anyone can type is a claim, not a receipt.
 * Until that answer is "paid", the confirmation stays hidden and the group
 * invite is never handed over.
 */
function checkPayment() {
  const reveal = () => {
    document.body.classList.remove("payment-pending");
    return true;
  };

  if (typeof PAYMENT_ENABLED !== "undefined" && !PAYMENT_ENABLED) return Promise.resolve(reveal());

  const lead = readStoredLead();
  const orderId = currentOrderId();

  // No order and no registration behind it: a cold visit to the URL.
  if (!orderId) {
    if (!lead) {
      failGate(
        "Nothing to confirm here",
        "This page shows your seat after you register. Start from the summit page."
      );
    } else {
      failGate(
        "We could not find your payment",
        "Your registration is saved, but no completed payment is attached to it. Please try the payment again."
      );
    }
    return Promise.resolve(false);
  }

  // A confirmed payment is not re-checked on every reload.
  if (alreadyPaidLocally(orderId)) return Promise.resolve(reveal());

  return verifyPayment(orderId, lead || {}).then((res) => {
    if (res && res.paid) {
      markPaidLocally(orderId);
      return reveal();
    }

    if (res && res.error) {
      failGate(
        "We could not check your payment",
        "Something went wrong reaching the payment service. If money has left your account, contact us and we will sort it out — do not pay twice."
      );
    } else if (res && res.status === "ACTIVE") {
      failGate(
        "Your payment is not complete",
        "The order was created but never paid. Please try again."
      );
    } else {
      failGate(
        "That payment did not go through",
        "No money was taken. Please try again — the seat is only held once payment completes."
      );
    }
    return false;
  });
}

function readStoredLead() {
  try {
    const lead = JSON.parse(localStorage.getItem("creator_summit_lead") || "null");
    return lead && lead.name ? lead : null;
  } catch (err) {
    return null;
  }
}

function failGate(title, text) {
  const spinner = $("#pay-gate-spinner");
  const heading = $("#pay-gate-title");
  const body = $("#pay-gate-text");
  const actions = $("#pay-gate-actions");

  if (spinner) spinner.hidden = true;
  if (heading) heading.textContent = title;
  if (body) body.textContent = text;
  if (actions) actions.hidden = false;
}

/* ==========================================
   META PIXEL — LEAD CONVERSION
   ========================================== */
/**
 * Fires the Lead event for a real registration only.
 *
 * The base pixel in <head> already reports PageView on every visit. Firing
 * Lead unconditionally here would count anyone who opens this URL directly,
 * and would count again on every refresh — both of which teach Meta's
 * optimiser the wrong thing and inflate the reported conversion rate.
 *
 * So it fires only when a stored lead exists, and the lead's own timestamp
 * is recorded so a refresh cannot double-count while a genuinely new
 * registration still does.
 */
function trackLeadOnce() {
  if (typeof fbq !== "function") return;

  let lead = null;
  try {
    lead = JSON.parse(localStorage.getItem("creator_summit_lead") || "null");
  } catch (err) {
    return;
  }
  if (!lead || !lead.name) return;

  const marker = lead.timestamp || lead.phone || "1";
  try {
    if (localStorage.getItem("fb_lead_tracked") === marker) return;
    fbq("track", "Lead");
    localStorage.setItem("fb_lead_tracked", marker);
  } catch (err) {
    // Storage unavailable (private mode): still report the conversion once
    // for this page view rather than losing it entirely.
    fbq("track", "Lead");
  }
}

/* ==========================================
   PERSONALISATION
   ========================================== */
/**
 * The landing page stores the lead before redirecting here, so the
 * confirmation can greet the visitor by name. Everything degrades to a
 * generic greeting if that record is missing or unreadable.
 */
function greetByName() {
  const slot = $("#ty-name");
  if (!slot) return;

  let firstName = "";
  try {
    const raw = localStorage.getItem("creator_summit_lead");
    if (raw) {
      const name = (JSON.parse(raw).name || "").trim();
      firstName = name.split(/\s+/)[0] || "";
    }
  } catch (err) {
    firstName = "";
  }

  // Only use it if it looks like a name rather than pasted junk.
  if (firstName && firstName.length <= 20 && /^[\p{L}][\p{L}'.-]*$/u.test(firstName)) {
    slot.textContent = ", " + firstName;
  }
}

function renderDates() {
  const a = $("#ty-date");
  const b = $("#ty-date-2");
  if (a) a.textContent = SUMMIT_DATE_FULL;
  if (b) b.textContent = SUMMIT_DATE_SHORT;
  renderSummitDates();
}

/* ==========================================
   GROUP LINK
   ========================================== */
function initGroupLink() {
  const btn = $("#group-join-btn");
  const pending = $("#group-pending");
  if (!btn) return;

  const link = (WHATSAPP_GROUP_LINK || "").trim();

  if (!link) {
    // No link yet: make the button inert rather than pointing it at "#".
    btn.setAttribute("aria-disabled", "true");
    btn.classList.add("is-disabled");
    btn.removeAttribute("href");
    btn.addEventListener("click", (e) => e.preventDefault());
    if (pending) pending.hidden = false;
    return;
  }

  btn.href = link;
  if (pending) pending.hidden = true;
}

/* ==========================================
   GROUP JOIN POPUP
   ========================================== */
/**
 * Puts the group invite in front of the visitor instead of relying on them
 * scrolling to step 1. Joining is the only thing that gets them the Zoom
 * link, so it is worth interrupting for.
 *
 * Shown once per registration: dismissing it records the lead's own marker,
 * so a refresh does not nag, but a genuinely new registration sees it again.
 * Never shown when there is no group link configured, or on a direct visit
 * with no registration behind it.
 */
function initGroupPopup() {
  const popup = $("#group-popup");
  const link = (WHATSAPP_GROUP_LINK || "").trim();
  if (!popup || !link) return;

  let lead = null;
  try {
    lead = JSON.parse(localStorage.getItem("creator_summit_lead") || "null");
  } catch (err) {
    lead = null;
  }
  if (!lead || !lead.name) return;

  const marker = lead.timestamp || lead.phone || "1";
  try {
    if (localStorage.getItem("group_popup_dismissed") === marker) return;
  } catch (err) {
    // Storage unavailable; showing it is better than silently skipping it.
  }

  const btn = $("#group-popup-btn");
  if (btn) btn.href = link;

  const close = () => {
    popup.hidden = true;
    document.body.style.overflow = "";
    try {
      localStorage.setItem("group_popup_dismissed", marker);
    } catch (err) {
      // Nothing to do.
    }
  };

  const open = () => {
    popup.hidden = false;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog so screen readers announce it, but onto the
    // card rather than the button — focusing the button paints a focus ring
    // on it for a visitor who never touched the keyboard.
    const card = popup.querySelector(".ty-popup-card");
    if (card) card.focus();
  };

  $("#group-popup-close").addEventListener("click", close);
  $("#group-popup-later").addEventListener("click", close);
  popup.addEventListener("click", (e) => {
    if (e.target === popup) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !popup.hidden) close();
  });
  // Joining is the goal — once they tap through, stop showing it.
  if (btn) btn.addEventListener("click", close);

  // A short beat so the confirmation registers before the popup lands.
  setTimeout(open, 900);
}

/* ==========================================
   CALENDAR LINKS
   ========================================== */
function initCalendarLinks() {
  const start = SUMMIT_DATE;
  const end = new Date(start.getTime() + SUMMIT_DURATION_HOURS * 3600 * 1000);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const gcal = $("#gcal-link");
  if (gcal) {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: SUMMIT_TITLE,
      dates: `${stamp(start)}/${stamp(end)}`,
      details: SUMMIT_DETAILS,
      ctz: "Asia/Kolkata"
    });
    gcal.href = `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  const ics = $("#ics-link");
  if (ics) {
    // Folded to CRLF line endings, which is what the iCalendar spec expects.
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//AI Buddies//AI Creator Summit//EN",
      "BEGIN:VEVENT",
      `UID:ai-creator-summit-${stamp(start)}@aibuddies`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${SUMMIT_TITLE}`,
      `DESCRIPTION:${SUMMIT_DETAILS.replace(/,/g, "\\,")}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:AI Creator Summit starts in 1 hour",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    ics.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(lines.join("\r\n"));
  }
}

/* ==========================================
   COUNTDOWN
   ========================================== */
function initCountdown() {
  const root = $("#countdown");
  if (!root) return;

  const pad = (n) => String(n).padStart(2, "0");
  const set = (sel, val) => {
    const el = $(sel);
    if (el && el.textContent !== val) el.textContent = val;
  };

  // Declared before the first tick, which runs synchronously and may already
  // find the session started — see the same note in landing.js.
  let timer = null;

  const tick = () => {
    const remaining = SUMMIT_DATE.getTime() - Date.now();

    if (remaining <= 0) {
      root.classList.add("countdown-ended");
      if (timer) clearInterval(timer);
      return;
    }

    const total = Math.floor(remaining / 1000);
    set("#cd-days", pad(Math.floor(total / 86400)));
    set("#cd-hours", pad(Math.floor((total % 86400) / 3600)));
    set("#cd-mins", pad(Math.floor((total % 3600) / 60)));
    set("#cd-secs", pad(total % 60));
  };

  tick();
  timer = setInterval(tick, 1000);
}

/* ==========================================
   SCROLL REVEAL
   ========================================== */
function initScrollReveal() {
  const items = $$("[data-reveal]");
  if (!items.length) return;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  items.forEach((el) => observer.observe(el));

  requestAnimationFrame(() => {
    items.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-revealed");
    });
  });
}
