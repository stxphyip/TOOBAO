import { shopInfo, constants, featuredProductId, setFeaturedProductId, gameState } from "../state.js";
import { allProducts } from "../data/products.js";
import { randInt } from "../utils.js";

function normalizeStoreType(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();
}

const STARTER_PRODUCT_IDS = {
  "clothes": ["pants", "shirt", "dress"],
  "tech": ["laptop", "camera", "earphones"],
  "food": ["coke", "chips", "spam"],
  "accessories": ["earrings", "necklace", "belt"]
};

function randomUnitCost() {
  return randInt(5, 15);
}

export function getEffectiveDiscountPercent() {
  const active = gameState.helpCards?.active;
  if (!active) return 0;
  if (active.id !== "discount_festival") return 0;
  return Number(active.meta?.discountPercent || 0.15);
}

export function getEffectiveProductPrice(product) {
  const base = Number(product?.price) || 0;
  const discount = getEffectiveDiscountPercent();
  if (discount <= 0) return base;
  return Number((base * (1 - discount)).toFixed(2));
}

function buildStoredProduct(p) {
  return {
    id: p.id,
    name: p.name,
    img: p.img,
    unitCost: randomUnitCost(),
    selected: false,
    price: 0,
    qty: 0,
    reservedQty: 0,
    onHome: false,
    recentViews: 0,
    sold: 0
  };
}

function rerollAllUnitCosts() {
  (shopInfo.chosenProducts || []).forEach((p) => {
    p.unitCost = randomUnitCost();
  });
}

export function setupProductStorageOnce() {
  if (shopInfo.chosenProducts.length > 0) return;

  allProducts.forEach((p) => {
    shopInfo.chosenProducts.push(buildStoredProduct(p));
  });

  applyStarterProductsForStoreType({ resetValues: true });
}

export function applyStarterProductsForStoreType(opts = {}) {
  const { resetValues = false, customStarterIds = null } = opts;
  
  // 1. Determine which IDs to use: Passed from Profile > STARTER_PRODUCT_IDS > First 3 in data
  const typeKey = normalizeStoreType(shopInfo.storeType);
  const starterIds = customStarterIds || 
                     STARTER_PRODUCT_IDS[typeKey] || 
                     allProducts.slice(0, 3).map((p) => p.id);

  // 2. Reset ALL products in the master list
  shopInfo.chosenProducts.forEach((p) => {
    p.onHome = false;    // Remove from the "Active Inventory"
    p.selected = false;
    p.reservedQty = 0;
    p.recentViews = 0;
    p.sold = 0;

    if (resetValues) {
      p.price = 0;       // Reset Price to 0
      p.qty = 0;         // Reset Quantity to 0
    }
  });

  // 3. Set only the 3 specific profile products to "onHome"
  starterIds.forEach((id) => {
    const p = shopInfo.chosenProducts.find((x) => x.id === id);
    if (!p) return;
    p.onHome = true;
    p.selected = true;
  });

  setFeaturedProductId(null);
}

export function resetProductsForNewProfile(profileProductIds = null) {
  setupProductStorageOnce();
  rerollAllUnitCosts();
  
  // We pass the profile's specific product IDs here
  applyStarterProductsForStoreType({ 
    resetValues: true, 
    customStarterIds: profileProductIds 
  });
  
  setFeaturedProductId(null);
}

export function getProductById(id) {
  return shopInfo.chosenProducts.find((p) => p.id === id);
}

export function getHomeProducts() {
  return shopInfo.chosenProducts.filter((p) => p.onHome);
}

export function countSelectedProducts() {
  return getHomeProducts().length;
}

export function toggleSelect() {
  return false;
}

export function changeNumber(id, key, delta) {
  const p = getProductById(id);
  if (!p) return;

  const min = key === "qty" ? Number(p.reservedQty || 0) : 0;
  let max = constants.maxValue;

  if (key === "price") max = 9999;
  if (key === "qty") max = 999;

  p[key] = Math.max(min, Math.min(max, (p[key] || 0) + delta));
}

export function pickFeaturedOnce() {
  if (featuredProductId) return;
  const list = getHomeProducts();
  if (!list.length) return;
  const pick = list[Math.floor(Math.random() * list.length)].id;
  setFeaturedProductId(pick);
}

export function getSelectedProductsSnapshot() {
  const list = getHomeProducts();

  return list.map((p) => {
    const reserved = p.reservedQty || 0;
    const qty = p.qty || 0;

    return {
      id: p.id,
      name: p.name,
      img: p.img,
      price: getEffectiveProductPrice(p),
      availableQty: Math.max(0, qty - reserved)
    };
  });
}

export function reserveStock(items) {
  for (const it of items) {
    const p = getProductById(it.productId);
    if (!p) return false;

    p.reservedQty = p.reservedQty || 0;
    const available = (p.qty || 0) - p.reservedQty;
    if (available < it.qty) return false;
  }

  for (const it of items) {
    const p = getProductById(it.productId);
    p.reservedQty += it.qty;
  }

  return true;
}

export function releaseReservedStock(items) {
  for (const it of items) {
    const p = getProductById(it.productId);
    if (!p) continue;

    p.reservedQty = p.reservedQty || 0;
    p.reservedQty = Math.max(0, p.reservedQty - it.qty);
  }
}

export function consumeReservedStock(items) {
  for (const it of items) {
    const p = getProductById(it.productId);
    if (!p) continue;

    p.reservedQty = p.reservedQty || 0;
    p.reservedQty = Math.max(0, p.reservedQty - it.qty);
    p.qty = Math.max(0, (p.qty || 0) - it.qty);
    p.sold = (p.sold || 0) + it.qty;
  }
}