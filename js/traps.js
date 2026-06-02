import * as THREE from 'three';

const BASKET_LINK_RANGE = 3.5;  // cheese auto-links to basket within this radius
const COLLECT_RANGE     = 2.5;  // player must be this close to collect trap
const ATTRACT_RANGE     = 0.6;  // mouse reaches cheese → trigger trap
const TRAP_SCORE        = 15;

export class TrapManager {
  constructor(scene) {
    this.scene   = scene;
    this.baskets = [];  // { mesh, pos, linkedCheese }
    this.cheeses = [];  // { mesh, pos, consumed, linkedBasket }
  }

  // ── Place basket (Enter key while holding basket) ─────────────────────────
  placeBasket(pos, inventory) {
    inventory.remove('basket');
    const g = buildBasketMesh();
    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    const entry = { mesh: g, pos: g.position, linkedCheese: null };
    this.baskets.push(entry);
    // Auto-link any existing nearby cheese
    for (const c of this.cheeses) {
      if (!c.consumed && !c.linkedBasket && pos.distanceTo(c.pos) < BASKET_LINK_RANGE) {
        entry.linkedCheese = c;
        c.linkedBasket = entry;
        break;
      }
    }
    return entry;
  }

  // ── Drop cheese (B key while holding cheese) ──────────────────────────────
  dropCheese(pos, inventory) {
    if (!inventory.has('cheese')) return false;
    inventory.remove('cheese');

    const g = buildDroppedCheeseMesh();
    g.position.set(pos.x, 0.15, pos.z);
    this.scene.add(g);

    const entry = { mesh: g, pos: g.position, consumed: false, linkedBasket: null };
    this.cheeses.push(entry);

    // Auto-link to a nearby unlinked basket
    for (const b of this.baskets) {
      if (!b.linkedCheese && pos.distanceTo(b.pos) < BASKET_LINK_RANGE) {
        b.linkedCheese = entry;
        entry.linkedBasket = b;
        break;
      }
    }

    return true;
  }

  hasNearbyBasket(pos) {
    return this.baskets.some(b => pos.distanceTo(b.pos) < BASKET_LINK_RANGE);
  }

  // ── Called each frame ────────────────────────────────────────────────────
  update(delta, enemies) {
    for (const basket of this.baskets) {
      if (!basket.linkedCheese || basket.trappedMouse) continue;
      for (const enemy of enemies) {
        if (enemy.hp <= 0 || enemy.constructor.name !== 'Mouse') continue;
        if (enemy.state === 'trapped') continue;
        if (enemy.mesh.position.distanceTo(basket.linkedCheese.pos) < ATTRACT_RANGE) {
          // Trap the mouse
          enemy.state = 'trapped';
          enemy.mesh.position.set(basket.pos.x, 0, basket.pos.z);
          basket.trappedMouse = enemy;
          // Consume the cheese
          basket.linkedCheese.consumed = true;
          this.scene.remove(basket.linkedCheese.mesh);
        }
      }
    }

    // Non-trap cheese: if a mouse reaches it with no linked basket, eat it
    for (const cheese of this.cheeses) {
      if (cheese.consumed || cheese.linkedBasket) continue;
      for (const enemy of enemies) {
        if (enemy.hp <= 0 || enemy.constructor.name !== 'Mouse') continue;
        if (enemy.state === 'trapped') continue;
        if (enemy.mesh.position.distanceTo(cheese.pos) < ATTRACT_RANGE) {
          cheese.consumed = true;
          this.scene.remove(cheese.mesh);
          // Mouse snacks and goes back to scurrying
          enemy.state = 'wander';
          enemy.attractedTo = null;
        }
      }
    }
  }

  // ── Collect a trapped mouse ───────────────────────────────────────────────
  collectTrap(playerPos, onCollect) {
    for (let i = this.baskets.length - 1; i >= 0; i--) {
      const basket = this.baskets[i];
      if (!basket.trappedMouse) continue;
      if (playerPos.distanceTo(basket.pos) < COLLECT_RANGE) {
        basket.trappedMouse.die(this.scene);
        this.scene.remove(basket.mesh);
        this.baskets.splice(i, 1);
        onCollect(TRAP_SCORE);
        return true;
      }
    }
    return false;
  }
}

// ── Mesh builders ────────────────────────────────────────────────────────────

function buildBasketMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.38, 0.58, 10, 1, true), mat);
  body.position.y = 0.29;
  g.add(body);
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.38, 10), mat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.01;
  g.add(base);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.04, 5, 12),
    new THREE.MeshLambertMaterial({ color: 0xb8895a })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.6;
  g.add(rim);
  return g;
}

function buildDroppedCheeseMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xf4d03f });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.22, 3), mat);
  body.position.y = 0.11;
  g.add(body);
  // Holes
  const holeMat = new THREE.MeshLambertMaterial({ color: 0xd4a520 });
  for (let i = 0; i < 3; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), holeMat);
    h.position.set(Math.cos(i * 2.1) * 0.1, 0.18, Math.sin(i * 2.1) * 0.1);
    g.add(h);
  }
  return g;
}
