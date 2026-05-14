// js/pages/storage.js

import { el } from "../dom.js";
import {
  gameState,
  shopInfo,
  addUnlockSpend,
  addInventorySpend,
  refundInventorySpend
} from "../state.js";
import { avatarImages } from "../data/avatars.js";
import { formatTime, clamp, randInt, attachHoldRepeat } from "../utils.js";
import { renderHud } from "./home.js";
import { openEditProfile } from "../modals/editProfile.js";
import { getHomeProducts } from "../store/productsStore.js";
import { openInsufficientFundsModal } from "../modals/popup.js";

let currentShelfTab = "STORAGE"; // STORAGE | SHOP
let selectedProductId = "__shipping_boxes__";
let storagePageIndex = 0;
let shopPageIndex = 0;
let draft = null;
let storageInterval = null;

const GRID_COLS = 4;
const GRID_ROWS = 2;
const GRID_PAGE_SIZE = GRID_COLS * GRID_ROWS;
const SHIPPING_BOX_PRICE = 1;

function resolveAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;
  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "";
}

function formatCompact(n) {
  const num = Math.floor(Number(n) || 0);
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return String(num);
}

function moneyText(n) {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function ensureUnlockCost(product) {
  if (!product) return 20;
  if (typeof product.unlockCost !== "number" || product.unlockCost <= 0) {
    product.unlockCost = randInt(15, 60);
  }
  return product.unlockCost;
}

function getShippingBoxItem() {
  return {
    id: "__shipping_boxes__",
    name: "SHIPPING BOXES",
    img: "assets/storage/boxproduct.png",
    unlocked: true,
    onHome: true,
    isShippingBox: true,
    price: SHIPPING_BOX_PRICE,
    unitCost: SHIPPING_BOX_PRICE,
    qty: Number(gameState.shippingMaterials) || 0,
    reservedQty: Number(gameState.reservedShippingMaterials) || 0
  };
}

function getStorageList() {
  const list = [getShippingBoxItem()];
  const homeProducts = getHomeProducts() || [];
  const seen = new Set(["__shipping_boxes__"]);

  homeProducts.forEach((p) => {
    if (!p || seen.has(p.id)) return;

    p.onHome = true;
    p.unlocked = true;

    seen.add(p.id);
    list.push(p);
  });

  return list;
}

function getShopList() {
  const list = [];
  const seen = new Set();

  (shopInfo.chosenProducts || []).forEach((p) => {
    if (!p || seen.has(p.id)) return;
    if (p.id === "__shipping_boxes__" || p.onHome || p.unlocked) return;

    seen.add(p.id);

    // PRESET QUANTITY AND PRICE HERE
    if (p.qty === undefined || p.qty === 0) p.qty = 5; 
    if (!p.price || p.price === 0) p.price = randInt(10, 50);
    
    ensureUnlockCost(p);
    list.push(p);
  });

  return list;
}

function getActiveList() {
  return currentShelfTab === "STORAGE" ? getStorageList() : getShopList();
}

function getCurrentPageIndex() {
  return currentShelfTab === "STORAGE" ? storagePageIndex : shopPageIndex;
}

function setCurrentPageIndex(next) {
  if (currentShelfTab === "STORAGE") storagePageIndex = next;
  else shopPageIndex = next;
}

function getVisibleItems() {
  const list = getActiveList();
  const start = getCurrentPageIndex() * GRID_PAGE_SIZE;
  return list.slice(start, start + GRID_PAGE_SIZE);
}

function getSelectedProduct() {
  const list = getActiveList();
  let picked = list.find((p) => p.id === selectedProductId);

  if (!picked && list.length) {
    picked = list[0];
    selectedProductId = picked.id;
  }

  return picked || null;
}

function resetDraftFromSelected() {
  const p = getSelectedProduct();
  if (!p) {
    draft = null;
    return;
  }

  draft = {
    name: String(p.name || "").slice(0, 16).toUpperCase(),
    price: Number(p.price) || 0,
    // For regular products, this box represents ADDED QTY, not total qty.
    // So it should always start at 0 when selected/reset.
    qty: 0
  };
}

function changeSelection(id) {
  selectedProductId = id;
  resetDraftFromSelected();
  refreshStoragePage();
}

function moveMainSelection(delta) {
  const list = getActiveList();
  if (!list.length) return;

  const currentIndex = Math.max(0, list.findIndex((p) => p.id === selectedProductId));
  const nextIndex = clamp(currentIndex + delta, 0, list.length - 1);

  selectedProductId = list[nextIndex].id;
  setCurrentPageIndex(Math.floor(nextIndex / GRID_PAGE_SIZE));
  resetDraftFromSelected();
  refreshStoragePage();
}

function pageCountForCurrentTab() {
  return Math.max(1, Math.ceil(getActiveList().length / GRID_PAGE_SIZE));
}

function moveGridPage(delta) {
  const maxPage = pageCountForCurrentTab() - 1;
  const next = clamp(getCurrentPageIndex() + delta, 0, maxPage);
  setCurrentPageIndex(next);

  const visible = getVisibleItems();
  if (!visible.find((p) => p.id === selectedProductId) && visible[0]) {
    selectedProductId = visible[0].id;
  }

  resetDraftFromSelected();
  refreshStoragePage();
}

function switchShelfTab(nextTab) {
  currentShelfTab = nextTab;

  if (nextTab === "STORAGE") {
    storagePageIndex = 0;
    selectedProductId = "__shipping_boxes__";
  } else {
    shopPageIndex = 0;
    const shopItems = getShopList();
    selectedProductId = shopItems.length ? shopItems[0].id : null;
  }

  resetDraftFromSelected();
  refreshStoragePage();
}

function renderStorageTopStats() {
  const root = el.storageTopStats;
  if (!root) return;

  const boxes = Math.max(
    0,
    (Number(gameState.shippingMaterials) || 0) - (Number(gameState.reservedShippingMaterials) || 0)
  );
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));

  root.innerHTML = `
    <div class="storageTopStatsInner">
      <button id="storageAvatarBtn" class="storageAvatarBtn" type="button">
        <img class="storageAvatarLarge" src="${resolveAvatarSrc()}" alt="Store avatar">
      </button>

      <div class="storageStoreMain">
        <div class="storageStoreNameLarge">${shopInfo.name || "[STORE NAME]"}</div>
        <img class="storageStarsImg" src="assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png" alt="Rating">

        <div class="storageOrangeStatsRow">
          <div class="storageOrangeStat storageFollowersStat">
            <img class="storageStatIcon" src="assets/ui_icons/followers_icon.png" alt="">
            <span class="storageStatValue">${formatCompact(gameState.followers)}</span>
          </div>

          <div class="storageOrangeStat storageViewsStat">
            <img class="storageStatIcon" src="assets/ui_icons/views_icon.png" alt="">
            <span class="storageStatValue">${formatCompact(gameState.views)}</span>
          </div>

          <div class="storageOrangeStat storageBoxesStat">
            <img class="storageStatIcon" src="assets/ui_icons/shippingbox_icon.png" alt="">
            <span class="storageStatValue">${formatCompact(boxes)}</span>
          </div>

          <div class="storageOrangeStat storageMoneyStat">
            <img class="storageStatIcon" src="assets/ui_icons/coin_icon.png" alt="">
            <span class="storageStatValue">${formatCompact(gameState.revenue)}</span>
          </div>
        </div>
      </div>

      <div class="storageRightStatsCol">
        <div class="storageOrangeStat storageDayStat">
          <img class="storageStatIcon" src="assets/ui_icons/day${day}_icon.png" alt="">
          <span class="storageStatValue">DAY ${gameState.day}</span>
        </div>

        <div class="storageOrangeStat storageTimeStat">
          <img class="storageStatIcon" src="assets/ui_icons/time_icon.png" alt="">
          <span class="storageStatValue">${formatTime(gameState.secondsLeft)}</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById("storageAvatarBtn")?.addEventListener("click", openEditProfile);
}

function updateStorageTopStatsValues() {
  const boxes = Math.max(
    0,
    (Number(gameState.shippingMaterials) || 0) -
    (Number(gameState.reservedShippingMaterials) || 0)
  );

  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));

  const followersEl = document.querySelector(".storageFollowersStat .storageStatValue");
  const viewsEl = document.querySelector(".storageViewsStat .storageStatValue");
  const boxesEl = document.querySelector(".storageBoxesStat .storageStatValue");
  const moneyEl = document.querySelector(".storageMoneyStat .storageStatValue");
  const dayEl = document.querySelector(".storageDayStat .storageStatValue");
  const timeEl = document.querySelector(".storageTimeStat .storageStatValue");
  const starsEl = document.querySelector(".storageStarsImg");

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

function renderMainBlock() {
  const root = el.storageMainBlock;
  if (!root) return;

  const p = getSelectedProduct();
  const isShop = currentShelfTab === "SHOP";

  if (!p) {
    root.innerHTML = `
      <div class="storageMainStage">
        <div class="storageInventoryBlock" style="display: flex; align-items: center; justify-content: center; flex-direction: column;">
          <div class="storageSectionTitle" style="text-align: center; padding: 0; margin: 0;">
            ${isShop ? "NO MORE PRODUCTS LEFT<br>TO UNLOCK" : "STORAGE IS EMPTY"}
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (!draft) resetDraftFromSelected();

  const isShippingBox = !!p.isShippingBox;
  const unlockCost = ensureUnlockCost(p);

  const list = getActiveList();
  const currentIndex = Math.max(0, list.findIndex((item) => item.id === p.id));
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < list.length - 1;

  const qty = Math.max(0, Number(draft.qty) || 0);
  const price = Number(draft.price) || 0;
  const unitCost = isShippingBox ? SHIPPING_BOX_PRICE : (Number(p.unitCost) || 0);
  const expectedCost = qty * unitCost;
  const currentBoxQtyAvailable = Math.max(
  0,
  (Number(gameState.shippingMaterials) || 0) -
  (Number(gameState.reservedShippingMaterials) || 0)
);

  const currentPrice = Number(p.price) || 0;
  const currentQty = isShippingBox
    ? (Number(gameState.shippingMaterials) || 0)
    : (Number(p.qty) || 0);

  root.innerHTML = `
    <div class="storageMainStage">
      <button
        id="storageMainPrev"
        class="storageMainArrow storageMainArrowLeft ${canGoPrev ? "" : "is-disabled"}"
        type="button"
        ${canGoPrev ? "" : "disabled"}
      >
        <img src="assets/storage/bigleftarrow.png" alt="Previous">
      </button>

      <div class="storageInventoryBlock">
        <div class="storageProductImageWrap">
          <img src="${p.img}" class="storageProductImage" alt="${p.name}">
        </div>

        <div class="storageNameLabel">PRODUCT NAME:</div>

        <div class="storageNameInputWrap">
          <img src="assets/storage/productnameinput.png" class="storageNameInputBg" alt="">
          <input
            id="storageNameInput"
            class="storageNameInput"
            type="text"
            maxlength="16"
            value="${String(draft.name || "").replace(/"/g, "&quot;")}"
            ${isShop || isShippingBox ? "disabled" : ""}
          >
        </div>

        ${
          !isShippingBox
            ? `
              <div class="storageCurrentPriceRow">
                <span class="storageCurrentPriceLabel">CURRENT PRICE:</span>
                <span class="storageCurrentPriceValue">
                  <img src="assets/ui_icons/coin_icon.png" class="storageCoinIcon" alt="">
                  ${moneyText(currentPrice)}
                </span>
              </div>

              <div class="storagePriceRow">
                <span class="storagePriceLabel">NEW PRICE:</span>
                <span class="storagePriceCoinWrap">
                  <img src="assets/ui_icons/coin_icon.png" class="storageCoinIcon" alt="">
                </span>

                <div class="storagePriceStepper">
                  <button id="storagePriceDown" class="storageMiniArrowBtn storageMiniArrowSide" type="button" ${isShop ? "disabled" : ""}>
                    <img src="assets/storage/smallleftarrow.png" alt="Decrease">
                  </button>

                  <div id="storagePriceValue" class="storageGrayValueBox">${moneyText(price)}</div>

                  <button id="storagePriceUp" class="storageMiniArrowBtn storageMiniArrowSide" type="button" ${isShop ? "disabled" : ""}>
                    <img src="assets/storage/smallrightarrow.png" alt="Increase">
                  </button>
                </div>
              </div>
            `
            : `
              <div class="storageCurrentBoxQtyRow">
                <span class="storageCurrentBoxQtyLabel">CURRENT BOX QTY:</span>
                <img src="assets/ui_icons/shippingbox_icon.png" class="storageCurrentBoxQtyIcon" alt="">
                <span class="storageCurrentBoxQtyValue">${currentBoxQtyAvailable}</span>
              </div>
            `
        }

        <div class="storageManufacturingRow">
          <span class="storageInfoLineLabel">MANUFACTURING PRICE PER UNIT:</span>
          <span class="storageInfoLineValue">
            <img src="assets/ui_icons/coin_icon.png" class="storageCoinIcon" alt="">
            ${moneyText(unitCost)}
          </span>
        </div>

        <div class="storageExpectedRow">
  <span class="storageInfoLineLabel">EXPECTED TOTAL MANUFACTURING COST:</span>
  <span class="storageInfoLineValue">
    <img src="assets/ui_icons/coin_icon.png" class="storageCoinIcon" alt="">
    <span class="storageExpectedCostNumber">${moneyText(expectedCost)}</span>
  </span>
</div>

        <div class="storageQtyRow ${isShippingBox ? 'is-box' : ''}">
          <span class="storageQtyLabel">${isShippingBox ? "ADD BOX QTY:" : "ADDED QTY:"}</span>
          <img src="${p.img}" class="storageQtyProductIcon" alt="${p.name}">
          <button id="storageQtyMinus" class="storageMiniArrowBtn storageMiniArrowSide" type="button" ${isShop ? "disabled" : ""}>
            <img src="assets/storage/smallleftarrow.png" alt="Decrease">
          </button>
          <div id="storageQtyValue" class="storageGrayValueBox storageQtyValueBox">${qty}</div>
          <button id="storageQtyPlus" class="storageMiniArrowBtn storageMiniArrowSide" type="button" ${isShop ? "disabled" : ""}>
            <img src="assets/storage/smallrightarrow.png" alt="Increase">
          </button>
        </div>

        ${
          !isShippingBox
            ? `
              <div class="storageCurrentQtyRow">
                <span class="storageCurrentQtyLabel">IN STOCK:</span>
                <img src="${p.img}" class="storageQtyProductIcon" alt="${p.name}">
                <span class="storageCurrentQtyValue">${currentQty}</span>
              </div>
            `
            : ``
        }

        <div class="storageActionRow">
          ${
            isShippingBox
              ? `
                <button id="storageBuyBoxesBtn" class="storageActionImageBtn storageBuyBoxesBtn" type="button" ${isShop ? "disabled" : ""}>
                  <img src="assets/storage/buymoreboxes.png" alt="Buy More Boxes">
                </button>
              `
              : `
                <button id="storageDeleteBtn" class="storageActionImageBtn" type="button" ${isShop ? "disabled" : ""}>
                  <img src="assets/storage/deleteproductbutton.png" alt="Delete Product">
                </button>
                <button id="storageUpdateBtn" class="storageActionImageBtn" type="button" ${isShop ? "disabled" : ""}>
                  <img src="assets/storage/updateproductbutton.png" alt="Update Product">
                </button>
              `
          }
        </div>

        ${
          isShop
            ? `
              <img class="storageMainOverlay" src="assets/storage/productblockoverlay.png" alt="">
              <button id="storageUnlockBtn" class="storageUnlockImageBtn" type="button">
                <img src="assets/storage/unlockforbutton.png" alt="Unlock Product">
                <span class="storageUnlockCost">
                  <img src="assets/ui_icons/coin_icon.png" class="storageUnlockCoin" alt="">
                  <span class="storageUnlockNumber">${unlockCost}</span>
                </span>
              </button>
            `
            : ``
        }
      </div>

      <button
        id="storageMainNext"
        class="storageMainArrow storageMainArrowRight ${canGoNext ? "" : "is-disabled"}"
        type="button"
        ${canGoNext ? "" : "disabled"}
      >
        <img src="assets/storage/bigrightarrow.png" alt="Next">
      </button>
    </div>
  `;

  // ... inside renderMainBlock() after setting root.innerHTML ...

  // NAVIGATION ARROWS
  document.getElementById("storageMainPrev")?.addEventListener("click", () => moveMainSelection(-1));
  document.getElementById("storageMainNext")?.addEventListener("click", () => moveMainSelection(1));

  // NAME INPUT
  const nameInput = document.getElementById("storageNameInput");
  if (nameInput && !nameInput.disabled) {
    nameInput.addEventListener("input", () => {
      draft.name = String(nameInput.value || "").slice(0, 16).toUpperCase();
      nameInput.value = draft.name;
    });
  }

  // PRICE STEPPER (Hold to Repeat)
  const priceUp = document.getElementById("storagePriceUp");
  const priceDown = document.getElementById("storagePriceDown");
  
  if (priceUp && !isShop && !isShippingBox) {
    attachHoldRepeat(priceUp, () => {
      draft.price = clamp((Number(draft.price) || 0) + 1, 0, 9999);
      // Update only the value box and expected cost to keep it smooth
      const valEl = document.getElementById("storagePriceValue");
      if (valEl) valEl.textContent = moneyText(draft.price);
      updateExpectedCostDisplay();
    }, { startDelay: 420, repeatSpeed: 120 });
  }

  if (priceDown && !isShop && !isShippingBox) {
    attachHoldRepeat(priceDown, () => {
      draft.price = clamp((Number(draft.price) || 0) - 1, 0, 9999);
      const valEl = document.getElementById("storagePriceValue");
      if (valEl) valEl.textContent = moneyText(draft.price);
      updateExpectedCostDisplay();
    }, { startDelay: 420, repeatSpeed: 120 });
  }

  // QUANTITY STEPPER (Hold to Repeat)
  const qtyPlus = document.getElementById("storageQtyPlus");
  const qtyMinus = document.getElementById("storageQtyMinus");

  if (qtyPlus && !isShop) {
    attachHoldRepeat(qtyPlus, () => {
      draft.qty = clamp((Number(draft.qty) || 0) + 1, 0, 999);
      const valEl = document.getElementById("storageQtyValue");
      if (valEl) valEl.textContent = String(draft.qty);
      updateExpectedCostDisplay();
    }, { startDelay: 420, repeatSpeed: 120 }); // Slightly faster for Qty
  }

  if (qtyMinus && !isShop) {
    attachHoldRepeat(qtyMinus, () => {
      draft.qty = clamp((Number(draft.qty) || 0) - 1, 0, 999);
      const valEl = document.getElementById("storageQtyValue");
      if (valEl) valEl.textContent = String(draft.qty);
      updateExpectedCostDisplay();
    }, { startDelay: 420, repeatSpeed: 120 });
  }

  // REMAINING BUTTONS (Update, Delete, Buy, Unlock)
  // ... (keep your existing event listeners for storageDeleteBtn, storageUpdateBtn, etc. below)

  document.getElementById("storageDeleteBtn")?.addEventListener("click", () => {
    const real = (shopInfo.chosenProducts || []).find((item) => item.id === p.id);
    if (!real) return;
    real.onHome = false;
    selectedProductId = "__shipping_boxes__";
    storagePageIndex = 0;
    resetDraftFromSelected();
    refreshStoragePage();
  });

