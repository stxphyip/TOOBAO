// js/systems/soundSystem.js

const BACKGROUND_MUSIC_SRC = "assets/sounds/backgroundmusic.mp3";

let backgroundMusic = null;
let backgroundMusicStarted = false;
let orderActionSoundsBound = false;
let backgroundMusicWatchdog = null;
let backgroundMusicWanted = false;

/* =============================
   GLOBAL AUDIO KILL SWITCH
============================= */

if (typeof window.__toobaoSoundStopVersion !== "number") {
  window.__toobaoSoundStopVersion = 0;
}

if (!window.__toobaoTrackedGameAudios) {
  window.__toobaoTrackedGameAudios = new Set();
}

const trackedGameAudios = window.__toobaoTrackedGameAudios;

/* =============================
   SHARED GAME AUDIO HELPERS
   Helps Safari/iPhone unlock sounds reliably
============================= */

const AUDIO_UNLOCK_SRCS = [
  "assets/sounds/buttonclick.mp3",
  "assets/sounds/newstar.mp3",
  "assets/sounds/fail2.mp3",
  "assets/mrbao_sounds/yayyougotastar3.mp3",
  "assets/mrbao_sounds/booyoulostastar3.mp3",
  "assets/sounds/daycomplete.mp3",
  "assets/sounds/win.mp3",
  "assets/sounds/fail.mp3",
  "assets/mrbao_sounds/day1complete3.mp3",
  "assets/mrbao_sounds/day2complete3.mp3",
  "assets/mrbao_sounds/congratsyouwon3.mp3",
  "assets/mrbao_sounds/uhohyoufailed3.mp3"
];

let sharedAudioUnlocked = false;
let sharedUnlockAudios = [];

export function registerGameAudio(audio) {
  if (!audio) return audio;

  trackedGameAudios.add(audio);

  if (window.__toobaoManagerAudioOnly && audio.id !== window.__toobaoManagerAllowedAudioId) {
    audio.muted = true;
  }

  return audio;
}

function warmSharedAudioUnlockPool() {
  if (sharedUnlockAudios.length) return;

  sharedUnlockAudios = AUDIO_UNLOCK_SRCS.map((src) => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = 0;
    audio.muted = false;
    registerGameAudio(audio);
    return audio;
  });
}

export function unlockSharedGameAudio() {
  if (sharedAudioUnlocked) return;
  if (window.__toobaoManagerAudioOnly) return;

  warmSharedAudioUnlockPool();

  sharedUnlockAudios.forEach((audio) => {
    try {
      audio.volume = 0;
      audio.muted = false;
      audio.currentTime = 0;

      const p = audio.play();

      if (p && typeof p.then === "function") {
        p.then(() => {
          audio.pause();
          audio.currentTime = 0;
          sharedAudioUnlocked = true;
        }).catch(() => {});
      }
    } catch {}
  });
}

/* =============================
   MANAGER AUDIO ONLY MODE
   Allows only #managerCautionAudio to play
============================= */

if (!window.__toobaoManagerAllowedAudioId) {
  window.__toobaoManagerAllowedAudioId = "managerCautionAudio";
}

if (typeof window.__toobaoManagerAudioOnly !== "boolean") {
  window.__toobaoManagerAudioOnly = false;
}

function isManagerAllowedAudio(audio) {
  return (
    window.__toobaoManagerAudioOnly &&
    audio &&
    audio.id === window.__toobaoManagerAllowedAudioId
  );
}

