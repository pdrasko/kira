// The core playback engine, driven entirely by a "cursor" object — either
// a SheetMusicRenderer (sheetmusic.js, MusicXML-backed) or a
// RecordingCursor (recorder.js, backed by a raw MIDI recording). Both
// expose the same shape: atEnd(), currentMeasureIndex(), reset(), next(),
// jumpToMeasure(idx), expectedNotes(), currentDurationBeats(),
// scrollCursorIntoView() — so this file doesn't need to know which one
// it's got.
//
// There is no separate "start practicing" step and no scored end state:
// wherever the cursor sits is simply the next note the player is waiting
// for. A wrong note is logged as a mistake but doesn't advance anything;
// the correct note (or, for a chord, all of them) advances the cursor.
// Reaching the end of the loop region (or the whole piece, if there's no
// loop) scores that lap as an Attempt and immediately starts the next lap
// from the top — practice just keeps going, cycle after cycle, until
// something external calls stop() (navigating away, or switching to the
// separate "demo" mode below).
//
// The one other mode, "demo", is the non-interactive ▶ Preview: it
// auto-emits the expected notes on the shared note bus itself (so the
// synth sounds and the virtual keyboard lights up) while the cursor
// advances on a tempo clock, runs once, and neither scores input nor
// records an Attempt — it's just a way to hear/see the piece.
//
// Both respect an optional loop region (1-based, inclusive measure range)
// for isolating a hard passage.

import { db } from './db.js';
import { onNoteOn, emitNoteOn, emitNoteOff } from './note-bus.js';
import { logEvent } from './events.js';
import { makeAttempt } from './models.js';
import { recordMistake } from './mistakes.js';
import { computeStars, applyAttemptSideEffects } from './stats.js';

export const PracticeMode = { WAIT: 'wait', DEMO: 'demo' };

export class PracticePlayer extends EventTarget {
  constructor({ cursor, profileId, songId, lessonId = null, mode = PracticeMode.WAIT, tempoBpm = 80, loopRegion = null }) {
    super();
    this.cursor = cursor;
    this.profileId = profileId;
    this.songId = songId;
    this.lessonId = lessonId;
    this.mode = mode;
    this.tempoBpm = tempoBpm;
    this.loopRegion = loopRegion;
    this.running = false;
    this.noteResults = [];
    this._satisfied = new Set();
    this._hitTimes = new Map();
    this._currentExpected = [];
    this._perfTimer = null;
    this._demoOffTimer = null;
    this._unsubOn = null;
  }

  get loopStartIdx() {
    return this.loopRegion ? this.loopRegion.startMeasure - 1 : 0;
  }

  get loopEndIdx() {
    return this.loopRegion ? this.loopRegion.endMeasure - 1 : Infinity;
  }

  start() {
    this.running = true;
    this._unsubOn = onNoteOn(({ number }) => this._handleNoteOn(number));
    logEvent('practice.start', { songId: this.songId, lessonId: this.lessonId, mode: this.mode, loopRegion: this.loopRegion });
    this._beginLap();
  }

  /** Resets to the top of the loop (or the whole piece) and starts waiting there — used both by start() and after each lap wraps around. */
  _beginLap() {
    this.noteResults = [];
    this.startedAt = new Date().toISOString();
    this._startTs = performance.now();
    this.cursor.reset();
    if (this.loopRegion) this.cursor.jumpToMeasure(this.loopStartIdx);
    this._beginStep();
  }

  stop(reason = 'stopped') {
    if (!this.running) return;
    this.running = false;
    this._unsubOn?.();
    clearTimeout(this._perfTimer);
    clearTimeout(this._demoOffTimer);
    logEvent('practice.stop', { songId: this.songId, reason });
    this.dispatchEvent(new CustomEvent('stopped', { detail: { reason } }));
  }

  setLoopRegion(loopRegion) {
    this.loopRegion = loopRegion;
  }

  setTempoBpm(bpm) {
    this.tempoBpm = bpm;
  }

  _beginStep() {
    if (!this.running) return;
    this.cursor.scrollCursorIntoView?.();

    if (this.cursor.atEnd()) {
      this._wrapAround();
      return;
    }

    const expected = this.cursor.expectedNotes();
    this._currentExpected = expected;
    this._satisfied = new Set();
    this._hitTimes = new Map();
    this._stepStartedAt = performance.now();
    this.dispatchEvent(
      new CustomEvent('step', { detail: { expected, measureIndex: this.cursor.currentMeasureIndex() } })
    );

    const beats = this.cursor.currentDurationBeats();
    const scheduledMs = (60000 / this.tempoBpm) * beats;

    if (expected.length === 0) {
      // Rest — nothing to wait for, just let a beat (capped, so a rest never stalls practice) pass.
      this._perfTimer = setTimeout(() => this._advance(), this.mode === PracticeMode.DEMO ? scheduledMs : Math.min(scheduledMs, 400));
      return;
    }

    if (this.mode === PracticeMode.DEMO) {
      // Play it ourselves: emit the expected notes on the shared bus (the
      // synth and virtual keyboard react to this exactly like real input),
      // then advance on the tempo clock regardless of anything a listener
      // does — this is a preview, not a scored attempt.
      for (const n of expected) emitNoteOn(n, 100, 'demo');
      this._demoOffTimer = setTimeout(() => {
        for (const n of expected) emitNoteOff(n, 'demo');
      }, scheduledMs * 0.85);
      this._perfTimer = setTimeout(() => this._advance(), scheduledMs);
      return;
    }
    // No timer here: _handleNoteOn is what drives the advance.
  }

