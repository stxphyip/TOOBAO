// js/pages/home.js

import { el } from "../dom.js";
import { showPage } from "../router.js";
import { shopInfo, gameState, saveSharedState } from "../state.js";
import { avatarImages } from "../data/avatars.js";
import {
  formatTime,
  addViewsAndConvertFollowers,
  randInt
} from "../utils.js";
import {
  getHomeProducts,
  pickFeaturedOnce
} from "../store/productsStore.js";
import { renderManagerDashboard } from "./manager.js";
import { openEditProfile } from "../modals/editProfile.js";
import { playBoostViewsSound } from "../systems/soundSystem.js";


const BOOST_MIN_SEC = 15;
const BOOST_MAX_SEC = 25;
const BOOST_ACTIVE_SEC = 8;

function showBoostRewardFloat(btn, views, followers) {
  if (!btn) return;

  const rect = btn.getBoundingClientRect();

  const float = document.createElement("div");
  float.className = "homeBoostRewardFloat";

  float.style.left = `${rect.left + rect.width / 2}px`;
  float.style.top = `${rect.bottom + 6}px`;
  float.style.transform = "translateX(-50%)";

  float.innerHTML = `
    <div class="homeBoostRewardFloatRow">
      <span>+ ${views} VIEWS</span>
      <img class="homeBoostRewardFloatIcon" src="assets/ui_icons/views_icon.png" alt="">
    </div>

    <div class="homeBoostRewardFloatRow">
      <span>+ ${followers} FOLLOWERS</span>
      <img class="homeBoostRewardFloatIcon" src="assets/ui_icons/followers_icon.png" alt="">
    </div>
  `;

  document.body.appendChild(float);

  setTimeout(() => {
    float.remove();
  }, 1800);
}

function ensureBoostState() {
  if (!gameState.homeBoosts) {
    gameState.homeBoosts = {};
  }

  getHomeProducts().forEach((p) => {
    const id = String(p.id);

    if (!gameState.homeBoosts[id]) {
      gameState.homeBoosts[id] = {
        nextAt: Date.now() + randInt(BOOST_MIN_SEC, BOOST_MAX_SEC) * 1000,
        activeUntil: 0
      };
    }
  });
}

function isBoostActive(productId) {
  ensureBoostState();

  const id = String(productId);
  const boost = gameState.homeBoosts[id];
  const now = Date.now();

  if (boost && now >= boost.nextAt && now > boost.activeUntil) {
    boost.activeUntil = now + BOOST_ACTIVE_SEC * 1000;
  }

  return boost && now <= boost.activeUntil;
}

function resetBoostTimer(productId) {
  ensureBoostState();

  const id = String(productId);
  gameState.homeBoosts[id] = {
    nextAt: Date.now() + randInt(BOOST_MIN_SEC, BOOST_MAX_SEC) * 1000,
    activeUntil: 0
  };
}

function boostProductViews(productId, btn = null) {
  const p = getHomeProducts().find((item) => String(item.id) === String(productId));
  if (!p) return;

  const gain = randInt(25, 60);
  const followersBefore = Number(gameState.followers) || 0;

  p.recentViews = Math.max(0, (Number(p.recentViews) || 0) + gain);

  addViewsAndConvertFollowers(gameState, gain);

  const followersAfter = Number(gameState.followers) || 0;
  const followersGained = Math.max(0, followersAfter - followersBefore);

  showBoostRewardFloat(btn, gain, followersGained);

  resetBoostTimer(productId);
  refreshHomeProductStatsOnly();
  renderHud();
  saveSharedState();
}



let didInitHome = false;

document.addEventListener("click", (e) => {
  const clickedAvatarBtn =
    e.target.closest("#homeAvatarBtn") ||
    e.target.closest("#hudAvatarBtn") ||
    e.target.closest("#editProfileBtn");

  if (clickedAvatarBtn) {
    try {
      openEditProfile();
    } catch (err) {
      console.error("Crash when opening Edit Profile. Check your dom.js!", err);
    }
  }
});

function resolveAvatarSrc() {
  if (shopInfo.avatarImg) return shopInfo.avatarImg;
  const idx = Number(shopInfo.avatarNumber) || 0;
  return avatarImages[idx] || avatarImages[0] || "";
}

