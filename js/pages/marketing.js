// js/pages/marketing.js

import { el } from "../dom.js";
import { gameState, shopInfo } from "../state.js";
import {
  clamp,
  randInt,
  formatTime,
  addViewsAndConvertFollowers
} from "../utils.js";
import { avatarImages } from "../data/avatars.js";
import { getHomeProducts } from "../store/productsStore.js";
import { addRandomOrderFromSelectedProducts } from "../systems/ordersSystem.js";
import { openEditProfile } from "../modals/editProfile.js";
import { renderHud } from "./home.js";
import { showAlgoToast } from "../systems/toast.js";
import { initMarketingP5Live } from "./marketingP5Live.js";

const FOLLOWERS_ICON = "assets/ui_icons/followers_icon.png";
const VIEWS_ICON = "assets/ui_icons/views_icon.png";
const BOX_ICON = "assets/ui_icons/shippingbox_icon.png";
const COIN_ICON = "assets/ui_icons/coin_icon.png";
const TIME_ICON = "assets/ui_icons/time_icon.png";
const DAY_1_ICON = "assets/ui_icons/day1_icon.png";
const DAY_2_ICON = "assets/ui_icons/day2_icon.png";
const DAY_3_ICON = "assets/ui_icons/day3_icon.png";

const HEART_IMG = "assets/marketing/heart.png";
const SMALL_BUBBLE_IMG = "assets/marketing/smalllivestream.png";
const MED_BUBBLE_IMG = "assets/marketing/medlivestream.png";
const LARGE_BUBBLE_IMG = "assets/marketing/largelivestream.png";

const MRBAO_SOUND_BASE = "assets/mrbao_sounds/";
const SMILE_VOICE_SRC = `${MRBAO_SOUND_BASE}smile3.mp3`;

const SMILE_VOICE_VOLUME = .5;
const SMILE_VOICE_PLAY_MS = 2500;

let smileVoiceAudio = null;
let smileVoiceTimer = null;
let smileVoicePlaying = false;


let streaming = false;
let streamStartMs = 0;
let streamTick = null;
let chatSpawnTick = null;
let heartSpawnTick = null;

let ghostStreaming = false;
let ghostStreamStartMs = 0;
let ghostStreamTick = null;
let ghostChatSpawnTick = null;
let ghostHeartSpawnTick = null;

let lastMarketingViews = null;
let lastMarketingFollowers = null;
let lastLivestreamWarningAt = 0;
let greenSmileMs = 0;
let lastSmileTickMs = 0;
let lowSmileToastShown = false;

const fakeMessages = [
  "drop the link right now!",
  "is this still in stock?",
  "wait show it closer",
  "how long does shipping take?",
  "do you have more colors?",
  "this is actually cute",
  "i need this for no reason",
  "my wallet is shaking",
  "adding to cart so fast",
  "this would be a good gift",
  "can you show the texture?",
  "does it feel high quality?",
  "wait that price is so good",
  "i just followed!",
  "chat should i buy this?",
  "not a want, a need",
  "this store is dangerous",
  "should i buy this?",
  "i was just browsing...",
  "it would look better if you smiled more",
  "smile more seller!",
  "why do you look nervous lol",
  "the product is cute but smile pls",
  "wait smile and show it again",
  "you look like you need coffee",
  "blink twice if mr bao is forcing this"
];

function getSmileVoiceAudio() {
  if (!smileVoiceAudio) {
    smileVoiceAudio = new Audio(SMILE_VOICE_SRC);
    smileVoiceAudio.preload = "auto";
    smileVoiceAudio.loop = false;
    smileVoiceAudio.volume = SMILE_VOICE_VOLUME;
  }

  return smileVoiceAudio;
}

