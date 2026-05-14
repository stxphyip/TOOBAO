// js/utils.js

/* =============================
   STAR LEVEL POPUP + SOUNDS
============================= */

const NEW_STAR_SOUND_SRC = "assets/sounds/newstar.mp3";
const LOST_STAR_SOUND_SRC = "assets/sounds/fail2.mp3";

const MRBAO_SOUND_BASE = "assets/mrbao_sounds/";
const GOT_STAR_VOICE_SRC = `${MRBAO_SOUND_BASE}yayyougotastar3.mp3`;
const LOST_STAR_VOICE_SRC = `${MRBAO_SOUND_BASE}booyoulostastar3.mp3`;

const STAR_UP_MAIN_SOUND_PLAY_MS = 2000;
const STAR_DOWN_MAIN_SOUND_PLAY_MS = 1000;

const STAR_UP_VOICE_GAP_MS = 250;
const STAR_DOWN_VOICE_GAP_MS = 80;

const STAR_UP_VOICE_PLAY_MS = 2600;
const STAR_DOWN_VOICE_PLAY_MS = 2600;

const STAR_POPUP_END_BUFFER_MS = 700;


let starMainAudio = null;
let starVoiceAudio = null;
let starMainSoundTimer = null;
let starVoiceTimer = null;
let starPopupTimer = null;

function stopStarPopupSounds() {
  if (starMainSoundTimer) {
    clearTimeout(starMainSoundTimer);
    starMainSoundTimer = null;
  }

  if (starVoiceTimer) {
    clearTimeout(starVoiceTimer);
    starVoiceTimer = null;
  }

  if (starMainAudio) {
    starMainAudio.pause();
    starMainAudio.currentTime = 0;
  }

  if (starVoiceAudio) {
    starVoiceAudio.pause();
    starVoiceAudio.currentTime = 0;
  }
}

function playStarPopupSounds(mainSrc, voiceSrc, mainPlayMs, voicePlayMs, voiceGapMs) {
  stopStarPopupSounds();

  starMainAudio = new Audio(mainSrc);
  starMainAudio.preload = "auto";
  starMainAudio.loop = false;
  starMainAudio.volume = 0.85;
  starMainAudio.currentTime = 0;

  starMainAudio.play().catch((err) => {
    console.warn("[StarPopup] Main sound blocked:", err);
  });

  starMainSoundTimer = setTimeout(() => {
    if (starMainAudio) {
      starMainAudio.pause();
      starMainAudio.currentTime = 0;
    }
  }, mainPlayMs);

  starVoiceTimer = setTimeout(() => {
    starVoiceAudio = new Audio(voiceSrc);
    starVoiceAudio.preload = "auto";
    starVoiceAudio.loop = false;
    starVoiceAudio.volume = 1.0;
    starVoiceAudio.currentTime = 0;

    starVoiceAudio.play().catch((err) => {
      console.warn("[StarPopup] Mr. Bao voice blocked:", err);
    });

    starVoiceTimer = setTimeout(() => {
      if (starVoiceAudio) {
        starVoiceAudio.pause();
        starVoiceAudio.currentTime = 0;
      }
    }, voicePlayMs);
  }, mainPlayMs + voiceGapMs);
}

function removeStarPopup() {
  if (starPopupTimer) {
    clearTimeout(starPopupTimer);
    starPopupTimer = null;
  }

  const existing = document.getElementById("starLevelPopupOverlay");
  if (existing) existing.remove();

  window.__starLevelPopupOpen = false;

  stopStarPopupSounds();
}

