import * as THREE from 'three';
import { initInput, KeyState, syncFrameFlags,
         enterJustPressed, iJustPressed, bJustPressed, qJustPressed,
         upJustPressed, downJustPressed } from './input.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { spawnEnemies } from './enemies.js';
import { spawnItems } from './items.js';
import { Inventory } from './inventory.js';
import { TrapManager } from './traps.js';
import { HUD } from './hud.js';
import { ThirdPersonCamera } from './camera.js';
import { handleAttack, handleEnemyAttacks, updateFlashes } from './combat.js';

// ─── Build mode button — wired up FIRST before any Three.js init ──────────────

const buildBtn = document.getElementById('build-btn');
let buildMode  = false;

buildBtn.addEventListener('click', _toggleBuildMode);

function _toggleBuildMode() {
  buildMode = !buildMode;

  buildBtn.classList.toggle('active', buildMode);

  const overlay = document.getElementById('build-overlay');
  if (overlay) overlay.classList.toggle('hidden', !buildMode);

  if (buildMode) {
    // Auto-show inventory in build mode
    if (typeof inventory !== 'undefined' && inventory) {
      inventory.show();
      updateInventoryHint();
    }
    if (typeof hud !== 'undefined' && hud) {
      hud.showStatus('🔧 Build Mode — select item with ↑↓, walk to position, Enter to place');
    }
  } else {
    // Hide inventory when leaving build mode (unless already toggled by user)
    if (typeof inventory !== 'undefined' && inventory && inventory.visible) {
      inventory.hide();
    }
    clearGhost();
    if (typeof hud !== 'undefined' && hud) {
      hud.showStatus('Build Mode OFF');
    }
  }
}

// ─── Renderer & Scene ────────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
const { trashCans, treePositions } = buildWorld(scene);
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

// ─── Build mode ghost mesh ────────────────────────────────────────────────────

let ghostMesh = null;
let ghostType = null;

function buildGhostMesh(type) {
  const mat = new THREE.MeshLambertMaterial({
    color: type === 'basket' ? 0xd2a679 : 0xf4d03f,
    transparent: true,
    opacity: 0.45
  });
  let geo;
  if (type === 'basket') {
    geo = new THREE.CylinderGeometry(0.45, 0.38, 0.58, 10);
  } else {
    geo = new THREE.CylinderGeometry(0.22, 0.16, 0.22, 6);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = geo === geo ? 0.3 : 0.15;
  return mesh;
}

function updateGhost(pos) {
  if (!ghostMesh) return;
  ghostMesh.position.set(pos.x, 0.3, pos.z);
}

function clearGhost() {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh = null;
    ghostType = null;
  }
}

function syncBuildGhost() {
  if (!buildMode || !inventory.visible) { clearGhost(); return; }
  const type = inventory.getSelectedType();
  if (!type || (type !== 'basket' && type !== 'cheese')) {
    clearGhost();
    return;
  }
  if (type !== ghostType) {
    clearGhost();
    ghostMesh = buildGhostMesh(type);
    ghostType = type;
    scene.add(ghostMesh);
  }
  updateGhost(player.getPosition());
}

// ─── Game Loop ───────────────────────────────────────────────────────────────

function animate(now) {
  if (gameOver) return;
  requestAnimationFrame(animate);

  syncFrameFlags();

  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  tpCam.update(player.getPosition());
  player.update(delta, KeyState, tpCam.getYaw(), treePositions);
  if (!buildMode) updateHideState(player, trashCans);

  if (!buildMode) {
    for (const e of enemies) {
      if (e.hp > 0) e.update(delta, player, trapManager.cheeses);
    }
    for (const item of items) {
      if (!item.collected) item.update(delta);
    }
    trapManager.update(delta, enemies);
    handleEnemyAttacks(player, enemies, delta);
  }

  updateFlashes(delta, scene);

  // Inventory navigation (works in both modes when inventory is open)
  if (inventory.visible) {
    if (upJustPressed)   inventory.navigateUp();
    if (downJustPressed) inventory.navigateDown();
  }

  syncBuildGhost();

  if (buildMode) {
    if (enterJustPressed) handleBuildPlace();
    if (iJustPressed)     { inventory.toggle(); if (!inventory.visible) clearGhost(); }
    if (qJustPressed || KeyState.escape) _toggleBuildMode();
  } else {
    if (enterJustPressed) handleInteract();
    if (bJustPressed)     handleDropSelected();
    if (qJustPressed)     _toggleBuildMode();
    if (iJustPressed) inventory.toggle();
    if (KeyState.escape) {
      if (inventory.visible) inventory.hide();
    }
  }

  hud.updateHP(player.hp, player.maxHp);
  hud.updateScore(score);
  hud.tick(delta);

  if (player.hp <= 0) { endGame(); return; }

  renderer.render(scene, cam);
}

requestAnimationFrame(animate);

