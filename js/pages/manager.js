// js/pages/manager.js

import { el } from "../dom.js";
import {
  shopInfo,
  gameState,
  loadSharedState,
  getTotalManufacturingCost
} from "../state.js";
import { showPage } from "../router.js";
import { avatarImages } from "../data/avatars.js";
import {
  stopAllGameSounds,
  enableManagerAudioOnlyMode
} from "../systems/soundSystem.js";


let managerCurrentWarningMessage = null;


let managerTicker = null;

const WARNING_DELAY_SEC = 30;

let managerWarningShowing = false;
let managerWarningQueue = [];

const managerWarningSeen = {
  day: null,
  lowRevenue100: false,
  lowRevenue50: false,
  lowFollowers100: false,
  lowViews100: false,
  slowChat: false,
  slowDelivery: false
};



function stopNonManagerAudio() {
  // Turn on hard audio gate first.
  // From now on, only #managerCautionAudio can play in this window.
  enableManagerAudioOnlyMode();

  // Tell toast/tasks/dayOverlay/etc. to clear old queues/timers/sounds.
  stopAllGameSounds({
    suppressMs: 0,
    notifySystems: true,
    stopMusic: true
  });

  const cautionAudio = document.getElementById("managerCautionAudio");
  if (cautionAudio) {
    cautionAudio.muted = false;
    cautionAudio.volume = 0.75;
    cautionAudio.loop = true;
  }

  document.querySelectorAll("audio, video").forEach((media) => {
    if (media.id === "managerCautionAudio") return;

    try {
      media.pause();
      media.currentTime = 0;
      media.muted = true;
    } catch (err) {
      console.warn("[Manager] Could not stop non-manager media:", err);
    }
  });
}

function isManagerPageVisible() {
  const page = el.pageManager || document.getElementById("pageManager");
  return !!page && page.classList.contains("show");
}

function getResolvedAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;

  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || "assets/avatars/frog.png";
}

function getHomeProductsSafe() {
  return (shopInfo.chosenProducts || []).filter((p) => p.onHome);
}
function ensureManagerState() {
  const currentDay = Math.max(1, Math.min(3, Number(gameState.day) || 1));
  const currentViews = Math.max(0, Number(gameState.views) || 0);

  if (!gameState.managerDashboard) {
    gameState.managerDashboard = {
      dayMarker: currentDay,
      dayStartViews: currentDay === 1 ? 0 : currentViews,
      dayEndViews: {},
      history: [],
      lastSampleAt: 0,
      sampledMinuteKeys: {}
    };
  }

  const dash = gameState.managerDashboard;

  if (!Array.isArray(dash.history)) dash.history = [];
  if (!dash.dayEndViews) dash.dayEndViews = {};
  if (!dash.sampledMinuteKeys) dash.sampledMinuteKeys = {};
  if (typeof dash.lastSampleAt !== "number") dash.lastSampleAt = 0;

  if (typeof dash.dayMarker !== "number") {
    dash.dayMarker = currentDay;
  }

  if (typeof dash.dayStartViews !== "number") {
    dash.dayStartViews = currentDay === 1 ? 0 : currentViews;
  }

  // Day 1 should always count from 0.
  if (currentDay === 1) {
    dash.dayStartViews = 0;
  }

  // If the game moves to a new day, save the previous day and reset today's starting point.
  if (dash.dayMarker !== currentDay) {
    const previousDay = Math.max(1, Math.min(3, Number(dash.dayMarker) || 1));

    dash.dayEndViews[previousDay] = currentViews;
    dash.dayMarker = currentDay;
    dash.dayStartViews = currentViews;

    dash.lastSampleAt = 0;
  }
}