function stopSmileVoice() {
  if (smileVoiceTimer) {
    clearTimeout(smileVoiceTimer);
    smileVoiceTimer = null;
  }

  if (!smileVoiceAudio) {
    smileVoicePlaying = false;
    return;
  }

  smileVoiceAudio.pause();
  smileVoiceAudio.currentTime = 0;
  smileVoicePlaying = false;
}

function playSmileVoiceOnce() {
  if (smileVoicePlaying) return;

  const audio = getSmileVoiceAudio();

  smileVoicePlaying = true;
  audio.currentTime = 0;
  audio.volume = SMILE_VOICE_VOLUME;

  audio.play().catch((err) => {
    console.warn("[Marketing] Smile voice blocked:", err);
    smileVoicePlaying = false;
  });

  smileVoiceTimer = setTimeout(() => {
    stopSmileVoice();
  }, SMILE_VOICE_PLAY_MS);
}

function resolveAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;

  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "";
}

function getStarsImg() {
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  return `assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png`;
}

function getDayIcon() {
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));
  if (day === 2) return DAY_2_ICON;
  if (day === 3) return DAY_3_ICON;
  return DAY_1_ICON;
}

function formatCompact(n) {
  const num = Math.max(0, Math.floor(Number(n) || 0));

  if (num >= 1000000) {
    const v = num / 1000000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}M`;
  }

  if (num >= 1000) {
    const v = num / 1000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}K`;
  }

  return String(num);
}

function getAvailableShippingBoxes() {
  const total = Number(gameState.shippingMaterials) || 0;
  const reserved = Number(gameState.reservedShippingMaterials) || 0;
  return Math.max(0, total - reserved);
}

function randomFanAvatar() {
  return avatarImages[randInt(0, avatarImages.length - 1)] || avatarImages[0] || "";
}

function setTimerFromMs(ms) {
  const secs = Math.floor(ms / 1000);
  if (el.liveTimer) {
    el.liveTimer.textContent = formatTime(secs);
  }
}

function renderLiveSessionViews() {
  if (!el.liveViewsCount) return;
  el.liveViewsCount.textContent = String(gameState.liveSessionViews || 0);
}

function intensityFromHoldSeconds(t) {
  return clamp(t / 12, 0, 1);
}

function getBubbleAssetAndClass(message) {
  const len = String(message || "").length;

  if (len <= 13) {
    return { img: SMALL_BUBBLE_IMG, className: "is-small" };
  }
  if (len <= 23) {
    return { img: MED_BUBBLE_IMG, className: "is-medium" };
  }
  return { img: LARGE_BUBBLE_IMG, className: "is-large" };
}

function trimMessageToBox(message) {
  const msg = String(message || "").toLowerCase();

  if (msg.length <= 13) return msg;
  if (msg.length <= 23) return msg.slice(0, 23);
  return msg.slice(0, 31);
}

