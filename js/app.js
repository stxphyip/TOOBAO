// js/app.js

import { showPage, initNav, hideNavBar } from "./router.js";
import { initToast } from "./systems/toast.js";
import { initStartPage } from "./pages/start.js";
import { initTutorialPage } from "./pages/tutorial.js";
import { initSetupPage } from "./pages/setup.js";
import { initProductsPage } from "./pages/products.js";
import { initPricingPage } from "./pages/pricing.js";
import { initMarketingPage } from "./pages/marketing.js";
import { initManagerPage, enterManagerPage } from "./pages/manager.js";
import { initOrdersPage } from "./pages/orders.js";
import { initStoragePage } from "./pages/storage.js";

import {
  initButtonClickSound,
  initOrderActionSounds,
  initGlobalSoundStopper
} from "./systems/soundSystem.js";

import { shopInfo } from "./state.js";
import {
  enterProductsPage,
  canEnterPricingFromProducts
} from "./pages/products.js";
import { enterPricingPage } from "./pages/pricing.js";

// modals
import { initEditProfileModal } from "./modals/editProfile.js";
import { initDayOverlay } from "./modals/dayOverlay.js";
import { initShippingRestockModal } from "./modals/shippingRestock.js";

// help cards
import { initHelpCards } from "./systems/helpCards.js";

// server
import {
  initRealtimeSync,
  startRealtimeGameSync
} from "./systems/realtimeSync.js";

function safe(label, fn) {
  try {
    fn();
  } catch (e) {
    console.error(`[BOOT] ${label}`, e);
  }
}

/* =============================
   STABLE APP HEIGHT
   Prevents mobile touch hitbox drift
============================= */

let appHeightLocked = false;
let appHeightTimer = null;

function isMobileLayout() {
  return window.matchMedia("(max-width: 460px)").matches;
}

function syncAppHeight(force = false) {
  const mobile = isMobileLayout();

  /*
    On mobile, do NOT keep changing --app-height during gameplay.
    Mobile browsers resize their viewport when the address bar moves,
    and that can make taps feel lower than the visible UI.
  */
  if (mobile && appHeightLocked && !force) {
    return;
  }

  const height = Math.round(window.innerHeight);
  document.documentElement.style.setProperty("--app-height", `${height}px`);

  if (mobile) {
    appHeightLocked = true;
  }
}

function syncAppHeightSoon(force = false, delay = 0) {
  if (appHeightTimer) {
    clearTimeout(appHeightTimer);
    appHeightTimer = null;
  }

  appHeightTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      syncAppHeight(force);
    });
  }, delay);
}

// Initial height lock before DOM is fully ready.
syncAppHeight(true);

// Desktop resize can update normally. Mobile resize should not.
window.addEventListener("resize", () => {
  if (!isMobileLayout()) {
    syncAppHeightSoon(true);
  }
});

// Only recalculate on orientation change because the screen truly changed.
window.addEventListener("orientationchange", () => {
  appHeightLocked = false;
  syncAppHeightSoon(true, 350);
});

// If browser restores page from cache, refresh once safely on desktop.
window.addEventListener("pageshow", () => {
  if (!isMobileLayout()) {
    syncAppHeightSoon(true);
  }
});

/*
  IMPORTANT:
  Do NOT add a visualViewport resize listener here.
  visualViewport resize is one of the causes of mid-game hitbox drift.
*/

/* =============================
   GLOBAL RAPID TAP GUARD
   Blocks aggressive double/triple taps from triggering browser weirdness
============================= */

let lastTouchEndTime = 0;
let lastTouchEndX = 0;
let lastTouchEndY = 0;

document.addEventListener(
  "touchend",
  (e) => {
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const now = Date.now();
    const x = touch.clientX;
    const y = touch.clientY;

    const timeSinceLastTap = now - lastTouchEndTime;
    const distance = Math.hypot(x - lastTouchEndX, y - lastTouchEndY);

    /*
      Blocks rapid repeated taps in almost the same spot.
      This is the exact pattern that can cause viewport/hitbox drift.
    */
    if (timeSinceLastTap < 320 && distance < 24) {
      e.preventDefault();
      e.stopPropagation();
    }

    lastTouchEndTime = now;
    lastTouchEndX = x;
    lastTouchEndY = y;
  },
  { passive: false, capture: true }
);

/* =============================
   BUTTON SPAM LOCK
   Prevents one button from firing multiple actions instantly
============================= */

