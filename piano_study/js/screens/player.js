import { getCurrentProfile } from '../app-state.js';
import { getLesson, getSong } from '../catalog.js';
import { db } from '../db.js';
import { VirtualKeyboard } from '../keyboard.js';
import { SheetMusicRenderer } from '../sheetmusic.js';
import { RecordingCursor } from '../recorder.js';
import { renderPianoRoll } from '../piano-roll.js';
import { Metronome } from '../metronome.js';
import { PracticePlayer, PracticeMode } from '../practice-engine.js';
import { getHintsForSong } from '../mistakes.js';
import { ensureAudioContext } from '../synth.js';
import { noteNumberToName } from '../note-bus.js';
import { navigate } from '../router.js';
import { escapeHtml, formatPercent } from '../util.js';

export async function renderPlayer(root, params) {
  const profile = await getCurrentProfile();
  let lesson = null;
  let song = null;
  let recording = null;
  if (params.lessonId) {
    lesson = await getLesson(params.lessonId);
    song = lesson ? await getSong(lesson.songId) : null;
  } else if (params.songId) {
    song = await getSong(params.songId);
  } else if (params.recordingId) {
    recording = await db.recordings.get(params.recordingId);
  }

  if (!song && !recording) {
    root.innerHTML = `<div class="panel"><p class="muted">Not found.</p><a class="btn secondary" href="#/home">Back home</a></div>`;
    return;
  }

  const title = song ? song.title : recording.title;
  const composer = song ? song.composer : 'Your recording';
  const defaultTempo = Math.round(lesson?.targetTempo || song?.defaultTempo || recording?.tempoBpm || 80);
  const backTarget = lesson ? '/path' : recording ? '/record' : '/repertoire';
  const stepLabel = recording ? 'Step' : 'Measure';

  root.innerHTML = `
    <div class="panel row between">
      <div>
        <h2 style="margin:0">${escapeHtml(title)}</h2>
        <p class="muted" style="margin:4px 0 0">
          ${escapeHtml(composer)}
          ${lesson ? ` &middot; Target: ${lesson.targetTempo} BPM, ${formatPercent(lesson.requiredAccuracy)} accuracy` : ''}
        </p>
      </div>
      <button class="btn secondary small" id="btn-back" type="button">← Back</button>
    </div>

    <div class="panel">
      ${recording ? '<div class="keyboard-scroll" id="roll-scroll"><canvas id="piano-roll"></canvas></div>' : '<div id="sheet-music"></div>'}
    </div>

    <div class="panel">
      <div class="row between" style="margin-bottom:14px">
        <div class="mode-toggle">
          <button data-mode="wait" class="active" type="button">Wait for note</button>
          <button data-mode="performance" type="button">Performance</button>
        </div>
        <button class="btn success" id="btn-start" type="button">▶ Start</button>
      </div>
      <div class="row" style="gap:28px">
        <div class="field">
          <label>Tempo (BPM)</label>
          <div class="row">
            <input type="number" id="input-bpm" min="20" max="240" value="${defaultTempo}" style="width:68px">
            <input type="range" id="range-bpm" min="20" max="240" value="${defaultTempo}">
          </div>
        </div>
        <div class="field">
          <label>Loop ${stepLabel.toLowerCase()}s (isolate a passage)</label>
          <div class="row">
            <input type="checkbox" id="chk-loop">
            <input type="number" id="loop-start" min="1" value="1" style="width:55px">
            <span class="muted">to</span>
            <input type="number" id="loop-end" min="1" value="1" style="width:55px">
          </div>
        </div>
        <div class="field">
          <label>Metronome</label>
          <div class="row">
            <input type="checkbox" id="chk-metronome">
            <span class="muted" id="metronome-status">off</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" id="hints-panel" style="display:none">
      <h3 style="margin-top:0">Hints</h3>
      <div id="hints-list"></div>
    </div>

    <div class="panel">
      <div class="metric-row">
        <div class="metric"><div class="value" id="metric-accuracy">0%</div><div class="label">Accuracy (live)</div></div>
        <div class="metric"><div class="value" id="metric-progress">– / –</div><div class="label">${stepLabel}</div></div>
        <div class="metric"><div class="value" id="metric-stars">—</div><div class="label">Last stars</div></div>
      </div>
      <div class="mistake-log" id="mistake-log"></div>
    </div>

    <div class="panel">
      <div class="keyboard-scroll"><div id="keyboard-container"></div></div>
    </div>
  `;

  root.querySelector('#btn-back').addEventListener('click', () => navigate(backTarget));

  const keyboard = new VirtualKeyboard(root.querySelector('#keyboard-container'), { startMidi: 48, endMidi: 84 });

  let cursor;
  let sheetRenderer = null;
  if (recording) {
    cursor = new RecordingCursor(recording);
    const canvas = root.querySelector('#piano-roll');
    const rollHandle = renderPianoRoll(canvas, cursor.steps);
    cursor.onCursorMove = (i) => rollHandle.setCurrentIndex(i);
  } else {
    sheetRenderer = new SheetMusicRenderer(root.querySelector('#sheet-music'));
    await sheetRenderer.load(song.musicXml);
    cursor = sheetRenderer;
  }

  const measureCount = cursor.measureCount || 1;
  const loopStartInput = root.querySelector('#loop-start');
  const loopEndInput = root.querySelector('#loop-end');
  loopStartInput.max = String(measureCount);
  loopEndInput.max = String(measureCount);
  loopEndInput.value = String(measureCount);
  root.querySelector('#metric-progress').textContent = `0 / ${measureCount}`;

  const metronome = new Metronome({ bpm: defaultTempo, beatsPerMeasure: profile.metronome?.beatsPerMeasure || 4, sound: true });
  const chkMetronome = root.querySelector('#chk-metronome');
  const metronomeStatus = root.querySelector('#metronome-status');
  const bpmInput = root.querySelector('#input-bpm');
  const bpmRange = root.querySelector('#range-bpm');

  function bpmValue() {
    return Number(bpmInput.value) || defaultTempo;
  }

  function syncBpm(value) {
    bpmInput.value = value;
    bpmRange.value = value;
    metronome.setBpm(Number(value));
    if (player) player.setTempoBpm(Number(value));
    if (chkMetronome.checked) metronomeStatus.textContent = `${value} BPM`;
  }

  bpmInput.addEventListener('input', () => syncBpm(bpmInput.value));
  bpmRange.addEventListener('input', () => syncBpm(bpmRange.value));
  chkMetronome.addEventListener('change', () => {
    ensureAudioContext();
    if (chkMetronome.checked) {
      metronome.start();
      metronomeStatus.textContent = `${bpmValue()} BPM`;
    } else {
      metronome.stop();
      metronomeStatus.textContent = 'off';
    }
  });

  let mode = PracticeMode.WAIT;
  root.querySelectorAll('.mode-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (player && player.running) return;
      root.querySelectorAll('.mode-toggle button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
    });
  });

  const chkLoop = root.querySelector('#chk-loop');
  function currentLoopRegion() {
    if (!chkLoop.checked) return null;
    const startMeasure = Math.max(1, Number(loopStartInput.value) || 1);
    const endMeasure = Math.min(measureCount, Math.max(startMeasure, Number(loopEndInput.value) || measureCount));
    return { startMeasure, endMeasure };
  }

  let player = null;
  const startBtn = root.querySelector('#btn-start');
  const accuracyEl = root.querySelector('#metric-accuracy');
  const progressEl = root.querySelector('#metric-progress');
  const starsEl = root.querySelector('#metric-stars');
  const mistakeLogEl = root.querySelector('#mistake-log');
  let hitCount = 0;
  let attemptCount = 0;

  function resetLiveMetrics() {
    hitCount = 0;
    attemptCount = 0;
    accuracyEl.textContent = '0%';
    mistakeLogEl.innerHTML = '';
  }

  function wirePlayerEvents(p) {
    p.addEventListener('step', (e) => {
      const { expected, measureIndex } = e.detail;
      keyboard.highlightExpected(expected);
      if (measureIndex != null) progressEl.textContent = `${measureIndex + 1} / ${measureCount}`;
    });
    p.addEventListener('hit', (e) => {
      const { number, correct } = e.detail;
      keyboard.flashResult(number, correct);
      attemptCount += 1;
      if (correct) hitCount += 1;
      accuracyEl.textContent = formatPercent(attemptCount ? hitCount / attemptCount : 0);
    });
    p.addEventListener('mistake', (e) => {
      const { measureIndex, expected, played } = e.detail;
      const line = document.createElement('div');
      line.textContent = `${stepLabel} ${measureIndex + 1}: expected ${expected.map(noteNumberToName).join('/')}, played ${noteNumberToName(played)}`;
      mistakeLogEl.prepend(line);
    });
    p.addEventListener('loop', () => resetLiveMetrics());
    p.addEventListener('finished', async (e) => {
      const { attempt } = e.detail;
      keyboard.clearExpected();
      starsEl.textContent = '⭐'.repeat(attempt.stars) || 'Keep going';
      startBtn.textContent = '▶ Start';
      window.dispatchEvent(new CustomEvent('kira:profile-updated'));
      await refreshHints();
    });
    p.addEventListener('stopped', () => {
      keyboard.clearExpected();
      startBtn.textContent = '▶ Start';
    });
  }

  startBtn.addEventListener('click', () => {
    ensureAudioContext();
    if (player && player.running) {
      player.stop('manual');
      return;
    }
    resetLiveMetrics();
    player = new PracticePlayer({
      cursor,
      profileId: profile.id,
      songId: song ? song.id : null,
      lessonId: lesson ? lesson.id : null,
      mode,
      tempoBpm: bpmValue(),
      loopRegion: currentLoopRegion(),
    });
    wirePlayerEvents(player);
    player.start();
    startBtn.textContent = '⏹ Stop';
  });

  async function refreshHints() {
    const hintsPanel = root.querySelector('#hints-panel');
    const hintsList = root.querySelector('#hints-list');
    if (!song) {
      hintsPanel.style.display = 'none';
      return;
    }
    const hints = await getHintsForSong(song.id, measureCount);
    if (hints.length === 0) {
      hintsPanel.style.display = 'none';
      return;
    }
    hintsPanel.style.display = '';
    hintsList.innerHTML = hints
      .map(
        (h, i) => `
      <div class="hint-card">
        <span>${escapeHtml(h.message)}</span>
        <button class="btn small" data-idx="${i}" type="button">Practice this section</button>
      </div>`
      )
      .join('');
    hintsList.querySelectorAll('button[data-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hint = hints[Number(btn.dataset.idx)];
        chkLoop.checked = true;
        loopStartInput.value = String(hint.loopRegion.startMeasure);
        loopEndInput.value = String(hint.loopRegion.endMeasure);
        root.querySelectorAll('.mode-toggle button').forEach((b) => b.classList.remove('active'));
        root.querySelector('.mode-toggle button[data-mode="wait"]').classList.add('active');
        mode = PracticeMode.WAIT;
        startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  }
  await refreshHints();

  return () => {
    player?.stop('navigated-away');
    metronome.stop();
    keyboard.destroy();
    sheetRenderer?.destroy();
  };
}
