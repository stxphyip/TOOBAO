/* js/pages/messages.js */

import { navigateTo } from "../router.js";
import { shopInfo, gameState } from "../state.js";
import { avatarImages } from "../data/avatars.js";
import { formatTime } from "../utils.js";
import { renderHud } from "./home.js";
import { openEditProfile } from "../modals/editProfile.js";
import {
  getThreadById,
  submitPlayerReply,
  markThreadRead,
  initMessagesStateIfNeeded,
  getThreadTimeLeft
} from "../systems/messagesSystem.js";

function makeEl(tag, className, html) {
  const d = document.createElement(tag);
  if (className) d.className = className;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function playerAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;
  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "assets/avatars/flowerpfp.png";
}

function customerAvatarSrc(thread) {
  return thread?.customerAvatar || "assets/avatars/flowerpfp.png";
}

function resolveStoreAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;
  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "assets/avatars/flowerpfp.png";
}

function formatCompact(n) {
  const num = Math.floor(Number(n) || 0);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

function getAvailableBoxes() {
  return Math.max(
    0,
    (Number(gameState.shippingMaterials) || 0) -
      (Number(gameState.reservedShippingMaterials) || 0)
  );
}

function statusMeta(thread) {
  const status = thread?.status || "open";
  if (status === "resolved") {
    return { label: "resolved", circle: "assets/messages/greencircle.png" };
  }
  if (["left", "not_buying", "confused_closed", "closed"].includes(status)) {
    return { label: "closed", circle: "assets/messages/redcircle.png" };
  }
  return { label: "active", circle: "assets/messages/yellowcircle.png" };
}

function renderMessagesTopStats(root) {
  if (!root) return;
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));
  const boxes = getAvailableBoxes();

  root.innerHTML = `
    <div class="chatTopStatsInner">
      <button id="messagesAvatarBtn" class="chatAvatarBtn" type="button">
        <img class="chatAvatarLarge" src="${resolveStoreAvatarSrc()}" alt="Store avatar">
      </button>
      <div class="chatStoreMain">
        <div class="chatStoreNameLarge">${escapeHtml(shopInfo.name || "[STORE NAME]")}</div>
        <img class="chatStarsImg" src="assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png" alt="Rating">
        <div class="chatOrangeStatsRow">
          <div class="chatOrangeStat chatFollowersStat">
            <img class="chatStatIcon" src="assets/ui_icons/followers_icon.png" alt="">
            <span class="chatStatValue">${formatCompact(gameState.followers)}</span>
          </div>
          <div class="chatOrangeStat chatViewsStat">
            <img class="chatStatIcon" src="assets/ui_icons/views_icon.png" alt="">
            <span class="chatStatValue">${formatCompact(gameState.views)}</span>
          </div>
          <button id="messagesBoxesBtn" class="chatOrangeStat chatBoxesStat" type="button">
            <img class="chatStatIcon" src="assets/ui_icons/shippingbox_icon.png" alt="">
            <span class="chatStatValue">${formatCompact(boxes)}</span>
          </button>
          <div class="chatOrangeStat chatMoneyStat">
            <img class="chatStatIcon" src="assets/ui_icons/coin_icon.png" alt="">
            <span class="chatStatValue">${formatCompact(gameState.revenue)}</span>
          </div>
        </div>
      </div>
      <div class="chatRightStatsCol">
        <div class="chatOrangeStat chatDayStat">
          <img class="chatStatIcon" src="assets/ui_icons/day${day}_icon.png" alt="">
          <span class="chatStatValue">DAY ${gameState.day}</span>
        </div>
        <div class="chatOrangeStat chatTimeStat">
          <img class="chatStatIcon" src="assets/ui_icons/time_icon.png" alt="">
          <span class="chatStatValue">${formatTime(gameState.secondsLeft)}</span>
        </div>
      </div>
    </div>
  `;
  const avatarBtn = document.getElementById("messagesAvatarBtn");
  if (avatarBtn) avatarBtn.onclick = () => openEditProfile();
}

function buildBubbleClass(text = "") {
  const len = String(text).length;
  if (len <= 32) return "msg-bg-small";
  if (len <= 64) return "msg-bg-medium";
  return "msg-bg-large";
}

function renderMessageRow(thread, msg) {
  if (msg.from === "system") {
  return makeEl("div", "chat-system-msg", msg.html || escapeHtml(msg.text || ""));
}
  const isPlayer = msg.from === "player";
  const row = makeEl("div", `chat-bubble-row ${isPlayer ? "player" : "customer"}`);
  const avatar = makeEl("img", "msg-avatar-small");
  avatar.src = isPlayer ? playerAvatarSrc() : customerAvatarSrc(thread);
  const bubble = makeEl("div", `chat-bubble ${buildBubbleClass(msg.text)}`);
  bubble.appendChild(makeEl("span", "chat-bubble-text", escapeHtml(msg.text)));
  row.appendChild(avatar);
  row.appendChild(bubble);
  return row;
}

