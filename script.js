/* ================= DOM ================= */
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const wheelSection = document.getElementById("wheelSection");
const revealScreen = document.getElementById("revealScreen");
const finalScreen = document.getElementById("finalScreen");
const finalBanner = document.getElementById("finalBanner");
const roundCompleteScreen = document.getElementById("roundCompleteScreen");

const spinBtn = document.getElementById("spinBtn");
const soldBtn = document.getElementById("soldBtn");
const unsoldBtn = document.getElementById("unsoldBtn");
const plusBtn = document.getElementById("plusBtn");
const minusBtn = document.getElementById("minusBtn");

const card = document.getElementById("playerCard");
const nameFallback = document.getElementById("playerNameFallback");
const priceEl = document.getElementById("currentPrice");
const stamp = document.getElementById("stamp");
const teamSidebar = document.getElementById("teamSidebar");

const resumeOverlay = document.getElementById("resumeOverlay");
const resumeYes = document.getElementById("resumeYes");
const resumeNo = document.getElementById("resumeNo");

/* ================= AUDIO ================= */
const spinSound = new Audio("sounds/spin.mp3");
const cardHitSound = new Audio("sounds/card-hit.mp3");
const soldSound = new Audio("sounds/sold.mp3");
const unsoldSound = new Audio("sounds/unsold.mp3");
const bgMusic = new Audio("sounds/bg-music-2.mp3");
bgMusic.loop = true;

/* ================= CONFIG ================= */
const BASE_PRICE = 50;
const BID_STEP = 50;
const MAX_PLAYERS_PER_TEAM = 6;

/* ================= STATE ================= */
let players = [];
let currentPool = [];
let unsoldPlayers = [];
let rotation = 0;
let spinning = false;
let highlightIndex = null;

let currentBid = BASE_PRICE;
let selectedTeamId = null;
let currentPlayer = null;

/* ================= TEAMS ================= */
let teams = [
  { id: 0, name: "ADAPRADHAMAN MADRID", budget: 1500, players: [], logo: "logos/ADAPRADHAMAN MADRID.jpeg" },
  { id: 1, name: "AVIYAL CITY FC", budget: 1500, players: [], logo: "logos/AVIYAL CITY FC.jpeg" },
  { id: 2, name: "PACHADI BLASTERS", budget: 1500, players: [], logo: "logos/PACHADI BLASTERS.jpeg" },
  { id: 3, name: "PALADA FC", budget: 1500, players: [], logo: "logos/PALADA FC.jpeg" },
  { id: 4, name: "PAZHAM UNITED FC", budget: 1500, players: [], logo: "logos/PAZHAM UNITED FC.jpeg" },
  { id: 5, name: "PULIYINJI FC", budget: 1500, players: [], logo: "logos/PULIYINJI FC.jpeg" },
  { id: 6, name: "SAMBAR CITY FC", budget: 1500, players: [], logo: "logos/SAMBAR CITY FC.jpeg" },
  { id: 7, name: "SPORTING ERISSERY", budget: 1500, players: [], logo: "logos/SPORTING ERISSERY.jpeg" },
];

/* ================= SAVE / LOAD ================= */
function saveState() {
  localStorage.setItem("auctionState", JSON.stringify({
    currentPool,
    unsoldPlayers,
    teams,
    rotation
  }));
}

function loadState() {
  const s = localStorage.getItem("auctionState");
  if (!s) return false;

  const state = JSON.parse(s);
  currentPool = state.currentPool;
  unsoldPlayers = state.unsoldPlayers;
  teams = state.teams;
  rotation = state.rotation || 0;
  return true;
}

/* ================= INIT ================= */
fetch("players.json")
  .then(r => r.json())
  .then(data => {
    players = [...data];

    if (localStorage.getItem("auctionState")) {
      resumeOverlay.style.display = "flex";

      resumeYes.onclick = () => {
        loadState();
        resumeOverlay.style.display = "none";
        wheelSection.style.display = "flex";
        drawWheel();
      };

      resumeNo.onclick = () => {
        localStorage.removeItem("auctionState");
        currentPool = [...players];
        unsoldPlayers = [];
        resumeOverlay.style.display = "none";
        wheelSection.style.display = "flex";
        drawWheel();
      };
    } else {
      currentPool = [...players];
      wheelSection.style.display = "flex";
      drawWheel();
    }
  });

/* ================= WHEEL ================= */
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
    ctx.fillStyle =
      i === highlightIndex ? "#fff8b0" : i % 2 ? "#d4a017" : "#f5c542";
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, slice * i, slice * (i + 1));
    ctx.fill();

    if (i === highlightIndex) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = "gold";
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(slice * i + slice / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#000";
    ctx.font = "16px Arial";
    ctx.fillText(p.name, r - 10, 5);
    ctx.restore();
  });

  ctx.restore();
}

