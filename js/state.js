// js/state.js


export const DAY_DURATION_SEC = 180;
export const shopInfo = {
  name: "",
  region: "",
  id: "",
  avatarNumber: 0,
  storeType: "",
  chosenProducts: []
};

export const gameState = {
  day: 1,
  secondsLeft: 180,
  

  revenue: 0,
  dayRevenue: 0,
  prevDayRevenue: 0,

  followers: 0,
  views: 0,

  storeLevel: 1,
  running: false,
  ended: false,
  dayEndSnapshot: null,

  visibility: 50,
  missedTasks: 0,

  orders: [],

  shippingMaterials: 0,
  reservedShippingMaterials: 0,

  liveSessionViews: 0,
  livestreamsDone: 0,

  messages: {
    threads: [],
    unreadTotal: 0,
    lastViewsCheckpoint: 0,
    dailySpawned: 0,
    dayOfDailySpawned: 1
  },

  analytics: {
    daily: [],
    lifetime: {
      ordersCreated: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      collected: 0,
      cancelled: 0,
      refundRequested: 0,
      refunded: 0,
      grossRevenue: 0,
      refundedAmount: 0,
      netRevenue: 0,
      deliveryMsTotal: 0,
      deliveryCount: 0,
      packToShipMsTotal: 0,
      packToShipCount: 0,
      chatResponseSecTotal: 0,
      chatResponseCount: 0
    }
  },

  costs: {
    shippingBoxesSpent: 0,
    inventorySpent: 0,
    unlockSpent: 0
  },

  algo: {
    lastStrategicToastAt: 0,
    lastChaosToastAt: 0,
    queue: [],
    timer: null
  },

  managerDashboard: {
    dayMarker: 1,
    dayStartViews: 0,
    dayStartRevenue: 0,
    history: [],
    lastSampleAt: 0
  },

  _ticks: 0,
  _threadSeq: 0,
  reputation: 0
};

export const constants = {
  maxProducts: 5,
  minValue: 0,
  maxValue: 100
};

export let currentEditingProduct = null;
export function setCurrentEditingProduct(p) {
  currentEditingProduct = p;
}

export let currentTask = null;
export function setCurrentTask(task) {
  currentTask = task;
}

export let featuredProductId = null;
export function setFeaturedProductId(id) {
  featuredProductId = id;
}

export const tickers = {
  secondTicker: null,
  trafficTicker: null,
  algoScheduler: null
};

const STORAGE_KEY = "taobaoSellerGameSharedStateV1";

function ensureCostState() {
  if (!gameState.costs) {
    gameState.costs = {
      shippingBoxesSpent: 0,
      inventorySpent: 0,
      unlockSpent: 0
    };
  }

  if (typeof gameState.costs.shippingBoxesSpent !== "number") {
    gameState.costs.shippingBoxesSpent = 0;
  }
  if (typeof gameState.costs.inventorySpent !== "number") {
    gameState.costs.inventorySpent = 0;
  }
  if (typeof gameState.costs.unlockSpent !== "number") {
    gameState.costs.unlockSpent = 0;
  }
}

export function addShippingBoxSpend(amount) {
  ensureCostState();
  gameState.costs.shippingBoxesSpent += Math.max(0, Number(amount) || 0);
}

export function refundShippingBoxSpend(amount) {
  ensureCostState();
  gameState.costs.shippingBoxesSpent = Math.max(
    0,
    gameState.costs.shippingBoxesSpent - Math.max(0, Number(amount) || 0)
  );
}

export function addInventorySpend(amount) {
  ensureCostState();
  gameState.costs.inventorySpent += Math.max(0, Number(amount) || 0);
}

export function refundInventorySpend(amount) {
  ensureCostState();
  gameState.costs.inventorySpent = Math.max(
    0,
    gameState.costs.inventorySpent - Math.max(0, Number(amount) || 0)
  );
}

export function addUnlockSpend(amount) {
  ensureCostState();
  gameState.costs.unlockSpent += Math.max(0, Number(amount) || 0);
}

export function getTotalManufacturingCost() {
  ensureCostState();
  return (
    (Number(gameState.costs.shippingBoxesSpent) || 0) +
    (Number(gameState.costs.inventorySpent) || 0) +
    (Number(gameState.costs.unlockSpent) || 0)
  );
}

export function exportSharedSnapshot() {
  return {
    shopInfo: JSON.parse(JSON.stringify(shopInfo)),
    gameState: JSON.parse(JSON.stringify(gameState)),
    featuredProductId
  };
}

export function saveSharedState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exportSharedSnapshot()));
  } catch (err) {
    console.warn("[STATE] saveSharedState failed", err);
  }
}

export function loadSharedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    if (!parsed) return false;

    if (parsed.shopInfo) {
      Object.assign(shopInfo, parsed.shopInfo);
    }

    if (parsed.gameState) {
      Object.assign(gameState, parsed.gameState);
    }

    if (typeof parsed.featuredProductId !== "undefined") {
      featuredProductId = parsed.featuredProductId;
    }

    ensureCostState();
    return true;
  } catch (err) {
    console.warn("[STATE] loadSharedState failed", err);
    return false;
  }
}