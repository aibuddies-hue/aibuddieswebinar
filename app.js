/**
 * AI Creator Summit - Landing Page v2 JS logic
 */

// Initialize configurations when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  initFaqs();
  initSeatsCounter();
  initExitIntent();
});

/* ==========================================
   MODAL WINDOW CONTROLS
   ========================================== */
const modal = document.getElementById("registration-modal");

function openModal() {
  if (modal) {
    modal.classList.add("active-modal");
    document.body.style.overflow = "hidden"; // Prevent background scroll
  }
}

function closeModal() {
  if (modal) {
    modal.classList.remove("active-modal");
    document.body.style.overflow = ""; // Re-enable background scroll
  }
}

// Close modal if user clicks backdrop
if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

/* ==========================================
   FORM SUBMISSION & VALIDATION
   ========================================== */
function handleRegistration(event) {
  event.preventDefault();

  const nameInput = document.getElementById("name");
  const phoneInput = document.getElementById("phone");
  const emailInput = document.getElementById("email");
  const segmentSelect = document.getElementById("segment");
  const commitmentCheck = document.getElementById("commitment");

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  const segment = segmentSelect.value;
  const committed = commitmentCheck.checked;

  // Basic validation checks
  if (!name || !phone || !email || !segment || !committed) {
    alert("Please fill all required fields and accept the attendance commitment.");
    return;
  }

  // 10-digit Indian mobile validation
  const phoneRegex = /^[6789]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    alert("Please enter a valid 10-digit Indian WhatsApp number (without country code or leading 0).");
    return;
  }

  // Prepare registration data (e.g. for potential n8n webhook)
  const leadData = {
    name: name,
    phone: "+91" + phone,
    email: email,
    segment: segment,
    summitDate: "Sunday 16 August 2026",
    timestamp: new Date().toISOString()
  };

  console.log("Saving lead to CRM...", leadData);

  // Store in localStorage to verify lead capture state
  localStorage.setItem("creator_summit_lead", JSON.stringify(leadData));
  localStorage.setItem("has_registered", "true");

  // Format pre-filled WhatsApp text for instant registration confirmation via AiSensy
  const messageText = `Hi Rudra! I have completed my registration for the AI Creator Summit on Sunday, 16 August.\n\n*My Details:*\n- Name: ${name}\n- Email: ${email}\n- Segment: ${segment}\n\nLooking forward to the live builds!`;
  const encText = encodeURIComponent(messageText);
  const whatsappUrl = `https://wa.me/919516194751?text=${encText}`;

  // Redirect to WhatsApp confirmation link
  window.location.href = whatsappUrl;
}

/* ==========================================
   EXIT-INTENT DETECTION (Desktop & Mobile)
   ========================================== */
const exitModal = document.getElementById("exit-modal");
let exitIntentTriggered = false;

function initExitIntent() {
  // Check if they already registered or saw the modal in this session
  if (localStorage.getItem("has_registered") === "true" || sessionStorage.getItem("exit_intent_shown") === "true") {
    return;
  }

  // Desktop trigger: Mouse leaves top viewport
  document.addEventListener("mouseleave", (e) => {
    if (e.clientY < 20 && !exitIntentTriggered) {
      triggerExitIntent();
    }
  });

  // Mobile trigger fallback: After 45 seconds or back-scroll detection
  let lastScrollTop = 0;
  let scrollThresholdTriggered = false;

  window.addEventListener("scroll", () => {
    let st = window.pageYOffset || document.documentElement.scrollTop;
    let scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    let scrollPercentage = (st / scrollHeight) * 100;

    // If they scrolled past 50% and are scrolling back up fast
    if (scrollPercentage > 50) {
      scrollThresholdTriggered = true;
    }

    if (scrollThresholdTriggered && st < lastScrollTop - 40 && !exitIntentTriggered) {
      triggerExitIntent();
    }
    lastScrollTop = st <= 0 ? 0 : st;
  }, { passive: true });

  // Time-out fallback: pop up exit-intent modal after 45 seconds of page interaction
  setTimeout(() => {
    if (!exitIntentTriggered && localStorage.getItem("has_registered") !== "true") {
      triggerExitIntent();
    }
  }, 45000);
}

function triggerExitIntent() {
  if (exitModal) {
    exitIntentTriggered = true;
    sessionStorage.setItem("exit_intent_shown", "true");
    exitModal.classList.add("active-modal");
    document.body.style.overflow = "hidden";
  }
}

function closeExitModal() {
  if (exitModal) {
    exitModal.classList.remove("active-modal");
    document.body.style.overflow = "";
  }
}

function triggerExitCta() {
  closeExitModal();
  openModal();
}

/* ==========================================
   DYNAMIC SEATS COUNTER & SCARCITY
   ========================================== */