/* ================= SPIN ================= */
spinBtn.onclick = () => {
  if (spinning) return;
  spinning = true;

  bgMusic.play().catch(() => { });
  spinSound.currentTime = 0;
  spinSound.play();

  const startRot = rotation;
  const spinAmt = Math.random() * 10 + 10;
  const start = performance.now();

  function animate(t) {
    const p = Math.min((t - start) / 3000, 1);
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

/* ================= POINTER ================= */
function determineWinner() {
  const slice = (2 * Math.PI) / currentPool.length;
  let norm = rotation % (2 * Math.PI);
  if (norm < 0) norm += 2 * Math.PI;

  const pointer = (3 * Math.PI / 2 - norm + 2 * Math.PI) % (2 * Math.PI);
  highlightIndex = Math.floor(pointer / slice);

  drawWheel();
  setTimeout(selectPlayer, 1200);
}

/* ================= PLAYER ================= */
function selectPlayer() {
  currentPlayer = currentPool.splice(highlightIndex, 1)[0];
  highlightIndex = null;

  // wheelSection.style.display = "none";
  // revealScreen.style.display = "flex";
  transition(wheelSection, revealScreen, "flex");

  currentBid = BASE_PRICE;
  selectedTeamId = null;
  updateBidUI();
  renderTeams();

  if (currentPlayer.card) {
    card.src = currentPlayer.card;
    card.style.display = "block";
    nameFallback.style.display = "none";
  } else {
    card.style.display = "none";
    nameFallback.innerText = currentPlayer.name;
    nameFallback.style.display = "block";
  }

  cardHitSound.currentTime = 0;
  cardHitSound.play();
}

/* ================= BIDDING ================= */
plusBtn.onclick = () => {
  if (selectedTeamId === null) return;

  const team = teams[selectedTeamId];
  const remaining =
    MAX_PLAYERS_PER_TEAM - team.players.length - 1;
  const maxAllowed =
    team.budget - remaining * BASE_PRICE;

  if (currentBid + BID_STEP <= maxAllowed) {
    currentBid += BID_STEP;
    updateBidUI();
  }
};

minusBtn.onclick = () => {
  if (currentBid - BID_STEP >= BASE_PRICE) {
    currentBid -= BID_STEP;
    updateBidUI();
  }
};

function updateBidUI() {
  priceEl.textContent = `₹${currentBid}`;
}

/* ================= NAVIGATION & ANIMATION ================= */
function transition(fromEl, toEl, type = "flex") {
  fromEl.classList.add("fade-out");
  fromEl.classList.remove("fade-in");

  setTimeout(() => {
    fromEl.style.display = "none";
    fromEl.classList.remove("fade-out");

    toEl.style.display = type;
    toEl.classList.add("fade-in");
    // Clean up fade-in class after animation so it doesn't mess with opacity later if needed
    setTimeout(() => {
      toEl.classList.remove("fade-in");
    }, 600);
  }, 600); // Wait for fade-out to finish
}

/* ================= TEAMS UI LOGIC ================= */
const teamsPage = document.getElementById("teamsPage");
const teamsList = document.getElementById("teamsList");
const teamDetailPage = document.getElementById("teamDetailPage");
const teamDetailTitle = document.getElementById("teamDetailTitle");
const teamPlayersGrid = document.getElementById("teamPlayersGrid");

const viewTeamsBtn = document.getElementById("viewTeamsBtn");
const backToWheelBtn = document.getElementById("backToWheelBtn");
const backToTeamsBtn = document.getElementById("backToTeamsBtn");

// Event Listeners for Navigation
if (viewTeamsBtn) viewTeamsBtn.onclick = openTeamsPage;
if (backToWheelBtn) backToWheelBtn.onclick = backToWheel;
if (backToTeamsBtn) backToTeamsBtn.onclick = backToTeamsFromDetail;

function openTeamsPage() {
  renderAllTeamsPage();
  transition(wheelSection, teamsPage, "block");
}

function backToWheel() {
  transition(teamsPage, wheelSection, "flex");
  setTimeout(drawWheel, 600); // Redraw after fade out
}

function backToTeamsFromDetail() {
  transition(teamDetailPage, teamsPage, "block");
}

function renderAllTeamsPage() {
  teamsList.innerHTML = teams.map(t => {
    const playerCount = t.players.length;
    // Calculate progress percentage based on max players
    const progressPercent = (playerCount / MAX_PLAYERS_PER_TEAM) * 100;

    return `
      <div class="team-card" onclick="openTeamDetail(${t.id})">
        <div class="team-card-header">
           <img src="${t.logo}" alt="${t.name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin-right: 15px;">
           <h2>${t.name}</h2>
        </div>
        
        <div class="progress-container">
          <div class="progress-bar" style="width: ${progressPercent}%"></div>
        </div>
        <div class="progress-text">${playerCount} / ${MAX_PLAYERS_PER_TEAM} Players</div>
        
        <div class="team-stats">
          <div class="budget">₹${t.budget}</div>
        </div>
      </div>
    `;
  }).join("");
}

function openTeamDetail(teamId) {
  const team = teams.find(t => t.id === teamId);
  if (!team) return;

  teamDetailTitle.innerText = team.name;

  if (team.players.length === 0) {
    teamPlayersGrid.innerHTML = `
      <div class="no-players">
        <h2>NO PLAYERS YET</h2>
        <p>This team hasn't bought any players.</p>
      </div>
    `;
  } else {
    teamPlayersGrid.innerHTML = team.players.map(p => `
      <div class="player-card-item">
        ${p.card
        ? `<img src="${p.card}" class="player-card-image">`
        : `<div class="player-card-fallback">${p.position}</div>`
      }
        <div class="player-card-name">${p.name}</div>
        <div style="color: #4ade80; font-weight: bold; margin-top: 5px;">₹${p.price || "Sold"}</div>
      </div>
    `).join("");
  }

  transition(teamsPage, teamDetailPage, "block");
}

/* ================= AUCTION SIDEBAR RENDER ================= */
function renderTeams() {
  teamSidebar.innerHTML = teams
    .map(t => `
      <div class="team ${t.id === selectedTeamId ? "active" : ""}"
           data-id="${t.id}" style="display: flex; align-items: center; gap: 10px;">
        <img src="${t.logo}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
        <div>
          <div style="font-size: 14px; font-weight: bold;">${t.name}</div>
          <div style="color: #4ade80;">₹${t.budget}</div>
        </div>
      </div>
    `).join("");

  document.querySelectorAll(".team").forEach(el => {
    el.onclick = () => {
      selectedTeamId = Number(el.dataset.id);
      renderTeams();
    };
  });
}

/* ================= SOLD / UNSOLD ================= */
soldBtn.onclick = () => {
  if (selectedTeamId === null) return;

  const team = teams[selectedTeamId];
  team.budget -= currentBid;
  team.players.push({
    ...currentPlayer,
    price: currentBid
  });

  showStamp("sold");
  soldSound.play();

  saveState();
  finishReveal();
};

unsoldBtn.onclick = () => {
  unsoldPlayers.push(currentPlayer);

  showStamp("unsold");
  unsoldSound.play();

  saveState();
  finishReveal();
};

/* ================= FINISH ================= */
function finishReveal() {
  setTimeout(() => {
    if (!currentPool.length) {
      showRoundComplete();
    } else {
      transition(revealScreen, wheelSection, "flex");
      setTimeout(drawWheel, 600);
    }
  }, 1600);
}

/* ================= STAMP ================= */
function showStamp(type) {
  stamp.innerText = type.toUpperCase();
  stamp.className = `show ${type}`;
  setTimeout(() => stamp.className = "", 1200);
}

/* ================= ROUND COMPLETE ================= */
function showRoundComplete() {
  // Logic for round complete transition
  // First hide reveal screen if it's open, OR wheel if it's open (usually reveal)
  // We assume we come from finishReveal which is primarily from Reveal Screen

  revealScreen.classList.add("fade-out");
  wheelSection.classList.add("fade-out"); // Just in case

  setTimeout(() => {
    revealScreen.style.display = "none";
    wheelSection.style.display = "none";
    revealScreen.classList.remove("fade-out");
    wheelSection.classList.remove("fade-out");

    roundCompleteScreen.style.display = "flex";
    roundCompleteScreen.classList.add("fade-in");
    cardHitSound.play();

    setTimeout(() => {
      roundCompleteScreen.classList.remove("fade-in"); // cleanup

      // Auto transition to final screen after some time
      setTimeout(() => {
        transition(roundCompleteScreen, finalScreen, "flex");
        showFinalScreenContent(); // Populate content
      }, 2200);
    }, 600);
  }, 600);
}

/* ================= FINAL SCREEN ================= */
function showFinalScreenContent() {
  finalScreen.innerHTML = `
    <h1>AUCTION ROUND COMPLETE</h1>

    <div class="final-buttons">
      <button class="btn danger" id="endBtn">END AUCTION</button>
      ${unsoldPlayers.length
      ? `<button class="btn success" id="unsoldBtn2">START UNSOLD AUCTION</button>`
      : ""
    }
    </div>

    ${unsoldPlayers.length
      ? `
        <div class="unsold-table">
          <table>
            <tr><th>PLAYER</th></tr>
            ${unsoldPlayers.map(p => `<tr><td>${p.name}</td></tr>`).join("")}
          </table>
        </div>`
      : ""
    }
  `;

  document.getElementById("endBtn").onclick = endAuction;
  const u = document.getElementById("unsoldBtn2");
  if (u) u.onclick = startUnsoldAuction;
}

function showFinalScreen() {
  // Wrapper to match old function signature if called elsewhere, but logic is moved to showRoundComplete flow
  // or direct call
  finalScreen.style.display = "flex";
  showFinalScreenContent();
}


function startUnsoldAuction() {
  currentPool = [...unsoldPlayers];
  unsoldPlayers = [];
  saveState();
  transition(finalScreen, wheelSection, "flex");
  setTimeout(drawWheel, 600);
}

function endAuction() {
  localStorage.removeItem("auctionState");
  finalScreen.innerHTML = "<h1>AUCTION ENDED</h1>";
}
