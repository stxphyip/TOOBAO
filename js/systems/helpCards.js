import { el } from "../dom.js";
import { gameState, shopInfo } from "../state.js";
import {
  randInt,
  formatTime,
  clamp,
  addViewsAndConvertFollowers,
  syncStoreLevelFromFollowers
} from "../utils.js";
import { showAlgoToast } from "./toast.js";
import { renderHud, buildHomePage } from "../pages/home.js";
import { getHomeProducts } from "../store/productsStore.js";
import {
  beginGhostInfluencerLivestream,
  endGhostInfluencerLivestream
} from "../pages/marketing.js";
import {
  addRandomOrderFromSelectedProducts,
  packOrder,
  shipOrder,
  collectRevenue,
  refundOrder
} from "./ordersSystem.js";
import { getThreads, submitPlayerReply, markThreadRead, refreshChatNavBadge } from "./messagesSystem.js";
import { openInsufficientFundsModal, openConfirmDeclineModal } from "../modals/popup.js";

const HELP_APPEAR_MIN_MS = 30000;
const HELP_APPEAR_MAX_MS = 100000;
const OFFER_RESPONSE_MS = 15000;
const HELP_FIRST_HOME_DELAY_MS = 60000;


const MRBAO_SOUND_BASE = "assets/mrbao_sounds/";

const HELP_POPUP_VOICE_SRC = `${MRBAO_SOUND_BASE}doyouneedsomehelp3.mp3`;
const HELP_DECLINE_VOICE_SRC = `${MRBAO_SOUND_BASE}areyousureaboutthat3.mp3`;

const HELP_VOICE_VOLUME = 1;
const HELP_VOICE_DELAY_MS = 250;
const HELP_VOICE_PLAY_MS = 2500;

let helpVoiceAudio = null;
let helpVoiceTimer = null;
let helpVoiceUnlocked = false;

const NEW_PRODUCT_POOL = [
  {
    id: "lafufu",
    name: "LAFUFU",
    img: "assets/newproducts/lafufu.png",
    qtyRange: [3, 8],
    priceRange: [40, 192]
  },
  {
    id: "slime",
    name: "SLIME",
    img: "assets/newproducts/slime.png",
    qtyRange: [4, 10],
    priceRange: [38, 168]
  },
  {
    id: "pet_rock",
    name: "PET ROCK",
    img: "assets/newproducts/petrock.png",
    qtyRange: [2, 6],
    priceRange: [40, 160]
  }
];

