import { el } from "../dom.js";
import { showPage } from "../router.js";
import {
  shopInfo,
  gameState,
  addShippingBoxSpend,
  refundShippingBoxSpend,
  addInventorySpend
} from "../state.js";
import { setupProductStorageOnce, getHomeProducts } from "../store/productsStore.js";
import { attachHoldRepeat } from "../utils.js";
import { enterPricingPage } from "./pricing.js"; // Import the next step

const BOX_COST = 1;
const COIN_IMG = "assets/setup/coin.png";
const BOX_IMG = "assets/setup/shippingbox.png";
const ARROW_LEFT_IMG = "assets/setup/arrow_left.png";
const ARROW_RIGHT_IMG = "assets/setup/arrow_right.png";

let stepIndex = 0;
let didWire = false;

function unitCostOf(product) {
  return Number(product.unitCost ?? 4);
}

function ensureStartupMoneyOnce() {
  if ((gameState.day || 1) === 1 && !gameState.running) {
    if (typeof gameState.revenue !== "number" || gameState.revenue <= 0) {
      gameState.revenue = 500;
    }

    if (typeof gameState.shippingMaterials !== "number") gameState.shippingMaterials = 0;
    if (typeof gameState.reservedShippingMaterials !== "number") gameState.reservedShippingMaterials = 0;
  }
}

function canAfford(cost) {
  const cash = Number(gameState.revenue) || 0;
  return cash - cost >= -1e-9;
}

function spend(cost) {
  gameState.revenue = Math.max(0, (Number(gameState.revenue) || 0) - cost);
}

function refund(cost) {
  gameState.revenue = (Number(gameState.revenue) || 0) + cost;
}

function coinInlineHtml(value) {
  return `
    <span class="coinValueWrap">
      <img class="coinInline" src="${COIN_IMG}" alt="Coin">
      <span>${Math.round(Number(value) || 0)}</span>
    </span>
  `;
}

function ensureTopMessageBelowBalance() {
  const balanceEl = document.getElementById("productsBalanceText");
  if (!balanceEl) return null;

  let msgEl = document.getElementById("productsMessageInline");
  if (!msgEl) {
    msgEl = document.createElement("div");
    msgEl.id = "productsMessageInline";
    msgEl.className = "productsMessageInline";
    balanceEl.insertAdjacentElement("afterend", msgEl);
  }

  return msgEl;
}

function updateProductsMessage(msg = "") {
  if (el.productsMessage) el.productsMessage.textContent = msg || "";

  const balanceEl = document.getElementById("productsBalanceText");
  if (balanceEl) {
    balanceEl.innerHTML = `
      <span>Balance:</span>
      ${coinInlineHtml(gameState.revenue)}
    `;
  }

  const inline = ensureTopMessageBelowBalance();
  if (inline) {
    inline.textContent = msg || "";
    inline.style.minHeight = msg ? "20px" : "0";
    inline.style.marginTop = msg ? "6px" : "0";
    inline.style.marginBottom = msg ? "8px" : "0";
  }
}

function validateFinish(products) {
  if (!products || products.length === 0) return "Please select products to start your business.";
  for (const p of products) {
    if (Number(p.qty) <= 0) return `Set a quantity for ${p.name}.`;
  }
  if ((gameState.shippingMaterials || 0) <= 0) return "Buy at least 1 shipping box.";
  return "";
}

function getStarterProducts() {
  setupProductStorageOnce();
  const products = getHomeProducts().slice(0, 3);
  if (products.length) return products;
  return (shopInfo.chosenProducts || []).slice(0, 3);
}

