// js/pages/start.js

import { showPage } from "../router.js";
import { initTutorialPage } from "./tutorial.js";
import { saveSharedState } from "../state.js";
import {
  resetSoundsForNewGame,
  startBackgroundMusic
} from "../systems/soundSystem.js";

function openManagerWindow() {
  saveSharedState();

  const url = new URL(window.location.href);
  url.searchParams.set("manager", "1");

  window.open(
    url.toString(),
    "taobao-store-manager",
    "width=1380,height=900,resizable=yes,scrollbars=yes"
  );
}

export function initStartPage() {
  const btn = document.getElementById("startBtn");
  const managerBtn = document.getElementById("managerBtn");

  if (btn) {
  btn.onclick = () => {
    resetSoundsForNewGame();

    startBackgroundMusic();

    showPage("pageTutorial");
    initTutorialPage();
  };
}

  if (managerBtn) {
    managerBtn.onclick = () => {
      openManagerWindow();
    };
  }
}