// js/pages/marketingP5Live.js

let marketingP5Instance = null;
let marketingFaceMesh = null;
let marketingVideo = null;
let marketingDetecting = false;
let marketingGotFacesCallback = null;

window.__marketingSmileScore = 0;
window.__marketingSmileZone = "red";
window.__marketingGreenSmileSeconds = 0;
window.__marketingCameraReady = false;
window.__marketingP5Video = null;
window.__marketingIsStreaming = false;
window.__marketingFaceDetected = false;
window.__marketingP5PageActive = false;

function startMarketingFaceDetect() {
  if (!marketingFaceMesh || !marketingVideo || !marketingGotFacesCallback) return;
  if (marketingDetecting) return;

  try {
    marketingFaceMesh.detectStart(marketingVideo, marketingGotFacesCallback);
    marketingDetecting = true;
  } catch (err) {
    console.warn("[Marketing P5] Could not start FaceMesh:", err);
  }
}

function stopMarketingFaceDetect() {
  if (!marketingFaceMesh || !marketingDetecting) return;

  try {
    marketingFaceMesh.detectStop?.();
  } catch (err) {
    console.warn("[Marketing P5] Could not stop FaceMesh:", err);
  }

  marketingDetecting = false;
}

export function setMarketingP5PageActive(isActive) {
  window.__marketingP5PageActive = !!isActive;

  if (isActive) {
    if (!marketingP5Instance) {
      initMarketingP5Live();
      return;
    }

    const videoEl = marketingVideo?.elt;

    if (videoEl && videoEl.paused) {
      videoEl.play()
        .then(() => {
          startMarketingFaceDetect();
        })
        .catch(() => {});

      return;
    }

    startMarketingFaceDetect();
  } else {
    window.__marketingIsStreaming = false;
    window.__marketingSmileScore = 0;
    window.__marketingSmileZone = "red";
    window.__marketingFaceDetected = false;

    stopMarketingFaceDetect();
  }
}

export function prewarmMarketingP5Live() {
  if (marketingP5Instance) return;

  window.__marketingP5PageActive = false;
  initMarketingP5Live();
}

