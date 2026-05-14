// js/pages/chat.js

import { el } from "../dom.js";
import { shopInfo, gameState } from "../state.js";
import { avatarImages } from "../data/avatars.js";
import {
  getThreads,
  getThreadById,
  markThreadRead,
  submitPlayerReply,
  getUnreadTotal,
  getThreadTimeLeft,
  initMessagesStateIfNeeded,
  resolveMessageScreening
} from "../systems/messagesSystem.js";
import { renderHud } from "./home.js";
import { formatTime } from "../utils.js";
import { openEditProfile } from "../modals/editProfile.js";

let currentThreadId = null;
let currentInboxFilter = "ALL";
let chatroomRefs = null;
let chatRefreshTimer = null;

// SLIDER STATE
let destroyChatSlider = null;
let isDraggingChatSlider = false;
let savedChatScroll = 0;

let cleanupChatKeyboardFix = null;

const CHAT_TAB_ASSETS = {
  ALL: { inactive: "assets/chat/alltab.png", active: "assets/chat/alltaborange.png" },
  UNREAD: { inactive: "assets/chat/unreadtab.png", active: "assets/chat/unreadtaborange.png" },
  ACTIVE: { inactive: "assets/chat/activetab.png", active: "assets/chat/activetaborange.png" },
  RESOLVED: { inactive: "assets/chat/resolvedtab.png", active: "assets/chat/resolvedtaborange.png" },
  CLOSED: { inactive: "assets/chat/closedtab.png", active: "assets/chat/closedtaborange.png" }
};

function customerAvatarSrc(thread) {
  return thread.customerAvatar || "assets/avatars/flowerpfp.png";
}

function playerAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;
  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "assets/avatars/flowerpfp.png";
}

function resolveStoreAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;
  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "assets/avatars/flowerpfp.png";
}

