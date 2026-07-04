import './styles.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const COUNT = 500;
const GAME_DURATION = 60;
const TARGET_SWITCH_INTERVAL = 12;
const RAMP_MIN_ANGLE = -THREE.MathUtils.degToRad(42);
const RAMP_MAX_ANGLE = THREE.MathUtils.degToRad(42);
const RAMP_DRAG_SENSITIVITY = 0.42;
const BEST_KEY = 'whisper_pond_best';
const paletteSets = [
  ['#3b82f6', '#f43f5e', '#facc15', '#22c55e', '#f97316'],
  ['#14b8a6', '#fb7185', '#8b5cf6', '#fbbf24', '#38bdf8'],
  ['#06b6d4', '#84cc16', '#f472b6', '#fde047', '#f87171'],
  ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#a855f7'],
];

const messages = {
  en: {
    time: 'Time',
    score: 'Score',
    kicker: 'Bright cannon study',
    title: 'Physics Pond',
    startCopy: 'Drag the planks to steer falling spheres into the glowing target slot.',
    start: 'Begin',
    hint: 'Drag planks · Feed the glowing slot',
    complete: 'Pond settled',
    best: 'Best',
    stones: 'Caught',
    combo: 'Streak',
    again: 'Again',
    change: 'Target',
    home: 'Home',
    settled: 'The best paths are built by small plank moves.',
    targetLeft: 'LEFT',
    targetCenter: 'CENTER',
    targetRight: 'RIGHT',
  },
  zh: {
    time: '时间',
    score: '得分',
    kicker: '明亮物理试验',
    title: '物理池',
    startCopy: '拖动挡板改变角度，把滚落的小球导入发光目标槽。',
    start: '开始',
    hint: '拖动挡板 · 导入发光槽',
    complete: '物理结算',
    best: '最高',
    stones: '收集',
    combo: '连击',
    again: '再来一次',
    change: '换目标',
    home: '返回首页',
    settled: '好路径来自几次很小的挡板调整。',
    targetLeft: '左槽',
    targetCenter: '中槽',
    targetRight: '右槽',
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

const stage = document.getElementById('stage');
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const endScreen = document.getElementById('endScreen');
const hud = document.querySelector('.wp-hud');
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
const slotHud = document.getElementById('slotHud');
const slotHudItems = Array.from(slotHud.querySelectorAll('span'));
const hint = document.getElementById('hint');

let phase = 'start';
let paletteIndex = 0;
let score = 0;
let collected = 0;
let streak = 0;
let bestStreak = 0;
let remaining = GAME_DURATION;
let targetSlot = 1;
let targetTimer = TARGET_SWITCH_INTERVAL;
let lastCollectTone = 0;
let lastDragTone = 0;
let comboTimer = 0;
let audioCtx = null;
let activeRamp = null;
let selectedRampIndex = 2;
let dragStartX = 0;
let dragStartAngle = 0;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
renderer.setClearColor(0xf8f7f2, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf8f7f2);

const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100);
camera.position.set(0, 0, 7);
camera.lookAt(0, -0.3, 0);

scene.add(new THREE.AmbientLight(0xffffff, 1.28));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd7c5ad, 0.55));

const centerLight = new THREE.PointLight(0xfff4cf, 2.35, 5.6, 1.55);
centerLight.position.set(-0.15, -0.25, 2.4);
scene.add(centerLight);

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 250, 214, 0.95)');
  gradient.addColorStop(0.24, 'rgba(255, 236, 164, 0.42)');
  gradient.addColorStop(0.58, 'rgba(255, 210, 92, 0.12)');
  gradient.addColorStop(1, 'rgba(255, 210, 92, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const centerGlow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createGlowTexture(),
    color: 0xfff3c2,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  }),
);
centerGlow.position.set(-0.15, -0.25, 0.18);
centerGlow.scale.set(2.9, 2.9, 1);
centerGlow.renderOrder = 4;
scene.add(centerGlow);

const keyLight = new THREE.SpotLight(0xffffff, 0.86, 14, Math.PI / 3, 0.5, 1.1);
keyLight.position.set(0, 1, 2.4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const warmLight = new THREE.SpotLight(0xff5b42, 0.62, 12, Math.PI / 3, 0.5, 1.1);
warmLight.position.set(0, -1, 2);
warmLight.castShadow = true;
warmLight.shadow.mapSize.set(1024, 1024);
scene.add(warmLight);

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15),
  new THREE.MeshPhongMaterial({ color: 0xb8b4aa, shininess: 34 }),
);
plane.position.z = -0.1;
plane.receiveShadow = true;
scene.add(plane);

