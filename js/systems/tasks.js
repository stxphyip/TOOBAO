// js/systems/tasks.js

import { shopInfo, gameState, currentTask, setCurrentTask } from "../state.js";
import { clamp, randInt, pick, syncStoreLevelFromFollowers } from "../utils.js";
import { getHomeProducts, getProductById } from "../store/productsStore.js";
import { allProducts } from "../data/products.js";
import { showAlgoToast } from "./toast.js";

const TASK_TTL_MIN = 15;
const TASK_TTL_MAX = 25;

const TASK_POPUP_AUTO_CLOSE_MS = 15000;
const TASK_COMPLETE_SECONDS = 30;
const IGNORE_FOLLOWER_PENALTY = 100;
const TASK_SUCCESS_FOLLOWERS = 50;

const TASK_SOUND_SRC = "assets/sounds/task.mp3";
const TASK_SOUND_PLAY_MS = 1000;
const TASK_SOUND_START_SEC = 0;

let taskSoundAudio = null;
let taskSoundTimer = null;
let taskSoundUnlocked = false;

const MRBAO_SOUND_BASE = "assets/mrbao_sounds/";

const MRBAO_TASK_SOUND_BY_TYPE = {
  RESTOCK_SHIPPING_BOXES: "outofstock3.mp3",
  OUT_OF_STOCK: "outofstock3.mp3",

  PRICE_TOO_HIGH: "youtrynarobpeople3.mp3",
  PRICE_TOO_LOW: "areyoueventrying3.mp3",

  CHANGE_STORE_NAME: "yournamesucks3.mp3",
  CHANGE_STORE_TYPE: "whatareyouevenselling3.mp3",

  ADD_SPECIFIC_PRODUCT: "youshouldaddthis.mp3",
  RENAME_SPECIFIC_PRODUCT: "changethatname3.mp3",
  DELETE_LOW_VIEW_PRODUCT: "getridofthat3.mp3"
};

const MRBAO_TASK_VOICE_DELAY_MS = 250;
const MRBAO_TASK_VOICE_VOLUME = .45;

let mrBaoTaskVoiceAudio = null;
let mrBaoTaskVoiceTimer = null;
let mrBaoTaskVoiceUnlocked = false;


const EXCUSE_ME_VOICE_SRC = `${MRBAO_SOUND_BASE}excuseme3.mp3`;
const MRBAO_VOICE_VOLUME = .7;
const MRBAO_VOICE_PLAY_MS = 2500;

let excuseMeVoiceAudio = null;
let excuseMeVoiceTimer = null;

const FUN_TASK_MIN_COOLDOWN_MS = 45000;
const FUN_TASK_MAX_COOLDOWN_MS = 75000;

const genericLastShown = new Map();

const FUNNY_STORE_TYPES = [
  "ROCKS",
  "REAL STUFF",
  "EVERYTHING",
  "DREAMS",
  "FURNITURE",
  "GOLD",
  "CHEAP STUFF",
  "PET STUFF"
];

const PRODUCT_RENAME_IDEAS = {
  pants: ["BAGGY JEANS", "TROUSERS"],
  shirt: ["GRAPHIC TEE", "BASIC SHIRT"],
  dress: ["VIRAL DRESS", "STUNNING GOWN"],

  laptop: ["NEW LAPTOP", "MR.BAO'S LAPTOP"],
  camera: ["PAPARAZZI CAM", "SICK LENS"],
  earphones: ["NOISE BLOCKERS", "AIRPOD DUPES"],

  coke: ["FIZZY POP SODA", "PEPSI"],
  chips: ["CRUNCHY SNACK", "TAY'S CHIPS"],
  spam: ["MYSTERY MEAT", "HIGH SODIUM SPAM"],

  earrings: ["EAR SPARKLES", "RICH EARRINGS"],
  necklace: ["NECK BRACE", "LUXURIOUS CHAIN"],
  belt: ["WAIST SNATCHER", "CEO BELT"]
};



function getFunnyNamesForProduct(product) {
  const id = String(product?.id || "").toLowerCase();
  const name = String(product?.name || "").toLowerCase();

  return (
    PRODUCT_RENAME_IDEAS[id] ||
    PRODUCT_RENAME_IDEAS[name] ||
    [
      `VIRAL ${String(product?.name || "PRODUCT").toUpperCase()}`,
      `MR.BAO APPROVED ${String(product?.name || "ITEM").toUpperCase()}`
    ]
  );
}

function taskBrownName(name) {
  return `<span class="taskTargetName">${String(name || "").toUpperCase()}</span>`;
}

function taskBrownQuote(name) {
  return `<span class="taskTargetName">"${String(name || "").toUpperCase()}"</span>`;
}