export function enableManagerAudioOnlyMode() {
  window.__toobaoManagerAudioOnly = true;
  window.__toobaoManagerAllowedAudioId = "managerCautionAudio";

  backgroundMusicWanted = false;
  backgroundMusicStarted = false;
  stopBackgroundMusicWatchdog();

  document.querySelectorAll("audio, video").forEach((media) => {
    try {
      if (isManagerAllowedAudio(media)) return;

      media.pause();
      media.currentTime = 0;
      media.muted = true;
    } catch (err) {
      console.warn("[Sound] Could not stop DOM media for manager mode:", err);
    }
  });

  trackedGameAudios.forEach((audio) => {
    try {
      if (isManagerAllowedAudio(audio)) return;

      audio.pause();
      audio.currentTime = 0;
      audio.muted = true;
    } catch (err) {
      console.warn("[Sound] Could not stop tracked audio for manager mode:", err);
    }
  });
}

export function disableManagerAudioOnlyMode() {
  window.__toobaoManagerAudioOnly = false;

  document.querySelectorAll("audio, video").forEach((media) => {
    try {
      media.muted = false;
    } catch (err) {
      console.warn("[Sound] Could not unmute DOM media:", err);
    }
  });

  trackedGameAudios.forEach((audio) => {
    try {
      audio.muted = false;
    } catch (err) {
      console.warn("[Sound] Could not unmute tracked audio:", err);
    }
  });
}

// Keep the original Audio constructor safely.
if (!window.__toobaoNativeAudio) {
  window.__toobaoNativeAudio = window.Audio;
}

const nativeAudio = window.__toobaoNativeAudio;

if (!window.__toobaoAudioTrackerInstalled) {
  window.__toobaoAudioTrackerInstalled = true;

  window.Audio = function TrackedAudio(src) {
    const audio = src === undefined ? new nativeAudio() : new nativeAudio(src);
    trackedGameAudios.add(audio);
    return audio;
  };

  window.Audio.prototype = nativeAudio.prototype;
}

if (!window.__toobaoManagerPlayGuardInstalled) {
  window.__toobaoManagerPlayGuardInstalled = true;

  const nativePlay = HTMLMediaElement.prototype.play;

  HTMLMediaElement.prototype.play = function guardedManagerPlay(...args) {
    trackedGameAudios.add(this);

    if (
      window.__toobaoManagerAudioOnly &&
      this.id !== window.__toobaoManagerAllowedAudioId
    ) {
      try {
        this.pause();
        this.currentTime = 0;
        this.muted = true;
      } catch (err) {
        console.warn("[Sound] Blocked non-manager audio:", err);
      }

      return Promise.resolve();
    }

    return nativePlay.apply(this, args);
  };
}



function getBackgroundMusic() {
  if (!backgroundMusic) {
    backgroundMusic = new Audio(BACKGROUND_MUSIC_SRC);
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.45; // adjust lower/higher if needed
  }

  return backgroundMusic;
}

function ensureBackgroundMusicPlaying() {
  if (!backgroundMusicWanted) return;
  if (document.hidden) return;

  const music = getBackgroundMusic();

  music.loop = true;
  music.muted = false;
  music.volume = 0.45;

  if (music.paused) {
    music.play().catch((err) => {
      console.warn("[Sound] Background music restart blocked:", err);
    });
  }
}

function startBackgroundMusicWatchdog() {
  if (backgroundMusicWatchdog) return;

  backgroundMusicWatchdog = setInterval(() => {
    ensureBackgroundMusicPlaying();
  }, 2000);
}

function stopBackgroundMusicWatchdog() {
  if (backgroundMusicWatchdog) {
    clearInterval(backgroundMusicWatchdog);
    backgroundMusicWatchdog = null;
  }
}
export function startBackgroundMusic() {
  if (window.__toobaoManagerAudioOnly) return;

  backgroundMusicWanted = true;

  const music = getBackgroundMusic();

  backgroundMusicStarted = true;
  music.loop = true;
  music.muted = false;
  music.volume = 0.45;

  const playPromise = music.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch((err) => {
      console.warn("[Sound] Background music could not play yet:", err);
    });
  }

  startBackgroundMusicWatchdog();
}

