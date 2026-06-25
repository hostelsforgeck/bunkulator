// bunku-mascot.js
// Drop-in canvas mascot — two animations, same canvas, random human-like behavior.
// Works on iOS, Android, all browsers. No HTML modification needed.
//
// Frames are loaded from two alpha-preserving WebP sprite atlases
// (bunku-mascot-wave.webp / bunku-mascot-carrot.webp) instead of 148 base64
// stills inlined here — far smaller, cacheable, decoded off the main thread.
// Regenerate the atlases with:  node tools/build-mascot.js

(function () {
  "use strict";

  // ── ATLAS / FRAME GEOMETRY ───────────────────────────────
  // Tiles are downscaled (TILE_W x TILE_H) and laid out left-to-right,
  // top-to-bottom in COLS columns. SRC_W/SRC_H is the ORIGINAL native frame
  // size — kept so the on-canvas fit/letterbox is pixel-identical to before.
  const TILE_W = 320;
  const TILE_H = 180;
  const COLS = 10;
  const SRC_W = 638;
  const SRC_H = 360;

  // ── ANIMATION CONFIGS ────────────────────────────────────
  const ANIM_1 = {
    label: "wave",
    fps: 15,
    width: 638,   // target draw size (drives fit), unchanged from original
    height: 360,
    frameCount: 75,
    atlas: "bunku-mascot-wave.webp",
  };

  const ANIM_2 = {
    label: "carrot",
    fps: 24,
    width: 738,
    height: 460,
    frameCount: 73,
    atlas: "bunku-mascot-carrot.webp",
  };

  const IDLE_MIN_MS = 3500;
  const IDLE_MAX_MS = 7000;
  const GREET_DELAY = 1500;
  const WAVE_WEIGHT = 0.55;
  const MAX_HISTORY = 2;
  // ────────────────────────────────────────────────────────

  const canvas = document.getElementById("bunku-mascot");
  if (!canvas || canvas.tagName !== "CANVAS") {
    console.warn('bunku-mascot: no <canvas id="bunku-mascot"> found.');
    return;
  }

  const ctx = canvas.getContext("2d");
  const ANIMS = [ANIM_1, ANIM_2];

  // One atlas Image per animation.
  const imageBank = new Array(ANIMS.length).fill(null);
  let totalLoaded = 0;

  let playing = false;
  let activeAnim = null;
  let activeIdx = 0;
  let frame = 0;
  let interval = 0;
  let lastTime = null;
  let rafHandle = null;
  let idleTimer = null;
  const history = [];

  function preload() {
    ANIMS.forEach((anim, ai) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        imageBank[ai] = img.complete && img.naturalWidth ? img : null;
        if (++totalLoaded === ANIMS.length) onReady();
      };
      img.src = anim.atlas;
    });
  }

  function ready() {
    return totalLoaded === ANIMS.length;
  }

  function onReady() {
    drawFrame(0, 0);
    schedulePlay(GREET_DELAY);
  }

  function drawFrame(animIdx, frameNum) {
    const atlas = imageBank[animIdx];
    if (!atlas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const anim = ANIMS[animIdx];
    const targetWidth = anim.width || canvas.width;
    const targetHeight = anim.height || canvas.height;
    // Aspect uses the ORIGINAL native frame size so fit math matches the
    // pre-atlas behavior exactly (tiles share the same aspect, downscaled).
    const imgAspect = SRC_W / SRC_H;
    const targetAspect = targetWidth / targetHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (imgAspect > targetAspect) {
      drawHeight = targetHeight;
      drawWidth = drawHeight * imgAspect;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = targetWidth;
      drawHeight = drawWidth / imgAspect;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = (canvas.height - drawHeight) / 2;
    }

    // Source sub-rectangle within the atlas for this frame.
    const col = frameNum % COLS;
    const row = (frameNum / COLS) | 0;
    const sx = col * TILE_W;
    const sy = row * TILE_H;

    ctx.drawImage(
      atlas,
      sx, sy, TILE_W, TILE_H,
      offsetX, offsetY, drawWidth, drawHeight
    );
  }

  function pickAnim() {
    if (
      history.length >= MAX_HISTORY &&
      history
        .slice(-MAX_HISTORY)
        .every((v) => v === history[history.length - 1])
    ) {
      return history[history.length - 1] === 0 ? 1 : 0;
    }
    return Math.random() < WAVE_WEIGHT ? 0 : 1;
  }

  function randomIdle() {
    const base = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    return Math.random() < 0.18 ? base * 0.35 : base;
  }

  function schedulePlay(delay) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(
      playOnce,
      delay !== undefined ? delay : randomIdle()
    );
  }

  // ── Fully halt all animation and timer activity ──────────
  function stopAll() {
    cancelAnimationFrame(rafHandle);
    clearTimeout(idleTimer);
    rafHandle = null;
    idleTimer = null;
    playing = false;
    lastTime = null;
  }

  // ── Resume from a guaranteed-clean state ─────────────────
  function resume(delay) {
    stopAll();
    if (ready()) {
      drawFrame(0, 0);
      schedulePlay(delay);
    }
  }

  function playOnce(forceAnimIdx) {
    if (playing) return;

    activeIdx = forceAnimIdx !== undefined ? forceAnimIdx : pickAnim();
    activeAnim = ANIMS[activeIdx];
    interval = 1000 / activeAnim.fps;

    history.push(activeIdx);
    if (history.length > MAX_HISTORY + 1) history.shift();

    playing = true;
    frame = 0;
    lastTime = null;
    rafHandle = requestAnimationFrame(tick);
  }

  function tick(ts) {
    if (lastTime === null) lastTime = ts;
    const elapsed = ts - lastTime;

    if (elapsed >= interval) {
      lastTime = ts - (elapsed % interval);
      drawFrame(activeIdx, frame);
      frame++;

      if (frame >= activeAnim.frameCount) {
        playing = false;
        cancelAnimationFrame(rafHandle);
        drawFrame(0, 0);
        schedulePlay();
        return;
      }
    }
    rafHandle = requestAnimationFrame(tick);
  }

  // ── Tab visibility (switch tabs, minimize) ───────────────
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAll();
    } else {
      resume(1000);
    }
  });

  // ── Page lifecycle — handles bfcache (close & reopen) ────
  window.addEventListener("pagehide", () => {
    stopAll();
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      resume(500);
    }
  });

  preload();
})();