function escapeHtml(str = "") {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatCompact(n) {
  const num = Math.floor(Number(n) || 0);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

function getAvailableBoxes() {
  return Math.max(0, (Number(gameState.shippingMaterials) || 0) - (Number(gameState.reservedShippingMaterials) || 0));
}

function stripHtml(str = "") {
  const temp = document.createElement("div");
  temp.innerHTML = String(str || "");
  return temp.textContent || temp.innerText || "";
}

function threadPreview(thread) {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return "";

  const rawText = last.text || stripHtml(last.html) || "";
  const prefix = last.from === "player" ? "You: " : "";

  return (prefix + rawText).slice(0, 72);
}

function isClosedStatus(status) {
  return (status === "left" || status === "not_buying" || status === "confused_closed" || status === "closed");
}

function statusMeta(thread) {
  if (thread.status === "resolved") return { label: "resolved", circle: "assets/chat/greencircle.png" };
  if (isClosedStatus(thread.status)) return { label: "closed", circle: "assets/chat/redcircle.png" };
  return { label: "active", circle: "assets/chat/yellowcircle.png" };
}

function filteredThreads() {
  const threads = getThreads();
  if (currentInboxFilter === "UNREAD") return threads.filter((t) => (t.unreadCount || 0) > 0);
  if (currentInboxFilter === "ACTIVE") return threads.filter((t) => t.status === "open");
  if (currentInboxFilter === "RESOLVED") return threads.filter((t) => t.status === "resolved");
  if (currentInboxFilter === "CLOSED") return threads.filter((t) => isClosedStatus(t.status));
  return threads;
}

function getTabCounts() {
  const threads = getThreads();
  return {
    ALL: threads.length,
    UNREAD: threads.filter((t) => (t.unreadCount || 0) > 0).length,
    ACTIVE: threads.filter((t) => t.status === "open").length,
    RESOLVED: threads.filter((t) => t.status === "resolved").length,
    CLOSED: threads.filter((t) => isClosedStatus(t.status)).length
  };
}


function buildInboxTimerHTML(thread) {
  const secsLeft = getThreadTimeLeft(thread);

  if (secsLeft === null || thread.status !== "open") return "";

  return `
    <div class="chatRowTimer ${secsLeft < 10 ? "is-urgent" : ""}">
      <img class="chatRowTimeIcon" src="assets/ui_icons/time_icon.png" alt="">
      <span class="chatTimeLabel">Time:</span>
      <span class="chatTimeValue">${secsLeft} seconds left</span>
    </div>
  `;
}

function renderChatTopStats() {
  const root = document.getElementById("chatTopStats");
  if (!root) return;

  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));
  const boxes = getAvailableBoxes();

  root.innerHTML = `
    <div class="chatTopStatsInner">
      <button id="chatAvatarBtn" class="chatAvatarBtn" type="button"><img class="chatAvatarLarge" src="${resolveStoreAvatarSrc()}" alt="Store avatar"></button>
      <div class="chatStoreMain">
        <div class="chatStoreNameLarge">${escapeHtml(shopInfo.name || "[STORE NAME]")}</div>
        <img class="chatStarsImg" src="assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png" alt="Rating">
        <div class="chatOrangeStatsRow">
          <div class="chatOrangeStat chatFollowersStat"><img class="chatStatIcon" src="assets/ui_icons/followers_icon.png" alt=""><span class="chatStatValue">${formatCompact(gameState.followers)}</span></div>
          <div class="chatOrangeStat chatViewsStat"><img class="chatStatIcon" src="assets/ui_icons/views_icon.png" alt=""><span class="chatStatValue">${formatCompact(gameState.views)}</span></div>
          <button id="chatBoxesBtn" class="chatOrangeStat chatBoxesStat" type="button"><img class="chatStatIcon" src="assets/ui_icons/shippingbox_icon.png" alt=""><span class="chatStatValue">${formatCompact(boxes)}</span></button>
          <div class="chatOrangeStat chatMoneyStat"><img class="chatStatIcon" src="assets/ui_icons/coin_icon.png" alt=""><span class="chatStatValue">${formatCompact(gameState.revenue)}</span></div>
        </div>
      </div>
      <div class="chatRightStatsCol">
        <div class="chatOrangeStat chatDayStat"><img class="chatStatIcon" src="assets/ui_icons/day${day}_icon.png" alt=""><span class="chatStatValue">DAY ${gameState.day}</span></div>
        <div class="chatOrangeStat chatTimeStat"><img class="chatStatIcon" src="assets/ui_icons/time_icon.png" alt=""><span class="chatStatValue">${formatTime(gameState.secondsLeft)}</span></div>
      </div>
    </div>
  `;
  document.getElementById("chatAvatarBtn").onclick = () => openEditProfile();
}

function updateChatTopStatsValues() {
  const boxes = getAvailableBoxes();
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));

  const followersEl = document.querySelector(".chatFollowersStat .chatStatValue");
  const viewsEl = document.querySelector(".chatViewsStat .chatStatValue");
  const boxesEl = document.querySelector(".chatBoxesStat .chatStatValue");
  const moneyEl = document.querySelector(".chatMoneyStat .chatStatValue");
  const dayEl = document.querySelector(".chatDayStat .chatStatValue");
  const timeEl = document.querySelector(".chatTimeStat .chatStatValue");
  const starsEl = document.querySelector(".chatStarsImg");

  if (followersEl) followersEl.textContent = formatCompact(gameState.followers);
  if (viewsEl) viewsEl.textContent = formatCompact(gameState.views);
  if (boxesEl) boxesEl.textContent = formatCompact(boxes);
  if (moneyEl) moneyEl.textContent = formatCompact(gameState.revenue);
  if (dayEl) dayEl.textContent = `DAY ${gameState.day}`;
  if (timeEl) timeEl.textContent = formatTime(gameState.secondsLeft);

  if (starsEl) {
    const nextSrc = `assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png`;
    if (!starsEl.src.includes(nextSrc)) {
      starsEl.src = nextSrc;
    }
  }
}

