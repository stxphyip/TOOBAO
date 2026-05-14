// js/pages/orders.js

import { el } from "../dom.js";
import { gameState, shopInfo } from "../state.js";
import { avatarImages } from "../data/avatars.js";
import { formatTime } from "../utils.js";
import { renderHud } from "./home.js";
import { openEditProfile } from "../modals/editProfile.js";
import {
  ensureOrdersState,
  packOrder,
  shipOrder,
  collectRevenue,
  refundOrder,
  refreshOrdersNavBadge
} from "../systems/ordersSystem.js";

let ordersBound = false;
let currentFilter = "ALL";
let ordersActionLock = false;

// SLIDER STATE
let savedOrdersScroll = 0;
let isDraggingOrdersSlider = false;
let destroyOrdersSlider = null;

let lastOrdersRenderSignature = "";

const IN_PROGRESS = new Set(["NEW", "PACKING", "READY_TO_SHIP", "SHIPPING", "DELIVERED", "REFUND_REQUESTED"]);
const COMPLETED = new Set(["COMPLETED"]);
const REFUNDS = new Set(["REFUND_REQUESTED", "REFUNDED"]);
const CANCELLED = new Set(["CANCELLED"]);

const TAB_ASSETS = {
  ALL: { inactive: "assets/orders/alltab.png", active: "assets/orders/alltaborange.png" },
  IN_PROGRESS: { inactive: "assets/orders/inprogresstab.png", active: "assets/orders/inprogresstaborange.png" },
  COMPLETED: { inactive: "assets/orders/deliveredtab.png", active: "assets/orders/deliveredtaborange.png" },
  REFUNDS: { inactive: "assets/orders/refundedtab.png", active: "assets/orders/refundedtaborange.png" },
  CANCELLED: { inactive: "assets/orders/canceledtab.png", active: "assets/orders/canceledtaborange.png" }
};

const STAGE_ICONS = {
  receipt: "assets/orders/receipticon.png",
  packed: "assets/orders/shippingboxicon.png",
  shipped: "assets/orders/shippingtruckicon.png",
  completed: "assets/orders/houseicon.png"
};

function showOrderRewardFloat(btn, views = 100, followers = 100) {
  if (!btn) return;

  const rect = btn.getBoundingClientRect();

  const float = document.createElement("div");
  float.className = "orderRewardFloat";

  float.style.left = `${rect.left + rect.width / 2 - 68}px`;
  float.style.top = `${rect.bottom + 6}px`;

  float.innerHTML = `
    <div class="orderRewardFloatRow">
      <span>+ ${views} VIEWS</span>
      <img class="orderRewardFloatIcon" src="assets/ui_icons/views_icon.png" alt="">
    </div>

    <div class="orderRewardFloatRow">
      <span>+ ${followers} FOLLOWERS</span>
      <img class="orderRewardFloatIcon" src="assets/ui_icons/followers_icon.png" alt="">
    </div>
  `;

  document.body.appendChild(float);

  setTimeout(() => {
    float.remove();
  }, 1200);
}

function resolveAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;
  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "";
}