function buildMarketingTopStats() {
  const root = document.getElementById("marketingTopStats");
  if (!root) return;

  root.innerHTML = `
    <div class="marketingTopStatsInner">
      <button id="marketingAvatarBtn" class="marketingAvatarBtn" type="button" aria-label="Edit profile">
        <img id="marketingTopAvatar" class="marketingAvatarLarge" src="${resolveAvatarSrc()}" alt="Store avatar">
      </button>

      <div class="marketingStoreMain">
        <div id="marketingTopStoreName" class="marketingStoreNameLarge">${shopInfo.name || "[STORE NAME]"}</div>
        <img id="marketingTopStars" class="marketingStarsImg" src="${getStarsImg()}" alt="Stars">

        <div class="marketingOrangeStatsRow">
          <div class="marketingOrangeStat marketingFollowersStat">
            <img class="marketingStatIcon" src="${FOLLOWERS_ICON}" alt="">
            <span id="marketingTopFollowersValue" class="marketingStatValue">${formatCompact(gameState.followers)}</span>
          </div>

          <div class="marketingOrangeStat marketingViewsStat">
            <img class="marketingStatIcon" src="${VIEWS_ICON}" alt="">
            <span id="marketingTopViewsValue" class="marketingStatValue">${formatCompact(gameState.views)}</span>
          </div>

          <button id="marketingBoxesBtn" class="marketingOrangeStat marketingBoxesStat" type="button" aria-label="Shipping boxes">
            <img class="marketingStatIcon" src="${BOX_ICON}" alt="">
            <span id="marketingTopBoxesValue" class="marketingStatValue">${formatCompact(getAvailableShippingBoxes())}</span>
          </button>

          <div class="marketingOrangeStat marketingMoneyStat">
            <img class="marketingStatIcon" src="${COIN_ICON}" alt="">
            <span id="marketingTopMoneyValue" class="marketingStatValue">${formatCompact(gameState.revenue)}</span>
          </div>
        </div>
      </div>

      <div class="marketingRightStatsCol">
        <div class="marketingOrangeStat marketingDayStat">
          <img id="marketingTopDayIcon" class="marketingStatIcon" src="${getDayIcon()}" alt="">
          <span id="marketingTopDayValue" class="marketingStatValue">DAY ${gameState.day}</span>
        </div>

        <div class="marketingOrangeStat marketingTimeStat">
          <img class="marketingStatIcon" src="${TIME_ICON}" alt="">
          <span id="marketingTopTimeValue" class="marketingStatValue">${formatTime(gameState.secondsLeft)}</span>
        </div>
      </div>
    </div>
  `;

  const avatarBtn = document.getElementById("marketingAvatarBtn");
  if (avatarBtn) {
    avatarBtn.onclick = () => openEditProfile();
  }

}

function spawnChatBubble(intensity) {
  if (!el.liveChatLane) return;

  const wrap = document.createElement("div");
  wrap.className = "liveChatMsg";

  const avatar = document.createElement("img");
  avatar.className = "liveChatAvatar";
  avatar.src = randomFanAvatar();
  avatar.alt = "fan avatar";

  const raw = fakeMessages[randInt(0, fakeMessages.length - 1)];
  const finalText = trimMessageToBox(
    intensity > 0.7 && Math.random() < 0.3 ? `${raw}!!` : raw
  );

  const bubbleMeta = getBubbleAssetAndClass(finalText);

  const bubble = document.createElement("div");
  bubble.className = `liveChatBubble ${bubbleMeta.className}`;

  const bubbleImg = document.createElement("img");
  bubbleImg.className = "liveChatBubbleImg";
  bubbleImg.src = bubbleMeta.img;
  bubbleImg.alt = "";

  const text = document.createElement("span");
  text.className = "liveChatBubbleText";
  text.textContent = finalText;

  bubble.append(bubbleImg, text);
  wrap.append(avatar, bubble);
  el.liveChatLane.appendChild(wrap);

  setTimeout(() => {
    wrap.remove();
  }, 3400);
}

function spawnHeart(intensity) {
  if (!el.liveHeartsLane) return;

  const heart = document.createElement("img");
  heart.className = "liveHeartImg";
  heart.src = HEART_IMG;
  heart.alt = "heart";

  const x = randInt(0, 58);
  const drift = randInt(-10, 10);

  heart.style.right = `${x}px`;
  heart.style.setProperty("--drift-x", `${drift}px`);
  heart.style.setProperty("--heart-scale", `${1 + intensity * 0.2}`);

  el.liveHeartsLane.appendChild(heart);

  setTimeout(() => {
    heart.remove();
  }, 2800);
}