export function buildMessagesPage(root, threadId) {
  initMessagesStateIfNeeded();
  root.innerHTML = "";

  if (!threadId) {
    const parts = window.location.pathname.split("/");
    threadId = parts[parts.length - 1];
  }

  const thread = getThreadById(threadId);
  if (!thread) {
    root.innerHTML = `
      <div class="pageMain chatPageMain">
        <div class="chatSectionTitle">CHAT NOT FOUND</div>
        <button id="backBtn" class="chat-back-btn chat-back-btn-standalone" type="button">Go Back</button>
      </div>
    `;
    document.getElementById("backBtn").onclick = () => navigateTo("/chat");
    return;
  }

  markThreadRead(threadId);

  const wrap = makeEl("div", "pageMain chatPageMain");
  const topStats = makeEl("div", "chatTopStatsCard");
  topStats.id = "chatTopStats";

  const sectionTitle = makeEl("div", "chatSectionTitle", "YOUR CHATS");
  const phoneStage = makeEl("div", "chatPhoneStage");



  // --- TOP BAR LOGIC ---
  const topBar = makeEl("div", "chat-top-bar");

  // We leave the timer-target empty but the container EXISTS so JS can find it
  topBar.innerHTML = `
    <button class="chat-back-btn" id="messagesBackBtn" type="button" aria-label="Back">
      <img class="chat-back-btn-img" src="assets/messages/arrow_left.png" alt="Back">
    </button>
    <img class="chat-header-avatar" src="${customerAvatarSrc(thread)}" alt="avatar">
    <div class="chat-header-info">
      <div class="chat-header-name">${escapeHtml(thread.customerName.toUpperCase())}</div>
      <div class="chat-header-status">
        <img src="${statusMeta(thread).circle}" class="status-circle" alt="${statusMeta(thread).label}">
        <span class="status-text-label">${statusMeta(thread).label}</span>
        <div id="timerTarget"></div> 
      </div>
    </div>
  `;

  // PHONE BODY
  const phoneBody = makeEl("div", "chat-phone-body-bg");
  const messagesArea = makeEl("div", "chat-messages-area");
  messagesArea.id = "messagesArea";

  const inputArea = makeEl("div", "chat-input-area");
  const inputBox = makeEl("div", "chat-input-box");
  const inputEl = makeEl("input", "chat-input");
  inputEl.type = "text";
  inputEl.placeholder = "Type something...";
  inputEl.maxLength = 96;

  const sendBtn = makeEl("button", "chat-send-btn");
  sendBtn.type = "button";

  inputBox.appendChild(inputEl);
  inputArea.appendChild(inputBox);
  inputArea.appendChild(sendBtn);

  function renderMessages() {
    const liveThread = getThreadById(threadId);
    if (!liveThread) return;
    messagesArea.innerHTML = "";
    liveThread.messages.forEach((msg) => {
      messagesArea.appendChild(renderMessageRow(liveThread, msg));
    });
    requestAnimationFrame(() => { messagesArea.scrollTop = messagesArea.scrollHeight; });
  }

  function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    const res = submitPlayerReply(threadId, text);
    if (res?.ok) {
  inputEl.value = "";
  renderMessages();

  const liveThread = getThreadById(threadId);
  if (liveThread) {
    const meta = statusMeta(liveThread);

    const statusCircle = document.querySelector(".status-circle");
    const statusLabel = document.querySelector(".status-text-label");
    const timerTarget = document.getElementById("timerTarget");

    if (statusCircle) statusCircle.src = meta.circle;
    if (statusLabel) statusLabel.textContent = meta.label;

    if (timerTarget && liveThread.status !== "open") {
      timerTarget.innerHTML = "";
    }

    if (liveThread.status !== "open") {
      inputEl.disabled = true;
      inputEl.placeholder = "Conversation closed";
      sendBtn.disabled = true;
      inputArea.classList.add("is-disabled");
    }
  }
}
  }

  sendBtn.onclick = handleSend;
  inputEl.onkeydown = (e) => { if (e.key === "Enter") handleSend(); };

  phoneBody.appendChild(messagesArea);
  phoneBody.appendChild(inputArea);
  phoneStage.appendChild(topBar);
  phoneStage.appendChild(phoneBody);

  wrap.appendChild(topStats);
  wrap.appendChild(sectionTitle);
  wrap.appendChild(phoneStage);
  root.appendChild(wrap);

  renderHud();
  renderMessagesTopStats(topStats);
  renderMessages();

  document.getElementById("messagesBackBtn").onclick = () => navigateTo("/chat");

  // REFRESH TIMER EVERY SECOND
  const messageInterval = setInterval(() => {
  const currentArea = document.getElementById("messagesArea");
  if (!currentArea) {
    clearInterval(messageInterval);
    return;
  }

  const timerTarget = document.getElementById("timerTarget");
  if (!timerTarget) return;

  const liveThread = getThreadById(threadId);
  if (!liveThread) {
    timerTarget.innerHTML = "";
    return;
  }

  const currentSecs = getThreadTimeLeft(liveThread);

  if (currentSecs !== null && liveThread.status === "open") {
    if (!timerTarget.innerHTML) {
      timerTarget.innerHTML = `
        <div class="chatRowTimer chatRowTimerMessage">
          <img class="chatRowTimeIcon" src="assets/ui_icons/time_icon.png" alt="">
          <span class="chatTimeLabel chatTimeLabelMessage">Time:</span>
          <span class="chatTimeValue chatTimeValueMessage"></span>
        </div>
      `;
    }

    const valEl = timerTarget.querySelector(".chatTimeValueMessage");
    const container = timerTarget.querySelector(".chatRowTimerMessage");

    if (valEl) valEl.textContent = `${currentSecs} seconds left`;

    if (currentSecs < 10) {
      container?.classList.add("is-urgent");
    } else {
      container?.classList.remove("is-urgent");
    }
  } else {
    timerTarget.innerHTML = "";
  }
}, 1000);
}