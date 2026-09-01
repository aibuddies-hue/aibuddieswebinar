/**
 * AI Creator Summit — Landing Page JS
 *
 * Sections below, in order:
 *   1. Config          2. Utilities        3. Hero VSL player
 *   4. Scroll reveal   5. Count-up stats   6. Sticky CTA + announcement bar
 *   7. Modal + 2-step form                 8. Exit intent
 *   9. Seats counter  10. FAQ accordion   11. Testimonial tabs
 *  12. Waveform audio
 */

/* ==========================================
   1. CONFIG
   ========================================== */

/**
 * The ONLY place the hero video source is set.
 *
 * The repo ships "assets/VSL Video.mp4" through Git LFS. Static hosts
 * (GitHub Pages included) serve the LFS *pointer file* rather than the
 * media, which is why the raw <video> tag rendered an unplayable box.
 *
 * Paste any of these and the player adapts automatically:
 *   - a YouTube URL  ->  privacy-mode embed
 *   - a Vimeo URL    ->  Vimeo embed
 *   - any .mp4 URL   ->  native <video> player
 *
 * If the source fails to load, the poster is replaced by a CTA instead of
 * a broken player, so the hero never becomes a dead end.
 */
const VSL_VIDEO_SRC = "https://youtu.be/qS9Ds9DQTR4";

/**
 * Summit start, in IST (+05:30). Drives the countdown timers.
 * Change this one value when the date moves.
 */
const SUMMIT_DATE = new Date("2026-09-06T11:00:00+05:30");

/**
 * Derived from SUMMIT_DATE rather than typed out, so the countdown and the
 * stored lead record can never disagree about the date.
 */
const SUMMIT_DATE_FULL = SUMMIT_DATE.toLocaleDateString("en-IN", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata"
});

/* ==========================================
   2. UTILITIES
   ========================================== */
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

document.addEventListener("DOMContentLoaded", () => {
  captureAttribution();
  flushLeadQueue();
  initVslPlayer();
  initScrollReveal();
  initCountUps();
  initCountdown();
  initStickyCta();
  initFloatingUi();
  initAnnouncementBar();
  initFormSteps();
  initSeatsCounter();
  initFaqs();
  initExitIntent();
});

/* ==========================================
   3. HERO VSL PLAYER (click-to-play facade)
   ========================================== */
function initVslPlayer() {
  const facade = $("#vsl-facade");
  if (!facade) return;

  const play = () => loadVslVideo(facade);
  facade.addEventListener("click", play);
  facade.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      play();
    }
  });
}

function parseVideoSource(src) {
  const yt = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { type: "youtube", id: yt[1] };

  const vimeo = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { type: "vimeo", id: vimeo[1] };

  return { type: "file", id: src };
}

function loadVslVideo(facade) {
  const container = facade.parentElement;
  const source = parseVideoSource(VSL_VIDEO_SRC);
  facade.classList.add("is-loading");

  if (source.type === "youtube" || source.type === "vimeo") {
    const url = source.type === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&rel=0&modestbranding=1`
      : `https://player.vimeo.com/video/${source.id}?autoplay=1`;

    const frame = document.createElement("iframe");
    frame.className = "hero-vsl-video";
    frame.src = url;
    frame.title = "AI Creator Summit intro video";
    frame.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.setAttribute("loading", "lazy");
    facade.replaceWith(frame);
    return;
  }

  const video = document.createElement("video");
  video.className = "hero-vsl-video";
  video.src = source.id;
  video.controls = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";

  // An LFS pointer (or any missing file) errors instead of playing —
  // swap in the fallback CTA rather than showing a dead player.
  video.addEventListener("error", () => showVslFallback(container, video), { once: true });

  facade.replaceWith(video);
  video.play().catch(() => {
    // Autoplay blocked is fine — controls are visible, visitor presses play.
  });
}

function showVslFallback(container, video) {
  if (video && video.parentElement) video.remove();
  const fallback = $("#vsl-unavailable", container);
  if (fallback) fallback.hidden = false;
  container.classList.add("vsl-failed");
}