function ensureTaskOnceState() {
  if (!gameState.tasksShownOnce) gameState.tasksShownOnce = {};

  if (!gameState.profileTaskSchedule) {
    const profileTypes = ["CHANGE_STORE_NAME", "CHANGE_STORE_TYPE", "CHANGE_AVATAR"];

    gameState.profileTaskSchedule = profileTypes
      .sort(() => Math.random() - 0.5)
      .map((type, index) => ({
        type,
        unlockAtGameSec: 120 + index * randInt(120, 240)
      }));
  }

  if (typeof gameState.totalGameSecondsElapsed !== "number") {
    gameState.totalGameSecondsElapsed = 0;
  }
}

function ensureFunTaskCooldown() {
  if (typeof gameState.nextFunTaskAt !== "number") {
    gameState.nextFunTaskAt =
      Date.now() + randInt(FUN_TASK_MIN_COOLDOWN_MS, FUN_TASK_MAX_COOLDOWN_MS);
  }
}

function canShowFunTaskNow() {
  ensureFunTaskCooldown();
  return Date.now() >= gameState.nextFunTaskAt;
}

function scheduleNextFunTask() {
  gameState.nextFunTaskAt =
    Date.now() + randInt(FUN_TASK_MIN_COOLDOWN_MS, FUN_TASK_MAX_COOLDOWN_MS);
}

function hasShownOnce(taskType) {
  ensureTaskOnceState();
  return gameState.tasksShownOnce[taskType] === true;
}

function markShownOnce(taskType) {
  ensureTaskOnceState();
  gameState.tasksShownOnce[taskType] = true;
}

function getElapsedGameSeconds() {
  ensureTaskOnceState();
  return Number(gameState.totalGameSecondsElapsed) || 0;
}

function nowMs() {
  return Date.now();
}

function pickMessage(messages) {
  return messages[randInt(0, messages.length - 1)];
}

function strategicCooldownMs() {
  const level = Number(gameState.storeLevel) || 1;
  if (level <= 1) return 26000;
  if (level === 2) return 21000;
  if (level === 3) return 17000;
  if (level === 4) return 13000;
  return 9500;
}

function markGenericShown(key) {
  genericLastShown.set(key, nowMs());
}

function canShowGeneric(key, baseCooldown = null) {
  const last = genericLastShown.get(key) || 0;
  const gap = baseCooldown ?? strategicCooldownMs();
  return nowMs() - last >= gap;
}

function withExpirySeconds(ttl = randInt(TASK_TTL_MIN, TASK_TTL_MAX)) {
  const expireAt = gameState.secondsLeft - ttl;
  return Math.max(2, expireAt);
}

/* =============================
   TASK POPUP
============================= */

let taskPopupTimer = null;

function getTaskSoundAudio() {
  if (!taskSoundAudio) {
    taskSoundAudio = new Audio(TASK_SOUND_SRC);
    taskSoundAudio.preload = "auto";
    taskSoundAudio.loop = false;
    taskSoundAudio.volume = 0.9;
  }

  return taskSoundAudio;
}

function unlockTaskSoundOnce() {
  if (taskSoundUnlocked) return;
  if (soundsAreSuppressed()) return;

  const audio = getTaskSoundAudio();

  audio.volume = 0;
  audio.currentTime = 0;

  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.9;
      taskSoundUnlocked = true;
    })
    .catch(() => {
      audio.volume = 0.9;
    });
}

document.addEventListener(
  "pointerdown",
  () => {
    unlockTaskSoundOnce();
    unlockMrBaoTaskVoiceOnce();
  },
  { once: true }
);

function stopTaskPopupSound() {
  if (taskSoundTimer) {
    clearTimeout(taskSoundTimer);
    taskSoundTimer = null;
  }

  if (!taskSoundAudio) return;

  taskSoundAudio.pause();
  taskSoundAudio.currentTime = TASK_SOUND_START_SEC;
}

function playTaskPopupSound() {
  stopTaskPopupSound();

  if (soundsAreSuppressed()) return;

  const audio = getTaskSoundAudio();

  const soundVersion = Number(window.__toobaoSoundStopVersion) || 0;

  audio.volume = 0.9;
  audio.currentTime = TASK_SOUND_START_SEC;

  if ((Number(window.__toobaoSoundStopVersion) || 0) !== soundVersion) {
    return;
  }

  audio.play().catch((err) => {
    console.warn("[Task] Task popup sound blocked:", err);
  });

  taskSoundTimer = setTimeout(() => {
    stopTaskPopupSound();
  }, TASK_SOUND_PLAY_MS);
}

function getMrBaoTaskVoiceAudio() {
  if (!mrBaoTaskVoiceAudio) {
    mrBaoTaskVoiceAudio = new Audio();
    mrBaoTaskVoiceAudio.preload = "auto";
    mrBaoTaskVoiceAudio.loop = false;
    mrBaoTaskVoiceAudio.volume = MRBAO_TASK_VOICE_VOLUME;
  }

  return mrBaoTaskVoiceAudio;
}

