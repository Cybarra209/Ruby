const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const characterScreen = document.getElementById("characterScreen");
const loadingScreen = document.getElementById("loadingScreen");
const victoryScreen = document.getElementById("victoryScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const loadingFill = document.getElementById("loadingFill");
const controls = document.getElementById("controls");
const hud = document.getElementById("hud");
const bossHealthInner = document.getElementById("bossHealthInner");
const healthBox = document.getElementById("healthBox");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const fireBtn = document.getElementById("fireBtn");

const rubyClosed = new Image();
rubyClosed.src = "assets/ruby_closed.png";
const rubyOpen = new Image();
rubyOpen.src = "assets/ruby_open.png";

const shipImages = {
  red: new Image(),
  blue: new Image(),
  yellow: new Image()
};
shipImages.red.src = "assets/ship_red.png";
shipImages.blue.src = "assets/ship_blue.png";
shipImages.yellow.src = "assets/ship_yellow.png";

let W = 0;
let H = 0;
let gameState = "menu";
let selectedShip = "red";
let player;
let boss;
let playerBullets = [];
let enemyBullets = [];
let stars = [];
let particles = [];
let keys = { left: false, right: false, fire: false };
let lastTime = 0;
let fireCooldown = 0;
let bossFireTimer = 0;
let mouthTimer = 0;
let shake = 0;
let score = 0;
let audioStarted = false;
let audioCtx;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      s: Math.random() * 2 + 0.5,
      v: Math.random() * 1.4 + 0.25
    });
  }
}
window.addEventListener("resize", resize);
resize();

function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  playMusicLoop();
}

function tone(freq, dur, type = "sine", gain = 0.08) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const vol = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  vol.gain.value = gain;
  osc.connect(vol);
  vol.connect(audioCtx.destination);
  osc.start();
  vol.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  osc.stop(audioCtx.currentTime + dur);
}

function playSelectSound() {
  tone(720, 0.08, "square", 0.05);
  setTimeout(() => tone(980, 0.08, "square", 0.05), 80);
}

function playShootSound() {
  tone(1250, 0.045, "square", 0.035);
}

function playHitSound() {
  tone(180, 0.09, "sawtooth", 0.06);
}

function playEnemyFireSound() {
  tone(260, 0.12, "triangle", 0.045);
}

function playVictorySound() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, "square", 0.06), i * 120));
}

function playMusicLoop() {
  if (!audioCtx) return;
  const notes = [110, 130.81, 146.83, 164.81, 146.83, 130.81];
  let i = 0;
  setInterval(() => {
    if (gameState !== "playing") return;
    tone(notes[i % notes.length], 0.18, "triangle", 0.018);
    i++;
  }, 280);
}

document.querySelectorAll(".shipChoice").forEach(btn => {
  btn.addEventListener("click", () => {
    startAudio();
    selectedShip = btn.dataset.ship;
    playSelectSound();
    showLoading();
  });
});

function showLoading() {
  characterScreen.classList.add("hidden");
  loadingScreen.classList.remove("hidden");
  loadingFill.style.width = "0%";
  let progress = 0;
  const loadInt = setInterval(() => {
    progress += 5;
    loadingFill.style.width = progress + "%";
    if (progress >= 100) {
      clearInterval(loadInt);
      startGame();
    }
  }, 70);
}

function resetGameObjects() {
  player = {
    x: W / 2 - 34,
    y: H - 165,
    w: 68,
    h: 68,
    hp: 5,
    invincible: 0
  };

  boss = {
    x: W / 2 - 110,
    y: 78,
    w: Math.min(235, W * 0.47),
    h: Math.min(235, W * 0.47),
    hp: 180,
    maxHp: 180,
    t: 0,
    phase: 1,
    alive: true
  };

  playerBullets = [];
  enemyBullets = [];
  particles = [];
  keys.left = keys.right = keys.fire = false;
  fireCooldown = 0;
  bossFireTimer = 0.7;
  mouthTimer = 0;
  score = 0;
  shake = 0;
  renderHealth();
}

