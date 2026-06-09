import * as THREE from 'three';

// States: 'wander' | 'filling' | 'ally' | 'hostile' | null
const LOVE_CLICKS_NEEDED = 10;
const ALLY_ATTACK_DAMAGE = 10;
const ALLY_ATTACK_RANGE  = 2.8;
const ALLY_ATTACK_CD     = 1.2;
const HOSTILE_HP         = 30;
const HOSTILE_SPEED      = 5;
const HOSTILE_ATTACK_DMG = 6;
const HOSTILE_ATTACK_RNG = 1.2;

export class TortoiseshellCat {
  constructor(scene) {
    this.scene   = scene;
    this.cat     = null;  // { mesh, state, loveClicks, wanderTimer, wanderTarget, hp, attackCd }
    this._blocked = false;
    this._buildUI();
  }

  get active()  { return this.cat !== null; }
  get isAlly()  { return this.cat?.state === 'ally'; }
  get talking() { return this._uiEl.style.display !== 'none'; }

  // Call once when score milestone hit
  spawn() {
    if (this.active || this._blocked) return;
    const angle = Math.random() * Math.PI * 2;
    const dist  = 15 + Math.random() * 22;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const mesh = _buildMesh();
    mesh.position.set(x, 0, z);
    mesh.scale.setScalar(1.0);
    this.scene.add(mesh);
    this.cat = {
      mesh, state: 'wander',
      loveClicks: 0,
      wanderTimer: 0,
      wanderTarget: new THREE.Vector3(x, 0, z),
      hp: HOSTILE_HP,
      attackCd: 0,
    };
  }

  unblock() { this._blocked = false; }