/* ==========================================
   4. SCROLL REVEAL
   ========================================== */
function initScrollReveal() {
  const items = $$("[data-reveal]");
  if (!items.length) return;

  // No observer support, or the visitor asked for less motion: show everything.
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-revealed"));
    return;
  }

  // Siblings inside the same grid cascade instead of popping in together.
  items.forEach((el) => {
    const siblings = Array.from(el.parentElement.children).filter((c) => c.hasAttribute("data-reveal"));
    const index = siblings.indexOf(el);
    if (index > 0) el.style.transitionDelay = `${Math.min(index, 6) * 70}ms`;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  items.forEach((el) => observer.observe(el));

  // Anything already on screen at load reveals immediately.
  requestAnimationFrame(() => {
    items.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-revealed");
    });
  });
}

/* ==========================================
   5. COUNT-UP STATS
   ========================================== */
function initCountUps() {
  const targets = $$(".stat-num, .host-stat-item strong");
  if (!targets.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countUp(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  targets.forEach((el) => observer.observe(el));
}

/**
 * Animates the first number inside an element while leaving every other
 * character alone, so "₹10 Cr+" counts the 10 and keeps "₹" and " Cr+".
 */
function countUp(el) {
  const original = el.textContent;
  const match = original.match(/[\d,]*\d/);
  if (!match) return;

  const target = parseFloat(match[0].replace(/,/g, ""));
  if (!isFinite(target) || target <= 0) return;

  if (prefersReducedMotion) return;

  const before = original.slice(0, match.index);
  const after = original.slice(match.index + match[0].length);
  const grouped = match[0].includes(",");
  const duration = 1100;
  const start = performance.now();

  el.style.fontVariantNumeric = "tabular-nums";

  const frame = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(target * eased);
    el.textContent = before + (grouped ? value.toLocaleString("en-IN") : value) + after;
    if (progress < 1) requestAnimationFrame(frame);
    else el.textContent = original;
  };
  requestAnimationFrame(frame);
}

/* ==========================================
   5b. COUNTDOWN
   ========================================== */
function initCountdown() {
  const groups = [
    { d: "#cd-days",  h: "#cd-hours",  m: "#cd-mins",  s: "#cd-secs",  root: "#countdown" },
    { d: "#cd2-days", h: "#cd2-hours", m: "#cd2-mins", s: "#cd2-secs", root: "#countdown-scarcity" }
  ].filter((g) => $(g.root));

  if (!groups.length) return;

  const pad = (n) => String(n).padStart(2, "0");

  const tick = () => {
    const remaining = SUMMIT_DATE.getTime() - Date.now();

    // Past the start time the timer is meaningless — hide it rather than
    // showing a frozen or negative clock.
    if (remaining <= 0) {
      groups.forEach((g) => $(g.root).classList.add("countdown-ended"));
      clearInterval(timer);
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    groups.forEach((g) => {
      const set = (sel, val) => {
        const el = $(sel);
        if (el && el.textContent !== val) el.textContent = val;
      };
      set(g.d, pad(days));
      set(g.h, pad(hours));
      set(g.m, pad(mins));
      set(g.s, pad(secs));
    });
  };

  tick();
  const timer = setInterval(tick, 1000);
}

/* ==========================================
   6. STICKY CTA + ANNOUNCEMENT BAR
   ========================================== */
function initStickyCta() {
  const sticky = $("#sticky-cta");
  const heroCta = $(".hero-cta-wrapper");
  if (!sticky || !heroCta) return;

  const setVisible = (visible) => {
    sticky.classList.toggle("is-visible", visible);
    sticky.setAttribute("aria-hidden", visible ? "false" : "true");
  };

  // Deliberately a scroll-position check rather than an IntersectionObserver.
  // The hero CTA can start below the fold, and an observer only fires when
  // the intersection state *changes* — so a visitor who lands and immediately
  // flings past it goes from not-intersecting to not-intersecting and the bar
  // never appears. Comparing against its offset is exact at every position.
  let ticking = false;
  const update = () => {
    const passed = window.pageYOffset > heroCta.offsetTop + heroCta.offsetHeight;
    setVisible(passed);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  // Layout shifts (fonts, images) move the threshold, so recheck on resize.
  window.addEventListener("resize", update, { passive: true });
  update();
}

/**
 * Desktop seat badge and the WhatsApp shortcut both appear only after the
 * visitor has committed to reading, so the first screen stays clean.
 */
function initFloatingUi() {
  const seats = $("#floating-seats");
  const fab = $("#whatsapp-fab");
  if (!seats && !fab) return;

  let ticking = false;
  const update = () => {
    const show = window.pageYOffset > 700;
    if (seats) {
      seats.classList.toggle("is-visible", show);
      seats.setAttribute("aria-hidden", show ? "false" : "true");
    }
    if (fab) fab.classList.toggle("is-visible", show);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  update();
}

function initAnnouncementBar() {
  const bar = $("#announcement-bar");
  if (!bar) return;

  let lastY = window.pageYOffset;
  let ticking = false;

  const update = () => {
    const y = window.pageYOffset;
    // Reclaim the space while reading down; bring it back the moment
    // the visitor scrolls up (which is when they want the CTA again).
    if (y > 400 && y > lastY + 8) bar.classList.add("bar-hidden");
    else if (y < lastY - 8 || y < 200) bar.classList.remove("bar-hidden");
    lastY = y;
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
}

/* ==========================================
   7. MODAL + 2-STEP FORM
   ========================================== */
const modal = document.getElementById("registration-modal");
let lastFocusedElement = null;
let currentStep = 1;

function openModal() {
  if (!modal) return;
  lastFocusedElement = document.activeElement;
  modal.classList.add("active-modal");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    const field = $(`.form-step[data-step="${currentStep}"] input`, modal);
    if (field) field.focus();
  }, 260);
}

function closeModal() {
  if (!modal) return;
  modal.classList.remove("active-modal");
  document.body.style.overflow = "";
  if (lastFocusedElement) lastFocusedElement.focus();
}

if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (modal && modal.classList.contains("active-modal")) closeModal();
  const exit = document.getElementById("exit-modal");
  if (exit && exit.classList.contains("active-modal")) closeExitModal();
});

// Keep Tab inside the open dialog.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const openDialog = $(".modal-overlay.active-modal");
  if (!openDialog) return;

  const focusable = $$(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    openDialog
  ).filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

function initFormSteps() {
  // Phone field accepts digits only, so the visitor cannot type an
  // invalid character and discover it at submit time.
  const phone = document.getElementById("phone");
  if (phone) {
    phone.addEventListener("input", () => {
      phone.value = phone.value.replace(/\D/g, "").slice(0, 10);
      clearFieldError("phone");
    });
  }
  ["name", "email", "segment", "commitment"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => clearFieldError(id));
  });
}

