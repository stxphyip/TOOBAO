/* js/modals/popup.js */

const MRBAO_SOUND_BASE = "assets/mrbao_sounds/";
const INSUFFICIENT_FUNDS_VOICE_SRC = `${MRBAO_SOUND_BASE}stopityourbroke.mp3`; 
// ^ rename this to your actual mp3 file, for example:
// `${MRBAO_SOUND_BASE}insufficientfunds.mp3`

const INSUFFICIENT_FUNDS_VOICE_VOLUME = 0.4;
const INSUFFICIENT_FUNDS_VOICE_PLAY_MS = 3000;

let insufficientFundsVoiceAudio = null;
let insufficientFundsVoiceTimer = null;

function soundsAreSuppressed() {
  return Date.now() < (Number(window.__toobaoSuppressSoundsUntil) || 0);
}

function getInsufficientFundsVoiceAudio() {
  if (!insufficientFundsVoiceAudio) {
    insufficientFundsVoiceAudio = new Audio(INSUFFICIENT_FUNDS_VOICE_SRC);
    insufficientFundsVoiceAudio.preload = "auto";
    insufficientFundsVoiceAudio.loop = false;
    insufficientFundsVoiceAudio.volume = INSUFFICIENT_FUNDS_VOICE_VOLUME;
  }

  return insufficientFundsVoiceAudio;
}

function stopInsufficientFundsVoice() {
  if (insufficientFundsVoiceTimer) {
    clearTimeout(insufficientFundsVoiceTimer);
    insufficientFundsVoiceTimer = null;
  }

  if (!insufficientFundsVoiceAudio) return;

  insufficientFundsVoiceAudio.pause();
  insufficientFundsVoiceAudio.currentTime = 0;
}

function playInsufficientFundsVoice() {
  if (soundsAreSuppressed()) return;

  stopInsufficientFundsVoice();

  const soundVersion = Number(window.__toobaoSoundStopVersion) || 0;
  const audio = getInsufficientFundsVoiceAudio();

  if ((Number(window.__toobaoSoundStopVersion) || 0) !== soundVersion) return;

  audio.currentTime = 0;
  audio.volume = INSUFFICIENT_FUNDS_VOICE_VOLUME;

  audio.play().catch((err) => {
    console.warn("[Popup] Insufficient funds voice blocked:", err);
  });

  insufficientFundsVoiceTimer = setTimeout(() => {
    stopInsufficientFundsVoice();
  }, INSUFFICIENT_FUNDS_VOICE_PLAY_MS);
}

// Reusable overlay creator
function createOverlay() {
  const oldOverlay = document.getElementById("popupOverlay");
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement("div");
  overlay.id = "popupOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 8000;
  `;
  return overlay;
}

export function openInsufficientFundsModal(message) {
  const overlay = createOverlay();

  overlay.innerHTML = `
    <div class="insufficientFundsModal">
      <button class="popupCloseX" id="closePopupBtn" type="button">
        <img src="assets/popup/xbuttonwhite.png" alt="x">
      </button>
      <h2 class="popupTitle">INSUFFICIENT FUNDS!</h2>
      <div class="popupIconContainer">
        <img src="assets/popup/insufficientfundicon.png" class="popupWarningImg" alt="Warning">
      </div>
      <p class="popupMessage">${message}</p>
    </div>
  `;

  document.body.appendChild(overlay);

  playInsufficientFundsVoice();

  document.getElementById("closePopupBtn").onclick = () => {
    stopInsufficientFundsVoice();
    overlay.remove();
  };
}

export function openConfirmDeclineModal(onConfirm) {
  const overlay = createOverlay();

  overlay.innerHTML = `
    <div class="insufficientFundsModal">
      <button class="popupCloseX" id="closePopupBtn" type="button">
        <img src="assets/popup/xbuttonwhite.png" alt="x">
      </button>

      <h2 class="popupTitle">ARE YOU SURE?</h2>

      <div class="popupIconContainer">
        <img src="assets/popup/stopicon.png" class="popupWarningImg" alt="Stop">
      </div>

      <div class="popupConfirmButtons">
        <button id="confirmNoBtn" class="confirmBtn" type="button">
          <img src="assets/popup/nobutton.png" alt="No">
        </button>

        <button id="confirmYesBtn" class="confirmBtn" type="button">
          <img src="assets/popup/yesbutton.png" alt="Yes">
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  document.getElementById("closePopupBtn").onclick = close;
  document.getElementById("confirmNoBtn").onclick = close;
  document.getElementById("confirmYesBtn").onclick = () => {
    close();
    onConfirm?.();
  };
}

export function openMrBaoTaskModal(task, onIgnore) {
  const overlay = createOverlay();

  overlay.innerHTML = `
    <div class="mrBaoTaskModal">
      <img class="mrBaoTaskBg" src="assets/popup/alertwhiteblock.png" alt="">

      <div class="mrBaoTaskInner">
        <div class="mrBaoTaskTitle">${task.title || "IMPORTANT ALERT!"}</div>

        <div class="mrBaoTaskContent">
          <div class="mrBaoTaskIconWrap">
            <img class="mrBaoTaskIcon" src="${task.image}" alt="">
          </div>

          <div class="mrBaoTaskTextCol">
            <div class="mrBaoTaskName">MR.BAO</div>
            <div class="mrBaoTaskMessage">${task.message}</div>
          </div>
        </div>

        <div class="mrBaoTaskButtons">
          <button id="mrBaoTaskIgnoreBtn" class="mrBaoTaskBtn" type="button">
            <img src="assets/popup/ignorebutton.png" alt="Ignore">
          </button>

          <button id="mrBaoTaskGotItBtn" class="mrBaoTaskBtn" type="button">
            <img src="assets/popup/gotitbutton.png" alt="Got it">
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("mrBaoTaskIgnoreBtn").onclick = () => {
    overlay.remove();
    onIgnore?.();
  };

  document.getElementById("mrBaoTaskGotItBtn").onclick = () => {
    overlay.remove();
  };
}

window.addEventListener("toobao:stopAllSounds", () => {
  stopInsufficientFundsVoice();

  const overlay = document.getElementById("popupOverlay");
  if (overlay) overlay.remove();
});