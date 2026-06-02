const ITEM_LABELS = {
  cheese:       '🧀 Cheese',
  basket:       '🧺 Laundry Basket',
  yarn:         '🧶 Yarn Ball',
  tincan:       '🥫 Tin Can',
  fishbone:     '🐟 Fish Bone',
  sock:         '🧦 Old Sock',
  bottle:       '🍾 Bottle',
  string:       '🧵 String',
  bean_can:     '🫘 Bean Can',
  rotten_apple: '🍎 Rotten Apple',
};

export class Inventory {
  constructor() {
    this.items = [];
    this.visible = false;
    this.selectedIndex = -1;
    this.panel = document.getElementById('inventory-panel');
    this.list  = document.getElementById('inventory-list');
  }

  add(type) {
    this.items.push(type);
    this.refresh();
  }

  remove(type) {
    const idx = this.items.indexOf(type);
    if (idx !== -1) this.items.splice(idx, 1);
    // Keep selectedIndex in bounds
    const types = this._uniqueTypes();
    if (this.selectedIndex >= types.length) this.selectedIndex = types.length - 1;
    this.refresh();
  }

  has(type) {
    return this.items.includes(type);
  }

  _uniqueTypes() {
    const seen = new Set();
    const result = [];
    for (const t of this.items) {
      if (!seen.has(t)) { seen.add(t); result.push(t); }
    }
    return result;
  }

  getSelectedType() {
    const types = this._uniqueTypes();
    if (this.selectedIndex < 0 || this.selectedIndex >= types.length) return null;
    return types[this.selectedIndex];
  }

  navigateUp() {
    const types = this._uniqueTypes();
    if (types.length === 0) return;
    this.selectedIndex = this.selectedIndex <= 0
      ? types.length - 1
      : this.selectedIndex - 1;
    this.refresh();
  }

  navigateDown() {
    const types = this._uniqueTypes();
    if (types.length === 0) return;
    this.selectedIndex = this.selectedIndex >= types.length - 1
      ? 0
      : this.selectedIndex + 1;
    this.refresh();
  }

  show() {
    this.visible = true;
    this.panel.classList.remove('hidden');
    if (this.selectedIndex === -1 && this._uniqueTypes().length > 0) {
      this.selectedIndex = 0;
    }
    this.refresh();
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  hide() {
    this.visible = false;
    this.selectedIndex = -1;
    this.panel.classList.add('hidden');
  }

  refresh() {
    this.list.innerHTML = '';
    const types = this._uniqueTypes();
    if (types.length === 0) {
      const li = document.createElement('li');
      li.textContent = '(empty)';
      li.style.opacity = '0.5';
      this.list.appendChild(li);
      return;
    }
    const counts = {};
    for (const t of this.items) counts[t] = (counts[t] || 0) + 1;
    types.forEach((type, idx) => {
      const count = counts[type] || 1;
      const li = document.createElement('li');
      li.textContent = (ITEM_LABELS[type] || type) + (count > 1 ? ' x' + count : '');
      if (idx === this.selectedIndex) {
        li.style.cssText = 'background:rgba(255,220,0,0.25);color:#ffdc00;' +
          'border-left:3px solid #ffdc00;padding-left:6px;border-radius:3px;';
      }
      this.list.appendChild(li);
    });
  }

  getAll() {
    return [...this.items];
  }
}
