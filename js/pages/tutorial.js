// js/pages/tutorial.js
import { showPage } from "../router.js";
import { initSetupPage } from "./setup.js";
import { el } from "../dom.js";
import { stopBackgroundMusic } from "../systems/soundSystem.js";

export function initTutorialPage() {
  showPage("pageTutorial");

  if (el.tutorialBackBtn) {
    el.tutorialBackBtn.onclick = () => {
      stopBackgroundMusic();
      showPage("pageStart");
    };
  }

  if (el.tutorialNextBtn) {
    el.tutorialNextBtn.onclick = () => {
      showPage("pageSetup");
      initSetupPage();
    };
  }
}