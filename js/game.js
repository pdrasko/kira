import * as THREE from 'three';
import { initInput, KeyState, syncFrameFlags, enterJustPressed, iJustPressed, bJustPressed } from './input.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { spawnEnemies } from './enemies.js';
import { spawnItems } from './items.js';
import { Inventory } from './inventory.js';
import { TrapManager } from './traps.js';
import { HUD } from './hud.js';
import { ThirdPersonCamera } from './camera.js';
import { handleAttack, handleEnemyAttacks, updateFlashes } from './combat.js';

// ─── Renderer & Scene ────────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 90);

const cam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

window.addEventListener('resize', () => {
  cam.aspect = window.innerWidth / window.innerHeight;
  cam.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Systems ─────────────────────────────────────────────────────────────────

initInput();
const { trashCans } = buildWorld(scene);
const inventory   = new Inventory();
const player      = new Player(scene, inventory);
const enemies     = spawnEnemies(scene);
const items       = spawnItems(scene);
const trapManager = new TrapManager(scene);
const hud         = new HUD();
const tpCam       = new ThirdPersonCamera(cam);
tpCam.init();

let score    = 0;
let gameOver = false;
let lastTime = performance.now();

// ─── Game Loop ───────────────────────────────────────────────────────────────

function animate(now) {
  if (gameOver) return;
  requestAnimationFrame(animate);

  syncFrameFlags();

  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  tpCam.update(player.getPosition());
  player.update(delta, KeyState, tpCam.getYaw());
  updateHideState(player, trashCans);

  // Mice get the list of dropped cheeses; other enemies ignore it
  for (const e of enemies) {
    if (e.hp > 0) e.update(delta, player, trapManager.cheeses);
  }

  for (const item of items) {
    if (!item.collected) item.update(delta);
  }

  trapManager.update(delta, enemies);

  // Enter → interact
  if (enterJustPressed) handleInteract();

  // B → drop cheese from inventory wherever you're standing
  if (bJustPressed) handleDropCheese();

  // I → inventory panel
  if (iJustPressed) inventory.toggle();
  if (KeyState.escape && inventory.visible) inventory.hide();

  handleEnemyAttacks(player, enemies, delta);
  updateFlashes(delta, scene);

  hud.updateHP(player.hp, player.maxHp);
  hud.updateScore(score);
  hud.tick(delta);

  if (player.hp <= 0) { endGame(); return; }

  renderer.render(scene, cam);
}

requestAnimationFrame(animate);

// ─── Interactions ─────────────────────────────────────────────────────────────

function handleInteract() {
  const pos = player.getPosition();

  // 0. Check trash can for hidden cheese (highest priority near a can)
  for (const can of trashCans) {
    if (pos.distanceTo(can.position) < 1.5) {
      if (can.userData.hasCheeseItem) {
        can.userData.hasCheeseItem = false;
        inventory.add('cheese');
        hud.showStatus('Found cheese in the trash! 🧀');
        return;
      } else {
        hud.showStatus('Empty can...');
        return;
      }
    }
  }

  // 1. Pick up nearby item from ground
  for (const item of items) {
    if (item.collected) continue;
    if (pos.distanceTo(item.mesh.position) < 1.8) {
      inventory.add(item.type);
      item.collect();
      hud.showStatus('Picked up: ' + fmtItem(item.type));
      return;
    }
  }

  // 2. Collect trapped mouse
  const trapped = trapManager.collectTrap(pos, pts => {
    score += pts;
    hud.showStatus('Mouse caught! +' + pts + ' pts 🐭');
  });
  if (trapped) return;

  // 3. Place basket from inventory
  if (inventory.has('basket') && !trapManager.hasNearbyBasket(pos)) {
    trapManager.placeBasket(pos.clone(), inventory);
    hud.showStatus('Basket set! Drop cheese nearby with B');
    return;
  }

  // 4. Attack nearby enemy
  const hit = handleAttack(player, enemies, scene, enemy => {
    const pts = scoreForEnemy(enemy);
    score += pts;
    hud.showStatus(enemy.constructor.name + ' defeated! +' + pts + ' pts');
  });
  if (!hit) hud.showStatus('Nothing in range...');
}

function handleDropCheese() {
  if (!inventory.has('cheese')) {
    hud.showStatus('No cheese in inventory');
    return;
  }
  const dropped = trapManager.dropCheese(player.getPosition().clone(), inventory);
  if (dropped) {
    if (trapManager.hasNearbyBasket(player.getPosition())) {
      hud.showStatus('Cheese dropped near basket — mice will come! 🧀');
    } else {
      hud.showStatus('Cheese dropped! Put a basket nearby to trap mice 🧀');
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function updateHideState(player, trashCans) {
  const pos = player.getPosition();
  let hiding = false;
  for (const can of trashCans) {
    if (pos.distanceTo(can.position) < 1.3) { hiding = true; break; }
  }
  if (hiding !== player.isHiding) {
    player.isHiding = hiding;
    player.mesh.visible = !hiding;
    if (hiding) hud.showStatus('Hiding in trash can! 🗑️');
  }
}

function scoreForEnemy(e) {
  const n = e.constructor.name;
  if (n === 'Mouse')    return 10;
  if (n === 'StrayCat') return 15;
  if (n === 'Dog')      return 25;
  if (n === 'Human')    return 50;
  return 5;
}

function fmtItem(type) {
  const names = {
    cheese: 'Cheese 🧀', basket: 'Laundry Basket 🧺', yarn: 'Yarn Ball 🧶',
    tincan: 'Tin Can 🥫', fishbone: 'Fish Bone 🐟', sock: 'Old Sock 🧦', bottle: 'Bottle 🍾'
  };
  return names[type] || type;
}

function endGame() {
  gameOver = true;
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed','inset:0','background:rgba(0,0,0,0.82)',
    'color:#fff','display:flex','flex-direction:column',
    'align-items:center','justify-content:center',
    'font-family:monospace','z-index:9999'
  ].join(';');
  overlay.innerHTML = `
    <div style="font-size:48px;margin-bottom:12px">😿</div>
    <div style="font-size:32px;font-weight:bold">GAME OVER</div>
    <div style="font-size:20px;margin-top:10px;color:#ffdc00">Final Score: ${score}</div>
    <button onclick="location.reload()" style="margin-top:28px;padding:12px 32px;
      font-size:18px;font-family:monospace;cursor:pointer;background:#2ecc40;
      border:none;border-radius:6px;color:#000;font-weight:bold">
      Play Again
    </button>`;
  document.body.appendChild(overlay);
}
