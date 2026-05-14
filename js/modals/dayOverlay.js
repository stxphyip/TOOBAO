import { el } from "../dom.js";
import { gameState } from "../state.js";
import { nextDay } from "../systems/endDay.js";
import { stars } from "../utils.js";
import { clearAlgoToasts } from "../systems/toast.js";
import { closeAllTaskPopups } from "../systems/tasks.js";
import { hideNavBar } from "../router.js";
import { stopAllGameSounds } from "../systems/soundSystem.js";

const DAY_COMPLETE_SOUND_SRC = "assets/sounds/daycomplete.mp3";
const WIN_SOUND_SRC = "assets/sounds/win.mp3";
const FAIL_SOUND_SRC = "assets/sounds/fail.mp3";

const DAY_COMPLETE_SOUND_PLAY_MS = 3000;
const WIN_SOUND_PLAY_MS = 4000;
const FAIL_SOUND_PLAY_MS = 4000;

let dayCompleteAudio = null;
let winAudio = null;
let failAudio = null;
let dayOverlaySoundTimer = null;
let dayOverlaySoundsUnlocked = false;

const MRBAO_SOUND_BASE = "assets/mrbao_sounds/";

const DAY1_COMPLETE_VOICE_SRC = `${MRBAO_SOUND_BASE}day1complete3.mp3`;
const DAY2_COMPLETE_VOICE_SRC = `${MRBAO_SOUND_BASE}day2complete3.mp3`;

const DAY_COMPLETE_VOICE_VOLUME = 0.5;
const DAY_COMPLETE_VOICE_DELAY_MS = DAY_COMPLETE_SOUND_PLAY_MS + 150;
const DAY_COMPLETE_VOICE_PLAY_MS = 3000;

let dayOverlayVoiceAudio = null;
let dayOverlayVoiceTimer = null;

const WIN_VOICE_SRC = `${MRBAO_SOUND_BASE}congratsyouwon3.mp3`;
const FAIL_VOICE_SRC = `${MRBAO_SOUND_BASE}uhohyoufailed3.mp3`;

const RESULT_VOICE_VOLUME = 0.5;
const RESULT_VOICE_DELAY_MS = 4250;
const RESULT_VOICE_PLAY_MS = 3500;

const LEAVING_ALREADY_VOICE_SRC = `${MRBAO_SOUND_BASE}leavingalready3.mp3`;

const QUIT_VOICE_VOLUME = 0.5;
const QUIT_VOICE_PLAY_MS = 3000;

let quitVoiceAudio = null;
let quitVoiceTimer = null;
let quitVoiceStartTimer = null;

function soundsAreSuppressed() {
  return Date.now() < (Number(window.__toobaoSuppressSoundsUntil) || 0);
}

function getDayCompleteAudio() {
  if (!dayCompleteAudio) {
    dayCompleteAudio = new Audio(DAY_COMPLETE_SOUND_SRC);
    dayCompleteAudio.preload = "auto";
    dayCompleteAudio.loop = false;
    dayCompleteAudio.volume = 0.9;
  }

  return dayCompleteAudio;
}

function getWinAudio() {
  if (!winAudio) {
    winAudio = new Audio(WIN_SOUND_SRC);
    winAudio.preload = "auto";
    winAudio.loop = false;
    winAudio.volume = 0.9;
  }

  return winAudio;
}

function getFailAudio() {
  if (!failAudio) {
    failAudio = new Audio(FAIL_SOUND_SRC);
    failAudio.preload = "auto";
    failAudio.loop = false;
    failAudio.volume = 0.9;
  }

  return failAudio;
}

function stopAudio(audio) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

function stopDayOverlaySound() {
  if (dayOverlaySoundTimer) {
    clearTimeout(dayOverlaySoundTimer);
    dayOverlaySoundTimer = null;
  }

  stopAudio(dayCompleteAudio);
  stopAudio(winAudio);
  stopAudio(failAudio);
  stopDayOverlayVoice();
  stopQuitVoice();
}

