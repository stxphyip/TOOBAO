// js/systems/ordersSystem.js

import { gameState } from "../state.js";
import {
  randInt,
  syncStoreLevelFromFollowers,
  addViewsAndConvertFollowers,
  subtractViews
} from "../utils.js";
import { avatarImages } from "../data/avatars.js";
import {
  getSelectedProductsSnapshot,
  reserveStock,
  releaseReservedStock,
  consumeReservedStock
} from "../store/productsStore.js";

import { openShippingRestockModal } from "../modals/shippingRestock.js";
import { showAlgoToast } from "./toast.js";

const ORDER_CAP_BY_LEVEL = {
  1: 2,
  2: 5,
  3: 10,
  4: 15,
  5: 20
};

const REFUND_REQUEST_MIN_MS = 8_000;
const REFUND_REQUEST_MAX_MS = 22_000;

const REFUND_CHANCE_BY_LEVEL = {
  1: 0.04,
  2: 0.08,
  3: 0.14,
  4: 0.22,
  5: 0.32
};


const VIEW_PENALTY_CANCEL = 100;
const FOLLOWER_PENALTY_CANCEL = 50;

// ---------- CONFIG ----------
const PACKING_DURATION_MS = 10_000;
const SHIPPING_DURATION_MS = 15_000;
const CANCEL_WINDOW_MS = 45_000;

// ---------- HELPERS ----------
function nowMs() { return Date.now(); }

