/**
 * When the summit is — worked out, not typed in.
 *
 * Loaded before landing.js and thank-you.js on both pages, so the countdown,
 * the visible dates, the calendar links and the date stored with every lead
 * all read the same value and can never drift apart.
 *
 * The session runs every Sunday at 11:00 AM IST. Rather than editing a date
 * every week, the page works out the coming Sunday itself: it shows the
 * current Sunday all through that day, and from midnight IST — so, the early
 * hours of Monday — it has already moved to the next one.
 */

/* ==========================================
   THE ONLY TWO THINGS YOU EVER CHANGE
   ========================================== */

/**
 * Pin one specific date, e.g. to skip a week or run a special edition.
 *
 *   const SUMMIT_DATE_OVERRIDE = "2026-10-04";
 *
 * While this holds a date the page stops rolling forward and shows exactly
 * that day. Set it back to "" and the weekly rhythm resumes on its own.
 */
const SUMMIT_DATE_OVERRIDE = "";

/** Start time and length, in IST. */
const SUMMIT_HOUR_IST = 11;
const SUMMIT_MINUTE_IST = 0;
const SUMMIT_DURATION_HOURS = 3;

/* ==========================================
   WORKING IT OUT
   ========================================== */

/**
 * India has no daylight saving, so IST is a flat +05:30 the year round and
 * a fixed offset is safe here. Shifting the clock by that amount and then
 * reading the UTC fields is how we ask "what day is it in India right now"
 * without depending on the visitor's own timezone — someone opening the page
 * from Dubai or Toronto must see the same Sunday an Indian visitor sees.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function nextSummitDate() {
  const pinned = (SUMMIT_DATE_OVERRIDE || "").trim();
  if (pinned) {
    const fixed = new Date(pinned + "T" + pad2(SUMMIT_HOUR_IST) + ":" + pad2(SUMMIT_MINUTE_IST) + ":00+05:30");
    // A typo in the override must not leave the page with an unusable date.
    if (!isNaN(fixed.getTime())) return fixed;
  }

  const nowInIst = new Date(Date.now() + IST_OFFSET_MS);

  // 0 is Sunday. On a Sunday this is 0, so today's session stays on show
  // until midnight; every other day counts forward to the coming Sunday.
  const daysAhead = (7 - nowInIst.getUTCDay()) % 7;

  // Date.UTC rolls over month and year ends on its own, so adding days to
  // the 30th of a month needs no special handling.
  return new Date(Date.UTC(
    nowInIst.getUTCFullYear(),
    nowInIst.getUTCMonth(),
    nowInIst.getUTCDate() + daysAhead,
    SUMMIT_HOUR_IST,
    SUMMIT_MINUTE_IST,
    0
  ) - IST_OFFSET_MS);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/* ==========================================
   WHAT THE PAGES USE
   ========================================== */

const SUMMIT_DATE = nextSummitDate();

/** "Sunday 13 September, 2026" — stored with the lead and shown in full. */
const SUMMIT_DATE_FULL = SUMMIT_DATE.toLocaleDateString("en-IN", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata"
});

/** "Sunday 13 September" */
const SUMMIT_DATE_SHORT = SUMMIT_DATE.toLocaleDateString("en-IN", {
  weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata"
});

/** "13 September" */
const SUMMIT_DATE_DAY_MONTH = SUMMIT_DATE.toLocaleDateString("en-IN", {
  day: "numeric", month: "long", timeZone: "Asia/Kolkata"
});

/**
 * Fills every date printed in the markup.
 *
 * The HTML still carries a readable date so the page is never blank, but
 * these overwrite it — otherwise the copy would go stale the moment the
 * session rolls forward while the countdown beside it moved on.
 */
function renderSummitDates() {
  const write = (selector, value) => {
    Array.prototype.forEach.call(document.querySelectorAll(selector), (el) => {
      el.textContent = value;
    });
  };
  write(".js-date-full", SUMMIT_DATE_FULL);
  write(".js-date-short", SUMMIT_DATE_SHORT);
  write(".js-date-daymonth", SUMMIT_DATE_DAY_MONTH);
}
