/* ================= DOM ================= */
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const wheelSection = document.getElementById("wheelSection");
const revealScreen = document.getElementById("revealScreen");
const finalScreen = document.getElementById("finalScreen");
const finalBanner = document.getElementById("finalBanner");

/* RESUME POPUP */
const resumeOverlay = document.getElementById("resumeOverlay");
const resumeYes = document.getElementById("resumeYes");
const resumeNo = document.getElementById("resumeNo");

/* MASTER VOLUME */
const volumeSlider = document.getElementById("volumeSlider");

const video = document.getElementById("playerVideo");
const card = document.getElementById("playerCard");
const statusText = document.getElementById("statusText");

const spinBtn = document.getElementById("spinBtn");
const soldBtn = document.getElementById("soldBtn");
const unsoldBtn = document.getElementById("unsoldBtn");
const decisionButtons = document.getElementById("decisionButtons");
const undoBtn = document.getElementById("undoBtn");

/* ================= AUDIO ================= */
const spinSound = new Audio("sounds/spin.mp3");
const revealSound = new Audio("sounds/reveal.mp3");
const cardHitSound = new Audio("sounds/card-hit.mp3");
const bgMusic = new Audio("sounds/bg-music.mp3");
const soldSound = new Audio("sounds/sold.mp3");
const unsoldSound = new Audio("sounds/unsold.mp3");

bgMusic.loop = true;

/* ================= GLOBAL FLAGS ================= */
let isVideoPlaying = false;

/* ================= MASTER VOLUME ================= */
function setMasterVolume(v) {
  const vol = Math.max(0, Math.min(1, v));
  bgMusic.volume = vol;
  spinSound.volume = vol;
  revealSound.volume = vol;
  cardHitSound.volume = vol;
  soldSound.volume = vol;
  unsoldSound.volume = vol;
}

volumeSlider.value = 45;
setMasterVolume(0.45);

volumeSlider.addEventListener("input", () => {
  // ❗ Do NOT start bg music here
  setMasterVolume(volumeSlider.value / 100);
});

/* ================= AUDIO HELPERS ================= */
function fadeInBgMusic(targetVolume = 0.25, duration = 1500) {
  if (isVideoPlaying) return; // ❗ HARD BLOCK

  const steps = 30;
  const stepTime = duration / steps;
  const volumeStep = targetVolume / steps;

  bgMusic.volume = 0;
  bgMusic.play().catch(() => {});

  let step = 0;
  const interval = setInterval(() => {
    if (isVideoPlaying) {
      clearInterval(interval);
      return;
    }
    step++;
    bgMusic.volume = Math.min(step * volumeStep, targetVolume);
    if (step >= steps) clearInterval(interval);
  }, stepTime);
}

function playForDuration(audio, duration = 3000) {
  audio.currentTime = 0;
  audio.play().catch(() => {});
  setTimeout(() => {
    audio.pause();
    audio.currentTime = 0;
  }, duration);
}

/* ================= AUTO SAVE ================= */
function saveAuctionState() {
  localStorage.setItem("auctionState", JSON.stringify({
    currentPool,
    unsoldPlayers,
    historyStack,
    rotation
  }));
}

function loadAuctionState() {
  const saved = localStorage.getItem("auctionState");
  if (!saved) return false;

  const state = JSON.parse(saved);
  currentPool = state.currentPool;
  unsoldPlayers = state.unsoldPlayers;
  historyStack.length = 0;
  historyStack.push(...state.historyStack);
  rotation = state.rotation || 0;

  undoBtn.style.display = historyStack.length ? "block" : "none";
  updateFinalBanner();
  return true;
}

/* ================= STATE ================= */
let players = [];
let currentPool = [];
let unsoldPlayers = [];
let rotation = 0;
let spinning = false;
let highlightIndex = null;

const historyStack = [];
undoBtn.style.display = "none";

/* ================= FINAL PICKS ================= */
function updateFinalBanner() {
  if (!finalBanner) return;
  finalBanner.style.display = currentPool.length <= 5 ? "block" : "none";
}