function startGame() {
  resetGameObjects();
  gameState = "playing";
  loadingScreen.classList.add("hidden");
  victoryScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");
  canvas.style.display = "block";
  controls.classList.remove("hidden");
  hud.classList.remove("hidden");
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function renderHealth() {
  healthBox.innerHTML = "";
  for (let i = 0; i < player.hp; i++) {
    const h = document.createElement("div");
    h.className = "playerHeart";
    healthBox.appendChild(h);
  }
}

function pressButton(btn, key) {
  keys[key] = true;
  btn.classList.add("pressed");
}

function releaseButton(btn, key) {
  keys[key] = false;
  btn.classList.remove("pressed");
}

function bindControl(btn, key) {
  btn.addEventListener("pointerdown", e => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    pressButton(btn, key);
  });
  btn.addEventListener("pointerup", e => {
    e.preventDefault();
    releaseButton(btn, key);
  });
  btn.addEventListener("pointercancel", e => {
    e.preventDefault();
    releaseButton(btn, key);
  });
  btn.addEventListener("lostpointercapture", () => releaseButton(btn, key));
}
bindControl(leftBtn, "left");
bindControl(rightBtn, "right");
bindControl(fireBtn, "fire");

window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = true;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = true;
  if (e.key === " " || e.key === "ArrowUp") keys.fire = true;
});
window.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") keys.left = false;
  if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") keys.right = false;
  if (e.key === " " || e.key === "ArrowUp") keys.fire = false;
});

document.getElementById("playAgainVictory").addEventListener("click", () => location.reload());
document.getElementById("playAgainGameOver").addEventListener("click", () => location.reload());

function spawnPlayerBullet() {
  playerBullets.push({
    x: player.x + player.w / 2 - 3,
    y: player.y + 5,
    w: 6,
    h: 17,
    speed: 760
  });
  playShootSound();
}

function spawnEnemyBullet(x, y, angle, speed, size = 8) {
  enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size
  });
}

function bossAttack() {
  mouthTimer = 0.34;
  playEnemyFireSound();

  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h * 0.68;
  const aim = Math.atan2((player.y + player.h / 2) - cy, (player.x + player.w / 2) - cx);

  if (boss.hp < boss.maxHp * 0.35) {
    boss.phase = 3;
  } else if (boss.hp < boss.maxHp * 0.68) {
    boss.phase = 2;
  }

  if (boss.phase === 1) {
    for (let i = -2; i <= 2; i++) {
      spawnEnemyBullet(cx, cy, aim + i * 0.18, 220, 8);
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      spawnEnemyBullet(cx, cy, a, 135, 6);
    }
  } else if (boss.phase === 2) {
    for (let i = -4; i <= 4; i++) {
      spawnEnemyBullet(cx, cy, aim + i * 0.12, 250, 8);
    }
    for (let a = boss.t; a < Math.PI * 2 + boss.t; a += Math.PI / 9) {
      spawnEnemyBullet(cx, cy, a, 170, 7);
    }
  } else {
    for (let i = -6; i <= 6; i++) {
      spawnEnemyBullet(cx, cy, aim + i * 0.095, 285, 8);
    }
    for (let ring = 0; ring < 2; ring++) {
      for (let a = boss.t * 2 + ring * 0.28; a < Math.PI * 2 + boss.t * 2; a += Math.PI / 12) {
        spawnEnemyBullet(cx, cy, a, 160 + ring * 60, 7);
      }
    }
  }
}

function addExplosion(x, y, count = 15) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 230 + 70;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: Math.random() * 0.5 + 0.25,
      maxLife: 0.75,
      size: Math.random() * 4 + 2
    });
  }
}

function rectCircleHit(rect, circle) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return (dx * dx + dy * dy) < circle.size * circle.size;
}