function simulateLivestreamImpact(intensity) {
  const smileScore = clamp(Number(window.__marketingSmileScore) || 0, 0, 1);
  const smileZone = window.__marketingSmileZone || "red";

  const now = performance.now();

  if (!lastSmileTickMs) {
    lastSmileTickMs = now;
  }

  const deltaMs = Math.max(0, now - lastSmileTickMs);
  lastSmileTickMs = now;

  // Only time spent in the green smile zone creates strong livestream views.
  if (smileZone === "green") {
    greenSmileMs += deltaMs;
    window.__marketingGreenSmileSeconds = greenSmileMs / 1000;
  }

  let viewGain = 0;

  if (smileZone === "green") {
  const greenSeconds = greenSmileMs / 1000;

  viewGain =
    randInt(2, 5) +
    Math.floor(greenSeconds * 0.35) +
    Math.floor(smileScore * 3);
} else if (smileZone === "yellow") {
  viewGain = Math.random() < 0.45 ? 1 : 0;
} else {
  viewGain = 0;
}

  gameState.liveSessionViews = clamp(
    (Number(gameState.liveSessionViews) || 0) + viewGain,
    0,
    999999
  );

  renderLiveSessionViews();

  // Followers mostly come from staying green.
  if (smileZone === "green" && Math.random() < 0.25 + smileScore * 0.35) {
    gameState.followers = clamp(
      (Number(gameState.followers) || 0) + randInt(1, 3 + Math.floor(smileScore * 6)),
      0,
      999999
    );
  }

  // Orders are also more likely when smile meter is green.
  const products = getHomeProducts().filter((p) => {
    const reserved = Number(p.reservedQty) || 0;
    const available = (Number(p.qty) || 0) - reserved;
    return available > 0 && (Number(p.price) || 0) > 0;
  });

  if (products.length && smileZone === "green") {
    const conversion = 0.04 + smileScore * 0.12;
    const attempts = randInt(0, 1 + Math.floor(smileScore * 4));

    for (let i = 0; i < attempts; i++) {
      if (Math.random() < conversion) {
        const order = addRandomOrderFromSelectedProducts();
        if (!order) break;
      }
    }
  }

  renderHud();
}

function simulateGhostLivestreamImpact(intensity) {
  // Ghost influencer should work automatically.
  // It does NOT depend on smile detection or camera.
  const viewGain = randInt(2, 5) + Math.floor(intensity * randInt(4, 10));

  gameState.liveSessionViews = clamp(
    (Number(gameState.liveSessionViews) || 0) + viewGain,
    0,
    999999
  );

  renderLiveSessionViews();

  if (Math.random() < 0.25 + intensity * 0.35) {
    gameState.followers = clamp(
      (Number(gameState.followers) || 0) + randInt(1, 4 + Math.floor(intensity * 6)),
      0,
      999999
    );
  }

  const products = getHomeProducts().filter((p) => {
    const reserved = Number(p.reservedQty) || 0;
    const available = (Number(p.qty) || 0) - reserved;
    return available > 0 && (Number(p.price) || 0) > 0;
  });

  if (products.length) {
    const conversion = 0.03 + intensity * 0.12;
    const attempts = randInt(0, 2 + Math.floor(intensity * 4));

    for (let i = 0; i < attempts; i++) {
      if (Math.random() < conversion) {
        const order = addRandomOrderFromSelectedProducts();
        if (!order) break;
      }
    }
  }

  renderHud();
}

function startSpawners() {
  chatSpawnTick = setInterval(() => {
    if (!streaming) return;

    const smileScore = clamp(Number(window.__marketingSmileScore) || 0, 0, 1);
    const smileZone = window.__marketingSmileZone || "red";

    let times = 0;
    if (smileZone === "green") times = 3;
    else if (smileZone === "yellow") times = 1;
    else times = 0;

    for (let i = 0; i < times; i++) {
      spawnChatBubble(smileScore);
    }
  }, 900);

  heartSpawnTick = setInterval(() => {
    if (!streaming) return;

    const smileScore = clamp(Number(window.__marketingSmileScore) || 0, 0, 1);
    const smileZone = window.__marketingSmileZone || "red";

    let times = 0;
    if (smileZone === "green") times = 3;
    else if (smileZone === "yellow") times = 1;
    else times = 0;

    for (let i = 0; i < times; i++) {
      spawnHeart(smileScore);
    }
  }, 700);
}

