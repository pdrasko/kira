// Web MIDI input wiring — same approach as ../midi_keyboard/index.html,
// but instead of driving a keyboard widget directly, it feeds the shared
// note bus so the practice engine, recorder, and virtual keyboard all see
// the same events a physical MIDI keyboard produces.

import { emitNoteOn, emitNoteOff } from './note-bus.js';
import { logEvent } from './events.js';

let midiAccess = null;
const attachedInputs = new Set();
const listeners = new Set();
const rawListeners = new Set();

function notifyStatus() {
  const inputs = midiAccess ? Array.from(midiAccess.inputs.values()) : [];
  for (const fn of listeners) fn({ supported: !!navigator.requestMIDIAccess, inputs });
}

export function onMidiStatusChange(fn) {
  listeners.add(fn);
  notifyStatus();
  return () => listeners.delete(fn);
}

/**
 * Every raw message a MIDI input delivers, completely unfiltered — including
 * ones handleMessage() doesn't recognize as note on/off (clock, active
 * sensing, control change, sysex, ...). This exists purely for diagnosing
 * "the device shows connected but nothing happens": if this never fires
 * either, no bytes are reaching the browser at all (almost always a cabling
 * issue — e.g. a 5-pin DIN cable into a USB-MIDI adapter's OUT jack instead
 * of IN, or the instrument's MIDI OUT not actually enabled) rather than
 * anything this app's code could fix. If it fires with bytes that aren't a
 * recognized note on/off, that points to a parsing gap instead.
 */
export function onRawMidiMessage(fn) {
  rawListeners.add(fn);
  return () => rawListeners.delete(fn);
}

function handleMessage(deviceName, event) {
  const data = event.data;
  for (const fn of rawListeners) fn({ deviceName, data });
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
    // Setting onmidimessage is *supposed* to implicitly open the port, but
    // that's unreliable on some Android/Chrome + USB-MIDI-adapter
    // combinations — the port can sit at connection:"closed" or "pending"
    // forever, showing up in the device list (so it looks "connected")
    // while never actually delivering a message. Opening explicitly is
    // harmless when the implicit path already worked, and is the fix when
    // it didn't.
    if (typeof input.open === 'function') {
      input.open().then(
        () => notifyStatus(),
        (err) => logEvent('midi.open_failed', { device: input.name, message: String(err && err.message) })
      );
    }
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