function getDayOverlayVoiceAudio() {
  if (!dayOverlayVoiceAudio) {
    dayOverlayVoiceAudio = new Audio();
    dayOverlayVoiceAudio.preload = "auto";
    dayOverlayVoiceAudio.loop = false;
    dayOverlayVoiceAudio.volume = DAY_COMPLETE_VOICE_VOLUME;
  }

  return dayOverlayVoiceAudio;
}

function stopDayOverlayVoice() {
  if (dayOverlayVoiceTimer) {
    clearTimeout(dayOverlayVoiceTimer);
    dayOverlayVoiceTimer = null;
  }

  if (!dayOverlayVoiceAudio) return;

  dayOverlayVoiceAudio.pause();
  dayOverlayVoiceAudio.currentTime = 0;
}

function getQuitVoiceAudio() {
  if (!quitVoiceAudio) {
    quitVoiceAudio = new Audio(LEAVING_ALREADY_VOICE_SRC);
    quitVoiceAudio.preload = "auto";
    quitVoiceAudio.loop = false;
    quitVoiceAudio.volume = QUIT_VOICE_VOLUME;
  }

  return quitVoiceAudio;
}

function stopQuitVoice() {
  if (quitVoiceStartTimer) {
    clearTimeout(quitVoiceStartTimer);
    quitVoiceStartTimer = null;
  }

  if (quitVoiceTimer) {
    clearTimeout(quitVoiceTimer);
    quitVoiceTimer = null;
  }

  if (!quitVoiceAudio) return;

  quitVoiceAudio.pause();
  quitVoiceAudio.currentTime = 0;
}

function playQuitVoice(delayMs = 0) {
  stopQuitVoice();

  if (soundsAreSuppressed()) return;

  const soundVersion = Number(window.__toobaoSoundStopVersion) || 0;

  quitVoiceStartTimer = setTimeout(() => {
    if (soundsAreSuppressed()) return;

    if ((Number(window.__toobaoSoundStopVersion) || 0) !== soundVersion) {
      return;
    }

    quitVoiceStartTimer = null;

    const audio = getQuitVoiceAudio();

    audio.currentTime = 0;
    audio.volume = QUIT_VOICE_VOLUME;

    audio.play().catch((err) => {
      console.warn("[DayOverlay] Quit voice blocked:", err);
    });

    quitVoiceTimer = setTimeout(() => {
      stopQuitVoice();
    }, QUIT_VOICE_PLAY_MS);
  }, delayMs);
}

function getDayCompleteVoiceForSnapshot(snapshot) {
  const day = Number(snapshot?.day) || Number(gameState.day) || 1;

  if (day === 1) return DAY1_COMPLETE_VOICE_SRC;
  if (day === 2) return DAY2_COMPLETE_VOICE_SRC;

  return "";
}

function playDayOverlayVoice(
  src,
  delayMs = DAY_COMPLETE_VOICE_DELAY_MS,
  playMs = DAY_COMPLETE_VOICE_PLAY_MS,
  volume = DAY_COMPLETE_VOICE_VOLUME
) {
  if (!src) return;

  stopDayOverlayVoice();

  const soundVersion = Number(window.__toobaoSoundStopVersion) || 0;

  dayOverlayVoiceTimer = setTimeout(() => {
    if (soundsAreSuppressed()) return;
    if ((Number(window.__toobaoSoundStopVersion) || 0) !== soundVersion) {
      return;
    }

    const audio = getDayOverlayVoiceAudio();

    audio.src = src;
    audio.volume = volume;
    audio.currentTime = 0;

    audio.play().catch((err) => {
      console.warn("[DayOverlay] Mr. Bao voice blocked:", err);
    });

    dayOverlayVoiceTimer = setTimeout(() => {
      stopDayOverlayVoice();
    }, playMs);
  }, delayMs);
}