function stopSpawners() {
  clearInterval(chatSpawnTick);
  clearInterval(heartSpawnTick);
  chatSpawnTick = null;
  heartSpawnTick = null;
}

function stopGhostLivestream() {
  ghostStreaming = false;
  window.__marketingIsStreaming = false;

  clearInterval(ghostStreamTick);
  clearInterval(ghostChatSpawnTick);
  clearInterval(ghostHeartSpawnTick);

  ghostStreamTick = null;
  ghostChatSpawnTick = null;
  ghostHeartSpawnTick = null;

  if (el.liveHoldBtn) {
    el.liveHoldBtn.classList.remove("holding");
  }

  gameState.liveSessionViews = 0;
  renderLiveSessionViews();

  if (el.liveTimer) {
    el.liveTimer.textContent = "00:00";
  }
}

function startGhostLivestream() {
  if (ghostStreaming) return;

  stopLivestream(); // make sure normal hold-to-stream is not running

  ghostStreaming = true;
  ghostStreamStartMs = performance.now();
  gameState.liveSessionViews = 0;

  greenSmileMs = 0;
lastSmileTickMs = 0;
lowSmileToastShown = false;

window.__marketingGreenSmileSeconds = 0;
window.__marketingIsStreaming = true;

  if (el.liveHoldBtn) {
    el.liveHoldBtn.classList.add("holding");
  }

  setTimerFromMs(0);
  renderLiveSessionViews();

  ghostStreamTick = setInterval(() => {
    if (!ghostStreaming) return;

    const heldMs = performance.now() - ghostStreamStartMs;
    setTimerFromMs(heldMs);

    const t = heldMs / 1000;
const intensity = intensityFromHoldSeconds(t);

simulateGhostLivestreamImpact(intensity);
  }, 500);

ghostChatSpawnTick = setInterval(() => {
  if (!ghostStreaming) return;

  const t = (performance.now() - ghostStreamStartMs) / 1000;
  const intensity = intensityFromHoldSeconds(t);

  const times = intensity < 0.25 ? 1 : intensity < 0.6 ? 2 : 3;

  for (let i = 0; i < times; i++) {
    spawnChatBubble(intensity);
  }
}, 900);

 ghostHeartSpawnTick = setInterval(() => {
  if (!ghostStreaming) return;

  const t = (performance.now() - ghostStreamStartMs) / 1000;
  const intensity = intensityFromHoldSeconds(t);

  const times = intensity < 0.25 ? 1 : intensity < 0.6 ? 2 : 3;

  for (let i = 0; i < times; i++) {
    spawnHeart(intensity);
  }
}, 700);
}

function startLivestream() {
  if (streaming) return;

  streaming = true;
  streamStartMs = performance.now();
  gameState.liveSessionViews = 0;

  // Play Mr. Bao voice when the player starts holding livestream
  playSmileVoiceOnce();

  greenSmileMs = 0;
  lastSmileTickMs = 0;
  lowSmileToastShown = false;

  window.__marketingGreenSmileSeconds = 0;
  window.__marketingIsStreaming = true;

  // Removed the start livestream algo toast here

  if (el.liveHoldBtn) {
    el.liveHoldBtn.classList.add("holding");
  }

  setTimerFromMs(0);
  renderLiveSessionViews();

  streamTick = setInterval(() => {
    if (!streaming) return;

    const heldMs = performance.now() - streamStartMs;
    setTimerFromMs(heldMs);

    const t = heldMs / 1000;
    const intensity = intensityFromHoldSeconds(t);

    simulateLivestreamImpact(intensity);
  }, 500);

  startSpawners();
}

