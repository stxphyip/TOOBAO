// js/modals/addProduct.js

import { el } from "../dom.js";
import { shopInfo, gameState, addUnlockSpend } from "../state.js";
import { buildHomePage } from "../pages/home.js";
import { checkTaskCompletion } from "../systems/tasks.js";
import { attachHoldRepeat, randInt } from "../utils.js";

let tempAddProducts = [];
const unlockCostById = new Map();

function getOrCreateUnlockCost(productId) {
  if (unlockCostById.has(productId)) return unlockCostById.get(productId);

  const cost = randInt(40, 100);
  unlockCostById.set(productId, cost);
  return cost;
}

function showMoneyAlert(needed, current) {
  const alertBox = document.createElement("div");
  alertBox.className = "money-error-popup";
  alertBox.innerHTML = `
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <div class="error-title">Insufficient Funds</div>
      <div class="error-text">Costs <b>$${needed}</b>. You have <b>$${Math.floor(current)}</b>.</div>
      <button class="error-close-btn">Got it</button>
    </div>
  `;
  document.body.appendChild(alertBox);
  alertBox.querySelector(".error-close-btn").onclick = () => alertBox.remove();
}

export function openAddProductPopup() {
  el.addProductOverlay.classList.remove("hidden");

  tempAddProducts = shopInfo.chosenProducts
    .filter((p) => !p.onHome)
    .map((p) => {
      if (p.unlockCost == null) p.unlockCost = getOrCreateUnlockCost(p.id);

      return {
        ...p,
        addSelected: false,
        unlocked: !!p.unlocked,
        unlockCost: p.unlockCost,
        price: Number(p.price) || 25
      };
    });

  buildAddProductsGrid();
}

function closeAddProductPopup() {
  el.addProductOverlay.classList.add("hidden");
}

function makePriceStepperRow(tempProduct) {
  const row = document.createElement("div");
  row.className = "stepRow";

  const label = document.createElement("div");
  label.className = "stepLabel";
  label.textContent = "Price";

  const stepper = document.createElement("div");
  stepper.className = "stepper";

  const minus = document.createElement("button");
  minus.className = "stepBtn";
  minus.textContent = "−";

  const num = document.createElement("div");
  num.className = "stepNum";
  num.textContent = tempProduct.price;

  const plus = document.createElement("button");
  plus.className = "stepBtn";
  plus.textContent = "+";

  const applyDelta = (delta) => {
    tempProduct.price = Math.max(1, Math.min(999, tempProduct.price + delta));
    num.textContent = tempProduct.price;
  };

  attachHoldRepeat(minus, () => applyDelta(-1), { startDelay: 350, repeatSpeed: 100 });
  attachHoldRepeat(plus, () => applyDelta(+1), { startDelay: 350, repeatSpeed: 100 });

  stepper.append(minus, num, plus);
  row.append(label, stepper);
  return row;
}

function unlockProduct(tempProduct, tile, lockOverlay, priceRow) {
  const cost = tempProduct.unlockCost;
  const money = gameState.revenue || 0;

  if (money < cost) {
    showMoneyAlert(cost, money);
    return;
  }

  gameState.revenue -= cost;
  addUnlockSpend(cost);

  const real = shopInfo.chosenProducts.find((x) => x.id === tempProduct.id);
  if (real) real.unlocked = true;

  tempProduct.unlocked = true;
  lockOverlay.remove();
  priceRow.classList.remove("hiddenPrice");
  tile.classList.add("is-unlocked");

  buildHomePage();
}

function buildAddProductsGrid() {
  el.addProductsGrid.innerHTML = "";

  tempAddProducts.forEach((p) => {
    const tile = document.createElement("div");
    tile.className = "productTile addTile";
    tile.classList.toggle("is-unlocked", !!p.unlocked);
    tile.classList.toggle("selected", !!p.addSelected);

    const imgBtn = document.createElement("button");
    imgBtn.className = "productPhotoBtn";
    imgBtn.type = "button";
    imgBtn.onclick = () => {
      if (!p.unlocked) return;
      p.addSelected = !p.addSelected;
      tile.classList.toggle("selected", p.addSelected);
    };

    const img = document.createElement("img");
    img.src = p.img;
    img.className = "productPhoto";
    img.alt = p.name;
    imgBtn.appendChild(img);

    const name = document.createElement("div");
    name.className = "productNameSmall";
    name.textContent = p.name;

    const priceRow = makePriceStepperRow(p);
    if (!p.unlocked) priceRow.classList.add("hiddenPrice");

    if (!p.unlocked) {
      const lockOverlay = document.createElement("div");
      lockOverlay.className = "unlockOverlay";

      const txt = document.createElement("div");
      txt.className = "unlockText";
      txt.textContent = `Unlock ${p.name} for $${p.unlockCost}`;

      const btn = document.createElement("button");
      btn.className = "unlockBtn";
      btn.type = "button";
      btn.textContent = "Unlock";
      btn.onclick = (e) => {
        e.stopPropagation();
        unlockProduct(p, tile, lockOverlay, priceRow);
      };

      lockOverlay.append(txt, btn);
      tile.append(imgBtn, name, priceRow, lockOverlay);
    } else {
      tile.append(imgBtn, name, priceRow);
    }

    el.addProductsGrid.appendChild(tile);
  });
}

export function initAddProductModal() {
  if (!el.confirmAddProductBtn) return;

  el.closeAddProductBtn.onclick = closeAddProductPopup;

  el.confirmAddProductBtn.onclick = () => {
    const toAdd = tempAddProducts.filter((p) => p.addSelected && p.unlocked);

    toAdd.forEach((tempItem) => {
      const realItem = shopInfo.chosenProducts.find((p) => p.id === tempItem.id);
      if (realItem) {
        realItem.onHome = true;
        realItem.price = tempItem.price;
        realItem.qty = 5;
        realItem.reservedQty = 0;
        realItem.sold = 0;
        realItem.recentViews = 0;
      }
    });

    buildHomePage();
    closeAddProductPopup();
    checkTaskCompletion();
  };
}