// js/systems/messagesSystem.js

import { gameState } from "../state.js";
import {
  clamp,
  randInt,
  syncStoreLevelFromFollowers,
  addViewsAndConvertFollowers,
  subtractViews
} from "../utils.js";
import { CHAT_CUSTOMERS, INQUIRY_LIBRARY } from "../data/inquiries.js";
import { avatarImages } from "../data/avatars.js";
import { showAlgoToast } from "./toast.js";
import { getSelectedProductsSnapshot } from "../store/productsStore.js";

/* ============================= */
/* Config */
/* ============================= */
const CHAT_CAP_BY_LEVEL = {
  1: 2,
  2: 5,
  3: 10,
  4: 15,
  5: 20
};

const CHAT_REWARD_VIEWS_MIN = 25;
const CHAT_REWARD_VIEWS_MAX = 75;

const CHAT_REWARD_FOLLOWERS_MIN = 15;
const CHAT_REWARD_FOLLOWERS_MAX = 30;

const CHAT_PENALTY_VIEWS_MIN = 25;
const CHAT_PENALTY_VIEWS_MAX = 75;

const CHAT_PENALTY_FOLLOWERS_MIN = 50;
const CHAT_PENALTY_FOLLOWERS_MAX = 100;

const CHAT_TIMEOUT_MIN_SEC = 45;
const CHAT_TIMEOUT_MAX_SEC = 65;

const CHAT_GLOBAL_SPAWN_COOLDOWN_SEC = 18;
const SAME_CUSTOMER_MESSAGE_COOLDOWN_SEC = 45;

const SPAM_REWARD_VIEWS_MIN = 20;
const SPAM_REWARD_VIEWS_MAX = 50;

const SPAM_REWARD_FOLLOWERS_MIN = 10;
const SPAM_REWARD_FOLLOWERS_MAX = 20;

const SPAM_PENALTY_VIEWS_MIN = 15;
const SPAM_PENALTY_VIEWS_MAX = 50;

const SPAM_PENALTY_FOLLOWERS_MIN = 15;
const SPAM_PENALTY_FOLLOWERS_MAX = 50;

const SPAM_TARGET_BY_LEVEL = {
  1: [0, 0],
  2: [1, 2],
  3: [3, 4],
  4: [5, 6],
  5: [7, 8]
};

function maxSpawnsPerTrafficTick(level) {
  if (level <= 1) return 1;
  if (level === 2) return 1;
  if (level === 3) return 1;
  if (level === 4) return 2;
  return 2;
}

const SPAM_MESSAGE_LIBRARY = [
  "Congrats seller! Click this link to claim 9999 free views!!!",
  "Hello store owner, send password to verify your shop.",
  "I can make your store 5 stars today. Pay first.",
  "Free followers available now!!! Accept this message.",
  "Your shop will be deleted unless you reply yes.",
  "Urgent platform check: send your login code.",
  "Buy fake reviews for cheap. Top seller guaranteed.",
  "Hello seller, I am official toobao support. Trust me.",
  "You won a secret algorithm boost. Claim now.",
  "Please transfer coins to unlock viral traffic."
];
function getSpamTargetForToday() {
  initMessagesStateIfNeeded();

  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const range = SPAM_TARGET_BY_LEVEL[level] || [0, 0];

  if (typeof gameState.messages.dailySpamTarget !== "number") {
    gameState.messages.dailySpamTarget = randInt(range[0], range[1]);
  }

  return gameState.messages.dailySpamTarget;
}

function isSpamByStars() {
  initMessagesStateIfNeeded();

  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));

  if (level <= 1) return false;

  if (typeof gameState.messages.dailySpamSpawned !== "number") {
    gameState.messages.dailySpamSpawned = 0;
  }

  const spamTarget = getSpamTargetForToday();

  if (gameState.messages.dailySpamSpawned >= spamTarget) return false;

  const spamChances = {
    2: 0.18,
    3: 0.28,
    4: 0.38,
    5: 0.48
  };

  const madeSpam = Math.random() < (spamChances[level] || 0);

  if (madeSpam) {
    gameState.messages.dailySpamSpawned += 1;
  }

  return madeSpam;
}
/* ============================= */
/* Init */
/* ============================= */

function ensureChatAnalyticsState() {
  if (!gameState.analytics) {
    gameState.analytics = {
      daily: [],
      lifetime: {}
    };
  }

  if (!gameState.analytics.lifetime) {
    gameState.analytics.lifetime = {};
  }

  if (typeof gameState.analytics.lifetime.chatResponseSecTotal !== "number") {
    gameState.analytics.lifetime.chatResponseSecTotal = 0;
  }

  if (typeof gameState.analytics.lifetime.chatResponseCount !== "number") {
    gameState.analytics.lifetime.chatResponseCount = 0;
  }
}