  async _handleNoteOn(number) {
    if (!this.running || this.mode === PracticeMode.DEMO || this._currentExpected.length === 0) return;
    const expected = this._currentExpected;
    const isCorrect = expected.includes(number);
    const measureIndex = this.cursor.currentMeasureIndex();

    if (isCorrect && !this._satisfied.has(number)) {
      this._satisfied.add(number);
      this._hitTimes.set(number, performance.now());
      this.dispatchEvent(new CustomEvent('hit', { detail: { number, correct: true } }));
    } else if (!isCorrect) {
      this.dispatchEvent(new CustomEvent('hit', { detail: { number, correct: false } }));
      // Awaited so a 'mistake' listener (e.g. the problem-note overlay
      // refresh) reads the tally after this miss is actually persisted,
      // not racing ahead of it.
      await recordMistake({ songId: this.songId, measureIndex, expected });
      this.dispatchEvent(new CustomEvent('mistake', { detail: { measureIndex, expected, played: number } }));
    }

    if (expected.every((n) => this._satisfied.has(n))) {
      for (const n of expected) {
        this.noteResults.push({
          measureIndex,
          expected,
          played: n,
          correct: true,
          timingErrorMs: this._hitTimes.get(n) - this._stepStartedAt,
        });
      }
      this._advance();
    }
    // Wrong notes are logged but do not advance — keep waiting for the right one.
  }

  _advance() {
    clearTimeout(this._perfTimer);
    clearTimeout(this._demoOffTimer);
    if (!this.running) return;
    this.cursor.next();
    const pastLoopEnd = this.loopRegion && (this.cursor.atEnd() || this.cursor.currentMeasureIndex() > this.loopEndIdx);
    if (pastLoopEnd || this.cursor.atEnd()) {
      this._wrapAround();
      return;
    }
    this._beginStep();
  }

  /**
   * Reaching the end of the loop region (or the whole piece, absent a
   * loop) closes out this lap. For "demo" (▶ Preview) that's just a
   * one-shot stop — nothing to score, nothing to repeat. For real practice
   * it scores the lap as an Attempt (XP/stars/mistake-overlay all key off
   * this) and then immediately starts the next lap from the top, since
   * there's no separate "stopped" state to wait in.
   */
  async _wrapAround() {
    clearTimeout(this._perfTimer);
    clearTimeout(this._demoOffTimer);

    if (this.mode === PracticeMode.DEMO) {
      this.running = false;
      this._unsubOn?.();
      logEvent('practice.demo_complete', { songId: this.songId, lessonId: this.lessonId });
      this.dispatchEvent(new CustomEvent('finished', { detail: { demo: true } }));
      return;
    }

    const durationMs = performance.now() - this._startTs;
    const totalNotes = this.noteResults.length || 1;
    const correctCount = this.noteResults.filter((r) => r.correct).length;
    const accuracy = correctCount / totalNotes;
    const timingErrors = this.noteResults.filter((r) => r.correct && r.timingErrorMs != null).map((r) => r.timingErrorMs);
    const tempoConsistency = computeTempoConsistency(timingErrors, this.tempoBpm);
    const stars = computeStars({ accuracy, tempoConsistency });

    const attempt = makeAttempt({
      profileId: this.profileId,
      songId: this.songId,
      lessonId: this.lessonId,
      mode: this.mode,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      durationMs,
      tempoBpm: this.tempoBpm,
      accuracy,
      tempoConsistency,
      noteResults: this.noteResults,
      stars,
      loopRegion: this.loopRegion,
    });
    const saved = await db.attempts.save(attempt);
    await applyAttemptSideEffects(saved);
    logEvent('practice.complete', { songId: this.songId, lessonId: this.lessonId, accuracy, stars, durationMs });
    this.dispatchEvent(new CustomEvent('lap', { detail: { attempt: saved } }));

    if (!this.running) return; // stop() may have been called while the attempt was being saved
    this._beginLap();
  }
}

function computeTempoConsistency(timingErrorsMs, bpm) {
  if (timingErrorsMs.length < 2) return 1;
  const mean = timingErrorsMs.reduce((a, b) => a + b, 0) / timingErrorsMs.length;
  const variance = timingErrorsMs.reduce((a, b) => a + (b - mean) ** 2, 0) / timingErrorsMs.length;
  const stdDevMs = Math.sqrt(variance);
  const beatMs = 60000 / bpm;
  return Math.max(0, Math.min(1, 1 - stdDevMs / beatMs));
}
