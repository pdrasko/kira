// WebAudio metronome using the standard "lookahead scheduler" pattern
// (schedule short audio bursts slightly ahead of time via the audio
// clock, not setTimeout, so it doesn't drift) — see Chris Wilson's
// "A Tale of Two Clocks". Configurable BPM/time signature, on/off, and a
// soft sine "tick" (higher/louder accent on beat 1) rather than a harsh
// click.

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

export class Metronome {
  constructor({ bpm = 80, beatsPerMeasure = 4, sound = true } = {}) {
    this.bpm = bpm;
    this.beatsPerMeasure = beatsPerMeasure;
    this.sound = sound;
    this.running = false;
    this.currentBeat = 0;
    this.nextNoteTime = 0;
    this.timerId = null;
    this.audioCtx = null;
    /** @type {((beatIndex:number, time:number)=>void)|null} fired ~on time for each beat, useful for a visual pulse */
    this.onBeat = null;
  }

  _ctx() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return this.audioCtx;
  }

  setBpm(bpm) {
    this.bpm = Math.max(20, Math.min(240, bpm));
  }

  setBeatsPerMeasure(n) {
    this.beatsPerMeasure = Math.max(1, n);
  }

  setSound(on) {
    this.sound = on;
  }

  start() {
    if (this.running) return;
    const ctx = this._ctx();
    if (ctx.state === 'suspended') ctx.resume();
    this.running = true;
    this.currentBeat = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;
    this._scheduler();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timerId);
    this.timerId = null;
  }

  _scheduler() {
    const ctx = this._ctx();
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      this._scheduleClick(this.currentBeat, this.nextNoteTime);
      this.nextNoteTime += 60 / this.bpm;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
    }
    this.timerId = setTimeout(() => {
      if (this.running) this._scheduler();
    }, LOOKAHEAD_MS);
  }

  _scheduleClick(beatIndex, time) {
    const ctx = this._ctx();
    if (this.sound) {
      const isAccent = beatIndex === 0;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = isAccent ? 1500 : 1000;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(isAccent ? 0.35 : 0.2, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.06);
    }
    if (this.onBeat) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      setTimeout(() => this.onBeat(beatIndex, time), delayMs);
    }
  }
}