// Persists DOM elements to prevent scroll reset bugs
function renderChatTabs() {
  const root = document.getElementById("chatTabs");
  const viewport = document.querySelector(".chatTabsViewport");
  if (!root) return;

  if (viewport) {
    savedChatScroll = viewport.scrollLeft;
  }

  if (root.children.length === 0) {
    root.innerHTML = Object.entries(CHAT_TAB_ASSETS).map(([filter, config]) => `
      <button class="chatTabBtn" data-chat-filter="${filter}">
        <img class="chatTabImg" src="${config.inactive}" alt="${filter}">
        <span class="chatTabCount chatTabCount--${filter.toLowerCase()}">0</span>
      </button>
    `).join("");
  }

  const counts = getTabCounts();

  Object.entries(CHAT_TAB_ASSETS).forEach(([filter, config]) => {
    const btn = root.querySelector(`[data-chat-filter="${filter}"]`);
    if (!btn) return;

    const isActive = currentInboxFilter === filter;
    btn.setAttribute("data-active", isActive ? "true" : "false");
    btn.querySelector(".chatTabImg").src = isActive ? config.active : config.inactive;
    btn.querySelector(".chatTabCount").textContent = counts[filter];
  });

  restoreChatTabsScroll();
}

function restoreChatTabsScroll() {
  const viewport = document.querySelector(".chatTabsViewport");
  if (!viewport) return;

  requestAnimationFrame(() => {
    viewport.scrollLeft = savedChatScroll;
  });
}

// BULLETPROOF SLIDER MECHANICS
function bindChatSlider() {
  const thumb = document.querySelector(".chatSliderThumb");
  const track = document.querySelector(".chatDividerLine");
  const viewport = document.querySelector(".chatTabsViewport");

  if (!thumb || !viewport || !track) return;
  if (destroyChatSlider) destroyChatSlider();

  viewport.scrollLeft = savedChatScroll;

  const getMaxThumbMove = () =>
    Math.max(0, track.clientWidth - thumb.clientWidth - 4);

  const getMaxScroll = () =>
    Math.max(0, viewport.scrollWidth - viewport.clientWidth);

  let isDraggingThumb = false;
  let isDraggingTabs = false;
  let startX = 0;
  let startThumbLeft = 0;
  let tabStartX = 0;
  let tabStartScrollLeft = 0;
  let activePointerId = null;

  function syncThumb() {
    savedChatScroll = viewport.scrollLeft;

    if (isDraggingThumb) return;

    const maxScroll = getMaxScroll();
    const maxThumbMove = getMaxThumbMove();

    if (maxScroll <= 0) {
      thumb.style.left = "0px";
      return;
    }

    const scrollPct = viewport.scrollLeft / maxScroll;
    thumb.style.left = `${scrollPct * maxThumbMove}px`;
  }

  function onThumbPointerDown(e) {
    e.preventDefault();
    isDraggingThumb = true;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startThumbLeft = parseInt(window.getComputedStyle(thumb).left, 10) || 0;
    thumb.style.cursor = "grabbing";
    thumb.setPointerCapture?.(e.pointerId);
  }

  function onThumbPointerMove(e) {
    if (!isDraggingThumb || e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    const maxThumbMove = getMaxThumbMove();
    let newLeft = Math.max(0, Math.min(startThumbLeft + dx, maxThumbMove));

    thumb.style.left = `${newLeft}px`;

    const scrollRatio = maxThumbMove > 0 ? newLeft / maxThumbMove : 0;
    viewport.scrollLeft = scrollRatio * getMaxScroll();
    savedChatScroll = viewport.scrollLeft;
  }

  function onThumbPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    isDraggingThumb = false;
    activePointerId = null;
    thumb.style.cursor = "grab";
    thumb.releasePointerCapture?.(e.pointerId);
  }

  function onTabsPointerDown(e) {
    if (e.target.closest(".chatTabBtn") || e.target.closest(".chatSliderThumb")) return;

    isDraggingTabs = true;
    activePointerId = e.pointerId;
    tabStartX = e.clientX;
    tabStartScrollLeft = viewport.scrollLeft;
    viewport.style.cursor = "grabbing";
    viewport.setPointerCapture?.(e.pointerId);
  }

  function onTabsPointerMove(e) {
    if (!isDraggingTabs || e.pointerId !== activePointerId) return;

    e.preventDefault();
    viewport.scrollLeft = tabStartScrollLeft - (e.clientX - tabStartX);
    savedChatScroll = viewport.scrollLeft;
  }

  function onTabsPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    isDraggingTabs = false;
    activePointerId = null;
    viewport.style.cursor = "auto";
    viewport.releasePointerCapture?.(e.pointerId);
  }

  thumb.addEventListener("pointerdown", onThumbPointerDown);
  thumb.addEventListener("pointermove", onThumbPointerMove);
  thumb.addEventListener("pointerup", onThumbPointerUp);
  thumb.addEventListener("pointercancel", onThumbPointerUp);

  viewport.addEventListener("pointerdown", onTabsPointerDown);
  viewport.addEventListener("pointermove", onTabsPointerMove);
  viewport.addEventListener("pointerup", onTabsPointerUp);
  viewport.addEventListener("pointercancel", onTabsPointerUp);

  viewport.addEventListener("scroll", syncThumb, { passive: true });

  const ro = new ResizeObserver(() => syncThumb());
  ro.observe(viewport);
  if (viewport.firstElementChild) ro.observe(viewport.firstElementChild);

  syncThumb();

  destroyChatSlider = () => {
    thumb.removeEventListener("pointerdown", onThumbPointerDown);
    thumb.removeEventListener("pointermove", onThumbPointerMove);
    thumb.removeEventListener("pointerup", onThumbPointerUp);
    thumb.removeEventListener("pointercancel", onThumbPointerUp);

    viewport.removeEventListener("pointerdown", onTabsPointerDown);
    viewport.removeEventListener("pointermove", onTabsPointerMove);
    viewport.removeEventListener("pointerup", onTabsPointerUp);
    viewport.removeEventListener("pointercancel", onTabsPointerUp);

    viewport.removeEventListener("scroll", syncThumb);
    ro.disconnect();
  };
}

