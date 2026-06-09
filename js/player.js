import * as THREE from 'three';

const SPEED          = 6;
const JUMP_VEL       = 8;
const GRAVITY        = -22;
const CLIMB_SPEED    = 3.8;
const SLIDE_GRAVITY  = 5;
const SLIDE_MAX_DOWN = 1.2;
const TREE_RADIUS    = 0.85;
const TREE_MAX_H     = 7.0;
const MAX_HP         = 30;
const MAX_HUNGER     = 10;
const HUNGER_DRAIN   = 0.05;  // 1 unit per 20 seconds
const STARVE_DAMAGE  = 1;     // hp lost per starve tick
const STARVE_TICK    = 4;     // seconds between starve damage
const REGEN_INTERVAL = 3;
const BOUNDARY       = 47;

const FOOD_VALUES = {
  cheese: 3, fishbone: 2.5, rotten_apple: 1.5,
  bean_can: 2, tincan: 1.5, sock: 0.5,
};

export class Player {
  constructor(scene, inventory) {
    this.maxHp        = MAX_HP;
    this.hp           = MAX_HP;
    this.hunger       = MAX_HUNGER;
    this.maxHunger    = MAX_HUNGER;
    this._starveTimer = 0;
    this.velocity     = new THREE.Vector3();
    this.onGround     = true;
    this.isHiding     = false;
    this.isClimbing   = false;
    this._nearTree    = null;
    this.regenTimer   = 0;
    this.inventory    = inventory;
    this.damageCooldown = 0;

    this.mesh = buildCatMesh();
    this.mesh.position.set(0, 0, 0);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  get isInTree() {
    return this._nearTree !== null && this.mesh.position.y > 0.2;
  }

  update(delta, KeyState, cameraYaw, treePositions = []) {
    this._nearTree = this._findNearTree(treePositions);
    this._move(delta, KeyState, cameraYaw);
    this._applyGravity(delta, KeyState);
    this._regen(delta);
    this._updateHunger(delta);
    if (this.damageCooldown > 0) this.damageCooldown -= delta;
  }

  _findNearTree(treePositions) {
    const { x, z } = this.mesh.position;
    for (const tp of treePositions) {
      const dx = x - tp.x, dz = z - tp.z;
      if (Math.sqrt(dx * dx + dz * dz) < TREE_RADIUS) return tp;
    }
    return null;
  }

  _move(delta, KeyState, cameraYaw) {
    if (this.isHiding) return;

    // No horizontal movement while off-ground on a tree trunk
    if (this._nearTree && this.mesh.position.y > 0.15) {
      // Locked to trunk — only snap position
      this.mesh.position.x = this._nearTree.x;
      this.mesh.position.z = this._nearTree.z;
      return;
    }

    const dir = new THREE.Vector3();
    if (KeyState.w) dir.z -= 1;
    if (KeyState.s) dir.z += 1;
    if (KeyState.a) dir.x -= 1;
    if (KeyState.d) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.applyEuler(new THREE.Euler(0, cameraYaw, 0));
      dir.normalize();

      this.mesh.position.x += dir.x * SPEED * delta;
      this.mesh.position.z += dir.z * SPEED * delta;

      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - this.mesh.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * Math.min(1, 10 * delta);
    }

    this.mesh.position.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.mesh.position.x));
    this.mesh.position.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.mesh.position.z));
  }

  _applyGravity(delta, KeyState) {
    if (this._nearTree) {
      // ── Tree climbing mode ───────────────────────────────────────────────
      if (KeyState.space && this.mesh.position.y < TREE_MAX_H) {
        this.velocity.y = CLIMB_SPEED;
        this.onGround  = false;
        this.isClimbing = true;
      } else {
        // Slide down slowly (reduced gravity feel)
        this.velocity.y -= SLIDE_GRAVITY * delta;
        this.velocity.y  = Math.max(this.velocity.y, -SLIDE_MAX_DOWN);
        this.isClimbing  = false;
      }
    } else {
      // ── Normal gravity / jump ────────────────────────────────────────────
      this.isClimbing = false;
      if (KeyState.space && this.onGround) {
        this.velocity.y = JUMP_VEL;
        this.onGround   = false;
      }
      this.velocity.y += GRAVITY * delta;
    }

    this.mesh.position.y += this.velocity.y * delta;

    // Floor
    if (this.mesh.position.y <= 0) {
      this.mesh.position.y = 0;
      this.velocity.y = 0;
      this.onGround   = true;
      this.isClimbing = false;
    }
    // Tree ceiling
    if (this.mesh.position.y > TREE_MAX_H) {
      this.mesh.position.y = TREE_MAX_H;
      this.velocity.y = 0;
    }
  }

  _updateHunger(delta) {
    this.hunger = Math.max(0, this.hunger - HUNGER_DRAIN * delta);
    if (this.hunger === 0) {
      this._starveTimer += delta;
      if (this._starveTimer >= STARVE_TICK) {
        this._starveTimer = 0;
        this.hp = Math.max(0, this.hp - STARVE_DAMAGE);
      }
    } else {
      this._starveTimer = 0;
    }
  }

  eat(itemType, share = false) {
    const val = FOOD_VALUES[itemType];
    if (!val) return 0;
    const myShare = share ? val / 2 : val;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + myShare);
    return share ? val / 2 : 0; // returns companion's share (or 0 if not sharing)
  }

  _regen(delta) {
    if (this.hp >= this.maxHp) { this.regenTimer = 0; return; }
    this.regenTimer += delta;
    if (this.regenTimer >= REGEN_INTERVAL) {
      this.regenTimer = 0;
      this.heal(1);
    }
  }

  takeDamage(amount) {
    if (this.damageCooldown > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.damageCooldown = 0.5;
    this.mesh.traverse(c => {
      if (!c.isMesh) return;
      const orig = c.material.color.getHex();
      c.material = c.material.clone();
      c.material.color.setHex(0xff2222);
      setTimeout(() => { if (c.material) c.material.color.setHex(orig); }, 200);
    });
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  getPosition() { return this.mesh.position; }
}

// ── Cat model (all procedural Three.js geometry) ─────────────────────────────

function buildCatMesh() {
  const group = new THREE.Group();

  const cream    = new THREE.MeshLambertMaterial({ color: 0xf5deb3 });
  const orange   = new THREE.MeshLambertMaterial({ color: 0xe8733a });
  const black    = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const white    = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const pink     = new THREE.MeshLambertMaterial({ color: 0xffb6c1 });
  const eyeGreen = new THREE.MeshLambertMaterial({ color: 0x2ea04f });

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), cream);
  body.scale.set(1.2, 0.8, 1.6);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Calico patches
  const patchO = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), orange);
  patchO.scale.set(0.9, 0.6, 1.1);
  patchO.position.set(0.2, 0.82, -0.15);
  group.add(patchO);

  const patchB = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), black);
  patchB.scale.set(0.7, 0.55, 0.9);
  patchB.position.set(-0.3, 0.78, 0.25);
  group.add(patchB);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), cream);
  head.position.set(0, 1.22, 0.55);
  head.castShadow = true;
  group.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), white);
  snout.scale.set(1.1, 0.75, 0.85);
  snout.position.set(0, 1.16, 0.87);
  group.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), pink);
  nose.position.set(0, 1.22, 0.93);
  group.add(nose);

  for (const [ex, ez] of [[-0.14, 0.86], [0.14, 0.86]]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), eyeGreen);
    eye.position.set(ex, 1.32, ez);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    pupil.position.set(ex * 1.01, 1.32, ez * 1.01 + 0.01);
    group.add(pupil);
  }

  // Ears
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), orange);
  earL.position.set(-0.22, 1.54, 0.5);
  earL.rotation.z = -0.25;
  group.add(earL);

  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), black);
  earR.position.set(0.22, 1.54, 0.5);
  earR.rotation.z = 0.25;
  group.add(earR);

  for (const [ex, mat2] of [[-0.22, pink], [0.22, pink]]) {
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), mat2);
    inner.position.set(ex, 1.54, 0.5);
    inner.rotation.z = ex < 0 ? -0.25 : 0.25;
    group.add(inner);
  }

  // Legs
  const legMat = new THREE.MeshLambertMaterial({ color: 0xf0d090 });
  for (const [lx, ly, lz] of [[-0.42,0.22,0.45],[0.42,0.22,0.45],[-0.38,0.22,-0.45],[0.38,0.22,-0.45]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.44, 7), legMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), white);
    paw.scale.set(1.2, 0.7, 1.3);
    paw.position.set(lx, ly - 0.2, lz + 0.05);
    group.add(paw);
  }

  // Tail
  const tailSegs = [[0,0.75,-0.85],[-0.2,0.9,-1.05],[-0.38,1.08,-1.0],[-0.42,1.28,-0.85],[-0.3,1.44,-0.72]];
  const tailMats = [cream, orange, cream, orange, cream];
  for (let i = 0; i < tailSegs.length; i++) {
    const [tx, ty, tz] = tailSegs[i];
    const seg = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.03, 0.08 - i * 0.012), 6, 5), tailMats[i]);
    seg.position.set(tx, ty, tz);
    group.add(seg);
  }

  // Whiskers
  const wMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.35, 4), wMat);
      w.rotation.z = Math.PI / 2;
      w.rotation.y = (i - 1) * 0.3;
      w.position.set(side * 0.28, 1.17 + (i - 1) * 0.04, 0.88);
      group.add(w);
    }
  }

  return group;
}
