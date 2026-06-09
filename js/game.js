import * as THREE from 'three';
import { initInput, KeyState, syncFrameFlags,
         enterJustPressed, iJustPressed, bJustPressed, qJustPressed,
         upJustPressed, downJustPressed, fJustPressed } from './input.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { spawnEnemies, respawnEnemies } from './enemies.js';
import { spawnItems } from './items.js';
import { Inventory } from './inventory.js';
import { TrapManager } from './traps.js';
import { HUD } from './hud.js';
import { ThirdPersonCamera } from './camera.js';
import { handleAttack, handleEnemyAttacks, updateFlashes } from './combat.js';
import { QuestCat } from './questcat.js';
import { TortoiseshellCat } from './tortoiseshell.js';

// ─── Build mode button — wired up FIRST before any Three.js init ──────────────

const buildBtn = document.getElementById('build-btn');
let buildMode  = false;

buildBtn.addEventListener('click', _toggleBuildMode);

function _toggleBuildMode() {
  // Block entering build mode during combat
  if (!buildMode && combatMode) {
    if (typeof hud !== 'undefined' && hud) hud.showStatus('Cannot enter build mode during combat!');
    return;
  }
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
const questCat         = new QuestCat(scene);
const tortoiseshell    = new TortoiseshellCat(scene);
tpCam.init();

let score              = 0;
let lastCatScore       = 0;
let lastTortoiseshellScore = 0;
let gameOver       = false;
let lastTime   = performance.now();
let combatMode = false;

const combatIndicator = document.getElementById('combat-indicator');

function updateCombatMode() {
  const inCombat = enemies.some(e => e.hp > 0 && e.state === 'chase');
  if (inCombat === combatMode) return;
  combatMode = inCombat;
  combatIndicator.style.display = combatMode ? 'block' : 'none';
  if (combatMode && buildMode) _toggleBuildMode();
}

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

  if (!buildMode && !questCat.talking && !tortoiseshell.talking) {
    for (const e of enemies) {
      if (e.hp > 0) e.update(delta, player, trapManager.cheeses);
    }
    for (const item of items) {
      if (!item.collected) item.update(delta);
    }
    trapManager.update(delta, enemies);
    handleEnemyAttacks(player, enemies, delta);
  }

  updateCombatMode();
  if (enemies.filter(e => e.hp > 0).length <= 5) {
    respawnEnemies(scene, enemies);
    hud.showStatus('Reinforcements incoming! 🐾');
  }

  // Quest cat — spawn at every 10-point milestone
  questCat.update(delta);
  if (questCat.isNearby(player.getPosition())) {
    hud.showStatus('Press Enter to talk to the mysterious cat 🐱');
  }
  const catMilestone = Math.floor(score / 10);
  if (catMilestone > Math.floor(lastCatScore / 10)) {
    questCat.spawn(new THREE.Vector3(0, 0, 0));
    hud.showStatus('A mysterious cat has appeared at spawn! 🐱');
  }
  lastCatScore = score;

  // Check if active quest item is now in inventory
  const reward = questCat.checkQuestComplete(inventory);
  if (reward) hud.showStatus('Quest complete! Received ' + reward + ' 🎁');

  // Tortoiseshell cat — spawn at every 30-point milestone
  tortoiseshell.update(delta, player, enemies, cam, pts => {
    if (pts > 0) {
      score += pts;
      hud.showStatus('You defeated the tortoiseshell! +' + pts + ' pts 🐱');
    } else {
      hud.showStatus('Your companion has fallen! 💔');
    }
  });
  hud.updateCompanionHP(
    tortoiseshell.isAlly ? tortoiseshell.hp : null, 30,
    tortoiseshell.isAlly ? tortoiseshell.hunger : null, 10
  );
  const tsMilestone = Math.floor(score / 30);
  if (tsMilestone > Math.floor(lastTortoiseshellScore / 30)) {
    if (!tortoiseshell.active) {
      tortoiseshell.unblock();
      tortoiseshell.spawn();
      hud.showStatus('A tortoiseshell cat has appeared! 🐱🟠');
    }
  }
  lastTortoiseshellScore = score;
  if (tortoiseshell.isNearby(player.getPosition())) {
    hud.showStatus('Walk up and choose: ❤️ Love or ⚔️ Battle');
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
    if (bJustPressed)     handleBuildPickup();
    if (iJustPressed)     { inventory.toggle(); if (!inventory.visible) clearGhost(); }
    if (qJustPressed || KeyState.escape) _toggleBuildMode();
  } else {
    if (enterJustPressed) handleInteract();
    if (qJustPressed)     _toggleBuildMode();
    if (iJustPressed) inventory.toggle();
    if (fJustPressed) handleEat();
    if (KeyState.escape) {
      if (inventory.visible) inventory.hide();
    }
  }

  hud.updateHP(player.hp, player.maxHp);
  hud.updateHunger(player.hunger, player.maxHunger);
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
    trapManager.placeItem(type, pos, inventory);
    hud.showStatus(fmtItem(type) + ' placed!');
  }
  // If item type exhausted, clear ghost
  if (!inventory.has(type)) clearGhost();
}

// ─── Normal mode interactions ─────────────────────────────────────────────────

function handleInteract() {
  const pos = player.getPosition();

  // 0. Quest cat interaction
  if (questCat.tryInteract(pos)) return;

  // 0b. Tortoiseshell love-click (filling state)
  const loveResult = tortoiseshell.loveClick(pos);
  if (loveResult === 'full') { hud.showStatus('💗 She loves you! Your companion joins the fight!'); return; }
  if (loveResult) return;

  // 0c. Attack hostile tortoiseshell
  if (tortoiseshell.tryPlayerAttack(pos)) { hud.showStatus('You hit the tortoiseshell!'); return; }

  // 0b. Rummage trash can
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

// ─── Build mode: pick up a placed basket or cheese ───────────────────────────

function handleEat() {
  const type = inventory.getSelectedType();
  if (!type) { hud.showStatus('Select a food item with ↑↓ first'); return; }
  const share = tortoiseshell.isAlly;
  const result = player.eat(type, share);
  if (result > 0) {
    if (share) tortoiseshell.feed(result);
    inventory.remove(type);
    hud.showStatus(share
      ? 'Shared ' + fmtItem(type) + ' with companion 💗'
      : 'Ate ' + fmtItem(type) + ' 😋');
  } else {
    hud.showStatus("Can't eat that!");
  }
}

function handleBuildPickup() {
  const picked = trapManager.pickupNearby(player.getPosition(), inventory);
  if (picked) {
    hud.showStatus('Picked up ' + (picked === 'basket' ? 'basket 🧺' : 'cheese 🧀'));
  } else {
    hud.showStatus('Nothing nearby to pick up');
  }
}

function updateInventoryHint() {
  const hint = document.getElementById('inventory-hint');
  if (!hint) return;
  if (buildMode) {
    hint.textContent = '↑↓ select  |  Enter: place  |  B: pick up  |  I: close';
  } else {
    hint.textContent = '↑↓ browse  |  I or Esc: close';
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
  if (n === 'Mouse')    return 7;
  if (n === 'StrayCat') return 1;
  if (n === 'Dog')      return 3;
  if (n === 'Human')    return 5;
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