function bindChatTabEvents() {
  const root = document.getElementById("chatTabs");
  const viewport = document.querySelector(".chatTabsViewport");
  if (!root) return;

  root.querySelectorAll(".chatTabBtn").forEach((btn) => {
    btn.onclick = () => {
      if (viewport) {
        savedChatScroll = viewport.scrollLeft;
      }

      currentInboxFilter = btn.dataset.chatFilter;
      renderChatTabs();
      renderInboxRows();
      restoreChatTabsScroll();
    };
  });
}

function renderInboxRows() {
  const inbox = document.getElementById("chatInbox");
  if (!inbox) return;

  const threads = filteredThreads();

  if (!threads.length) {
    inbox.innerHTML = `<div class="chatPixelEmpty">NO MESSAGES FOUND</div>`;
    return;
  }

  inbox.innerHTML = "";
  threads.forEach((thread) => {
    const meta = statusMeta(thread);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "chatPixelRow";
    
    // 🔥 We are now calling the helper function you already have!
    const timerHTML = buildInboxTimerHTML(thread);

    row.innerHTML = `
  <img class="chatPixelAvatar" src="${customerAvatarSrc(thread)}" alt="avatar">

  <div class="chatPixelMeta">
    <div class="chatPixelNameRow">
      <div class="chatPixelName">${escapeHtml(thread.customerName)}</div>
      <img class="chatPixelStatusCircle" src="${meta.circle}" alt="${meta.label}">
      <span class="chatPixelStatusText">${meta.label}</span>
    </div>

    <div class="chatPixelTimerRow">
      ${timerHTML}
    </div>

    <div class="chatPixelPreview">
      <span class="chatPixelPreviewText">${escapeHtml(threadPreview(thread))}</span>
    </div>
  </div>

  <div class="chatPixelRight">
    ${(thread.unreadCount || 0) > 0 ? `
      <div class="chatPixelBadge">
        <img class="chatPixelBadgeImg" src="assets/chat/notificationbadge.png" alt="">
        <span class="chatPixelBadgeText">${thread.unreadCount}</span>
      </div>` : ``}
  </div>
`;
    
    row.onclick = () => {
      currentThreadId = thread.id;
      markThreadRead(thread.id);
      renderChatroom(thread.id);
      window.__refreshChatUI?.();
    };
    inbox.appendChild(row);
  });
}

