// manager_screen/manager.js

let gameState = {};
let shopInfo = {};

let managerCurrentWarningMessage = null;
let managerWarningShowing = false;
let managerWarningQueue = [];

const WARNING_DELAY_SEC = 30;

const managerWarningSeen = {
  day: null,
  lowRevenue100: false,
  lowRevenue50: false,
  lowFollowers100: false,
  lowViews100: false,
  slowChat: false,
  slowDelivery: false
};

const els = {};

function cacheEls() {
  [
    "pageManager",
    "managerWelcomeName",
    "managerProfileAvatar",
    "managerProfileStoreName",
    "managerProfileSellerId",
    "managerProfileRegion",
    "managerProfileStoreType",
    "managerDayIcon",
    "managerDayText",
    "managerTimeText",
    "managerStarsImg",
    "managerFollowers",
    "managerAwaitingShipment",
    "managerRevenue",
    "managerManufacturingCost",
    "managerDeliverySpeed",
    "managerChatSpeed",
    "managerOrdersToday",
    "managerTotalOrders",
    "managerViewsToday",
    "managerTotalViews",
    "managerChartSvg",
    "managerHealthStatus",
    "managerHealthMessage",
    "managerHealthNeedle",
    "managerHealthAvatar",
    "managerBestProducts",
    "managerWarningPopup",
    "managerWarningText",
    "managerWarningIconImg",
    "managerWarningCloseBtn",
    "managerCautionAudio",
    "managerBackBtn"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function isManagerPageVisible() {
  return !!els.pageManager && els.pageManager.classList.contains("show");
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

function getResolvedAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;

  const idx = Number(shopInfo.avatarNumber) || 0;
  const fallbackAvatars = [
    "assets/avatars/flowerpfp.png",
    "assets/avatars/frog.png"
  ];

  return fallbackAvatars[idx] || "assets/avatars/frog.png";
}

function getHomeProductsSafe() {
  return (shopInfo.chosenProducts || []).filter((p) => p.onHome);
}

function getTotalManufacturingCostSafe() {
  const costs = gameState.costs || {};

  const knownCost =
    Number(costs.inventorySpent || 0) +
    Number(costs.shippingBoxesSpent || 0) +
    Number(costs.unlockSpent || 0);

  if (knownCost > 0) return knownCost;

  return (shopInfo.chosenProducts || []).reduce((sum, p) => {
    const cost = Number(p.cost || p.manufacturingCost || 0);
    const qty = Number(p.qty || 0);
    return sum + cost * qty;
  }, 0);
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

  if (currentDay === 1) {
    dash.dayStartViews = 0;
  }

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
  const slot = Math.max(0, Math.min(6, Math.floor(elapsedSec / 30)));
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

function getAwaitingShipmentCount() {
  return (gameState.orders || []).filter((o) =>
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

  const width = 330;
  const height = 206;

  const padLeft = 76;
  const padRight = 10;
  const padTop = 30;
  const padBottom = 38;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const yMax = 5000;
  const yTicks = [0, 1000, 2000, 3000, 4000, 5000];

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
      <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="managerGridLine"></line>
      <text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" class="managerAxisText">${tick}</text>
    `;
  }).join("");

  const xLabels = [1, 2, 3].map((dayNumber) => {
    const x = xFor(dayNumber);

    return `
      <text x="${x}" y="${padTop + chartH + 18}" text-anchor="middle" class="managerAxisText">${dayNumber}</text>
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
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="managerSparkSvg" aria-hidden="true">
      ${gridLines}

      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + chartH}" class="managerAxisLine"></line>
      <line x1="${padLeft}" y1="${padTop + chartH}" x2="${width - padRight}" y2="${padTop + chartH}" class="managerAxisLine"></line>

      ${dots}
      ${xLabels}

      <text x="${padLeft + chartW / 2}" y="${height - 1}" text-anchor="middle" class="managerAxisTitle">DAYS</text>
      <text x="18" y="${padTop + chartH / 2}" text-anchor="middle" class="managerYAxisTitle">VIEWS</text>
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

  const starScore = (level - 1) * 8;
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

function playManagerCautionSound() {
  if (!isManagerPageVisible()) {
    stopManagerCautionSound();
    return;
  }

  const audio = els.managerCautionAudio;
  if (!audio) return;
  if (!managerWarningShowing) return;

  if (!audio.paused) return;

  audio.currentTime = 0;
  audio.volume = 0.75;
  audio.loop = true;

  audio.play().catch((err) => {
    console.warn("[Manager] Caution sound blocked:", err);
  });
}

function stopManagerCautionSound() {
  const audio = els.managerCautionAudio;

  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

function showManagerWarning(message) {
  if (!isManagerPageVisible()) return;
  if (managerWarningShowing) return;
  if (!els.managerWarningPopup) return;

  managerWarningShowing = true;
  managerCurrentWarningMessage = message;

  const visual = getWarningVisual(message);

  if (els.managerWarningText) els.managerWarningText.textContent = visual.text;
  if (els.managerWarningIconImg) els.managerWarningIconImg.src = visual.icon;

  els.managerWarningPopup.classList.remove("hidden");

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

  if (els.managerWarningPopup) {
    els.managerWarningPopup.classList.add("hidden");
  }

  stopManagerCautionSound();

  setTimeout(() => {
    processManagerWarningQueue();
  }, 150);
}

function enqueueWarning(message) {
  if (!message) return;
  if (!isManagerPageVisible()) return;
  if (managerCurrentWarningMessage === message) return;
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

function renderManagerDashboard() {
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

  if (els.managerWelcomeName) {
    els.managerWelcomeName.textContent = (shopInfo.name || "[STORE NAME]").toUpperCase();
  }

  if (els.managerProfileAvatar) {
    els.managerProfileAvatar.src = avatarSrc;
  }

  if (els.managerProfileStoreName) {
    els.managerProfileStoreName.textContent = (shopInfo.name || "[STORE NAME]").toUpperCase();
  }

  if (els.managerProfileSellerId) {
    els.managerProfileSellerId.textContent = `SELLER ID: ${shopInfo.id || "[ID]"}`;
  }

  if (els.managerProfileRegion) {
    els.managerProfileRegion.textContent = `REGION: ${(shopInfo.region || "[REGION]").toUpperCase()}`;
  }

  if (els.managerProfileStoreType) {
    els.managerProfileStoreType.textContent = `STORE TYPE: ${(shopInfo.storeType || "[TYPE]").toUpperCase()}`;
  }

  if (els.managerDayIcon) {
    els.managerDayIcon.src = `assets/manager/day${Math.max(1, Math.min(3, day))}_icon.png`;
  }

  if (els.managerDayText) {
    els.managerDayText.textContent = `DAY ${day}`;
  }

  if (els.managerTimeText) {
    const secs = Math.max(0, Number(gameState.secondsLeft) || 0);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    els.managerTimeText.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (els.managerStarsImg) {
    els.managerStarsImg.src = `assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png`;
  }

  if (els.managerFollowers) {
    els.managerFollowers.textContent = formatCompact(gameState.followers || 0);
  }

  if (els.managerAwaitingShipment) {
    els.managerAwaitingShipment.textContent = formatCompact(getAwaitingShipmentCount());
  }

  if (els.managerRevenue) {
    els.managerRevenue.textContent = formatCompact(gameState.revenue || 0);
  }

  if (els.managerManufacturingCost) {
    els.managerManufacturingCost.textContent = formatCompact(getTotalManufacturingCostSafe());
  }

  if (els.managerDeliverySpeed) {
    els.managerDeliverySpeed.textContent = String(Math.round(getAverageDeliverySec()));
  }

  if (els.managerChatSpeed) {
    els.managerChatSpeed.textContent = String(Math.round(getAverageChatSec()));
  }

  if (els.managerOrdersToday) {
    els.managerOrdersToday.textContent = String(getOrdersToday());
  }

  if (els.managerTotalOrders) {
    els.managerTotalOrders.textContent = String(totalOrders);
  }

  if (els.managerViewsToday) {
    els.managerViewsToday.textContent = formatCompact(getViewsToday());
  }

  if (els.managerTotalViews) {
    els.managerTotalViews.textContent = formatCompact(totalViews);
  }

  if (els.managerChartSvg) {
    els.managerChartSvg.innerHTML = buildViewsChart();
  }

  if (els.managerHealthStatus) {
    els.managerHealthStatus.textContent = health.status;
  }

  if (els.managerHealthMessage) {
    els.managerHealthMessage.textContent = health.message;
  }

  if (els.managerHealthNeedle) {
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

    els.managerHealthNeedle.style.left = `${needleLeft}px`;
    els.managerHealthNeedle.style.top = `${needleTop}px`;
    els.managerHealthNeedle.style.transform = `rotate(${finalNeedleDeg}deg)`;
  }

  if (els.managerHealthAvatar) {
    els.managerHealthAvatar.src = health.avatar;
  }

  if (els.managerBestProducts) {
    if (!bestProducts.length) {
      els.managerBestProducts.innerHTML = `<div class="managerProductsEmpty">NO BESTSELLERS YET</div>`;
    } else {
      els.managerBestProducts.innerHTML = bestProducts.map((p) => `
        <div class="managerProductMini">
          <img class="managerProductMiniImg" src="${p.img}" alt="${p.name}">
          <div class="managerProductMiniMeta">
            <div class="managerProductMiniName">${String(p.name || "").toUpperCase()}</div>
          </div>
        </div>
      `).join("");
    }
  }

  if (isManagerPageVisible()) {
    checkManagerWarnings();
  } else {
    hideCurrentWarning();
  }
}

function initSocket() {
  if (typeof io === "undefined") {
    console.warn("[Manager Screen] Socket.IO client not found.");
    return;
  }

  const socket = io(window.location.origin, {
    transports: ["websocket", "polling"]
  });

  socket.on("connect", () => {
    console.log("[Manager Screen] Connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("[Manager Screen] Disconnected.");
  });

  socket.on("gameStateUpdate", (payload) => {
    if (!payload) return;

    if (payload.gameState) {
      gameState = payload.gameState;
    }

    if (payload.shopInfo) {
      shopInfo = payload.shopInfo;
    }

    renderManagerDashboard();
  });
}

function initManagerScreen() {
  cacheEls();

  if (els.managerBackBtn) {
    els.managerBackBtn.onclick = () => {
      window.location.href = "/";
    };
  }

  if (els.managerWarningCloseBtn) {
    els.managerWarningCloseBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideCurrentWarning();
    };
  }

  renderManagerDashboard();
  initSocket();
}

document.addEventListener("DOMContentLoaded", initManagerScreen);