const HELP_DEFS = [
  {
  id: "shipping_boxes",
  title: "SHIPPING BOX BUNDLE DEAL!",
  image: "assets/helpcards/shippingboxesbundle.png",
  instant: true,
  targetPage: "home",

  // Cost is now calculated from box amount, so this is mostly fallback.
  costRange: [10, 90],

  // New: random bundle size
  boxQtyRange: [20, 50],

  rewardFollowers: [20, 100],
  rewardViews: [120, 260],
  buildDescription: (offer) =>
    `YOUR MANUFACTURER IS OFFERING YOU A LIMITED BUNDLE DEAL OF <b>${offer.boxQty}</b> BOXES FOR ${coinInline(offer.cost)}.`
},
  {
    id: "new_product",
    title: "NEW PRODUCT LAUNCH!",
    image: "assets/helpcards/newproductlaunch.png",
    instant: true,
    targetPage: "home",
    costRange: [55, 150],
    rewardFollowers: [20, 90],
    rewardViews: [80, 240],
    buildDescription: (offer) =>
      `A RARE NEW ${offer.launchProductName} JUST DROPPED. BUY <b>${offer.launchQty}</b> UNITS FOR ${coinInline(offer.cost)}. EACH UNIT WILL SELL FOR ${coinInline(offer.launchPrice)} AND WILL MAKE YOUR STORE MORE APPEALING!`
  },
  {
    id: "store_assistant",
    title: "HIRE A STORE ASSISTANT!",
    image: "assets/helpcards/storemanager.png",
    durationMs: 45000,
    targetPage: "home",
    blocking: false,
    costRange: [30, 105],
    rewardFollowers: [25, 40],
    rewardViews: [140, 200],
    helperTimeRangeSec: [35, 50],
    buildDescription: () =>
      `HIRE A TEMPORARY STORE ASSISTANT TO HELP YOU MANAGE YOUR PRODUCTS. THEY WILL RESTOCK YOUR PRODUCT INVENTORY AND BOXES FOR YOU.`
  },
  {
    id: "livestreamer",
    title: "RARE INFLUENCER BRAND COLLAB!",
    image: "assets/helpcards/influencer.png",
    durationMs: 30000,
    targetPage: "marketing",
    blocking: true,
    costRange: [62, 145],
    rewardFollowers: [30, 60],
    rewardViews: [350, 500],
    helperTimeRangeSec: [25, 40],
    buildDescription: () =>
      `WOW! AN INFLUENCER WANTS TO COLLAB WITH YOU AND MARKET YOUR PRODUCTS ON LIVESTREAM. THIS WILL BRING LOTS OF VIEWS TO YOUR STORE.`
  },
  {
    id: "coupons",
    title: "SEND OUT COUPONS TO YOUR LOYAL CUSTOMERS!",
    image: "assets/helpcards/coupons.png",
    durationMs: 40000,
    targetPage: "home",
    blocking: false,
    costRange: [42, 142],
    rewardFollowers: [20, 40],
    rewardViews: [120, 220],
    helperTimeRangeSec: [45, 60],
    buildDescription: (offer) =>
      `SEND OUT ${coinInline(2)} OFF COUPONS TO YOUR CUSTOMERS FOR <b>${offer.helperTimeSec} SECONDS</b>. THIS WILL ENTICE MORE CUSTOMERS TO SHOP AT YOUR STORE AT A CHEAPER PRICE.`
  },
  {
    id: "discount_festival",
    title: "SALE FESTIVAL STARTS TODAY!",
    image: "assets/helpcards/salefestival.png",
    durationMs: 25000,
    targetPage: "home",
    blocking: false,
    meta: { discountFlat: 5 },
    costRange: [12, 26],
    rewardFollowers: [25, 90],
    rewardViews: [220, 480],
    helperTimeRangeSec: [20, 35],
    buildDescription: (offer) =>
      `DISCOUNT YOUR PRODUCTS BY ${coinInline(5)} OFF FOR <b>${offer.helperTimeSec} SECONDS</b>. THIS WILL INCREASE YOUR PRODUCT VIEWS AND GIVE YOUR STORE A COMPETITIVE EDGE.`
  },
  {
    id: "order_manager",
    title: "HIRE A SUPER FAST ORDER PACKER!",
    image: "assets/helpcards/ordermanager.png",
    durationMs: 40000,
    targetPage: "orders",
    blocking: true,
    costRange: [54, 162],
    rewardFollowers: [40, 80],
    rewardViews: [150, 300],
    helperTimeRangeSec: [25, 45],
    buildDescription: () =>
      `HIRE AN ORDER MANAGER TO HELP YOU COMPLETE YOUR ORDERS. THIS CAN INCREASE DELIVERY SPEED AND CUSTOMER SATISFACTION.`
  },
  {
    id: "chat_manager",
    title: "HIRE A CUSTOMER SERVICE WORKER!",
    image: "assets/helpcards/customerservice.png",
    durationMs: 40000,
    targetPage: "chat",
    blocking: true,
    costRange: [48, 194],
    rewardFollowers: [30, 80],
    rewardViews: [120, 300],
    helperTimeRangeSec: [35, 60],
    buildDescription: () =>
      `HIRE A CUSTOMER SERVICE WORKER TO HELP ANSWER CUSTOMER CHATS, INCREASING CHAT SPEED AND REDUCING CUSTOMER COMPLAINTS.`
  }
];

const HELPER_OVERLAY_META = {
  store_assistant: {
    title: "STORE ASSISTANT WORKING!",
    text: "STORE INVENTORY IS BEING HANDLED AUTOMATICALLY...",
    image: "assets/helpcards/storemanager.png"
  },
  coupons: {
    title: "COUPONS SENT OUT!",
    text: "COUPONS ARE BEING SENT OUT TO CUSTOMERS...",
    image: "assets/helpcards/coupons.png"
  },
  discount_festival: {
    title: "SALE FESTIVAL STARTING!",
    text: "PRODUCTS ARE DISCOUNTED AT 5 OFF...",
    image: "assets/helpcards/salefestival.png"
  },
  livestreamer: {
    title: "INFLUENCER LIVESTREAMING!",
    text: "INFLUENCER IS LIVESTREAMING FOR YOU...",
    image: "assets/helpcards/influencer.png"
  },
  order_manager: {
    title: "ORDER PACKER WORKING!",
    text: "ORDERS ARE BEING PACKED AUTOMATICALLY...",
    image: "assets/helpcards/ordermanager.png"
  },
  chat_manager: {
    title: "CUSTOMER SERVICE WORKING!",
    text: "CHATS ARE BEING ANSWERED AUTOMATICALLY...",
    image: "assets/helpcards/customerservice.png"
  }
};

/**
 * FIXED: Force whole numbers for all coin displays to avoid decimals during festivals
 */
function formatCoins(amount) {
  return String(Math.floor(Number(amount) || 0));
}

function coinInline(amount) {
  return `
    <span class="helpInlineCoinWrap">
      <img src="assets/ui_icons/coin_icon.png" class="helpInlineCoinIcon" alt="">
      <span>${formatCoins(amount)}</span>
    </span>
  `;
}

function toastIcon(src, className = "toastRewardIcon") {
  return `<img src="${src}" class="${className}" alt="">`;
}

function buildHelperRewardToast(helperTitle, views, followers) {
  return `
    ${helperTitle} FINISHED!
    + ${views} VIEWS 
      <span class="toastRewardIconWrap">
        <img src="assets/ui_icons/views_icon.png" alt="">
      </span>
    + ${followers} FOLLOWERS 
      <span class="toastRewardIconWrap">
        <img src="assets/ui_icons/followers_icon.png" alt="">
      </span>
  `;
}

