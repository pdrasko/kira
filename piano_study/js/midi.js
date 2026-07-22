// Web MIDI input wiring — same approach as ../midi_keyboard/index.html,
// but instead of driving a keyboard widget directly, it feeds the shared
// note bus so the practice engine, recorder, and virtual keyboard all see
// the same events a physical MIDI keyboard produces.

import { emitNoteOn, emitNoteOff } from './note-bus.js';
import { logEvent } from './events.js';

let midiAccess = null;
const attachedInputs = new Set();
const listeners = new Set();

function notifyStatus() {
  const inputs = midiAccess ? Array.from(midiAccess.inputs.values()) : [];
  for (const fn of listeners) fn({ supported: !!navigator.requestMIDIAccess, inputs });
}

export function onMidiStatusChange(fn) {
  listeners.add(fn);
  notifyStatus();
  return () => listeners.delete(fn);
}

function handleMessage(deviceName, event) {
  const data = event.data;
  const command = data[0] & 0xf0;
  const number = data[1];
  const velocity = data.length > 2 ? data[2] : 0;
  if (command === 0x90 && velocity > 0) {
    emitNoteOn(number, velocity, 'midi');
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    emitNoteOff(number, 'midi');
  }
}

function attachAllInputs() {
  if (!midiAccess) return;
  midiAccess.inputs.forEach((input) => {
    if (attachedInputs.has(input)) return;
    attachedInputs.add(input);
    input.onmidimessage = (event) => handleMessage(input.name || 'Unnamed device', event);
  });
  notifyStatus();
}

export async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.onstatechange = () => {
      attachAllInputs();
      notifyStatus();
    };
    attachAllInputs();
    logEvent('midi.connected', { deviceCount: Array.from(midiAccess.inputs.values()).length });
    return { ok: true };
  } catch (err) {
    logEvent('midi.connect_failed', { message: String(err && err.message) });
    return { ok: false, reason: 'denied', error: err };
  }
}

export function isMidiSupported() {
  return !!navigator.requestMIDIAccess;
}
