const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");

const wheelSection = document.getElementById("wheelSection");
const revealScreen = document.getElementById("revealScreen");
const finalScreen = document.getElementById("finalScreen");

const video = document.getElementById("playerVideo");
const card = document.getElementById("playerCard");
const statusText = document.getElementById("statusText");

const soldBtn = document.getElementById("soldBtn");
const unsoldBtn = document.getElementById("unsoldBtn");
const decisionButtons = document.getElementById("decisionButtons");
const spinBtn = document.getElementById("spinBtn");

const spinSound = new Audio("sounds/spin.mp3");
const revealSound = new Audio("sounds/reveal.mp3");

let players = [];
let currentPool = [];
let unsoldPlayers = [];
let selectedPlayer = null;
let isUnsoldAuction = false;

let angle = 0;
let spinning = false;

/* LOAD */
fetch("players.json")
  .then(r => r.json())
  .then(data => {
    players = [...data];
    currentPool = [...players];
    drawWheel();
  });

function drawWheel() {
  if (currentPool.length === 0) return;

  const r = canvas.width / 2;
  const slice = (2 * Math.PI) / currentPool.length;

  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.translate(r, r);

  currentPool.forEach((p,i)=>{
    ctx.beginPath();
    ctx.fillStyle = i % 2 ? "#d4a017" : "#f5c542";
    ctx.moveTo(0,0);
    ctx.arc(0,0,r,slice*i,slice*(i+1));
    ctx.fill();

    ctx.save();
    ctx.rotate(slice*i + slice/2);
    ctx.fillStyle = "#000";
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText(p.name, r-10, 5);
    ctx.restore();
  });

  ctx.setTransform(1,0,0,1,0,0);
}

spinBtn.onclick = () => {
  if (spinning || currentPool.length === 0) return;

  spinning = true;
  spinSound.currentTime = 0;
  spinSound.play();

  const spinAngle = Math.random()*2000 + 2000;
  const start = performance.now();
  const duration = 3000;

  function anim(t){
    const p = Math.min((t-start)/duration,1);
    angle = spinAngle * (1 - Math.pow(1-p,3));

    ctx.setTransform(1,0,0,1,0,0);
    ctx.translate(canvas.width/2,canvas.height/2);
    ctx.rotate((angle*Math.PI)/180);
    ctx.translate(-canvas.width/2,-canvas.height/2);
    drawWheel();

    if(p<1) requestAnimationFrame(anim);
    else {
      spinSound.pause();
      spinning = false;
      selectPlayer();
    }
  }
  requestAnimationFrame(anim);
};

function selectPlayer(){
  const slice = 360/currentPool.length;
  const index = Math.floor((360-(angle%360))/slice)%currentPool.length;
  selectedPlayer = currentPool.splice(index,1)[0];

  wheelSection.style.display = "none";
  revealScreen.style.display = "flex";

  video.style.display = "none";
  card.style.display = "none";
  decisionButtons.style.display = "none";
  statusText.style.display = "none";

  if(!isUnsoldAuction){
    revealSound.currentTime = 0;
    revealSound.play();

    video.src = selectedPlayer.video;
    video.style.display = "block";
    video.play();

    setTimeout(stopVideoAndShowCard, 10000);
    video.onended = stopVideoAndShowCard;
  } else {
    showCardAndButtons();
  }
}

function stopVideoAndShowCard(){
  video.pause();
  revealSound.pause();
  video.style.display = "none";
  showCardAndButtons();
}

function showCardAndButtons(){
  card.src = selectedPlayer.card;
  card.style.display = "block";
  decisionButtons.style.display = "flex";
}

soldBtn.onclick = () => decision(false);
unsoldBtn.onclick = () => decision(true);

function decision(isUnsold){
  decisionButtons.style.display = "none";
  statusText.innerText = isUnsold ? "UNSOLD" : "SOLD";
  statusText.style.color = isUnsold ? "red" : "lime";
  statusText.style.display = "block";
  revealScreen.style.background = isUnsold ? "#5a0000" : "#003300";

  setTimeout(()=>{
    revealScreen.style.background = "black";
    revealScreen.style.display = "none";
    statusText.style.display = "none";
    card.style.display = "none";

    if(isUnsold) unsoldPlayers.push(selectedPlayer);

    if(currentPool.length === 0){
      showEndOptions();
    } else {
      wheelSection.style.display = "flex";
      drawWheel();
    }
  },2000);
}

function showEndOptions(){
  finalScreen.style.display = "block";
  finalScreen.innerHTML = `
    <h1>AUCTION ROUND COMPLETE</h1>
    <button onclick="endAuction()">END THE AUCTION</button>
    ${unsoldPlayers.length ? '<button onclick="startUnsoldAuction()">START UNSOLD AUCTION</button>' : ''}
  `;
}

function startUnsoldAuction(){
  finalScreen.style.display = "none";
  currentPool = [...unsoldPlayers];
  unsoldPlayers = [];
  isUnsoldAuction = true;
  wheelSection.style.display = "flex";
  drawWheel();
}

function endAuction(){
  finalScreen.style.display = "block";
  finalScreen.innerHTML = `
    <h1>🏁 AUCTION IS OVER</h1>
    <p>THANK YOU FOR ATTENDING</p>
  `;
}
