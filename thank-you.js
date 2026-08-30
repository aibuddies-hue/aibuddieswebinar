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
const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/HOxDGMPW4yECCh4S5fBhXw";

/** Summit start, in IST. Keep this in step with SUMMIT_DATE in landing.js. */
const SUMMIT_DATE = new Date("2026-09-06T11:00:00+05:30");
const SUMMIT_DURATION_HOURS = 3;

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
  greetByName();
  renderDates();
  initGroupLink();
  initConfirmFallback();
  initCalendarLinks();
  initCountdown();
  initScrollReveal();
});

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
  const full = SUMMIT_DATE.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata"
  });
  const short = SUMMIT_DATE.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata"
  });

  const a = $("#ty-date");
  const b = $("#ty-date-2");
  if (a) a.textContent = full;
  if (b) b.textContent = short;
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
   CONFIRMATION FALLBACK
   ========================================== */
/**
 * The landing page opens the WhatsApp confirmation in a new tab on submit.
 * If that tab was blocked, or the visitor closed it, this rebuilds the same
 * prefilled message from the stored lead so the registration is not lost.
 * Hidden entirely when there is no stored lead to rebuild it from.
 */
function initConfirmFallback() {
  const wrap = $("#confirm-fallback");
  const link = $("#confirm-link");
  if (!wrap || !link) return;

  let lead = null;
  try {
    lead = JSON.parse(localStorage.getItem("creator_summit_lead") || "null");
  } catch (err) {
    lead = null;
  }
  if (!lead || !lead.name) return;

  const short = SUMMIT_DATE.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata"
  });

  const message =
    `Hi Rudra! I have completed my registration for the AI Creator Summit on ${short}.` +
    `\n\n*My Details:*\n- Name: ${lead.name}\n- Email: ${lead.email || ""}` +
    `\n- Segment: ${lead.segment || ""}\n\nLooking forward to the live builds!`;

  link.href = `https://wa.me/919516194751?text=${encodeURIComponent(message)}`;
  wrap.hidden = false;
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

  const tick = () => {
    const remaining = SUMMIT_DATE.getTime() - Date.now();

    if (remaining <= 0) {
      root.classList.add("countdown-ended");
      clearInterval(timer);
      return;
    }

    const total = Math.floor(remaining / 1000);
    set("#cd-days", pad(Math.floor(total / 86400)));
    set("#cd-hours", pad(Math.floor((total % 86400) / 3600)));
    set("#cd-mins", pad(Math.floor((total % 3600) / 60)));
    set("#cd-secs", pad(total % 60));
  };

  tick();
  const timer = setInterval(tick, 1000);
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
