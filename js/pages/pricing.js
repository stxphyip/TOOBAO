/* js/pages/pricing.js */
import { el } from "../dom.js";
import { showPage } from "../router.js";
import { shopInfo, gameState } from "../state.js";
import { setupProductStorageOnce, getHomeProducts } from "../store/productsStore.js";
import { attachHoldRepeat } from "../utils.js";
import { enterHome } from "./home.js";
import { startGameLoops } from "../systems/loops.js";

const COIN_IMG = "assets/setup/coin.png";
const ARROW_LEFT_IMG = "assets/setup/arrow_left.png";
const ARROW_RIGHT_IMG = "assets/setup/arrow_right.png";

let pricingIndex = 0;
let didInitPricing = false;
let pricingPageInitializedOnce = false;

function getStarterProducts() {
  setupProductStorageOnce();
  const products = getHomeProducts().slice(0, 3);
  return products.length ? products : (shopInfo.chosenProducts || []).slice(0, 3);
}

function initializeStarterPricesOnce() {
  if (pricingPageInitializedOnce) return;

  const products = getStarterProducts();
  products.forEach((p) => {
    p.price = 0;
  });

  pricingPageInitializedOnce = true;
}

function coinInlineHtml(value) {
  return `
    <span class="coinValueWrap">
      <img class="coinInline" src="${COIN_IMG}" alt="Coin">
      <span>${Math.round(Number(value) || 0)}</span>
    </span>
  `;
}

function updatePricingMessage(msg = "") {
  if (el.pricingMessage) el.pricingMessage.textContent = msg || "";
}

function validatePricing(products) {
  if (!products || products.length === 0) {
    return "NO PRODUCTS FOUND.";
  }

  for (const p of products) {
    if ((Number(p.price) || 0) <= 0) {
      return `SET A PRICE FOR ${String(p.name || "").toUpperCase()}.`;
    }
  }

  return "";
}

function renderPricingPicker() {
  if (!el.pricingPickerWrap) return;

  const products = getStarterProducts();
  if (!products.length) {
    el.pricingPickerWrap.innerHTML = "";
    return;
  }

  pricingIndex = Math.max(0, Math.min(pricingIndex, products.length - 1));

  el.pricingPickerWrap.innerHTML = `
    <div class="pricingPickerRow">
      <button id="pPrev" class="pricingProductArrow" type="button" aria-label="Previous product">
        <img src="${ARROW_LEFT_IMG}" alt="Previous">
      </button>

      <div class="pricingThumbStrip">
        ${products.map((p, i) => `
          <button
            class="pricingThumb ${i === pricingIndex ? "is-selected" : ""}"
            type="button"
            data-idx="${i}"
            aria-label="${String(p.name || "").toUpperCase()}"
          >
            <img src="${p.img}" alt="${p.name}">
          </button>
        `).join("")}
      </div>

      <button id="pNext" class="pricingProductArrow" type="button" aria-label="Next product">
        <img src="${ARROW_RIGHT_IMG}" alt="Next">
      </button>
    </div>
  `;

  const prevBtn = document.getElementById("pPrev");
  const nextBtn = document.getElementById("pNext");

  if (prevBtn) {
    prevBtn.onclick = () => {
      pricingIndex = Math.max(0, pricingIndex - 1);
      renderPage();
      updatePricingMessage("");
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      pricingIndex = Math.min(products.length - 1, pricingIndex + 1);
      renderPage();
      updatePricingMessage("");
    };
  }

  el.pricingPickerWrap.querySelectorAll(".pricingThumb").forEach((btn) => {
    btn.onclick = () => {
      pricingIndex = parseInt(btn.dataset.idx, 10) || 0;
      renderPage();
      updatePricingMessage("");
    };
  });
}

function renderPricingCard() {
  if (!el.pricingCardWrap) return;

  const products = getStarterProducts();
  if (!products.length) {
    el.pricingCardWrap.innerHTML = "";
    return;
  }

  pricingIndex = Math.max(0, Math.min(pricingIndex, products.length - 1));
  const p = products[pricingIndex];

  if (typeof p.price !== "number") {
    p.price = 0;
  }

  const manufacturingPrice = Number(p.unitCost ?? 0);

  el.pricingCardWrap.innerHTML = `
  <div class="pricingCard">
    <div class="pricingCardTitle">PRODUCT ${pricingIndex + 1}:</div>

    <div class="pricingCardInner">
      <div class="pricingMainCol">
        <div class="pricingMainArtWrap">
          <img class="pricingMainArt" src="${p.img}" alt="${p.name}">
        </div>

        <div class="pricingCardName">${String(p.name || "[PRODUCT NAME]").toUpperCase()}</div>
      </div>

      <div class="pricingControlWrap">
        <div class="pricingManufacturingRow">
          <span class="pricingManufacturingLabel">MANUFACTURING PRICE:</span>
          ${coinInlineHtml(manufacturingPrice)}
        </div>

        <div class="pricingPriceRow">
          <span class="pricingLabel">PRICE:</span>
          <img class="coinInline" src="${COIN_IMG}" alt="Coin">
        </div>

        <div class="pricingStepperCol">
          <button id="priceUp" class="pricingVerticalBtn" type="button" aria-label="Increase price">
            <img src="${ARROW_RIGHT_IMG}" alt="Increase">
          </button>

          <div id="pricingPriceNum" class="pricingPriceBox">${p.price}</div>

          <button id="priceDown" class="pricingVerticalBtn pricingVerticalBtnDown" type="button" aria-label="Decrease price">
            <img src="${ARROW_RIGHT_IMG}" alt="Decrease">
          </button>
        </div>
      </div>
    </div>
  </div>
`;

  const priceUpBtn = document.getElementById("priceUp");
  const priceDownBtn = document.getElementById("priceDown");

  function setPrice(delta) {
    p.price = Math.max(0, Math.min(999, (Number(p.price) || 0) + delta));

    const priceNum = document.getElementById("pricingPriceNum");
    if (priceNum) priceNum.textContent = String(p.price);

    updatePricingMessage("");
  }

  if (priceUpBtn) {
    attachHoldRepeat(priceUpBtn, () => setPrice(+1), { startDelay: 420, repeatSpeed: 120 });
  }

  if (priceDownBtn) {
    attachHoldRepeat(priceDownBtn, () => setPrice(-1), { startDelay: 420, repeatSpeed: 120 });
  }
}

function renderPage() {
  renderPricingPicker();
  renderPricingCard();
}

export function enterPricingPage() {
  initializeStarterPricesOnce();
  pricingIndex = 0;
  showPage("pagePricing");
  renderPage();
  updatePricingMessage("");
}

export function initPricingPage() {
  if (didInitPricing) return;
  didInitPricing = true;

  if (el.pricingPrevBtn) {
    el.pricingPrevBtn.onclick = () => {
      showPage("pageProducts");
    };
  }

  if (el.pricingNextBtn) {
    el.pricingNextBtn.onclick = () => {
      if (!el.setupStoreFinalBtn) return;
      el.setupStoreFinalBtn.click();
    };
  }

  if (el.setupStoreFinalBtn) {
    el.setupStoreFinalBtn.onclick = () => {
      const products = getStarterProducts();
      const err = validatePricing(products);

      if (err) {
        updatePricingMessage(err);
        return;
      }

      gameState.running = true;
      gameState.day = 1;
      gameState.secondsLeft = 180;

      if (typeof gameState.revenue !== "number" || gameState.revenue <= 0) {
        gameState.revenue = 500;
      }

      enterHome();
      startGameLoops();
    };
  }
}