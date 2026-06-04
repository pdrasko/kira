import * as THREE from 'three';

// ─── Base ────────────────────────────────────────────────────────────────────

class Enemy {
  constructor(scene, x, z, cfg) {
    this.hp          = cfg.hp;
    this.maxHp       = cfg.hp;
    this.speed       = cfg.speed;
    this.detRadius   = cfg.detectionRadius;
    this.attackRange = cfg.attackRange;
    this.attackDamage = cfg.attackDamage;
    this.attackCooldown = 0;
    this.state       = 'wander';
    this.wanderTimer = 0;
    this.wanderTarget = new THREE.Vector3(x, 0, z);
    this.mesh = this._buildMesh(cfg);
    this.mesh.position.set(x, 0, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  _buildMesh(_cfg) { return new THREE.Group(); }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    // Red flash
    this.mesh.traverse(c => {
      if (c.isMesh) {
        const orig = c.material.color.getHex();
        c.material = c.material.clone();
        c.material.color.setHex(0xff2222);
        setTimeout(() => { if (c.material) c.material.color.setHex(orig); }, 180);
      }
    });
  }

  die(scene) {
    scene.remove(this.mesh);
  }

  distanceTo(pos) {
    return this.mesh.position.distanceTo(pos);
  }

  moveToward(target, speed, delta) {
    const dx = target.x - this.mesh.position.x;
    const dz = target.z - this.mesh.position.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.05) return;
    const nx = (dx / d) * speed * delta;
    const nz = (dz / d) * speed * delta;
    this.mesh.position.x += nx;
    this.mesh.position.z += nz;
    this.mesh.rotation.y = Math.atan2(dx, dz);
  }

  _pickWanderTarget(range = 15) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 4 + Math.random() * range;
    this.wanderTarget.set(
      Math.max(-46, Math.min(46, this.mesh.position.x + Math.cos(angle) * dist)),
      0,
      Math.max(-46, Math.min(46, this.mesh.position.z + Math.sin(angle) * dist))
    );
  }

  _doWander(delta) {
    this.wanderTimer -= delta;
    const dist = this.mesh.position.distanceTo(this.wanderTarget);
    if (dist < 0.5 || this.wanderTimer <= 0) {
      this._pickWanderTarget();
      this.wanderTimer = 2 + Math.random() * 3;
    }
    this.moveToward(this.wanderTarget, this.speed * 0.5, delta);
  }

  // Pick a wander target in the opposite direction from pos (used when losing sight)
  _fleeFrom(pos) {
    const dx = this.mesh.position.x - pos.x;
    const dz = this.mesh.position.z - pos.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    this.wanderTarget.set(
      Math.max(-46, Math.min(46, this.mesh.position.x + (dx / d) * 14)),
      0,
      Math.max(-46, Math.min(46, this.mesh.position.z + (dz / d) * 14))
    );
    this.wanderTimer = 4;
  }
}

// ─── Mouse ───────────────────────────────────────────────────────────────────

export class Mouse extends Enemy {
  constructor(scene, x, z) {
    super(scene, x, z, {
      hp: 20, speed: 4.5, detectionRadius: 12,
      attackRange: 0.9, attackDamage: 3
    });
    this.attractedTo = null;
    // Start with a very short timer so they immediately pick a direction
    this.wanderTimer = Math.random() * 0.3;
  }

  _buildMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
    body.scale.set(1.2, 0.9, 1.5);
    body.position.y = 0.2;  // bottom of sphere sits at ~y=0.002
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat);
    head.position.set(0, 0.35, 0.28);
    g.add(head);

    const earMat = new THREE.MeshLambertMaterial({ color: 0xffaaaa });
    for (const ex of [-0.1, 0.1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), earMat);
      ear.scale.y = 0.4;
      ear.position.set(ex, 0.52, 0.25);
      g.add(ear);
    }

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.5, 5), mat);
    tail.rotation.z = Math.PI / 4;
    tail.position.set(-0.1, 0.2, -0.35);
    g.add(tail);

    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
    for (const ex of [-0.07, 0.07]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), eyeMat);
      eye.position.set(ex, 0.42, 0.44);
      g.add(eye);
    }

    return g;
  }

  // droppedCheeses: array of { pos, consumed } from TrapManager
  update(delta, player, droppedCheeses) {
    if (this.hp <= 0) return;
    // Keep mice on the ground at all times
    this.mesh.position.y = 0;

    if (this.state === 'trapped') return;

    // Only attracted to cheese the player has dropped — not pickup items
    if (droppedCheeses && droppedCheeses.length > 0) {
      const nearest = droppedCheeses
        .filter(c => !c.consumed)
        .sort((a, b) => this.distanceTo(a.pos) - this.distanceTo(b.pos))[0];

      if (nearest && this.distanceTo(nearest.pos) < 20) {
        this.state = 'attracted';
        this.attractedTo = nearest;
      } else if (this.state === 'attracted') {
        this.state = 'wander';
        this.attractedTo = null;
      }
    } else if (this.state === 'attracted') {
      this.state = 'wander';
      this.attractedTo = null;
    }

    if (this.state === 'attracted' && this.attractedTo) {
      if (this.attractedTo.consumed) {
        this.state = 'wander';
        this.attractedTo = null;
        this._doScurry(delta);
      } else {
        this.moveToward(this.attractedTo.pos, this.speed, delta);
      }
    } else {
      this._doScurry(delta);
    }
  }

  // Fast, jittery scurrying movement
  _doScurry(delta) {
    this.wanderTimer -= delta;
    const dist = this.mesh.position.distanceTo(this.wanderTarget);
    if (dist < 0.3 || this.wanderTimer <= 0) {
      this._pickWanderTarget(8);
      // Short intervals: 0.3–1.0 sec for that rapid scurry feel
      this.wanderTimer = 0.3 + Math.random() * 0.7;
    }
    this.moveToward(this.wanderTarget, this.speed, delta);
  }
}