function update(dt) {
  boss.t += dt;
  boss.x = W / 2 - boss.w / 2 + Math.sin(boss.t * 1.45) * Math.min(170, W * 0.28);
  boss.y = 65 + Math.sin(boss.t * 2.2) * 16;

  const playerSpeed = Math.min(430, W * 1.15);
  if (keys.left) player.x -= playerSpeed * dt;
  if (keys.right) player.x += playerSpeed * dt;
  player.x = Math.max(8, Math.min(W - player.w - 8, player.x));

  fireCooldown -= dt;
  if (keys.fire && fireCooldown <= 0) {
    spawnPlayerBullet();
    fireCooldown = 0.16;
  }

  bossFireTimer -= dt;
  if (bossFireTimer <= 0) {
    bossAttack();
    bossFireTimer = boss.phase === 1 ? 1.15 : boss.phase === 2 ? 0.95 : 0.72;
  }

  mouthTimer = Math.max(0, mouthTimer - dt);
  player.invincible = Math.max(0, player.invincible - dt);
  shake = Math.max(0, shake - dt * 10);

  playerBullets.forEach(b => b.y -= b.speed * dt);
  playerBullets = playerBullets.filter(b => b.y > -30);

  enemyBullets.forEach(b => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  });
  enemyBullets = enemyBullets.filter(b => b.x > -40 && b.x < W + 40 && b.y > -40 && b.y < H + 60);

  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    if (b.x < boss.x + boss.w * 0.88 && b.x + b.w > boss.x + boss.w * 0.12 &&
        b.y < boss.y + boss.h * 0.93 && b.y + b.h > boss.y + boss.h * 0.08) {
      playerBullets.splice(i, 1);
      boss.hp -= 1;
      score += 10;
      shake = 1.2;
      playHitSound();
      addExplosion(b.x, b.y, 4);
      if (boss.hp <= 0) {
        winGame();
        return;
      }
    }
  }

  if (player.invincible <= 0) {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      if (rectCircleHit(player, enemyBullets[i])) {
        enemyBullets.splice(i, 1);
        player.hp -= 1;
        player.invincible = 1.15;
        shake = 2.5;
        renderHealth();
        addExplosion(player.x + player.w / 2, player.y + player.h / 2, 18);
        if (player.hp <= 0) {
          loseGame();
          return;
        }
        break;
      }
    }
  }

  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  });
  particles = particles.filter(p => p.life > 0);

  stars.forEach(s => {
    s.y += s.v * 45 * dt;
    if (s.y > H) {
      s.y = -4;
      s.x = Math.random() * W;
    }
  });

  bossHealthInner.style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + "%";
}

function drawShip(x, y, w, h) {
  const img = shipImages[selectedShip];
  if (img.complete) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    ctx.fillStyle = selectedShip;
    ctx.fillRect(x, y, w, h);
  }
}

function draw() {
  let ox = 0, oy = 0;
  if (shake > 0) {
    ox = (Math.random() - 0.5) * shake * 3;
    oy = (Math.random() - 0.5) * shake * 3;
  }

  ctx.save();
  ctx.translate(ox, oy);
  ctx.clearRect(-20, -20, W + 40, H + 40);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#061034");
  bg.addColorStop(1, "#000006");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  });

  // Space Invaders-style rows/decorative aliens
  ctx.fillStyle = "rgba(120,255,160,.45)";
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      const ax = 22 + col * 45 + Math.sin(boss.t * 2 + row) * 8;
      const ay = 250 + row * 34;
      if (ax < W - 20) {
        ctx.fillRect(ax, ay, 24, 14);
        ctx.fillRect(ax + 5, ay - 5, 14, 5);
      }
    }
  }

  const bossImg = mouthTimer > 0 ? rubyOpen : rubyClosed;
  if (bossImg.complete) {
    ctx.drawImage(bossImg, boss.x, boss.y, boss.w, boss.h);
  } else {
    ctx.fillStyle = "#e5ad95";
    ctx.beginPath();
    ctx.arc(boss.x + boss.w / 2, boss.y + boss.h / 2, boss.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  playerBullets.forEach(b => {
    ctx.fillStyle = "#67f9ff";
    ctx.shadowColor = "#67f9ff";
    ctx.shadowBlur = 12;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.shadowBlur = 0;
  });

  enemyBullets.forEach(b => {
    const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.size + 5);
    g.addColorStop(0, "#fff7a6");
    g.addColorStop(0.45, "#ff7300");
    g.addColorStop(1, "rgba(255,0,0,.15)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size + 3, 0, Math.PI * 2);
    ctx.fill();
  });

  if (player.invincible > 0 && Math.floor(player.invincible * 12) % 2 === 0) {
    ctx.globalAlpha = 0.35;
  }
  drawShip(player.x, player.y, player.w, player.h);
  ctx.globalAlpha = 1;

  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.restore();
}

function loop(now) {
  if (gameState !== "playing") return;
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  if (gameState === "playing") {
    draw();
    requestAnimationFrame(loop);
  }
}

function winGame() {
  gameState = "victory";
  canvas.style.display = "none";
  controls.classList.add("hidden");
  hud.classList.add("hidden");
  victoryScreen.classList.remove("hidden");
  playVictorySound();
  if (typeof confetti === "function") {
    const duration = 2600;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 7, angle: 60, spread: 70, origin: { x: 0 } });
      confetti({ particleCount: 7, angle: 120, spread: 70, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }
}

function loseGame() {
  gameState = "gameover";
  canvas.style.display = "none";
  controls.classList.add("hidden");
  hud.classList.add("hidden");
  gameOverScreen.classList.remove("hidden");
}

document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