export function stopBackgroundMusic() {
  backgroundMusicWanted = false;
  backgroundMusicStarted = false;

  stopBackgroundMusicWatchdog();

  if (!backgroundMusic) return;

  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
}

export function pauseBackgroundMusic() {
  if (!backgroundMusic) return;
  backgroundMusic.pause();
}

function pauseBackgroundMusicForHide() {
  if (!backgroundMusic) return;

  // Keep these true so resumeBackgroundMusic() can restart it.
  if (backgroundMusicWanted || backgroundMusicStarted) {
    backgroundMusic.pause();
  }
}

export function resumeBackgroundMusic() {
  if (window.__toobaoManagerAudioOnly) return;
  if (!backgroundMusicWanted && !backgroundMusicStarted) return;

  backgroundMusicWanted = true;
  backgroundMusicStarted = true;

  ensureBackgroundMusicPlaying();
  startBackgroundMusicWatchdog();
}


/* =============================
   BUTTON CLICK SOUND
============================= */

const BUTTON_CLICK_SOUND_SRC = "assets/sounds/buttonclick.mp3";
const BUTTON_CLICK_POOL_SIZE = 4;

let buttonClickPool = [];
let buttonClickPoolIndex = 0;
let buttonClickBound = false;

function makeButtonClickAudio() {
  const audio = new Audio(BUTTON_CLICK_SOUND_SRC);
  audio.preload = "auto";
  audio.loop = false;
  audio.volume = 0.22;
  return registerGameAudio(audio);
}

function warmButtonClickPool() {
  if (buttonClickPool.length) return;

  for (let i = 0; i < BUTTON_CLICK_POOL_SIZE; i++) {
    buttonClickPool.push(makeButtonClickAudio());
  }
}

function getButtonClickAudioFromPool() {
  warmButtonClickPool();

  const audio = buttonClickPool[buttonClickPoolIndex];
  buttonClickPoolIndex = (buttonClickPoolIndex + 1) % buttonClickPool.length;

  return audio;
}

function stopButtonClickSound() {
  buttonClickPool.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  });
}

export function playButtonClickSound() {
  if (window.__toobaoManagerAudioOnly) return;

  const audio = getButtonClickAudioFromPool();

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.22;
    audio.muted = false;

    const playPromise = audio.play();

    // Important: do not create new Audio objects here.
    // On iPhone Safari, repeated fallback Audio objects can build up and cause lag.
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  } catch {}
}

function shouldSkipButtonClickSound(targetButton) {
  if (!targetButton) return true;

  if (targetButton.disabled) return true;
  if (targetButton.getAttribute("aria-disabled") === "true") return true;
  if (targetButton.dataset.noClickSound === "1") return true;

  if (targetButton.id === "boostViewsBtn") return true;
  if (targetButton.id === "liveHoldBtn") return true;

  if (targetButton.classList.contains("boostViewsBtn")) return true;
  if (targetButton.classList.contains("holdLivestreamBtn")) return true;
  if (targetButton.classList.contains("homeBoostViewsBtn")) return true;
  if (targetButton.classList.contains("liveHoldBtn")) return true;

  // Orders tabs can click.
  if (targetButton.classList.contains("ordersTabBtn")) return false;

  // Order action buttons have their own sounds.
  if (targetButton.classList.contains("orderPixelActionBtn")) return true;

  return false;
}

export function initButtonClickSound() {
  if (buttonClickBound) return;
  buttonClickBound = true;

  document.addEventListener(
  "pointerdown",
  () => {
    warmButtonClickPool();
    unlockSharedGameAudio();
  },
  { once: true, capture: true, passive: true }
);

  document.addEventListener(
    "pointerdown",
    (e) => {
      const button = e.target.closest("button");
      if (!button) return;
      if (shouldSkipButtonClickSound(button)) return;

      playButtonClickSound();
    },
    { capture: true, passive: true }
  );
}

/* =============================
   BOOST VIEWS SOUND
============================= */