function getMrBaoTaskVoiceSrc(task) {
  const fileName = MRBAO_TASK_SOUND_BY_TYPE[task?.type];
  return fileName ? `${MRBAO_SOUND_BASE}${fileName}` : "";
}

function unlockMrBaoTaskVoiceOnce() {
  if (mrBaoTaskVoiceUnlocked) return;
  if (soundsAreSuppressed()) return;

  const audio = getMrBaoTaskVoiceAudio();

  audio.src = `${MRBAO_SOUND_BASE}outofstock3.mp3`;
  audio.volume = 0;
  audio.currentTime = 0;

  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = MRBAO_TASK_VOICE_VOLUME;
      mrBaoTaskVoiceUnlocked = true;
    })
    .catch(() => {
      audio.volume = MRBAO_TASK_VOICE_VOLUME;
    });
}

function stopMrBaoTaskVoice() {
  if (mrBaoTaskVoiceTimer) {
    clearTimeout(mrBaoTaskVoiceTimer);
    mrBaoTaskVoiceTimer = null;
  }

  if (!mrBaoTaskVoiceAudio) return;

  mrBaoTaskVoiceAudio.pause();
  mrBaoTaskVoiceAudio.currentTime = 0;
}

function playMrBaoTaskVoice(task) {
  const src = getMrBaoTaskVoiceSrc(task);
  if (!src) return;

  stopMrBaoTaskVoice();

  const soundVersion = Number(window.__toobaoSoundStopVersion) || 0;

  mrBaoTaskVoiceTimer = setTimeout(() => {
    if (soundsAreSuppressed()) return;

    if ((Number(window.__toobaoSoundStopVersion) || 0) !== soundVersion) {
      return;
    }

    const audio = getMrBaoTaskVoiceAudio();

    audio.src = src;
    audio.volume = MRBAO_TASK_VOICE_VOLUME;
    audio.currentTime = 0;

    audio.play().catch((err) => {
      console.warn("[Task] Mr. Bao voice sound blocked:", err);
    });
  }, MRBAO_TASK_VOICE_DELAY_MS);
}

function pressTaskButtonThen(button, action) {
  if (!button) return;

  button.classList.add("is-pressed");

  setTimeout(() => {
    button.classList.remove("is-pressed");
    action();
  }, 120);
}

function getExcuseMeVoiceAudio() {
  if (!excuseMeVoiceAudio) {
    excuseMeVoiceAudio = new Audio(EXCUSE_ME_VOICE_SRC);
    excuseMeVoiceAudio.preload = "auto";
    excuseMeVoiceAudio.loop = false;
    excuseMeVoiceAudio.volume = MRBAO_VOICE_VOLUME;
  }

  return excuseMeVoiceAudio;
}

function stopExcuseMeVoice() {
  if (excuseMeVoiceTimer) {
    clearTimeout(excuseMeVoiceTimer);
    excuseMeVoiceTimer = null;
  }

  if (!excuseMeVoiceAudio) return;

  excuseMeVoiceAudio.pause();
  excuseMeVoiceAudio.currentTime = 0;
}

function playExcuseMeVoice() {
  if (soundsAreSuppressed()) return;

  const audio = getExcuseMeVoiceAudio();

  stopExcuseMeVoice();

  audio.currentTime = 0;
  audio.volume = MRBAO_VOICE_VOLUME;

  audio.play().catch((err) => {
    console.warn("[MrBao Voice] Excuse me sound blocked:", err);
  });

  excuseMeVoiceTimer = setTimeout(() => {
    stopExcuseMeVoice();
  }, MRBAO_VOICE_PLAY_MS);
}

function soundsAreSuppressed() {
  return Date.now() < (Number(window.__toobaoSuppressSoundsUntil) || 0);
}

function popupsAreSuppressed() {
  return Date.now() < (Number(window.__toobaoSuppressPopupsUntil) || 0);
}

