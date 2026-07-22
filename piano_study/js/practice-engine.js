// The core playback engine, driven entirely by a "cursor" object — either
// a SheetMusicRenderer (sheetmusic.js, MusicXML-backed) or a
// RecordingCursor (recorder.js, backed by a raw MIDI recording). Both
// expose the same shape: atEnd(), currentMeasureIndex(), reset(), next(),
// jumpToMeasure(idx), expectedNotes(), currentDurationBeats(),
// scrollCursorIntoView() — so this file doesn't need to know which one
// it's got.
//
// Three modes:
//  - "wait": the cursor never advances until the correct note (or, for a
//    chord, all of them) is played. Wrong notes are logged as mistakes
//    but do NOT advance the piece — this is the literal "wait for the
//    note" requirement, good for learning a piece at your own pace.
//  - "performance": time/tempo driven — the cursor advances on a
//    metronome-scaled clock regardless of what's played, and scores how
//    close each press landed to the beat. Good for playing at tempo.
//  - "demo": a non-interactive "preview" — auto-emits the expected notes
//    on the shared note bus itself (so the synth sounds and the virtual
//    keyboard lights up) while the cursor advances on a tempo clock. No
//    input is scored and no Attempt is recorded; it's just a clickable
//    way to hear/see what a piece of music sounds like before practicing it.
// All three respect an optional loop region (1-based, inclusive measure
// range) for isolating a hard passage.

import { db } from './db.js';
import { onNoteOn, emitNoteOn, emitNoteOff } from './note-bus.js';
import { logEvent } from './events.js';
import { makeAttempt } from './models.js';
import { recordMistake } from './mistakes.js';
import { computeStars, applyAttemptSideEffects } from './stats.js';

export const PracticeMode = { WAIT: 'wait', PERFORMANCE: 'performance', DEMO: 'demo' };

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
    this.noteResults = [];
    this.startedAt = new Date().toISOString();
    this._startTs = performance.now();
    this.cursor.reset();
    if (this.loopRegion) this.cursor.jumpToMeasure(this.loopStartIdx);
    this._unsubOn = onNoteOn(({ number }) => this._handleNoteOn(number));
    logEvent('practice.start', { songId: this.songId, lessonId: this.lessonId, mode: this.mode, loopRegion: this.loopRegion });
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
      this._finish();
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
      // Rest — nothing to wait for, just let a beat (capped, so wait-mode rests don't stall practice) pass.
      this._perfTimer = setTimeout(() => this._advance(), this.mode === PracticeMode.WAIT ? Math.min(scheduledMs, 400) : scheduledMs);
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

    if (this.mode === PracticeMode.PERFORMANCE) {
      this._perfTimer = setTimeout(() => this._resolvePerformanceStep(), scheduledMs);
    }
    // WAIT mode: no timer — _handleNoteOn drives the advance.
  }

  _handleNoteOn(number) {
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
      recordMistake({ songId: this.songId, measureIndex, expected });
      this.dispatchEvent(new CustomEvent('mistake', { detail: { measureIndex, expected, played: number } }));
    }

    if (this.mode === PracticeMode.WAIT && expected.every((n) => this._satisfied.has(n))) {
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
    // Wrong notes in WAIT mode are logged but do not advance — keep waiting for the right one.
  }

  _resolvePerformanceStep() {
    const expected = this._currentExpected;
    const measureIndex = this.cursor.currentMeasureIndex();
    for (const n of expected) {
      const correct = this._satisfied.has(n);
      this.noteResults.push({
        measureIndex,
        expected,
        played: correct ? n : null,
        correct,
        timingErrorMs: correct ? this._hitTimes.get(n) - this._stepStartedAt : null,
      });
      if (!correct) recordMistake({ songId: this.songId, measureIndex, expected });
    }
    this._advance();
  }

  _advance() {
    clearTimeout(this._perfTimer);
    clearTimeout(this._demoOffTimer);
    if (!this.running) return;
    this.cursor.next();
    const pastLoopEnd = this.loopRegion && (this.cursor.atEnd() || this.cursor.currentMeasureIndex() > this.loopEndIdx);
    if (pastLoopEnd) {
      this.cursor.jumpToMeasure(this.loopStartIdx);
      this.dispatchEvent(new CustomEvent('loop'));
    } else if (this.cursor.atEnd()) {
      this._finish();
      return;
    }
    this._beginStep();
  }

  async _finish() {
    this.running = false;
    this._unsubOn?.();
    clearTimeout(this._perfTimer);
    clearTimeout(this._demoOffTimer);

    if (this.mode === PracticeMode.DEMO) {
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
    this.dispatchEvent(new CustomEvent('finished', { detail: { attempt: saved } }));
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
