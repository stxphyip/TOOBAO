// js/systems/toast.js

import { el } from "../dom.js";
import { gameState } from "../state.js";

const DEFAULT_AVATAR = "assets/toast/mrbaoavatar.png";

const TOAST_ICONS = {
  order: "assets/ui_nav/orders_icon.png",
  chat: "assets/ui_nav/chat_icon.png",
  storage: "assets/ui_nav/storage_icon.png",
  marketing: "assets/ui_nav/livestream_icon.png",
  shipping: "assets/ui_icons/shippingbox_icon.png",
  upstar: "assets/toast/upstar.png",
  downstar: "assets/toast/downstar.png",
  fivestar: "assets/toast/5starscondensed.png",
  followers: "assets/ui_icons/followers_icon.png",
  views: "assets/ui_icons/views_icon.png"
};

const TOAST_SOUND_SRC = "assets/sounds/toast.mp3";
const TOAST_SOUND_PLAY_MS = 2000;
const TOAST_SOUND_START_SEC = 0;

let toastSoundAudio = null;
let toastSoundTimer = null;
let toastSoundUnlocked = false;

function soundsAreSuppressed() {
  return Date.now() < (Number(window.__toobaoSuppressSoundsUntil) || 0);
}

function ensureToastState() {
  if (!gameState.algo) {
    gameState.algo = {
      queue: [],
      timer: null
    };
  }

  if (!Array.isArray(gameState.algo.queue)) {
    gameState.algo.queue = [];
  }

  if (typeof gameState.algo.timer === "undefined") {
    gameState.algo.timer = null;
  }
}

function isDayOverlayOpen() {
  const dayOverlay = document.getElementById("dayOverlay");
  return !!dayOverlay && !dayOverlay.classList.contains("hidden");
}

/* =============================
   TOAST SOUND
============================= */

function getToastSoundAudio() {
  if (!toastSoundAudio) {
    toastSoundAudio = new Audio(TOAST_SOUND_SRC);
    toastSoundAudio.preload = "auto";
    toastSoundAudio.loop = false;
    toastSoundAudio.volume = 0.45;
  }

  return toastSoundAudio;
}

function unlockToastSoundOnce() {
  if (toastSoundUnlocked) return;
  if (soundsAreSuppressed()) return;

  const audio = getToastSoundAudio();

  audio.volume = 0;
  audio.currentTime = 0;

  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = TOAST_SOUND_START_SEC;
      audio.volume = 0.45;
      toastSoundUnlocked = true;
    })
    .catch(() => {
      audio.volume = 0.45;
    });
}

document.addEventListener(
  "pointerdown",
  () => {
    unlockToastSoundOnce();
  },
  { once: true }
);

function stopToastSound() {
  if (toastSoundTimer) {
    clearTimeout(toastSoundTimer);
    toastSoundTimer = null;
  }

  if (!toastSoundAudio) return;

  toastSoundAudio.pause();
  toastSoundAudio.currentTime = TOAST_SOUND_START_SEC;
}

function playToastSound() {
  stopToastSound();

  if (soundsAreSuppressed()) return;

  const audio = getToastSoundAudio();

  audio.volume = 0.45;
  audio.currentTime = TOAST_SOUND_START_SEC;

  audio.play().catch((err) => {
    console.warn("[Toast] Toast sound blocked:", err);
  });

  toastSoundTimer = setTimeout(() => {
    stopToastSound();
  }, TOAST_SOUND_PLAY_MS);
}

/* =============================
   TOAST ICONS / TEXT
============================= */

function iconForType(type) {
  return TOAST_ICONS[type] || "";
}