function formatCompact(n) {
  const num = Math.floor(Number(n) || 0);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

// BULLETPROOF SLIDER MECHANICS
function initSlider() {
  const thumb = document.querySelector(".ordersSliderThumb");
  const track = document.querySelector(".ordersDividerLine");
  const viewport = document.querySelector(".ordersTabsViewport");

  if (!thumb || !viewport || !track) return;
  if (destroyOrdersSlider) destroyOrdersSlider();

  requestAnimationFrame(() => {
    viewport.scrollLeft = savedOrdersScroll;
  });

  const getMaxThumbMove = () =>
    Math.max(0, track.clientWidth - thumb.clientWidth - 4);

  const getMaxScroll = () =>
    Math.max(0, viewport.scrollWidth - viewport.clientWidth);

  let startX = 0;
  let startThumbLeft = 0;

  let isDraggingTabs = false;
  let tabStartX = 0;
  let tabStartScrollLeft = 0;

  const getClientX = (e) => {
    if (e.touches && e.touches.length) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
    return e.clientX;
  };

  const syncThumb = () => {
    savedOrdersScroll = viewport.scrollLeft;
    if (isDraggingOrdersSlider) return;

    const maxScroll = getMaxScroll();
    const maxThumbMove = getMaxThumbMove();

    if (maxScroll <= 0) {
      thumb.style.left = "0px";
      return;
    }

    const scrollPct = viewport.scrollLeft / maxScroll;
    thumb.style.left = `${scrollPct * maxThumbMove}px`;
  };

  const onThumbMove = (e) => {
    if (!isDraggingOrdersSlider) return;

    const clientX = getClientX(e);
    const dx = clientX - startX;
    const maxThumbMove = getMaxThumbMove();

    let newLeft = Math.max(0, Math.min(startThumbLeft + dx, maxThumbMove));
    thumb.style.left = `${newLeft}px`;

    const scrollRatio = maxThumbMove > 0 ? newLeft / maxThumbMove : 0;
    viewport.scrollLeft = scrollRatio * getMaxScroll();
    savedOrdersScroll = viewport.scrollLeft;

    if (e.cancelable) e.preventDefault();
  };

  const onThumbEnd = () => {
    isDraggingOrdersSlider = false;
    thumb.style.cursor = "grab";

    window.removeEventListener("mousemove", onThumbMove);
    window.removeEventListener("mouseup", onThumbEnd);
    window.removeEventListener("touchmove", onThumbMove);
    window.removeEventListener("touchend", onThumbEnd);
  };

  const onThumbStart = (e) => {
    isDraggingOrdersSlider = true;
    startX = getClientX(e);
    startThumbLeft = parseInt(window.getComputedStyle(thumb).left, 10) || 0;
    thumb.style.cursor = "grabbing";

    window.addEventListener("mousemove", onThumbMove);
    window.addEventListener("mouseup", onThumbEnd);
    window.addEventListener("touchmove", onThumbMove, { passive: false });
    window.addEventListener("touchend", onThumbEnd);

    if (e.cancelable) e.preventDefault();
  };

  thumb.addEventListener("mousedown", onThumbStart);
  thumb.addEventListener("touchstart", onThumbStart, { passive: false });

  const onTabsMove = (e) => {
    if (!isDraggingTabs) return;

    const clientX = getClientX(e);
    viewport.scrollLeft = tabStartScrollLeft - (clientX - tabStartX);
    savedOrdersScroll = viewport.scrollLeft;

    if (e.cancelable) e.preventDefault();
  };

  const onTabsEnd = () => {
    isDraggingTabs = false;
    viewport.style.cursor = "auto";

    window.removeEventListener("mousemove", onTabsMove);
    window.removeEventListener("mouseup", onTabsEnd);
    window.removeEventListener("touchmove", onTabsMove);
    window.removeEventListener("touchend", onTabsEnd);
  };

  const onTabsStart = (e) => {
    if (e.target.closest(".ordersTabBtn") || e.target.closest(".ordersSliderThumb")) return;

    isDraggingTabs = true;
    tabStartX = getClientX(e);
    tabStartScrollLeft = viewport.scrollLeft;
    viewport.style.cursor = "grabbing";

    window.addEventListener("mousemove", onTabsMove);
    window.addEventListener("mouseup", onTabsEnd);
    window.addEventListener("touchmove", onTabsMove, { passive: false });
    window.addEventListener("touchend", onTabsEnd);
  };

  viewport.addEventListener("mousedown", onTabsStart);
  viewport.addEventListener("touchstart", onTabsStart, { passive: false });

  viewport.addEventListener("scroll", syncThumb, { passive: true });

  const ro = new ResizeObserver(() => syncThumb());
  ro.observe(viewport);
  if (viewport.firstElementChild) ro.observe(viewport.firstElementChild);

  syncThumb();

  destroyOrdersSlider = () => {
    thumb.removeEventListener("mousedown", onThumbStart);
    thumb.removeEventListener("touchstart", onThumbStart);

    viewport.removeEventListener("mousedown", onTabsStart);
    viewport.removeEventListener("touchstart", onTabsStart);
    viewport.removeEventListener("scroll", syncThumb);

    window.removeEventListener("mousemove", onThumbMove);
    window.removeEventListener("mouseup", onThumbEnd);
    window.removeEventListener("touchmove", onThumbMove);
    window.removeEventListener("touchend", onThumbEnd);

    window.removeEventListener("mousemove", onTabsMove);
    window.removeEventListener("mouseup", onTabsEnd);
    window.removeEventListener("touchmove", onTabsMove);
    window.removeEventListener("touchend", onTabsEnd);

    ro.disconnect();
  };
}

function renderOrdersTopStats() {
  const root = document.getElementById("ordersTopStats");
  if (!root) return;
  const boxes = Math.max(0, (Number(gameState.shippingMaterials)||0) - (Number(gameState.reservedShippingMaterials)||0));
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));

  root.innerHTML = `
    <div class="ordersTopStatsInner">
      <button id="ordersAvatarBtn" class="ordersAvatarBtn" type="button"><img class="ordersAvatarLarge" src="${resolveAvatarSrc()}"></button>
      <div class="ordersStoreMain">
        <div class="ordersStoreNameLarge">${shopInfo.name || "[STORE NAME]"}</div>
        <img class="ordersStarsImg" src="assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png">
        <div class="ordersOrangeStatsRow">
          <div class="ordersOrangeStat ordersFollowersStat"><img class="ordersStatIcon" src="assets/ui_icons/followers_icon.png"><span class="ordersStatValue">${formatCompact(gameState.followers)}</span></div>
          <div class="ordersOrangeStat ordersViewsStat"><img class="ordersStatIcon" src="assets/ui_icons/views_icon.png"><span class="ordersStatValue">${formatCompact(gameState.views)}</span></div>
          <button id="ordersBoxesBtn" class="ordersOrangeStat ordersBoxesStat" type="button"><img class="ordersStatIcon" src="assets/ui_icons/shippingbox_icon.png"><span class="ordersStatValue">${formatCompact(boxes)}</span></button>
          <div class="ordersOrangeStat ordersMoneyStat"><img class="ordersStatIcon" src="assets/ui_icons/coin_icon.png"><span class="ordersStatValue">${formatCompact(gameState.revenue)}</span></div>
        </div>
      </div>
      <div class="ordersRightStatsCol">
        <div class="ordersOrangeStat ordersDayStat"><img class="ordersStatIcon" src="assets/ui_icons/day${day}_icon.png"><span class="ordersStatValue">DAY ${gameState.day}</span></div>
        <div class="ordersOrangeStat ordersTimeStat"><img class="ordersStatIcon" src="assets/ui_icons/time_icon.png"><span class="ordersStatValue">${formatTime(gameState.secondsLeft)}</span></div>
      </div>
    </div>
  `;
  document.getElementById("ordersAvatarBtn").onclick = () => openEditProfile();
}

