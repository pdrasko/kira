// Custom virtual piano keyboard. Renders plain <div> keys (no SVG/canvas)
// so state classes (expected/correct/wrong/held) are just CSS.
//
// This is a READ-ONLY display, not an input device: it reflects whatever
// comes in on the shared note bus (real MIDI input, or a demo/preview
// walking through a song) by lighting up held/expected/correct/wrong keys,
// but it never originates notes itself. Progress — practice scoring,
// recordings, everything — is expected to come from a real USB-MIDI
// keyboard/controller (see midi.js), the same way the midi_keyboard.html
// proof of concept worked. There is deliberately no click/tap-to-play here.

import { onNoteOn, onNoteOff } from './note-bus.js';

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
      this.container.appendChild(el);
      this.keyEls.set(m, el);
    }
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