function ensureHelpState() {
  if (!gameState.helpCards) {
    gameState.helpCards = {
      pendingOffer: null,
      active: null,

      // Do not schedule the first offer until the player enters Home
      homeTimerStartedAt: null,
      nextOfferAt: Number.POSITIVE_INFINITY,

      offerTimer: null,
      offerDeadlineAt: 0,
      lastFinishedOffer: null,
      shownOfferIds: []
    };
  }

  if (!Array.isArray(gameState.helpCards.shownOfferIds)) {
    gameState.helpCards.shownOfferIds = [];
  }

  if (typeof gameState.helpCards.homeTimerStartedAt === "undefined") {
    gameState.helpCards.homeTimerStartedAt = null;
  }

  if (typeof gameState.helpCards.nextOfferAt !== "number") {
    gameState.helpCards.nextOfferAt = Number.POSITIVE_INFINITY;
  }

  if (typeof gameState.helpCards.offerTimer === "undefined") {
    gameState.helpCards.offerTimer = null;
  }

  if (typeof gameState.helpCards.offerDeadlineAt !== "number") {
    gameState.helpCards.offerDeadlineAt = 0;
  }

  if (typeof gameState.helpCards.lastFinishedOffer === "undefined") {
    gameState.helpCards.lastFinishedOffer = null;
  }
}

function isHomePageVisible() {
  return el.pageHome?.classList.contains("show");
}

function startHelpTimerAfterHomeIfNeeded() {
  ensureHelpState();

  if (gameState.helpCards.homeTimerStartedAt) return;
  if (!gameState.running || gameState.ended) return;
  if (!isHomePageVisible()) return;

  const now = Date.now();

  gameState.helpCards.homeTimerStartedAt = now;

  // First offer appears only after at least 1 minute on Home,
  // plus a small random delay so it does not feel instant.
  gameState.helpCards.nextOfferAt = now + HELP_FIRST_HOME_DELAY_MS;
}

function canShowHelpCardsNow() {
  ensureHelpState();
  startHelpTimerAfterHomeIfNeeded();

  if (!gameState.helpCards.homeTimerStartedAt) return false;

  return Date.now() >= gameState.helpCards.homeTimerStartedAt + HELP_FIRST_HOME_DELAY_MS;
}

function clearOfferTimer() {
  ensureHelpState();

  if (gameState.helpCards.offerTimer) {
    clearInterval(gameState.helpCards.offerTimer);
    gameState.helpCards.offerTimer = null;
  }

  gameState.helpCards.offerDeadlineAt = 0;
}

function scheduleNextOffer() {
  ensureHelpState();
  gameState.helpCards.nextOfferAt =
    Date.now() + randInt(HELP_APPEAR_MIN_MS, HELP_APPEAR_MAX_MS);
}

function pickRandomHelpDef() {
  ensureHelpState();

  const shown = gameState.helpCards.shownOfferIds || [];
  const available = HELP_DEFS.filter((def) => !shown.includes(def.id));

  if (!available.length) return null;

  return available[randInt(0, available.length - 1)];
}

function pickRandomNewLaunchProduct() {
  return NEW_PRODUCT_POOL[randInt(0, NEW_PRODUCT_POOL.length - 1)];
}

function ensureChosenProductsArray() {
  if (!Array.isArray(shopInfo.chosenProducts)) {
    shopInfo.chosenProducts = [];
  }
}

function makeUniqueProductId(baseId) {
  return `${baseId}_${Date.now()}_${randInt(100, 999)}`;
}

function findLowestStockProduct() {
  const list = getHomeProducts()
    .slice()
    .sort((a, b) => (a.qty || 0) - (b.qty || 0));
  return list[0] || null;
}

function getHelperEls() {
  return {
    homeBar: document.getElementById("homeHelperBar"),
    marketingOverlay: document.getElementById("marketingHelperOverlay"),
    ordersOverlay: document.getElementById("ordersHelperOverlay"),
    chatOverlay: document.getElementById("chatHelperOverlay")
  };
}

function refreshHelperOverlaySoon() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateHelperUI();
    });
  });
}

function awardCompletionViews(helperTitle = "Helper") {
  const active = gameState.helpCards?.lastFinishedOffer;

  const gain =
    active?.rewardViews != null ? Number(active.rewardViews) : randInt(220, 420);

  const followerBonus =
    active?.rewardFollowers != null
      ? Number(active.rewardFollowers)
      : randInt(25, 70);

  addViewsAndConvertFollowers(gameState, gain);

  gameState.followers = Math.max(
    0,
    (Number(gameState.followers) || 0) + followerBonus
  );

  syncStoreLevelFromFollowers(gameState);

  renderHud();

  const currentActive = gameState.helpCards?.active;
  if (currentActive && currentActive.targetPage === "home") {
    updateHelperUI();
  } else {
    buildHomePage();
  }

  showAlgoToast(
    `${helperTitle} FINISHED! + ${gain} VIEWS + ${followerBonus} FOLLOWERS`,
    "MR. BAO",
    null,
    3600,
    null,
    "views_followers"
  );
}

