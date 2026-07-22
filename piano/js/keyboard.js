// Custom virtual piano keyboard. Renders plain <div> keys (no SVG/canvas)
// so state classes (expected/correct/wrong/held) are just CSS. Clicking or
// tapping a key feeds the shared note bus with source 'keyboard', exactly
// like a real MIDI key would — this is what lets someone practice (and
// lets us test this app) without any hardware plugged in.

import { emitNoteOn, emitNoteOff, onNoteOn, onNoteOff } from './note-bus.js';

const WHITE_WIDTH = 34;
const BLACK_WIDTH = 22;
const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

function isBlackKey(midi) {
  return BLACK_SEMITONES.has(((midi % 12) + 12) % 12);
}

export class VirtualKeyboard {
  constructor(container, { startMidi = 48, endMidi = 84 } = {}) {
    this.container = container;
    this.startMidi = startMidi;
    this.endMidi = endMidi;
    this.keyEls = new Map();
    this.pointerToMidi = new Map();
    this._flashTimers = new Map();
    this._build();
    this._unsubOn = onNoteOn(({ number, source }) => this._setHeld(number, true, source));
    this._unsubOff = onNoteOff(({ number }) => this._setHeld(number, false));
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('vk-root');
    const whiteIndexByMidi = new Map();
    let whiteIndex = 0;
    for (let m = this.startMidi; m <= this.endMidi; m++) {
      if (!isBlackKey(m)) {
        whiteIndexByMidi.set(m, whiteIndex);
        whiteIndex++;
      }
    }
    this.container.style.width = `${whiteIndex * WHITE_WIDTH}px`;

    for (let m = this.startMidi; m <= this.endMidi; m++) {
      if (isBlackKey(m)) continue;
      const idx = whiteIndexByMidi.get(m);
      const el = document.createElement('div');
      el.className = 'vk-key vk-white';
      el.style.left = `${idx * WHITE_WIDTH}px`;
      el.style.width = `${WHITE_WIDTH}px`;
      el.dataset.midi = String(m);
      if (m % 12 === 0) {
        const label = document.createElement('div');
        label.className = 'vk-label';
        label.textContent = `C${Math.floor(m / 12) - 1}`;
        el.appendChild(label);
      }
      this._wireKey(el, m);
      this.container.appendChild(el);
      this.keyEls.set(m, el);
    }

    for (let m = this.startMidi; m <= this.endMidi; m++) {
      if (!isBlackKey(m)) continue;
      const leftWhiteIdx = whiteIndexByMidi.get(m - 1);
      if (leftWhiteIdx === undefined) continue;
      const el = document.createElement('div');
      el.className = 'vk-key vk-black';
      el.style.left = `${(leftWhiteIdx + 1) * WHITE_WIDTH - BLACK_WIDTH / 2}px`;
      el.style.width = `${BLACK_WIDTH}px`;
      el.dataset.midi = String(m);
      this._wireKey(el, m);
      this.container.appendChild(el);
      this.keyEls.set(m, el);
    }
  }

  _wireKey(el, midi) {
    const press = (e) => {
      e.preventDefault();
      if (el.setPointerCapture) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      this.pointerToMidi.set(e.pointerId, midi);
      emitNoteOn(midi, 100, 'keyboard');
    };
    const release = (e) => {
      const heldMidi = this.pointerToMidi.get(e.pointerId);
      if (heldMidi == null) return;
      this.pointerToMidi.delete(e.pointerId);
      emitNoteOff(heldMidi, 'keyboard');
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }

  _setHeld(midi, held) {
    const el = this.keyEls.get(midi);
    if (!el) return;
    el.classList.toggle('held', held);
  }

  /** Outlines the notes the practice engine currently wants played, e.g. a chord under the cursor. */
  highlightExpected(midiNumbers) {
    this.clearExpected();
    for (const m of midiNumbers) {
      const el = this.keyEls.get(m);
      if (el) el.classList.add('expected');
    }
  }

  clearExpected() {
    for (const el of this.keyEls.values()) el.classList.remove('expected');
  }

  /** Brief green/red flash to confirm a hit or flag a wrong note, independent of the held/expected state. */
  flashResult(midi, correct) {
    const el = this.keyEls.get(midi);
    if (!el) return;
    const cls = correct ? 'correct' : 'wrong';
    el.classList.add(cls);
    clearTimeout(this._flashTimers.get(midi));
    const timer = setTimeout(() => el.classList.remove(cls), 350);
    this._flashTimers.set(midi, timer);
  }

  scrollToMidi(midi, opts = { inline: 'center', behavior: 'smooth' }) {
    const el = this.keyEls.get(midi);
    if (el && el.scrollIntoView) el.scrollIntoView(opts);
  }

  destroy() {
    this._unsubOn?.();
    this._unsubOff?.();
    for (const t of this._flashTimers.values()) clearTimeout(t);
  }
}
