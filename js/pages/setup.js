import { shopInfo } from "../state.js";
import { PRESET_PROFILES } from "../data/presets.js";
import { showPage } from "../router.js";
import { initProductsPage, enterProductsPage } from "./products.js";
import { resetProductsForNewProfile } from "../store/productsStore.js";

function $(id) {
  return document.getElementById(id);
}

let didWireButtons = false;

export function initSetupPage() {
  const grid = $("presetProfiles");
  if (!grid) return;

  grid.innerHTML = PRESET_PROFILES.map(tileHTML).join("");

  grid.querySelectorAll("[data-preset]").forEach((tile) => {
    tile.onclick = () => {
      const key = tile.getAttribute("data-preset");
      selectPreset(key);
    };
  });

  wireSetupButtonsOnce();
  restoreOrDefaultSelection();
}

export function enterSetupPage() {
  showPage("pageSetup");
  initSetupPage();
}

function tileHTML(p) {
  return `
    <button class="presetTile" type="button" data-preset="${p.key}">
      <img class="presetTileCardImg" src="${p.cardImg}" alt="${p.storeName}">
      <img class="presetTileCheck" src="assets/setup/checkmark.png" alt="Selected">
    </button>
  `;
}

function wireSetupButtonsOnce() {
  if (didWireButtons) return;
  didWireButtons = true;

  const prevBtn = $("setupPrevBtn");
  const nextBtn = $("setupNextBtn");

  if (prevBtn) {
    prevBtn.onclick = () => {
      showPage("pageTutorial");
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (!shopInfo.name) {
        const msg = $("setupMessage");
        if (msg) msg.textContent = "Please select a profile first!";
        return;
      }

      resetProductsForNewProfile();
      initProductsPage();
      enterProductsPage();
    };
  }
}

function restoreOrDefaultSelection() {
  if (shopInfo.name) {
    const match = PRESET_PROFILES.find(
      (p) =>
        p.storeName === shopInfo.name &&
        p.region === shopInfo.region &&
        p.sellerId === shopInfo.id
    );

    if (match) {
      selectPreset(match.key, { silent: true, forceReset: false });
      return;
    }
  }

  if (PRESET_PROFILES[0]) {
    selectPreset(PRESET_PROFILES[0].key, { silent: true, forceReset: true });
  }
}

// Modify this function in your setup.js
/* js/pages/setup.js */

function selectPreset(key, opts = {}) {
  const p = PRESET_PROFILES.find((x) => x.key === key);
  if (!p) return;

  const shouldReset = opts.forceReset !== false;
  
  // Update store info first so applyStarterProducts has the right type
  shopInfo.name = p.storeName;
  shopInfo.region = p.region;
  shopInfo.id = p.sellerId;
  shopInfo.storeType = p.storeType;
  shopInfo.avatarNumber = p.avatarNumber;

  if (shouldReset) {
    // Pass the product IDs defined in your PRESET_PROFILES for this character
    // Example: p.products might be ["pants", "shirt", "dress"]
    resetProductsForNewProfile(p.products); 
  }

  highlight(key);

  const msg = $("setupMessage");
  if (msg) {
    msg.textContent = p.selectedLabel;
  }
}

function highlight(key) {
  const grid = $("presetProfiles");
  if (!grid) return;

  grid.querySelectorAll("[data-preset]").forEach((tile) => {
    const isSelected = tile.getAttribute("data-preset") === key;
    tile.classList.toggle("is-selected", isSelected);
  });
}