  // Returns points if hostile cat was killed this frame
  update(delta, player, enemies, camera, onHostileKill) {
    if (!this.cat) { this._hideUI(); return; }
    const { cat } = this;
    const ppos = player.getPosition();

    if (cat.state === 'wander') {
      this._doWander(cat, delta);
      const d2 = _dist2D(ppos, cat.mesh.position);
      if (d2 < 3.5) {
        this._showButtons();
        this._positionUI(cat.mesh.position, camera);
      } else {
        this._hideUI();
      }

    } else if (cat.state === 'filling') {
      // cat stays still, meter showing
      this._positionUI(cat.mesh.position, camera);

    } else if (cat.state === 'ally') {
      this._hideUI();
      // Follow player
      const dx = ppos.x - cat.mesh.position.x;
      const dz = ppos.z - cat.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 2.5) {
        cat.mesh.position.x += (dx / d) * 4.5 * delta;
        cat.mesh.position.z += (dz / d) * 4.5 * delta;
        cat.mesh.rotation.y = Math.atan2(dx, dz);
      }
      // Attack nearby enemies
      cat.attackCd -= delta;
      if (cat.attackCd <= 0) {
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (cat.mesh.position.distanceTo(e.mesh.position) < ALLY_ATTACK_RANGE) {
            e.takeDamage(ALLY_ATTACK_DAMAGE);
            if (e.hp <= 0) e.die(this.scene);
            cat.attackCd = ALLY_ATTACK_CD;
            break;
          }
        }
      }
      cat.mesh.position.y = Math.sin(Date.now() * 0.003) * 0.05;

    } else if (cat.state === 'hostile') {
      this._hideUI();
      // Chase and attack player
      const dx = ppos.x - cat.mesh.position.x;
      const dz = ppos.z - cat.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.05) {
        cat.mesh.position.x += (dx / d) * HOSTILE_SPEED * delta;
        cat.mesh.position.z += (dz / d) * HOSTILE_SPEED * delta;
        cat.mesh.rotation.y = Math.atan2(dx, dz);
      }
      // Attack player
      cat.attackCd -= delta;
      if (d < HOSTILE_ATTACK_RNG && cat.attackCd <= 0) {
        player.takeDamage(HOSTILE_ATTACK_DMG);
        cat.attackCd = 1.5;
      }
      // Take damage from player attacks (handled externally via takeDamage)
      if (cat.hp <= 0) {
        this.scene.remove(cat.mesh);
        this.cat = null;
        this._blocked = true;
        if (onHostileKill) onHostileKill(8);
      }
    }
  }

  // Called when player presses Enter near cat in filling state
  loveClick(playerPos) {
    if (!this.cat || this.cat.state !== 'filling') return false;
    if (_dist2D(playerPos, this.cat.mesh.position) > 4.5) return false;
    this.cat.loveClicks++;
    this._updateMeter();
    if (this.cat.loveClicks >= LOVE_CLICKS_NEEDED) {
      this.cat.state = 'ally';
      this._hideUI();
      return 'full';
    }
    return true;
  }

  // Returns true if near cat in wander/filling state (for Enter handling)
  isNearby(playerPos) {
    if (!this.cat) return false;
    if (this.cat.state !== 'wander' && this.cat.state !== 'filling') return false;
    return _dist2D(playerPos, this.cat.mesh.position) < 4.5;
  }

  // Player attacks the hostile cat
  tryPlayerAttack(playerPos) {
    if (!this.cat || this.cat.state !== 'hostile') return false;
    if (this.cat.mesh.position.distanceTo(playerPos) > 2.5) return false;
    this.cat.hp -= 10;
    // Red flash
    this.cat.mesh.traverse(c => {
      if (!c.isMesh) return;
      const orig = c.material.color.getHex();
      c.material = c.material.clone();
      c.material.color.setHex(0xff2222);
      setTimeout(() => { if (c.material) c.material.color.setHex(orig); }, 180);
    });
    return true;
  }

  _doWander(cat, delta) {
    cat.wanderTimer -= delta;
    const d = cat.mesh.position.distanceTo(cat.wanderTarget);
    if (d < 0.5 || cat.wanderTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 12;
      cat.wanderTarget.set(
        Math.max(-46, Math.min(46, cat.mesh.position.x + Math.cos(a) * r)),
        0,
        Math.max(-46, Math.min(46, cat.mesh.position.z + Math.sin(a) * r))
      );
      cat.wanderTimer = 2 + Math.random() * 4;
    }
    const dx = cat.wanderTarget.x - cat.mesh.position.x;
    const dz = cat.wanderTarget.z - cat.mesh.position.z;
    const dd = Math.sqrt(dx * dx + dz * dz);
    if (dd > 0.05) {
      cat.mesh.position.x += (dx / dd) * 2.5 * delta;
      cat.mesh.position.z += (dz / dd) * 2.5 * delta;
      cat.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  _positionUI(worldPos, camera) {
    const v = worldPos.clone();
    v.y += 2.0;
    v.project(camera);
    const x = ( v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this._uiEl.style.left = x + 'px';
    this._uiEl.style.top  = y + 'px';
    this._uiEl.style.display = 'block';
  }

  _showButtons() {
    this._buttonsEl.style.display = 'flex';
    this._meterEl.style.display = 'none';
  }

  _showMeter() {
    this._buttonsEl.style.display = 'none';
    this._meterEl.style.display = 'block';
    this._updateMeter();
  }

  _updateMeter() {
    const pct = (this.cat.loveClicks / LOVE_CLICKS_NEEDED) * 100;
    this._fillEl.style.width = pct + '%';
    const left = LOVE_CLICKS_NEEDED - this.cat.loveClicks;
    this._labelEl.textContent = left > 0 ? `💗 Press Enter × ${left} more!` : '💗 Full!';
  }

  _hideUI() { this._uiEl.style.display = 'none'; }

  _buildUI() {
    this._uiEl = document.createElement('div');
    this._uiEl.style.cssText =
      'position:fixed;display:none;transform:translate(-50%,-100%);' +
      'pointer-events:auto;z-index:450;text-align:center;';

    // Buttons row
    this._buttonsEl = document.createElement('div');
    this._buttonsEl.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-bottom:4px;';

    const loveBtn = document.createElement('button');
    loveBtn.style.cssText =
      'width:50px;height:50px;border-radius:50%;background:#ff69b4;' +
      'border:3px solid #ff1493;font-size:22px;cursor:pointer;line-height:1;';
    loveBtn.textContent = '❤️';
    loveBtn.onclick = () => {
      if (!this.cat) return;
      this.cat.state = 'filling';
      this._showMeter();
    };

    const battleBtn = document.createElement('button');
    battleBtn.style.cssText =
      'width:50px;height:50px;border-radius:50%;background:#cc0000;' +
      'border:3px solid #880000;font-size:22px;cursor:pointer;line-height:1;';
    battleBtn.textContent = '⚔️';
    battleBtn.onclick = () => {
      if (!this.cat) return;
      this.cat.state = 'hostile';
      // Turn cat red-ish to signal hostility
      this.cat.mesh.traverse(c => {
        if (c.isMesh) { c.material = c.material.clone(); c.material.color.setHex(0xff3300); }
      });
      this._hideUI();
    };

    this._buttonsEl.append(loveBtn, battleBtn);

    // Love meter
    this._meterEl = document.createElement('div');
    this._meterEl.style.cssText =
      'display:none;background:rgba(0,0,0,0.75);border-radius:8px;' +
      'padding:8px 14px;min-width:170px;border:2px solid #ff69b4;';

    this._labelEl = document.createElement('div');
    this._labelEl.style.cssText =
      'color:#ff69b4;font-family:monospace;font-size:12px;font-weight:bold;' +
      'margin-bottom:6px;text-align:center;';
    this._labelEl.textContent = '💗 Press Enter × 10!';

    const outer = document.createElement('div');
    outer.style.cssText = 'width:140px;height:14px;background:#330011;border-radius:7px;overflow:hidden;margin:0 auto;';

    this._fillEl = document.createElement('div');
    this._fillEl.style.cssText =
      'height:100%;width:0%;background:linear-gradient(90deg,#ff69b4,#ff1493);' +
      'border-radius:7px;transition:width 0.12s;';

    outer.appendChild(this._fillEl);
    this._meterEl.append(this._labelEl, outer);
    this._uiEl.append(this._buttonsEl, this._meterEl);
    document.body.appendChild(this._uiEl);
  }
}

function _dist2D(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function _buildMesh() {
  const g = new THREE.Group();
  // Tortoiseshell patches: orange, black, cream
  const orange = new THREE.MeshLambertMaterial({ color: 0xd2691e });
  const black  = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const cream  = new THREE.MeshLambertMaterial({ color: 0xfff5cc });
  const pink   = new THREE.MeshLambertMaterial({ color: 0xff88aa });
  const green  = new THREE.MeshLambertMaterial({ color: 0x66cc44 }); // green eyes

  // Body — exactly matches player body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), orange);
  body.scale.set(1.2, 0.8, 1.6);
  body.position.y = 0.7;
  g.add(body);

  // Black patch on back
  const patch1 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 5), black);
  patch1.scale.set(0.9, 0.4, 0.7);
  patch1.position.set(0.1, 0.9, -0.15);
  g.add(patch1);

  // Cream patch on belly side
  const patch2 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 5), cream);
  patch2.scale.set(0.8, 0.35, 0.6);
  patch2.position.set(-0.15, 0.5, 0.25);
  g.add(patch2);

  // Head — matches player head scale (player uses 0.36)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), orange);
  head.position.set(0, 1.22, 0.55);
  g.add(head);

  // Black head patch
  const hpatch = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), black);
  hpatch.scale.set(0.6, 0.55, 0.5);
  hpatch.position.set(0.12, 1.28, 0.6);
  g.add(hpatch);

  // Ears
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), orange);
  earL.position.set(-0.2, 1.5, 0.5);
  g.add(earL);
  const earR = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), black);
  earR.position.set(0.2, 1.5, 0.5);
  g.add(earR);

  // Eyes (green)
  for (const ex of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), green);
    eye.position.set(ex, 1.22, 0.88);
    g.add(eye);
  }

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), pink);
  nose.position.set(0, 1.15, 0.9);
  g.add(nose);

  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.025, 0.8, 5), orange);
  tail.rotation.z = 0.7;
  tail.position.set(0, 0.85, -0.75);
  g.add(tail);

  // Legs
  for (const [[lx, lz], mat] of [
    [[-0.35, 0.38], orange], [[0.35, 0.38], black],
    [[-0.32, -0.38], black], [[0.32, -0.38], orange],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.45, 5), mat);
    leg.position.set(lx, 0.22, lz);
    g.add(leg);
  }

  return g;
}
