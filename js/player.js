import * as THREE from 'three';

const SPEED = 6;
const JUMP_VEL = 8;
const GRAVITY = -22;
const MAX_HP = 30;
const REGEN_INTERVAL = 10;
const BOUNDARY = 47;

export class Player {
  constructor(scene, inventory) {
    this.maxHp = MAX_HP;
    this.hp = MAX_HP;
    this.velocity = new THREE.Vector3();
    this.onGround = true;
    this.isHiding = false;
    this.regenTimer = 0;
    this.inventory = inventory;
    this.damageCooldown = 0;

    this.mesh = buildCatMesh();
    this.mesh.position.set(0, 0, 0);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update(delta, KeyState, cameraYaw) {
    this._move(delta, KeyState, cameraYaw);
    this._applyGravity(delta, KeyState);
    this._regen(delta);
    if (this.damageCooldown > 0) this.damageCooldown -= delta;
  }

  _move(delta, KeyState, cameraYaw) {
    if (this.isHiding) return;
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
      const current = this.mesh.rotation.y;
      let diff = targetAngle - current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * Math.min(1, 10 * delta);
    }

    this.mesh.position.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.mesh.position.x));
    this.mesh.position.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, this.mesh.position.z));
  }

  _applyGravity(delta, KeyState) {
    if (KeyState.space && this.onGround) {
      this.velocity.y = JUMP_VEL;
      this.onGround = false;
    }
    this.velocity.y += GRAVITY * delta;
    this.mesh.position.y += this.velocity.y * delta;
    if (this.mesh.position.y <= 0) {
      this.mesh.position.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    }
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
    // Flash red
    this.mesh.traverse(c => {
      if (c.isMesh) {
        c.userData._origColor = c.userData._origColor || c.material.color.getHex();
        c.material = c.material.clone();
        c.material.color.setHex(0xff0000);
        setTimeout(() => {
          if (c.material) c.material.color.setHex(c.userData._origColor);
        }, 200);
      }
    });
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  getPosition() {
    return this.mesh.position;
  }
}

function buildCatMesh() {
  const group = new THREE.Group();

  // --- Body segments (calico: cream, orange patch, black patch) ---
  const cream  = new THREE.MeshLambertMaterial({ color: 0xf5deb3 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xe8733a });
  const black  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const white  = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const pink   = new THREE.MeshLambertMaterial({ color: 0xffb6c1 });
  const eyeGreen = new THREE.MeshLambertMaterial({ color: 0x2ea04f });

  const bodyGeo = new THREE.SphereGeometry(0.5, 10, 8);
  const body = new THREE.Mesh(bodyGeo, cream);
  body.scale.set(1.2, 0.8, 1.6);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  // Orange patch on back
  const patchO = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), orange);
  patchO.scale.set(0.9, 0.6, 1.1);
  patchO.position.set(0.2, 0.82, -0.15);
  group.add(patchO);

  // Black patch on side
  const patchB = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), black);
  patchB.scale.set(0.7, 0.55, 0.9);
  patchB.position.set(-0.3, 0.78, 0.25);
  group.add(patchB);

  // --- Head ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), cream);
  head.position.set(0, 1.22, 0.55);
  head.castShadow = true;
  group.add(head);

  // Snout
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), white);
  snout.scale.set(1.1, 0.75, 0.85);
  snout.position.set(0, 1.16, 0.87);
  group.add(snout);

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), pink);
  nose.position.set(0, 1.22, 0.93);
  group.add(nose);

  // Eyes
  for (const [ex, ez] of [[-0.14, 0.86], [0.14, 0.86]]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), eyeGreen);
    eye.position.set(ex, 1.32, ez);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), new THREE.MeshLambertMaterial({ color: 0x0a0a0a }));
    pupil.position.set(ex * 1.01, 1.32, ez * 1.01 + 0.01);
    group.add(pupil);
  }

  // --- Ears ---
  const earGeo = new THREE.ConeGeometry(0.13, 0.28, 4);
  const earL = new THREE.Mesh(earGeo, orange);   // orange ear (calico)
  earL.position.set(-0.22, 1.54, 0.5);
  earL.rotation.z = -0.25;
  group.add(earL);

  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 4), black);  // black ear
  earR.position.set(0.22, 1.54, 0.5);
  earR.rotation.z = 0.25;
  group.add(earR);

  // Inner ears
  for (const [ex, mat2] of [[-0.22, pink], [0.22, pink]]) {
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 4), mat2);
    inner.position.set(ex, 1.54, 0.5);
    inner.rotation.z = ex < 0 ? -0.25 : 0.25;
    group.add(inner);
  }

  // --- Legs ---
  const legMat = new THREE.MeshLambertMaterial({ color: 0xf0d090 });
  const legPositions = [
    [-0.42, 0.22,  0.45],
    [ 0.42, 0.22,  0.45],
    [-0.38, 0.22, -0.45],
    [ 0.38, 0.22, -0.45],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.44, 7), legMat);
    leg.position.set(lx, ly, lz);
    group.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), white);
    paw.scale.set(1.2, 0.7, 1.3);
    paw.position.set(lx, ly - 0.2, lz + 0.05);
    group.add(paw);
  }

  // --- Tail ---
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xe8733a });
  const tailPositions = [
    [0, 0.75, -0.85],
    [-0.2, 0.9, -1.05],
    [-0.38, 1.08, -1.0],
    [-0.42, 1.28, -0.85],
    [-0.3, 1.44, -0.72],
  ];
  const tailMats = [cream, orange, cream, orange, cream];
  for (let i = 0; i < tailPositions.length; i++) {
    const [tx, ty, tz] = tailPositions[i];
    const r = 0.08 - i * 0.012;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.03, r), 6, 5), tailMats[i]);
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