function recordChatReplySpeed(seconds) {
  ensureChatAnalyticsState();
  const safe = Math.max(0, Number(seconds) || 0);
  gameState.analytics.lifetime.chatResponseSecTotal += safe;
  gameState.analytics.lifetime.chatResponseCount += 1;
}

export function initMessagesStateIfNeeded() {
  if (!gameState.messages) {
    gameState.messages = {
      threads: [],
      unreadTotal: 0,
      dailySpawned: 0,
      dayOfDailySpawned: gameState.day || 1,
      lastViewsCheckpoint: 0,
      lastSpawnSec: -999
    };
  }

  if (!Array.isArray(gameState.messages.threads)) gameState.messages.threads = [];
  if (typeof gameState.messages.unreadTotal !== "number") gameState.messages.unreadTotal = 0;
  if (typeof gameState.messages.dailySpawned !== "number") gameState.messages.dailySpawned = 0;
  if (typeof gameState.messages.dayOfDailySpawned !== "number") {
    gameState.messages.dayOfDailySpawned = gameState.day || 1;
  }
  if (typeof gameState.messages.lastSpawnSec !== "number") {
    gameState.messages.lastSpawnSec = -999;
  }
  if (typeof gameState.messages.dailySpamSpawned !== "number") {
  gameState.messages.dailySpamSpawned = 0;
}

if (!("dailySpamTarget" in gameState.messages)) {
  gameState.messages.dailySpamTarget = undefined;
}
  if (typeof gameState.chatClockSec !== "number") gameState.chatClockSec = 0;
  if (typeof gameState._ticks !== "number") gameState._ticks = 0;
  if (typeof gameState._threadSeq !== "number") gameState._threadSeq = 0;

  ensureChatAnalyticsState();

  if (!window.__forceChat) {
    window.__forceChat = (n = 1) => {
      initMessagesStateIfNeeded();
      for (let i = 0; i < n; i++) {
        const made = createInquiry();
        if (!made) break;
        gameState.messages.dailySpawned += 1;
      }
      refreshChatNavBadge();
      window.__refreshChatUI?.();
    };
  }
}

function resetDailyIfNeeded() {
  initMessagesStateIfNeeded();

  const today = gameState.day || 1;

  if (gameState.messages.dayOfDailySpawned !== today) {
    gameState.messages.dayOfDailySpawned = today;
    gameState.messages.dailySpawned = 0;
    gameState.messages.dailySpamSpawned = 0;
    gameState.messages.dailySpamTarget = undefined;
  }
}

/* ============================= */
/* Getters */
/* ============================= */

export function getUnreadTotal() {
  initMessagesStateIfNeeded();
  return gameState.messages.unreadTotal || 0;
}

export function getThreads() {
  initMessagesStateIfNeeded();
  return gameState.messages.threads;
}

export function getThreadById(threadId) {
  initMessagesStateIfNeeded();
  return gameState.messages.threads.find((t) => t.id === threadId) || null;
}

export function markThreadRead(threadId) {
  const t = getThreadById(threadId);
  if (!t) return;

  if (t.unreadCount > 0) {
    gameState.messages.unreadTotal = Math.max(
      0,
      (gameState.messages.unreadTotal || 0) - t.unreadCount
    );
    t.unreadCount = 0;
  }

  refreshChatNavBadge();
}

/* ============================= */
/* Badge */
/* ============================= */

export function refreshChatNavBadge() {
  initMessagesStateIfNeeded();
  const badge = document.getElementById("navChatBadge");
  if (!badge) return;

  badge.classList.remove("is-hidden");
  badge.textContent = String(getUnreadTotal());
}

/* ============================= */
/* Helpers */
/* ============================= */

function nowTick() {
  gameState._ticks = (gameState._ticks || 0) + 1;
  return gameState._ticks;
}

function nowSec() {
  initMessagesStateIfNeeded();
  return gameState.chatClockSec;
}