function makeOfferFromDef(def) {
  const cost = randInt(def.costRange[0], def.costRange[1]);
  const rewardFollowers = randInt(def.rewardFollowers[0], def.rewardFollowers[1]);
  const rewardViews = randInt(def.rewardViews[0], def.rewardViews[1]);

  let helperTimeSec = null;
  if (Array.isArray(def.helperTimeRangeSec)) {
    helperTimeSec = randInt(def.helperTimeRangeSec[0], def.helperTimeRangeSec[1]);
  }

  const offer = {
    ...def,
    cost,
    rewardFollowers,
    rewardViews,
    helperTimeSec
  };
  
  if (def.id === "shipping_boxes") {
  const boxQty = randInt(def.boxQtyRange[0], def.boxQtyRange[1]);

  // Reasonable bundle pricing:
  // about 0.45–0.60 coins per box, rounded down
  const pricePerBoxCents = randInt(45, 60);
  const calculatedCost = Math.floor((boxQty * pricePerBoxCents) / 100);

  offer.boxQty = boxQty;
  offer.cost = Math.max(12, calculatedCost);
}

  if (def.id === "new_product") {
    const template = pickRandomNewLaunchProduct();
    const launchQty = randInt(template.qtyRange[0], template.qtyRange[1]);
    const launchPrice = randInt(template.priceRange[0], template.priceRange[1]);

    offer.launchProductId = template.id;
    offer.launchProductName = template.name;
    offer.launchProductImg = template.img;
    offer.launchQty = launchQty;
    offer.launchPrice = launchPrice;
    offer.image = template.img;
  }

  offer.description = def.buildDescription(offer);
  return offer;
}

function getOfferResponseSecondsLeft() {
  ensureHelpState();

  if (!gameState.helpCards.offerDeadlineAt) return 0;

  return Math.max(
    0,
    Math.ceil((gameState.helpCards.offerDeadlineAt - Date.now()) / 1000)
  );
}

function buildTopTimerHtml(secondsLeft) {
  return `
    <span class="helpTimerIcon" aria-hidden="true"></span>
    <span class="helpOfferTopTimerValue">${secondsLeft} SECONDS LEFT</span>
  `;
}

function buildTimeValueHtml(seconds) {
  const safeSeconds = Number(seconds) || 0;

  return `
    <span class="helpOfferSmallIcon helpTimeBgIcon" aria-hidden="true"></span>
    <span class="helpOfferTimeNumber">${safeSeconds} SECONDS</span>
  `;
}

function buildOfferMarkup(offer) {
  const timeLeft = getOfferResponseSecondsLeft();
  const hasHelperTime = true;

  return `
    <div class="helpPhonePopup">
      <img class="helpPhonePopupBg" src="assets/helpcards/phonepopup.png" alt="">
      <div class="helpPhoneInner">
        <div class="helpOfferTopTimer" id="helpOfferTopTimer">
          ${buildTopTimerHtml(timeLeft)}
        </div>

        <div class="helpOfferTitle">${offer.title}</div>

        <div class="helpOfferImageWrap">
          <img
            class="helpOfferImage"
            src="${offer.image}"
            alt="${offer.title}"
            onerror="this.style.display='none'; this.parentElement.classList.add('is-placeholder');"
          >
        </div>

        <div class="helpOfferDesc">${offer.description}</div>

        <div class="helpOfferMeta">
          <div class="helpOfferMetaRow">
            <span class="helpOfferMetaLabel">COST:</span>
            <span class="helpOfferMetaValue helpOfferMetaValue--cost">
              <img src="assets/ui_icons/coin_icon.png" class="helpOfferSmallIcon" alt="">
              ${formatCoins(offer.cost)}
            </span>
          </div>

          <div class="helpOfferMetaRow ${hasHelperTime ? "" : "helpOfferMetaRow--hidden"}">
            <span class="helpOfferMetaLabel">TIME:</span>
            <span class="helpOfferMetaValue helpOfferMetaValue--time">
              ${buildTimeValueHtml(offer.helperTimeSec)}
            </span>
          </div>

          <div class="helpOfferMetaRow">
            <span class="helpOfferMetaLabel">REWARD:</span>
            <span class="helpOfferRewards">
              <span class="helpOfferRewardItem">
                <img src="assets/ui_icons/followers_icon.png" class="helpOfferSmallIcon" alt="">
                ${offer.rewardFollowers} FOLLOWERS
              </span>
              <span class="helpOfferRewardItem">
                <img src="assets/ui_icons/views_icon.png" class="helpOfferSmallIcon" alt="">
                ${offer.rewardViews} VIEWS
              </span>
            </span>
          </div>
        </div>

        <div class="helpOfferButtons">
          <button class="helpOfferBtn" id="helpDeclineBtn" type="button">
            <img src="assets/helpcards/declinebutton.png" alt="Decline">
          </button>
          <button class="helpOfferBtn" id="helpAcceptBtn" type="button">
            <img src="assets/helpcards/acceptbutton.png" alt="Accept">
          </button>
        </div>
      </div>
    </div>
  `;
}