function stopLivestream() {
  if (!streaming) return;

  const heldMs = performance.now() - streamStartMs;
  streaming = false;
  window.__marketingIsStreaming = false;

  if (el.liveHoldBtn) {
    el.liveHoldBtn.classList.remove("holding");
  }

  clearInterval(streamTick);
  streamTick = null;
  stopSpawners();

  const gained = Number(gameState.liveSessionViews) || 0;
  if (gained > 0) {
    addViewsAndConvertFollowers(gameState, gained);
  }

  if (heldMs >= 1200) {
    gameState.livestreamsDone = (Number(gameState.livestreamsDone) || 0) + 1;
  }

gameState.liveSessionViews = 0;
renderLiveSessionViews();
renderHud();
}

function maybeShowLivestreamWarning() {
  if (!gameState.running || gameState.ended) return;

  const now = Date.now();
  const cooldownMs = 30000; // only warn every 30 seconds max

  if (now - lastLivestreamWarningAt < cooldownMs) return;

  const views = Number(gameState.views) || 0;
  const followers = Number(gameState.followers) || 0;
  const level = Number(gameState.storeLevel) || 1;

  const viewsDropped =
    lastMarketingViews !== null && views < lastMarketingViews;

  const followersDropped =
    lastMarketingFollowers !== null && followers < lastMarketingFollowers;

  const lowViews = views < 80 * level;
  const lowFollowers = followers < 60 * level;

  if (
  !streaming &&
  (viewsDropped || followersDropped || lowViews || lowFollowers)
) {
  const messages = [
    "MR. BAO IS BORED... GO LIVE TO BRING IN MORE CUSTOMERS.",
    "MR. BAO SAYS YOU'RE LOW IN VIEWS. START LIVESTREAMING.",
    "YOUR STORE NEEDS MORE ATTENTION. HOLD THAT LIVESTREAM BUTTON FOR LONGER.",
    "CUSTOMERS AREN'T VIEWING YOUR PRODUCTS... GO LIVE TO MARKET YOUR STORE."
  ];

  showAlgoToast(
    messages[randInt(0, messages.length - 1)],
    "MR. BAO",
    null,
    3600,
    "marketing"
  );

  lastLivestreamWarningAt = now;
}

  lastMarketingViews = views;
  lastMarketingFollowers = followers;
}

export function enterMarketingPage() {
  initMarketingP5Live();

  stopSmileVoice();
  stopLivestream();

  if (!ghostStreaming) {
    if (el.liveChatLane) el.liveChatLane.innerHTML = "";
    if (el.liveHeartsLane) el.liveHeartsLane.innerHTML = "";

    if (el.liveTimer) {
      el.liveTimer.textContent = "00:00";
    }

    gameState.liveSessionViews = 0;
    renderLiveSessionViews();
  }

  buildMarketingTopStats();
  renderHud();
}

export function beginGhostInfluencerLivestream() {
  if (ghostStreaming) return;
  startGhostLivestream();
}

export function endGhostInfluencerLivestream() {
  stopGhostLivestream();
}

export function initMarketingPage() {
  if (!el.liveHoldBtn) {
    console.error("[Marketing] el.liveHoldBtn is missing. Check dom.js + HTML id.");
    return;
  }

  if (!el.liveChatLane || !el.liveHeartsLane || !el.liveTimer || !el.liveViewsCount) {
    console.error("[Marketing] Missing marketing elements. Check dom.js + HTML ids.");
    return;
  }

  if (el.liveHoldBtn.dataset.bound === "1") return;
  el.liveHoldBtn.dataset.bound = "1";

  el.liveHoldBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startLivestream();
  });

  window.addEventListener("pointerup", stopLivestream);
  window.addEventListener("pointercancel", stopLivestream);
  el.liveHoldBtn.addEventListener("pointerleave", stopLivestream);

  window.addEventListener("blur", stopLivestream);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopLivestream();
  });
  initMarketingP5Live();
  buildMarketingTopStats();
  renderHud();
}

window.addEventListener("toobao:stopAllSounds", () => {
  stopDayOverlaySound();
});
