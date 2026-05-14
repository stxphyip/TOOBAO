// js/systems/endDay.js

import { gameState } from "../state.js";
import { clamp, syncStoreLevelFromFollowers } from "../utils.js";
import { showDayOverlay } from "../modals/dayOverlay.js";
import { buildHomePage, renderHud } from "../pages/home.js";
import { showPage } from "../router.js";
import { startGameLoops, stopGameLoops } from "./loops.js";
import { stopBackgroundMusic } from "./soundSystem.js";
import { clearAlgoToasts } from "./toast.js";
import { closeAllTaskPopups } from "./tasks.js";

const STARTING_BUDGET = 500;


function getDayRevenueChange() {
  const currentRevenue = Number(gameState.revenue) || 0;
  const currentDay = Number(gameState.day) || 1;

  // Day 1 compares against the original starting budget.
  // This makes setup spending count in the first day summary.
  if (currentDay === 1) {
    return currentRevenue - STARTING_BUDGET;
  }

  // Day 2 and Day 3 compare against the balance at the start of that day.
  const startRevenue = Number(gameState.managerDashboard?.dayStartRevenue);

  if (Number.isFinite(startRevenue)) {
    return currentRevenue - startRevenue;
  }

  return currentRevenue - STARTING_BUDGET;
}

function makeDaySnapshot() {
  return {
    day: Number(gameState.day) || 1,
    dayRevenue: getDayRevenueChange(),
    revenue: Number(gameState.revenue) || 0,
    followers: Number(gameState.followers) || 0,
    views: Number(gameState.views) || 0,
    storeLevel: Number(gameState.storeLevel) || 1
  };
}

function setDayStartRevenue() {
  if (!gameState.managerDashboard) {
    gameState.managerDashboard = {};
  }

  gameState.managerDashboard.dayStartRevenue = Number(gameState.revenue) || 0;

  gameState.managerDashboard.dayStartGrossRevenue =
    Number(gameState.analytics?.lifetime?.grossRevenue) || 0;

  gameState.managerDashboard.dayStartRefundedAmount =
    Number(gameState.analytics?.lifetime?.refundedAmount) || 0;

  gameState.managerDashboard.dayStartCosts =
    (Number(gameState.costs?.shippingBoxesSpent) || 0) +
    (Number(gameState.costs?.inventorySpent) || 0) +
    (Number(gameState.costs?.unlockSpent) || 0);
}

function prepareEndOverlay({ stopMusic = false } = {}) {
  gameState.running = false;

  // Stop game systems first so no new tasks/toasts spawn behind the overlay.
  stopGameLoops();

  // Clear any visible or queued algorithm toasts.
  clearAlgoToasts();

  // Close task popups / task sounds if one is open.
  closeAllTaskPopups({ clearActiveTask: true });

  // Stop background music only for final game over / success.
  if (stopMusic) {
    stopBackgroundMusic();
  }
}

export function triggerOutOfMoneyGameOver() {
  if (gameState.ended) return;

  syncStoreLevelFromFollowers(gameState);
  gameState.dayEndSnapshot = makeDaySnapshot();

  gameState.ended = true;

  prepareEndOverlay({ stopMusic: true });

  showDayOverlay("gameover_nomoney");
}


export function endDay() {
  if (gameState.ended) return;

  syncStoreLevelFromFollowers(gameState);
  gameState.dayEndSnapshot = makeDaySnapshot();

  if (gameState.day >= 3) {
    endGame();
    return;
  }

  prepareEndOverlay({ stopMusic: false });

  showDayOverlay("summary");
}

export function nextDay() {
  if (gameState.ended) return;

  if (gameState.day >= 3) {
    endGame();
    return;
  }

  gameState.prevDayRevenue = getDayRevenueChange();

  gameState.day += 1;
  gameState.secondsLeft = 180;
  gameState.dayRevenue = 0;
  gameState.dayEndSnapshot = null;

  setDayStartRevenue();

  gameState.visibility = clamp(gameState.visibility + 15, 0, 100);
  gameState.missedTasks = Math.max(0, gameState.missedTasks - 1);

  showPage("pageHome");
  buildHomePage();
  renderHud();
  startGameLoops();
}

export function endGame() {
  if (gameState.ended) return;

  syncStoreLevelFromFollowers(gameState);
  gameState.dayEndSnapshot = makeDaySnapshot();

  gameState.ended = true;

  prepareEndOverlay({ stopMusic: true });

  const hasMoney = (Number(gameState.revenue) || 0) > 0;
  const reachedGoal = (Number(gameState.storeLevel) || 1) >= 5;

  if (!hasMoney) {
    showDayOverlay("gameover_nomoney");
    return;
  }

  if (reachedGoal) {
    showDayOverlay("success");
  } else {
    showDayOverlay("gameover_stars");
  }
}