// ─── Dog ─────────────────────────────────────────────────────────────────────

export class Dog extends Enemy {
  constructor(scene, x, z) {
    super(scene, x, z, {
      hp: 50, speed: 4.5, detectionRadius: 18,
      attackRange: 1.4, attackDamage: 8
    });
    this.patrolPath = [
      new THREE.Vector3(x + 8, 0, z),
      new THREE.Vector3(x + 8, 0, z + 8),
      new THREE.Vector3(x,     0, z + 8),
      new THREE.Vector3(x,     0, z),
    ];
    this.patrolIdx = 0;
  }

  _buildMesh() {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: 0xc8a46e });
    const dark = new THREE.MeshLambertMaterial({ color: 0x8a6230 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 1.3), fur);
    body.position.y = 0.65;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 7), fur);
    head.position.set(0, 1.05, 0.65);
    g.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.3), new THREE.MeshLambertMaterial({ color: 0xd4b480 }));
    snout.position.set(0, 1.0, 0.95);
    g.add(snout);

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    nose.position.set(0, 1.08, 1.1);
    g.add(nose);

    // Floppy ears
    for (const [ex, rz] of [[-0.32, 0.3], [0.32, -0.3]]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.12), dark);
      ear.position.set(ex, 1.22, 0.6);
      ear.rotation.z = rz;
      g.add(ear);
    }

    // Legs
    const legMat = new THREE.MeshLambertMaterial({ color: 0xb8924a });
    for (const [lx, lz] of [[-0.28, 0.42], [0.28, 0.42], [-0.28, -0.42], [0.28, -0.42]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.6, 6), legMat);
      leg.position.set(lx, 0.3, lz);
      g.add(leg);
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.55, 6), fur);
    tail.rotation.z = -0.6;
    tail.position.set(0.1, 0.9, -0.72);
    g.add(tail);

    // Eyes
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x553300 });
    for (const ex of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), eyeMat);
      eye.position.set(ex, 1.15, 0.96);
      g.add(eye);
    }

    return g;
  }

  update(delta, player) {
    if (this.hp <= 0) return;
    const dist = this.distanceTo(player.getPosition());
    const canSee = !player.isHiding && !player.isInTree;

    if (this.state === 'chase') {
      if (!canSee || dist > this.detRadius * 2) {
        if (player.isInTree) this._fleeFrom(player.getPosition());
        this.state = 'return';
      } else {
        this.moveToward(player.getPosition(), this.speed, delta);
      }
    } else if (this.state === 'return') {
      const wp = this.patrolPath[this.patrolIdx];
      this.moveToward(wp, this.speed * 0.7, delta);
      if (this.distanceTo(wp) < 0.6) this.state = 'patrol';
    } else {
      // patrol
      const wp = this.patrolPath[this.patrolIdx];
      this.moveToward(wp, this.speed * 0.6, delta);
      if (this.distanceTo(wp) < 0.6) {
        this.patrolIdx = (this.patrolIdx + 1) % this.patrolPath.length;
      }
      if (canSee && dist < this.detRadius) this.state = 'chase';
    }
  }
}

// ─── Human ───────────────────────────────────────────────────────────────────

export class Human extends Enemy {
  constructor(scene, x, z) {
    super(scene, x, z, {
      hp: 100, speed: 2.5, detectionRadius: 20,
      attackRange: 1.6, attackDamage: 12
    });
    this.patrolPath = [
      new THREE.Vector3(x + 10, 0, z),
      new THREE.Vector3(x, 0, z + 10),
      new THREE.Vector3(x - 10, 0, z),
      new THREE.Vector3(x, 0, z - 10),
    ];
    this.patrolIdx = 0;
  }