function openTaskPopup(task) {
  closeTaskPopup();

  const overlay = document.createElement("div");
  overlay.id = "mrBaoTaskOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.55);
  `;

  overlay.innerHTML = `
    <div class="mrBaoTaskModal">
      <img class="mrBaoTaskModalBg" src="assets/popup/alertwhiteblock.png" alt="">
      
      <div class="mrBaoTaskInner">
        <div class="mrBaoTaskTitle">IMPORTANT ALERT!</div>

        <div class="mrBaoTaskBody">
          <div class="mrBaoTaskIconWrap">
            <img class="mrBaoTaskIcon" src="${task.image}" alt="">
          </div>

          <div class="mrBaoTaskTextCol">
            <div class="mrBaoTaskName">MR.BAO</div>
            <div class="mrBaoTaskMessage">${task.message}</div>
          </div>
        </div>

        <div class="mrBaoTaskButtons">
          <button id="ignoreTaskBtn" class="mrBaoTaskBtn" type="button">
            <img src="assets/popup/ignorebutton.png" alt="Ignore">
          </button>
          <button id="gotItTaskBtn" class="mrBaoTaskBtn" type="button">
            <img src="assets/popup/gotitbutton.png" alt="Got it">
          </button>
        </div>
      </div>
    </div>
  `;

document.body.appendChild(overlay);
playTaskPopupSound();
playMrBaoTaskVoice(task);

  const ignoreBtn = document.getElementById("ignoreTaskBtn");
const gotItBtn = document.getElementById("gotItTaskBtn");

ignoreBtn.onclick = (e) => {
  e.preventDefault();

  pressTaskButtonThen(ignoreBtn, () => {
    gameState.followers = Math.max(
      0,
      (Number(gameState.followers) || 0) - IGNORE_FOLLOWER_PENALTY
    );

    syncStoreLevelFromFollowers(gameState);

    closeTaskPopup();
    openIgnoreWarningPopup(task);
  });
};

gotItBtn.onclick = (e) => {
  e.preventDefault();

  pressTaskButtonThen(gotItBtn, () => {
    startTaskCountdown(task);
    closeTaskPopup();
  });
};

  taskPopupTimer = setTimeout(() => {
    startTaskCountdown(task);
    closeTaskPopup();
  }, TASK_POPUP_AUTO_CLOSE_MS);
}

function openIgnoreWarningPopup(task) {
  const overlay = document.createElement("div");
  overlay.id = "mrBaoIgnoreOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.65);
  `;

  overlay.innerHTML = `
    <div class="mrBaoTaskModal mrBaoIgnoreModal">
      <img class="mrBaoTaskModalBg" src="assets/popup/alertwhiteblock.png" alt="">
      
      <div class="mrBaoTaskInner">
        <div class="mrBaoTaskTitle">EXCUSE ME...?</div>

        <div class="mrBaoTaskBody">
          <div class="mrBaoTaskIconWrap">
            <img class="mrBaoTaskIcon" src="assets/popup/mrbaoangry.png" alt="">
          </div>

          <div class="mrBaoTaskTextCol">
            <div class="mrBaoTaskName">MR.BAO</div>
            <div class="mrBaoTaskMessage">
              DON'T IGNORE MY MESSAGE. GET BACK TO WORK.
            </div>
          </div>
        </div>

        <div class="mrBaoTaskButtons mrBaoTaskButtonsSingle">
          <button id="returnToTaskBtn" class="mrBaoTaskBtn" type="button">
            <img src="assets/popup/gotitbutton.png" alt="Got it">
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  playExcuseMeVoice();

  const returnBtn = document.getElementById("returnToTaskBtn");

returnBtn.onclick = (e) => {
  e.preventDefault();

  pressTaskButtonThen(returnBtn, () => {
    stopExcuseMeVoice();
    overlay.remove();
    openTaskPopup(task);
  });
};
}

function closeTaskPopup() {
  if (taskPopupTimer) {
    clearTimeout(taskPopupTimer);
    taskPopupTimer = null;
  }

  stopTaskPopupSound();
  stopMrBaoTaskVoice();

  const existing = document.getElementById("mrBaoTaskOverlay");
  if (existing) existing.remove();
}

export function closeAllTaskPopups({ clearActiveTask = false } = {}) {
  closeTaskPopup();

  const ignoreOverlay = document.getElementById("mrBaoIgnoreOverlay");
  if (ignoreOverlay) ignoreOverlay.remove();

  stopTaskPopupSound();
  stopMrBaoTaskVoice();
  stopExcuseMeVoice();

  if (clearActiveTask) {
    setCurrentTask(null);
  }
}

function startTaskCountdown(task) {
  task.expiresAt = gameState.secondsLeft - TASK_COMPLETE_SECONDS;
  task.expiresAt = Math.max(2, task.expiresAt);
  setCurrentTask(task);
}

/* =============================
   TASK CREATION
============================= */

function createTask(task) {
  setCurrentTask(task);
  openTaskPopup(task);
}

export function clearTask(success) {
  if (!currentTask) return;

    const dayOverlay = document.getElementById("dayOverlay");
  const dayOverlayOpen = dayOverlay && !dayOverlay.classList.contains("hidden");

  if (dayOverlayOpen || gameState.ended || !gameState.running) {
    setCurrentTask(null);
    closeAllTaskPopups();
    return;
  }

  if (success) {
    gameState.visibility = clamp(gameState.visibility + randInt(8, 14), 0, 100);
    gameState.views = clamp((gameState.views || 0) + randInt(20, 45), 0, 999999);
    gameState.followers = Math.max(
      0,
      (Number(gameState.followers) || 0) + TASK_SUCCESS_FOLLOWERS
    );

    showAlgoToast(
      `TASK COMPLETE. MR.BAO APPROVES... FOR NOW. +${TASK_SUCCESS_FOLLOWERS} FOLLOWERS`,
      "MR. BAO",
      null,
      3600,
      null,
      "followers"
    );
  } else {
  gameState.visibility = clamp(gameState.visibility - randInt(10, 16), 0, 100);
  gameState.views = clamp((gameState.views || 0) - randInt(15, 35), 0, 999999);
  gameState.followers = Math.max(
    0,
    (Number(gameState.followers) || 0) - IGNORE_FOLLOWER_PENALTY
  );
  gameState.missedTasks += 1;

  syncStoreLevelFromFollowers(gameState);

  showAlgoToast(
    `TASK INCOMPLETE. MR.BAO WILL REMEMBER THIS. -${IGNORE_FOLLOWER_PENALTY} FOLLOWERS`,
    "MR. BAO",
    null,
    3600,
    null,
    "followers"
  );
}

  setCurrentTask(null);
}

export function expireTaskIfNeeded() {
  if (!currentTask) return;

  if (window.__starLevelPopupOpen) return;
  if (document.getElementById("starLevelPopupOverlay")) return;

  const dayOverlay = document.getElementById("dayOverlay");
  const dayOverlayOpen = dayOverlay && !dayOverlay.classList.contains("hidden");

  // Do not trigger task fail/toast while day overlay or game-over overlay is open
  if (dayOverlayOpen || gameState.ended || !gameState.running) {
    closeAllTaskPopups({ clearActiveTask: true });
    return;
  }

  if (gameState.secondsLeft <= currentTask.expiresAt) {
    closeTaskPopup();
    clearTask(false);
  }
}

/* =============================
   PICKERS
============================= */

function pickOutOfStockCandidate() {
  return getHomeProducts().find((p) => (Number(p.qty) || 0) === 0) || null;
}

function pickTooExpensiveCandidate() {
  return (
    getHomeProducts()
      .filter((p) => (Number(p.qty) || 0) > 0 && (Number(p.price) || 0) > 50)
      .sort((a, b) => (b.price || 0) - (a.price || 0))[0] || null
  );
}

function pickTooCheapCandidate() {
  return (
    getHomeProducts()
      .filter(
        (p) =>
          (Number(p.qty) || 0) > 0 &&
          (Number(p.price) || 0) > 0 &&
          (Number(p.price) || 0) < 10
      )
      .sort((a, b) => (a.price || 0) - (b.price || 0))[0] || null
  );
}

function boxesAvailable() {
  const total = Number(gameState.shippingMaterials) || 0;
  const reserved = Number(gameState.reservedShippingMaterials) || 0;
  return Math.max(0, total - reserved);
}

function needsShippingBoxes() {
  return boxesAvailable() <= 0;
}

function pickProductNotOnHome() {
  const homeIds = new Set(getHomeProducts().map((p) => String(p.id)));

  return (
    shopInfo.chosenProducts.find((p) => !homeIds.has(String(p.id))) ||
    allProducts.find((p) => !homeIds.has(String(p.id))) ||
    null
  );
}

function pickRenameCandidate() {
  const list = getHomeProducts();

  return (
    list.find((p) => {
      const id = String(p.id).toLowerCase();
      return PRODUCT_RENAME_IDEAS[id];
    }) || null
  );
}

function pickNewStoreType() {
  const current = String(shopInfo.storeType || "").toUpperCase();

  const options = FUNNY_STORE_TYPES.filter(
    (type) => type.toUpperCase() !== current
  );

  return pick(options.length ? options : FUNNY_STORE_TYPES);
}

function getProductPerformanceScore(product) {
  const recentViews = Number(product?.recentViews) || 0;
  const sold = Number(product?.sold) || 0;
  const qty = Number(product?.qty) || 0;

  // Lower score = worse product performance.
  // Sold matters more than views because sales are stronger proof.
  return recentViews + sold * 15 + qty * 0.5;
}

function pickLowViewProductCandidate() {
  const elapsed = getElapsedGameSeconds();
if (elapsed < 180) return null;
  const list = getHomeProducts()
    .filter((p) => {
      if (!p) return false;
      if (p.id === "__shipping_boxes__") return false;

      // Avoid telling player to delete their only product.
      if (getHomeProducts().length <= 1) return false;

      // Product should actually be on the shelf.
      if (!p.onHome) return false;

      // Avoid products that already sold well.
      const sold = Number(p.sold) || 0;
      if (sold >= 3) return false;

      return true;
    })
    .sort((a, b) => getProductPerformanceScore(a) - getProductPerformanceScore(b));

  return list[0] || null;
}

/* =============================
   BUILD TASKS
============================= */

function buildOutOfStockTask(product) {
  markGenericShown(`OUT_OF_STOCK_${product.id}`);
  const productNameHtml = taskBrownName(product.name);

  return {
    type: "OUT_OF_STOCK",
    productId: product.id,
    baseQty: Number(product.qty) || 0,
    expiresAt: withExpirySeconds(40),
    image: product.img,
    message: pickMessage([
      `${productNameHtml} is SOLD OUT. Your shelf is empty. Restock it immediately!`,
      `${productNameHtml} disappeared from your shelf. MR.BAO is concerned. Buy more products now!`,
      `Your ${productNameHtml} stock is at ZERO. This is not a great business strategy. Restock now!`,
      `${productNameHtml} is sold out. Restock before your store starts looking abandoned.`
    ])
  };
}

function buildPriceHighTask(product) {
  markGenericShown(`PRICE_HIGH_${product.id}`);
  const productNameHtml = taskBrownName(product.name);

  return {
    type: "PRICE_TOO_HIGH",
    productId: product.id,
    basePrice: Number(product.price) || 0,
    expiresAt: withExpirySeconds(38),
    image: product.img,
    message: pickMessage([
      `${productNameHtml} costs HOW much?? Even MR.BAO wouldn't buy this. Lower the price NOW!`,
      `${productNameHtml} is priced like luxury, but your customers are not feeling rich today.`,
      `Customers saw the price of ${productNameHtml} and closed the app immediately. Lower the price NOW!`,
      `${productNameHtml} is too expensive. MR.BAO just checked the price twice.`,
      `That ${productNameHtml} price is scaring customers away. Let's get back to reality and lower it.`
    ])
  };
}