const BOOST_VIEWS_SOUND_SRC = "assets/sounds/boostviews2.mp3";
const BOOST_VIEWS_SOUND_PLAY_MS = 3000;

let boostViewsAudio = null;
let boostViewsTimer = null;

function getBoostViewsAudio() {
  if (!boostViewsAudio) {
    boostViewsAudio = registerGameAudio(new Audio(BOOST_VIEWS_SOUND_SRC));
    boostViewsAudio.preload = "auto";
    boostViewsAudio.loop = false;
    boostViewsAudio.volume = 0.75;
  }

  return boostViewsAudio;
}

function stopBoostViewsSound() {
  if (boostViewsTimer) {
    clearTimeout(boostViewsTimer);
    boostViewsTimer = null;
  }

  if (!boostViewsAudio) return;

  boostViewsAudio.pause();
  boostViewsAudio.currentTime = 0;
}

export function playBoostViewsSound() {
  if (window.__toobaoManagerAudioOnly) return;
  const audio = getBoostViewsAudio();

  stopBoostViewsSound();

  audio.currentTime = 0;
  audio.volume = 0.75;

  audio.play().catch((err) => {
    console.warn("[Sound] Boost views sound blocked:", err);
  });

  boostViewsTimer = setTimeout(() => {
    stopBoostViewsSound();
  }, BOOST_VIEWS_SOUND_PLAY_MS);
}

/* =============================
   ORDER ACTION SOUNDS
============================= */

const PACK_SOUND_SRC = "assets/sounds/pack3.mp3";
const SHIP_SOUND_SRC = "assets/sounds/ship.mp3";
const COMPLETE_SOUND_SRC = "assets/sounds/collect.mp3";

const ORDER_ACTION_SOUND_PLAY_MS = 1200;

let packAudio = null;
let shipAudio = null;
let completeAudio = null;
let orderActionSoundTimer = null;

function makeOrderActionAudio(src, volume = 0.75) {
  const audio = registerGameAudio(new Audio(src));
  audio.preload = "auto";
  audio.loop = false;
  audio.volume = volume;
  return audio;
}

function getPackAudio() {
  if (!packAudio) packAudio = makeOrderActionAudio(PACK_SOUND_SRC, 0.75);
  return packAudio;
}

function getShipAudio() {
  if (!shipAudio) shipAudio = makeOrderActionAudio(SHIP_SOUND_SRC, 0.75);
  return shipAudio;
}

function getCompleteAudio() {
  if (!completeAudio) completeAudio = makeOrderActionAudio(COMPLETE_SOUND_SRC, 0.75);
  return completeAudio;
}

function stopOrderActionSounds() {
  if (orderActionSoundTimer) {
    clearTimeout(orderActionSoundTimer);
    orderActionSoundTimer = null;
  }

  [packAudio, shipAudio, completeAudio].forEach((audio) => {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  });
}

function playOrderActionAudio(audio, label = "order action") {
  stopOrderActionSounds();

  audio.currentTime = 0;
  audio.play().catch((err) => {
    console.warn(`[Sound] ${label} sound blocked:`, err);
  });

  orderActionSoundTimer = setTimeout(() => {
    stopOrderActionSounds();
  }, ORDER_ACTION_SOUND_PLAY_MS);
}

function getOrderActionType(button) {
  if (!button) return "";

  const img = button.querySelector("img");

  const text = [
    button.dataset.action,
    button.dataset.status,
    button.dataset.type,
    button.getAttribute("aria-label"),
    button.getAttribute("title"),
    img?.getAttribute("alt"),
    img?.getAttribute("src"),
    button.textContent
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("pack")) return "pack";
  if (text.includes("ship")) return "ship";

  // collect / complete / refund all use complete.mp3
  if (
    text.includes("collect") ||
    text.includes("complete") ||
    text.includes("revenue") ||
    text.includes("refund")
  ) {
    return "complete";
  }

  return "";
}