const ORDER_CUSTOMER_NAMES = [
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

function makeCustomer() {
  return {
    name: ORDER_CUSTOMER_NAMES[randInt(0, ORDER_CUSTOMER_NAMES.length - 1)] + randInt(10, 99),
    avatar: avatarImages[randInt(0, avatarImages.length - 1)]
  };
}

function boxesAvailable() {
  return Math.max(0, (Number(gameState.shippingMaterials) || 0) - (Number(gameState.reservedShippingMaterials) || 0));
}

function getActiveOrderCap() {
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  return ORDER_CAP_BY_LEVEL[level] || 5;
}

function countActiveOrders() {
  return (gameState.orders || []).filter((o) =>
    o.status === "NEW" ||
    o.status === "PACKING" ||
    o.status === "READY_TO_SHIP" ||
    o.status === "SHIPPING" ||
    o.status === "DELIVERED" ||
    o.status === "REFUND_REQUESTED"
  ).length;
}

function makeOrderId() {
  gameState._orderSeq = (Number(gameState._orderSeq) || 0) + 1;
  return `ord_${Date.now()}_${gameState._orderSeq}_${randInt(100, 999)}`;
}

function ensureOrdersAnalyticsState() {
  if (!gameState.analytics) {
    gameState.analytics = {
      daily: [],
      lifetime: {}
    };
  }

  if (!Array.isArray(gameState.analytics.daily)) {
    gameState.analytics.daily = [];
  }

  if (!gameState.analytics.lifetime) {
    gameState.analytics.lifetime = {};
  }

  const lifetime = gameState.analytics.lifetime;

  if (typeof lifetime.ordersCreated !== "number") lifetime.ordersCreated = 0;
  if (typeof lifetime.packed !== "number") lifetime.packed = 0;
  if (typeof lifetime.shipped !== "number") lifetime.shipped = 0;
  if (typeof lifetime.delivered !== "number") lifetime.delivered = 0;
  if (typeof lifetime.collected !== "number") lifetime.collected = 0;
  if (typeof lifetime.cancelled !== "number") lifetime.cancelled = 0;
  if (typeof lifetime.refundRequested !== "number") lifetime.refundRequested = 0;
  if (typeof lifetime.refunded !== "number") lifetime.refunded = 0;

  // This is what the manager page reads for DELIVERY SPEED.
  if (typeof lifetime.deliveryMsTotal !== "number") lifetime.deliveryMsTotal = 0;
  if (typeof lifetime.deliveryCount !== "number") lifetime.deliveryCount = 0;

  const today = Number(gameState.day) || 1;

  let dayRow = gameState.analytics.daily.find((d) => Number(d.day) === today);

  if (!dayRow) {
    dayRow = {
      day: today,
      ordersCreated: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      collected: 0,
      cancelled: 0,
      refundRequested: 0,
      refunded: 0
    };

    gameState.analytics.daily.push(dayRow);
  }

  if (typeof dayRow.ordersCreated !== "number") dayRow.ordersCreated = 0;
  if (typeof dayRow.packed !== "number") dayRow.packed = 0;
  if (typeof dayRow.shipped !== "number") dayRow.shipped = 0;
  if (typeof dayRow.delivered !== "number") dayRow.delivered = 0;
  if (typeof dayRow.collected !== "number") dayRow.collected = 0;
  if (typeof dayRow.cancelled !== "number") dayRow.cancelled = 0;
  if (typeof dayRow.refundRequested !== "number") dayRow.refundRequested = 0;
  if (typeof dayRow.refunded !== "number") dayRow.refunded = 0;

  return dayRow;
}

function recordOrderCreated() {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.ordersCreated += 1;
  gameState.analytics.lifetime.ordersCreated += 1;
}

function recordOrderPacked() {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.packed += 1;
  gameState.analytics.lifetime.packed += 1;
}

function recordOrderShipped() {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.shipped += 1;
  gameState.analytics.lifetime.shipped += 1;
}

function recordOrderDelivered() {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.delivered += 1;
  gameState.analytics.lifetime.delivered += 1;
}

function recordOrderCollected(order) {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.collected += 1;
  gameState.analytics.lifetime.collected += 1;

  // Delivery speed = how long it took from order creation to final collect.
  // Only record once per order.
  if (!order.deliverySpeedRecorded) {
    const createdAt = Number(order.createdAt) || Number(order.expiresAt || 0) - CANCEL_WINDOW_MS || nowMs();
    const elapsedMs = Math.max(0, nowMs() - createdAt);

    gameState.analytics.lifetime.deliveryMsTotal += elapsedMs;
    gameState.analytics.lifetime.deliveryCount += 1;

    order.deliverySpeedRecorded = true;
  }
}

function recordOrderCancelled() {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.cancelled += 1;
  gameState.analytics.lifetime.cancelled += 1;
}

function recordRefundRequested() {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.refundRequested += 1;
  gameState.analytics.lifetime.refundRequested += 1;
}

function recordOrderRefunded() {
  const dayRow = ensureOrdersAnalyticsState();

  dayRow.refunded += 1;
  gameState.analytics.lifetime.refunded += 1;
}


// ---------- CORE LOGIC ----------
export function ensureOrdersState() {
  if (!Array.isArray(gameState.orders)) gameState.orders = [];
  if (gameState.shippingMaterials == null) gameState.shippingMaterials = 0;
  if (gameState.reservedShippingMaterials == null) gameState.reservedShippingMaterials = 0;

  ensureOrdersAnalyticsState();
}

export function tickOrders() {
  ensureOrdersState();
  const t = nowMs();
  let changed = false;

  for (const o of gameState.orders) {
    if (!o) continue;

    if (
      o.status === "CANCELLED" ||
      o.status === "REFUNDED"
    ) {
      continue;
    }

    if (
  o.status === "COMPLETED" &&
  o.refundChecked &&
  Number(o.refundCheckAt || 0) > 0 &&
  t > Number(o.refundCheckAt || 0) + 2000
) {
  continue;
}

    // PACKING -> READY_TO_SHIP
    if (o.status === "PACKING" && t >= Number(o.nextActionAt || 0)) {
      o.status = "READY_TO_SHIP";
      o.expiresAt = t + CANCEL_WINDOW_MS;
      o.nextActionAt = 0;
      changed = true;
    }

    // SHIPPING -> DELIVERED
     if (o.status === "SHIPPING" && t >= Number(o.nextActionAt || 0)) {
  o.status = "DELIVERED";
  o.deliveredAt = t;
  o.nextActionAt = 0;

  recordOrderDelivered();

  changed = true;
}

    // NEW / READY_TO_SHIP can cancel if player is too slow
    if (
      (o.status === "NEW" || o.status === "READY_TO_SHIP") &&
      Number(o.expiresAt || 0) > 0 &&
      t > Number(o.expiresAt || 0)
    ) {
      cancelOrder(o);
      changed = true;
      continue;
    }

    // COMPLETED orders can become refund requests.
    if (
      o.status === "COMPLETED" &&
      !o.refundChecked &&
      Number(o.refundCheckAt || 0) > 0 &&
      t >= Number(o.refundCheckAt || 0)
    ) {
      o.refundChecked = true;

      const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
      const chance = REFUND_CHANCE_BY_LEVEL[level] || 0.04;

      if (Math.random() < chance) {
        o.status = "REFUND_REQUESTED";
        changed = true;

        recordRefundRequested();

        showAlgoToast(
          `${o.customer?.name || "A customer"} requested a refund. Handle it before MR. BAO gets mad.`,
          "MR. BAO",
          null,
          3600,
          "order"
        );
      } else {
        changed = true;
      }
    }
  }

  refreshOrdersNavBadge();

  if (changed) {
    window.__refreshOrdersUI?.();
  }
}

export function packOrder(orderId) {
  const order = gameState.orders.find(o => String(o.id) === String(orderId));
  if (!order || order.status !== "NEW") return false;

  order.status = "PACKING";
  order.startedActionAt = nowMs();
  order.nextActionAt = nowMs() + PACKING_DURATION_MS;

  recordOrderPacked();

  return true;
}

export function shipOrder(orderId) {
  const o = gameState.orders.find(ord => String(ord.id) === String(orderId));
  if (!o || o.status !== "READY_TO_SHIP") return false;

  if (gameState.shippingMaterials < o.boxesReserved) {
    openShippingRestockModal();
    return false;
  }

  o.status = "SHIPPING";
  o.shippedAt = nowMs();
  o.nextActionAt = nowMs() + SHIPPING_DURATION_MS;

  gameState.shippingMaterials -= o.boxesReserved;
  gameState.reservedShippingMaterials = Math.max(
    0,
    (Number(gameState.reservedShippingMaterials) || 0) - Number(o.boxesReserved || 0)
  );

  consumeReservedStock(o.items);
  recordOrderShipped();

  return true;
}

export function collectRevenue(orderId) {
  const o = gameState.orders.find(ord => String(ord.id) === String(orderId));
  if (!o || o.status !== "DELIVERED") return false;

  gameState.revenue += Number(o.total || 0);
  gameState.dayRevenue = (Number(gameState.dayRevenue) || 0) + Number(o.total || 0);

  o.status = "COMPLETED";
  o.completedAt = nowMs();

  recordOrderCollected(o);

  o.refundChecked = false;
  o.refundCheckAt = nowMs() + randInt(REFUND_REQUEST_MIN_MS, REFUND_REQUEST_MAX_MS);

  const viewsGained = randInt(80, 140);
  const followersGained = addViewsAndConvertFollowers(gameState, viewsGained);

  return {
    success: true,
    views: viewsGained,
    followers: followersGained
  };
}

export function refundOrder(orderId) {
  const o = gameState.orders.find(ord => String(ord.id) === String(orderId));

  if (!o || (o.status !== "REFUND_REQUESTED" && o.status !== "COMPLETED")) {
    return false;
  }

  o.status = "REFUNDED";
  o.refundedAt = nowMs();

  recordOrderRefunded();

  gameState.revenue = Math.max(
    0,
    (Number(gameState.revenue) || 0) - Number(o.total || 0)
  );

  const viewsGained = randInt(25, 60);
  const followersGained = addViewsAndConvertFollowers(gameState, viewsGained);

  return {
    success: true,
    views: viewsGained,
    followers: followersGained
  };
}

function cancelOrder(order) {
  if (!order || order.status === "CANCELLED") return;

  order.status = "CANCELLED";
  order.cancelledAt = nowMs();

  recordOrderCancelled();

  releaseReservedStock(order.items || []);

  gameState.reservedShippingMaterials = Math.max(
    0,
    (Number(gameState.reservedShippingMaterials) || 0) - Number(order.boxesReserved || 0)
  );

  subtractViews(gameState, VIEW_PENALTY_CANCEL);

  gameState.followers = Math.max(
    0,
    (Number(gameState.followers) || 0) - FOLLOWER_PENALTY_CANCEL
  );

  syncStoreLevelFromFollowers(gameState);
  refreshOrdersNavBadge();

  showAlgoToast(
    `${order.customer?.name || "A customer"} cancelled their order. -${VIEW_PENALTY_CANCEL} views and -${FOLLOWER_PENALTY_CANCEL} followers.`,
    "MR. BAO",
    null,
    3600,
    "order",
    "views_followers"
  );
}

export function addRandomOrderFromSelectedProducts() {
  ensureOrdersState();
  if (countActiveOrders() >= getActiveOrderCap()) return null;
  if (boxesAvailable() <= 0) return null;

  const products = getSelectedProductsSnapshot();
  if (!products.length) return null;

  const chosen = products.slice().sort(() => 0.5 - Math.random()).slice(0, randInt(1, 2));  
  // --- DISCOUNT LOGIC ---
  let discountAmount = 0;
  const activeHelp = gameState.helpCards?.active;
  if (activeHelp?.id === "discount_festival") discountAmount = 5;
  else if (activeHelp?.id === "coupons") discountAmount = 2;

  const items = chosen.map(p => {
    // Calculate price: Base - Discount, but minimum 1
    const discountedPrice = Math.max(1, Math.floor(p.price - discountAmount));
    return { 
      productId: p.id, 
      name: p.name, 
      img: p.img, 
      qty: 1, 
      priceEach: discountedPrice 
    };
  });
  // ----------------------

  const total = items.reduce((sum, i) => sum + i.priceEach, 0);
  const boxesNeeded = items.length;

  if (boxesAvailable() < boxesNeeded || !reserveStock(items)) return null;

  gameState.reservedShippingMaterials += boxesNeeded;
  const t = nowMs();
  const order = {
  id: makeOrderId(),
  createdDay: Number(gameState.day) || 1,
  createdAt: t,
  customer: makeCustomer(),
  items,
  total,
  boxesReserved: boxesNeeded,
  status: "NEW",
  expiresAt: t + CANCEL_WINDOW_MS,
  nextActionAt: 0,
  deliverySpeedRecorded: false
};

  gameState.orders.unshift(order);
recordOrderCreated();

showAlgoToast(
  `${order.customer.name} placed an order. Pack it soon before it gets cancelled.`,
  "MR. BAO",
  null,
  3600,
  "order"
);

refreshOrdersNavBadge();
return order;
}

export function refreshOrdersNavBadge() {
  const badge = document.getElementById("navOrdersBadge");
  if (!badge) return;

  const count = (gameState.orders || []).filter((o) =>
    o.status === "NEW" ||
    o.status === "PACKING" ||
    o.status === "READY_TO_SHIP" ||
    o.status === "SHIPPING" ||
    o.status === "DELIVERED" ||
    o.status === "REFUND_REQUESTED"
  ).length;

  badge.textContent = String(count);
  badge.style.display = "flex";
  badge.style.visibility = "visible";
  badge.style.opacity = "1";
}