function renderInbox() {
  currentThreadId = null;

  if (cleanupChatKeyboardFix) {
  cleanupChatKeyboardFix();
  cleanupChatKeyboardFix = null;
}
  const root = el.pageChat;
  if (!root) return;

  let stage = document.getElementById("chatInboxStage");
  if (!stage) {
    if (chatroomRefs) chatroomRefs = null;
    root.innerHTML = `
  <div id="chatHelperOverlay" class="pageHelperOverlay hidden"></div>

  <div class="pageMain chatPageMain" id="chatInboxStage">
    <div id="chatTopStats" class="chatTopStatsCard"></div>
    <div class="chatSectionTitle">YOUR CHATS</div>
    <div class="chatPhoneStage">
      <div class="chatPhoneBody">
        <div class="chatStickyTop">
          <div class="chatIntroText">ANSWER CUSTOMER INQUIRIES TO GAIN MORE STORE ATTRACTION.</div>
          <div class="chatTabsViewport"><div id="chatTabs" class="chatPixelTabs"></div></div>
          <div class="chatDividerWrap">
            <div class="chatDividerLine"></div>
            <div id="chatSliderThumb" class="chatSliderThumb"></div>
          </div>
        </div>
        <div id="chatInbox" class="chatListWrap"></div>
      </div>
    </div>
  </div>
`;

if (window.refreshActiveHelperUI) {
  window.refreshActiveHelperUI();
}
    bindChatSlider();
    // ... rest of yo
    // ur event listeners
  }

  renderHud();
  renderChatTopStats();
  renderChatTabs();
  bindChatTabEvents();
  renderInboxRows();
  restoreChatTabsScroll();
  if (window.refreshActiveHelperUI) {
  window.refreshActiveHelperUI();
}
  
}

function bubbleClassForText(text = "") {
  const len = String(text).length;
  if (len <= 32) return "msg-bg-small";
  if (len <= 64) return "msg-bg-medium";
  return "msg-bg-large";
}