function buildPriceLowTask(product) {
  markGenericShown(`PRICE_LOW_${product.id}`);
  const productNameHtml = taskBrownName(product.name);

  return {
    type: "PRICE_TOO_LOW",
    productId: product.id,
    basePrice: Number(product.price) || 0,
    expiresAt: withExpirySeconds(38),
    image: product.img,
    message: pickMessage([
      `${productNameHtml} is suspiciously cheap. Are you running a charity?? Raise the price immediately.`,
      `${productNameHtml} is so cheap customers think it fell off a truck.`,
      `${productNameHtml} is priced like a free sample. You are trying to make money, remember?`,
      `Your ${productNameHtml} price is giving clearance bin. Raise the price so people trust it more`
    ])
  };
}

function buildChangeStoreNameTask() {
  markGenericShown("CHANGE_STORE_NAME");
  markShownOnce("CHANGE_STORE_NAME");

  return {
    type: "CHANGE_STORE_NAME",
    baseName: shopInfo.name,
    expiresAt: withExpirySeconds(30),
    image: "assets/popup/mrbaoconfused.png",
    message: pickMessage([
      `Your store name is giving side character. Tap your profile and rebrand before MR.BAO finds out.`,
      `MR.BAO read your store name and said it was meh. Tap your profile and fix it.`,
      `Your store needs a rebrand. Change your store name by tapping on your profile picture.`
    ])
  };
}