function startOfferResponseTimer() {
  ensureHelpState();
  clearOfferTimer();

  gameState.helpCards.offerDeadlineAt = Date.now() + OFFER_RESPONSE_MS;

  function updateOfferTimerText() {
    const left = getOfferResponseSecondsLeft();
    const timerNode = document.getElementById("helpOfferTopTimer");

    if (timerNode) {
      let valueEl = timerNode.querySelector(".helpOfferTopTimerValue");

      // Create the text span once, without replacing the time icon
      if (!valueEl) {
        valueEl = document.createElement("span");
        valueEl.className = "helpOfferTopTimerValue";
        timerNode.appendChild(valueEl);
      }

      valueEl.textContent = `${left} SECONDS LEFT`;
    }

    if (left <= 0) {
      declinePendingOffer(true);
    }
  }

  updateOfferTimerText();

  gameState.helpCards.offerTimer = setInterval(updateOfferTimerText, 250);
}

function getHelpVoiceAudio() {
  if (!helpVoiceAudio) {
    helpVoiceAudio = new Audio();
    helpVoiceAudio.preload = "auto";
    helpVoiceAudio.loop = false;
    helpVoiceAudio.volume = HELP_VOICE_VOLUME;
  }

  return helpVoiceAudio;
}

function unlockHelpVoiceOnce() {
  if (helpVoiceUnlocked) return;

  const audio = getHelpVoiceAudio();

  audio.src = HELP_POPUP_VOICE_SRC;
  audio.volume = 0;
  audio.currentTime = 0;

  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = HELP_VOICE_VOLUME;
      helpVoiceUnlocked = true;
    })
    .catch(() => {
      audio.volume = HELP_VOICE_VOLUME;
    });
}

document.addEventListener(
  "pointerdown",
  () => {
    unlockHelpVoiceOnce();
  },
  { once: true }
);

function stopHelpVoice() {
  if (helpVoiceTimer) {
    clearTimeout(helpVoiceTimer);
    helpVoiceTimer = null;
  }

  if (!helpVoiceAudio) return;

  helpVoiceAudio.pause();
  helpVoiceAudio.currentTime = 0;
}

function playHelpVoice(src, delayMs = HELP_VOICE_DELAY_MS) {
  if (!src) return;

  stopHelpVoice();

  const soundVersion = Number(window.__toobaoSoundStopVersion) || 0;

  helpVoiceTimer = setTimeout(() => {
    if ((Number(window.__toobaoSoundStopVersion) || 0) !== soundVersion) {
      return;
    }

    const audio = getHelpVoiceAudio();

    audio.src = src;
    audio.volume = HELP_VOICE_VOLUME;
    audio.currentTime = 0;

    audio.play().catch((err) => {
      console.warn("[HelpCards] Mr. Bao voice blocked:", err);
    });

    helpVoiceTimer = setTimeout(() => {
      stopHelpVoice();
    }, HELP_VOICE_PLAY_MS);
  }, delayMs);
}

function playHelpPopupVoice() {
  playHelpVoice(HELP_POPUP_VOICE_SRC);
}

function playHelpDeclineVoice() {
  playHelpVoice(HELP_DECLINE_VOICE_SRC, 0);
}

function showOfferModal(offer) {
  if (!el.helpCardOverlay) return;

  el.helpCardOverlay.innerHTML = buildOfferMarkup(offer);
  el.helpCardOverlay.classList.remove("hidden");

  const declineBtn = document.getElementById("helpDeclineBtn");
  const acceptBtn = document.getElementById("helpAcceptBtn");

  if (declineBtn) declineBtn.onclick = () => declinePendingOffer(false);
  if (acceptBtn) acceptBtn.onclick = () => acceptPendingOffer();

  startOfferResponseTimer();

  // Mr. Bao: "Do you need some help?"
  playHelpPopupVoice();
}

function hideOfferModal() {
  clearOfferTimer();
  stopHelpVoice();

  if (!el.helpCardOverlay) return;

  el.helpCardOverlay.classList.add("hidden");
  el.helpCardOverlay.innerHTML = "";
}

function canAfford(cost) {
  return (Number(gameState.revenue) || 0) >= cost - 1e-9;
}

function spend(cost) {
  gameState.revenue = Math.max(0, (Number(gameState.revenue) || 0) - cost);
}



function buildGhostOverlayMarkup(active, timeText, pct) {
  const meta = HELPER_OVERLAY_META[active.id];
  if (!meta) return "";

  return `
    <div class="pageGhostCard" data-helper-id="${active.id}">
      <img class="pageGhostCardBg" src="assets/helpcards/ghostoverlayblock.png" alt="">
      <div class="pageGhostInner">
        <div class="pageGhostTitle">${meta.title}</div>

        <div class="pageGhostImageWrap">
          <img
            class="pageGhostImage"
            src="${meta.image}"
            alt="${meta.title}"
            onerror="this.style.display='none';"
          >
        </div>

        <div class="pageGhostBottomRow">
          <div class="pageGhostText">${meta.text}</div>

          <div class="pageGhostTimer">
  <span class="pageGhostTimerIcon" aria-hidden="true"></span>
  <span class="pageGhostTimerValue">${timeText}</span>
</div>
        </div>

        <div class="pageGhostProgressTrack">
          ${buildGhostProgressFill(pct)}
        </div>
      </div>
    </div>
  `;
}