function goToStep(step) {
  if (step === 2 && !validateStep(1)) return;

  currentStep = step;
  $$(".form-step", modal).forEach((s) => {
    s.classList.toggle("active-step", Number(s.dataset.step) === step);
  });

  const fill = $("#modal-progress-fill");
  if (fill) fill.style.width = step === 1 ? "50%" : "100%";
  const label = $("#modal-step-num");
  if (label) label.textContent = String(step);

  const field = $(`.form-step[data-step="${step}"] input, .form-step[data-step="${step}"] select`, modal);
  if (field) field.focus();
}

function setFieldError(id, message) {
  const box = document.getElementById("err-" + id);
  const field = document.getElementById(id);
  if (box) box.textContent = message;
  if (field) {
    field.classList.add("has-error");
    field.setAttribute("aria-invalid", "true");
  }
}

function clearFieldError(id) {
  const box = document.getElementById("err-" + id);
  const field = document.getElementById(id);
  if (box) box.textContent = "";
  if (field) {
    field.classList.remove("has-error");
    field.removeAttribute("aria-invalid");
  }
}

function validateStep(step) {
  let valid = true;
  const fail = (id, msg) => {
    setFieldError(id, msg);
    if (valid) {
      const el = document.getElementById(id);
      if (el) el.focus();
    }
    valid = false;
  };

  if (step === 1) {
    const name = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();

    clearFieldError("name");
    clearFieldError("phone");

    if (name.length < 2) fail("name", "Please enter your name.");
    // Indian mobile numbers start with 6-9 and are 10 digits long.
    if (!/^[6-9]\d{9}$/.test(phone)) {
      fail("phone", "Enter a valid 10-digit number, without +91 or a leading 0.");
    }
  }

  if (step === 2) {
    const email = document.getElementById("email").value.trim();
    const segment = document.getElementById("segment").value;
    const committed = document.getElementById("commitment").checked;

    ["email", "segment", "commitment"].forEach(clearFieldError);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail("email", "Please enter a valid email address.");
    if (!segment) fail("segment", "Please select what describes you best.");
    if (!committed) fail("commitment", "Please confirm you can attend all 3 hours.");
  }

  return valid;
}