document.addEventListener(
  "pointerdown",
  (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.disabled) return;
    if (btn.getAttribute("aria-disabled") === "true") return;

    const now = Date.now();
    const last = Number(btn.dataset.lastPointerDownAt) || 0;

    if (now - last < 180) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    btn.dataset.lastPointerDownAt = String(now);
  },
  { capture: true, passive: false }
);

/* =============================
   STEP LINKS
============================= */

function initStepLinks() {
  document.querySelectorAll(".step-link").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();

      const target = btn.getAttribute("data-step");

      // Must choose profile before Step 2 or Step 3.
      if ((target === "products" || target === "pricing") && !shopInfo.name) {
        const msg = document.getElementById("setupMessage");
        if (msg) msg.textContent = "PLEASE SELECT A PROFILE FIRST!";
        return;
      }

      if (target === "setup") {
        showPage("pageSetup");
        return;
      }

      if (target === "products") {
        enterProductsPage();
        return;
      }

      if (target === "pricing") {
        // If player tries to jump to Step 3, force Step 2 validation first.
        enterProductsPage();

        requestAnimationFrame(() => {
          if (!canEnterPricingFromProducts()) return;
          enterPricingPage();
        });

        return;
      }
    };
  });
}

function initNavBadges() {
  const ordersBtn = document.getElementById("navOrders");
  const chatBtn = document.getElementById("navChat");

  if (ordersBtn && !document.getElementById("navOrdersBadge")) {
    ordersBtn.insertAdjacentHTML(
      "beforeend",
      `<span id="navOrdersBadge" class="navBadge">0</span>`
    );
  }

  if (chatBtn && !document.getElementById("navChatBadge")) {
    chatBtn.insertAdjacentHTML(
      "beforeend",
      `<span id="navChatBadge" class="navBadge">0</span>`
    );
  }
}

/* =============================
   WINDOW MODE
============================= */

function applyWindowMode() {
  const params = new URLSearchParams(window.location.search);
  const isManagerWindow = params.get("manager") === "1";

  const appRoot = document.getElementById("appRoot");
  const body = document.body;

  if (isManagerWindow) {
    body.classList.add("managerWindowBody");
    appRoot?.classList.add("managerApp");
    appRoot?.classList.remove("app");
  } else {
    body.classList.remove("managerWindowBody");
    appRoot?.classList.remove("managerApp");
    appRoot?.classList.add("app");
  }

  return isManagerWindow;
}

/* =============================
   INIT
============================= */

function init() {
  const isManagerWindow = applyWindowMode();

  // Lock height again after DOM is ready.
  syncAppHeight(true);

  // Realtime should run for both:
  // - game sends data
  // - manager receives data
  safe("initRealtimeSync", initRealtimeSync);

  if (isManagerWindow) {
    // Manager window should NOT initialize game pages, camera, nav, help cards, etc.
    safe("initManagerPage", initManagerPage);

    hideNavBar();
    enterManagerPage();
    return;
  }

  // Normal game page only.
  safe("startRealtimeGameSync", startRealtimeGameSync);

  safe("initToast", initToast);

  safe("initGlobalSoundStopper", initGlobalSoundStopper);

  safe("initButtonClickSound", initButtonClickSound);
  safe("initOrderActionSounds", initOrderActionSounds);

  safe("initNav", initNav);
  safe("initNavBadges", initNavBadges);

  safe("initStartPage", initStartPage);
  safe("initTutorialPage", initTutorialPage);
  safe("initSetupPage", initSetupPage);
  safe("initProductsPage", initProductsPage);
  safe("initPricingPage", initPricingPage);
  safe("initMarketingPage", initMarketingPage);
  safe("initOrdersPage", initOrdersPage);
  safe("initStoragePage", initStoragePage);

  safe("initEditProfileModal", initEditProfileModal);
  safe("initDayOverlay", initDayOverlay);
  safe("initShippingRestockModal", initShippingRestockModal);

  safe("initHelpCards", initHelpCards);
  safe("initStepLinks", initStepLinks);

  hideNavBar();
  showPage("pageStart");
}

document.addEventListener("DOMContentLoaded", init);

/* =============================
   HOLD / SELECTION PREVENTION
============================= */

document.addEventListener("contextmenu", (e) => {
  const holdButton = e.target.closest(
    ".inventoryStepBtn, .pricingVerticalBtn, .storageMiniArrowBtn, .stepBtn"
  );

  if (holdButton) {
    e.preventDefault();
  }
});

document.addEventListener("selectstart", (e) => {
  const holdArea = e.target.closest(
    ".inventoryQtyRow, .pricingStepperCol, .storagePriceStepper, .storageQtyRow, .stepper"
  );

  if (holdArea) {
    e.preventDefault();
  }
});