function buildGhostProgressFill(percent) {
  const safePct = clamp(percent, 0, 100);
  const innerWidth = 347;
  const fillWidth = Math.round((safePct / 100) * innerWidth);

  return `
    <div class="pageGhostProgressFill" style="width:${fillWidth}px"></div>
  `;
}

function patchGhostOverlay(container, active, timeText, pct) {
  if (!container) return;

  const existing = container.querySelector(".pageGhostCard");
  const currentId = existing?.dataset?.helperId || "";
  const nextId = active.id;
  const innerWidth = 347;
  const fillWidth = Math.round((clamp(pct, 0, 100) / 100) * innerWidth);

  if (!existing || currentId !== nextId) {
    container.innerHTML = buildGhostOverlayMarkup(active, timeText, pct);
    return;
  }

  const timerValue = existing.querySelector(".pageGhostTimerValue");
  if (timerValue) {
    timerValue.textContent = timeText;
  }

  const fill = existing.querySelector(".pageGhostProgressFill");
  if (fill) {
    fill.style.width = `${fillWidth}px`;
  }
}

function hideAllHelperUI() {
  const h = getHelperEls();

  if (h.homeBar) {
    h.homeBar.classList.add("hidden");
  }

  if (h.marketingOverlay) {
    h.marketingOverlay.classList.add("hidden");
    h.marketingOverlay.classList.remove("pageHelperOverlay--scrim");
    h.marketingOverlay.innerHTML = "";
  }

  if (h.ordersOverlay) {
    h.ordersOverlay.classList.add("hidden");
    h.ordersOverlay.classList.remove("pageHelperOverlay--scrim");
    h.ordersOverlay.innerHTML = "";
  }

  if (h.chatOverlay) {
    h.chatOverlay.classList.add("hidden");
    h.chatOverlay.classList.remove("pageHelperOverlay--scrim");
    h.chatOverlay.innerHTML = "";
  }
}

function refreshChatPageForHelperUI() {
  if (!el.pageChat?.classList.contains("show")) return;
  window.__refreshChatUI?.();
}

function updateHelperUI() {
  const active = gameState.helpCards?.active;
  const h = getHelperEls();

  if (!active) {
    hideAllHelperUI();
    if (h.homeBar) {
      h.homeBar.innerHTML = "";
      h.homeBar.classList.add("hidden");
    }
    return;
  }

  const now = Date.now();
  const remainingMs = Math.max(0, active.endsAt - now);
  const totalMs = Math.max(1, active.durationMs || 1);
  const pct = clamp(((totalMs - remainingMs) / totalMs) * 100, 0, 100);
  const timeText = formatTime(Math.ceil(remainingMs / 1000));

  if (active.targetPage === "home") {
    // Clean overlays on other pages
    if (h.marketingOverlay) h.marketingOverlay.classList.add("hidden");
    if (h.ordersOverlay) h.ordersOverlay.classList.add("hidden");
    if (h.chatOverlay) h.chatOverlay.classList.add("hidden");

    const homeHost = document.getElementById("homeHelperBar");
    if (!homeHost) return;

    patchGhostOverlay(homeHost, active, timeText, pct);
    homeHost.classList.remove("hidden");
    return;
  }

  if (h.homeBar) {
    h.homeBar.classList.add("hidden");
    h.homeBar.innerHTML = "";
  }

  if (active.targetPage === "marketing" && h.marketingOverlay) {
    patchGhostOverlay(h.marketingOverlay, active, timeText, pct);
    h.marketingOverlay.classList.remove("hidden");
    h.marketingOverlay.classList.add("pageHelperOverlay--scrim");
  }

  if (active.targetPage === "orders" && h.ordersOverlay) {
    patchGhostOverlay(h.ordersOverlay, active, timeText, pct);
    h.ordersOverlay.classList.remove("hidden");
    h.ordersOverlay.classList.add("pageHelperOverlay--scrim");
  }

  if (active.targetPage === "chat" && h.chatOverlay) {
    patchGhostOverlay(h.chatOverlay, active, timeText, pct);
    h.chatOverlay.classList.remove("hidden");
    h.chatOverlay.classList.add("pageHelperOverlay--scrim");
  }
}

function activateTimedOffer(offer) {
  const durationMs = offer.durationMs || (Number(offer.helperTimeSec || 45) * 1000);

  gameState.helpCards.active = {
    ...offer,
    durationMs,
    startedAt: Date.now(),
    endsAt: Date.now() + durationMs,
    lastPulseAt: 0,
    meta: offer.meta || {}
  };

  if (offer.id === "livestreamer") {
    beginGhostInfluencerLivestream();
  }

  renderHud();

  if (offer.targetPage === "home") {
    buildHomePage();
    refreshHelperOverlaySoon();
  } else {
    updateHelperUI();
  }

}