function handleRegistration(event) {
  event.preventDefault();
  if (!validateStep(1)) return goToStep(1);
  if (!validateStep(2)) return;

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const segment = document.getElementById("segment").value;

  const submitBtn = document.getElementById("final-submit-btn");
  if (submitBtn) {
    submitBtn.classList.add("is-loading");
    submitBtn.disabled = true;
  }

  const leadData = Object.assign({
    id: newLeadId(),
    name: name,
    phone: "+91" + phone,
    email: email,
    segment: segment,
    summitDate: SUMMIT_DATE_FULL,
    timestamp: new Date().toISOString()
  }, readAttribution());

  // Written down before anything is sent, so a failed request or a closed
  // tab cannot lose the registration — it goes out on the next page load.
  queueLead(leadData);
  flushLeadQueue();

  localStorage.setItem("creator_summit_lead", JSON.stringify(leadData));
  localStorage.setItem("has_registered", "true");

  // Straight to the confirmation page. The registration no longer opens a
  // prefilled WhatsApp message on the way — the lead reaches the sheet, and
  // the one action asked of the visitor is joining the group.
  window.location.href = "thank-you.html";
}

/* ==========================================
   8. EXIT INTENT
   ========================================== */
const exitModal = document.getElementById("exit-modal");
let exitIntentTriggered = false;

function initExitIntent() {
  if (localStorage.getItem("has_registered") === "true" ||
      sessionStorage.getItem("exit_intent_shown") === "true") {
    return;
  }

  // Desktop: pointer leaves through the top of the viewport.
  document.addEventListener("mouseleave", (e) => {
    if (e.clientY < 20) triggerExitIntent();
  });

  // Mobile: a fast upward flick, which is how someone reaches for the back
  // button. Distance alone is not enough — scrolling back up to re-read a
  // paragraph is normal and must not be mistaken for leaving. A real flick
  // fires many scroll events in quick succession, so upward travel is
  // accumulated only while those events keep arriving; any pause or change
  // of direction resets it.
  let lastScrollTop = window.pageYOffset || 0;
  let lastScrollTime = performance.now();
  let upwardRun = 0;
  let engaged = false;

  window.addEventListener("scroll", () => {
    const st = window.pageYOffset || document.documentElement.scrollTop;
    const now = performance.now();
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const percent = scrollHeight > 0 ? (st / scrollHeight) * 100 : 0;

    if (percent > 30) engaged = true;

    const delta = lastScrollTop - st;
    const gap = now - lastScrollTime;

    if (delta > 0 && gap < 220) {
      upwardRun += delta;          // still inside one continuous upward gesture
    } else {
      upwardRun = delta > 0 ? delta : 0;
    }

    if (engaged && upwardRun > 260) triggerExitIntent();

    lastScrollTop = st <= 0 ? 0 : st;
    lastScrollTime = now;
  }, { passive: true });

  // Leaving for another tab or app is the clearest signal of all. Time on
  // page counts as engagement too — someone can read the hero for a while
  // without scrolling far.
  const openedAt = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    if (engaged || Date.now() - openedAt > 25000) triggerExitIntent();
  });

  // Last-resort timer. The old 45s version fired on engaged readers
  // mid-page, so it now waits until they have actually settled in.
  setTimeout(() => {
    if (localStorage.getItem("has_registered") !== "true") triggerExitIntent();
  }, 90000);
}