function renderToastMessage(msg, iconType, endIconType) {
  const iconSrc = iconForType(iconType);

  let iconClass = "toastInlineIcon";

  if (iconType === "upstar" || iconType === "downstar") {
    iconClass = "toastInlineIconMedium";
  }

  if (iconType === "fivestar") {
    iconClass = "toastInlineIconLarge";
  }

  if (iconType === "views" || iconType === "followers") {
    iconClass = "toastInlineIconSmall";
  }

  const startIconHTML = iconSrc
    ? `<img class="${iconClass}" src="${iconSrc}" alt="">`
    : "";

  let finalMsg = String(msg || "").toUpperCase();

  if (endIconType === "views_followers") {
    finalMsg = finalMsg
      .replace(
        /VIEWS/g,
        `VIEWS <img class="toastInlineIconEnd" src="${TOAST_ICONS.views}" alt="">`
      )
      .replace(
        /FOLLOWERS/g,
        `FOLLOWERS <img class="toastInlineIconEnd" src="${TOAST_ICONS.followers}" alt="">`
      );
  } else if (endIconType) {
    const endIconSrc = iconForType(endIconType);

    if (endIconSrc) {
      finalMsg += ` <img class="toastInlineIconEnd" src="${endIconSrc}" alt="">`;
    }
  }

  if (el.algoToastText) {
    el.algoToastText.innerHTML = `
      ${startIconHTML}
      ${finalMsg}
    `;
  }
}

/* =============================
   TOAST DISPLAY
============================= */

function hideToastNow() {
  if (!el.algoToast) return;
  ensureToastState();

  stopToastSound();

  if (gameState.algo.timer) {
    clearTimeout(gameState.algo.timer);
    gameState.algo.timer = null;
  }

  el.algoToast.classList.remove("toast-show");

  setTimeout(() => {
    el.algoToast.classList.add("hidden");
    flushQueue();
  }, 300);
}

function flushQueue() {
  ensureToastState();

  // Do not show or play toasts during day summary / game-over overlays
  if (isDayOverlayOpen() || gameState.ended || !gameState.running) {
    clearAlgoToasts();
    return;
  }

  if (gameState.algo.timer) return;

  const next = gameState.algo.queue.shift();
  if (!next) return;

  const { msg, avatarSrc, duration, iconType, endIconType } = next;

  if (!el.algoToast || !el.algoToastText) return;

  renderToastMessage(msg, iconType, endIconType);

  if (el.algoToastAvatar) {
    el.algoToastAvatar.src = avatarSrc || DEFAULT_AVATAR;
  }

  el.algoToast.classList.remove("hidden");

  playToastSound();

  requestAnimationFrame(() => {
    el.algoToast.classList.add("toast-show");
  });

  gameState.algo.timer = setTimeout(() => {
    el.algoToast.classList.remove("toast-show");

    setTimeout(() => {
      el.algoToast.classList.add("hidden");
      gameState.algo.timer = null;
      stopToastSound();
      flushQueue();
    }, 300);
  }, duration || 3600);
}

/* =============================
   EXPORTS
============================= */

export function initToast() {
  if (!el.algoToast) return;

  ensureToastState();

  el.algoToast.classList.add("hidden");

  if (el.closeAlgoToastBtn && !el.closeAlgoToastBtn.dataset.bound) {
    el.closeAlgoToastBtn.dataset.bound = "1";

    el.closeAlgoToastBtn.addEventListener("click", (e) => {
      e.preventDefault();
      hideToastNow();
    });
  }
}

export function clearAlgoToasts() {
  ensureToastState();

  // Stop toast sound immediately
  stopToastSound();

  // Clear active toast timer
  if (gameState.algo.timer) {
    clearTimeout(gameState.algo.timer);
    gameState.algo.timer = null;
  }

  // Clear waiting toasts
  gameState.algo.queue = [];

  // Hide toast UI
  if (el.algoToast) {
    el.algoToast.classList.remove("toast-show");
    el.algoToast.classList.add("hidden");
  }

  if (el.algoToastText) {
    el.algoToastText.innerHTML = "";
  }
}

export function showAlgoToast(
  msg,
  senderName = "MR. BAO",
  avatarSrc = null,
  duration = 3600,
  iconType = null,
  endIconType = null
) {
  if (!msg) return;

  ensureToastState();

  // Do not queue new toasts during day summary / game-over overlays
  if (isDayOverlayOpen() || gameState.ended || !gameState.running) {
    clearAlgoToasts();
    return;
  }

  gameState.algo.queue.push({
    msg,
    senderName,
    avatarSrc,
    duration,
    iconType,
    endIconType
  });

  flushQueue();
}

window.addEventListener("toobao:stopAllSounds", () => {
  clearAlgoToasts();

  if (el.algoToast) {
    el.algoToast.classList.remove("toast-show");
    el.algoToast.classList.add("hidden");
  }

  if (el.algoToastText) {
    el.algoToastText.innerHTML = "";
  }
});