// ─── Build mode placement ─────────────────────────────────────────────────────

function handleBuildPlace() {
  const type = inventory.getSelectedType();
  if (!type) {
    hud.showStatus('Select an item with ↑↓ first');
    return;
  }
  const pos = player.getPosition().clone();
  if (type === 'basket') {
    if (trapManager.hasNearbyBasket(pos)) {
      hud.showStatus('Too close to another basket!');
      return;
    }
    trapManager.placeBasket(pos, inventory);
    hud.showStatus('Basket placed! 🧺 Drop cheese nearby to bait mice.');
  } else if (type === 'cheese') {
    trapManager.dropCheese(pos, inventory);
    const near = trapManager.hasNearbyBasket(pos);
    hud.showStatus(near
      ? 'Cheese placed near basket — mice incoming! 🧀'
      : 'Cheese placed! Set a basket nearby to trap mice 🧀');
  } else {
    hud.showStatus('Can\'t place ' + type + ' here');
    return;
  }
  // If item type exhausted, clear ghost
  if (!inventory.has(type)) clearGhost();
}

// ─── Normal mode interactions ─────────────────────────────────────────────────

function handleInteract() {
  const pos = player.getPosition();

  // 0. Rummage trash can
  for (const can of trashCans) {
    if (pos.distanceTo(can.position) < 1.6) {
      const contents = can.userData.contents;
      if (contents && contents.length > 0) {
        const found = [...contents];
        can.userData.contents = [];
        for (const item of found) inventory.add(item);
        hud.showStatus('Found: ' + found.map(fmtItem).join(', ') + ' 🗑️');
      } else {
        hud.showStatus('Can is empty...');
      }
      return;
    }
  }

  // 1. Pick up ground item
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

  // 3. Attack
  const hit = handleAttack(player, enemies, scene, enemy => {
    const pts = scoreForEnemy(enemy);
    score += pts;
    hud.showStatus(enemy.constructor.name + ' defeated! +' + pts + ' pts');
  });
  if (!hit) hud.showStatus('Nothing in range...');
}

// ─── Drop selected item from inventory ───────────────────────────────────────

function handleDropSelected() {
  // Pickup takes priority — walk up to a placed item and press B to retrieve it
  const picked = trapManager.pickupNearby(player.getPosition(), inventory);
  if (picked) {
    hud.showStatus('Picked up ' + (picked === 'basket' ? 'basket 🧺' : 'cheese 🧀'));
    return;
  }

  if (!inventory.visible) {
    hud.showStatus('Press I to open inventory, then select an item to drop');
    return;
  }
  const type = inventory.getSelectedType();
  if (!type) {
    hud.showStatus('Select an item with ↑↓ first');
    return;
  }
  const pos = player.getPosition().clone();
  if (type === 'cheese') {
    trapManager.dropCheese(pos, inventory);
    const near = trapManager.hasNearbyBasket(pos);
    hud.showStatus(near
      ? 'Cheese dropped near basket — mice incoming! 🧀'
      : 'Cheese dropped! Place a basket nearby to trap mice 🧀');
  } else if (type === 'basket') {
    if (trapManager.hasNearbyBasket(pos)) {
      hud.showStatus('Too close to another basket!');
      return;
    }
    trapManager.placeBasket(pos, inventory);
    hud.showStatus('Basket placed! 🧺');
  } else {
    // Drop any other item on the ground (just remove from inventory for now)
    inventory.remove(type);
    hud.showStatus('Dropped ' + fmtItem(type));
  }
}

function updateInventoryHint() {
  const hint = document.getElementById('inventory-hint');
  if (!hint) return;
  if (buildMode) {
    hint.textContent = '↑↓ select item  |  Enter: place  |  I: close inventory';
  } else {
    hint.textContent = '↑↓ select item  |  B: drop selected  |  I or Esc: close';
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
    tincan: 'Tin Can 🥫', fishbone: 'Fish Bone 🐟', sock: 'Old Sock 🧦',
    bottle: 'Bottle 🍾', string: 'String 🧵', bean_can: 'Bean Can 🫘',
    rotten_apple: 'Rotten Apple 🍎'
  };
  return names[type] || type;
}

function endGame() {
  gameOver = true;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);color:#fff;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'font-family:monospace;z-index:9999';
  overlay.innerHTML = `
    <div style="font-size:48px;margin-bottom:12px">😿</div>
    <div style="font-size:32px;font-weight:bold">GAME OVER</div>
    <div style="font-size:20px;margin-top:10px;color:#ffdc00">Final Score: ${score}</div>
    <button onclick="location.reload()" style="margin-top:28px;padding:12px 32px;
      font-size:18px;font-family:monospace;cursor:pointer;background:#2ecc40;
      border:none;border-radius:6px;color:#000;font-weight:bold">Play Again</button>`;
  document.body.appendChild(overlay);
}