function updateOrdersTopStatsValues() {
  const boxes = Math.max(
    0,
    (Number(gameState.shippingMaterials) || 0) -
    (Number(gameState.reservedShippingMaterials) || 0)
  );

  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));

  const followersEl = document.querySelector(".ordersFollowersStat .ordersStatValue");
  const viewsEl = document.querySelector(".ordersViewsStat .ordersStatValue");
  const boxesEl = document.querySelector(".ordersBoxesStat .ordersStatValue");
  const moneyEl = document.querySelector(".ordersMoneyStat .ordersStatValue");
  const dayEl = document.querySelector(".ordersDayStat .ordersStatValue");
  const timeEl = document.querySelector(".ordersTimeStat .ordersStatValue");
  const starsEl = document.querySelector(".ordersStarsImg");

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

function bindOrdersActionButtons() {
  const list = document.getElementById("ordersList");
  if (!list || list.dataset.actionsBound === "1") return;

  list.dataset.actionsBound = "1";

  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".orderPixelActionBtn[data-action]");
    if (!btn || btn.disabled || ordersActionLock) return;

    e.preventDefault();
    e.stopPropagation();

    const action = btn.dataset.action;
    const id = String(btn.dataset.id || "");

    if (!id) return;

    ordersActionLock = true;
    btn.disabled = true;

    try {
      let result = false;

      if (action === "pack") {
        result = packOrder(id);
      }

      if (action === "ship") {
        result = shipOrder(id);
      }

      if (action === "collect") {
        result = collectRevenue(id);

        if (result?.success) {
          showOrderRewardFloat(btn, result.views, result.followers);
        }
      }

      if (action === "refund") {
        result = refundOrder(id);

        if (result?.success) {
          showOrderRewardFloat(btn, result.views, result.followers);
        }
      }

      if (!(result === true || result?.success)) {
        btn.disabled = false;
      }

      window.__refreshOrdersUI?.();
    } finally {
      setTimeout(() => {
        ordersActionLock = false;
      }, 180);
    }
  });
}