function showStarLevelPopup(type, level) {
  removeStarPopup();
  window.__starLevelPopupOpen = true;

  const isUp = type === "up";

  const overlay = document.createElement("div");
  overlay.id = "starLevelPopupOverlay";
  overlay.className = `starLevelPopupOverlay ${isUp ? "is-star-up" : "is-star-down"}`;

  overlay.innerHTML = `
    <div class="starLevelPopupCard ${isUp ? "is-up" : "is-down"}">
      <div class="starLevelAnimWrap">
        <span class="starSparkle sparkle-1"></span>
        <span class="starSparkle sparkle-2"></span>
        <span class="starSparkle sparkle-3"></span>
        <span class="starSparkle sparkle-4"></span>
        <span class="starSparkle sparkle-5"></span>

        <img
          class="starLevelMainStar"
          src="${isUp ? "assets/toast/upstar.png" : "assets/toast/downstar.png"}"
          alt=""
        >
      </div>

      <div class="starLevelPopupText">
        ${isUp ? "YOU GOT A STAR!" : "YOU LOST A STAR!"}
      </div>

      <div class="starLevelPopupSubtext">
        ${isUp ? `NOW AT ${level} STARS` : `DOWN TO ${level} STARS`}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("is-showing");
  });

  const mainPlayMs = isUp
    ? STAR_UP_MAIN_SOUND_PLAY_MS
    : STAR_DOWN_MAIN_SOUND_PLAY_MS;

  const voicePlayMs = isUp
    ? STAR_UP_VOICE_PLAY_MS
    : STAR_DOWN_VOICE_PLAY_MS;

  const voiceGapMs = isUp
  ? STAR_UP_VOICE_GAP_MS
  : STAR_DOWN_VOICE_GAP_MS;

const totalPopupMs =
  mainPlayMs +
  voiceGapMs +
  voicePlayMs +
  STAR_POPUP_END_BUFFER_MS;

  playStarPopupSounds(
  isUp ? NEW_STAR_SOUND_SRC : LOST_STAR_SOUND_SRC,
  isUp ? GOT_STAR_VOICE_SRC : LOST_STAR_VOICE_SRC,
  mainPlayMs,
  voicePlayMs,
  voiceGapMs
);

  starPopupTimer = setTimeout(() => {
    overlay.classList.remove("is-showing");

    setTimeout(() => {
      overlay.remove();
      window.__starLevelPopupOpen = false;
      stopStarPopupSounds();
    }, 300);
  }, totalPopupMs);
}

/* =============================
   BASIC UTILS
============================= */

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function formatTime(secs) {
  const safeSecs = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(safeSecs / 60);
  const s = safeSecs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function stars(level) {
  const L = clamp(level, 1, 5);
  return `assets/ui_icons/${L}star${L > 1 ? "s" : ""}.png`;
}

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
}

/* =============================
   STORE LEVEL / FOLLOWERS
============================= */

/**
 * Store level is live and based on followers.
 * 0-499 followers = level 1
 * 500-999 followers = level 2
 * 1000-1499 followers = level 3
 * 1500-1999 followers = level 4
 * 2000+ followers = level 5
 */
export function syncStoreLevelFromFollowers(gameState) {
  const followers = Math.max(0, Number(gameState.followers) || 0);
  const oldLevel = Number(gameState.storeLevel) || 1;
  const nextLevel = clamp(1 + Math.floor(followers / 500), 1, 5);
  const changed = nextLevel !== oldLevel;

  gameState.storeLevel = nextLevel;

  if (!changed) {
    return false;
  }

  if (nextLevel > oldLevel) {
    showStarLevelPopup("up", nextLevel);
    return true;
  }

  if (nextLevel < oldLevel) {
    showStarLevelPopup("down", nextLevel);
    return true;
  }

  return false;
}

function ensureFollowerProgressState(gameState) {
  if (!gameState.messages) {
    gameState.messages = {
      threads: [],
      unreadTotal: 0,
      dailySpawned: 0,
      dayOfDailySpawned: gameState.day || 1,
      lastViewsCheckpoint: 0
    };
  }

  if (typeof gameState.messages.viewsEarnedForFollowerProgress !== "number") {
    gameState.messages.viewsEarnedForFollowerProgress = 0;
  }

  if (typeof gameState.messages.viewsConvertedCheckpoint !== "number") {
    gameState.messages.viewsConvertedCheckpoint = 0;
  }
}

/**
 * Every 50 earned views => 8 to 15 followers.
 * This is based on total earned views, not current visible views.
 */
export function awardFollowersFromViews(gameState) {
  ensureFollowerProgressState(gameState);

  let awarded = 0;
  const earned = Math.max(
    0,
    Number(gameState.messages.viewsEarnedForFollowerProgress) || 0
  );

  while (earned - gameState.messages.viewsConvertedCheckpoint >= 50) {
    const gain = randInt(8, 15);

    gameState.followers = Math.max(
      0,
      (Number(gameState.followers) || 0) + gain
    );

    gameState.messages.viewsConvertedCheckpoint += 50;
    awarded += gain;
  }

  if (awarded > 0) {
    syncStoreLevelFromFollowers(gameState);
  }

  return awarded;
}

/**
 * Add views and automatically convert earned views into followers.
 * Use this whenever the player GAINS views.
 */
export function addViewsAndConvertFollowers(gameState, amount) {
  ensureFollowerProgressState(gameState);

  const gain = Math.max(0, Number(amount) || 0);
  if (gain <= 0) return 0;

  gameState.views = Math.max(0, (Number(gameState.views) || 0) + gain);
  gameState.messages.viewsEarnedForFollowerProgress += gain;

  return awardFollowersFromViews(gameState);
}

/**
 * Remove views only from visible view count.
 * This does NOT undo follower conversion progress already earned.
 */
export function subtractViews(gameState, amount) {
  const loss = Math.max(0, Number(amount) || 0);
  if (loss <= 0) return;

  gameState.views = Math.max(0, (Number(gameState.views) || 0) - loss);
}

/* =============================
   PRESS-AND-HOLD STEPPER
============================= */

export function attachHoldRepeat(buttonEl, stepFn, options = {}) {
  const {
    startDelay = 350,
    repeatSpeed = 140
  } = options;

  let holdTimeout = null;
  let holdInterval = null;

  function stop() {
    if (holdTimeout) clearTimeout(holdTimeout);
    if (holdInterval) clearInterval(holdInterval);

    holdTimeout = null;
    holdInterval = null;
  }

  function start(e) {
    e.preventDefault();
    e.stopPropagation();

    if (buttonEl.disabled) return;

    // Prevent iPhone from selecting nearby number text
    buttonEl.blur?.();

    stop();
    stepFn();

    holdTimeout = setTimeout(() => {
      holdInterval = setInterval(() => {
        stepFn();
      }, repeatSpeed);
    }, startDelay);
  }

  function blockDefault(e) {
    e.preventDefault();
  }

  buttonEl.addEventListener("pointerdown", start);
  buttonEl.addEventListener("pointerup", stop);
  buttonEl.addEventListener("pointercancel", stop);
  buttonEl.addEventListener("pointerleave", stop);

  // Extra iPhone long-press protection
  buttonEl.addEventListener("contextmenu", blockDefault);
  buttonEl.addEventListener("selectstart", blockDefault);
  buttonEl.addEventListener("dragstart", blockDefault);
  buttonEl.addEventListener("touchstart", blockDefault, { passive: false });

  window.addEventListener("blur", stop);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
}

window.addEventListener("toobao:stopAllSounds", () => {
  removeStarPopup();
});