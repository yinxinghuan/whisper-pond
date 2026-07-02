import './styles.css';

const FIELD_W = 390;
const FIELD_H = 680;
const ROUND_MS = 60000;
const BEST_KEY = 'whisper_pond_best';

const messages = {
  en: {
    time: 'Time',
    echo: 'Echo',
    kicker: 'A pond for one sentence',
    title: 'Whisper Pond',
    prompt: 'Drop one thought into the water',
    placeholder: 'Something I am carrying...',
    start: 'Begin',
    hint: 'Tap the water',
    complete: 'The pond kept it',
    best: 'Best',
    stones: 'Stones',
    combo: 'Combo',
    again: 'Again',
    change: 'New thought',
    home: 'Home',
    defaultThought: 'stay soft',
    comboLabel: 'Combo',
  },
  zh: {
    time: '时间',
    echo: '回声',
    kicker: '给一句话的一汪水',
    title: '心事水面',
    prompt: '把一句心事放进水里',
    placeholder: '我正在带着的事情...',
    start: '开始',
    hint: '轻点水面',
    complete: '水面记住了它',
    best: '最高',
    stones: '字石',
    combo: '连击',
    again: '再来一次',
    change: '换一句',
    home: '返回首页',
    defaultThought: '慢慢来',
    comboLabel: '连击',
  },
};

function detectLocale() {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const locale = detectLocale();
const t = (key) => messages[locale][key] || messages.en[key] || key;

document.querySelectorAll('[data-i18n]').forEach((el) => {
  el.textContent = t(el.dataset.i18n);
});
document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
  el.placeholder = t(el.dataset.i18nPlaceholder);
});

const canvas = document.getElementById('pond');
const ctx = canvas.getContext('2d', { alpha: true });
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const endScreen = document.getElementById('endScreen');
const hud = document.querySelector('.wp-hud');
const thoughtInput = document.getElementById('thoughtInput');
const startButton = document.getElementById('startButton');
const againButton = document.getElementById('againButton');
const changeButton = document.getElementById('changeButton');
const homeButton = document.getElementById('homeButton');
const timeLeft = document.getElementById('timeLeft');
const scoreValue = document.getElementById('scoreValue');
const finalScore = document.getElementById('finalScore');
const bestScore = document.getElementById('bestScore');
const stoneCount = document.getElementById('stoneCount');
const bestCombo = document.getElementById('bestCombo');
const finalThought = document.getElementById('finalThought');
const comboBadge = document.getElementById('comboBadge');
const hint = document.getElementById('hint');

let width = FIELD_W;
let height = FIELD_H;
let dpr = 1;
let phase = 'start';
let score = 0;
let best = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
let stonesDropped = 0;
let maxCombo = 1;
let combo = 0;
let lastTapTime = 0;
let roundStart = 0;
let thought = '';
let tokens = [t('defaultThought')];
let tokenIndex = 0;
let autoRippleAt = 0;
let comboHideTimer = 0;

const ripples = [];
const stones = [];
const sparks = [];

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtor();
  }
  return audioCtx;
}

function resumeAudio() {
  try {
    const audio = getAudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    // Audio is optional in restricted browsers.
  }
}