/* ================= LOAD PLAYERS (WITH RESUME PROMPT) ================= */
fetch("players.json")
  .then(r => r.json())
  .then(data => {
    players = [...data];

    if (localStorage.getItem("auctionState")) {
      resumeOverlay.style.display = "flex";

      resumeYes.onclick = () => {
        loadAuctionState();
        resumeOverlay.style.display = "none";
        drawWheel();
        updateFinalBanner();
      };

      resumeNo.onclick = () => {
        localStorage.removeItem("auctionState");
        currentPool = [...players];
        resumeOverlay.style.display = "none";
        drawWheel();
        updateFinalBanner();
      };
    } else {
      currentPool = [...players];
      drawWheel();
      updateFinalBanner();
    }
  });

/* ================= DRAW WHEEL ================= */
function drawWheel() {
  if (!currentPool.length) return;

  const r = canvas.width / 2;
  const slice = (2 * Math.PI) / currentPool.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(rotation);

  currentPool.forEach((p, i) => {
    ctx.beginPath();
    ctx.fillStyle = i === highlightIndex ? "#fff59d" : (i % 2 ? "#d4a017" : "#f5c542");
    ctx.shadowBlur = i === highlightIndex ? 30 : 0;
    ctx.shadowColor = "gold";
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, slice * i, slice * (i + 1));
    ctx.fill();

    ctx.save();
    ctx.rotate(slice * i + slice / 2);
    ctx.fillStyle = "#000";
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText(p.name, r - 10, 5);
    ctx.restore();
  });

  ctx.restore();
}

/* ================= SPIN ================= */
spinBtn.onclick = () => {
  if (spinning) return;
  spinning = true;

  if (!isVideoPlaying) {
    bgMusic.play().catch(() => {});
    bgMusic.volume = 0.2;
  }

  spinSound.currentTime = 0;
  spinSound.play();

  const isFinal = currentPool.length <= 5;
  const spinAmt = isFinal ? Math.random() * 6 + 6 : Math.random() * 10 + 10;
  const duration = isFinal ? 1800 : 3000;

  const startRot = rotation;
  const start = performance.now();

  function animate(t) {
    const p = Math.min((t - start) / duration, 1);
    rotation = startRot + spinAmt * (1 - Math.pow(1 - p, 3));
    drawWheel();

    if (p < 1) requestAnimationFrame(animate);
    else {
      spinning = false;
      spinSound.pause();
      determineWinner();
    }
  }

  requestAnimationFrame(animate);
};

/* ================= POINTER → SLICE ================= */
function determineWinner() {
  const slice = (2 * Math.PI) / currentPool.length;
  let norm = rotation % (2 * Math.PI);
  if (norm < 0) norm += 2 * Math.PI;

  const pointer = (3 * Math.PI / 2 - norm + 2 * Math.PI) % (2 * Math.PI);
  highlightIndex = Math.floor(pointer / slice);
  drawWheel();

  setTimeout(selectPlayer, 1500);
}

/* ================= SELECT PLAYER ================= */
function selectPlayer() {
  const player = currentPool.splice(highlightIndex, 1)[0];
  highlightIndex = null;

  historyStack.push({
    player,
    pool: [...currentPool],
    unsold: [...unsoldPlayers]
  });

  wheelSection.style.display = "none";
  revealScreen.style.display = "flex";

  decisionButtons.style.display = "none";
  statusText.style.display = "none";
  revealScreen.classList.remove("sold-bg", "unsold-bg");

  /* 🔇 HARD STOP BG MUSIC */
  isVideoPlaying = true;
  bgMusic.pause();
  bgMusic.currentTime = 0;

  revealSound.currentTime = 0;
  revealSound.play();

  video.src = player.video;
  video.style.display = "block";
  video.play();

  setTimeout(() => stopVideo(player), 10000);
}

/* ================= AFTER VIDEO ================= */
function stopVideo(player) {
  isVideoPlaying = false;

  video.pause();
  revealSound.pause();
  video.style.display = "none";

  card.src = player.card;
  card.style.display = "block";
  card.className = "fade-in";

  cardHitSound.currentTime = 0;
  cardHitSound.play();

  setTimeout(() => fadeInBgMusic(0.25, 1500), 1500);
  decisionButtons.style.display = "flex";
}

