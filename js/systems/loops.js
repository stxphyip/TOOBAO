import { gameState, tickers, saveSharedState } from "../state.js";
import { clamp, randInt, addViewsAndConvertFollowers, subtractViews } from "../utils.js";
import { isOnHomePage } from "../router.js";
import { getHomeProducts } from "../store/productsStore.js";
import { buildHomePage, renderHud, refreshHomeProductStatsOnly } from "../pages/home.js";
import { expireTaskIfNeeded, postNewTask, checkTaskCompletion } from "./tasks.js";
import { endDay, triggerOutOfMoneyGameOver } from "./endDay.js";

import {
  tickOrders,
  addRandomOrderFromSelectedProducts,
  refreshOrdersNavBadge
} from "./ordersSystem.js";

import {
  initMessagesStateIfNeeded,
  tickChatSecond,
  tickChatTrafficLikeOrders,
  refreshChatNavBadge
} from "./messagesSystem.js";

import { tickHelpCards } from "./helpCards.js";
import { renderManagerDashboard } from "../pages/manager.js";

function syncExternalViewsSafely() {
  try {
    renderManagerDashboard?.();
  } catch (err) {}

  try {
    saveSharedState?.();
  } catch (err) {}
}

export function stopGameLoops() {
  if (tickers.secondTicker) clearInterval(tickers.secondTicker);
  if (tickers.trafficTicker) clearInterval(tickers.trafficTicker);
  if (tickers.algoScheduler) clearInterval(tickers.algoScheduler);

  tickers.secondTicker = null;
  tickers.trafficTicker = null;
  tickers.algoScheduler = null;

  gameState.running = false;
}

export function startGameLoops() {
  stopGameLoops();
  gameState.running = true;
  gameState.ended = false;

  initMessagesStateIfNeeded();
  refreshChatNavBadge();
  refreshOrdersNavBadge();

  let chatTrafficCounter = 0;

  tickers.secondTicker = setInterval(() => {
    if (!gameState.running || gameState.ended) return;
    gameState.totalGameSecondsElapsed = (Number(gameState.totalGameSecondsElapsed) || 0) + 1;

    tickOrders();
    refreshOrdersNavBadge();

    tickChatSecond();

    chatTrafficCounter++;
    if (chatTrafficCounter >= 3) {
      chatTrafficCounter = 0;
      tickChatTrafficLikeOrders();
    }

    tickHelpCards();
    refreshChatNavBadge();

    const currentMoney = Number(gameState.revenue) || 0;
    if (currentMoney <= 0 && gameState.day >= 1) {
      renderHud();
      triggerOutOfMoneyGameOver();
      return;
    }

    gameState.secondsLeft -= 1;

    if (gameState.secondsLeft <= 0) {
      gameState.secondsLeft = 0;
      gameState.running = false;
      renderHud();
      endDay();
      return;
    }
    checkTaskCompletion();
    expireTaskIfNeeded();
    renderHud();
    syncExternalViewsSafely();
  }, 1000);

  tickers.trafficTicker = setInterval(() => {
    if (!gameState.running || gameState.ended) return;

    const homeList = getHomeProducts();
    if (!homeList.length) return;

    homeList.forEach((p) => {
      p.recentViews = Math.floor((p.recentViews || 0) * 0.7);
    });

    const viewDelta = randInt(-12, 18) + Math.floor(gameState.visibility / 10);

    if (viewDelta > 0) addViewsAndConvertFollowers(gameState, viewDelta);
    else subtractViews(gameState, Math.abs(viewDelta));

    let attempts = clamp(Math.floor(gameState.views / 60), 0, 10);
    for (let i = 0; i < attempts; i++) {
      if (Math.random() < (0.03 + gameState.storeLevel * 0.015)) {
        addRandomOrderFromSelectedProducts();
      }
    }

    renderHud();

    if (isOnHomePage()) {
      refreshHomeProductStatsOnly();
    }
  }, 3000);

  tickers.algoScheduler = setInterval(() => {
    if (!gameState.running || gameState.ended) return;
    postNewTask();
  }, 6000);
}