function sampleHistory() {
  ensureManagerState();

  const dash = gameState.managerDashboard;
  const currentDay = Math.max(1, Math.min(3, Number(gameState.day) || 1));
  const secondsLeft = Math.max(0, Number(gameState.secondsLeft) || 0);
  const currentViews = Math.max(0, Number(gameState.views) || 0);

  const DAY_DURATION = 180;
  const elapsedSec = Math.max(0, DAY_DURATION - secondsLeft);

  // Plot every 30 seconds:
  // 0, 30, 60, 90, 120, 150, 180
  const slot = Math.max(0, Math.min(6, Math.floor(elapsedSec / 30)));

  // Convert slot into a 0–3 minute value for chart spacing.
  const minute = slot * 0.5;

  const key = `${currentDay}_${slot}`;

  if (!dash.sampledMinuteKeys[key]) {
    dash.sampledMinuteKeys[key] = true;

    dash.history.push({
      day: currentDay,
      minute,
      views: currentViews,
      isDayEnd: false,
      ts: Date.now()
    });
  }

  // Save/update end-of-day point.
  if (secondsLeft <= 0) {
    const endKey = `${currentDay}_END`;

    if (!dash.sampledMinuteKeys[endKey]) {
      dash.sampledMinuteKeys[endKey] = true;

      dash.history.push({
        day: currentDay,
        minute: 3,
        views: currentViews,
        isDayEnd: true,
        ts: Date.now()
      });
    }

    dash.dayEndViews[currentDay] = currentViews;
  }

  if (dash.history.length > 80) {
    dash.history = dash.history.slice(-80);
  }
}

function formatCompact(n) {
  const num = Math.max(0, Number(n) || 0);

  if (num >= 1000000) {
    const v = num / 1000000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}M`;
  }

  if (num >= 1000) {
    const v = num / 1000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}K`;
  }

  return String(Math.floor(num));
}

function getAwaitingShipmentCount() {
  return (gameState.orders || []).filter(
    (o) =>
      o.status === "NEW" ||
      o.status === "PACKING" ||
      o.status === "READY_TO_SHIP" ||
      o.status === "SHIPPING" ||
      o.status === "DELIVERED"
  ).length;
}

function getViewsToday() {
  return Math.max(0, Number(gameState.views) || 0);
}

function getAccumulatedTotalViews() {
  ensureManagerState();

  const dash = gameState.managerDashboard;
  const currentDay = Math.max(1, Math.min(3, Number(gameState.day) || 1));
  const currentViews = Math.max(0, Number(gameState.views) || 0);

  let total = 0;

  for (let day = 1; day <= 3; day++) {
    if (day < currentDay) {
      total += Number(dash.dayEndViews?.[day]) || 0;
    } else if (day === currentDay) {
      total += currentViews;
    }
  }

  return Math.max(0, total);
}

function getAverageDeliverySec() {
  const total = Number(gameState.analytics?.lifetime?.deliveryMsTotal) || 0;
  const count = Number(gameState.analytics?.lifetime?.deliveryCount) || 0;
  if (count <= 0) return 0;
  return total / count / 1000;
}

function getAverageChatSec() {
  const total = Number(gameState.analytics?.lifetime?.chatResponseSecTotal) || 0;
  const count = Number(gameState.analytics?.lifetime?.chatResponseCount) || 0;
  if (count <= 0) return 0;
  return total / count;
}

function getOrdersToday() {
  const today = Number(gameState.day) || 1;

  const list = Array.isArray(gameState.analytics?.daily)
    ? gameState.analytics.daily
    : [];

  const found = list.find((d) => Number(d.day) === today);

  if (found && typeof found.ordersCreated === "number") {
    return Number(found.ordersCreated) || 0;
  }

  // fallback in case older orders were created before analytics existed
  return (gameState.orders || []).filter((o) => Number(o.createdDay) === today).length;
}

function getBestSellingProducts() {
  return [...getHomeProductsSafe()]
    .sort((a, b) => {
      const soldDiff = (Number(b.sold) || 0) - (Number(a.sold) || 0);
      if (soldDiff !== 0) return soldDiff;
      return (Number(b.recentViews) || 0) - (Number(a.recentViews) || 0);
    })
    .slice(0, 2);
}