/* ================= SOLD / UNSOLD ================= */
soldBtn.onclick = () => decision(false);
unsoldBtn.onclick = () => decision(true);

function decision(isUnsold) {
  decisionButtons.style.display = "none";

  statusText.innerText = isUnsold ? "UNSOLD" : "SOLD";
  statusText.style.display = "block";
  revealScreen.classList.add(isUnsold ? "unsold-bg" : "sold-bg");

  if (isUnsold) {
    unsoldPlayers.push(historyStack.at(-1).player);
    playForDuration(unsoldSound, 3000);
  } else {
    playForDuration(soldSound, 3000);
  }

  undoBtn.style.display = "block";
  saveAuctionState();

  setTimeout(() => {
    revealScreen.style.display = "none";
    revealScreen.className = "";
    card.style.display = "none";
    statusText.style.display = "none";

    bgMusic.volume = volumeSlider.value / 100;

    if (!currentPool.length) {
      showEndScreen();
    } else {
      wheelSection.style.display = "flex";
      wheelSection.classList.add("fade-in");
      drawWheel();
      updateFinalBanner();
    }
  }, 2000);
}

/* ================= UNDO ================= */
undoBtn.onclick = () => {
  if (!historyStack.length) return;

  const last = historyStack.pop();
  currentPool = [last.player, ...last.pool];
  unsoldPlayers = [...last.unsold];

  if (!historyStack.length) undoBtn.style.display = "none";
  saveAuctionState();

  revealScreen.style.display = "none";
  finalScreen.style.display = "none";
  wheelSection.style.display = "flex";
  wheelSection.classList.add("fade-in");

  drawWheel();
  updateFinalBanner();
};

/* ================= FINAL SCREEN ================= */
function showEndScreen() {
  unsoldPlayers.sort((a, b) => b.rating - a.rating);

  finalScreen.innerHTML = `
    <h1>AUCTION ROUND COMPLETE</h1>
    <div class="final-buttons">
      <button class="btn danger" onclick="endAuction()">END AUCTION</button>
      ${
        unsoldPlayers.length
          ? `<button class="btn success" onclick="startUnsoldAuction()">START UNSOLD AUCTION</button>`
          : ""
      }
    </div>
    ${
      unsoldPlayers.length
        ? `<div class="unsold-table">
            <table>
              <tr><th>PLAYER</th><th>RATING</th></tr>
              ${unsoldPlayers.map(p => `<tr><td>${p.name}</td><td>${p.rating}</td></tr>`).join("")}
            </table>
          </div>`
        : ""
    }
  `;

  finalScreen.style.display = "block";
  finalScreen.classList.add("fade-in");
}

function startUnsoldAuction() {
  finalScreen.style.display = "none";
  currentPool = [...unsoldPlayers];
  unsoldPlayers = [];
  saveAuctionState();

  wheelSection.style.display = "flex";
  wheelSection.classList.add("fade-in");
  drawWheel();
  updateFinalBanner();
}

function endAuction() {
  localStorage.removeItem("auctionState");
  finalScreen.innerHTML = `<h1>🏁 AUCTION IS OVER</h1><p>THANK YOU FOR ATTENDING</p>`;
}

/* ================= KEYBOARD ================= */
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") e.preventDefault();
  if (video.style.display === "block") return;

  switch (e.key) {
    case " ":
      spinBtn.click();
      break;
    case "s":
      soldBtn.click();
      break;
    case "u":
      unsoldBtn.click();
      break;
    case "z":
      undoBtn.click();
      break;
    case "+":
    case "=":
      volumeSlider.value = Math.min(100, +volumeSlider.value + 5);
      setMasterVolume(volumeSlider.value / 100);
      break;
    case "-":
    case "_":
      volumeSlider.value = Math.max(0, +volumeSlider.value - 5);
      setMasterVolume(volumeSlider.value / 100);
      break;
    case "e":
      endAuction();
      break;
  }
});
