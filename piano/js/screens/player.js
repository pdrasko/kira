import { getCurrentProfile } from '../app-state.js';
import { getLesson, getSong } from '../catalog.js';
import { db } from '../db.js';
import { VirtualKeyboard } from '../keyboard.js';
import { SheetMusicRenderer } from '../sheetmusic.js';
import { RecordingCursor } from '../recorder.js';
import { renderPianoRoll } from '../piano-roll.js';
import { Metronome } from '../metronome.js';
import { PracticePlayer, PracticeMode } from '../practice-engine.js';
import { getProblemNoteMarkers } from '../mistakes.js';
import { toggleMeasureInLoop, wholeSongLoop } from '../loop-selection.js';
import { ensureAudioContext } from '../synth.js';
import { noteNumberToName } from '../note-bus.js';
import { navigate } from '../router.js';
import { escapeHtml, formatPercent } from '../util.js';
import { connectMidi, onMidiStatusChange } from '../midi.js';

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
        ${lesson?.description ? `<p class="muted" style="margin:6px 0 0">${escapeHtml(lesson.description)}</p>` : ''}
      </div>
      <div class="row" style="gap:8px; align-items:flex-start">
        <button class="btn secondary small overlay-toggle active" id="btn-toggle-overlay" type="button" aria-label="Toggle tricky-note highlighting" title="Highlight notes you keep missing">🎨</button>
        <div class="settings-menu-wrap">
          <button class="btn secondary small" id="btn-settings" type="button" aria-label="Practice settings" title="Mode, tempo, loop, metronome">⋮</button>
          <div class="settings-menu" id="settings-menu">
            <div class="field">
              <label>Mode</label>
              <div class="mode-toggle">
                <button data-mode="wait" class="active" type="button">Wait for note</button>
                <button data-mode="performance" type="button">Performance</button>
              </div>
            </div>
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
            <div class="field" style="margin-bottom:0">
              <label>Metronome</label>
              <div class="row">
                <input type="checkbox" id="chk-metronome">
                <span class="muted" id="metronome-status">off</span>
              </div>
            </div>
          </div>
        </div>
        <button class="btn secondary small" id="btn-back" type="button">← Back</button>
      </div>
    </div>

    <div class="panel" id="midi-banner" style="display:none">
      <div class="row between">
        <span>🎹 No MIDI keyboard connected. Practice and recording both require a real USB-MIDI keyboard/controller — the on-screen keyboard below is a display only, not an input.</span>
        <button class="btn secondary small" id="btn-connect-midi" type="button">Connect MIDI</button>
      </div>
    </div>

    <div class="panel row" style="gap:8px">
      <button class="btn secondary" id="btn-preview" type="button">▶ Preview</button>
      <button class="btn success" id="btn-start" type="button">▶ Start</button>
    </div>

    <div class="panel">
      ${recording ? '<div class="keyboard-scroll" id="roll-scroll"><canvas id="piano-roll"></canvas></div>' : '<div id="sheet-music"></div>'}
      ${recording ? '' : '<p class="muted" style="margin:6px 0 0; font-size:0.85em">Double-click a measure to loop it (double-click again to remove); double-click the clef to loop the whole piece.</p>'}
      <div class="keyboard-scroll" style="margin-top:14px"><div id="keyboard-container"></div></div>
    </div>

    <div class="panel">
      <div class="metric-row">
        <div class="metric"><div class="value" id="metric-accuracy">0%</div><div class="label">Accuracy (live)</div></div>
        <div class="metric"><div class="value" id="metric-progress">– / –</div><div class="label">${stepLabel}</div></div>
        <div class="metric"><div class="value" id="metric-stars">—</div><div class="label">Last stars</div></div>
      </div>
      <div class="mistake-log" id="mistake-log"></div>
    </div>
  `;

  root.querySelector('#btn-back').addEventListener('click', () => navigate(backTarget));

  const midiBanner = root.querySelector('#midi-banner');
  const unsubMidiStatus = onMidiStatusChange(({ inputs }) => {
    midiBanner.style.display = inputs.length === 0 ? '' : 'none';
  });
  root.querySelector('#btn-connect-midi').addEventListener('click', () => connectMidi());

  const settingsBtn = root.querySelector('#btn-settings');
  const settingsMenu = root.querySelector('#settings-menu');
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsMenu.classList.toggle('open');
  });
  const closeSettingsOnOutsideClick = (e) => {
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) settingsMenu.classList.remove('open');
  };
  document.addEventListener('click', closeSettingsOnOutsideClick);

  const overlayToggleBtn = root.querySelector('#btn-toggle-overlay');

  // C2–C6: wide enough to cover every built-in exercise, including the
  // "Finding C" Starter Study which reaches down to C2.
  const keyboard = new VirtualKeyboard(root.querySelector('#keyboard-container'), { startMidi: 36, endMidi: 84 });

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

  // Discreet on/off for the pastel "you keep missing this" overlay on the
  // sheet music itself (in place of a separate text hints panel) — same
  // toggle for Studies lessons and freely-played Repertoire songs, since
  // both share this screen. No sheet music for a freehand recording, so
  // nothing to toggle there.
  let showProblemOverlay = true;
  async function refreshProblemNoteOverlay() {
    if (!song || !sheetRenderer) return;
    if (!showProblemOverlay) {
      sheetRenderer.clearNoteColors();
      return;
    }
    const markers = await getProblemNoteMarkers(song.id);
    sheetRenderer.highlightProblemNotes(markers);
  }
  if (recording) {
    overlayToggleBtn.style.display = 'none';
  } else {
    overlayToggleBtn.addEventListener('click', () => {
      showProblemOverlay = !showProblemOverlay;
      overlayToggleBtn.classList.toggle('active', showProblemOverlay);
      refreshProblemNoteOverlay();
    });
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

  // Keeps the manual Settings loop inputs, the PracticePlayer's loop region,
  // and the in-staff purple overlay band all in sync regardless of whether
  // the region was set by typing in the Settings menu or by double-clicking
  // a measure — both are just different ways to write the same state.
  function setLoopRegion(region) {
    chkLoop.checked = !!region;
    if (region) {
      loopStartInput.value = String(region.startMeasure);
      loopEndInput.value = String(region.endMeasure);
    }
    sheetRenderer?.highlightLoopRegion(region);
  }
  function refreshLoopOverlay() {
    sheetRenderer?.highlightLoopRegion(currentLoopRegion());
  }
  chkLoop.addEventListener('change', refreshLoopOverlay);
  loopStartInput.addEventListener('input', refreshLoopOverlay);
  loopEndInput.addEventListener('input', refreshLoopOverlay);

  if (sheetRenderer) {
    root.querySelector('#sheet-music').addEventListener('dblclick', (e) => {
      if (player?.running || previewPlayer?.running) return;
      const hit = sheetRenderer.hitTest(e.clientX, e.clientY);
      if (!hit) return;
      if (hit.type === 'clef') {
        setLoopRegion(wholeSongLoop(measureCount));
        return;
      }
      const clickedMeasure = hit.measureIndex + 1; // hitTest is 0-based; loop-selection.js is 1-based
      setLoopRegion(toggleMeasureInLoop(currentLoopRegion(), measureCount, clickedMeasure));
    });
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
      previewBtn.disabled = false;
      window.dispatchEvent(new CustomEvent('kira:profile-updated'));
      await refreshProblemNoteOverlay();
    });
    p.addEventListener('stopped', async () => {
      keyboard.clearExpected();
      startBtn.textContent = '▶ Start';
      previewBtn.disabled = false;
      // Mistakes are recorded live during play, not just at completion, so
      // even an aborted attempt can leave a note newly over threshold.
      await refreshProblemNoteOverlay();
    });
  }

  const previewBtn = root.querySelector('#btn-preview');
  let previewPlayer = null;

  previewBtn.addEventListener('click', () => {
    ensureAudioContext();
    if (previewPlayer && previewPlayer.running) {
      previewPlayer.stop('manual');
      return;
    }
    if (player && player.running) return;
    previewPlayer = new PracticePlayer({
      cursor,
      profileId: profile.id,
      songId: song ? song.id : null,
      lessonId: lesson ? lesson.id : null,
      mode: PracticeMode.DEMO,
      tempoBpm: bpmValue(),
      loopRegion: currentLoopRegion(),
    });
    previewPlayer.addEventListener('step', (e) => keyboard.highlightExpected(e.detail.expected));
    const resetPreviewUi = () => {
      keyboard.clearExpected();
      previewBtn.textContent = '▶ Preview';
      startBtn.disabled = false;
    };
    previewPlayer.addEventListener('finished', resetPreviewUi);
    previewPlayer.addEventListener('stopped', resetPreviewUi);
    previewPlayer.start();
    previewBtn.textContent = '⏹ Stop';
    startBtn.disabled = true;
  });

  startBtn.addEventListener('click', () => {
    ensureAudioContext();
    if (player && player.running) {
      player.stop('manual');
      return;
    }
    if (previewPlayer && previewPlayer.running) return;
    previewBtn.disabled = true;
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

  await refreshProblemNoteOverlay();

  return () => {
    player?.stop('navigated-away');
    previewPlayer?.stop('navigated-away');
    metronome.stop();
    keyboard.destroy();
    sheetRenderer?.destroy();
    unsubMidiStatus();
    document.removeEventListener('click', closeSettingsOnOutsideClick);
  };
}
