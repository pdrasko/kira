// Minimal WebAudio synth. There is no audio recording anywhere in this
// app (recordings are MIDI note+timing data), but we still need *some*
// sound: silent MIDI controllers, the virtual on-screen keyboard, and
// played-back recordings all need something to make noise.

import { onNoteOn, onNoteOff } from './note-bus.js';

let audioCtx = null;
const active = new Map(); // midi number -> { osc, gain }
let enabled = true;

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

/** Must be called from within a user-gesture handler (click/tap) the first time — browser autoplay policy. */
export function ensureAudioContext() {
  const c = ctx();
  if (c.state === 'suspended') c.resume();
  return c;
}

export function setSynthEnabled(value) {
  enabled = value;
  if (!enabled) stopAllNotes();
}

export function isSynthEnabled() {
  return enabled;
}

function midiToFreq(number) {
  return 440 * Math.pow(2, (number - 69) / 12);
}

export function playNoteOn(number, velocity = 100) {
  if (!enabled || active.has(number)) return;
  const c = ensureAudioContext();
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(number);
  const gain = c.createGain();
  const peak = Math.min(1, velocity / 127) * 0.28;
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(peak, c.currentTime + 0.01);
  osc.connect(gain).connect(c.destination);
  osc.start();
  active.set(number, { osc, gain });
}

export function playNoteOff(number) {
  const entry = active.get(number);
  if (!entry) return;
  const c = ctx();
  const { osc, gain } = entry;
  gain.gain.cancelScheduledValues(c.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, c.currentTime);
  gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.08);
  osc.stop(c.currentTime + 0.1);
  active.delete(number);
}

export function stopAllNotes() {
  for (const number of Array.from(active.keys())) playNoteOff(number);
}

// Wired up once, at module load, so any note anywhere in the app sounds —
// callers don't need to remember to hook this up per screen.
onNoteOn(({ number, velocity }) => playNoteOn(number, velocity));
onNoteOff(({ number }) => playNoteOff(number));