function addNewLaunchProductToStore(offer) {
  ensureChosenProductsArray();

  const newProduct = {
    id: makeUniqueProductId(offer.launchProductId),
    name: offer.launchProductName,
    img: offer.launchProductImg,
    price: offer.launchPrice,
    qty: offer.launchQty,
    reservedQty: 0,
    sold: 0,
    recentViews: 0,
    onHome: true
  };

  shopInfo.chosenProducts.push(newProduct);
  return newProduct;
}

function applyInstantOffer(offer) {
  gameState.helpCards.lastFinishedOffer = offer;

  if (offer.id === "shipping_boxes") {
  const boxQty = Number(offer.boxQty) || 50;

  gameState.shippingMaterials =
    (Number(gameState.shippingMaterials) || 0) + boxQty;

  renderHud();
  buildHomePage();
  awardCompletionViews(offer.title);

  showAlgoToast(
    `${boxQty} shipping boxes were added to your storage.`,
    "MR. BAO",
    null,
    3600,
    "order"
  );

  return;
}

  if (offer.id === "new_product") {
    const addedProduct = addNewLaunchProductToStore(offer);

    renderHud();
    buildHomePage();
    awardCompletionViews(offer.title);

    showAlgoToast(
      `${addedProduct.name} was added to your store. Qty ${addedProduct.qty}, Price ${addedProduct.price}.`
    );
    return;
  }

  awardCompletionViews(offer.title);
}

function finishActiveHelper() {
  const active = gameState.helpCards?.active;
  if (!active) return;

  if (active.id === "livestreamer") {
    endGhostInfluencerLivestream();
  }

  gameState.helpCards.lastFinishedOffer = active;
  gameState.helpCards.active = null;

  hideAllHelperUI();

  const homeHost = document.getElementById("homeHelperBar");
  if (homeHost) {
    homeHost.innerHTML = "";
    homeHost.classList.add("hidden");
  }

  renderHud();

  if (active.targetPage === "home") {
    buildHomePage();
  }

  refreshChatPageForHelperUI();
  awardCompletionViews(active.title);
  scheduleNextOffer();
}

function acceptPendingOffer() {
  ensureHelpState();
  const offer = gameState.helpCards.pendingOffer;
  if (!offer) return;

  if (!canAfford(offer.cost)) {
    openInsufficientFundsModal("YOU DON'T HAVE ENOUGH MONEY TO ACCEPT THIS CHANCE. TRY EARNING MORE COINS.");
    return;
  }

  spend(offer.cost);
  hideOfferModal();
  gameState.helpCards.pendingOffer = null;

  if (offer.instant) {
    applyInstantOffer(offer);
    scheduleNextOffer();
    renderHud();
    return;
  }
  activateTimedOffer(offer);
}

function declinePendingOffer(isAuto = false) {
  ensureHelpState();
  if (!gameState.helpCards.pendingOffer) return;

  if (!isAuto) {
    playHelpDeclineVoice();

    openConfirmDeclineModal(() => {
      executeDecline();
    });
  } else {
    executeDecline(true);
  }
}

function executeDecline(isAuto = false) {
  const title = gameState.helpCards.pendingOffer?.title || "Offer";

  hideOfferModal();
  gameState.helpCards.pendingOffer = null;
  scheduleNextOffer();

  if (isAuto) {
    showAlgoToast(`${title} expired and was automatically declined.`);
  }
}

function maybeSpawnOffer() {
  ensureHelpState();

  if (!gameState.running || gameState.ended) return;
  if (gameState.helpCards.active) return;
  if (gameState.helpCards.pendingOffer) return;

  if (window.__starLevelPopupOpen) return;
  if (document.getElementById("starLevelPopupOverlay")) return;

  // First help card cannot appear until 1 minute after entering Home
  if (!canShowHelpCardsNow()) return;

  if (Date.now() < gameState.helpCards.nextOfferAt) return;

  const def = pickRandomHelpDef();

  if (!def) {
    return;
  }

  const offer = makeOfferFromDef(def);

  gameState.helpCards.shownOfferIds.push(def.id);
  gameState.helpCards.pendingOffer = offer;

  showOfferModal(offer);
}

function pulseManufacturer(active) {
  if (Date.now() - active.lastPulseAt < 5000) return;
  active.lastPulseAt = Date.now();

  const target = findLowestStockProduct();

  if (target) {
    target.qty = Math.min(100, (Number(target.qty) || 0) + 3);
  }

  // Store assistant also restocks shipping boxes
  gameState.shippingMaterials = Math.min(
    999,
    (Number(gameState.shippingMaterials) || 0) + 3
  );

  renderHud();
  refreshHelperOverlaySoon();
}


function pulseLivestreamer(active) {
  if (Date.now() - active.lastPulseAt < 2000) return;
  active.lastPulseAt = Date.now();

  addViewsAndConvertFollowers(gameState, randInt(18, 32));
  gameState.followers = (Number(gameState.followers) || 0) + randInt(2, 5);

  if (Math.random() < 0.45) {
    addRandomOrderFromSelectedProducts();
  }

  renderHud();
  updateHelperUI();
}

