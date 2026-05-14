// js/systems/realtimeSync.js

import { gameState, shopInfo } from "../state.js";
import { renderManagerDashboard } from "../pages/manager.js";

let socket = null;
let syncTimer = null;

function isManagerWindow() {
  const params = new URLSearchParams(window.location.search);
  return params.get("manager") === "1";
}

let lastManagerPayloadAt = 0;

export function initRealtimeSync() {
  if (typeof io === "undefined") {
    console.warn("[Realtime] Socket.IO client not found.");
    return;
  }

  socket = io(window.location.origin, {
    transports: ["websocket", "polling"]
  });

  socket.on("connect", () => {
    console.log("[Realtime] Connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("[Realtime] Disconnected.");
  });

  socket.on("gameStateUpdate", (payload) => {
    if (!payload) return;
    if (!isManagerWindow()) return;

    const sentAt = Number(payload.sentAt) || 0;

    // Ignore older packets if they arrive late.
    if (sentAt && sentAt < lastManagerPayloadAt) return;
    if (sentAt) lastManagerPayloadAt = sentAt;

    // Ignore empty/default game states.
    if (!payload.shopInfo?.name) return;

    const incomingGameState = payload.gameState || {};
    const isRealGameState =
  incomingGameState.running ||
  incomingGameState.ended ||
  incomingGameState.dayEndSnapshot ||
  Number(incomingGameState.day) > 1 ||
  Number(incomingGameState.secondsLeft) < 180 ||
  Number(incomingGameState.views) > 0 ||
  Number(incomingGameState.followers) > 0 ||
  (Array.isArray(incomingGameState.orders) && incomingGameState.orders.length > 0);

    if (!isRealGameState) return;

    Object.assign(gameState, incomingGameState);
    Object.assign(shopInfo, payload.shopInfo);

    renderManagerDashboard();
  });
}

export function sendGameStateToManager() {
  if (!socket || !socket.connected) return;
  if (isManagerWindow()) return;

  // Do not send blank/default setup/start-page state.
  if (!shopInfo.name) return;

  // IMPORTANT:
  // Only send real active game states.
  // This prevents a normal laptop start-page tab from overwriting the phone's live game.
  const isRealGameState =
  gameState.running ||
  gameState.ended ||
  gameState.dayEndSnapshot ||
  Number(gameState.day) > 1 ||
  Number(gameState.secondsLeft) < 180 ||
  Number(gameState.views) > 0 ||
  Number(gameState.followers) > 0 ||
  (Array.isArray(gameState.orders) && gameState.orders.length > 0);

  if (!isRealGameState) return;

  socket.emit("gameStateUpdate", {
    gameState,
    shopInfo,
    sentAt: Date.now(),
    sourceUrl: window.location.href
  });
}

export function startRealtimeGameSync() {
  if (syncTimer) return;

  syncTimer = setInterval(() => {
    sendGameStateToManager();
  }, 500);
}

export function stopRealtimeGameSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}