function buildChangeStoreTypeTask() {
  markGenericShown("CHANGE_STORE_TYPE");
  markShownOnce("CHANGE_STORE_TYPE");

  const targetType = pickNewStoreType();
  const targetTypeHtml = taskBrownQuote(targetType);

  return {
    type: "CHANGE_STORE_TYPE",
    baseType: shopInfo.storeType,
    targetType,
    expiresAt: withExpirySeconds(30),
    image: "assets/popup/mrbaoconfused.png",
    message: pickMessage([
      `Your store type is too basic. Tap on your profile and change it to ${targetTypeHtml} before MR.BAO loses interest.`,
      `MR.BAO has rebranded you in his mind. Tap on your profile and change your store type to ${targetTypeHtml}.`,
      `Your current store type kinda sucks. Make it ${targetTypeHtml} by tapping on your profile picture.`
    ])
  };
}

function buildChangeAvatarTask() {
  markGenericShown("CHANGE_AVATAR");
  markShownOnce("CHANGE_AVATAR");

  return {
    type: "CHANGE_AVATAR",
    baseAvatar: shopInfo.avatarImg || shopInfo.avatarNumber,
    expiresAt: withExpirySeconds(30),
    image: "assets/popup/mrbaoangry.png",
    message: pickMessage([
      `That profile picture is not doing you any favors. Tap your profile picture to change it.`,
      `Your avatar needs a glow-up. Right now it is not screaming trustworthy seller. Tap your profile picture to change it.`,
      `Your profile picture is giving mediocre seller energy. Tap it and upgrade your brand.`
    ])
  };
}