function renderShippingPurchaseRow() {
  if (!el.shippingPurchaseRow) return;

  const totalCost = (Number(gameState.shippingMaterials) || 0) * BOX_COST;

  el.shippingPurchaseRow.innerHTML = `
    <div class="shippingCardTitle">Order Shipping Boxes</div>

    <div class="shippingCardInner">
      <img class="shippingBoxArt" src="${BOX_IMG}" alt="Shipping Box">

      <div class="shippingInfo">
        <div class="coinRow">
          <span class="coinLabelDark">Price:</span>
          ${coinInlineHtml(BOX_COST)}
          <span class="coinLabelDark">Per Box</span>
        </div>

        <div id="shippingTotalCostRow" class="coinRow">
          <span class="coinLabelDark">Expected Total Cost:</span>
          ${coinInlineHtml(totalCost)}
        </div>

        <div class="inventoryQtyRow">
          <span class="coinLabelDark">Qty:</span>

          <button id="startupBoxMinus" class="inventoryStepBtn" type="button" aria-label="Decrease boxes">
            <img src="${ARROW_LEFT_IMG}" alt="Decrease">
          </button>

          <div id="startupBoxQty" class="inventoryQtyBox">${String(gameState.shippingMaterials || 0)}</div>

          <button id="startupBoxPlus" class="inventoryStepBtn" type="button" aria-label="Increase boxes">
            <img src="${ARROW_RIGHT_IMG}" alt="Increase">
          </button>
        </div>
      </div>
    </div>
  `;

  const qtyEl = document.getElementById("startupBoxQty");
  const minus = document.getElementById("startupBoxMinus");
  const plus = document.getElementById("startupBoxPlus");
  const totalRow = document.getElementById("shippingTotalCostRow");

  function refreshShippingBoxUI() {
    if (qtyEl) {
      qtyEl.textContent = String(gameState.shippingMaterials || 0);
    }

    if (totalRow) {
      const total = (Number(gameState.shippingMaterials) || 0) * BOX_COST;
      totalRow.innerHTML = `
        <span class="coinLabelDark">Expected Total Cost:</span>
        ${coinInlineHtml(total)}
      `;
    }

    updateProductsMessage("");
  }

  function apply(delta) {
    const current = Number(gameState.shippingMaterials) || 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;

    if (delta > 0) {
      const cost = BOX_COST * delta;
      if (!canAfford(cost)) {
        updateProductsMessage("Not enough coins to buy more boxes.");
        return;
      }

      spend(cost);
      addShippingBoxSpend(cost);
      gameState.shippingMaterials = next;
    } else if (delta < 0) {
      const refundAmt = BOX_COST * Math.abs(delta);
      refund(refundAmt);
      refundShippingBoxSpend(refundAmt);
      gameState.shippingMaterials = next;
    }

    refreshShippingBoxUI();
  }

  attachHoldRepeat(minus, () => apply(-1), { startDelay: 420, repeatSpeed: 120 });
  attachHoldRepeat(plus, () => apply(+1), { startDelay: 420, repeatSpeed: 120 });
}