function pickRandom(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function makeThreadId() {
  gameState._threadSeq = (gameState._threadSeq || 0) + 1;
  return `t${gameState._threadSeq}`;
}

function makeCustomerHandle() {
  const names = [
    "BOB",
    "FINGER_PISTOL",
    "GARY_THE_SNAIL",
    "SHORT_KING",
    "CHEESE_WIZARD",
    "POTATO_PATATO",
    "SCREEN_SLAYER",
    "PETUNIA",
    "DANIEL_TIGER",
    "DUCK_DUCK_GOOSE",
    "TWINKLE_TOES",
    "POOKIE_BEAR",
    "BIG_BACK",
    "OLD_MCDONALD",
    "PEBBLE",
    "DINO_NUGGET",
    "CRAZY_BOSS",
    "BROCCOLI_LOVER123",
    "PERRY_THE_PLATYPUS",
    "SOGGY_WAFFLES"
  ];

  return pickRandom(names) + randInt(10, 99);
}

function randomAvatar() {
  return avatarImages[randInt(0, avatarImages.length - 1)];
}

function getChatCapByStars() {
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  return CHAT_CAP_BY_LEVEL[level] || 5;
}

function countActiveChats() {
  return (gameState.messages?.threads || []).filter((t) => t.status === "open").length;
}

function rewardResolvedChat() {
  const views = randInt(CHAT_REWARD_VIEWS_MIN, CHAT_REWARD_VIEWS_MAX);
  const followers = randInt(CHAT_REWARD_FOLLOWERS_MIN, CHAT_REWARD_FOLLOWERS_MAX);

  addViewsAndConvertFollowers(gameState, views);

  gameState.followers = Math.max(
    0,
    (Number(gameState.followers) || 0) + followers
  );

  syncStoreLevelFromFollowers(gameState);

  return { views, followers };
}

function penalizeFailedChat() {
  const views = randInt(CHAT_PENALTY_VIEWS_MIN, CHAT_PENALTY_VIEWS_MAX);
  const followers = randInt(CHAT_PENALTY_FOLLOWERS_MIN, CHAT_PENALTY_FOLLOWERS_MAX);

  subtractViews(gameState, views);

  gameState.followers = Math.max(
    0,
    (Number(gameState.followers) || 0) - followers
  );

  syncStoreLevelFromFollowers(gameState);

  return { views, followers };
}

function moveThreadToTop(threadId) {
  const t = getThreadById(threadId);
  if (!t) return;
  gameState.messages.threads = [
    t,
    ...gameState.messages.threads.filter((x) => x.id !== threadId)
  ];
}

function closeThreadAndClearUnread(thread, nextStatus) {
  thread.status = nextStatus;
  thread.lastUpdatedTick = nowTick();

  if (thread.unreadCount > 0) {
    gameState.messages.unreadTotal = Math.max(
      0,
      (gameState.messages.unreadTotal || 0) - thread.unreadCount
    );
    thread.unreadCount = 0;
  }
}

function applyTimeoutPenalty() {
  return penalizeFailedChat();
}

function applyBadChatPenalty(message) {
  const penalty = penalizeFailedChat();

  showAlgoToast(
    `${message} -${penalty.views} views -${penalty.followers} followers`,
    "MR. BAO",
    null,
    3600,
    "chat",
    "views_followers"
  );

  return penalty;
}

function unresolvedPendings(thread) {
  return (thread.pendingQueue || []).filter((p) => !p.resolved);
}

function addCustomerFollowUp(thread, sourcePending, text) {
  const tick = nowTick();
  const askedAtSec = nowSec();

  thread.messages.push({
    from: "customer",
    text,
    tick
  });

  thread.pendingQueue.push({
  prompt: text,
  acceptableKeywords: [...(sourcePending.acceptableKeywords || [])],
  askedTick: tick,
  askedAtSec,
  timeoutSec: randInt(CHAT_TIMEOUT_MIN_SEC, CHAT_TIMEOUT_MAX_SEC),
  resolved: false,

  // This prevents endless “I’m confused” loops.
  isConfusionFollowUp: true
});

  thread.status = "open";
  thread.unreadCount += 1;
  gameState.messages.unreadTotal += 1;
  thread.lastUpdatedTick = tick;
  thread.lastCustomerMessageAtSec = askedAtSec;

  moveThreadToTop(thread.id);
}

function rewardSuccessfulReply() {
  return rewardResolvedChat();
}

function getPenaltySystemLine(message, penalty) {
  return `
    ${message}
    <span class="chatStatChange">
      -${penalty.views} VIEWS
      <img src="assets/ui_icons/views_icon.png" alt="">
    </span>
    <span class="chatStatChange">
      -${penalty.followers} FOLLOWERS
      <img src="assets/ui_icons/followers_icon.png" alt="">
    </span>
  `;
}

function getSuccessSystemLine(reward) {
  const lines = [
    `GOOD JOB! CUSTOMER DECIDES TO BUY SOMETHING.`,
    `AMAZING! CUSTOMER DECIDES TO FOLLOW YOUR STORE.`,
    `NICE! CUSTOMER VALUES YOUR RESPONSE.`
  ];

  return `
    ${pickRandom(lines)}
    <span class="chatStatChange">
      +${reward.views} VIEWS
      <img src="assets/ui_icons/views_icon.png" alt="">
    </span>
    <span class="chatStatChange">
      +${reward.followers} FOLLOWERS
      <img src="assets/ui_icons/followers_icon.png" alt="">
    </span>
  `;
}

function getWrongOutcome() {
  const outcomes = ["confused", "left", "not_buying"];
  return pickRandom(outcomes);
}

function countKeywordHits(replyLower, pending) {
  const keys = Array.isArray(pending.acceptableKeywords) ? pending.acceptableKeywords : [];
  return keys.filter((k) => replyLower.includes(String(k).toLowerCase())).length;
}

function findBestPendingMatch(thread, replyText) {
  const pendingList = unresolvedPendings(thread);
  if (!pendingList.length) return null;

  const lower = String(replyText || "").toLowerCase();

  let best = null;
  let bestHits = 0;

  for (const pending of pendingList) {
    const hits = countKeywordHits(lower, pending);

    if (hits > bestHits) {
      best = pending;
      bestHits = hits;
    }
  }

  if (bestHits <= 0) return null;

  return {
    pending: best,
    hits: bestHits
  };
}

function oldestUnresolvedPending(thread) {
  const list = unresolvedPendings(thread);
  if (!list.length) return null;

  return list.slice().sort((a, b) => {
    const aSec = Number(a.askedAtSec) || 0;
    const bSec = Number(b.askedAtSec) || 0;
    return aSec - bSec;
  })[0] || null;
}

function canSpawnAnyChatNow() {
  const sec = nowSec();
  const last = Number(gameState.messages.lastSpawnSec) || -999;
  return sec - last >= CHAT_GLOBAL_SPAWN_COOLDOWN_SEC;
}

function canExistingThreadReceiveMessage(thread) {
  if (!thread || thread.status !== "open") return false;

  const lastSec = Number(thread.lastCustomerMessageAtSec) || -999;
  return (nowSec() - lastSec) >= SAME_CUSTOMER_MESSAGE_COOLDOWN_SEC;
}
function getRandomProductForChat() {
  // Chat should mention products the store has listed,
  // even if the product is currently sold out.
  const products = getSelectedProductsSnapshot().filter((p) => p && p.name);

  if (!products.length) {
    return {
      name: "item",
      price: randInt(10, 50)
    };
  }

  const picked = pickRandom(products);

  return {
    name: String(picked.name || "item").toLowerCase(),
    price: Number(picked.price) || randInt(10, 50)
  };
}


/* ============================= */
/* Success Multiplier */
/* ============================= */

function successMult() {
  const views = gameState.views || 0;
  const followers = gameState.followers || 0;
  const level = gameState.storeLevel || 1;

  const viewFactor = clamp(views / 1000, 0, 1);
  const followerFactor = clamp(followers / 500, 0, 1);
  const levelFactor = clamp((level - 1) / 4, 0, 1);

  return 0.85 + (viewFactor * 0.45) + (followerFactor * 0.60) + (levelFactor * 0.15);
}

/* ============================= */
/* 1s Tick: Timeouts */
/* ============================= */

export function tickChatSecond() {
  initMessagesStateIfNeeded();
  resetDailyIfNeeded();
  gameState.chatClockSec += 1;

  let changed = false;

  for (const t of gameState.messages.threads) {
    if (!t || t.status !== "open") continue;

    const pendingList = unresolvedPendings(t);
    if (!pendingList.length) continue;

    const timedOutPending = pendingList.find((p) => {
      const timeoutSec = Number(p.timeoutSec) || 90;
      const elapsed = nowSec() - (Number(p.askedAtSec) || 0);
      return elapsed >= timeoutSec;
    });

    if (timedOutPending) {
      timedOutPending.resolved = true;
      // Important: mark checked true so the accept/decline overlay disappears
      t.checked = true;

      closeThreadAndClearUnread(t, "left");

      const penalty = applyTimeoutPenalty();

      t.messages.push({
        from: "system",
        html: getPenaltySystemLine("CUSTOMER TIMED OUT AND LEFT.", penalty),
        tick: nowTick()
      });

      showAlgoToast(
        `${t.customerName} timed out and left. -${penalty.views} views and -${penalty.followers} followers`,
        "MR. BAO",
        null,
        3600,
        "chat",
        "views_followers"
      );

      changed = true;
    }
  }

  refreshChatNavBadge();

  if (changed) {
    window.__refreshChatUI?.();
  }
}

/* ============================= */
/* Spawn */
/* ============================= */

export function tickChatTrafficLikeOrders() {
  initMessagesStateIfNeeded();
  resetDailyIfNeeded();

  if (!Array.isArray(CHAT_CUSTOMERS) || CHAT_CUSTOMERS.length === 0) return;
  if (!Array.isArray(INQUIRY_LIBRARY) || INQUIRY_LIBRARY.length === 0) return;

  const views = gameState.views || 0;
  const followers = gameState.followers || 0;
  const level = gameState.storeLevel || 1;
  const starCap = getChatCapByStars();

  let attempts = 0;
  let openCap = 0;
  let dailyCap = 0;
  let chatProb = 0;

  if (level <= 1) {
    attempts = clamp(Math.floor(views / 180), 0, 4);
    openCap = starCap;
    dailyCap = starCap;
    chatProb = 0.08 + (views / 6000) + (followers / 10000);
  } else if (level === 2) {
    attempts = clamp(Math.floor(views / 140), 0, 6);
    openCap = starCap;
    dailyCap = starCap;
    chatProb = 0.11 + (views / 5000) + (followers / 9000);
  } else if (level === 3) {
    attempts = clamp(Math.floor(views / 110), 0, 8);
    openCap = starCap;
    dailyCap = starCap;
    chatProb = 0.15 + (views / 4200) + (followers / 8000);
  } else if (level === 4) {
    attempts = clamp(Math.floor(views / 90), 0, 11);
    openCap = starCap;
    dailyCap = starCap;
    chatProb = 0.20 + (views / 3500) + (followers / 7000);
  } else {
    attempts = clamp(Math.floor(views / 70), 0, 14);
    openCap = starCap;
    dailyCap = starCap;
    chatProb = 0.26 + (views / 3000) + (followers / 6500);
  }

  if (attempts <= 0) return;

  const currentOpen = gameState.messages.threads.filter((t) => t.status === "open").length;
  if (currentOpen >= openCap) return;

  if (gameState.messages.dailySpawned >= dailyCap) return;

  chatProb += (clamp(gameState.visibility ?? 50, 0, 100) / 900);
  chatProb *= clamp(1 - (gameState.missedTasks || 0) * 0.08, 0.6, 1);
  chatProb *= clamp(successMult(), 0.8, 1.6);
  chatProb = clamp(chatProb, 0.04, 0.65);

  let createdThisTick = 0;
  const tickCap = maxSpawnsPerTrafficTick(level);

  for (let i = 0; i < attempts; i++) {
    if (gameState.messages.dailySpawned >= dailyCap) break;
    if (createdThisTick >= tickCap) break;

    if (
      gameState.messages.threads.filter((t) => t.status === "open").length >= openCap
    ) break;

    if (!canSpawnAnyChatNow()) break;

    if (Math.random() < chatProb) {
      const created = createInquiry();
      if (created) {
        gameState.messages.dailySpawned += 1;
        createdThisTick += 1;
      }
    }
  }

  if (createdThisTick > 0) {
  refreshChatNavBadge();
  window.__refreshChatUI?.();
}
}

/* ============================= */
/* Create Inquiry */
/* ============================= */

function createInquiry() {
  if (!canSpawnAnyChatNow()) return false;
  if (countActiveChats() >= getChatCapByStars()) return false;
  if ((gameState.messages.dailySpawned || 0) >= getChatCapByStars()) return false;

  const inquiry = pickRandom(INQUIRY_LIBRARY);
  const chatProduct = getRandomProductForChat();
  const productName = String(chatProduct.name || "item").toLowerCase();
const productPrice = chatProduct.price;
const cheapPrice = Math.max(1, productPrice - randInt(2, 8));

const spamMessage = pickRandom(SPAM_MESSAGE_LIBRARY);
const isSpamMessage = isSpamByStars();

const prompt = isSpamMessage
  ? spamMessage
  : String(inquiry.prompt || "")
      .replaceAll("{product}", productName)
      .replaceAll("{price}", productPrice)
      .replaceAll("{cheapPrice}", cheapPrice);

  
  const tick = nowTick();
  const askedAtSec = nowSec();

  const openCustomerIds = new Set(
    gameState.messages.threads
      .filter((t) => t.status === "open")
      .map((t) => t.customerId)
  );

  const availableNewCustomers = CHAT_CUSTOMERS.filter((c) => !openCustomerIds.has(c.id));

  if (availableNewCustomers.length > 0) {
    const customer = pickRandom(availableNewCustomers);

    const thread = {
      id: makeThreadId(),
      customerId: customer.id,
      customerName: makeCustomerHandle(),
      customerAvatar: randomAvatar(),
      isSpam: isSpamMessage,
      checked: false,

      status: "open",
      unreadCount: 1,
      lastUpdatedTick: tick,
      lastCustomerMessageAtSec: askedAtSec,

      messages: [{ from: "customer", text: prompt, tick }],

      pendingQueue: [{
  prompt: prompt,
  acceptableKeywords: isSpamMessage ? [] : inquiry.acceptableKeywords,
  askedTick: tick,
  askedAtSec,
  timeoutSec: randInt(CHAT_TIMEOUT_MIN_SEC, CHAT_TIMEOUT_MAX_SEC),
  resolved: false
}]
    };

    gameState.messages.threads.unshift(thread);
    gameState.messages.unreadTotal += 1;
    gameState.messages.lastSpawnSec = askedAtSec;

    showAlgoToast(
      `${thread.customerName} has left you a message. Answer their questions fast!`, "MR. BAO", null, 3600, "chat"
    );
    return true;
  }

  const eligibleExisting = gameState.messages.threads.filter(
    (t) => t.status === "open" && canExistingThreadReceiveMessage(t)
  );

  if (!eligibleExisting.length) return false;

  const existing = pickRandom(eligibleExisting);

// New customer message = screen again
const isExistingSpamMessage = isSpamByStars();

existing.isSpam = isExistingSpamMessage;
existing.checked = false;

const existingMessageText = isExistingSpamMessage
  ? pickRandom(SPAM_MESSAGE_LIBRARY)
  : prompt;

existing.messages.push({
  from: "customer",
  text: existingMessageText,
  tick
});

existing.pendingQueue.push({
  prompt: existingMessageText,
  acceptableKeywords: isExistingSpamMessage ? [] : inquiry.acceptableKeywords,
  askedTick: tick,
  askedAtSec,
  timeoutSec: randInt(CHAT_TIMEOUT_MIN_SEC, CHAT_TIMEOUT_MAX_SEC),
  resolved: false
});

  existing.unreadCount += 1;
  gameState.messages.unreadTotal += 1;
  existing.lastUpdatedTick = tick;
  existing.lastCustomerMessageAtSec = askedAtSec;

  moveThreadToTop(existing.id);
  gameState.messages.lastSpawnSec = askedAtSec;

  showAlgoToast(
    `${existing.customerName} has left you a message. Answer customer questions!`, "MR. BAO", null, 3600, "chat"
  );
  return true;
}

/* ============================= */
/* Player Reply */
/* ============================= */


export function submitPlayerReply(threadId, replyText) {
  const t = getThreadById(threadId);
  if (!t || t.status !== "open") return { ok: false };

  const tick = nowTick();
  const trimmed = (replyText || "").trim();
  if (!trimmed) return { ok: false };

  const pendingList = unresolvedPendings(t);
  if (!pendingList.length) return { ok: false };

  const currentPending = oldestUnresolvedPending(t);
  if (currentPending) {
    const elapsedSec = nowSec() - (Number(currentPending.askedAtSec) || 0);
    recordChatReplySpeed(elapsedSec);
  }

  t.messages.push({ from: "player", text: trimmed, tick });
  t.lastUpdatedTick = tick;
  moveThreadToTop(t.id);

  const match = findBestPendingMatch(t, trimmed);

  /* =============================
     CORRECT / MATCHED REPLY
  ============================= */

  if (match) {
    match.pending.resolved = true;

    const reward = rewardSuccessfulReply();

    t.messages.push({
      from: "system",
      html: getSuccessSystemLine(reward),
      tick: nowTick()
    });

    if (!unresolvedPendings(t).length) {
      closeThreadAndClearUnread(t, "resolved");
    } else {
      t.status = "open";
    }

    refreshChatNavBadge();
    window.__refreshChatUI?.();

    return { ok: true };
  }

  /* =============================
     WRONG / NO MATCH REPLY
  ============================= */

  const current = oldestUnresolvedPending(t);

  // If this was already the customer's "explain it another way" follow-up,
  // do not let the chat stay active forever. Close it after another unclear reply.
  if (current?.isConfusionFollowUp) {
    current.resolved = true;

    closeThreadAndClearUnread(t, "confused_closed");

    const penalty = applyBadChatPenalty(
      `${t.customerName} is still confused and stops replying.`
    );

    t.messages.push({
      from: "system",
      html: getPenaltySystemLine(
        "CUSTOMER IS STILL CONFUSED AND CLOSES THE CHAT.",
        penalty
      ),
      tick: nowTick()
    });

    refreshChatNavBadge();
    window.__refreshChatUI?.();

    return { ok: true };
  }

  const outcome = getWrongOutcome();

  if (outcome === "confused") {
    const continues = Math.random() < 0.55;

    if (continues) {
      // Important: the original pending question is now handled.
      // Only the new follow-up explanation request should stay active.
      if (current) {
        current.resolved = true;
      }

      t.messages.push({
        from: "system",
        text: "Customer is confused and wants one more explanation.",
        tick: nowTick()
      });

      if (current) {
        addCustomerFollowUp(
          t,
          current,
          "I’m still a little confused — can you explain that another way?"
        );

      } else {
        closeThreadAndClearUnread(t, "confused_closed");

        const penalty = applyBadChatPenalty(
          `${t.customerName} is confused and stops replying.`
        );

        t.messages.push({
          from: "system",
          html: getPenaltySystemLine(
            "CUSTOMER IS CONFUSED AND CLOSES THE CHAT.",
            penalty
          ),
          tick: nowTick()
        });
      }
    } else {
      if (current) {
        current.resolved = true;
      }

      closeThreadAndClearUnread(t, "confused_closed");

      const penalty = applyBadChatPenalty(
        `${t.customerName} is unsatisfied with your responses and left.`
      );

      t.messages.push({
        from: "system",
        html: getPenaltySystemLine(
          "CUSTOMER IS CONFUSED AND STOPS REPLYING.",
          penalty
        ),
        tick: nowTick()
      });
    }
  }

  if (outcome === "left") {
    if (current) {
      current.resolved = true;
    }

    closeThreadAndClearUnread(t, "left");

    const penalty = applyBadChatPenalty(
      `${t.customerName}'s conversation ended badly. Check your chats.`
    );

    t.messages.push({
      from: "system",
      html: getPenaltySystemLine("CUSTOMER LEFT THE CONVERSATION.", penalty),
      tick: nowTick()
    });
  }

  if (outcome === "not_buying") {
    if (current) {
      current.resolved = true;
    }

    closeThreadAndClearUnread(t, "not_buying");

    const penalty = applyBadChatPenalty(
      `${t.customerName} is unsatisfied with your responses and left.`
    );

    t.messages.push({
      from: "system",
      html: getPenaltySystemLine(
        "CUSTOMER DECIDES NOT TO BUY ANYTHING.",
        penalty
      ),
      tick: nowTick()
    });
  }

  refreshChatNavBadge();
  window.__refreshChatUI?.();

  return { ok: true };
}

export function resolveMessageScreening(threadId, accepted) {
  const thread = getThreadById(threadId);
  if (!thread || thread.status !== "open") return { ok: false };

  const secsLeft = getThreadTimeLeft(thread);

  if (secsLeft !== null && secsLeft <= 0) {
    thread.checked = true;
    closeThreadAndClearUnread(thread, "left");

    const penalty = applyTimeoutPenalty();

    thread.messages.push({
      from: "system",
      html: getPenaltySystemLine("CUSTOMER TIMED OUT AND LEFT.", penalty),
      tick: nowTick()
    });

    showAlgoToast(
      `${thread.customerName} timed out and left. -${penalty.views} views and -${penalty.followers} followers`,
      "MR. BAO",
      null,
      3600,
      "chat",
      "views_followers"
    );

    refreshChatNavBadge();
    window.__refreshChatUI?.();

    return { ok: false, closed: true, result: "timed_out" };
  }

  if (thread.checked) {
    return {
      ok: true,
      closed: thread.status !== "open",
      alreadyChecked: true
    };
  }

  thread.checked = true;
  thread.lastUpdatedTick = nowTick();

  // keep the rest of your existing resolveMessageScreening code below this

  const reward = {
    views: randInt(SPAM_REWARD_VIEWS_MIN, SPAM_REWARD_VIEWS_MAX),
    followers: randInt(SPAM_REWARD_FOLLOWERS_MIN, SPAM_REWARD_FOLLOWERS_MAX)
  };

  const penalty = {
    views: randInt(SPAM_PENALTY_VIEWS_MIN, SPAM_PENALTY_VIEWS_MAX),
    followers: randInt(SPAM_PENALTY_FOLLOWERS_MIN, SPAM_PENALTY_FOLLOWERS_MAX)
  };

  function applySmallReward() {
    addViewsAndConvertFollowers(gameState, reward.views);

    gameState.followers = Math.max(
      0,
      (Number(gameState.followers) || 0) + reward.followers
    );

    syncStoreLevelFromFollowers(gameState);
  }

  function applySmallPenalty() {
    subtractViews(gameState, penalty.views);

    gameState.followers = Math.max(
      0,
      (Number(gameState.followers) || 0) - penalty.followers
    );

    syncStoreLevelFromFollowers(gameState);
  }

  if (thread.isSpam) {
    if (accepted) {
      applySmallPenalty();
      closeThreadAndClearUnread(thread, "closed");

      thread.messages.push({
        from: "system",
        html: `
          THAT WAS A SPAM MESSAGE.
          <span class="chatStatChange">
            -${penalty.views} VIEWS
            <img src="assets/ui_icons/views_icon.png" alt="">
          </span>
          <span class="chatStatChange">
            -${penalty.followers} FOLLOWERS
            <img src="assets/ui_icons/followers_icon.png" alt="">
          </span>
        `,
        tick: nowTick()
      });

      /* showAlgoToast(
        `That was spam. -${penalty.views} views and -${penalty.followers} followers`,
        "MR. BAO",
        null,
        3600,
        "chat",
        "views_followers"
      );*/

      refreshChatNavBadge();
      window.__refreshChatUI?.();

      return { ok: true, closed: true, result: "accepted_spam" };
    }

    applySmallReward();
    closeThreadAndClearUnread(thread, "closed");

    thread.messages.push({
      from: "system",
      html: `
        NICE CATCH! YOU DECLINED A SPAM MESSAGE.
        <span class="chatStatChange">
          +${reward.views} VIEWS
          <img src="assets/ui_icons/views_icon.png" alt="">
        </span>
        <span class="chatStatChange">
          +${reward.followers} FOLLOWERS
          <img src="assets/ui_icons/followers_icon.png" alt="">
        </span>
      `,
      tick: nowTick()
    });

    /* showAlgoToast(
      `Nice catch! +${reward.views} views and +${reward.followers} followers`,
      "MR. BAO",
      null,
      3600,
      "chat",
      "views_followers"
    ); */

    refreshChatNavBadge();
    window.__refreshChatUI?.();

    return { ok: true, closed: true, result: "declined_spam" };
  }

  if (accepted) {
    applySmallReward();

    thread.messages.push({
      from: "system",
      html: `
        GOOD CHOICE! THIS IS A REAL CUSTOMER.
        <span class="chatStatChange">
          +${reward.views} VIEWS
          <img src="assets/ui_icons/views_icon.png" alt="">
        </span>
        <span class="chatStatChange">
          +${reward.followers} FOLLOWERS
          <img src="assets/ui_icons/followers_icon.png" alt="">
        </span>
      `,
      tick: nowTick()
    });

   /* showAlgoToast(
  `Good choice! Real customer. +${reward.views} views +${reward.followers} followers`,
  "MR. BAO",
  null,
  3600,
  "chat",
  "views_followers"
); */

    refreshChatNavBadge();
    window.__refreshChatUI?.();

    return { ok: true, closed: false, result: "accepted_real" };
  }

  applySmallPenalty();
  closeThreadAndClearUnread(thread, "closed");

  thread.messages.push({
    from: "system",
    html: `
      YOU DECLINED A REAL CUSTOMER.
      <span class="chatStatChange">
        -${penalty.views} VIEWS
        <img src="assets/ui_icons/views_icon.png" alt="">
      </span>
      <span class="chatStatChange">
        -${penalty.followers} FOLLOWERS
        <img src="assets/ui_icons/followers_icon.png" alt="">
      </span>
    `,
    tick: nowTick()
  });

  /* showAlgoToast(
    `You declined a real customer. -${penalty.views} views and -${penalty.followers} followers`,
    "MR. BAO",
    null,
    3600,
    "chat",
    "views_followers"
  ); */

  refreshChatNavBadge();
  window.__refreshChatUI?.();

  return { ok: true, closed: true, result: "declined_real" };
}

// Add this to the bottom of js/systems/messagesSystem.js

export function getThreadTimeLeft(thread) {
  if (!thread || thread.status !== "open") return null;

  const pendingList = (thread.pendingQueue || []).filter((p) => !p.resolved);
  if (!pendingList.length) return null;

  const oldest = pendingList
    .slice()
    .sort((a, b) => (Number(a.askedAtSec) || 0) - (Number(b.askedAtSec) || 0))[0];

  const now = Number(gameState.chatClockSec) || 0;
  const elapsed = now - (Number(oldest.askedAtSec) || 0);
  const totalLimit = Number(oldest.timeoutSec) || 90;

  return Math.max(0, totalLimit - elapsed);
}