function buildShippingBoxesTask() {
  markGenericShown("RESTOCK_SHIPPING_BOXES");

  return {
    type: "RESTOCK_SHIPPING_BOXES",
    baseBoxes: boxesAvailable(),
    expiresAt: withExpirySeconds(30),
    image: "assets/storage/boxproduct.png",
    message: pickMessage([
      `No boxes means no shipping. No shipping means no money. Buy more boxes before MR.BAO finds out.`,
      `YOU'RE OUT OF BOXES! Customers can't order anything! Buy more now!.`,
      `MR.BAO opened your storage and saw no boxes. Restock now to get orders.`,
      `Your store has products but no boxes. That is not a good business strategy.`
    ])
  };
}

function buildAddSpecificProductTask(product) {
  markGenericShown(`ADD_PRODUCT_${product.id}`);
  markShownOnce(`ADD_PRODUCT_${product.id}`);

  const productNameHtml = taskBrownName(product.name);

  return {
    type: "ADD_SPECIFIC_PRODUCT",
    productId: product.id,
    targetProductName: product.name,
    expiresAt: withExpirySeconds(30),
    image: product.img,
    message: pickMessage([
      `MR.BAO detected a trend. Add ${productNameHtml} to your store before customers forget you exist.`,
      `${productNameHtml} is about to be hot. Add it to your store and pretend this was your idea.`,
      `Customers are looking for ${productNameHtml}. Put it on your shelf before someone else does.`
    ])
  };
}

function buildRenameSpecificProductTask(product) {
  markGenericShown(`RENAME_SPECIFIC_${product.id}`);
  markShownOnce(`RENAME_SPECIFIC_${product.id}`);

  const productNameHtml = taskBrownName(product.name);
  const targetName = pick(getFunnyNamesForProduct(product));
  const targetNameHtml = taskBrownQuote(targetName);

  return {
    type: "RENAME_SPECIFIC_PRODUCT",
    productId: product.id,
    baseName: product.name,
    targetName,
    expiresAt: withExpirySeconds(30),
    image: product.img,
    message: pickMessage([
      `${productNameHtml} needs a glow-up. Rename it to ${targetNameHtml} in your storage shelf.`,
      `MR.BAO says ${productNameHtml} is not selling well. Rename it to ${targetNameHtml} in your storage shelf.`,
      `Your ${productNameHtml} name is boring. Rename it to ${targetNameHtml} in your storage shelf.`
    ])
  };
}

function buildDeleteLowViewProductTask(product) {
  markGenericShown(`DELETE_LOW_VIEW_${product.id}`);
  markShownOnce(`DELETE_LOW_VIEW_${product.id}`);
  const productNameHtml = taskBrownName(product.name);

  return {
    type: "DELETE_LOW_VIEW_PRODUCT",
    productId: product.id,
    baseOnHome: product.onHome,
    expiresAt: withExpirySeconds(35),
    image: product.img,
    message: pickMessage([
      `No one wants ${productNameHtml}. Get rid of that from your storage shelf.`,
      `${productNameHtml} is taking up space and barely getting views. Delete it from your storage shelf.`,
      `${productNameHtml} is not doing well. Remove it from your store.`,
      `${productNameHtml} sucks. Delete it before it drags your store down.`
    ])
  };
}

/* =============================
   TASK SELECTION
============================= */

