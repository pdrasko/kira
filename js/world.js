import * as THREE from 'three';

const TREE_POSITIONS = [
  [-20,15],[-35,-10],[25,-20],[10,30],[-15,-35],
  [35,20],[-30,25],[20,-35],[-40,5],[30,-10],
  [5,-40],[-10,40],[40,-30],[-25,-25],[15,35],
  [-42,30],[32,38],[-18,42]
];

// Five trash cans, spread to the edges of the park
const TRASH_POSITIONS = [
  [-32, -28],
  [ 30, -32],
  [-36,  22],
  [ 34,  28],
  [  2, -40],
];

const BENCH_CONFIGS = [
  [0, 15, 0], [15, 0, Math.PI/2],
  [0, -15, Math.PI], [-15, 0, -Math.PI/2]
];

const JUNK_POOL = ['string', 'bean_can', 'rotten_apple', 'tincan', 'fishbone', 'sock'];

export function buildWorld(scene) {
  createLighting(scene);
  createGround(scene);
  createPaths(scene);
  createFence(scene);

  const treePositions = TREE_POSITIONS.map(([x, z]) => {
    createTree(scene, x, z);
    return { x, z };
  });

  BENCH_CONFIGS.forEach(([x, z, ry]) => createBench(scene, x, z, ry));

  const trashCans = TRASH_POSITIONS.map(([x, z]) => {
    const can = createTrashCan(scene, x, z);
    can.userData.contents = generateTrashContents();
    return can;
  });

  return { trashCans, treePositions };
}

function generateTrashContents() {
  const contents = [];
  if (Math.random() < 0.65) contents.push('cheese');
  const numJunk = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numJunk; i++) {
    contents.push(JUNK_POOL[Math.floor(Math.random() * JUNK_POOL.length)]);
  }
  return contents;
}

function createLighting(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xfff8dc, 1.25);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far  = 150;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -60;
  sun.shadow.camera.right = sun.shadow.camera.top   =  60;
  scene.add(sun);
}

function createGround(scene) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshLambertMaterial({ color: 0x4a7c4e })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function createPaths(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xc8b57a });
  for (const [w, h] of [[60, 3], [3, 60]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.01;
    scene.add(m);
  }
}

function createTree(scene, x, z) {
  const group = new THREE.Group();
  const trunkMat   = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const foliageMat  = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  const foliageMat2 = new THREE.MeshLambertMaterial({ color: 0x3a8a3a });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 3.2, 7), trunkMat);
  trunk.position.y = 1.6;
  trunk.castShadow = true;
  group.add(trunk);

  const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4, 7), foliageMat);
  c1.position.y = 5.5;
  c1.castShadow = true;
  group.add(c1);

  const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.2, 7), foliageMat2);
  c2.position.y = 7.5;
  c2.castShadow = true;
  group.add(c2);

  group.position.set(x, 0, z);
  scene.add(group);
}

function createTrashCan(scene, x, z) {
  const group = new THREE.Group();
  const mat    = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const rimMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const lidMat = new THREE.MeshLambertMaterial({ color: 0x666666 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.2, 10), mat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 14), rimMat);
  rim.position.y = 1.22;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.1, 10), lidMat);
  lid.position.y = 1.28;
  lid.castShadow = true;
  group.add(lid);

  group.position.set(x, 0, z);
  group.userData.isTrashCan = true;
  scene.add(group);
  return group;
}

function createBench(scene, x, z, rotY) {
  const group   = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b6343 });
  const metMat  = new THREE.MeshLambertMaterial({ color: 0x555555 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.65), woodMat);
  seat.position.y = 0.62;
  seat.castShadow = true;
  group.add(seat);

  for (const lx of [-0.85, 0.85]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.62), metMat);
    leg.position.set(lx, 0.3, 0);
    group.add(leg);
  }

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), woodMat);
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
  const size = 48, step = 2.5;
  const sides = [
    { axis:'x', val:-size, from:-size, to:size },
    { axis:'x', val: size, from:-size, to:size },
    { axis:'z', val:-size, from:-size, to:size },
    { axis:'z', val: size, from:-size, to:size },
  ];
  for (const s of sides) {
    for (let t = s.from; t <= s.to; t += step) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.3, 5), postMat);
      post.position.set(s.axis==='x' ? t : s.val, 0.65, s.axis==='z' ? t : s.val);
      scene.add(post);
    }
    for (let t = s.from; t < s.to; t += step) {
      const rGeo = new THREE.BoxGeometry(
        s.axis==='x' ? step : 0.07, 0.07, s.axis==='z' ? step : 0.07
      );
      const rail = new THREE.Mesh(rGeo, railMat);
      const mid = t + step / 2;
      rail.position.set(s.axis==='x' ? mid : s.val, 1.0, s.axis==='z' ? mid : s.val);
      scene.add(rail);
    }
  }
}
