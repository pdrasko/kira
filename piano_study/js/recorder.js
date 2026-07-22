// Recording is MIDI notes + timings, never audio: `Recorder` just listens
// to the shared note bus and writes down (pitch, velocity, startMs,
// durationMs) for every note played. `RecordingCursor` then lets a
// recording be "played back to practice later" through the exact same
// PracticePlayer used for sheet-music songs, by exposing the same cursor
// interface (see practice-engine.js) — grouping simultaneous notes into
// chord-steps and deriving each step's duration from the real gaps that
// were recorded, so looping/wait-mode/performance-mode all work on a
// freehand recording exactly like they do on a MusicXML piece.

import { onNoteOn, onNoteOff, emitNoteOn, emitNoteOff } from './note-bus.js';
import { db } from './db.js';
import { makeRecording } from './models.js';
import { logEvent } from './events.js';

export class Recorder {
  constructor() {
    this.recording = false;
    this.notes = [];
    this.openNotes = new Map();
    this._t0 = 0;
    this._unsubOn = null;
    this._unsubOff = null;
  }

  start() {
    this.recording = true;
    this.notes = [];
    this.openNotes.clear();
    this._t0 = performance.now();
    this._unsubOn = onNoteOn(({ number, velocity, source }) => {
      if (!this.recording || source === 'playback') return;
      this.openNotes.set(number, { startMs: performance.now() - this._t0, velocity });
    });
    this._unsubOff = onNoteOff(({ number, source }) => {
      if (!this.recording || source === 'playback') return;
      const open = this.openNotes.get(number);
      if (!open) return;
      this.openNotes.delete(number);
      const durationMs = Math.max(50, performance.now() - this._t0 - open.startMs);
      this.notes.push({ pitch: number, velocity: open.velocity, startMs: open.startMs, durationMs });
    });
    logEvent('recording.start', {});
  }

  /** Stops listening and returns the captured notes (also closes any still-held notes at the stop instant). */
  stop() {
    this.recording = false;
    this._unsubOn?.();
    this._unsubOff?.();
    const now = performance.now() - this._t0;
    for (const [number, open] of this.openNotes) {
      this.notes.push({ pitch: number, velocity: open.velocity, startMs: open.startMs, durationMs: Math.max(50, now - open.startMs) });
    }
    this.openNotes.clear();
    this.notes.sort((a, b) => a.startMs - b.startMs);
    logEvent('recording.stop', { noteCount: this.notes.length });
    return this.notes;
  }

  async save({ profileId, title, tempoBpm = 80 }) {
    const saved = await db.recordings.save(makeRecording({ profileId, title, tempoBpm, notes: this.notes }));
    logEvent('recording.save', { recordingId: saved.id, noteCount: this.notes.length });
    return saved;
  }
}

function groupIntoChords(notes, toleranceMs = 40) {
  const sorted = [...notes].sort((a, b) => a.startMs - b.startMs);
  const steps = [];
  for (const n of sorted) {
    const last = steps[steps.length - 1];
    if (last && n.startMs - last.startMs <= toleranceMs) {
      last.pitches.push(n.pitch);
      last.durationMs = Math.max(last.durationMs, n.durationMs);
    } else {
      steps.push({ startMs: n.startMs, durationMs: n.durationMs, pitches: [n.pitch] });
    }
  }
  return steps;
}

export class RecordingCursor {
  constructor(recording) {
    this.recording = recording;
    this.steps = groupIntoChords(recording.notes);
    this.index = 0;
    /** Optional callback(stepIndex) for a piano-roll playhead UI. */
    this.onCursorMove = null;
  }

  get measureCount() {
    return this.steps.length;
  }

  reset() {
    this.index = 0;
    this.onCursorMove?.(this.index);
  }

  atEnd() {
    return this.index >= this.steps.length;
  }

  currentMeasureIndex() {
    return this.atEnd() ? null : this.index;
  }

  next() {
    this.index += 1;
    this.onCursorMove?.(this.index);
  }

  jumpToMeasure(idx) {
    this.index = Math.max(0, Math.min(idx, this.steps.length));
    this.onCursorMove?.(this.index);
  }

  expectedNotes() {
    return this.atEnd() ? [] : this.steps[this.index].pitches;
  }

  currentDurationBeats() {
    if (this.atEnd()) return 1;
    const bpm = this.recording.tempoBpm || 80;
    const beatMs = 60000 / bpm;
    const current = this.steps[this.index];
    const nextStep = this.steps[this.index + 1];
    const gapMs = nextStep ? nextStep.startMs - current.startMs : current.durationMs;
    return Math.max(0.25, gapMs / beatMs);
  }

  scrollCursorIntoView() {
    /* no staff to scroll — the player screen renders a piano-roll for recordings instead */
  }
}

/** Plain "listen back" playback (no scoring) — just replays the notes with real audio via the synth. Returns a cancel function. */
export function playbackRecording(recording) {
  const timers = recording.notes.flatMap((n) => [
    setTimeout(() => emitNoteOn(n.pitch, n.velocity, 'playback'), n.startMs),
    setTimeout(() => emitNoteOff(n.pitch, 'playback'), n.startMs + n.durationMs),
  ]);
  return () => timers.forEach(clearTimeout);
}