// --------------------------------------------------------
// EXPORT: initOrdersPage() (Called by app.js on boot)
// --------------------------------------------------------
export function initOrdersPage() {
  if (ordersBound) return;

  const tabsRoot = document.getElementById("ordersTabs");
  if (tabsRoot) {
  tabsRoot.addEventListener("click", (e) => {
    const btn = e.target.closest(".ordersTabBtn");
    if (!btn) return;

    const viewport = document.querySelector(".ordersTabsViewport");
    if (viewport) savedOrdersScroll = viewport.scrollLeft;

    currentFilter = btn.dataset.filter;
    renderTabs();
    renderOrders(true);

    requestAnimationFrame(() => {
      const vp = document.querySelector(".ordersTabsViewport");
      if (vp) vp.scrollLeft = savedOrdersScroll;
    });
  });
}

bindOrdersActionButtons();
  initSlider();
  ordersBound = true;
}

// Persists DOM elements to prevent scroll reset bugs
function renderTabs() {
  const root = document.getElementById("ordersTabs");
  if (!root) return;

  if (root.children.length === 0) {
    root.innerHTML = Object.entries(TAB_ASSETS).map(([f, c]) => `
      <button class="ordersTabBtn" data-filter="${f}">
        <img class="ordersTabImg" src="${c.inactive}">
        <span class="ordersTabCount">0</span>
      </button>`).join("");
  }
  
  Object.entries(TAB_ASSETS).forEach(([f, c]) => {
    const btn = root.querySelector(`[data-filter="${f}"]`);
    if (!btn) return;
    const isActive = currentFilter === f;
    btn.setAttribute("data-active", isActive);
    btn.querySelector('.ordersTabImg').src = isActive ? c.active : c.inactive;
  });

  refreshBadges();
}

function refreshBadges() {
  const orders = gameState.orders || [];
  const counts = { 
    ALL: orders.length, 
    IN_PROGRESS: orders.filter(o => IN_PROGRESS.has(o.status)).length, 
    COMPLETED: orders.filter(o => COMPLETED.has(o.status)).length, 
    REFUNDS: orders.filter(o => REFUNDS.has(o.status)).length, 
    CANCELLED: orders.filter(o => CANCELLED.has(o.status)).length 
  };
  Object.entries(counts).forEach(([f, n]) => {
    const b = document.querySelector(`.ordersTabBtn[data-filter="${f}"] .ordersTabCount`);
    if (b) b.textContent = n;
  });
}

