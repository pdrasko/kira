export class HUD {
  constructor() {
    this.hpBar    = document.getElementById('hp-bar-inner');
    this.hpText   = document.getElementById('hp-text');
    this.scoreEl  = document.getElementById('score-display');
    this.statusEl = document.getElementById('status-msg');
    this.statusTimer = 0;
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