document.getElementById("storageUpdateBtn")?.addEventListener("click", () => {
  const real = (shopInfo.chosenProducts || []).find((item) => item.id === p.id);
  if (!real) return;

  const addedQty = Math.max(0, Number(draft.qty) || 0);
  const unit = Number(real.unitCost) || 0;
  const inventoryCost = addedQty * unit;

  if (addedQty > 0) {
    if ((Number(gameState.revenue) || 0) < inventoryCost) {
      openInsufficientFundsModal(
  "YOU DON'T HAVE ENOUGH COINS TO BUY MORE OF THIS PRODUCT. EARN MORE COINS FIRST."
);
      return;
    }
    gameState.revenue -= inventoryCost;
    real.qty = (Number(real.qty) || 0) + addedQty;
  }

  real.name = String(draft.name || real.name).slice(0, 16).toUpperCase();
  real.price = Number(draft.price) || 0;

  // After applying the update, reset the "ADDED QTY" box back to 0
  // so the player sees the next manufacturing cost from scratch.
  draft = {
    name: String(real.name || "").slice(0, 16).toUpperCase(),
    price: Number(real.price) || 0,
    qty: 0
  };

  renderHud();
  refreshStoragePage();
});

  document.getElementById("storageBuyBoxesBtn")?.addEventListener("click", () => {
    const addQty = Math.max(0, Number(draft.qty) || 0);
    const totalCost = addQty * SHIPPING_BOX_PRICE;
    if (addQty <= 0) return;
    if ((Number(gameState.revenue) || 0) < totalCost) {
      openInsufficientFundsModal(
  "YOU DON'T HAVE ENOUGH COINS TO BUY MORE BOXES. TRY EARNING MORE COINS FIRST."
);
      return;
    }
    gameState.revenue -= totalCost;
    gameState.shippingMaterials = (Number(gameState.shippingMaterials) || 0) + addQty;
    draft.qty = 0;
    resetDraftFromSelected();
    renderHud();
    refreshStoragePage();
  });

  document.getElementById("storageUnlockBtn")?.addEventListener("click", () => {
    const real = (shopInfo.chosenProducts || []).find((item) => item.id === p.id);
    if (!real) return;

    const unlockCostLocal = ensureUnlockCost(real);

    if ((Number(gameState.revenue) || 0) < unlockCostLocal) {
      openInsufficientFundsModal("YOU DON'T HAVE ENOUGH COINS TO UNLOCK THIS PRODUCT. INCREASE YOUR BALANCE FIRST.");
      return;
    }

    gameState.revenue -= unlockCostLocal;
    addUnlockSpend(unlockCostLocal);
    real.unlocked = true;
    real.onHome = true;
    real.qty = 5;
    if (!real.price || real.price === 0) real.price = randInt(15, 45);
    currentShelfTab = "STORAGE";
    selectedProductId = real.id;
    resetDraftFromSelected();
    refreshStoragePage();
    renderHud();
  });
}