function pickContextualTask() {
  if (
    needsShippingBoxes() &&
    canShowGeneric("RESTOCK_SHIPPING_BOXES", 45000)
  ) {
    return buildShippingBoxesTask();
  }

  const outOfStock = pickOutOfStockCandidate();
  if (outOfStock && canShowGeneric(`OUT_OF_STOCK_${outOfStock.id}`)) {
    return buildOutOfStockTask(outOfStock);
  }

  const highPrice = pickTooExpensiveCandidate();
  if (highPrice && canShowGeneric(`PRICE_HIGH_${highPrice.id}`)) {
    return buildPriceHighTask(highPrice);
  }

  const lowPrice = pickTooCheapCandidate();
  if (lowPrice && canShowGeneric(`PRICE_LOW_${lowPrice.id}`)) {
    return buildPriceLowTask(lowPrice);
  }

  if (!canShowFunTaskNow()) return null;

  const funTasks = [];

  const elapsed = getElapsedGameSeconds();
  const scheduledProfileTask = gameState.profileTaskSchedule?.find(
    (item) => elapsed >= item.unlockAtGameSec && !hasShownOnce(item.type)
  );

  if (scheduledProfileTask) {
    if (scheduledProfileTask.type === "CHANGE_STORE_NAME") {
      funTasks.push(buildChangeStoreNameTask);
    }

    if (scheduledProfileTask.type === "CHANGE_STORE_TYPE") {
      funTasks.push(buildChangeStoreTypeTask);
    }

    if (scheduledProfileTask.type === "CHANGE_AVATAR") {
      funTasks.push(buildChangeAvatarTask);
    }
  }

  const addProductCandidate = pickProductNotOnHome();
  if (
    addProductCandidate &&
    !hasShownOnce(`ADD_PRODUCT_${addProductCandidate.id}`)
  ) {
    funTasks.push(() => buildAddSpecificProductTask(addProductCandidate));
  }

  const renameProduct = pickRenameCandidate();
  if (
    renameProduct &&
    !hasShownOnce(`RENAME_SPECIFIC_${renameProduct.id}`)
  ) {
    funTasks.push(() => buildRenameSpecificProductTask(renameProduct));
  }
  const lowViewProduct = pickLowViewProductCandidate();
if (
  lowViewProduct &&
  !hasShownOnce(`DELETE_LOW_VIEW_${lowViewProduct.id}`) &&
  canShowGeneric(`DELETE_LOW_VIEW_${lowViewProduct.id}`, 60000)
) {
  funTasks.push(() => buildDeleteLowViewProductTask(lowViewProduct));
}

  if (!funTasks.length) return null;

  scheduleNextFunTask();
  return pick(funTasks)();
}

/* =============================
   MAIN LOOP EXPORTS
============================= */

export function postNewTask() {
  
  if (!gameState.running || gameState.ended) return;
  if (currentTask) return;

  if (popupsAreSuppressed()) return;

  // Do not interrupt the player while they are actively livestreaming
  if (window.__marketingIsStreaming) return;

  // Do not interrupt star level popup
  if (window.__starLevelPopupOpen) return;

  if (gameState.helpCards?.pendingOffer) return;
  if (gameState.helpCards?.active) return;

  if (document.getElementById("popupOverlay")) return;
  if (document.getElementById("mrBaoTaskOverlay")) return;
  if (document.getElementById("mrBaoIgnoreOverlay")) return;
  if (document.getElementById("quitConfirmOverlay")) return;
  if (
    document.getElementById("dayOverlay") &&
    !document.getElementById("dayOverlay").classList.contains("hidden")
  ) return;

  const task = pickContextualTask();

  if (task) {
    createTask(task);
  }
}

export function checkTaskCompletion() {
  if (!currentTask) return;

  if (currentTask.type === "RESTOCK_SHIPPING_BOXES") {
    if (boxesAvailable() > 0) clearTask(true);
    return;
  }

  if (currentTask.type === "OUT_OF_STOCK") {
    const p = getProductById(currentTask.productId);
    if (p && (Number(p.qty) || 0) > 0) clearTask(true);
    return;
  }

  if (currentTask.type === "PRICE_TOO_HIGH") {
    const p = getProductById(currentTask.productId);
    if (p && (Number(p.price) || 0) <= 50) clearTask(true);
    return;
  }

  if (currentTask.type === "PRICE_TOO_LOW") {
    const p = getProductById(currentTask.productId);
    if (p && (Number(p.price) || 0) >= 10) clearTask(true);
    return;
  }

  if (currentTask.type === "CHANGE_STORE_NAME") {
    if (shopInfo.name !== currentTask.baseName) clearTask(true);
    return;
  }

  if (currentTask.type === "CHANGE_STORE_TYPE") {
    if (
      String(shopInfo.storeType || "").trim().toUpperCase() ===
      String(currentTask.targetType || "").trim().toUpperCase()
    ) {
      clearTask(true);
    }
    return;
  }

  if (currentTask.type === "CHANGE_AVATAR") {
    const currentAvatar = shopInfo.avatarImg || shopInfo.avatarNumber;
    if (currentAvatar !== currentTask.baseAvatar) clearTask(true);
    return;
  }

  if (currentTask.type === "ADD_SPECIFIC_PRODUCT") {
    const p = getProductById(currentTask.productId);
    if (p && p.onHome) clearTask(true);
    return;
  }

  if (currentTask.type === "RENAME_SPECIFIC_PRODUCT") {
    const p = getProductById(currentTask.productId);
    if (
      p &&
      String(p.name || "").trim().toUpperCase() ===
        String(currentTask.targetName || "").trim().toUpperCase()
    ) {
      clearTask(true);
    }
  }
  if (currentTask.type === "DELETE_LOW_VIEW_PRODUCT") {
  const p = getProductById(currentTask.productId);

  // Success if product is no longer on the home/store shelf.
  if (!p || !p.onHome) {
    clearTask(true);
  }

  return;
}
}

window.addEventListener("toobao:stopAllSounds", () => {
  closeAllTaskPopups({ clearActiveTask: true });
});