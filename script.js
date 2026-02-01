const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const wheelSection = document.getElementById("wheelSection");
const revealScreen = document.getElementById("revealScreen");
const finalScreen = document.getElementById("finalScreen");

const video = document.getElementById("playerVideo");
const card = document.getElementById("playerCard");
const statusText = document.getElementById("statusText");

const spinBtn = document.getElementById("spinBtn");
const soldBtn = document.getElementById("soldBtn");
const unsoldBtn = document.getElementById("unsoldBtn");
const decisionButtons = document.getElementById("decisionButtons");
const undoBtn = document.getElementById("undoBtn");

/* AUDIO */
const spinSound = new Audio("sounds/spin.mp3");
const revealSound = new Audio("sounds/reveal.mp3");
const cardHitSound = new Audio("sounds/card-hit.mp3");
const bgMusic = new Audio("sounds/bg-music.mp3");

bgMusic.loop = true;
bgMusic.volume = 0.45;

let players = [];
let currentPool = [];
let unsoldPlayers = [];
let selectedPlayer = null;
let lastDecision = null;

let rotation = 0;
let spinning = false;
let highlightIndex = null;

/* LOAD PLAYERS */
fetch("players.json")
  .then(r => r.json())
  .then(data => {
    players = [...data];
    currentPool = [...players];
    drawWheel();
  });

/* DRAW WHEEL */
function drawWheel() {
  if (!currentPool.length) return;

  const r = canvas.width / 2;
  const sliceAngle = (2 * Math.PI) / currentPool.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(rotation);

  currentPool.forEach((p, i) => {
    ctx.beginPath();

    if (i === highlightIndex) {
      ctx.fillStyle = "#fff59d";
      ctx.shadowColor = "gold";
      ctx.shadowBlur = 30;
    } else {
      ctx.fillStyle = i % 2 ? "#d4a017" : "#f5c542";
      ctx.shadowBlur = 0;
    }

    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, sliceAngle * i, sliceAngle * (i + 1));
    ctx.fill();

    ctx.save();
    ctx.rotate(sliceAngle * i + sliceAngle / 2);
    ctx.fillStyle = "#000";
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText(p.name, r - 10, 5);
    ctx.restore();
  });

  ctx.restore();
}

/* SPIN */
spinBtn.onclick = () => {
  if (spinning) return;
  spinning = true;

  bgMusic.play().catch(()=>{});
  bgMusic.volume = 0.2;

  spinSound.currentTime = 0;
  spinSound.play().catch(()=>{});

  const startRotation = rotation;
  const spinAmount = Math.random() * 10 + 10;
  const start = performance.now();

  function animate(t) {
    const progress = Math.min((t - start) / 3000, 1);
    rotation = startRotation + spinAmount * (1 - Math.pow(1 - progress, 3));
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      spinning = false;
      spinSound.pause();
      determineWinner(); // IMPORTANT
    }
  }

  requestAnimationFrame(animate);
};

/* ================= POINTER → SLICE FIX ================= */
function determineWinner() {
  const sliceAngle = (2 * Math.PI) / currentPool.length;

  // Normalize rotation
  let normalizedRotation = rotation % (2 * Math.PI);
  if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;

  /*
    Canvas:
    0 rad = 3 o'clock
    Pointer = 12 o'clock (downward arrow)
    12 o'clock = 3π/2
  */
  const pointerAngle =
    (3 * Math.PI / 2 - normalizedRotation + 2 * Math.PI) % (2 * Math.PI);

  highlightIndex = Math.floor(pointerAngle / sliceAngle);

  drawWheel();

  // Highlight for 1.5s
  setTimeout(() => {
    selectPlayer();
  }, 1500);
}

/* SELECT PLAYER (DO NOT RECALCULATE INDEX) */
function selectPlayer() {
  selectedPlayer = currentPool.splice(highlightIndex, 1)[0];
  highlightIndex = null;

  wheelSection.style.display = "none";
  revealScreen.style.display = "flex";

  bgMusic.volume = 0; // mute during video
  revealSound.play().catch(()=>{});

  video.src = selectedPlayer.video;
  video.style.display = "block";
  video.play();

  setTimeout(stopVideo, 10000);
  video.onended = stopVideo;
}

function stopVideo() {
  video.pause();
  revealSound.pause();
  video.style.display = "none";

  bgMusic.volume = 0.25; // low during card
  showCard();
}

function showCard() {
  card.src = selectedPlayer.card;
  card.style.display = "block";
  card.className = "fade-in";
  cardHitSound.play().catch(()=>{});
  decisionButtons.style.display = "flex";
}

/* SOLD / UNSOLD */
soldBtn.onclick = () => decision(false);
unsoldBtn.onclick = () => decision(true);

function decision(isUnsold) {
  decisionButtons.style.display = "none";
  statusText.innerText = isUnsold ? "UNSOLD" : "SOLD";
  statusText.style.display = "block";
  revealScreen.classList.add(isUnsold ? "unsold-bg" : "sold-bg");

  lastDecision = { player: selectedPlayer, unsold: isUnsold };
  undoBtn.style.display = "block";

  setTimeout(() => {
    revealScreen.classList.add("fade-out");

    setTimeout(() => {
      revealScreen.style.display = "none";
      revealScreen.className = "";
      card.style.display = "none";
      statusText.style.display = "none";
      bgMusic.volume = 0.45;

      if (isUnsold) unsoldPlayers.push(selectedPlayer);

      if (!currentPool.length) {
        showEndScreen();
      } else {
        wheelSection.style.display = "flex";
        drawWheel();
      }
    }, 600);
  }, 2000);
}

/* UNDO */
undoBtn.onclick = () => {
  if (!lastDecision) return;

  currentPool.unshift(lastDecision.player);
  if (lastDecision.unsold) unsoldPlayers.pop();

  lastDecision = null;
  undoBtn.style.display = "none";

  wheelSection.style.display = "flex";
  revealScreen.style.display = "none";
  drawWheel();
};

/* END SCREEN */
function showEndScreen() {
  unsoldPlayers.sort((a, b) => b.rating - a.rating);

  finalScreen.style.display = "block";
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
              ${unsoldPlayers
                .map(p => `<tr><td>${p.name}</td><td>${p.rating}</td></tr>`)
                .join("")}
            </table>
          </div>`
        : ""
    }
  `;
}

function startUnsoldAuction() {
  finalScreen.style.display = "none";
  currentPool = [...unsoldPlayers];
  unsoldPlayers = [];
  wheelSection.style.display = "flex";
  drawWheel();
}

function endAuction() {
  finalScreen.innerHTML = `<h1>🏁 AUCTION IS OVER</h1><p>THANK YOU FOR ATTENDING</p>`;
}

/* KEYBOARD SHORTCUTS */
document.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    spinBtn.click();
  }
  if (e.key === "s") soldBtn.click();
  if (e.key === "u") unsoldBtn.click();
  if (e.key === "e") endAuction();
});
