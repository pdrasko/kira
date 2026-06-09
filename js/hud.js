export class HUD {
  constructor() {
    this.hpBar      = document.getElementById('hp-bar-inner');
    this.hpText     = document.getElementById('hp-text');
    this.hungerBar  = document.getElementById('hunger-bar-inner');
    this.hungerText = document.getElementById('hunger-text');
    this.scoreEl    = document.getElementById('score-display');
    this.statusEl   = document.getElementById('status-msg');
    this.statusTimer = 0;
    this._buildCompanionHP();
  }

  updateHunger(current, max) {
    const pct = Math.max(0, current / max) * 100;
    this.hungerBar.style.width = pct + '%';
    this.hungerText.textContent = Math.ceil(current);
    this.hungerBar.style.background = pct > 50 ? '#f4a460' : pct > 25 ? '#ffdc00' : '#ff4136';
  }

  _buildCompanionHP() {
    const container = document.createElement('div');
    container.id = 'companion-hp-container';
    container.style.cssText =
      'position:absolute;top:110px;left:14px;' +
      'background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.25);' +
      'border-radius:6px;padding:6px 10px;display:none;';

    container.innerHTML = `
      <div style="color:#ff69b4;font-size:11px;letter-spacing:2px;margin-bottom:4px;">COMPANION</div>
      <div style="width:200px;height:14px;background:#1a1a1a;border-radius:7px;overflow:hidden;">
        <div id="companion-hp-bar" style="height:100%;width:100%;background:#ff69b4;border-radius:7px;transition:width 0.25s ease,background 0.4s ease;"></div>
      </div>
      <div id="companion-hp-text" style="color:#ccc;font-size:10px;text-align:right;margin-top:2px;">30 / 30</div>`;

    document.getElementById('hud').appendChild(container);
    this._companionContainer = container;
    this._companionBar  = null;
    this._companionText = null;
  }

  updateCompanionHP(current, max) {
    if (!this._companionBar) {
      this._companionBar  = document.getElementById('companion-hp-bar');
      this._companionText = document.getElementById('companion-hp-text');
    }
    if (current === null) {
      this._companionContainer.style.display = 'none';
      return;
    }
    this._companionContainer.style.display = 'block';
    const pct = Math.max(0, current / max) * 100;
    this._companionBar.style.width = pct + '%';
    this._companionText.textContent = Math.ceil(current) + ' / ' + max;
    this._companionBar.style.background = pct > 50 ? '#ff69b4' : pct > 25 ? '#ffdc00' : '#ff4136';
  }

  updateHP(current, max) {
    const pct = Math.max(0, (current / max)) * 100;
    this.hpBar.style.width = pct + '%';
    this.hpText.textContent = Math.ceil(current) + ' / ' + max;
    if (pct > 50) this.hpBar.style.background = '#2ecc40';
    else if (pct > 25) this.hpBar.style.background = '#ffdc00';
    else this.hpBar.style.background = '#ff4136';
  }

  updateScore(score) {
    this.scoreEl.textContent = 'Score: ' + score;
  }

  showStatus(msg, duration = 2.5) {
    this.statusEl.textContent = msg;
    this.statusTimer = duration;
    this.statusEl.style.opacity = '1';
  }

  tick(delta) {
    if (this.statusTimer > 0) {
      this.statusTimer -= delta;
      if (this.statusTimer <= 0) {
        this.statusEl.style.opacity = '0';
      }
    }
  }
}