function getLiveTrendPoints() {
  ensureManagerState();

  const dash = gameState.managerDashboard;
  const history = Array.isArray(dash.history) ? dash.history : [];

  const points = history
    .filter((p) => {
      const day = Number(p.day) || 0;
      return day >= 1 && day <= 3;
    })
    .map((p) => ({
      day: Math.max(1, Math.min(3, Number(p.day) || 1)),
      minute: Math.max(0, Math.min(3, Number(p.minute) || 0)),
      views: Math.max(0, Number(p.views) || 0),
      isDayEnd: !!p.isDayEnd
    }));

  // Make sure graph begins at origin.
  const hasOrigin = points.some((p) => p.day === 1 && p.minute === 0);

  if (!hasOrigin) {
    points.unshift({
      day: 1,
      minute: 0,
      views: 0,
      isDayEnd: false
    });
  }

  return points;
}

function buildViewsChart() {
  const pointsData = getLiveTrendPoints();

  const width = 410;
  const height = 240;

  const padLeft = 82;
  const padRight = 22;
  const padTop = 28;
  const padBottom = 46;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const yMax = 10000;
const yTicks = [0, 2000, 4000, 6000, 8000, 10000];

  function xValueForPoint(p) {
    const day = Math.max(1, Math.min(3, Number(p.day) || 1));
    const minute = Math.max(0, Math.min(3, Number(p.minute) || 0));
    return (day - 1) + minute / 3;
  }

  const xFor = (xValue) => {
    const safeX = Math.max(0, Math.min(3, Number(xValue) || 0));
    return padLeft + (safeX / 3) * chartW;
  };

  const yFor = (value) => {
    const safeValue = Math.max(0, Math.min(yMax, Number(value) || 0));
    return padTop + chartH - (safeValue / yMax) * chartH;
  };

  const gridLines = yTicks.map((tick) => {
    const y = yFor(tick);

    return `
      <line
        x1="${padLeft}"
        y1="${y}"
        x2="${width - padRight}"
        y2="${y}"
        class="managerGridLine"
      ></line>

      <text
        x="${padLeft - 12}"
        y="${y + 4}"
        text-anchor="end"
        class="managerAxisText"
      >${tick}</text>
    `;
  }).join("");

  const xLabels = [1, 2, 3].map((dayNumber) => {
    const x = xFor(dayNumber);

    return `
      <text
        x="${x}"
        y="${padTop + chartH + 20}"
        text-anchor="middle"
        class="managerAxisText"
      >${dayNumber}</text>
    `;
  }).join("");

  const dots = pointsData.map((p) => {
    const xValue = xValueForPoint(p);
    const cx = xFor(xValue);
    const cy = yFor(p.views);

    return `
      <rect
        x="${cx - 4}"
        y="${cy - 4}"
        width="8"
        height="8"
        class="${p.isDayEnd ? "managerPlotDot managerPlotDotEnd" : "managerPlotDot"}"
      ></rect>
    `;
  }).join("");

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="xMidYMid meet"
      class="managerSparkSvg"
      aria-hidden="true"
    >
      ${gridLines}

      <line
        x1="${padLeft}"
        y1="${padTop}"
        x2="${padLeft}"
        y2="${padTop + chartH}"
        class="managerAxisLine"
      ></line>

      <line
        x1="${padLeft}"
        y1="${padTop + chartH}"
        x2="${width - padRight}"
        y2="${padTop + chartH}"
        class="managerAxisLine"
      ></line>

      ${dots}
      ${xLabels}

      <text
        x="${padLeft + chartW / 2}"
        y="${height - 4}"
        text-anchor="middle"
        class="managerAxisTitle"
      >DAYS</text>

      <text
        x="22"
        y="${padTop + chartH / 2}"
        text-anchor="middle"
        class="managerYAxisTitle"
        transform="rotate(-90 22 ${padTop + chartH / 2})"
      >VIEWS</text>
    </svg>
  `;
}

function getHealthScoreData() {
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const followers = Math.max(0, Number(gameState.followers) || 0);
  const views = Math.max(0, Number(gameState.views) || 0);
  const revenue = Math.max(0, Number(gameState.revenue) || 0);

  const avgDelivery = getAverageDeliverySec();
  const avgChat = getAverageChatSec();

  const orders = gameState.orders || [];

  const completedOrders = orders.filter((o) =>
    o.status === "COMPLETED" ||
    o.status === "REFUND_REQUESTED" ||
    o.status === "REFUNDED"
  ).length;

  const badOrders = orders.filter((o) =>
    o.status === "CANCELLED" || o.status === "REFUNDED"
  ).length;

  const activeOrders = orders.filter((o) =>
    o.status === "NEW" ||
    o.status === "PACKING" ||
    o.status === "READY_TO_SHIP" ||
    o.status === "SHIPPING" ||
    o.status === "DELIVERED" ||
    o.status === "REFUND_REQUESTED"
  ).length;

  const totalOrders = Math.max(1, orders.length);
  const badOrderRate = badOrders / totalOrders;

  /*
    Health score should start low.
    The player only improves by actually gaining views/followers,
    completing orders, and responding quickly.
  */

  const starScore = (level - 1) * 8; 
  // level 1 = 0, level 5 = 32

  const followerScore = Math.min(16, followers / 35);
  const viewScore = Math.min(18, views / 150);
  const revenueScore = Math.min(12, revenue / 45);
  const completedOrderScore = Math.min(14, completedOrders * 3.5);

  let deliveryScore = 0;
  if (avgDelivery > 0 && avgDelivery <= 18) deliveryScore = 8;
  else if (avgDelivery > 0 && avgDelivery <= 30) deliveryScore = 6;
  else if (avgDelivery > 0 && avgDelivery <= 45) deliveryScore = 3;

  let chatScore = 0;
  if (avgChat > 0 && avgChat <= 10) chatScore = 8;
  else if (avgChat > 0 && avgChat <= 20) chatScore = 6;
  else if (avgChat > 0 && avgChat <= 35) chatScore = 3;

  const badOrderPenalty = badOrderRate * 16;
  const activeOrderPenalty = Math.min(8, activeOrders * 1.1);

  const rawScore =
    starScore +
    followerScore +
    viewScore +
    revenueScore +
    completedOrderScore +
    deliveryScore +
    chatScore -
    badOrderPenalty -
    activeOrderPenalty;

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Needle rotates from left to right.
// Poor starts more dramatic to the left.
const needleDeg = -92 + (score / 100) * 152;

  let status = "POOR";
  let message = "MR.BAO ISN'T HAPPY WITH YOUR WORK. WORK HARDER TO UP YOUR SCORE.";

  if (score >= 30 && score < 55) {
    status = "NOT BAD";
    message = "YOUR STORE IS IMPROVING, BUT THERE'S STILL A LOT OF WORK TO DO.";
  } else if (score >= 55 && score < 78) {
    status = "OK";
    message = "YOUR STORE IS DOING DECENTLY. KEEP PUSHING FOR BETTER RESULTS.";
  } else if (score >= 78) {
    status = "GOOD";
    message = "GREAT JOB! YOUR STORE IS HEALTHY AND MR.BAO IS PROUD OF YOU.";
  }

  return {
  score,
  status,
  message,
  needleDeg,
  avatar: "assets/manager/mrbaoavatar.png"
};
}

function resetWarningDayIfNeeded() {
  const today = Number(gameState.day) || 1;
  if (managerWarningSeen.day === today) return;

  managerWarningSeen.day = today;
  managerWarningSeen.lowRevenue100 = false;
  managerWarningSeen.lowRevenue50 = false;
  managerWarningSeen.lowFollowers100 = false;
  managerWarningSeen.lowViews100 = false;
  managerWarningSeen.slowChat = false;
  managerWarningSeen.slowDelivery = false;

  managerWarningQueue = [];
  hideCurrentWarning();
}


function getWarningVisual(message) {
  const upper = String(message || "").toUpperCase();

  if (upper.includes("BALANCE")) {
    return {
      text: "LOW IN BALANCE",
      icon: "assets/popup/insufficientfundicon.png"
    };
  }

  if (upper.includes("VIEWS")) {
    return {
      text: "LOW VIEWS",
      icon: "assets/popup/cautionsign.png"
    };
  }

  if (upper.includes("FOLLOWERS")) {
    return {
      text: "LOW FOLLOWERS",
      icon: "assets/popup/cautionsign.png"
    };
  }

  if (upper.includes("DELIVERY")) {
    return {
      text: "SLOW DELIVERY",
      icon: "assets/popup/cautionsign.png"
    };
  }

  if (upper.includes("CHAT")) {
    return {
      text: "SLOW CHAT SPEED",
      icon: "assets/popup/cautionsign.png"
    };
  }

  return {
    text: upper,
    icon: "assets/popup/cautionsign.png"
  };
}


function stopOldGlobalCautionAudio() {
  if (window.__managerCautionAudio) {
    window.__managerCautionAudio.pause();
    window.__managerCautionAudio.currentTime = 0;
    window.__managerCautionAudio = null;
  }
}


function playManagerCautionSound() {
  // Do not let hidden manager pages play sound
  if (!isManagerPageVisible()) {
    stopManagerCautionSound();
    return;
  }

  const audio = document.getElementById("managerCautionAudio");
  if (!audio) return;
  if (!managerWarningShowing) return;

  // Stop old audio object from earlier versions
  if (window.__managerCautionAudio) {
    window.__managerCautionAudio.pause();
    window.__managerCautionAudio.currentTime = 0;
    window.__managerCautionAudio = null;
  }

  // Do not start again if already playing
  if (!audio.paused) return;

  audio.muted = false;
  audio.currentTime = 0;
  audio.volume = 0.75;
  audio.loop = true;

  audio.play().catch((err) => {
    console.warn("[Manager] Caution sound blocked:", err);
  });
}

function stopManagerCautionSound() {
  const audio = document.getElementById("managerCautionAudio");

  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  // Also stop old audio object from earlier versions
  if (window.__managerCautionAudio) {
    window.__managerCautionAudio.pause();
    window.__managerCautionAudio.currentTime = 0;
    window.__managerCautionAudio = null;
  }
}
  
function showManagerWarning(message) {
  if (!isManagerPageVisible()) return;
  if (managerWarningShowing) return;

  const popup =
    el.managerWarningPopup ||
    document.getElementById("managerWarningPopup");

  const warningText =
    el.managerWarningText ||
    document.getElementById("managerWarningText");

  const warningIcon =
    el.managerWarningIconImg ||
    document.getElementById("managerWarningIconImg");

  if (!popup) return;

  managerWarningShowing = true;
  managerCurrentWarningMessage = message;

  const visual = getWarningVisual(message);

  if (warningText) warningText.textContent = visual.text;
  if (warningIcon) warningIcon.src = visual.icon;

  popup.classList.remove("hidden");

  playManagerCautionSound();
}


function processManagerWarningQueue() {
  if (managerWarningShowing) return;

  if (!managerWarningQueue.length) {
    stopManagerCautionSound();
    return;
  }

  const nextMessage = managerWarningQueue.shift();
  showManagerWarning(nextMessage);
}


function hideCurrentWarning() {
  managerWarningShowing = false;
  managerCurrentWarningMessage = null;

  const popup =
    el.managerWarningPopup ||
    document.getElementById("managerWarningPopup");

  if (popup) {
    popup.classList.add("hidden");
  }

  stopManagerCautionSound();

  // Show the next warning after the current one is closed.
  setTimeout(() => {
    processManagerWarningQueue();
  }, 150);
}

function enqueueWarning(message) {
  if (!message) return;
  if (!isManagerPageVisible()) return;

  // Do not duplicate the currently visible warning.
  if (managerCurrentWarningMessage === message) return;

  // Do not duplicate a warning already waiting.
  if (managerWarningQueue.includes(message)) return;

  managerWarningQueue.push(message);
  processManagerWarningQueue();
}


function hasWarningDelayPassed() {
  const elapsedSec = Math.max(0, 180 - (Number(gameState.secondsLeft) || 0));
  return elapsedSec >= WARNING_DELAY_SEC;
}

function checkManagerWarnings() {
  resetWarningDayIfNeeded();
  if (!hasWarningDelayPassed()) return;

  const revenue = Number(gameState.revenue) || 0;
  const followers = Number(gameState.followers) || 0;
  const views = Number(gameState.views) || 0;
  const avgChatSec = getAverageChatSec();
  const avgDeliverySec = getAverageDeliverySec();

  if (!managerWarningSeen.slowChat && avgChatSec > 20) {
    managerWarningSeen.slowChat = true;
    enqueueWarning("SLOW CHAT SPEED");
  }

  if (!managerWarningSeen.slowDelivery && avgDeliverySec > 40) {
    managerWarningSeen.slowDelivery = true;
    enqueueWarning("SLOW DELIVERY SPEED");
  }

  if (!managerWarningSeen.lowRevenue100 && revenue <= 100) {
    managerWarningSeen.lowRevenue100 = true;
    enqueueWarning("LOW IN BALANCE");
  }

  if (!managerWarningSeen.lowRevenue50 && revenue <= 50) {
    managerWarningSeen.lowRevenue50 = true;
    enqueueWarning("LOW IN BALANCE");
  }

  if (!managerWarningSeen.lowFollowers100 && followers < 100) {
    managerWarningSeen.lowFollowers100 = true;
    enqueueWarning("LOW FOLLOWERS");
  }

  if (!managerWarningSeen.lowViews100 && views < 100) {
    managerWarningSeen.lowViews100 = true;
    enqueueWarning("LOW VIEWS");
  }
}

export function renderManagerDashboard() {
  if (!el.pageManager) return;

  ensureManagerState();
  sampleHistory();

  const bestProducts = getBestSellingProducts();
  const totalOrders =
  Number(gameState.analytics?.lifetime?.ordersCreated) ||
  (gameState.orders || []).length ||
  0;
  const totalViews = getAccumulatedTotalViews();
  const health = getHealthScoreData();

  const avatarSrc = getResolvedAvatarSrc();
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Number(gameState.day) || 1;

  if (el.managerWelcomeName) {
    el.managerWelcomeName.textContent = (shopInfo.name || "[STORE NAME]").toUpperCase();
  }

  if (el.managerProfileAvatar) {
    el.managerProfileAvatar.src = avatarSrc;
  }

  if (el.managerProfileStoreName) {
    el.managerProfileStoreName.textContent = (shopInfo.name || "[STORE NAME]").toUpperCase();
  }

  if (el.managerProfileSellerId) {
    el.managerProfileSellerId.textContent = `SELLER ID: ${shopInfo.id || "[ID]"}`;
  }

  if (el.managerProfileRegion) {
    el.managerProfileRegion.textContent = `REGION: ${(shopInfo.region || "[REGION]").toUpperCase()}`;
  }

  if (el.managerProfileStoreType) {
    el.managerProfileStoreType.textContent = `STORE TYPE: ${(shopInfo.storeType || "[TYPE]").toUpperCase()}`;
  }

  if (el.managerDayIcon) {
    el.managerDayIcon.src = `assets/manager/day${Math.max(1, Math.min(3, day))}_icon.png`;
  }

  if (el.managerDayText) {
    el.managerDayText.textContent = `DAY ${day}`;
  }

  if (el.managerTimeText) {
    const secs = Math.max(0, Number(gameState.secondsLeft) || 0);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    el.managerTimeText.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (el.managerStarsImg) {
    el.managerStarsImg.src = `assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png`;
  }

  if (el.managerFollowers) {
    el.managerFollowers.textContent = formatCompact(gameState.followers || 0);
  }

  if (el.managerAwaitingShipment) {
    el.managerAwaitingShipment.textContent = formatCompact(getAwaitingShipmentCount());
  }

  if (el.managerRevenue) {
    el.managerRevenue.textContent = formatCompact(gameState.revenue || 0);
  }

  if (el.managerManufacturingCost) {
    el.managerManufacturingCost.textContent = formatCompact(getTotalManufacturingCost());
  }

  if (el.managerDeliverySpeed) {
    el.managerDeliverySpeed.textContent = String(Math.round(getAverageDeliverySec()));
  }

  if (el.managerChatSpeed) {
    el.managerChatSpeed.textContent = String(Math.round(getAverageChatSec()));
  }

  if (el.managerOrdersToday) {
    el.managerOrdersToday.textContent = String(getOrdersToday());
  }

  if (el.managerTotalOrders) {
    el.managerTotalOrders.textContent = String(totalOrders);
  }

  const managerViewsTodayEl = el.managerViewsToday || document.getElementById("managerViewsToday");
const managerTotalViewsEl = el.managerTotalViews || document.getElementById("managerTotalViews");

if (managerViewsTodayEl) {
  managerViewsTodayEl.textContent = formatCompact(getViewsToday());
}

if (managerTotalViewsEl) {
  managerTotalViewsEl.textContent = formatCompact(totalViews);
}

  if (el.managerChartSvg) {
    el.managerChartSvg.innerHTML = buildViewsChart();
  }

  if (el.managerHealthStatus) {
    el.managerHealthStatus.textContent = health.status;
  }

  if (el.managerHealthMessage) {
    el.managerHealthMessage.textContent = health.message;
  }

  if (el.managerHealthNeedle) {
  let needleLeft = 10;
  let needleTop = 74;
  let finalNeedleDeg = health.needleDeg;

  if (health.status === "POOR") {
    needleLeft = 10;
    needleTop = 74;
    finalNeedleDeg = health.needleDeg;
  }

  if (health.status === "NOT BAD") {
    needleLeft = 33;
    needleTop = 45;
    finalNeedleDeg = health.needleDeg - 8;
  }

  if (health.status === "OK") {
    needleLeft = 73;
    needleTop = 50;
    finalNeedleDeg = health.needleDeg - 14;
  }

  if (health.status === "GOOD") {
    needleLeft = 100;
    needleTop = 74;
    finalNeedleDeg = health.needleDeg + 30;
  }

  el.managerHealthNeedle.style.left = `${needleLeft}px`;
  el.managerHealthNeedle.style.top = `${needleTop}px`;
  el.managerHealthNeedle.style.transform = `rotate(${finalNeedleDeg}deg)`;
}

if (el.managerHealthAvatar) {
  el.managerHealthAvatar.src = health.avatar;
}

  if (el.managerBestProducts) {
  const bestProductsKey = bestProducts
    .map((p) => `${p.id || p.name}|${p.img}|${p.name}`)
    .join("::");

  // Only rebuild the Best Sellers block if the actual products changed.
  // This prevents image reload flickering during normal dashboard updates.
  if (el.managerBestProducts.dataset.renderKey !== bestProductsKey) {
    el.managerBestProducts.dataset.renderKey = bestProductsKey;

    if (!bestProducts.length) {
      el.managerBestProducts.innerHTML = `
        <div class="managerProductsEmpty">NO BESTSELLERS YET</div>
      `;
    } else {
      el.managerBestProducts.innerHTML = bestProducts.map((p) => `
        <div class="managerProductMini">
          <img class="managerProductMiniImg" src="${p.img}" alt="${p.name}">
          <div class="managerProductMiniMeta">
            <div class="managerProductMiniName">${String(p.name || "").toUpperCase()}</div>
          </div>
        </div>
      `).join("");
    }
  }
}

  if (isManagerPageVisible()) {
  checkManagerWarnings();
} else {
  hideCurrentWarning();
}

}

export function enterManagerPage() {
  stopNonManagerAudio();

  const params = new URLSearchParams(window.location.search);
  const isRemoteManager = params.get("manager") === "1";

  // Remote manager receives phone data through Socket.IO.
  // Do not load laptop localStorage or it will flicker with the phone state.
  if (!isRemoteManager) {
    loadSharedState();
  }

  showPage("pageManager");
  renderManagerDashboard();

  if (!managerTicker) {
    managerTicker = setInterval(() => {
      if (!isRemoteManager) {
        loadSharedState();
      }

      renderManagerDashboard();
    }, 1000);
  }
}


export function initManagerPage() {
  stopNonManagerAudio();
  stopOldGlobalCautionAudio();

  const backBtn = el.managerBackBtn || document.getElementById("managerBackBtn");

  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = "1";
    backBtn.onclick = () => {
      window.close();
    };
  }

  const closeBtn = document.getElementById("managerWarningCloseBtn");

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      hideCurrentWarning();
    };
  }
}