const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0),
});
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
const contactMaterial = new CANNON.Material('contact');
world.defaultContactMaterial = new CANNON.ContactMaterial(contactMaterial, contactMaterial, {
  friction: 0.08,
  restitution: 0.38,
});

const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
const sphereVertexColors = new Float32Array(sphereGeometry.attributes.position.count * 3);
sphereVertexColors.fill(1);
sphereGeometry.setAttribute('color', new THREE.BufferAttribute(sphereVertexColors, 3));
const sphereMaterial = new THREE.MeshToonMaterial({
  vertexColors: true,
});
const spheres = new THREE.InstancedMesh(sphereGeometry, sphereMaterial, COUNT);
spheres.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
spheres.castShadow = true;
spheres.receiveShadow = true;
spheres.frustumCulled = false;
scene.add(spheres);

const rampGeometry = new THREE.BoxGeometry(3, 0.05, 0.2);
const rampMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 26 });
const ramps = [];

for (let i = 0; i < 6; i += 1) {
  const x = i % 2 ? -1 : 1;
  const y = (i - 3.5) * 1.5;
  const angle = (i % 2 ? -1 : 1) * Math.PI / 6;
  const ramp = new THREE.Mesh(rampGeometry, rampMaterial.clone());
  ramp.position.set(x, y, 0);
  ramp.rotation.z = angle;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  scene.add(ramp);

  const body = new CANNON.Body({
    mass: 0,
    material: contactMaterial,
    shape: new CANNON.Box(new CANNON.Vec3(1.5, 0.025, 0.1)),
  });
  body.position.set(x, y, 0);
  body.quaternion.setFromEuler(0, 0, angle);
  world.addBody(body);
  ramps.push({ mesh: ramp, body, angle, startAngle: angle });
}

const slotGeometry = new THREE.BoxGeometry(0.82, 0.1, 0.22);
const collectionSlots = [-1.05, 0, 1.05].map((x) => {
  const slot = new THREE.Mesh(
    slotGeometry,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
      depthWrite: false,
    }),
  );
  slot.position.set(x, -5.9, 0.2);
  slot.renderOrder = 5;
  scene.add(slot);
  return slot;
});

const bodies = Array.from({ length: COUNT }, (_, i) => {
  const scale = THREE.MathUtils.randFloat(0.2, 1);
  const body = new CANNON.Body({
    mass: scale * 0.01,
    material: contactMaterial,
    shape: new CANNON.Sphere(0.1 * scale),
    linearDamping: 0.7,
    angularDamping: 0.7,
  });
  world.addBody(body);
  resetBody(body, i, false);
  return { body, scale, colorIndex: i % 5 };
});

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const planePoint = new THREE.Vector3();
let previousTime = performance.now();

function getAudioContext() {
  if (!audioCtx) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioCtor();
  }
  return audioCtx;
}

function resumeAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

function tone(freq, duration, options = {}) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime + (options.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(freq, now);
    if (options.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.freqEnd), now + duration);
    gain.gain.setValueAtTime(options.gain ?? 0.035, now);
    gain.gain.exponentialRampToValueAtTime(options.gainEnd ?? 0.001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {}
}

function playStart() {
  tone(300, 0.1, { type: 'triangle', freqEnd: 520, gain: 0.045 });
  tone(620, 0.12, { delay: 0.06, gain: 0.03 });
}

function playCollect(match) {
  const now = performance.now();
  if (now - lastCollectTone < 80) return;
  lastCollectTone = now;
  if (match) tone(720, 0.08, { type: 'sine', freqEnd: 960, gain: 0.026 });
  else tone(180, 0.07, { type: 'triangle', freqEnd: 150, gain: 0.018 });
}

function playTarget() {
  tone(560, 0.11, { type: 'sine', freqEnd: 760, gain: 0.028 });
}

function playDrag() {
  const now = performance.now();
  if (now - lastDragTone < 180) return;
  lastDragTone = now;
  tone(260, 0.045, { type: 'triangle', freqEnd: 300, gain: 0.012 });
}

function playEnd() {
  tone(240, 0.18, { type: 'sine', freqEnd: 360, gain: 0.035 });
}