function getOverlayAudioForMode(mode) {
  if (mode === "success") {
    return {
      audio: getWinAudio(),
      playMs: WIN_SOUND_PLAY_MS
    };
  }

  if (mode === "gameover_nomoney" || mode === "gameover_stars") {
    return {
      audio: getFailAudio(),
      playMs: FAIL_SOUND_PLAY_MS
    };
  }

  return {
    audio: getDayCompleteAudio(),
    playMs: DAY_COMPLETE_SOUND_PLAY_MS
  };
}

function unlockDayOverlaySoundsOnce() {
  if (dayOverlaySoundsUnlocked) return;
  if (soundsAreSuppressed()) return;

  const audios = [
    getDayCompleteAudio(),
    getWinAudio(),
    getFailAudio()
  ];

  audios.forEach((audio) => {
    const oldVolume = audio.volume;

    audio.volume = 0;
    audio.currentTime = 0;

    audio.play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = oldVolume;
        dayOverlaySoundsUnlocked = true;
      })
      .catch(() => {
        audio.volume = oldVolume;
      });
  });
}

document.addEventListener(
  "pointerdown",
  () => {
    unlockDayOverlaySoundsOnce();
  },
  { once: true }
);

function playDayOverlaySound(mode, snapshot = null) {
  stopDayOverlaySound();

  if (soundsAreSuppressed()) return;

  const soundVersion = Number(window.__toobaoSoundStopVersion) || 0;

  const { audio, playMs } = getOverlayAudioForMode(mode);

  if ((Number(window.__toobaoSoundStopVersion) || 0) !== soundVersion) {
    return;
  }

  audio.currentTime = 0;
  audio.volume = 0.9;

  audio.play().catch((err) => {
    console.warn("[DayOverlay] Overlay sound blocked:", err);
  });

  let voiceDelayMs = 0;
  let voicePlayMs = 0;


  if (mode === "summary") {
    playDayOverlayVoice(
      getDayCompleteVoiceForSnapshot(snapshot),
      DAY_COMPLETE_VOICE_DELAY_MS,
      DAY_COMPLETE_VOICE_PLAY_MS,
      DAY_COMPLETE_VOICE_VOLUME
    );

    voiceDelayMs = DAY_COMPLETE_VOICE_DELAY_MS;
    voicePlayMs = DAY_COMPLETE_VOICE_PLAY_MS;
  }

  if (mode === "success") {
    playDayOverlayVoice(
      WIN_VOICE_SRC,
      RESULT_VOICE_DELAY_MS,
      RESULT_VOICE_PLAY_MS,
      RESULT_VOICE_VOLUME
    );

    voiceDelayMs = RESULT_VOICE_DELAY_MS;
    voicePlayMs = RESULT_VOICE_PLAY_MS;
  }

  if (mode === "gameover_nomoney" || mode === "gameover_stars") {
    playDayOverlayVoice(
      FAIL_VOICE_SRC,
      RESULT_VOICE_DELAY_MS,
      RESULT_VOICE_PLAY_MS,
      RESULT_VOICE_VOLUME
    );

    voiceDelayMs = RESULT_VOICE_DELAY_MS;
    voicePlayMs = RESULT_VOICE_PLAY_MS;
  }

  const totalPlayMs = Math.max(playMs, voiceDelayMs + voicePlayMs);

  dayOverlaySoundTimer = setTimeout(() => {
    stopDayOverlaySound();
  }, totalPlayMs);
}

function clearPopupsBeforeDayOverlay() {
  clearAlgoToasts();

  if (typeof closeAllTaskPopups === "function") {
    closeAllTaskPopups();
  }

  const popupOverlay = document.getElementById("popupOverlay");
  if (popupOverlay) popupOverlay.remove();

  const mrBaoTaskOverlay = document.getElementById("mrBaoTaskOverlay");
  if (mrBaoTaskOverlay) mrBaoTaskOverlay.remove();

  const mrBaoIgnoreOverlay = document.getElementById("mrBaoIgnoreOverlay");
  if (mrBaoIgnoreOverlay) mrBaoIgnoreOverlay.remove();

  const quitConfirmOverlay = document.getElementById("quitConfirmOverlay");
  if (quitConfirmOverlay) quitConfirmOverlay.remove();
}