function orderStatusPriority(o) {
  const status = o.status;

  // Top = most urgent/actionable
  if (status === "NEW") return 10;              // needs PACK
  if (status === "READY_TO_SHIP") return 20;    // needs SHIP
  if (status === "DELIVERED") return 30;        // needs COLLECT
  if (status === "REFUND_REQUESTED") return 40; // needs REFUND

  // In progress but no button yet
  if (status === "PACKING") return 50;
  if (status === "SHIPPING") return 60;

  // Finished statuses go to bottom
  if (status === "COMPLETED") return 90;
  if (status === "REFUNDED") return 95;
  if (status === "CANCELLED") return 100;

  return 999;
}

function orderSortTime(o) {
  if (o.status === "COMPLETED") return Number(o.completedAt) || 0;
  if (o.status === "DELIVERED") return Number(o.deliveredAt) || 0;
  if (o.status === "REFUNDED") return Number(o.refundedAt) || 0;
  if (o.status === "CANCELLED") return Number(o.cancelledAt) || 0;
  return Number(o.createdAt) || 0;
}

function sortOrdersForDisplay(list) {
  return list.slice().sort((a, b) => {
    const pa = orderStatusPriority(a);
    const pb = orderStatusPriority(b);

    if (pa !== pb) return pa - pb;

    // Within the same status, newest first.
    return orderSortTime(b) - orderSortTime(a);
  });
}

function renderOrders(force = false) {
  const signature = getOrdersRenderSignature();

  if (!force && signature === lastOrdersRenderSignature) {
    updateOrderCardLiveValues();
    return;
  }

  lastOrdersRenderSignature = signature;

  const list = sortOrdersForDisplay(
  (gameState.orders || []).filter(o => {
    if (currentFilter === "ALL") return true;
    if (currentFilter === "IN_PROGRESS") return IN_PROGRESS.has(o.status);
    if (currentFilter === "COMPLETED") return COMPLETED.has(o.status);
    if (currentFilter === "REFUNDS") return REFUNDS.has(o.status);
    if (currentFilter === "CANCELLED") return CANCELLED.has(o.status);
    return true;
  })
);

  el.ordersList.innerHTML = list.length
    ? list.map(orderCardHTML).join("")
    : `<div class="orderPixelCard" style="display:flex;align-items:center;justify-content:center;font-family:'Tiny5';color:#4D1F1D;">NO ORDERS FOUND</div>`;

  updateOrderCardLiveValues();
}

function getOrdersRenderSignature() {
  const orders = gameState.orders || [];

  return orders.map((o) => {
    const itemSig = (o.items || [])
      .map((i) => `${i.name}:${i.qty}:${i.img}`)
      .join(",");

    return `${o.id}:${o.status}:${itemSig}:${o.total}`;
  }).join("|") + `|filter:${currentFilter}`;
}

function orderCardHTML(o) {
  const t = Date.now();
  let displaySeconds = 0;
  let isUrgent = false;

  if (o.status === "NEW" || o.status === "READY_TO_SHIP") {
    displaySeconds = Math.max(0, Math.ceil((o.expiresAt - t) / 1000));
  } else if (o.status === "PACKING" || o.status === "SHIPPING") {
    displaySeconds = Math.max(0, Math.ceil((o.nextActionAt - t) / 1000));
  }
  
  if (displaySeconds < 10 && displaySeconds > 0) isUrgent = true;
  const timerStr = displaySeconds > 0 ? `&nbsp;&nbsp;${displaySeconds} sec left` : "";

  return `
    <div class="orderPixelCard" data-order-id="${o.id}">
      <div class="orderPixelTop">
        <img class="orderPixelAvatar" src="${o.customer?.avatar || ""}">
        <div class="orderPixelMain">
          <div class="orderPixelCustomer">${o.customer?.name || "CUSTOMER"}</div>
          <div class="orderPixelItemsRow">
            <div class="orderPixelThumbs">${(o.items || []).map(i => `<img class="orderPixelThumb" src="${i.img}">`).join("")}</div>
            <div class="orderPixelItemsText">
  ${(o.items || []).map(i => `${i.name} x ${i.qty}`).join("<br>")}
  
  <div class="orderPixelTotalRow">
    <span class="orderTotalLabel">TOTAL:</span>
    <img src="assets/orders/coin.png" class="orderTotalCoinIcon">
    <span class="orderTotalValue">${o.total}</span>
  </div>
</div>
          </div>
        </div>
        <div class="orderPixelActionWrap">
          ${actionHTML(o)}
          <div class="orderPixelStatusNote">
            ${statusHint(o)}<span class="orderPixelTimer ${isUrgent ? 'is-urgent' : ''}">${timerStr}</span>
          </div>
        </div>
      </div>
      ${progressHTML(o)}
    </div>`;
}

