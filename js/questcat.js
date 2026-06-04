import * as THREE from 'three';

const ITEM_LABELS = {
  cheese:       'Cheese 🧀',
  basket:       'Laundry Basket 🧺',
  yarn:         'Yarn Ball 🧶',
  tincan:       'Tin Can 🥫',
  fishbone:     'Fish Bone 🐟',
  sock:         'Old Sock 🧦',
  bottle:       'Bottle 🍾',
  string:       'String 🧵',
  bean_can:     'Bean Can 🫘',
  rotten_apple: 'Rotten Apple 🍎',
};
const ITEM_TYPES = Object.keys(ITEM_LABELS);

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export class QuestCat {
  constructor(scene) {
    this.scene  = scene;
    this.cat    = null;   // { mesh, give, receive, t }
    this.quest  = null;   // { give, receive }
    this._buildUI();
  }

  get active() { return this.cat !== null; }

  spawn(pos) {
    if (this.active) return;
    const give = rand(ITEM_TYPES);
    let receive;
    do { receive = rand(ITEM_TYPES); } while (receive === give);
    const mesh = _buildGingerCatMesh();
    mesh.position.set(pos.x, 0, pos.z);
    this.scene.add(mesh);
    this.cat = { mesh, give, receive, t: 0 };
  }

  update(delta) {
    if (!this.cat) return;
    this.cat.t += delta;
    this.cat.mesh.position.y = Math.sin(this.cat.t * 1.5) * 0.08;
    this.cat.mesh.rotation.y += delta * 0.6;
  }

  tryInteract(playerPos) {
    if (!this.cat) return false;
    if (playerPos.distanceTo(this.cat.mesh.position) < 2.2) {
      this._showBubble();
      return true;
    }
    return false;
  }

  checkQuestComplete(inventory) {
    if (!this.quest) return null;
    if (!inventory.has(this.quest.give)) return null;
    inventory.remove(this.quest.give);
    inventory.add(this.quest.receive);
    const reward = ITEM_LABELS[this.quest.receive];
    this.quest = null;
    this._trackerEl.style.display = 'none';
    if (this.cat) { this.scene.remove(this.cat.mesh); this.cat = null; }
    return reward;
  }

  _showBubble() {
    if (!this.cat) return;
    const { give, receive } = this.cat;
    this._bubbleEl.innerHTML = `
      <div style="font-size:24px;margin-bottom:8px">🐱✨</div>
      <p style="margin:0 0 16px;line-height:1.6">
        "Hello there! If you give me<br>
        <strong>${ITEM_LABELS[give]}</strong><br>
        I will give you<br>
        <strong>${ITEM_LABELS[receive]}</strong>."
      </p>
      <div style="display:flex;gap:12px;justify-content:center">
        <button id="qc-accept" style="padding:9px 22px;font-family:monospace;font-size:13px;
          background:#2ecc40;border:none;border-radius:6px;cursor:pointer;font-weight:bold">
          Accept
        </button>
        <button id="qc-decline" style="padding:9px 22px;font-family:monospace;font-size:13px;
          background:#888;border:none;border-radius:6px;cursor:pointer;color:#fff">
          No thanks
        </button>
      </div>`;
    this._bubbleEl.style.display = 'block';

    document.getElementById('qc-accept').onclick = () => {
      this._bubbleEl.style.display = 'none';
      if (!this.cat) return;
      this.quest = { give: this.cat.give, receive: this.cat.receive };
      this._trackerEl.textContent = 'Quest: collect ' + ITEM_LABELS[this.quest.give];
      this._trackerEl.style.display = 'block';
    };
    document.getElementById('qc-decline').onclick = () => {
      this._bubbleEl.style.display = 'none';
    };
  }

  _buildUI() {
    this._bubbleEl = document.createElement('div');
    this._bubbleEl.id = 'quest-bubble';
    this._bubbleEl.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(255,252,235,0.97);color:#222;padding:24px 30px;' +
      'border-radius:14px;font-family:monospace;font-size:14px;text-align:center;' +
      'max-width:300px;width:90%;display:none;z-index:500;' +
      'box-shadow:0 4px 24px rgba(0,0,0,0.55);border:3px solid #e8722a;';
    document.body.appendChild(this._bubbleEl);

    this._trackerEl = document.getElementById('quest-tracker');
  }
}

function _buildGingerCatMesh() {
  const g       = new THREE.Group();
  const ginger  = new THREE.MeshLambertMaterial({ color: 0xe07828 });
  const dkGing  = new THREE.MeshLambertMaterial({ color: 0xb85e18 });
  const gold    = new THREE.MeshLambertMaterial({ color: 0xffd700 });
  const amber   = new THREE.MeshLambertMaterial({ color: 0xff9900, transparent: true, opacity: 0.65 });
  const pink    = new THREE.MeshLambertMaterial({ color: 0xff88aa });

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), ginger);
  body.scale.set(1.1, 0.75, 1.45);
  body.position.y = 0.5;
  g.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 7), ginger);
  head.position.set(0, 0.9, 0.38);
  g.add(head);

  // Ears
  for (const ex of [-0.16, 0.16]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), dkGing);
    ear.position.set(ex, 1.14, 0.34);
    g.add(ear);
  }

  // Gold goggles — two torus frames + amber lenses
  for (const ex of [-0.12, 0.12]) {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 6, 14), gold);
    frame.position.set(ex, 0.93, 0.65);
    g.add(frame);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.057, 12), amber);
    lens.position.set(ex, 0.93, 0.648);
    g.add(lens);
  }
  // Goggle bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.018, 0.012), gold);
  bridge.position.set(0, 0.93, 0.65);
  g.add(bridge);

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), pink);
  nose.position.set(0, 0.88, 0.66);
  g.add(nose);

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.65, 5), ginger);
  tail.rotation.z = 0.7;
  tail.position.set(0, 0.65, -0.55);
  g.add(tail);

  // Legs
  for (const [lx, lz] of [[-0.28, 0.3], [0.28, 0.3], [-0.25, -0.3], [0.25, -0.3]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.35, 5), ginger);
    leg.position.set(lx, 0.18, lz);
    g.add(leg);
  }

  return g;
}
