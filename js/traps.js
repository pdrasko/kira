import * as THREE from 'three';

const BASKET_RANGE    = 3.5;   // cheese must be within this of basket
const COLLECT_RANGE   = 2.5;   // player must be within this to collect
const ATTRACT_RANGE   = 0.55;  // mouse must reach cheese to trigger trap
const TRAP_SCORE      = 15;

export class TrapManager {
  constructor(scene) {
    this.scene = scene;
    this.baskets = [];  // { mesh, pos, cheesePos, trappedMouse, cheeseLoaded }
    this.cheeses = [];  // { mesh, pos, consumed }
  }

  placeBasket(pos, inventory) {
    inventory.remove('basket');
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

    g.position.set(pos.x, 0, pos.z);
    this.scene.add(g);
    this.baskets.push({ mesh: g, pos: g.position, cheesePos: null, trappedMouse: null, cheeseLoaded: false });
  }

  placeCheese(pos, inventory) {
    const nearBasket = this._findNearbyBasket(pos);
    if (!nearBasket) return false;
    inventory.remove('cheese');

    const cg = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.28, 3),
      new THREE.MeshLambertMaterial({ color: 0xf4d03f })
    );
    cone.position.y = 0.14;
    cg.add(cone);
    cg.position.set(pos.x, 0, pos.z);
    this.scene.add(cg);

    const entry = { mesh: cg, pos: cg.position, consumed: false };
    this.cheeses.push(entry);
    nearBasket.cheeseLoaded = true;
    nearBasket.cheesePos = cg.position;
    nearBasket.cheeseEntry = entry;
    return true;
  }

  hasNearbyBasket(pos) {
    return !!this._findNearbyBasket(pos);
  }

  _findNearbyBasket(pos) {
    for (const b of this.baskets) {
      if (!b.trappedMouse && pos.distanceTo(b.pos) < BASKET_RANGE) return b;
    }
    return null;
  }

  update(delta, enemies) {
    for (const basket of this.baskets) {
      if (!basket.cheeseLoaded || basket.trappedMouse) continue;
      // Check if any mouse has reached the cheese
      for (const enemy of enemies) {
        if (enemy.hp <= 0 || enemy.constructor.name !== 'Mouse') continue;
        if (enemy.state === 'trapped') continue;
        if (basket.cheesePos && enemy.mesh.position.distanceTo(basket.cheesePos) < ATTRACT_RANGE) {
          // Trap it!
          enemy.state = 'trapped';
          enemy.mesh.position.set(basket.pos.x, 0, basket.pos.z);
          basket.trappedMouse = enemy;
          // Remove cheese mesh
          if (basket.cheeseEntry && !basket.cheeseEntry.consumed) {
            basket.cheeseEntry.consumed = true;
            this.scene.remove(basket.cheeseEntry.mesh);
          }
        }
      }
    }
  }

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