function updateOrderCardLiveValues() {
  const cards = document.querySelectorAll(".orderPixelCard[data-order-id]");
  const orders = gameState.orders || [];
  const t = Date.now();

  cards.forEach((card) => {
    const id = card.dataset.orderId;
    const o = orders.find((order) => String(order.id) === String(id));
    if (!o) return;

    let displaySeconds = 0;
    let pct = 0;

    if (o.status === "NEW" || o.status === "READY_TO_SHIP") {
      displaySeconds = Math.max(0, Math.ceil((o.expiresAt - t) / 1000));
    } else if (o.status === "PACKING" || o.status === "SHIPPING") {
      displaySeconds = Math.max(0, Math.ceil((o.nextActionAt - t) / 1000));
    }

    const timerEl = card.querySelector(".orderPixelTimer");
    if (timerEl) {
      const timerStr = displaySeconds > 0 ? `${displaySeconds} sec left` : "";
      timerEl.textContent = timerStr ? `  ${timerStr}` : "";
      timerEl.classList.toggle("is-urgent", displaySeconds < 10 && displaySeconds > 0);
    }

    if (o.status === "NEW") {
      pct = 0;
    } else if (o.status === "PACKING") {
      const elapsed = t - o.startedActionAt;
      const duration = 10000;
      const ratio = Math.min(1, Math.max(0, elapsed / duration));
      pct = ratio * 34;
    } else if (o.status === "READY_TO_SHIP") {
      pct = 34;
    } else if (o.status === "SHIPPING") {
      const elapsed = t - (o.nextActionAt - 15000);
      const duration = 15000;
      const ratio = Math.min(1, Math.max(0, elapsed / duration));
      pct = 34 + ratio * (65 - 34);
    } else if (o.status === "DELIVERED") {
      pct = 65;
    } else if (["COMPLETED", "REFUND_REQUESTED", "REFUNDED", "CANCELLED"].includes(o.status)) {
      pct = 99;
    }

    const fill = card.querySelector(".orderProgressFill");
    if (fill) {
      fill.style.width = `${pct}%`;
    }
  });
}

function statusHint(o) {
  if (o.status === "NEW") return "ready to pack";
  if (o.status === "PACKING") return "packing...";
  if (o.status === "READY_TO_SHIP") return "ready to ship";
  if (o.status === "SHIPPING") return "shipping...";
  if (o.status === "DELIVERED") return "collect your payment";
  if (o.status === "COMPLETED") return "completed";
  if (o.status === "REFUND_REQUESTED") return "refund requested";
  if (o.status === "REFUNDED") return "refunded";
  if (o.status === "CANCELLED") return "cancelled";
  return String(o.status || "").toLowerCase();
}


