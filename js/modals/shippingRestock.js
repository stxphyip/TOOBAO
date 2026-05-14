// js/modals/shippingRestock.js

import { el } from "../dom.js";
import {
  gameState,
  addShippingBoxSpend
} from "../state.js";
import { attachHoldRepeat, formatMoney } from "../utils.js";
import { buildHomePage } from "../pages/home.js";

const BOX_COST = 0.25;

let didInit = false;
let qtyToBuy = 0;

function open() {
  if (!el.shippingRestockOverlay) return;

  qtyToBuy = 0;
  render();

  el.shippingRestockOverlay.classList.remove("hidden");
}

function close() {
  if (!el.shippingRestockOverlay) return;
  el.shippingRestockOverlay.classList.add("hidden");
}

function render() {
  if (!el.restockBudgetText || !el.restockQty || !el.restockCostText) return;

  el.restockBudgetText.textContent = formatMoney(gameState.revenue || 0);
  el.restockQty.textContent = String(qtyToBuy);

  const cost = qtyToBuy * BOX_COST;
  el.restockCostText.textContent = formatMoney(cost);

  if (el.confirmRestockBtn) {
    el.confirmRestockBtn.style.opacity =
      (gameState.revenue || 0) >= cost && qtyToBuy > 0 ? "1" : "0.5";
  }
}

function changeQty(delta) {
  qtyToBuy = Math.max(0, qtyToBuy + delta);
  render();
}

function confirm() {
  const cost = qtyToBuy * BOX_COST;
  if (qtyToBuy <= 0) return;
  if ((gameState.revenue || 0) < cost) return;

  gameState.revenue -= cost;
  gameState.shippingMaterials = (gameState.shippingMaterials || 0) + qtyToBuy;
  addShippingBoxSpend(cost);

  qtyToBuy = 0;
  render();

  buildHomePage();
  close();
}

export function initShippingRestockModal() {
  if (didInit) return;
  didInit = true;

  if (el.closeShippingRestockBtn) el.closeShippingRestockBtn.onclick = close;

  if (el.restockMinus) attachHoldRepeat(el.restockMinus, () => changeQty(-1));
  if (el.restockPlus) attachHoldRepeat(el.restockPlus, () => changeQty(+1));

  if (el.confirmRestockBtn) el.confirmRestockBtn.onclick = confirm;

  if (el.shippingRestockOverlay) {
    el.shippingRestockOverlay.addEventListener("click", (e) => {
      if (e.target === el.shippingRestockOverlay) close();
    });
  }
}

export function openShippingRestockModal() {
  open();
}