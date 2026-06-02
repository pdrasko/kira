import * as THREE from 'three';

const TREE_POSITIONS = [
  [-20,15],[-35,-10],[25,-20],[10,30],[-15,-35],
  [35,20],[-30,25],[20,-35],[-40,5],[30,-10],
  [5,-40],[-10,40],[40,-30],[-25,-25],[15,35],
  [-42,30],[32,38],[-18,42]
];

const TRASH_POSITIONS = [
  [-8,5],[8,-6],[-6,-8],[5,9],[12,3],
  [-12,-3],[3,-12],[-3,12],[9,-9],[-9,9]
];

const BENCH_CONFIGS = [
  [0, 15, 0], [15, 0, Math.PI/2],
  [0, -15, Math.PI], [-15, 0, -Math.PI/2]
];

export function buildWorld(scene) {
  createLighting(scene);
  createGround(scene);
  createPaths(scene);
  createFence(scene);

  TREE_POSITIONS.forEach(([x, z]) => createTree(scene, x, z));
  BENCH_CONFIGS.forEach(([x, z, ry]) => createBench(scene, x, z, ry));

  // Randomly hide cheese in ~60% of trash cans
  const trashCans = TRASH_POSITIONS.map(([x, z]) => {
    const can = createTrashCan(scene, x, z);
    can.userData.hasCheeseItem = Math.random() < 0.6;
    return can;
  });

  return { trashCans };
}

function createLighting(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));

  const sun = new THREE.DirectionalLight(0xfff8dc, 1.25);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 150;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  scene.add(sun);
}

function createGround(scene) {
  const geo = new THREE.PlaneGeometry(100, 100);
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a7c4e });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function createPaths(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xc8b57a });
  // Cross-shaped paths
  for (const [w, h, rx, rz] of [[60, 3, 0, 0], [3, 60, 0, 0]]) {
    const geo = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.01;
    if (w === 3) m.position.x = rz;
    scene.add(m);
  }
}

function createTree(scene, x, z) {
  const group = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.38, 3.2, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.6;
  trunk.castShadow = true;
  group.add(trunk);

  const foliageMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  const foliageMat2 = new THREE.MeshLambertMaterial({ color: 0x3a8a3a });

  const c1Geo = new THREE.ConeGeometry(2.5, 4, 7);
  const c1 = new THREE.Mesh(c1Geo, foliageMat);
  c1.position.y = 5.5;
  c1.castShadow = true;
  group.add(c1);

  const c2Geo = new THREE.ConeGeometry(2.0, 3.2, 7);
  const c2 = new THREE.Mesh(c2Geo, foliageMat2);
  c2.position.y = 7.5;
  c2.castShadow = true;
  group.add(c2);

  group.position.set(x, 0, z);
  scene.add(group);
}

function createTrashCan(scene, x, z) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.42, 1.2, 10);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  const rimGeo = new THREE.TorusGeometry(0.5, 0.04, 6, 14);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshLambertMaterial({ color: 0x333333 }));
  rim.position.y = 1.22;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const lidGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.1, 10);
  const lid = new THREE.Mesh(lidGeo, new THREE.MeshLambertMaterial({ color: 0x666666 }));
  lid.position.y = 1.28;
  lid.castShadow = true;
  group.add(lid);

  group.position.set(x, 0, z);
  group.userData.isTrashCan = true;
  scene.add(group);
  return group;
}

function createBench(scene, x, z, rotY) {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b6343 });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  const seatGeo = new THREE.BoxGeometry(2.2, 0.12, 0.65);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.y = 0.62;
  seat.castShadow = true;
  group.add(seat);

  for (const lx of [-0.85, 0.85]) {
    const legGeo = new THREE.BoxGeometry(0.12, 0.6, 0.62);
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(lx, 0.3, 0);
    group.add(leg);
  }

  const backGeo = new THREE.BoxGeometry(2.2, 0.5, 0.1);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.set(0, 1.05, -0.28);
  back.castShadow = true;
  group.add(back);

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  scene.add(group);
}

function createFence(scene) {
  const postMat = new THREE.MeshLambertMaterial({ color: 0x8b6343 });
  const railMat = new THREE.MeshLambertMaterial({ color: 0xa0724a });
  const size = 48;
  const step = 2.5;

  const sides = [
    { axis: 'x', val: -size, from: -size, to: size },
    { axis: 'x', val:  size, from: -size, to: size },
    { axis: 'z', val: -size, from: -size, to: size },
    { axis: 'z', val:  size, from: -size, to: size },
  ];

  for (const s of sides) {
    for (let t = s.from; t <= s.to; t += step) {
      const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.3, 5);
      const post = new THREE.Mesh(postGeo, postMat);
      if (s.axis === 'x') post.position.set(t, 0.65, s.val);
      else post.position.set(s.val, 0.65, t);
      scene.add(post);
    }

    for (let t = s.from; t < s.to; t += step) {
      const railGeo = new THREE.BoxGeometry(
        s.axis === 'x' ? step : 0.07,
        0.07,
        s.axis === 'z' ? step : 0.07
      );
      const rail = new THREE.Mesh(railGeo, railMat);
      const mid = t + step / 2;
      if (s.axis === 'x') rail.position.set(mid, 1.0, s.val);
      else rail.position.set(s.val, 1.0, mid);
      scene.add(rail);
    }
  }
}