export function initMarketingP5Live() {
  const host = document.getElementById("marketingP5Camera");
  if (!host) return;

  if (!window.p5) {
    console.warn("[Marketing P5] p5.js is not loaded yet.");
    return;
  }

  if (!window.ml5) {
    console.warn("[Marketing P5] ml5.js is not loaded yet.");
    return;
  }

  if (marketingP5Instance) return;

  marketingP5Instance = new window.p5((sketch) => {
    let faceMesh;
    let video;
    let faces = [];
    let liveMessageBg = null;

    let smileScore = 0;
    let surveillancePulse = 0;
    let scanY = 0;
    let cameraError = "";

    // Baseline helps remove distance/proximity problems.
    // It learns the player's neutral mouth width, then scores smiles relative to that.
    let neutralMouthRatio = null;
    let neutralFrames = 0;

    const options = {
      maxFaces: 1,
      refineLandmarks: false,
      flipped: false
    };

    sketch.preload = () => {
      faceMesh = window.ml5.faceMesh(options);

      // Safe image loading: if the file is missing, the sketch still works.
      liveMessageBg = sketch.loadImage(
        "assets/marketing/livestreammessagebg.png",
        () => {},
        () => {
          liveMessageBg = null;
          console.warn("[Marketing P5] livestreammessagebg.png not found. Using fallback box.");
        }
      );
    };

    sketch.setup = () => {
      const canvas = sketch.createCanvas(412, 375);
      canvas.parent(host);
      canvas.class("marketingP5Canvas");

      sketch.pixelDensity(1);
      sketch.frameRate(24);
      sketch.textFont("Tiny5");

      const constraints = {
  video: {
    facingMode: "user",
    width: { ideal: 320 },
    height: { ideal: 240 }
  },
  audio: false
};

video = sketch.createCapture(constraints);
video.size(320, 240);
video.hide();

      window.__marketingP5Video = video;

      const videoEl = video.elt;
      videoEl.setAttribute("playsinline", "");
      videoEl.setAttribute("muted", "");
      videoEl.muted = true;

      videoEl.playsInline = true;
videoEl.autoplay = true;
videoEl.muted = true;

videoEl.play().catch(() => {
  // Safari may wait for permission/metadata.
});

      videoEl.onloadedmetadata = () => {
  videoEl.play()
    .then(() => {
      window.__marketingCameraReady = true;
      cameraError = "";

      if (window.__marketingP5PageActive) {
        startMarketingFaceDetect();
      }
    })
    .catch((err) => {
      console.warn("[Marketing P5] Camera play failed:", err);
      cameraError = "camera blocked";
      window.__marketingCameraReady = false;
    });
};

      videoEl.oncanplay = () => {
  window.__marketingCameraReady = true;
  cameraError = "";

  if (window.__marketingP5PageActive) {
    startMarketingFaceDetect();
  }
};

      videoEl.onerror = () => {
        cameraError = "camera error";
        window.__marketingCameraReady = false;
      };

      marketingFaceMesh = faceMesh;
marketingVideo = video;
marketingGotFacesCallback = gotFaces;

if (window.__marketingP5PageActive) {
  videoEl.play().catch(() => {});
  startMarketingFaceDetect();
}
    };

    function gotFaces(results) {
      faces = results || [];
      window.__marketingFaceDetected = faces.length > 0;
    }

    function cameraIsReady() {
      return (
        video &&
        video.elt &&
        video.elt.readyState >= 2 &&
        video.width > 0 &&
        video.height > 0
      );
    }

function drawVideoFillHeight(video, x, y, w, h) {
  const vw = video.width || video.elt.videoWidth || 320;
const vh = video.height || video.elt.videoHeight || 240;

  const videoRatio = vw / vh;

  // Fill the full canvas height.
  const drawH = h;
  const drawW = h * videoRatio;

  // Negative = visually moves camera left.
  // Positive = visually moves camera right.
  // Because the camera is mirrored, adjust this if it feels opposite.
  const xShift = -18;

  const drawX = x + (w - drawW) / 2 + xShift;
  const drawY = y;

  sketch.image(video, drawX, drawY, drawW, drawH);
}

    function dist(a, b) {
      if (!a || !b) return 0;
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function clamp01(v) {
      return Math.max(0, Math.min(1, Number(v) || 0));
    }

    function normalize(value, min, max) {
      return clamp01((value - min) / (max - min));
    }

    function calculateLandmarkSmile() {
      if (!faces.length) return 0;

      const face = faces[0];
      const kp = face.keypoints || [];

      // Main MediaPipe FaceMesh mouth landmarks.
      const leftMouth = kp[61];
      const rightMouth = kp[291];
      const upperLip = kp[13];
      const lowerLip = kp[14];

      // Face scale landmarks. These make the score work from around 1 foot away.
      const leftCheek = kp[234];
      const rightCheek = kp[454];
      const leftEye = kp[33];
      const rightEye = kp[263];

      if (!leftMouth || !rightMouth || !upperLip || !lowerLip) {
        return 0;
      }

      const cheekWidth = dist(leftCheek, rightCheek);
      const eyeWidth = dist(leftEye, rightEye);

      // Use face width first. Eye width is backup.
      const faceWidth = cheekWidth > 20 ? cheekWidth : eyeWidth * 2.35;
      if (!faceWidth || faceWidth <= 20) return 0;

      const mouthWidth = dist(leftMouth, rightMouth);
      const mouthOpen = dist(upperLip, lowerLip);

      const mouthRatio = mouthWidth / faceWidth;
      const openRatio = mouthOpen / faceWidth;

      const mouthCenterY = (upperLip.y + lowerLip.y) / 2;
      const cornerAvgY = (leftMouth.y + rightMouth.y) / 2;

      // Positive when corners are lifted compared to mouth center.
      const cornerLiftRatio = (mouthCenterY - cornerAvgY) / faceWidth;

      // Learn neutral baseline mostly when not streaming or when score is low.
      // This prevents distance from becoming the main factor.
      if (neutralMouthRatio === null) {
        neutralMouthRatio = mouthRatio;
      }

      if (!window.__marketingIsStreaming && neutralFrames < 90) {
        neutralMouthRatio = neutralMouthRatio * 0.94 + mouthRatio * 0.06;
        neutralFrames++;
      }

      // Also slowly adjust baseline downward if a smaller neutral mouth is seen.
      if (mouthRatio < neutralMouthRatio) {
        neutralMouthRatio = neutralMouthRatio * 0.9 + mouthRatio * 0.1;
      }

      const widthIncrease = mouthRatio - neutralMouthRatio;

      // Strict scoring:
      // Big green score requires a wider mouth, a little mouth opening, and lifted corners.
      const widthScore = normalize(widthIncrease, 0.035, 0.115);
      const openScore = normalize(openRatio, 0.018, 0.060);
      const liftScore = normalize(cornerLiftRatio, 0.000, 0.035);

      let rawScore =
        widthScore * 0.58 +
        openScore * 0.18 +
        liftScore * 0.24;

      // Hard penalty if mouth is not actually wider than baseline.
      if (widthIncrease < 0.025) rawScore *= 0.18;

      // Hard penalty if corners are not lifted.
      if (cornerLiftRatio < -0.002) rawScore *= 0.45;

      // Make low/no smile stay red.
      rawScore = rawScore < 0.28 ? 0 : rawScore;

      return clamp01(rawScore);
    }

    function getZone(score) {
      // red = neutral / small smile
      // yellow = visible smile
      // green = big obvious smile
      if (score >= 0.88) return "green";
      if (score >= 0.56) return "yellow";
      return "red";
    }

    function drawCameraLoading() {
      sketch.background(255, 187, 135);
      sketch.fill(77, 31, 29);
      sketch.textAlign(sketch.CENTER, sketch.CENTER);
      sketch.textSize(18);

      if (cameraError) {
        sketch.text("CAMERA BLOCKED", sketch.width / 2, sketch.height / 2 - 12);
        sketch.textSize(12);
        sketch.text("ALLOW CAMERA PERMISSION", sketch.width / 2, sketch.height / 2 + 14);
      } else {
        sketch.text("CAMERA LOADING...", sketch.width / 2, sketch.height / 2);
      }

      sketch.textAlign(sketch.LEFT, sketch.BASELINE);
    }

    function drawMessageBox(message, boxW = 330, boxH = 38, boxY = 58) {
      const boxX = (sketch.width - boxW) / 2;

      sketch.noStroke();

      if (liveMessageBg) {
        sketch.image(liveMessageBg, boxX, boxY, boxW, boxH);
      } else {
        sketch.fill(77, 31, 29, 185);
        sketch.rect(boxX, boxY, boxW, boxH);
      }

      sketch.fill(255, 247, 239);
      sketch.textAlign(sketch.CENTER, sketch.CENTER);
      sketch.textSize(15);
      sketch.text(message, sketch.width / 2, boxY + boxH / 2 + 1);
      sketch.textAlign(sketch.LEFT, sketch.BASELINE);
    }

    function drawFaceMissingMessage() {
      drawMessageBox("MOVE FACE INTO CAMERA", 300, 38, 58);
    }

    function drawSmileMeter(score, zone) {
      const meterX = 20;
      const meterY = sketch.height - 56;

      // Shorter meter so it does not run behind the livestream button.
      const meterW = 145;
      const meterH = 16;

      let zoneColor;

      if (zone === "green") {
        zoneColor = sketch.color(82, 190, 95);
      } else if (zone === "yellow") {
        zoneColor = sketch.color(245, 198, 65);
      } else {
        zoneColor = sketch.color(210, 70, 55);
      }

      sketch.noStroke();

      // Title above meter.
      sketch.fill(255, 247, 239);
      sketch.textSize(15);
      sketch.text("SMILE METER", meterX, meterY - 8);

      // Meter background.
      sketch.fill(77, 31, 29, 175);
      sketch.rect(meterX, meterY, meterW, meterH);

      // Meter fill.
      sketch.fill(zoneColor);
      sketch.rect(meterX + 3, meterY + 3, (meterW - 6) * score, meterH - 6);

      // Status text below the meter, slightly smaller.
      sketch.fill(255, 247, 239);
      sketch.textSize(13);

      let statusText = "LOW SMILE";
      if (zone === "green") statusText = "BIG SMILE";
      if (zone === "yellow") statusText = "SMILE BIGGER";

      sketch.text(statusText, meterX, meterY + meterH + 16);
    }

    function drawLiveMessage(zone) {
      if (!window.__marketingIsStreaming) return;

      let message = "";

      if (zone === "green") {
        message = "BIG SMILE! BIG SMILE = MORE VIEWS!";
      } else if (zone === "yellow") {
        message = "ALMOST THERE! SMILE BIGGER!";
      } else {
        message = "SMILE TO GENERATE MORE VIEWS!";
      }

      drawMessageBox(message, 330, 38, 58);
    }

    function drawOverlay(score, zone) {
      surveillancePulse += 0.04;
      scanY = (scanY + 1.2) % sketch.height;

      // Keep the camera clear.
      sketch.noStroke();
      sketch.fill(255, 120, 60, 10);
      sketch.rect(0, 0, sketch.width, sketch.height);

      // Subtle scan line.
      sketch.fill(255, 255, 255, 28);
      sketch.rect(0, scanY, sketch.width, 2);

      // Recording label.
      const pulse = 180 + Math.sin(surveillancePulse) * 55;
      sketch.fill(255, 50, 30, pulse);
      sketch.circle(28, 28, 14);

      sketch.fill(255, 247, 239);
      sketch.textSize(15);
      sketch.text("LIVE", 46, 33);

      if (!window.__marketingFaceDetected) {
        drawFaceMissingMessage();
      }

      drawSmileMeter(score, zone);
      drawLiveMessage(zone);
    }

    sketch.draw = () => {
  if (window.__marketingP5PageActive === false) {
    return;
  }

  sketch.background(30, 15, 12);

  if (cameraIsReady()) {
    window.__marketingCameraReady = true;
    sketch.drawingContext.imageSmoothingEnabled = true;
      
sketch.push();
sketch.translate(sketch.width, 0);
sketch.scale(-1, 1);
drawVideoFillHeight(video, 0, 0, sketch.width, sketch.height);
sketch.pop();

        const rawScore = calculateLandmarkSmile();

        // Harder to rise, faster to fall.
        smileScore = rawScore > smileScore
          ? sketch.lerp(smileScore, rawScore, 0.12)
          : sketch.lerp(smileScore, rawScore, 0.46);
      } else {
        window.__marketingCameraReady = false;
        smileScore = sketch.lerp(smileScore, 0, 0.35);
        drawCameraLoading();
      }

      const zone = getZone(smileScore);

      window.__marketingSmileScore = smileScore;
      window.__marketingSmileZone = zone;

      drawOverlay(smileScore, zone);
    };
  });
}

export function destroyMarketingP5Live() {
  stopMarketingFaceDetect();

  try {
    const video = window.__marketingP5Video;

    if (video?.elt?.srcObject) {
      video.elt.srcObject.getTracks().forEach((track) => track.stop());
    }

    if (video) {
      video.remove();
    }
  } catch (err) {
    console.warn("[Marketing P5] Camera cleanup failed:", err);
  }

  if (marketingP5Instance) {
    marketingP5Instance.remove();
    marketingP5Instance = null;
  }

  marketingFaceMesh = null;
  marketingVideo = null;
  marketingGotFacesCallback = null;
  marketingDetecting = false;

  window.__marketingP5Video = null;
  window.__marketingSmileScore = 0;
  window.__marketingSmileZone = "red";
  window.__marketingGreenSmileSeconds = 0;
  window.__marketingCameraReady = false;
  window.__marketingIsStreaming = false;
  window.__marketingFaceDetected = false;
  window.__marketingP5PageActive = false;
}