function setPhase(nextPhase) {
  phase = nextPhase;
  startScreen.classList.toggle('is-active', nextPhase === 'start');
  gameScreen.classList.toggle('is-active', nextPhase === 'playing');
  endScreen.classList.toggle('is-active', nextPhase === 'end');
  hud.classList.toggle('is-visible', nextPhase === 'playing');
  slotHud.classList.toggle('is-visible', nextPhase === 'playing');
}

function resetBody(body, i, high = false) {
  body.position.set(THREE.MathUtils.randFloatSpread(2), high ? 5 + Math.random() * 2 : THREE.MathUtils.randFloatSpread(5), 0);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.quaternion.set(0, 0, 0, 1);
  body.force.set(0, 0, 0);
  body.torque.set(0, 0, 0);
}

function applyRampAngle(ramp, angle) {
  ramp.angle = THREE.MathUtils.clamp(angle, RAMP_MIN_ANGLE, RAMP_MAX_ANGLE);
  ramp.mesh.rotation.z = ramp.angle;
  ramp.body.quaternion.setFromEuler(0, 0, ramp.angle);
  ramp.body.aabbNeedsUpdate = true;
}

function updateRampHighlights() {
  ramps.forEach((ramp, i) => {
    const isSelected = i === selectedRampIndex;
    ramp.mesh.material.color.set(isSelected ? 0xd8d3c5 : 0xaaaaaa);
    ramp.mesh.material.emissive.set(isSelected ? 0x262018 : 0x000000);
    ramp.mesh.material.emissiveIntensity = isSelected ? 0.35 : 0;
  });
}

function projectPointerToPlane(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(dragPlane, planePoint);
}

function findRampAt(point) {
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < ramps.length; i += 1) {
    const ramp = ramps[i];
    const local = ramp.mesh.worldToLocal(point.clone());
    const inside = Math.abs(local.x) <= 1.8 && Math.abs(local.y) <= 0.58;
    const score = Math.abs(local.y) * 2.4 + Math.max(0, Math.abs(local.x) - 1.45);
    if ((inside || score < 0.95) && score < bestScore) {
      best = { ramp, index: i };
      bestScore = score;
    }
  }
  return best;
}

function updateColors() {
  const palette = paletteSets[paletteIndex];
  for (let i = 0; i < COUNT; i += 1) {
    color.set(palette[bodies[i].colorIndex % palette.length]);
    spheres.setColorAt(i, color);
  }
  collectionSlots.forEach((slot, i) => {
    const isTarget = i === targetSlot;
    slot.material.color.set(palette[i]);
    slot.material.opacity = isTarget ? 0.95 : 0.34;
    slot.scale.set(1, isTarget ? 1.55 : 1, 1);
    slotHudItems[i].style.background = palette[i];
    slotHudItems[i].style.boxShadow = isTarget ? `0 0 28px ${palette[i]}` : `0 0 16px ${palette[i]}66`;
    slotHudItems[i].classList.toggle('is-target', isTarget);
  });
  if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true;
}

function targetLabel() {
  return [t('targetLeft'), t('targetCenter'), t('targetRight')][targetSlot];
}

function showStatus(text) {
  comboBadge.textContent = text;
  comboBadge.classList.add('is-visible');
  window.clearTimeout(comboTimer);
  comboTimer = window.setTimeout(() => comboBadge.classList.remove('is-visible'), 720);
}

function setTargetSlot(nextTarget, announce = true) {
  targetSlot = ((nextTarget % 3) + 3) % 3;
  targetTimer = TARGET_SWITCH_INTERVAL;
  updateColors();
  if (announce) {
    showStatus(targetLabel());
    playTarget();
  }
}

function nextTargetSlot() {
  setTargetSlot(targetSlot + 1);
}

function updateTargetTimer(dt) {
  targetTimer -= dt;
  if (targetTimer <= 0) nextTargetSlot();
}

function updateHud() {
  timeLeft.textContent = String(Math.max(0, Math.ceil(remaining)));
  scoreValue.textContent = String(score);
}

function showCombo(text) {
  showStatus(text);
}

function collectBall(ball) {
  const { body } = ball;
  const slotIndex = body.position.x < -0.55 ? 0 : body.position.x > 0.55 ? 2 : 1;
  const match = slotIndex === targetSlot;
  score += match ? 5 : 1;
  collected += 1;
  if (match) {
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    if (streak > 0 && streak % 5 === 0) showCombo(`x${streak}`);
  } else {
    streak = 0;
  }
  playCollect(match);
  updateHud();
}