function renderBottomShelfBlock() {
  if (!el.storageBottomTabBar || !el.storageGridWrap) return;

  const isStorage = currentShelfTab === "STORAGE";
  const blockBg = isStorage
    ? "assets/storage/storageselectedblock.png"
    : "assets/storage/shopselectedblock.png";

  const visible = getVisibleItems();
  const pageIndex = getCurrentPageIndex();
  const totalPages = pageCountForCurrentTab();

  const tileHtml = [];

  for (let i = 0; i < GRID_PAGE_SIZE; i++) {
    const item = visible[i];

    if (!item) {
      tileHtml.push(`
        <div class="storageGridSlot storageGridSlotEmpty">
          <img class="storageEmptyTileImg" src="assets/storage/emptybox.png" alt="">
        </div>
      `);
      continue;
    }

    const isSelected = item.id === selectedProductId;

    tileHtml.push(`
      <button class="storageGridSlot storageTileBtn ${isSelected ? "is-selected" : ""}" data-id="${item.id}" type="button">
        <div class="storageGridTileBase ${!isStorage ? "is-shop" : ""}"></div>
        <img class="storageGridTileImage" src="${item.img}" alt="${item.name}">
        ${!isStorage ? `<img class="storageGridTileOverlay" src="assets/storage/producttilelockedoverlay.png" alt="">` : ""}
        ${!isStorage ? `<img class="storageGridTileLock" src="assets/storage/lock.png" alt="">` : ""}
        ${isSelected ? `<img class="storageGridTileFrame" src="assets/storage/selectproductframe.png" alt="">` : ""}
      </button>
    `);
  }

  el.storageBottomTabBar.innerHTML = `
    <div class="storageShelfTabsWrap">
      <button id="storageShelfTabBtn" class="storageShelfPillBtn" type="button">
        <img
          class="storageShelfPillImg storageShelfPillStorage"
          src="assets/storage/storage${isStorage ? "white" : "orange"}pill.png"
          alt="Storage"
        >
      </button>

      <button id="storageShopTabBtn" class="storageShelfPillBtn" type="button">
        <img
          class="storageShelfPillImg storageShelfPillShop"
          src="assets/storage/shop${isStorage ? "orange" : "white"}pill.png"
          alt="Shop"
        >
      </button>
    </div>
  `;

  el.storageGridWrap.innerHTML = `
    <div class="storageShelfGridPanel" style="background-image:url('${blockBg}')">
      <button
        id="storageGridPrev"
        class="storageGridArrow storageGridArrowLeft ${pageIndex <= 0 ? "is-disabled" : ""}"
        type="button"
        ${pageIndex <= 0 ? "disabled" : ""}
      >
        <img src="assets/storage/smallleftarrow.png" alt="Previous">
      </button>

      <div class="storageShelfGrid">
        ${tileHtml.join("")}
      </div>

      <button
        id="storageGridNext"
        class="storageGridArrow storageGridArrowRight ${pageIndex >= totalPages - 1 ? "is-disabled" : ""}"
        type="button"
        ${pageIndex >= totalPages - 1 ? "disabled" : ""}
      >
        <img src="assets/storage/smallrightarrow.png" alt="Next">
      </button>
    </div>
  `;

  document.getElementById("storageShelfTabBtn")?.addEventListener("click", () => switchShelfTab("STORAGE"));
  document.getElementById("storageShopTabBtn")?.addEventListener("click", () => switchShelfTab("SHOP"));
  document.getElementById("storageGridPrev")?.addEventListener("click", () => moveGridPage(-1));
  document.getElementById("storageGridNext")?.addEventListener("click", () => moveGridPage(1));

  el.storageGridWrap.querySelectorAll(".storageTileBtn[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => changeSelection(btn.dataset.id));
  });
}

