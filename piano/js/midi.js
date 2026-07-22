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
    // Deliberately matches ../midi_keyboard/index.html exactly here: just
    // assign onmidimessage and let the browser handle opening the port
    // implicitly. An earlier version of this file also called input.open()
    // explicitly, on the theory that implicit opening is occasionally
    // unreliable — but that's a real behavioral difference from the proven
    // -working proof of concept, which never does that, so it's removed
    // rather than layering more speculation on unverified hardware.
    input.onmidimessage = (event) => handleMessage(input.name || 'Unnamed device', event);
  });
  notifyStatus();
}

let connectPromise = null;

/**
 * Requests MIDI access at most ONCE for the page's lifetime, no matter how
 * many times this is called. The app has several "Connect MIDI" entry
 * points (header chip, Profile, and a banner on both Player and Record) all
 * calling this — unlike the single-button midi_keyboard.html proof of
 * concept, nothing here previously stopped a second click from calling
 * navigator.requestMIDIAccess() again mid-session. Each call is allowed to
 * hand back its own MIDIAccess/MIDIInput object graph; there's no spec
 * guarantee that a later call's ports are the *same* objects a real device
 * is actively streaming to, so calling twice can leave you attached to and
 * reading the state of a port that isn't the one actually receiving data —
 * looking "connected, open" while silently never delivering a message.
 */
export function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
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
      connectPromise = null; // allow retrying after a real failure
      logEvent('midi.connect_failed', { message: String(err && err.message) });
      return { ok: false, reason: 'denied', error: err };
    }
  })();
  return connectPromise;
}

export function isMidiSupported() {
  return !!navigator.requestMIDIAccess;
}