function renderWizard() {
  const wrap = el.productsGrid;
  if (!wrap) return;

  const products = getStarterProducts();
  if (!products.length) {
    wrap.innerHTML = "";
    updateProductsMessage("No starter products found.");
    return;
  }

  stepIndex = Math.max(0, Math.min(stepIndex, products.length - 1));
  const p = products[stepIndex];

  p.qty = Number(p.qty || 0);
  if (typeof p.unitCost !== "number") p.unitCost = unitCostOf(p);

  const costPer = unitCostOf(p);
  const plannedManufacturing = (Number(p.qty || 0) * costPer) || 0;

  wrap.innerHTML = `
    <div class="productsSectionTitle">Your Products</div>

    <div class="productPickerRow">
      <button id="wizardPrev" class="productPickerArrow" type="button" aria-label="Previous product">
        <img src="${ARROW_LEFT_IMG}" alt="Previous">
      </button>

      <div class="productThumbStrip">
        ${products.map((item, idx) => `
          <button class="productThumb ${idx === stepIndex ? "is-selected" : ""}" type="button" data-thumb-index="${idx}">
            <img src="${item.img}" alt="${item.name}">
          </button>
        `).join("")}
      </div>

      <button id="wizardNext" class="productPickerArrow" type="button" aria-label="Next product">
        <img src="${ARROW_RIGHT_IMG}"  alt="Next">
      </button>
    </div>

    <div class="productOrderCard">
      <div class="productOrderTitle">Order Products</div>

      <div class="productOrderInner">
        <div class="productMainArtWrap">
          <img class="productMainArt" src="${p.img}" alt="${p.name}">
          <div class="productMainName">${p.name}</div>
        </div>

        <div class="productInfo">
          <div id="manufacturingPriceRow" class="coinRow">
            <span class="coinLabelDark">Manufacturing Price:</span>
            ${coinInlineHtml(costPer)}
          </div>

          <div id="manufacturingTotalRow" class="coinRow">
            <span class="coinLabelDark">Expected Total Manufacturing Cost:</span>
            ${coinInlineHtml(plannedManufacturing)}
          </div>

          <div class="inventoryQtyRow">
            <span class="coinLabelDark">Qty:</span>

            <button id="qtyMinus" class="inventoryStepBtn" type="button" aria-label="Decrease quantity">
              <img src="${ARROW_LEFT_IMG}" alt="Decrease">
            </button>

            <div id="qtyNum" class="inventoryQtyBox">${String(p.qty)}</div>

            <button id="qtyPlus" class="inventoryStepBtn" type="button" aria-label="Increase quantity">
              <img src="${ARROW_RIGHT_IMG}" alt="Increase">
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const prevBtn = document.getElementById("wizardPrev");
  const nextBtn = document.getElementById("wizardNext");
  const qtyNum = document.getElementById("qtyNum");
  const qtyMinus = document.getElementById("qtyMinus");
  const qtyPlus = document.getElementById("qtyPlus");
  const manufacturingTotalRow = document.getElementById("manufacturingTotalRow");

  prevBtn.onclick = () => {
    stepIndex = Math.max(0, stepIndex - 1);
    renderWizard();
    updateProductsMessage("");
  };

  nextBtn.onclick = () => {
    stepIndex = Math.min(products.length - 1, stepIndex + 1);
    renderWizard();
    updateProductsMessage("");
  };

  document.querySelectorAll("[data-thumb-index]").forEach((btn) => {
    btn.onclick = () => {
      stepIndex = Number(btn.dataset.thumbIndex) || 0;
      renderWizard();
      updateProductsMessage("");
    };
  });

  function refreshManufacturingTotal() {
    const total = (Number(p.qty || 0) * costPer) || 0;
    if (manufacturingTotalRow) {
      manufacturingTotalRow.innerHTML = `
        <span class="coinLabelDark">Expected Total Manufacturing Cost:</span>
        ${coinInlineHtml(total)}
      `;
    }
  }

  function setQty(delta) {
    const oldQty = Number(p.qty) || 0;
    const newQty = Math.max(0, Math.min(999, oldQty + delta));
    if (newQty === oldQty) return;

    if (delta > 0) {
      const cost = costPer * delta;
      if (!canAfford(cost)) {
        updateProductsMessage("Not enough coins to manufacture more.");
        return;
      }

      spend(cost);
      addInventorySpend(cost);
    } else if (delta < 0) {
      const refundAmt = costPer * Math.abs(delta);
      refund(refundAmt);
      p.qty = newQty;
      qtyNum.textContent = String(newQty);
      refreshManufacturingTotal();
      updateProductsMessage("");
      return;
    }

    p.qty = newQty;
    qtyNum.textContent = String(newQty);
    refreshManufacturingTotal();
    updateProductsMessage("");
  }

  attachHoldRepeat(qtyMinus, () => setQty(-1), { startDelay: 420, repeatSpeed: 120 });
  attachHoldRepeat(qtyPlus, () => setQty(+1), { startDelay: 420, repeatSpeed: 120 });
}

function renderPage() {
  ensureStartupMoneyOnce();
  ensureTopMessageBelowBalance();
  renderShippingPurchaseRow();
  renderWizard();
  updateProductsMessage("");
}

export function enterProductsPage() {
  stepIndex = 0;
  renderPage();
  showPage("pageProducts");
}

export function canEnterPricingFromProducts() {
  const products = getStarterProducts();
  const err = validateFinish(products);

  if (err) {
    updateProductsMessage(err);
    return false;
  }

  return true;
}

export function initProductsPage() {
  if (didWire) return;
  didWire = true;

  ensureStartupMoneyOnce();

  const prevBtn = document.getElementById("productsPrevBtn");
  const nextBtn = document.getElementById("productsNextBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      showPage("pageSetup");
    };
  }

  if (nextBtn) {
  nextBtn.onclick = () => {
    if (!canEnterPricingFromProducts()) return;
    enterPricingPage();
  };
}
}