function pulseCoupons(active) {
  if (Date.now() - active.lastPulseAt < 4000) return;
  active.lastPulseAt = Date.now();

  addViewsAndConvertFollowers(gameState, randInt(12, 20));

  if (Math.random() < 0.35) {
    addRandomOrderFromSelectedProducts();
  }

  renderHud();
  refreshHelperOverlaySoon();
}

function pulseDiscountFestival(active) {
  if (Date.now() - active.lastPulseAt < 3000) return;
  active.lastPulseAt = Date.now();

  addViewsAndConvertFollowers(gameState, randInt(10, 16));

  if (Math.random() < 0.28) {
    addRandomOrderFromSelectedProducts();
  }

  renderHud();
  refreshHelperOverlaySoon();
}

function pulseOrderManager(active) {
  if (Date.now() - active.lastPulseAt < 2000) return;
  active.lastPulseAt = Date.now();

  const orders = gameState.orders || [];

  const refund = orders.find((o) => o.status === "REFUND_REQUESTED");
  if (refund) {
    refundOrder(refund.id);
    updateHelperUI();
    return;
  }

  const delivered = orders.find((o) => o.status === "DELIVERED");
  if (delivered) {
    collectRevenue(delivered.id);
    updateHelperUI();
    return;
  }

  const packed = orders.find((o) => o.status === "PACKED");
  if (packed) {
    shipOrder(packed.id);
    updateHelperUI();
    return;
  }

  const fresh = orders.find((o) => o.status === "NEW");
  if (fresh) {
    packOrder(fresh.id);
    updateHelperUI();
  }
}

function pulseChatManager(active) {
  if (Date.now() - active.lastPulseAt < 4000) return;
  active.lastPulseAt = Date.now();

  const threads = getThreads().filter((t) => t.status === "open");
  const thread = threads[0];
  if (!thread) return;

  const pending = (thread.pendingQueue || []).find((p) => !p.resolved);
  if (!pending) return;

  const reply =
    Array.isArray(pending.acceptableKeywords) && pending.acceptableKeywords.length
      ? pending.acceptableKeywords[0]
      : "yes";

  submitPlayerReply(thread.id, reply);

  const updatedThread = getThreads().find((t) => t.id === thread.id);
  if (updatedThread && updatedThread.status !== "open") {
    markThreadRead(updatedThread.id);
    refreshChatNavBadge();
  }

  updateHelperUI();
  window.__refreshChatUI?.();
}

function runActiveHelperEffects() {
  const active = gameState.helpCards?.active;
  if (!active) return;

  if (Date.now() >= active.endsAt) {
    finishActiveHelper();
    return;
  }

  if (active.id === "store_assistant") pulseManufacturer(active);
  if (active.id === "manufacturer") pulseManufacturer(active);
  if (active.id === "livestreamer") pulseLivestreamer(active);
  if (active.id === "coupons") pulseCoupons(active);
  if (active.id === "discount_festival") pulseDiscountFestival(active);
  if (active.id === "order_manager") pulseOrderManager(active);
  if (active.id === "chat_manager") pulseChatManager(active);

  updateHelperUI();
}

export function initHelpCards() {
  ensureHelpState();
  hideAllHelperUI();
  hideOfferModal();
  updateHelperUI();
}

export function tickHelpCards() {
  ensureHelpState();
  maybeSpawnOffer();
  runActiveHelperEffects();
}

/**
 * FIXED: Re-binds the helper bar to the DOM when navigating back to Home
 */
window.refreshActiveHelperUI = function () {
  const active = gameState.helpCards?.active;
  if (!active) return;

  const now = Date.now();
  const remainingMs = Math.max(0, active.endsAt - now);
  const totalMs = Math.max(1, active.durationMs || 1);
  const pct = clamp(((totalMs - remainingMs) / totalMs) * 100, 0, 100);
  const timeText = formatTime(Math.ceil(remainingMs / 1000));

  if (active.targetPage === "home") {
    const host = document.getElementById("homeHelperBar");
    if (!host) return;
    host.classList.remove("hidden");
    patchGhostOverlay(host, active, timeText, pct);
    return;
  }

  if (active.targetPage === "marketing") {
    const host = document.getElementById("marketingHelperOverlay");
    if (!host) return;
    patchGhostOverlay(host, active, timeText, pct);
    host.classList.remove("hidden");
    host.classList.add("pageHelperOverlay--scrim");
    return;
  }

  if (active.targetPage === "orders") {
    const host = document.getElementById("ordersHelperOverlay");
    if (!host) return;
    patchGhostOverlay(host, active, timeText, pct);
    host.classList.remove("hidden");
    host.classList.add("pageHelperOverlay--scrim");
    return;
  }

  if (active.targetPage === "chat") {
    const host = document.getElementById("chatHelperOverlay");
    if (!host) return;
    patchGhostOverlay(host, active, timeText, pct);
    host.classList.remove("hidden");
    host.classList.add("pageHelperOverlay--scrim");
  }
};

window.addEventListener("toobao:stopAllSounds", () => {
  hideOfferModal();
  stopHelpVoice();

  if (gameState.helpCards) {
    gameState.helpCards.pendingOffer = null;
    gameState.helpCards.offerDeadlineAt = 0;
  }
});