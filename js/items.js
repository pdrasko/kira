import * as THREE from 'three';

// No cheese here — cheese is hidden inside trash cans, found by pressing Enter near one
const SPAWN_LIST = [
  { type: 'basket',   x: 3,   z: -5  },
  { type: 'basket',   x: -7,  z: -18 },
  { type: 'basket',   x: 18,  z: 15  },
  { type: 'yarn',     x: -18, z: 12  },
  { type: 'tincan',   x: 22,  z: 8   },
  { type: 'fishbone', x: -12, z: -20 },
  { type: 'sock',     x: 8,   z: 22  },
  { type: 'bottle',   x: -25, z: 5   },
];

export class Item {
  constructor(scene, type, x, z) {
    this.type = type;
    this.collected = false;
    this.baseY = 0.5;
    this._t = Math.random() * Math.PI * 2; // per-item phase offset
    this.mesh = buildItemMesh(type);
    this.mesh.position.set(x, this.baseY, z);
    this.mesh.userData.item = this;
    scene.add(this.mesh);
  }

  update(delta) {
    this._t += delta;
    this.mesh.position.y = this.baseY + Math.sin(this._t * 2) * 0.12;
    this.mesh.rotation.y += delta * 0.8;
  }

  collect() {
    this.collected = true;
    this.mesh.visible = false;
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}

export function spawnItems(scene) {
  return SPAWN_LIST.map(({ type, x, z }) => new Item(scene, type, x, z));
}

function buildItemMesh(type) {
  switch (type) {
    case 'cheese':   return makeCheese();
    case 'basket':   return makeBasket();
    case 'yarn':     return makeYarn();
    case 'tincan':   return makeTinCan();
    case 'fishbone': return makeFishBone();
    case 'sock':     return makeSock();
    case 'bottle':   return makeBottle();
    default:         return makeGeneric();
  }
}

function makeCheese() {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.28, 0.22, 0.3, 3);
  const mat = new THREE.MeshLambertMaterial({ color: 0xf4d03f });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
  // holes
  for (let i = 0; i < 3; i++) {
    const hg = new THREE.SphereGeometry(0.05, 5, 5);
    const hm = new THREE.Mesh(hg, new THREE.MeshLambertMaterial({ color: 0xd4a520 }));
    hm.position.set(Math.cos(i * 2.1) * 0.13, (i % 2 === 0 ? 0.12 : -0.05), Math.sin(i * 2.1) * 0.13);
    g.add(hm);
  }
  return g;
}

function makeBasket() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.35, 0.55, 10, 1, true), mat);
  body.position.y = 0.28;
  body.castShadow = true;
  g.add(body);
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), mat);
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.01;
  g.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 5, 12), new THREE.MeshLambertMaterial({ color: 0xb8895a }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.57;
  g.add(rim);
  return g;
}

function makeYarn() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xe91e8c });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat);
  ball.castShadow = true;
  g.add(ball);
  const wireMat = new THREE.MeshLambertMaterial({ color: 0xc2185b });
  for (let i = 0; i < 5; i++) {
    const t = new THREE.TorusGeometry(0.22, 0.02, 4, 14);
    const ring = new THREE.Mesh(t, wireMat);
    ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    g.add(ring);
  }
  return g;
}

function makeTinCan() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 10), mat);
  body.position.y = 0.16;
  body.castShadow = true;
  g.add(body);
  const topMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  for (const y of [0.0, 0.32]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), topMat);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = y;
    g.add(cap);
  }
  return g;
}

function makeFishBone() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xeeeecc });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.04), mat);
  g.add(spine);
  for (let i = -1; i <= 1; i++) {
    for (const s of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.04), mat);
      rib.position.set(i * 0.12, 0, s * 0.09);
      rib.rotation.y = s * Math.PI / 5;
      g.add(rib);
    }
  }
  const headGeo = new THREE.SphereGeometry(0.07, 5, 4);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.set(0.24, 0, 0);
  g.add(head);
  return g;
}

function makeSock() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x888877 });
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.07, 6, 10), mat);
  cuff.position.y = 0.07;
  g.add(cuff);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 7), mat);
  leg.position.y = 0.22;
  g.add(leg);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.18, 6), mat);
  foot.rotation.z = Math.PI / 2;
  foot.position.set(0.1, 0.08, 0);
  g.add(foot);
  return g;
}

function makeBottle() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x4caf50, transparent: true, opacity: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.38, 8), mat);
  body.position.y = 0.19;
  body.castShadow = true;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.15, 7), mat);
  neck.position.y = 0.45;
  g.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 7), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  cap.position.y = 0.55;
  g.add(cap);
  return g;
}

function makeGeneric() {
  const geo = new THREE.SphereGeometry(0.2, 6, 5);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  return new THREE.Mesh(geo, mat);
}