function resetGameState() {
  score = 0;
  collected = 0;
  streak = 0;
  bestStreak = 0;
  remaining = GAME_DURATION;
  targetSlot = 1;
  targetTimer = TARGET_SWITCH_INTERVAL;
  lastCollectTone = 0;
  lastDragTone = 0;
  activeRamp = null;
  selectedRampIndex = 2;
  comboBadge.classList.remove('is-visible');
  window.clearTimeout(comboTimer);
  ramps.forEach((ramp) => applyRampAngle(ramp, ramp.startAngle));
  updateRampHighlights();
  updateColors();
  updateHud();
}

function endGame() {
  if (phase !== 'playing') return;
  setPhase('end');
  playEnd();
  const best = Math.max(Number(localStorage.getItem(BEST_KEY) || 0), score);
  localStorage.setItem(BEST_KEY, String(best));
  finalScore.textContent = String(score);
  bestScore.textContent = String(best);
  stoneCount.textContent = String(collected);
  bestCombo.textContent = String(bestStreak);
  finalThought.textContent = t('settled');
}

function startGame() {
  resumeAudio();
  resetGameState();
  playStart();
  finalThought.textContent = '';
  hint.classList.remove('is-hidden');
  setPhase('playing');
  for (let i = 0; i < COUNT; i += 1) resetBody(bodies[i].body, i, false);
  showStatus(targetLabel());
}

function syncMeshes() {
  for (let i = 0; i < COUNT; i += 1) {
    const ball = bodies[i];
    const { body, scale } = ball;
    if (body.position.y < -7) {
      if (phase === 'playing') collectBall(ball);
      resetBody(body, i, true);
    }
    body.position.z = 0;
    body.velocity.z = 0;
    body.force.z = 0;

    dummy.position.copy(body.position);
    dummy.quaternion.copy(body.quaternion);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    spheres.setMatrixAt(i, dummy.matrix);
  }
  spheres.instanceMatrix.needsUpdate = true;
}

function render() {
  const now = performance.now();
  const dt = Math.min(1 / 30, (now - previousTime) / 1000);
  previousTime = now;
  world.step(1 / 60, dt, 3);
  syncMeshes();
  if (phase === 'playing') {
    remaining -= dt;
    updateTargetTimer(dt);
    updateHud();
    if (remaining <= 0) endGame();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function resize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function onPointerDown(event) {
  if (phase !== 'playing') return;
  const point = projectPointerToPlane(event);
  if (!point) return;
  const picked = findRampAt(point);
  if (!picked) return;
  activeRamp = picked.ramp;
  selectedRampIndex = picked.index;
  dragStartX = point.x;
  dragStartAngle = activeRamp.angle;
  hint.classList.add('is-hidden');
  updateRampHighlights();
  gameScreen.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event) {
  if (phase !== 'playing' || !activeRamp) return;
  const point = projectPointerToPlane(event);
  if (!point) return;
  applyRampAngle(activeRamp, dragStartAngle + (point.x - dragStartX) * RAMP_DRAG_SENSITIVITY);
  playDrag();
  event.preventDefault();
}

function onPointerUp(event) {
  if (phase !== 'playing') return;
  activeRamp = null;
  gameScreen.releasePointerCapture?.(event.pointerId);
}

timeLeft.textContent = String(GAME_DURATION);
stoneCount.textContent = '0';
bestScore.textContent = localStorage.getItem(BEST_KEY) || '0';
bestCombo.textContent = '0';
finalScore.textContent = '0';
finalThought.textContent = '';
updateColors();
updateRampHighlights();
updateHud();
setPhase('start');
resize();
requestAnimationFrame(render);

startButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startGame();
});
againButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  startGame();
});
changeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  nextTargetSlot();
});
homeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  setPhase('start');
});
gameScreen.addEventListener('pointerdown', onPointerDown, { passive: false });
window.addEventListener('pointermove', onPointerMove, { passive: false });
window.addEventListener('pointerup', onPointerUp, { passive: false });
window.addEventListener('pointercancel', onPointerUp, { passive: false });
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (phase === 'start') startGame();
  }
  if (event.code === 'Tab') {
    event.preventDefault();
    selectedRampIndex = (selectedRampIndex + 1) % ramps.length;
    updateRampHighlights();
  }
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault();
    const ramp = ramps[selectedRampIndex];
    const delta = THREE.MathUtils.degToRad(event.code === 'ArrowLeft' ? -4 : 4);
    applyRampAngle(ramp, ramp.angle + delta);
    playDrag();
  }
});