function updateExpectedCostDisplay() {
  const p = getSelectedProduct();
  if (!p || !draft) return;

  const isShippingBox = !!p.isShippingBox;
  const qty = Math.max(0, Number(draft.qty) || 0);
  const unitCost = isShippingBox ? SHIPPING_BOX_PRICE : (Number(p.unitCost) || 0);
  const expectedCost = qty * unitCost;

  const expectedValueEl = document.querySelector(".storageExpectedRow .storageInfoLineValue");
  if (!expectedValueEl) return;

  let numberEl = expectedValueEl.querySelector(".storageExpectedCostNumber");

  // Create the number span once, without replacing the coin image
  if (!numberEl) {
    numberEl = document.createElement("span");
    numberEl.className = "storageExpectedCostNumber";
    expectedValueEl.appendChild(numberEl);
  }

  numberEl.textContent = moneyText(expectedCost);
}

export function refreshStoragePage() {
  renderHud();
  renderStorageTopStats();
  renderMainBlock();
  renderBottomShelfBlock();
}

export function initStoragePage() {
  selectedProductId = "__shipping_boxes__";
  storagePageIndex = 0;
  shopPageIndex = 0;
  resetDraftFromSelected();
}

export function enterStoragePage() {
  if (!draft) resetDraftFromSelected();
  refreshStoragePage();

  if (storageInterval) clearInterval(storageInterval);

  storageInterval = setInterval(() => {
    const storagePage = document.getElementById("pageStorage");

    if (!storagePage?.classList.contains("show")) {
      clearInterval(storageInterval);
      storageInterval = null;
      return;
    }

    updateStorageTopStatsValues();
    updateExpectedCostDisplay();
  }, 1000);
}