function tone(freq, duration, options = {}) {
  try {
    const audio = getAudioContext();
    const now = audio.currentTime + (options.delay || 0);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (options.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(options.gain ?? 0.04, now);
    gain.gain.exponentialRampToValueAtTime(options.gainEnd ?? 0.001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Keep gameplay running without audio.
  }
}

function playClick() {
  tone(520, 0.045, { type: 'square', freqEnd: 360, gain: 0.025 });
}

function playStart() {
  tone(440, 0.12, { freqEnd: 660, gain: 0.055 });
  tone(660, 0.16, { freqEnd: 880, gain: 0.05, delay: 0.08 });
}

function playDrop(activeCombo) {
  tone(190, 0.11, { type: 'triangle', freqEnd: 130, gain: 0.045 });
  tone(520, 0.18, { type: 'sine', gain: 0.018 });
  if (activeCombo >= 2) {
    tone(620 + activeCombo * 40, 0.09, { type: 'sine', gain: 0.022 });
  }
}

function playComplete() {
  [392, 523, 659, 784].forEach((freq, i) => {
    tone(freq, 0.22, { type: 'sine', gain: 0.04, delay: i * 0.07 });
  });
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setPhase(nextPhase) {
  phase = nextPhase;
  startScreen.classList.toggle('is-active', nextPhase === 'start');
  gameScreen.classList.toggle('is-active', nextPhase === 'playing');
  endScreen.classList.toggle('is-active', nextPhase === 'end');
  hud.classList.toggle('is-visible', nextPhase === 'playing');
}

function splitThought(value) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return [t('defaultThought')];
  const words = clean.match(/[a-zA-Z0-9']+|[\u4e00-\u9fff]{1,2}|[^\s]/g);
  return words && words.length ? words.slice(0, 32) : [clean.slice(0, 8)];
}

function startGame() {
  resumeAudio();
  playStart();
  thought = thoughtInput.value.trim() || t('defaultThought');
  tokens = splitThought(thought);
  tokenIndex = 0;
  score = 0;
  stonesDropped = 0;
  maxCombo = 1;
  combo = 0;
  lastTapTime = 0;
  roundStart = performance.now();
  ripples.length = 0;
  stones.length = 0;
  sparks.length = 0;
  scoreValue.textContent = '0';
  timeLeft.textContent = '60';
  hint.classList.remove('is-hidden');
  setPhase('playing');
}

function endGame() {
  if (phase !== 'playing') return;
  phase = 'end';
  best = Math.max(best, score);
  localStorage.setItem(BEST_KEY, String(best));
  finalScore.textContent = String(score);
  bestScore.textContent = String(best);
  stoneCount.textContent = String(stonesDropped);
  bestCombo.textContent = String(maxCombo);
  finalThought.textContent = `“${thought}”`;
  playComplete();
  setPhase('end');
}

function addRipple(x, y, now, soft = false) {
  const strength = soft ? 0.48 : 1;
  const layers = soft ? 1 : 3;
  for (let i = 0; i < layers; i += 1) {
    ripples.push({
      x,
      y,
      born: now,
      start: 8 + i * 6,
      speed: [140, 110, 82][i] || 92,
      life: [1400, 1900, 2300][i] || 1600,
      strength,
    });
  }
  if (ripples.length > 46) ripples.splice(0, ripples.length - 46);
}

function addStone(x, y, now) {
  const text = tokens[tokenIndex % tokens.length];
  tokenIndex += 1;
  stones.push({
    text,
    x,
    y,
    vx: -14 + Math.random() * 28,
    vy: -28 + Math.random() * 20,
    born: now,
    life: 4800,
  });
  if (stones.length > 9) stones.shift();
}

function addSparks(x, y, now) {
  for (let i = 0; i < 8; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 34;
    sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 1.2 + Math.random() * 2.5,
      born: now,
      life: 1200 + Math.random() * 1000,
    });
  }
  if (sparks.length > 80) sparks.splice(0, sparks.length - 80);
}

function handleWaterPointer(event) {
  if (phase !== 'playing') return;
  event.preventDefault();
  resumeAudio();
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const now = performance.now();
  combo = now - lastTapTime <= 1800 ? Math.min(combo + 1, 5) : 1;
  lastTapTime = now;
  maxCombo = Math.max(maxCombo, combo);
  const points = 10 + combo * 3;
  score += points;
  stonesDropped += 1;
  scoreValue.textContent = String(score);
  addRipple(x, y, now);
  addStone(x, y, now);
  addSparks(x, y, now);
  playDrop(combo);
  hint.classList.add('is-hidden');
  if (combo >= 2) showCombo(combo);
}

function showCombo(value) {
  window.clearTimeout(comboHideTimer);
  comboBadge.textContent = `${t('comboLabel')} x${value}`;
  comboBadge.classList.add('is-visible');
  comboHideTimer = window.setTimeout(() => comboBadge.classList.remove('is-visible'), 520);
}

function drawBackground(now) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#07111f');
  gradient.addColorStop(0.55, '#0b2035');
  gradient.addColorStop(1, '#182936');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const sway = Math.sin(now * 0.00022) * 26;
  const glow = ctx.createRadialGradient(width * 0.52 + sway, height * 0.42, 0, width * 0.52 + sway, height * 0.42, Math.max(width, height) * 0.55);
  glow.addColorStop(0, 'rgba(87, 231, 219, 0.18)');
  glow.addColorStop(0.38, 'rgba(32, 89, 114, 0.12)');
  glow.addColorStop(1, 'rgba(7, 17, 31, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#7cf6e5';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i += 1) {
    const y = height * (0.18 + i * 0.08);
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 14) {
      const wave = Math.sin(x * 0.018 + now * 0.00045 + i) * (4 + i * 0.3);
      if (x === -20) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRipples(now) {
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const ripple = ripples[i];
    const age = now - ripple.born;
    if (age > ripple.life) {
      ripples.splice(i, 1);
      continue;
    }
    const p = age / ripple.life;
    const radius = ripple.start + ripple.speed * (age / 1000);
    const alpha = (1 - p) * 0.72 * ripple.strength;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#dffff8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.32;
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#3ad8c6';
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, radius * 0.68, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSparks(now) {
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const spark = sparks[i];
    const age = now - spark.born;
    if (age > spark.life) {
      sparks.splice(i, 1);
      continue;
    }
    const dt = age / 1000;
    const p = age / spark.life;
    const x = spark.x + spark.vx * dt;
    const y = spark.y + spark.vy * dt;
    ctx.save();
    ctx.globalAlpha = (1 - p) * 0.62;
    ctx.fillStyle = '#d7fff5';
    ctx.beginPath();
    ctx.arc(x, y, spark.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawStones(now) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  for (let i = stones.length - 1; i >= 0; i -= 1) {
    const stone = stones[i];
    const age = now - stone.born;
    if (age > stone.life) {
      stones.splice(i, 1);
      continue;
    }
    const dt = age / 1000;
    const p = age / stone.life;
    const x = stone.x + stone.vx * dt + Math.sin(age * 0.003) * 7;
    const y = stone.y + stone.vy * dt;
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.min(1, p) * Math.PI) * 0.82;
    ctx.shadowColor = 'rgba(90, 235, 220, 0.45)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(248, 251, 255, 0.92)';
    ctx.fillText(stone.text, x, y);
    ctx.restore();
  }
}

function maybeIdleRipple(now) {
  if (phase === 'playing') return;
  if (now < autoRippleAt) return;
  autoRippleAt = now + 1700;
  addRipple(width * (0.2 + Math.random() * 0.6), height * (0.2 + Math.random() * 0.58), now, true);
}

function updateRound(now) {
  if (phase !== 'playing') return;
  const remaining = Math.max(0, ROUND_MS - (now - roundStart));
  timeLeft.textContent = String(Math.ceil(remaining / 1000));
  if (remaining <= 0) endGame();
}

function frame(now) {
  maybeIdleRipple(now);
  updateRound(now);
  drawBackground(now);
  drawRipples(now);
  drawSparks(now);
  drawStones(now);
  requestAnimationFrame(frame);
}

startButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startGame();
});

againButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  playClick();
  startGame();
});

changeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  playClick();
  setPhase('start');
  requestAnimationFrame(() => thoughtInput.focus());
});

homeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  playClick();
  thoughtInput.value = '';
  setPhase('start');
});

thoughtInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  startGame();
});

gameScreen.addEventListener('pointerdown', handleWaterPointer, { passive: false });
window.addEventListener('resize', resize);

thoughtInput.value = locale === 'zh' ? '把今天轻轻放下' : 'let today sink softly';
setPhase('start');
resize();
requestAnimationFrame(frame);
