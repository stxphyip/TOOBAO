// js/modals/editProduct.js

import { el } from "../dom.js";
import {
  gameState,
  setCurrentEditingProduct,
  currentEditingProduct,
  currentTask,
  addInventorySpend,
  refundInventorySpend
} from "../state.js";
import { getProductById } from "../store/productsStore.js";
import { clamp, formatMoney, attachHoldRepeat } from "../utils.js";
import { buildHomePage } from "../pages/home.js";
import { checkTaskCompletion, clearTask } from "../systems/tasks.js";

function unitCostOf(product) {
  return Number(product?.unitCost || 0);
}

function reservedQtyOf(product) {
  return Number(product?.reservedQty || 0);
}

function canAfford(cost) {
  return (Number(gameState.revenue) || 0) >= cost - 1e-9;
}

function spend(cost) {
  gameState.revenue = Math.max(0, (Number(gameState.revenue) || 0) - cost);
}

function refund(cost) {
  gameState.revenue = (Number(gameState.revenue) || 0) + cost;
}

export function openEditProduct(productId) {
  const p = getProductById(productId);
  if (!p) return;

  setCurrentEditingProduct(p);

  el.editProductOverlay.classList.remove("hidden");
  el.editProductImage.src = p.img;
  el.editProductName.value = p.name;

  refreshEditProductNumbers();
}

function closeEditProduct() {
  el.editProductOverlay.classList.add("hidden");
  setCurrentEditingProduct(null);
}

function refreshEditProductNumbers() {
  if (!currentEditingProduct) return;

  const unitCost = unitCostOf(currentEditingProduct);
  const qty = Number(currentEditingProduct.qty) || 0;
  const reserved = reservedQtyOf(currentEditingProduct);
  const plannedCost = qty * unitCost;

  el.editProductPrice.textContent = currentEditingProduct.price;
  el.editProductQty.textContent = qty;

  if (el.editProductUnitCost) {
    el.editProductUnitCost.textContent = `${formatMoney(unitCost)}/unit`;
  }

  if (el.editProductCostHint) {
    el.editProductCostHint.textContent =
      `Planned stock cost: ${formatMoney(plannedCost)} • Reserved: ${reserved} • Budget: ${formatMoney(gameState.revenue)}`;
  }
}

export function initEditProductModal() {
  el.closeEditProductBtn.onclick = closeEditProduct;

  attachHoldRepeat(el.priceMinus, () => {
    if (!currentEditingProduct) return;
    currentEditingProduct.price = clamp((Number(currentEditingProduct.price) || 0) - 1, 0, 100);
    refreshEditProductNumbers();
    checkTaskCompletion();
    buildHomePage();
  });

  attachHoldRepeat(el.pricePlus, () => {
    if (!currentEditingProduct) return;
    currentEditingProduct.price = clamp((Number(currentEditingProduct.price) || 0) + 1, 0, 100);
    refreshEditProductNumbers();
    checkTaskCompletion();
    buildHomePage();
  });

  attachHoldRepeat(el.qtyMinus, () => {
    if (!currentEditingProduct) return;

    const currentQty = Number(currentEditingProduct.qty) || 0;
    const reserved = reservedQtyOf(currentEditingProduct);
    const minQty = reserved;
    const nextQty = clamp(currentQty - 1, minQty, 100);

    if (nextQty === currentQty) return;

    const delta = currentQty - nextQty;
    const refundAmt = unitCostOf(currentEditingProduct) * delta;

    refund(refundAmt);
    refundInventorySpend(refundAmt);
    currentEditingProduct.qty = nextQty;

    refreshEditProductNumbers();
    checkTaskCompletion();
    buildHomePage();
  });

  attachHoldRepeat(el.qtyPlus, () => {
    if (!currentEditingProduct) return;

    const currentQty = Number(currentEditingProduct.qty) || 0;
    const nextQty = clamp(currentQty + 1, 0, 100);
    if (nextQty === currentQty) return;

    const delta = nextQty - currentQty;
    const cost = unitCostOf(currentEditingProduct) * delta;

    if (!canAfford(cost)) return;

    spend(cost);
    addInventorySpend(cost);
    currentEditingProduct.qty = nextQty;

    refreshEditProductNumbers();
    checkTaskCompletion();
    buildHomePage();
  });

  el.deleteProductBtn.onclick = () => {
    if (!currentEditingProduct) return;
    const deletedId = currentEditingProduct.id;

    currentEditingProduct.onHome = false;

    if (currentTask && currentTask.type === "DELETE_PRODUCT" && currentTask.productId === deletedId) {
      clearTask(true);
    } else {
      checkTaskCompletion();
    }

    closeEditProduct();
    buildHomePage();
  };

  el.saveProductBtn.onclick = () => {
    if (!currentEditingProduct) return;

    const newName = el.editProductName.value.trim();
    if (newName.length > 0) currentEditingProduct.name = newName;

    checkTaskCompletion();
    closeEditProduct();
    buildHomePage();
  };
}