function getStarComment(level) {
  const comments = {
    1: "1 STAR...SO DISAPPOINTING.",
    2: "2 STARS...MR.BAO IS NOT IMPRESSED YET.",
    3: "3 STARS...OKAY, NOW WE ARE GETTING SOMEWHERE.",
    4: "4 STARS...SO CLOSE. DON'T GET LAZY NOW.",
    5: "5 STARS! MR.BAO IS PROUD...FOR NOW."
  };

  return comments[level] || comments[1];
}

function formatCoins(amount) {
  const n = Number(amount) || 0;
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? String(Math.round(n)) : n.toFixed(2);
}

function formatSignedCoins(amount) {
  const n = Number(amount) || 0;
  const formatted = formatCoins(Math.abs(n));

  if (n < 0) return `-${formatted}`;
  return formatted;
}

function openQuitConfirmPopup() {
  const existing = document.getElementById("quitConfirmOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "quitConfirmOverlay";
  overlay.className = "quitConfirmOverlay";

  overlay.innerHTML = `
    <div class="quitConfirmModal">
      <img class="quitConfirmBg" src="assets/popup/warningmodal.png" alt="">

      <div class="quitConfirmInner">
        <div class="quitConfirmTitle">ARE YOU SURE YOU WANT TO QUIT THE GAME?</div>

        <img class="quitConfirmBao" src="assets/popup/mrbaocrying.png" alt="">

        <div class="quitConfirmButtons">
          <button id="quitNoPlayBtn" class="quitConfirmBtn" type="button">
            <img src="assets/popup/noplaybutton.png" alt="No, play">
          </button>

          <button id="quitYesBtn" class="quitConfirmBtn" type="button">
            <img src="assets/popup/yesquitbutton.png" alt="Yes, quit">
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

// Player clicked Quit Game, so cut off the day-complete overlay audio immediately
stopDayOverlaySound();

playQuitVoice(80);

document.getElementById("quitNoPlayBtn").onclick = () => {
  stopQuitVoice();
  overlay.remove();
};

document.getElementById("quitYesBtn").onclick = () => {
  const yesBtn = document.getElementById("quitYesBtn");
  if (yesBtn) {
    yesBtn.disabled = true;
    yesBtn.style.pointerEvents = "none";
  }

  stopAllGameSounds();
  localStorage.clear();

  setTimeout(() => {
    location.reload();
  }, 50);
};
}

export function showDayOverlay(mode) {
  

  // Fully lock the game under the overlay.
  document.body.classList.add("dayOverlayOpen");
  hideNavBar();

  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;

  clearPopupsBeforeDayOverlay();
  const snapshot = gameState.dayEndSnapshot || {
    day: Number(gameState.day) || 1,
    dayRevenue: Number(gameState.dayRevenue) || 0,
    revenue: Number(gameState.revenue) || 0,
    followers: Number(gameState.followers) || 0,
    views: Number(gameState.views) || 0,
    storeLevel: Number(gameState.storeLevel) || 1
  };

  el.dayOverlay.classList.remove("hidden");
  el.dayOverlay.style.pointerEvents = "auto";
  

  const level = Math.max(1, Math.min(5, snapshot.storeLevel || 1));
const currentDay = Math.max(1, Math.min(3, Number(snapshot.day) || 1));
const nextDayNumber = Math.min(3, currentDay + 1);

forceLoadDayOverlayAssets(mode, nextDayNumber, currentDay);

  let title = "";
  let titleClass = "dayOverlayTitle";
  let message = "";
  let iconHtml = "";
  let buttonsHtml = "";

  if (mode === "summary") {
    title = `DAY ${currentDay} COMPLETE!`;

    iconHtml = `
      <div class="dayIconContainer">
        <img src="assets/day_overlay/day${currentDay}_icon.png" class="dayMainIcon" alt="">
        <img src="assets/day_overlay/orangecheckmark.png" class="dayCheckmarkIcon" alt="">
      </div>
    `;

    buttonsHtml = `
      <div class="dayBtnContainer dayBtnContainer--double">
        <button id="dayQuitBtn" class="dayActionButton" type="button">
          <img src="assets/day_overlay/quitgamebutton.png" alt="Quit game">
        </button>
        <button id="dayNextBtn" class="dayActionButton" type="button">
          <img src="assets/day_overlay/startday${nextDayNumber}button.png" alt="Start next day">
        </button>
      </div>
    `;
  }

  if (mode === "gameover_stars") {
    title = "GAME OVER";
    titleClass = "dayOverlayTitle gameOverTitle";
    message = "YOUR STORE FAILED TO MEET A 5 STAR RATING. YOU WILL BE REMOVED FROM THIS PLATFORM.";

    iconHtml = `
      <div class="dayIconContainer dayIconContainer--result">
        <img src="assets/day_overlay/nostarmrbao.png" class="gameResultAvatar" alt="">
      </div>
    `;

    buttonsHtml = `
      <div class="dayBtnContainer dayBtnContainer--single">
        <button id="dayRestartBtn" class="dayActionButton" type="button">
          <img src="assets/day_overlay/restartgamebutton.png" alt="Restart game">
        </button>
      </div>
    `;
  }

  if (mode === "gameover_nomoney") {
    title = "GAME OVER";
    titleClass = "dayOverlayTitle gameOverTitle";
    message = "YOU ARE OUT OF MONEY. YOUR STORE WILL BE REMOVED FROM TOOBAO. TRY AGAIN NEXT TIME!";

    iconHtml = `
      <div class="dayIconContainer dayIconContainer--result">
        <img src="assets/day_overlay/brokemrbao.png" class="gameResultAvatar" alt="">
      </div>
    `;

    buttonsHtml = `
      <div class="dayBtnContainer dayBtnContainer--single">
        <button id="dayRestartBtn" class="dayActionButton" type="button">
          <img src="assets/day_overlay/restartgamebutton.png" alt="Restart game">
        </button>
      </div>
    `;
  }

  if (mode === "success") {
    title = "CONGRATULATIONS!";
    titleClass = "dayOverlayTitle successTitle";
    message = "YOUR STORE WAS A SUCCESS AND HAS A 5 STAR RATING! YOU ARE WELCOME TO CONTINUE ON THIS PLATFORM.";

    iconHtml = `
      <div class="dayIconContainer dayIconContainer--result">
        <img src="assets/day_overlay/starmrbao.png" class="gameResultAvatar" alt="">
      </div>
    `;

    buttonsHtml = `
      <div class="dayBtnContainer dayBtnContainer--single">
        <button id="dayRestartBtn" class="dayActionButton" type="button">
          <img src="assets/day_overlay/restartgamebutton.png" alt="Restart game">
        </button>
      </div>
    `;
  }


  el.dayOverlay.innerHTML = `
    <div class="overlay">
      <div class="dayOverlayBody">
        <div class="${titleClass}">${title}</div>

        ${message ? `<div class="dayResultMessage">${message}</div>` : ""}

        ${iconHtml}

        ${mode === "summary" ? `<div class="dayStarComment">${getStarComment(level)}</div>` : ""}
        
        <div class="dayStarsRow">
          <img src="${stars(level)}" class="dayStarsImg" alt="Stars">
        </div>

        <div class="dayContentArea">
          <div class="daySummaryLabel">SUMMARY STORE PROGRESS REPORT</div>
          <div class="dayDivider">
            <img src="assets/day_overlay/dividerline.png" alt="">
          </div>

          <div class="dayStatsTable">
            <div class="dayStatRow">
              <span>DAY REVENUE:</span>
              <span class="dayStatValue">
                <img src="assets/ui_icons/coin_icon.png" class="daySmallIcon" alt="">
                ${formatSignedCoins(snapshot.dayRevenue || 0)}
              </span>
            </div>

            <div class="dayStatRow">
              <span>FOLLOWER COUNT:</span>
              <span class="dayStatValue">
                <img src="assets/ui_icons/followers_icon.png" class="daySmallIcon" alt="">
                ${snapshot.followers} followers
              </span>
            </div>

            <div class="dayStatRow">
              <span>VIEW COUNT:</span>
              <span class="dayStatValue">
                <img src="assets/ui_icons/views_icon.png" class="daySmallIcon" alt="">
                ${snapshot.views} views
              </span>
            </div>

            <div class="dayStatRow">
              <span>BALANCE REMAINING:</span>
              <span class="dayStatValue">
                <img src="assets/ui_icons/coin_icon.png" class="daySmallIcon" alt="">
                ${formatCoins(snapshot.revenue)}
              </span>
            </div>
          </div>
        </div>

        ${buttonsHtml}
      </div>
    </div>
  `;
  playDayOverlaySound(mode, snapshot);

  const quitBtn = document.getElementById("dayQuitBtn");
  const nextBtn = document.getElementById("dayNextBtn");
  const restartBtn = document.getElementById("dayRestartBtn");

    function bindOverlayButton(btn, fn) {
    if (!btn) return;

    btn.addEventListener(
      "pointerup",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn();
      },
      { passive: false }
    );
  }

  bindOverlayButton(quitBtn, () => {
    openQuitConfirmPopup();
  });

  bindOverlayButton(nextBtn, () => {
  nextBtn.disabled = true;
  nextBtn.style.pointerEvents = "none";

  initDayOverlay();

  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    nextDay();
  });
});

  bindOverlayButton(restartBtn, () => {
  restartBtn.disabled = true;
  restartBtn.style.pointerEvents = "none";

  stopAllGameSounds();
  localStorage.clear();

  setTimeout(() => {
    location.reload();
  }, 50);
});
}

function forceLoadDayOverlayAssets(mode, nextDayNumber, currentDay) {
  const srcs = [
  "assets/day_overlay/phonepopup.png",
  "assets/day_overlay/restartgamebutton.png",
  "assets/day_overlay/dividerline.png",

  "assets/ui_icons/coin_icon.png",
  "assets/ui_icons/followers_icon.png",
  "assets/ui_icons/views_icon.png",

  "assets/ui_icons/1star.png",
  "assets/ui_icons/2stars.png",
  "assets/ui_icons/3stars.png",
  "assets/ui_icons/4stars.png",
  "assets/ui_icons/5stars.png",

  "assets/popup/warningmodal.png",
  "assets/popup/mrbaocrying.png",
  "assets/popup/noplaybutton.png",
  "assets/popup/yesquitbutton.png"
];

  if (mode === "summary") {
    srcs.push(
      `assets/day_overlay/day${currentDay}_icon.png`,
      "assets/day_overlay/orangecheckmark.png",
      "assets/day_overlay/quitgamebutton.png",
      `assets/day_overlay/startday${nextDayNumber}button.png`
    );
  }

  if (mode === "success") {
    srcs.push("assets/day_overlay/starmrbao.png");
  }

  if (mode === "gameover_stars") {
    srcs.push("assets/day_overlay/nostarmrbao.png");
  }

  if (mode === "gameover_nomoney") {
    srcs.push("assets/day_overlay/brokemrbao.png");
  }

  srcs.forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = src;
  });
}

export function initDayOverlay() {
  stopDayOverlaySound();

  document.body.classList.remove("dayOverlayOpen");

  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;

  el.dayOverlay.style.pointerEvents = "none";
  el.dayOverlay.classList.add("hidden");
  el.dayOverlay.innerHTML = "";
}

window.addEventListener("toobao:stopAllSounds", () => {
  stopDayOverlaySound();
});