function getStarsImg() {
  const level = Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1));
  return `assets/ui_icons/${level}star${level > 1 ? "s" : ""}.png`;
}

function getDayIcon() {
  const day = Math.max(1, Math.min(3, Number(gameState.day) || 1));
  return `assets/ui_icons/day${day}_icon.png`;
}

function formatCompact(n) {
  const num = Math.max(0, Math.floor(Number(n) || 0));
  if (num >= 1000000) {
    const v = num / 1000000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (num >= 1000) {
    const v = num / 1000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return String(num);
}

function getAvailableShippingBoxes() {
  const total = Number(gameState.shippingMaterials) || 0;
  const reserved = Number(gameState.reservedShippingMaterials) || 0;
  return Math.max(0, total - reserved);
}

function updateHomeTopStatsDom() {
  const homeAvatar = document.getElementById("homeTopAvatar");
  const homeStoreName = document.getElementById("homeTopStoreName");
  const homeStars = document.getElementById("homeTopStars");
  const homeFollowers = document.getElementById("homeTopFollowersValue");
  const homeViews = document.getElementById("homeTopViewsValue");
  const homeBoxes = document.getElementById("homeTopBoxesValue");
  const homeMoney = document.getElementById("homeTopMoneyValue");
  const homeDay = document.getElementById("homeTopDayValue");
  const homeTime = document.getElementById("homeTopTimeValue");

  if (homeAvatar) homeAvatar.src = resolveAvatarSrc();
  if (homeStoreName) homeStoreName.textContent = shopInfo.name || "[STORE NAME]";
  if (homeStars) homeStars.src = getStarsImg();
  if (homeFollowers) homeFollowers.textContent = formatCompact(gameState.followers);
  if (homeViews) homeViews.textContent = formatCompact(gameState.views);
  if (homeBoxes) homeBoxes.textContent = formatCompact(getAvailableShippingBoxes());
  if (homeMoney) homeMoney.textContent = formatCompact(gameState.revenue);
  if (homeDay) homeDay.textContent = `DAY ${gameState.day}`;
  if (homeTime) homeTime.textContent = formatTime(gameState.secondsLeft);
}

function updateMarketingTopStatsDom() {
  const marketingAvatar = document.getElementById("marketingTopAvatar");
  const marketingStoreName = document.getElementById("marketingTopStoreName");
  const marketingStars = document.getElementById("marketingTopStars");
  const marketingFollowers = document.getElementById("marketingTopFollowersValue");
  const marketingViews = document.getElementById("marketingTopViewsValue");
  const marketingBoxes = document.getElementById("marketingTopBoxesValue");
  const marketingMoney = document.getElementById("marketingTopMoneyValue");
  const marketingDay = document.getElementById("marketingTopDayValue");
  const marketingTime = document.getElementById("marketingTopTimeValue");
  const marketingDayIcon = document.getElementById("marketingTopDayIcon");

  if (marketingAvatar) marketingAvatar.src = resolveAvatarSrc();
  if (marketingStoreName) marketingStoreName.textContent = shopInfo.name || "[STORE NAME]";
  if (marketingStars) marketingStars.src = getStarsImg();
  if (marketingFollowers) marketingFollowers.textContent = formatCompact(gameState.followers);
  if (marketingViews) marketingViews.textContent = formatCompact(gameState.views);
  if (marketingBoxes) marketingBoxes.textContent = formatCompact(getAvailableShippingBoxes());
  if (marketingMoney) marketingMoney.textContent = formatCompact(gameState.revenue);
  if (marketingDay) marketingDay.textContent = `DAY ${gameState.day}`;
  if (marketingTime) marketingTime.textContent = formatTime(gameState.secondsLeft);
  if (marketingDayIcon) marketingDayIcon.src = getDayIcon();
}

function updateOrdersTopStatsDom() {
  if (typeof window.__refreshOrdersTopStats === "function") {
    window.__refreshOrdersTopStats();
  }
}

export function renderHud() {
  if (!el?.hudStoreName) return;

  el.hudStoreName.textContent = shopInfo.name || "Store";
  if (el.hudAvatar) el.hudAvatar.src = resolveAvatarSrc();

  if (el.hudRating) {
    el.hudRating.textContent = "★".repeat(
      Math.max(1, Math.min(5, Number(gameState.storeLevel) || 1))
    );
  }

  if (el.hudFollowers) {
    el.hudFollowers.textContent = `${gameState.followers} followers`;
  }

  if (el.hudDay) el.hudDay.textContent = String(gameState.day);
  if (el.hudTimeLeft) el.hudTimeLeft.textContent = formatTime(gameState.secondsLeft);

  if (el.hudRevenue) {
    el.hudRevenue.textContent = String(
      Math.max(0, Math.floor(Number(gameState.revenue) || 0))
    );
  }

  if (el.hudViews) {
    el.hudViews.textContent = String(
      Math.max(0, Math.floor(Number(gameState.views) || 0))
    );
  }

  if (el.shippingMat) {
    el.shippingMat.textContent = String(getAvailableShippingBoxes());
  }

  updateHomeTopStatsDom();
  updateMarketingTopStatsDom();
  updateOrdersTopStatsDom();

  try {
  renderManagerDashboard();
} catch (err) {
  console.error("[Manager Dashboard Error]", err);
}

saveSharedState();
}

export function updateHomeProfileUI() {
  renderHud();
  buildHomePage();
}

function getDisplayViewsForProduct(p, index) {
  const totalViews = Number(gameState.views) || 0;
  const recentViews = Number(p.recentViews) || 0;
  const sold = Number(p.sold) || 0;

  const baseShare = Math.floor(totalViews * 0.08);
  const stagger = index % 2 === 0 ? 6 : 10;
  const weightedRecent = recentViews * 5;
  const soldBoost = sold * 12;

  return Math.max(0, baseShare + stagger + weightedRecent + soldBoost);
}

function buildTopStatsBlock() {
  const wrap = document.createElement("div");
  wrap.className = "homeTopStatsCard";

  wrap.innerHTML = `
    <div class="homeTopStatsInner">
      <button id="homeAvatarBtn" class="homeAvatarBtn" type="button" aria-label="Edit profile" style="cursor: pointer; background: none; border: none; padding: 0; position: relative; z-index: 50;">
        <img id="homeTopAvatar" class="homeAvatarLarge" src="${resolveAvatarSrc()}" alt="Store avatar" style="pointer-events: none;">
      </button>

      <div class="homeStoreMain">
        <div id="homeTopStoreName" class="homeStoreNameLarge">${shopInfo.name || "[STORE NAME]"}</div>
        <img id="homeTopStars" class="homeStarsImg" src="${getStarsImg()}" alt="Stars">

        <div class="homeOrangeStatsRow">
          <div class="homeOrangeStat homeFollowersStat">
            <img class="homeStatIcon" src="assets/ui_icons/followers_icon.png" alt="">
            <span id="homeTopFollowersValue" class="homeStatValue">${formatCompact(gameState.followers)}</span>
          </div>

          <div class="homeOrangeStat homeViewsStat">
            <img class="homeStatIcon" src="assets/ui_icons/views_icon.png" alt="">
            <span id="homeTopViewsValue" class="homeStatValue">${formatCompact(gameState.views)}</span>
          </div>

          <div class="homeOrangeStat homeBoxesStat">
            <img class="homeStatIcon" src="assets/ui_icons/shippingbox_icon.png" alt="">
            <span id="homeTopBoxesValue" class="homeStatValue">${formatCompact(getAvailableShippingBoxes())}</span>
          </div>

          <div class="homeOrangeStat homeMoneyStat">
            <img class="homeStatIcon" src="assets/ui_icons/coin_icon.png" alt="">
            <span id="homeTopMoneyValue" class="homeStatValue">${formatCompact(gameState.revenue)}</span>
          </div>
        </div>
      </div>

      <div class="homeRightStatsCol">
        <div class="homeOrangeStat homeDayStat">
          <img class="homeStatIcon" src="${getDayIcon()}" alt="">
          <span id="homeTopDayValue" class="homeStatValue">DAY ${gameState.day}</span>
        </div>

        <div class="homeOrangeStat homeTimeStat">
          <img class="homeStatIcon" src="assets/ui_icons/time_icon.png" alt="">
          <span id="homeTopTimeValue" class="homeStatValue">${formatTime(gameState.secondsLeft)}</span>
        </div>
      </div>
    </div>
  `;

  return wrap;
}

function buildProductsSectionTitle() {
  const title = document.createElement("div");
  title.className = "homeSectionTitle homeProductsSectionTitle";
  title.textContent = "YOUR PRODUCTS";
  return title;
}

function makeProductCard(p, index, { isTall = false } = {}) {
  const card = document.createElement("div");
  card.className = `homeProductCard ${isTall ? "isTall" : "isShort"}`;
  card.dataset.productId = String(p.id || "");

  let discountAmount = 0;
  const activeHelp = gameState.helpCards?.active;

  if (activeHelp?.id === "discount_festival") {
    discountAmount = 5;
  } else if (activeHelp?.id === "coupons") {
    discountAmount = 2;
  }

  const basePrice = Number(p.price) || 0;
  const hasDiscount = discountAmount > 0;
  const finalPrice = hasDiscount ? Math.max(1, basePrice - discountAmount) : basePrice;

  let couponImg = "";
  if (activeHelp?.id === "coupons") {
    couponImg = "assets/helpcards/2coinoffcoupon.png";
  } else if (activeHelp?.id === "discount_festival") {
    couponImg = "assets/helpcards/5coinoffcoupon.png";
  }

  const views = getDisplayViewsForProduct(p, index);
  const qtyLeft = Math.max(0, Number(p.qty) || 0);
  const boostActive = isBoostActive(p.id);

  card.innerHTML = `
    ${couponImg ? `
      <img src="${couponImg}" class="productCouponTag" alt="Discount Coupon">
    ` : ""}

    <div class="homeProductImageWrap">
  <img class="homeProductImage" src="${p.img}" alt="${p.name}">

  <button 
  class="homeBoostViewsBtn ${boostActive ? "is-active" : "is-inactive"}"
  type="button"
  data-product-id="${p.id}"
  data-no-click-sound="1"
  ${boostActive ? "" : "disabled"}
>
    <img src="assets/ui_buttons/boostviewsbutton.png" alt="Boost views">
  </button>
</div>

    <div class="homeProductTextWrap">
      <div class="homeProductTitle">${String(p.name || "").toUpperCase()}</div>

      <div class="homeProductMeta">
        <div class="homeProductPriceRow ${hasDiscount ? "redPrice" : ""}">
          <span class="homeMetaLabel">PRICE:</span>

          ${hasDiscount ? `
            <img src="assets/helpcards/reddownarrow.png" class="homeDiscountArrow" alt="">
          ` : ""}

          <img class="homeMetaCoin" src="assets/ui_icons/coin_icon.png" alt="">

          <span class="homeMetaValue homePriceValue ${hasDiscount ? "redText" : ""}">
            ${finalPrice}
          </span>
        </div>

        <div class="homeProductQtyRow">
          <span class="homeMetaLabel">QTY LEFT:</span>
          <span class="homeMetaValue homeQtyValue">${qtyLeft}</span>
        </div>

        <div class="homeProductViewsBlock">
          <img class="homeViewsBlockIcon" src="assets/ui_icons/productview_icon.png" alt="">
          <span class="homeViewsBlockValue homeViewsValue">${formatCompact(views)}</span>
        </div>
      </div>
    </div>
  `;

  return card;
}

export function refreshHomeProductStatsOnly() {
  const cards = document.querySelectorAll(".homeProductCard[data-product-id]");
  if (!cards.length) return;

  const list = getHomeProducts();
  const activeHelp = gameState.helpCards?.active;
  let discAmt = 0;
  if (activeHelp?.id === "discount_festival") discAmt = 5;
  else if (activeHelp?.id === "coupons") discAmt = 2;

  cards.forEach((card, index) => {
    const id = card.dataset.productId;
    const p = list.find((item) => String(item.id) === String(id));
    if (!p) return;
    const boostBtn = card.querySelector(".homeBoostViewsBtn");
const active = isBoostActive(p.id);

if (boostBtn) {
  boostBtn.disabled = !active;
  boostBtn.classList.toggle("is-active", active);
  boostBtn.classList.toggle("is-inactive", !active);
}

    const basePrice = Number(p.price) || 0;
    const finalPrice = discAmt > 0 ? Math.max(1, basePrice - discAmt) : basePrice;
    const qtyLeft = Math.max(0, Number(p.qty) || 0);
    const views = getDisplayViewsForProduct(p, index);

    const priceNode = card.querySelector(".homePriceValue");
    const qtyNode = card.querySelector(".homeQtyValue");
    const viewsNode = card.querySelector(".homeViewsValue");

    if (priceNode) {
      priceNode.textContent = finalPrice;
      if (discAmt > 0) priceNode.classList.add("redText");
      else priceNode.classList.remove("redText");
    }

    if (qtyNode) qtyNode.textContent = formatCompact(qtyLeft);
    if (viewsNode) viewsNode.textContent = formatCompact(views);
  });
}

export function buildHomePage() {
  if (!el?.homeProducts) return;

  renderHud();

  const ordersBadge = document.getElementById("navOrdersBadge");
  if (ordersBadge) {
    ordersBadge.textContent = String(
      (gameState.orders || []).filter((o) =>
        o.status === "NEW" ||
        o.status === "PACKING" ||
        o.status === "READY_TO_SHIP" ||
        o.status === "SHIPPING" ||
        o.status === "DELIVERED"
      ).length
    );
    ordersBadge.style.display = "flex";
    ordersBadge.style.visibility = "visible";
    ordersBadge.style.opacity = "1";
  }

  el.homeProducts.innerHTML = "";

  const list = getHomeProducts();
  pickFeaturedOnce();

  const content = document.createElement("div");
  content.className = "homeFeedWrap";

  const topArea = document.createElement("div");
  topArea.className = "homeTopArea";

  const topStats = buildTopStatsBlock();
  topStats.id = "homeTopStatsBlock";

  const homeHelperHost = document.createElement("div");
  homeHelperHost.id = "homeHelperBar";
  homeHelperHost.className = "pageHelperBar hidden";

  if (gameState.helpCards && gameState.helpCards.active) {
    setTimeout(() => {
      if (typeof window.refreshActiveHelperUI === "function") {
        window.refreshActiveHelperUI();
      }
    }, 0);
  }

  topArea.appendChild(topStats);
  topArea.appendChild(homeHelperHost);

  const productsSection = document.createElement("div");
  productsSection.className = "homeProductsSection";

  const productsTitle = buildProductsSectionTitle();
  const grid = document.createElement("div");
  grid.className = "homeProductsGrid";

  const colA = document.createElement("div");
  colA.className = "homeFeedCol";

  const colB = document.createElement("div");
  colB.className = "homeFeedCol";

  list.forEach((p, idx) => {
    const card = makeProductCard(p, idx, { isTall: idx % 3 === 0 });
    if (idx % 2 === 0) colA.appendChild(card);
    else colB.appendChild(card);
  });

  grid.appendChild(colA);
  grid.appendChild(colB);

  productsSection.appendChild(productsTitle);
  productsSection.appendChild(grid);

  content.appendChild(topArea);
  content.appendChild(productsSection);

  el.homeProducts.appendChild(content);


  renderManagerDashboard();
  saveSharedState();
}

export function enterHome() {
  initHomePage();
  showPage("pageHome");
  buildHomePage();
}

export function initHomePage() {
  if (didInitHome) return;
  didInitHome = true;
  document.addEventListener("click", (e) => {
  const btn = e.target.closest(".homeBoostViewsBtn.is-active");
  if (!btn || btn.disabled) return;

  e.preventDefault();
  e.stopPropagation();

  const productId = btn.dataset.productId;

  playBoostViewsSound();
  boostProductViews(productId, btn);
});

  if (el?.addProductBtn) {
    el.addProductBtn.style.display = "none";
  }

  setInterval(() => {
  refreshHomeProductStatsOnly();
}, 500);
}