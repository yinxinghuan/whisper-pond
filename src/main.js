import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

const COUNT = 500;
const BEST_KEY = 'whisper_pond_best';
const paletteSets = [
  ['#3b82f6', '#f43f5e', '#facc15', '#22c55e', '#f97316'],
  ['#14b8a6', '#fb7185', '#8b5cf6', '#fbbf24', '#38bdf8'],
  ['#06b6d4', '#84cc16', '#f472b6', '#fde047', '#f87171'],
  ['#2563eb', '#ef4444', '#10b981', '#f59e0b', '#a855f7'],
];

const messages = {
  en: {
    time: 'Bodies',
    score: 'Palette',
    kicker: 'Bright cannon study',
    title: 'Physics Pond',
    startCopy: 'Orbit the shelf and tap to cycle the falling sphere colors.',
    start: 'Begin',
    hint: 'Drag orbit · Tap color',
    complete: 'Physics study',
    best: 'Best',
    stones: 'Bodies',
    combo: 'Palette',
    again: 'Again',
    change: 'Color',
    home: 'Home',
  },
  zh: {
    time: '小球',
    score: '色盘',
    kicker: '明亮物理试验',
    title: '物理池',
    startCopy: '旋转观察挡板，小球会按原版物理路径自然滚落。',
    start: '开始',
    hint: '拖动旋转 · 轻点换色',
    complete: '物理试验',
    best: '最高',
    stones: '小球',
    combo: '色盘',
    again: '再来一次',
    change: '换色',
    home: '返回首页',
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
const hint = document.getElementById('hint');

let phase = 'start';
let paletteIndex = 0;
let pointerDownAt = 0;
let pointerMoved = false;
let audioCtx = null;

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

const controls = new OrbitControls(camera, gameScreen);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 4.3;
controls.maxDistance = 10;
controls.target.set(0, -0.3, 0);

scene.add(new THREE.AmbientLight(0xaaaaaa, 1.15));
scene.add(new THREE.HemisphereLight(0xffffff, 0xd7c5ad, 0.45));

const keyLight = new THREE.SpotLight(0xaaaaaa, 0.72, 14, Math.PI / 3, 0.5, 1.1);
keyLight.position.set(0, 1, 2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const warmLight = new THREE.SpotLight(0xff0000, 0.58, 12, Math.PI / 3, 0.5, 1.1);
warmLight.position.set(0, -1, 2);
warmLight.castShadow = true;
warmLight.shadow.mapSize.set(1024, 1024);
scene.add(warmLight);

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15),
  new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 28 }),
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

for (let i = 0; i < 6; i += 1) {
  const x = i % 2 ? -1 : 1;
  const y = (i - 3.5) * 1.5;
  const angle = (i % 2 ? 1 : -1) * Math.PI / 6;
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
}

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
  return { body, scale };
});

const dummy = new THREE.Object3D();
const color = new THREE.Color();
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

function setPhase(nextPhase) {
  phase = nextPhase;
  startScreen.classList.toggle('is-active', nextPhase === 'start');
  gameScreen.classList.toggle('is-active', nextPhase === 'playing');
  endScreen.classList.toggle('is-active', nextPhase === 'end');
  hud.classList.toggle('is-visible', nextPhase === 'playing');
}

function resetBody(body, i, high = false) {
  body.position.set(THREE.MathUtils.randFloatSpread(2), high ? 5 + Math.random() * 2 : THREE.MathUtils.randFloatSpread(5), 0);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.quaternion.set(0, 0, 0, 1);
  body.force.set(0, 0, 0);
  body.torque.set(0, 0, 0);
}

function updateColors() {
  const palette = paletteSets[paletteIndex];
  for (let i = 0; i < COUNT; i += 1) {
    color.set(palette[i % palette.length]);
    spheres.setColorAt(i, color);
  }
  if (spheres.instanceColor) spheres.instanceColor.needsUpdate = true;
  bestCombo.textContent = String(paletteIndex + 1);
  scoreValue.textContent = String(paletteIndex + 1);
}

function randomColors() {
  paletteIndex = (paletteIndex + 1) % paletteSets.length;
  updateColors();
  tone(660 + paletteIndex * 70, 0.1, { gain: 0.03 });
}

function startGame() {
  resumeAudio();
  playStart();
  scoreValue.textContent = String(paletteIndex + 1);
  finalScore.textContent = String(COUNT);
  stoneCount.textContent = String(COUNT);
  finalThought.textContent = '';
  hint.classList.remove('is-hidden');
  setPhase('playing');
  for (let i = 0; i < COUNT; i += 1) resetBody(bodies[i].body, i, false);
}

function syncMeshes() {
  for (let i = 0; i < COUNT; i += 1) {
    const { body, scale } = bodies[i];
    if (body.position.y < -7) resetBody(body, i, true);
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
  controls.update();
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
  pointerDownAt = performance.now();
  pointerMoved = false;
  hint.classList.add('is-hidden');
  controls.autoRotate = false;
}

function onPointerMove() {
  if (phase === 'playing') pointerMoved = true;
}

function onPointerUp() {
  if (phase !== 'playing') return;
  const elapsed = performance.now() - pointerDownAt;
  if (!pointerMoved && elapsed < 430) randomColors();
}

timeLeft.textContent = String(COUNT);
stoneCount.textContent = String(COUNT);
bestScore.textContent = localStorage.getItem(BEST_KEY) || '0';
bestCombo.textContent = '1';
finalThought.textContent = '';
updateColors();
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
  randomColors();
});
homeButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  setPhase('start');
});
gameScreen.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerUp, { passive: true });
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (phase === 'start') startGame();
    else randomColors();
  }
  if (event.code === 'KeyC') randomColors();
});
