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
    this.refresh();
  }

  has(type) {
    return this.items.includes(type);
  }

  toggle() {
    this.visible = !this.visible;
    this.panel.classList.toggle('hidden', !this.visible);
    this.refresh();
  }

  hide() {
    this.visible = false;
    this.panel.classList.add('hidden');
  }

  refresh() {
    this.list.innerHTML = '';
    if (this.items.length === 0) {
      const li = document.createElement('li');
      li.textContent = '(empty)';
      li.style.opacity = '0.5';
      this.list.appendChild(li);
      return;
    }
    const counts = {};
    for (const t of this.items) counts[t] = (counts[t] || 0) + 1;
    for (const [type, count] of Object.entries(counts)) {
      const li = document.createElement('li');
      li.textContent = (ITEM_LABELS[type] || type) + (count > 1 ? ' x' + count : '');
      this.list.appendChild(li);
    }
  }

  getAll() {
    return [...this.items];
  }
}