function triggerExitIntent() {
  if (!exitModal || exitIntentTriggered) return;
  // Never interrupt someone who is already filling the form.
  if (modal && modal.classList.contains("active-modal")) return;

  exitIntentTriggered = true;
  sessionStorage.setItem("exit_intent_shown", "true");
  exitModal.classList.add("active-modal");
  document.body.style.overflow = "hidden";
}

function closeExitModal() {
  if (!exitModal) return;
  exitModal.classList.remove("active-modal");
  document.body.style.overflow = "";
}

function triggerExitCta() {
  closeExitModal();
  openModal();
}

if (exitModal) {
  exitModal.addEventListener("click", (e) => {
    if (e.target === exitModal) closeExitModal();
  });
}

/* ==========================================
   9. SEATS COUNTER
   ========================================== */
/**
 * Seat count. Change SEATS_MIN / SEATS_MAX to move the number the page
 * shows — the stored range is saved alongside the count, so anyone still
 * carrying a value from an older range gets a fresh one instead of being
 * stuck on it. Without that, a returning visitor keeps whatever their
 * browser saved months ago and sees a number nobody else does.
 */
const SEATS_MIN = 88;
const SEATS_MAX = 97;
const SEATS_FLOOR = 4; // never tick below this, so it cannot reach zero

let seatsLeft = SEATS_MAX;

function initSeatsCounter() {
  const storedRange = localStorage.getItem("seats_range");
  const storedSeats = parseInt(localStorage.getItem("seats_left_count"), 10);
  const currentRange = `${SEATS_MIN}-${SEATS_MAX}`;

  const usable =
    storedRange === currentRange &&
    Number.isFinite(storedSeats) &&
    storedSeats <= SEATS_MAX &&
    storedSeats >= SEATS_FLOOR;

  if (usable) {
    seatsLeft = storedSeats;
  } else {
    seatsLeft = Math.floor(Math.random() * (SEATS_MAX - SEATS_MIN + 1)) + SEATS_MIN;
    localStorage.setItem("seats_left_count", seatsLeft.toString());
    localStorage.setItem("seats_range", currentRange);
  }

  updateSeatsUI(false);

  const tickCounter = () => {
    if (seatsLeft <= SEATS_FLOOR) return;

    if (Math.random() < 0.15) {
      seatsLeft -= 1;
      localStorage.setItem("seats_left_count", seatsLeft.toString());
      updateSeatsUI(true);
    }

    const nextInterval = Math.floor(Math.random() * (120000 - 45000 + 1)) + 45000;
    setTimeout(tickCounter, nextInterval);
  };

  setTimeout(tickCounter, 30000);
}

function updateSeatsUI(animate) {
  const reservedCount = 200 - seatsLeft;
  const banner = document.getElementById("seats-left-banner");
  const exit = document.getElementById("seats-left-exit");
  const sticky = document.getElementById("sticky-seats");
  const floating = document.getElementById("floating-seats-num");
  const bar = document.getElementById("bar-seats");

  // Every seat figure on the page reads from the same counter, so the
  // announcement bar can never contradict the banner or the sticky bar.
  if (banner) banner.textContent = seatsLeft;
  if (sticky) sticky.textContent = seatsLeft;
  if (floating) floating.textContent = seatsLeft;
  if (bar) bar.textContent = seatsLeft;
  if (exit) exit.textContent = reservedCount;

  // The CTA button subtexts carry the same figure. There are six of them, so
  // they are matched by class rather than given six ids.
  $$(".seats-count").forEach((el) => { el.textContent = seatsLeft; });

  // A silent number change goes unnoticed; flash it so the drop registers.
  if (animate && !prefersReducedMotion) {
    [banner, sticky, floating, bar].forEach((el) => {
      if (!el) return;
      el.classList.remove("seat-tick");
      void el.offsetWidth; // restart the animation
      el.classList.add("seat-tick");
    });
  }
}