  _buildMesh() {
    const g = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfdbcb4 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x3498db });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x4a3728 });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x2c2c2c });

    // Legs
    for (const lx of [-0.2, 0.2]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.72, 7), pantsMat);
      leg.position.set(lx, 0.36, 0);
      g.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.38), shoeMat);
      shoe.position.set(lx, 0.06, 0.06);
      g.add(shoe);
    }

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.8, 0.4), shirtMat);
    torso.position.y = 1.12;
    torso.castShadow = true;
    g.add(torso);

    // Arms
    for (const [ax, rz] of [[-0.42, 0.15], [0.42, -0.15]]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.65, 6), shirtMat);
      arm.position.set(ax, 1.08, 0);
      arm.rotation.z = rz;
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), skinMat);
      hand.position.set(ax * 1.38, 0.82, 0);
      g.add(hand);
    }

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 7), skinMat);
    head.position.y = 1.82;
    g.add(head);

    // Hair
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 5), hairMat);
    hair.scale.y = 0.55;
    hair.position.y = 2.03;
    g.add(hair);

    // Eyes
    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
      eye.position.set(ex, 1.86, 0.28);
      g.add(eye);
    }

    return g;
  }

  update(delta, player) {
    if (this.hp <= 0) return;
    const dist = this.distanceTo(player.getPosition());
    const canSee = !player.isHiding && !player.isInTree;

    if (this.state === 'chase') {
      if (!canSee || dist > this.detRadius * 2) {
        if (player.isInTree) this._fleeFrom(player.getPosition());
        this.state = 'patrol';
      } else {
        this.moveToward(player.getPosition(), this.speed, delta);
      }
    } else {
      const wp = this.patrolPath[this.patrolIdx];
      this.moveToward(wp, this.speed * 0.7, delta);
      if (this.distanceTo(wp) < 0.6) {
        this.patrolIdx = (this.patrolIdx + 1) % this.patrolPath.length;
      }
      if (canSee && dist < this.detRadius) this.state = 'chase';
    }
  }
}

// ─── Stray Cat ───────────────────────────────────────────────────────────────

export class StrayCat extends Enemy {
  constructor(scene, x, z) {
    super(scene, x, z, {
      hp: 30, speed: 5, detectionRadius: 10,
      attackRange: 1.1, attackDamage: 6
    });
  }

  _buildMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x6b6b6b });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat);
    body.scale.set(1.1, 0.75, 1.45);
    body.position.y = 0.5;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 7), mat);
    head.position.set(0, 0.88, 0.38);
    g.add(head);

    for (const ex of [-0.15, 0.15]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), darkMat);
      ear.position.set(ex, 1.12, 0.34);
      g.add(ear);
    }

    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
    for (const ex of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), eyeMat);
      eye.position.set(ex, 0.94, 0.62);
      g.add(eye);
    }

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.6, 5), mat);
    tail.rotation.z = 0.7;
    tail.position.set(0, 0.65, -0.55);
    g.add(tail);

    for (const [lx, lz] of [[-0.28, 0.3],[0.28, 0.3],[-0.25, -0.3],[0.25, -0.3]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.35, 5), mat);
      leg.position.set(lx, 0.18, lz);
      g.add(leg);
    }

    return g;
  }

  update(delta, player) {
    if (this.hp <= 0) return;
    const dist = this.distanceTo(player.getPosition());
    const canSee = !player.isHiding && !player.isInTree;

    if (this.state === 'chase') {
      if (!canSee || dist > this.detRadius * 1.6) {
        if (player.isInTree) this._fleeFrom(player.getPosition());
        this.state = 'wander';
      } else {
        this.moveToward(player.getPosition(), this.speed, delta);
      }
    } else {
      this._doWander(delta);
      if (canSee && dist < this.detRadius) this.state = 'chase';
    }
  }
}

// ─── Spawn ───────────────────────────────────────────────────────────────────

const SPAWN_CONFIG = [
  { cls: Mouse,    x: -20, z:  10 },
  { cls: Mouse,    x:  15, z: -25 },
  { cls: Mouse,    x:  30, z:  20 },
  { cls: Mouse,    x:  -5, z:  35 },
  { cls: Mouse,    x:  35, z:  -5 },
  { cls: Dog,      x: -30, z: -20 },
  { cls: Dog,      x:  28, z:  22 },
  { cls: Human,    x:  25, z:  30 },
  { cls: Human,    x: -28, z:  28 },
  { cls: StrayCat, x: -10, z:  20 },
  { cls: StrayCat, x:  20, z: -10 },
];

export function spawnEnemies(scene) {
  return SPAWN_CONFIG.map(({ cls, x, z }) => new cls(scene, x, z));
}

export function respawnEnemies(scene, enemies) {
  // Remove surviving meshes
  for (const e of enemies) scene.remove(e.mesh);
  enemies.length = 0;
  for (const { cls, x, z } of SPAWN_CONFIG) {
    enemies.push(new cls(scene, x, z));
  }
}