function actionHTML(o) {
  const map = {
    "NEW": { act: "pack", img: "packstatusbutton.png" },
    "PACKING": { act: null, img: "packingstatusbutton.png" },
    "READY_TO_SHIP": { act: "ship", img: "shipstatusbutton.png" },
    "SHIPPING": { act: null, img: "shippingstatusbutton.png" },
    "DELIVERED": { act: "collect", img: "collectstatusbutton.png" },
    "COMPLETED": { act: null, img: "completedstatusbutton.png" },
    "REFUND_REQUESTED": { act: "refund", img: "refundstatusbutton.png" },
    "REFUNDED": { act: null, img: "refundedstatusbutton.png" },
    "CANCELLED": { act: null, img: "canceledstatusbutton.png" }
  };

  const config = map[o.status] || { act: null, img: "packstatusbutton.png" };
  const isDisabled = !config.act;

  return `
    <button 
      class="orderPixelActionBtn" 
      ${config.act ? `data-action="${config.act}"` : ""} 
      data-id="${String(o.id)}" 
      ${isDisabled ? "disabled" : ""}
      type="button"
    >
      <img src="assets/orders/${config.img}" alt="">
    </button>
  `;
}
function progressHTML(o) {
  const t = Date.now();
  let pct = 0;

  if (o.status === "NEW") {
    pct = 0; 
  } 
  else if (o.status === "PACKING") {
    const elapsed = t - o.startedActionAt;
    const duration = 10000; 
    const ratio = Math.min(1, Math.max(0, elapsed / duration));
    // Grows from Receipt (0) to Packed (33%)
    pct = (ratio * 34); 
  } 
  else if (o.status === "READY_TO_SHIP") {
    pct = 34; // 🔥 Updated to 33
  } 
  else if (o.status === "SHIPPING") {
    const elapsed = t - (o.nextActionAt - 15000); 
    const duration = 15000; 
    const ratio = Math.min(1, Math.max(0, elapsed / duration));
    // Grows from Packed (33%) to Shipped (82%)
    pct = 34 + (ratio * (65 - 34)); 
  } 
  else if (o.status === "DELIVERED") {
    pct = 65; // 🔥 Updated to 82
  } 
  else if (["COMPLETED", "REFUND_REQUESTED", "REFUNDED", "CANCELLED"].includes(o.status)) {
  pct = 99;
}

  return `
    <div class="orderPixelProgressWrap">
      <div class="orderPixelProgressIcons">
        <img class="orderStageIcon stage-receipt" src="${STAGE_ICONS.receipt}">
        <img class="orderStageIcon stage-packed" src="${STAGE_ICONS.packed}">
        <img class="orderStageIcon stage-shipped" src="${STAGE_ICONS.shipped}">
        <img class="orderStageIcon stage-completed" src="${STAGE_ICONS.completed}">
      </div>
      <div class="orderProgressTrack">
        <div class="orderProgressFill" style="width:${pct}%"></div>
      </div>
    </div>`;
}

function updateNavBadgeAlways() {
  refreshOrdersNavBadge();

  const badge = document.getElementById("navOrdersBadge");
  if (!badge) return;

  badge.style.display = "flex";
  badge.style.visibility = "visible";
  badge.style.opacity = "1";
}

// --------------------------------------------------------
// EXPORT: enterOrdersPage() (Called by router.js)
// --------------------------------------------------------
export function enterOrdersPage() {
  ensureOrdersState();

  // Full render only when first entering the page
  renderOrdersTopStats();
  renderTabs();
  renderOrders(true);
  bindOrdersActionButtons();

  updateNavBadgeAlways();
  refreshOrdersNavBadge();
  renderHud();

  // Clear old interval so it does not stack
  if (window.ordersRefreshInterval) {
    clearInterval(window.ordersRefreshInterval);
    window.ordersRefreshInterval = null;
  }

  window.ordersRefreshInterval = setInterval(() => {
    const pageOrders = document.getElementById("pageOrders");

    if (!pageOrders?.classList.contains("show")) {
      clearInterval(window.ordersRefreshInterval);
      window.ordersRefreshInterval = null;
      return;
    }

    if (ordersActionLock) return;

    // Lightweight updates: avoids rebuilding the HUD PNGs every second
    updateOrdersTopStatsValues();
    refreshBadges();
    refreshOrdersNavBadge();

    // This keeps order countdowns/progress bars moving.
    // If the order cards still blink too much on iPhone, change 1000 to 2000 below.
    renderOrders();
  }, 1000);
}

window.__refreshOrdersUI = () => {
  updateOrdersTopStatsValues();
  renderTabs();
  renderOrders(true);
  updateNavBadgeAlways();
  refreshOrdersNavBadge();
  renderHud();
};