export function playOrderActionSound(button) {
  if (window.__toobaoManagerAudioOnly) return;
  const actionType = getOrderActionType(button);

  if (actionType === "pack") {
    playOrderActionAudio(getPackAudio(), "pack");
    return;
  }

  if (actionType === "ship") {
    playOrderActionAudio(getShipAudio(), "ship");
    return;
  }

  if (actionType === "complete") {
    playOrderActionAudio(getCompleteAudio(), "complete/refund");
  }
}

export function initOrderActionSounds() {
  if (orderActionSoundsBound) return;
  orderActionSoundsBound = true;

  document.addEventListener("pointerdown", (e) => {
    const button = e.target.closest(".orderPixelActionBtn");

    if (!button) return;
    if (button.disabled) return;
    if (button.getAttribute("aria-disabled") === "true") return;

    playOrderActionSound(button);
  });
}

/* =============================
   GLOBAL SOUND STOPPER
   Stops sound when phone app/browser is closed, hidden, or restored
============================= */

let globalSoundStopBound = false;

export function stopAllGameSounds(options = {}) {
  const {
    suppressMs = 1500,
    notifySystems = true,
    stopMusic = true
  } = options;

  window.__toobaoSoundStopVersion =
    (Number(window.__toobaoSoundStopVersion) || 0) + 1;

  window.__toobaoSuppressSoundsUntil = Date.now() + suppressMs;
  window.__toobaoSuppressPopupsUntil = Date.now() + suppressMs;

  if (stopMusic) {
  stopBackgroundMusic();
}

stopButtonClickSound();
stopBoostViewsSound();
stopOrderActionSounds();

trackedGameAudios.forEach((audio) => {
  try {
    if (isManagerAllowedAudio(audio)) return;
    if (!stopMusic && audio === backgroundMusic) return;

    audio.pause();
    audio.currentTime = 0;
  } catch (err) {
    console.warn("[Sound] Could not stop tracked audio:", err);
  }
});

document.querySelectorAll("audio, video").forEach((audio) => {
  try {
    if (isManagerAllowedAudio(audio)) return;
    if (!stopMusic && audio === backgroundMusic) return;

    audio.pause();
    audio.currentTime = 0;
  } catch (err) {
    console.warn("[Sound] Could not stop DOM media:", err);
  }
});

  if (notifySystems) {
    window.dispatchEvent(new CustomEvent("toobao:stopAllSounds"));
  }
}

export function resetSoundsForNewGame() {
  disableManagerAudioOnlyMode();

  stopAllGameSounds({
    suppressMs: 0,
    notifySystems: true,
    stopMusic: true
  });

  // Allow the new run's button sounds/background music immediately.
  window.__toobaoSuppressSoundsUntil = 0;
  window.__toobaoSuppressPopupsUntil = 0;
}

export function initGlobalSoundStopper() {
  if (globalSoundStopBound) return;
  globalSoundStopBound = true;

  document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Stop popups/toasts/button sounds, but only pause music so it can resume.
    stopAllGameSounds({
      suppressMs: 1500,
      notifySystems: true,
      stopMusic: false
    });

    pauseBackgroundMusicForHide();
  } else {
    setTimeout(() => {
      resumeBackgroundMusic();
    }, 500);
  }
});

  window.addEventListener("pagehide", () => {
  stopAllGameSounds({
    suppressMs: 1500,
    notifySystems: true,
    stopMusic: false
  });

  pauseBackgroundMusicForHide();
});

  window.addEventListener("beforeunload", () => {
    stopAllGameSounds({
      suppressMs: 1500,
      notifySystems: true,
      stopMusic: true
    });
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      stopAllGameSounds({
        suppressMs: 500,
        notifySystems: true,
        stopMusic: false
      });

      setTimeout(() => {
        resumeBackgroundMusic();
      }, 600);
    }
  });
}