/* ==========================================
   10. FAQ ACCORDION
   ========================================== */
function initFaqs() {
  // Answers stay collapsed until opened; heights are measured on demand
  // so long answers are never clipped by a fixed max-height.
  $$(".faq-question").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

function toggleFaq(button) {
  const item = button.parentElement;
  const answer = $(".faq-answer", item);
  const isOpen = item.classList.contains("active-faq");

  // One question open at a time keeps the list scannable.
  $$(".faq-item.active-faq").forEach((other) => {
    if (other === item) return;
    other.classList.remove("active-faq");
    const otherAnswer = $(".faq-answer", other);
    if (otherAnswer) otherAnswer.style.maxHeight = null;
    const otherBtn = $(".faq-question", other);
    if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
  });

  item.classList.toggle("active-faq", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
  if (answer) answer.style.maxHeight = isOpen ? null : answer.scrollHeight + "px";
}

/* ==========================================
   11. TESTIMONIAL TABS
   ========================================== */
function switchTestimonials(tabName) {
  const emotionBtn = document.getElementById("tab-emotion-btn");
  const resultsBtn = document.getElementById("tab-results-btn");
  const emotionTab = document.getElementById("tab-emotion");
  const resultsTab = document.getElementById("tab-results");
  if (!emotionBtn || !resultsBtn || !emotionTab || !resultsTab) return;

  const showEmotion = tabName === "emotion";

  emotionBtn.classList.toggle("active", showEmotion);
  resultsBtn.classList.toggle("active", !showEmotion);
  emotionBtn.setAttribute("aria-selected", String(showEmotion));
  resultsBtn.setAttribute("aria-selected", String(!showEmotion));

  emotionTab.classList.toggle("active-tab", showEmotion);
  resultsTab.classList.toggle("active-tab", !showEmotion);
}

/* ==========================================
   12. WAVEFORM AUDIO
   ========================================== */
let isPlayingWave = false;
let waveformAudio = null;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" + secs : secs}`;
}

function toggleWaveformSimulation() {
  const playOverlay = $(".waveform-play-overlay");
  const glowingBar = document.getElementById("waveform-playback-bar");
  const timerLabel = document.getElementById("waveform-timer");

  if (!waveformAudio) {
    waveformAudio = new Audio("assets/ai voice.mp3");

    waveformAudio.addEventListener("loadedmetadata", () => {
      if (timerLabel) timerLabel.textContent = formatTime(waveformAudio.duration);
    });

    waveformAudio.addEventListener("timeupdate", () => {
      if (!waveformAudio.duration) return;
      const progress = (waveformAudio.currentTime / waveformAudio.duration) * 100;
      if (glowingBar) glowingBar.style.width = `${progress}%`;
      const secondsLeft = Math.max(0, waveformAudio.duration - waveformAudio.currentTime);
      if (timerLabel) timerLabel.textContent = formatTime(secondsLeft);
    });

    waveformAudio.addEventListener("ended", stopWaveformSimulation);
  }

  if (!isPlayingWave) {
    isPlayingWave = true;
    if (playOverlay) playOverlay.classList.add("playing");
    waveformAudio.play().catch((err) => {
      console.log("Audio playback failed:", err);
      isPlayingWave = false;
      if (playOverlay) playOverlay.classList.remove("playing");
    });
  } else {
    waveformAudio.pause();
    isPlayingWave = false;
    if (playOverlay) playOverlay.classList.remove("playing");
  }
}

function stopWaveformSimulation() {
  isPlayingWave = false;
  const playOverlay = $(".waveform-play-overlay");
  const glowingBar = document.getElementById("waveform-playback-bar");
  const timerLabel = document.getElementById("waveform-timer");

  if (playOverlay) playOverlay.classList.remove("playing");
  if (glowingBar) glowingBar.style.width = "0%";

  if (waveformAudio) {
    waveformAudio.pause();
    waveformAudio.currentTime = 0;
    if (timerLabel) timerLabel.textContent = formatTime(waveformAudio.duration || 15);
  } else if (timerLabel) {
    timerLabel.textContent = "0:15";
  }
}