function drawChatLog(threadId) {
  if (!chatroomRefs?.logEl) return;
  const liveThread = getThreadById(threadId);
  if (!liveThread) return;

  const log = chatroomRefs.logEl;
  log.innerHTML = "";

  liveThread.messages.forEach((m) => {
    if (m.from === "system") {
  const sys = document.createElement("div");
  sys.className = "chat-system-msg";

  if (m.html) {
    sys.innerHTML = m.html;
  } else {
    sys.textContent = m.text || "";
  }

  log.appendChild(sys);
  return;
}
    const isPlayer = m.from === "player";
    const row = document.createElement("div");
    row.className = `chat-bubble-row ${isPlayer ? "player" : "customer"}`;

    const avatar = document.createElement("img");
    avatar.className = "msg-avatar-small";
    avatar.src = isPlayer ? playerAvatarSrc() : customerAvatarSrc(liveThread);
    
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${bubbleClassForText(m.text)}`;
    const textSpan = document.createElement("span");
    textSpan.className = "chat-bubble-text";
    textSpan.textContent = m.text;

    bubble.appendChild(textSpan);
    row.appendChild(avatar);
    row.appendChild(bubble);
    log.appendChild(row);
  });
  requestAnimationFrame(() => log.scrollTop = log.scrollHeight);
}

function syncChatroomHeaderAndCompose(threadId) {
  if (!chatroomRefs) return;
  const liveThread = getThreadById(threadId);
  if (!liveThread) return;

  const meta = statusMeta(liveThread);
  const isOpen = liveThread.status === "open";

  if (chatroomRefs.statusDotEl) chatroomRefs.statusDotEl.src = meta.circle;
  if (chatroomRefs.statusTextEl) chatroomRefs.statusTextEl.textContent = meta.label;
  if (chatroomRefs.composeEl) chatroomRefs.composeEl.classList.toggle("is-disabled", !isOpen);
  
  if (chatroomRefs.inputEl) {
    chatroomRefs.inputEl.disabled = !isOpen;
    chatroomRefs.inputEl.placeholder = isOpen ? "Type something..." : "Conversation closed";
  }
  if (chatroomRefs.sendEl) chatroomRefs.sendEl.disabled = !isOpen;
}


function updateChatroomTopBarTimer(threadId) {
  const timerTarget = document.getElementById("chatroomTimerTarget");
  if (!timerTarget) return;

  const liveThread = getThreadById(threadId);
  if (!liveThread) {
    timerTarget.innerHTML = "";
    return;
  }

  const secsLeft = getThreadTimeLeft(liveThread);

  if (secsLeft === null || liveThread.status !== "open") {
    timerTarget.innerHTML = "";
    return;
  }

  if (!timerTarget.innerHTML) {
    timerTarget.innerHTML = `
      <div class="chatRowTimerMessage">
        <img class="chatRowTimeIcon" src="assets/ui_icons/time_icon.png" alt="">
        <span class="chatTimeLabelMessage">Time:</span>
        <span class="chatTimeValueMessage"></span>
      </div>
    `;
  }

  const row = timerTarget.querySelector(".chatRowTimerMessage");
  const value = timerTarget.querySelector(".chatTimeValueMessage");

  if (value) value.textContent = `${secsLeft} seconds left`;

  if (secsLeft < 10) {
    row?.classList.add("is-urgent");
  } else {
    row?.classList.remove("is-urgent");
  }
}

function setupChatKeyboardFix() {
  if (cleanupChatKeyboardFix) {
    cleanupChatKeyboardFix();
    cleanupChatKeyboardFix = null;
  }

  const input = document.getElementById("chatInput");
  const compose = document.getElementById("chatroomCompose");
  const log = document.getElementById("chatLog");
  const pageMain = document.querySelector("#pageChat .chatPageMain");
  const phoneStage = document.querySelector("#pageChat .chatPhoneStage");

  if (!input || !compose) return;

  const vv = window.visualViewport;

  function lockChatPageScroll() {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    if (pageMain) pageMain.scrollTop = 0;
    if (phoneStage) phoneStage.scrollTop = 0;
  }

  function updateKeyboardPosition() {
    if (!vv) return;

    const keyboardHeight = Math.max(
      0,
      window.innerHeight - vv.height - vv.offsetTop
    );

    const isFocused = document.activeElement === input;
    const keyboardOpen = isFocused && keyboardHeight > 40;

    document.documentElement.style.setProperty(
      "--chat-keyboard-height",
      `${keyboardHeight}px`
    );

    compose.classList.toggle("chat-input-area--keyboard", keyboardOpen);
    log?.classList.toggle("chat-messages-area--keyboard", keyboardOpen);

    if (keyboardOpen) {
      document.body.classList.add("chatKeyboardOpen");
      lockChatPageScroll();

      requestAnimationFrame(() => {
        lockChatPageScroll();
      });
    }
  }

  function handleFocus() {
    document.body.classList.add("chatKeyboardOpen");

    updateKeyboardPosition();
    lockChatPageScroll();

    setTimeout(() => {
      updateKeyboardPosition();
      lockChatPageScroll();
    }, 100);

    setTimeout(() => {
      updateKeyboardPosition();
      lockChatPageScroll();
    }, 350);

    setTimeout(() => {
      updateKeyboardPosition();
      lockChatPageScroll();
    }, 600);
  }

  function handleBlur() {
    compose.classList.remove("chat-input-area--keyboard");
    log?.classList.remove("chat-messages-area--keyboard");

    document.body.classList.remove("chatKeyboardOpen");
    document.documentElement.style.setProperty("--chat-keyboard-height", "0px");

    lockChatPageScroll();
  }

  function handleTouchMove(e) {
    if (document.body.classList.contains("chatKeyboardOpen")) {
      const insideLog = e.target.closest?.(".chat-messages-area");
      if (!insideLog) {
        e.preventDefault();
      }
    }
  }

  input.addEventListener("focus", handleFocus);
  input.addEventListener("blur", handleBlur);

  vv?.addEventListener("resize", updateKeyboardPosition);
  vv?.addEventListener("scroll", updateKeyboardPosition);

  document.addEventListener("touchmove", handleTouchMove, { passive: false });

  cleanupChatKeyboardFix = () => {
    input.removeEventListener("focus", handleFocus);
    input.removeEventListener("blur", handleBlur);

    vv?.removeEventListener("resize", updateKeyboardPosition);
    vv?.removeEventListener("scroll", updateKeyboardPosition);

    document.removeEventListener("touchmove", handleTouchMove);

    compose.classList.remove("chat-input-area--keyboard");
    log?.classList.remove("chat-messages-area--keyboard");

    document.body.classList.remove("chatKeyboardOpen");
    document.documentElement.style.setProperty("--chat-keyboard-height", "0px");
  };
}

function renderChatroom(threadId) {
  const thread = getThreadById(threadId);
  const root = el.pageChat;
  if (!root) return;

  if (!thread) {
    currentThreadId = null;
    chatroomRefs = null;
    renderInbox();
    return;
  }

  markThreadRead(threadId);
  const meta = statusMeta(thread);
  const isOpen = thread.status === "open";

  root.innerHTML = `
  <div id="chatHelperOverlay" class="pageHelperOverlay hidden"></div>

  <div class="pageMain chatPageMain">
    <div id="chatTopStats" class="chatTopStatsCard"></div>
    <div class="chatSectionTitle">YOUR CHATS</div>
    <div class="chatPhoneStage">
      <div class="chat-top-bar">
        <button class="chat-back-btn" id="chatBackBtn" type="button">
          <img class="chat-back-btn-img" src="assets/messages/arrow_left.png">
        </button>

        <img class="chat-header-avatar" src="${customerAvatarSrc(thread)}">

        <div class="chat-header-info">
          <div class="chat-header-name">${escapeHtml(thread.customerName.toUpperCase())}</div>
          <div class="chat-header-status">
            <img id="chatroomStatusDot" class="status-circle" src="${meta.circle}">
            <span id="chatroomStatusText" class="status-text-label">${meta.label}</span>
            <div id="chatroomTimerTarget"></div>
          </div>
        </div>
      </div>

      <div class="chat-phone-body-bg">
        <div id="chatLog" class="chat-messages-area"></div>
        <div id="chatroomCompose" class="chat-input-area ${isOpen ? "" : "is-disabled"}">
          <div class="chat-input-box">
            <input class="chat-input" id="chatInput" placeholder="${isOpen ? "Type something..." : "Conversation closed"}" ${isOpen ? "" : "disabled"} />
          </div>
          <button class="chat-send-btn" id="chatSendBtn" type="button" ${isOpen ? "" : "disabled"}></button>
        </div>
      </div>
    </div>
  </div>
`;
if (window.refreshActiveHelperUI) {
  window.refreshActiveHelperUI();
}

  renderHud();
  renderChatTopStats();

  document.getElementById("chatBackBtn").onclick = () => {
    currentThreadId = null;
    chatroomRefs = null;
    renderInbox();
  };

  chatroomRefs = {
    threadId,
    logEl: document.getElementById("chatLog"),
    composeEl: document.getElementById("chatroomCompose"),
    inputEl: document.getElementById("chatInput"),
    sendEl: document.getElementById("chatSendBtn"),
    statusDotEl: document.getElementById("chatroomStatusDot"),
    statusTextEl: document.getElementById("chatroomStatusText")
  };
  setupChatKeyboardFix();

  const doSend = () => {
    const liveThread = getThreadById(threadId);
    if (!liveThread || liveThread.status !== "open") return;
    const text = chatroomRefs?.inputEl?.value || "";
    const res = submitPlayerReply(liveThread.id, text);
    if (!res?.ok) return;

    if (chatroomRefs?.inputEl) {
      chatroomRefs.inputEl.value = "";
      chatroomRefs.inputEl.focus();
    }
    drawChatLog(threadId);
    syncChatroomHeaderAndCompose(threadId);
    updateChatNavBadge();
  };

  chatroomRefs.sendEl.onclick = doSend;
  chatroomRefs.inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSend();
  });
  handleSpamOverlay(thread);
  drawChatLog(threadId);
  syncChatroomHeaderAndCompose(threadId);
  updateChatroomTopBarTimer(threadId);
}

function handleSpamOverlay(thread) {
  if (!thread || thread.status !== "open" || thread.checked) return;

  const stage = document.querySelector(".chatPhoneStage");
  if (!stage) return;

  if (stage.querySelector(".chatSpamOverlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "chatSpamOverlay";

  // HTML is now much cleaner without the <img> tag
  overlay.innerHTML = `
    <div class="chatSpamInner">
      <div class="chatSpamText">
        WILL YOU ACCEPT THE MESSAGE<br>
        FROM ${escapeHtml(thread.customerName)}?
        <br>
        <span class="chatSpamWarning">[BEWARE OF SPAM MESSAGES]</span>
      </div>

      <div class="chatSpamButtons">
        <button id="spamDeclineBtn" class="spamBtn decline" type="button" aria-label="Decline"></button>
        <button id="spamAcceptBtn" class="spamBtn accept" type="button" aria-label="Accept"></button>
      </div>
    </div>
  `;

  stage.appendChild(overlay);

  // Button logic remains the same
  document.getElementById("spamAcceptBtn").onclick = () => {
    resolveMessageScreening(thread.id, true);
    overlay.remove();
    drawChatLog(thread.id);
    syncChatroomHeaderAndCompose(thread.id);
  };

  document.getElementById("spamDeclineBtn").onclick = () => {
    resolveMessageScreening(thread.id, false);
    overlay.remove();
    renderInbox();
  };
}

function refreshActiveChatroomIfNeeded() {
  if (!currentThreadId || !chatroomRefs) return;
  const liveThread = getThreadById(currentThreadId);
if (!liveThread) {
  currentThreadId = null;
  chatroomRefs = null;
  renderInbox();
  return;
}

if (liveThread.status !== "open") {
  document.querySelector(".chatSpamOverlay")?.remove();
}
  const activeEl = document.activeElement;
  const typingInInput = chatroomRefs.inputEl && activeEl === chatroomRefs.inputEl;
  const draft = chatroomRefs.inputEl ? chatroomRefs.inputEl.value : "";


  syncChatroomHeaderAndCompose(currentThreadId);
  updateChatroomTopBarTimer(currentThreadId);

  if (chatroomRefs.inputEl && typingInInput && liveThread.status === "open") {
    chatroomRefs.inputEl.value = draft;
    const pos = draft.length;
    chatroomRefs.inputEl.setSelectionRange(pos, pos);
    chatroomRefs.inputEl.focus();
  }
}

function updateChatNavBadge() {
  const total = getUnreadTotal();
  const badge = document.getElementById("navChatBadge");
  if (!badge) return;
  badge.classList.remove("is-hidden");
  badge.textContent = String(total);
  badge.style.display = "flex";
  badge.style.visibility = "visible";
  badge.style.opacity = "1";
}

function startChatRefreshLoop() {
  stopChatRefreshLoop();

  chatRefreshTimer = setInterval(() => {
    const pageChat = document.getElementById("pageChat");

    if (!pageChat?.classList.contains("show")) {
      stopChatRefreshLoop();
      return;
    }

    updateChatNavBadge();
    updateChatTopStatsValues();

    if (currentThreadId) {
      updateChatroomTopBarTimer(currentThreadId);
      syncChatroomHeaderAndCompose(currentThreadId);
      return;
    }

    // Only update tab numbers/timers, do not rebuild the whole inbox every second.
    renderChatTabs();

    document.querySelectorAll(".chatPixelRow").forEach((row) => {
      // leave existing rows alone to avoid PNG flicker
    });
  }, 1000);
}

function stopChatRefreshLoop() {
  if (chatRefreshTimer) {
    clearInterval(chatRefreshTimer);
    chatRefreshTimer = null;
  }
}

export function enterChatPage() {
  initMessagesStateIfNeeded();
  currentThreadId = null;
  chatroomRefs = null;
  isDraggingChatSlider = false;

  window.__refreshChatUI = () => {
    updateChatNavBadge();
    if (currentThreadId) {
      refreshActiveChatroomIfNeeded();
      return;
    }
    renderInbox();
  };

  renderHud();
  updateChatNavBadge();
  renderInbox();
  startChatRefreshLoop();
}