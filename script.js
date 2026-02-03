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
const undoBtn = document.getElementById("undoBtn");

// Navigation (teams page removed)

/* ================= SERVER BACKUP (safety layer, not replacement for localStorage) ================= */
const SERVER_BASE_URL = 'http://localhost:4000';
let serverBackupState = null;

async function saveStateToServer() {
  try {
    const payload = { currentPool, unsoldPlayers, teams };
    await fetch(`${SERVER_BASE_URL}/save-state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Server backup failed', err);
  }
}

async function tryLoadServerBackup() {
  try {
    const res = await fetch(`${SERVER_BASE_URL}/load-state`);
    if (!res.ok) return false;
    const { state } = await res.json();
    if (state) {
      serverBackupState = state;
      return true;
    }
  } catch (err) {
    console.warn('Server backup fetch failed', err);
  }
  return false;
}

/* ================= AUDIO ================= */
const spinSound = new Audio("sounds/spin.mp3");
const cardHitSound = new Audio("sounds/card-hit.mp3");
const soldSound = new Audio("sounds/sold.mp3");
const unsoldSound = new Audio("sounds/unsold.mp3");
const bgMusic = new Audio("sounds/bg-music-2.mp3");
bgMusic.loop = true;

/* ================= CONFIG ================= */
const BASE_PRICE = 50;
const MAX_PLAYERS_PER_TEAM = 6;

// Dynamic bid step: 25 until 400, then 50
function getBidStep() {
  return currentBid < 400 ? 25 : 50;
}

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
  { id: 0, name: "Team A", budget: 1500, players: [] },
  { id: 1, name: "Team B", budget: 1500, players: [] },
  { id: 2, name: "Team C", budget: 1500, players: [] },
  { id: 3, name: "Team D", budget: 1500, players: [] },
  { id: 4, name: "Team E", budget: 1500, players: [] },
  { id: 5, name: "Team F", budget: 1500, players: [] },
];

/* ================= UNDO HISTORY ================= */
let undoHistory = [];

/* ================= SAVE / LOAD ================= */
function saveState() {
  localStorage.setItem("auctionState", JSON.stringify({
    currentPool,
    unsoldPlayers,
    teams,
    currentPlayer: currentPlayer ? JSON.parse(JSON.stringify(currentPlayer)) : null,
    currentBid,
    selectedTeamId
  }));
}

/* ================= UNDO ================= */
function saveUndoState() {
  undoHistory.push({
    currentPool: JSON.parse(JSON.stringify(currentPool)),
    unsoldPlayers: JSON.parse(JSON.stringify(unsoldPlayers)),
    teams: JSON.parse(JSON.stringify(teams)),
    rotation,
    currentBid,
    selectedTeamId,
    currentPlayer: currentPlayer ? JSON.parse(JSON.stringify(currentPlayer)) : null
  });
}

function undo() {
  if (undoHistory.length === 0) {
    alert("Nothing to undo!");
    return;
  }
  
  const state = undoHistory.pop();
  currentPool = state.currentPool;
  unsoldPlayers = state.unsoldPlayers;
  teams = state.teams;
  rotation = state.rotation;
  currentBid = state.currentBid;
  selectedTeamId = state.selectedTeamId;
  currentPlayer = state.currentPlayer;
  
  saveState();
  saveStateToServer();
  
  // Return to wheel if we're not in reveal screen
  if (revealScreen.style.display !== "flex") {
    wheelSection.style.display = "flex";
    drawWheel();
  } else {
    // If we're in reveal screen, restore the player card display
    if (currentPlayer) {
      if (currentPlayer.card) {
        card.src = currentPlayer.card;
        card.style.display = "block";
        nameFallback.style.display = "none";
      } else {
        card.style.display = "none";
        nameFallback.innerText = currentPlayer.name;
        nameFallback.style.display = "block";
      }
    }
    renderTeams();
    updateBidUI();
  }
}

undoBtn.onclick = () => {
  undo();
};

function loadState() {
  const s = localStorage.getItem("auctionState");
  if (!s) return false;

  const state = JSON.parse(s);
  currentPool = state.currentPool || [];
  unsoldPlayers = state.unsoldPlayers || [];
  teams = state.teams || teams;
  currentPlayer = state.currentPlayer || null;
  currentBid = state.currentBid || BASE_PRICE;
  selectedTeamId = state.selectedTeamId || null;
  undoHistory = []; // Clear undo history when loading saved state
  return true;
}

/* ================= NAVIGATION ================= */
function showAuction() {
  // Check if we're coming back from final screen with unsold players
  const state = localStorage.getItem("auctionState");
  if (state) {
    const parsedState = JSON.parse(state);
    // If currentPool is empty but unsoldPlayers exist, show option for unsold auction
    if ((!parsedState.currentPool || parsedState.currentPool.length === 0) && 
        parsedState.unsoldPlayers && parsedState.unsoldPlayers.length > 0) {
      resumeOverlay.style.display = "flex";
      resumeOverlay.innerHTML = `
        <div id="resumeBox">
          <h2>Unsold Players Available</h2>
          <p>There are ${parsedState.unsoldPlayers.length} unsold players. Would you like to conduct an auction with them?</p>
          <div class="resume-actions">
            <button id="resumeYes" class="btn success">YES, START UNSOLD AUCTION</button>
            <button id="resumeNo" class="btn danger">NO, BACK TO MENU</button>
          </div>
        </div>
      `;
      
      document.getElementById("resumeYes").onclick = () => {
        loadState();
        currentPool = [...unsoldPlayers];
        unsoldPlayers = [];
        currentPlayer = null;
        currentBid = BASE_PRICE;
        selectedTeamId = null;
        saveState();
        saveStateToServer();
        resumeOverlay.style.display = "none";
        hideAllPages();
        wheelSection.style.display = "flex";
        drawWheel();
      };
      
      document.getElementById("resumeNo").onclick = () => {
        // Reset everything when starting fresh
        localStorage.removeItem("auctionState");
        currentPool = [...players];
        unsoldPlayers = [];
        teams.forEach(team => {
          team.players = [];
          team.budget = 1500;
        });
        currentPlayer = null;
        currentBid = BASE_PRICE;
        selectedTeamId = null;
        resumeOverlay.style.display = "none";
        hideAllPages();
        wheelSection.style.display = "flex";
        drawWheel();
      };
      return;
    }
  }
  
  // Normal resume check
  if (localStorage.getItem("auctionState")) {
    resumeOverlay.style.display = "flex";
    resumeYes.onclick = () => {
      loadState();
      resumeOverlay.style.display = "none";
      hideAllPages(); // Hide all pages first
      // Always go back to wheel screen when resuming, put currentPlayer back in pool if exists
      if (currentPlayer) {
        // Put the current player back in the pool
        currentPool.push(currentPlayer);
        currentPlayer = null;
        currentBid = BASE_PRICE;
        selectedTeamId = null;
        saveState();
        saveStateToServer();
      }
      wheelSection.style.display = "flex";
      drawWheel();
    };
    resumeNo.onclick = () => {
      localStorage.removeItem("auctionState");
      currentPool = [...players];
      unsoldPlayers = [];
      // Reset all teams to initial state
      teams.forEach(team => {
        team.players = [];
        team.budget = 1500;
      });
      currentPlayer = null;
      currentBid = BASE_PRICE;
      selectedTeamId = null;
      resumeOverlay.style.display = "none";
      hideAllPages();
      wheelSection.style.display = "flex";
      drawWheel();
    };
  } else {
    hideAllPages();
    wheelSection.style.display = "flex";
    drawWheel();
  }
}

function hideAllPages() {
  wheelSection.style.display = "none";
  revealScreen.style.display = "none";
  finalScreen.style.display = "none";
  roundCompleteScreen.style.display = "none";
}

// Navigation event listeners (removed teams page)

/* ================= INIT ================= */
fetch("players.json")
  .then(r => r.json())
  .then(async data => {
    players = [...data];

    // Load state: localStorage first, then server backup fallback
    if (localStorage.getItem("auctionState")) {
      loadState();
    } else if (await tryLoadServerBackup()) {
      const state = serverBackupState;
      currentPool = state.currentPool || [];
      unsoldPlayers = state.unsoldPlayers || [];
      teams = state.teams || teams;
      const resumeFromServer = confirm("Server backup found. Resume auction?");
      if (!resumeFromServer) {
        currentPool = [...players];
        unsoldPlayers = [];
        teams.forEach(t => { t.players = []; t.budget = 1500; });
      }
      // If Yes: state already in memory; saveState will run on next SOLD/UNSOLD
    } else {
      currentPool = [...players];
    }
    
    // Start directly with auction
    showAuction();
    // Initialize button labels
    updateBidUI();
  });

/* ================= WHEEL ================= */
function drawWheel() {
  const r = canvas.width / 2;
  const slice = (2 * Math.PI) / currentPool.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw outer glow ring (subtle for dark theme)
  ctx.save();
  ctx.translate(r, r);
  ctx.beginPath();
  ctx.arc(0, 0, r + 5, 0, 2 * Math.PI);
  const gradient = ctx.createRadialGradient(0, 0, r - 20, 0, 0, r + 5);
  gradient.addColorStop(0, "rgba(167, 139, 250, 0.1)");
  gradient.addColorStop(1, "rgba(167, 139, 250, 0)");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(rotation);

  // Dark theme color palette
  const colors = [
    ["#7C3AED", "#6B46C1"], // Deep Purple
    ["#10B981", "#059669"], // Emerald Green
    ["#EC4899", "#DB2777"], // Rose Pink
    ["#F59E0B", "#D97706"], // Amber
    ["#6366F1", "#4F46E5"], // Indigo
    ["#14B8A6", "#0D9488"], // Teal
    ["#F97316", "#EA580C"], // Orange
    ["#8B5CF6", "#7C3AED"], // Violet
  ];

  currentPool.forEach((p, i) => {
    const colorPair = colors[i % colors.length];
    const isHighlighted = i === highlightIndex;
    
    // Create gradient for each slice
    const sliceGradient = ctx.createLinearGradient(
      Math.cos(slice * i + slice / 2) * r * 0.3,
      Math.sin(slice * i + slice / 2) * r * 0.3,
      Math.cos(slice * i + slice / 2) * r * 1.2,
      Math.sin(slice * i + slice / 2) * r * 1.2
    );
    
    if (isHighlighted) {
      sliceGradient.addColorStop(0, "#A78BFA");
      sliceGradient.addColorStop(1, "#7C3AED");
    } else {
      sliceGradient.addColorStop(0, colorPair[0]);
      sliceGradient.addColorStop(1, colorPair[1]);
    }

    ctx.beginPath();
    ctx.fillStyle = sliceGradient;
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, slice * i, slice * (i + 1));
    ctx.fill();

    // Add border for each slice
    ctx.strokeStyle = isHighlighted ? "#A78BFA" : "rgba(167, 139, 250, 0.15)";
    ctx.lineWidth = isHighlighted ? 2 : 1;
    ctx.stroke();

    // Draw player name with better styling
    ctx.save();
    ctx.rotate(slice * i + slice / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    
    // Text shadow for better readability
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.font = "bold 18px Arial";
    ctx.fillText(p.name, r - 15, 2);
    
    // Main text
    ctx.fillStyle = isHighlighted ? "#000" : "#FFF";
    ctx.font = "bold 18px Arial";
    ctx.fillText(p.name, r - 15, 0);
    
    ctx.restore();
  });

  // Draw center circle with dark theme gradient
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, 2 * Math.PI);
  const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
  centerGradient.addColorStop(0, "#A78BFA");
  centerGradient.addColorStop(1, "#7C3AED");
  ctx.fillStyle = centerGradient;
  ctx.fill();
  ctx.strokeStyle = "#A78BFA";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/* ================= SPIN ================= */
spinBtn.onclick = () => {
  if (spinning) return;
  spinning = true;
  saveUndoState(); // Save state before spinning

  bgMusic.play().catch(() => {});
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
  saveUndoState(); // Save state before selecting player
  currentPlayer = currentPool.splice(highlightIndex, 1)[0];
  highlightIndex = null;

  wheelSection.style.display = "none";
  revealScreen.style.display = "flex";

  currentBid = BASE_PRICE;
  selectedTeamId = null;
  updateBidUI(); // This will update button labels
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
  cardHitSound.play().catch(() => {});
}

/* ================= BIDDING ================= */
plusBtn.onclick = () => {
  if (selectedTeamId === null) return;

  const team = teams[selectedTeamId];
  const remaining =
    MAX_PLAYERS_PER_TEAM - team.players.length - 1;
  const maxAllowed =
    team.budget - remaining * 50; // Use 50 as minimum reserve
  const step = getBidStep();

  if (currentBid + step <= maxAllowed) {
    currentBid += step;
    updateBidUI();
  }
};

minusBtn.onclick = () => {
  const step = getBidStep();
  if (currentBid - step >= BASE_PRICE) {
    currentBid -= step;
    updateBidUI();
  }
};

function updateBidUI() {
  priceEl.textContent = `₹${currentBid}`;
  const step = getBidStep();
  minusBtn.textContent = `−${step}`;
  plusBtn.textContent = `+${step}`;
}

/* ================= TEAMS ================= */
function renderTeams() {
  teamSidebar.innerHTML = teams
    .map(t => `
      <div class="team ${t.id === selectedTeamId ? "active" : ""}"
           onclick="selectTeam(${t.id})">
        <div class="team-header">
          <span class="team-name" onclick="event.stopPropagation(); editTeamName(${t.id})">${t.name}</span>
          <span class="edit-icon" onclick="event.stopPropagation(); editTeamName(${t.id})">✏️</span>
        </div>
        <div class="team-info">
          <div>₹${t.budget}</div>
          <div class="player-count">Players: ${t.players.length}/${MAX_PLAYERS_PER_TEAM}</div>
        </div>
      </div>
    `).join("");
}

window.editTeamName = (id) => {
  const team = teams[id];
  const newName = prompt(`Edit team name:`, team.name);
  if (newName && newName.trim()) {
    team.name = newName.trim();
    renderTeams();
    saveState();
    saveStateToServer();
  }
};

window.selectTeam = id => {
  selectedTeamId = id;
  renderTeams();
};

/* ================= SOLD / UNSOLD ================= */
soldBtn.onclick = () => {
  if (selectedTeamId === null) return;

  saveUndoState(); // Save state before making changes
  const team = teams[selectedTeamId];
  team.budget -= currentBid;
  // Clone the player object to preserve all properties including card
  team.players.push(JSON.parse(JSON.stringify(currentPlayer)));

  showStamp("sold");
  soldSound.play();

  currentPlayer = null; // Clear so resume doesn't put sold player back on wheel
  saveState();
  saveStateToServer();
  finishReveal();
};

unsoldBtn.onclick = () => {
  saveUndoState(); // Save state before making changes
  unsoldPlayers.push(currentPlayer);

  showStamp("unsold");
  unsoldSound.play();

  currentPlayer = null; // Clear so resume doesn't put unsold player back on wheel
  saveState();
  saveStateToServer();
  finishReveal();
};

/* ================= FINISH ================= */
function finishReveal() {
  // Fade out player screen, then fade in next screen
  revealScreen.classList.remove("fade-in");
  revealScreen.classList.add("fade-out");

  setTimeout(() => {
    revealScreen.classList.remove("fade-out");
    revealScreen.style.display = "none";

    if (!currentPool.length) {
      // Next: round complete overlay (which later goes to final screen)
      showRoundComplete();
      // Ensure overlay fades in
      roundCompleteScreen.classList.remove("fade-out");
      roundCompleteScreen.classList.add("fade-in");
      setTimeout(() => roundCompleteScreen.classList.remove("fade-in"), 650);
    } else {
      // Next: wheel
      wheelSection.style.display = "flex";
      wheelSection.classList.remove("fade-out");
      wheelSection.classList.add("fade-in");
      drawWheel();
      setTimeout(() => wheelSection.classList.remove("fade-in"), 650);
    }
  }, 650);
}

/* ================= STAMP ================= */
function showStamp(type) {
  stamp.innerText = type.toUpperCase();
  stamp.className = `show ${type}`;
  setTimeout(() => stamp.className = "", 1200);
}

/* ================= ROUND COMPLETE ================= */
function showRoundComplete() {
  // HARD HIDE EVERYTHING
  wheelSection.style.display = "none";
  revealScreen.style.display = "none";

  // SHOW OVERLAY
  roundCompleteScreen.style.display = "flex";
  roundCompleteScreen.style.opacity = "1";

  cardHitSound.currentTime = 0;
  cardHitSound.play().catch(() => {});

  // AFTER OVERLAY → FINAL SCREEN
  setTimeout(() => {
    roundCompleteScreen.style.display = "none";
    showFinalScreen();
  }, 2200);
}


/* ================= FINAL SCREEN ================= */
function showFinalScreen() {
  // HARD RESET VISIBILITY
  wheelSection.style.display = "none";
  revealScreen.style.display = "none";
  roundCompleteScreen.style.display = "none";

  finalScreen.style.display = "flex";
  finalScreen.style.opacity = "1";
  finalScreen.classList.remove("fade-out");
  finalScreen.classList.add("fade-in");
  setTimeout(() => finalScreen.classList.remove("fade-in"), 650);

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
        ? `<table class="unsold-table">
            <tr><th>UNSOLD PLAYERS</th></tr>
            ${unsoldPlayers.map(p => `<tr><td>${p.name}</td></tr>`).join("")}
          </table>`
        : ""
    }
  `;
}


window.startUnsoldAuction = () => {
  finalScreen.style.display = "none";
  currentPool = [...unsoldPlayers];
  unsoldPlayers = [];
  currentPlayer = null;
  currentBid = BASE_PRICE;
  selectedTeamId = null;
  saveState();
  saveStateToServer();
  wheelSection.style.display = "flex";
  drawWheel();
};

window.endAuction = () => {
  // Save state with unsold players before ending (in case user wants to come back)
  saveState();
  saveStateToServer();
  finalScreen.innerHTML = `
    <h1>AUCTION ENDED</h1>
    <button class="btn primary" onclick="location.reload()" style="margin-top: 30px;">RESTART</button>
  `;
};