let seatsLeft = 33; // Default starting remaining seats

function initSeatsCounter() {
  // Pull seats count from localStorage if visitor returns, otherwise generate a realistic count
  const storedSeats = localStorage.getItem("seats_left_count");
  if (storedSeats) {
    seatsLeft = parseInt(storedSeats, 10);
  } else {
    // Randomize starting seats between 27 and 39
    seatsLeft = Math.floor(Math.random() * (39 - 27 + 1)) + 27;
    localStorage.setItem("seats_left_count", seatsLeft.toString());
  }

  updateSeatsUI();

  // Slow ticks every 2 to 4 minutes to simulate real live bookings
  const tickCounter = () => {
    // Stop counting down if we hit 4 remaining seats (so seats don't hit 0)
    if (seatsLeft <= 4) return;

    // 15% chance to decrease seats by 1
    if (Math.random() < 0.15) {
      seatsLeft -= 1;
      localStorage.setItem("seats_left_count", seatsLeft.toString());
      updateSeatsUI();
    }
    
    // Set next check interval (random between 45s and 120s)
    const nextInterval = Math.floor(Math.random() * (120000 - 45000 + 1)) + 45000;
    setTimeout(tickCounter, nextInterval);
  };

  // Run the background ticks
  setTimeout(tickCounter, 30000);
}

function updateSeatsUI() {
  const seatsBanner = document.getElementById("seats-left-banner");
  const seatsExit = document.getElementById("seats-left-exit");

  const reservedCount = 200 - seatsLeft;

  if (seatsBanner) seatsBanner.textContent = seatsLeft;
  if (seatsExit) seatsExit.textContent = reservedCount;
}

/* ==========================================
   INTERACTIVE ACCORDION (FAQ)
   ========================================== */
function initFaqs() {
  // Answers are collapsed by default in style sheet
}

function toggleFaq(button) {
  const faqItem = button.parentElement;
  
  // Toggle current FAQ
  faqItem.classList.toggle("active-faq");
}

/* ==========================================
   TESTIMONIALS TABS
   ========================================== */
function switchTestimonials(tabName) {
  const tabEmotionBtn = document.getElementById("tab-emotion-btn");
  const tabResultsBtn = document.getElementById("tab-results-btn");
  const tabEmotionContent = document.getElementById("tab-emotion");
  const tabResultsContent = document.getElementById("tab-results");

  if (tabName === "emotion") {
    tabEmotionBtn.classList.add("active");
    tabResultsBtn.classList.remove("active");
    tabEmotionContent.classList.add("active-tab");
    tabResultsContent.classList.remove("active-tab");
  } else {
    tabResultsBtn.classList.add("active");
    tabEmotionBtn.classList.remove("active");
    tabResultsContent.classList.add("active-tab");
    tabEmotionContent.classList.remove("active-tab");
  }
}

/* ==========================================
   WAVEFORM AUDIO SIMULATION (Section 4)
   ========================================== */
let isPlayingWave = false;
let waveformAudio = null;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' + secs : secs}`;
}

function toggleWaveformSimulation() {
  const playOverlay = document.querySelector(".waveform-play-overlay");
  const glowingBar = document.getElementById("waveform-playback-bar");
  const timerLabel = document.getElementById("waveform-timer");

  if (!waveformAudio) {
    waveformAudio = new Audio("assets/ai voice.mp3");
    
    waveformAudio.addEventListener("loadedmetadata", () => {
      timerLabel.textContent = formatTime(waveformAudio.duration);
    });

    waveformAudio.addEventListener("timeupdate", () => {
      if (waveformAudio.duration) {
        const progress = (waveformAudio.currentTime / waveformAudio.duration) * 100;
        glowingBar.style.width = `${progress}%`;
        
        const secondsLeft = Math.max(0, waveformAudio.duration - waveformAudio.currentTime);
        timerLabel.textContent = formatTime(secondsLeft);
      }
    });

    waveformAudio.addEventListener("ended", () => {
      stopWaveformSimulation();
    });
  }

  if (!isPlayingWave) {
    isPlayingWave = true;
    if (playOverlay) playOverlay.classList.add("playing");
    waveformAudio.play().catch(err => {
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
  const playOverlay = document.querySelector(".waveform-play-overlay");
  const glowingBar = document.getElementById("waveform-playback-bar");
  const timerLabel = document.getElementById("waveform-timer");

  if (playOverlay) playOverlay.classList.remove("playing");
  if (glowingBar) glowingBar.style.width = "0%";
  
  if (waveformAudio) {
    waveformAudio.pause();
    waveformAudio.currentTime = 0;
    timerLabel.textContent = formatTime(waveformAudio.duration || 15);
  } else {
    timerLabel.textContent = "0:15";
  }
}
