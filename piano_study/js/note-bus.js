// Single source of truth for "a note went down / came up", regardless of
// whether it came from a real MIDI keyboard or a click/tap on the virtual
// keyboard. The practice engine, recorder, and synth all listen to this
// instead of caring where notes come from.

export const noteBus = new EventTarget();

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteNumberToName(number) {
  return NOTE_NAMES[((number % 12) + 12) % 12] + (Math.floor(number / 12) - 1);
}

export function noteNameToNumber(name) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
  if (!m) return null;
  const [, step, accidental] = m;
  const octave = Number(m[3]);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step];
  const alter = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return base + alter + 12 * (octave + 1);
}

export function emitNoteOn(number, velocity = 100, source = 'unknown') {
  noteBus.dispatchEvent(new CustomEvent('noteon', { detail: { number, velocity, source, time: performance.now() } }));
}

export function emitNoteOff(number, source = 'unknown') {
  noteBus.dispatchEvent(new CustomEvent('noteoff', { detail: { number, source, time: performance.now() } }));
}

export function onNoteOn(handler) {
  const wrapped = (e) => handler(e.detail);
  noteBus.addEventListener('noteon', wrapped);
  return () => noteBus.removeEventListener('noteon', wrapped);
}

export function onNoteOff(handler) {
  const wrapped = (e) => handler(e.detail);
  noteBus.addEventListener('noteoff', wrapped);
  return () => noteBus.removeEventListener('noteoff', wrapped);
}
