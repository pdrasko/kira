import { getCurrentProfile } from '../app-state.js';
import { Recorder, playbackRecording } from '../recorder.js';
import { VirtualKeyboard } from '../keyboard.js';
import { db } from '../db.js';
import { ensureAudioContext } from '../synth.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../util.js';

export async function renderRecord(root) {
  const profile = await getCurrentProfile();
  const recorder = new Recorder();
  let cancelPlayback = null;

  root.innerHTML = `
    <div class="panel">
      <h2 style="margin-top:0">Record a Song</h2>
      <p class="muted">Captures MIDI notes and timing only — no audio — so you can come back and practice it later just like any other song in your library.</p>
      <div class="row" style="margin:14px 0">
        <span id="rec-indicator" style="display:none" class="record-dot"></span>
        <button class="btn danger" id="btn-record" type="button">⏺ Start Recording</button>
        <span class="muted" id="rec-status">Not recording</span>
      </div>
      <div id="save-row" style="display:none" class="row">
        <input type="text" id="rec-title" placeholder="Name this recording…">
        <button class="btn success" id="btn-save" type="button">Save</button>
        <button class="btn secondary" id="btn-discard" type="button">Discard</button>
      </div>
    </div>
    <div class="panel">
      <div class="keyboard-scroll"><div id="keyboard-container"></div></div>
    </div>
    <div class="panel">
      <h3 style="margin-top:0">Your recordings</h3>
      <div id="recording-list"></div>
    </div>
  `;

  const keyboard = new VirtualKeyboard(root.querySelector('#keyboard-container'), { startMidi: 36, endMidi: 84 });

  async function renderList() {
    const recordings = await db.recordings.find((r) => r.profileId === profile.id);
    recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const listEl = root.querySelector('#recording-list');
    listEl.innerHTML = recordings.length
      ? recordings
          .map(
            (r) => `
      <div class="recording-list-item">
        <div>
          <strong>${escapeHtml(r.title)}</strong>
          <div class="muted" style="font-size:12px">${r.notes.length} notes &middot; ${new Date(r.createdAt).toLocaleString()}</div>
        </div>
        <div class="row">
          <button class="btn secondary small" data-action="listen" data-id="${r.id}" type="button">▶ Listen</button>
          <button class="btn small" data-action="practice" data-id="${r.id}" type="button">Practice</button>
          <button class="btn danger small" data-action="delete" data-id="${r.id}" type="button">Delete</button>
        </div>
      </div>`
          )
          .join('')
      : '<p class="muted">No recordings yet.</p>';

    listEl.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'practice') {
          navigate(`/player/recording/${id}`);
          return;
        }
        if (btn.dataset.action === 'delete') {
          if (!confirm('Delete this recording? This cannot be undone.')) return;
          await db.recordings.remove(id);
          await renderList();
          return;
        }
        if (btn.dataset.action === 'listen') {
          ensureAudioContext();
          cancelPlayback?.();
          const rec = recordings.find((x) => x.id === id);
          if (rec) cancelPlayback = playbackRecording(rec);
        }
      });
    });
  }

  const recordBtn = root.querySelector('#btn-record');
  const recIndicator = root.querySelector('#rec-indicator');
  const recStatus = root.querySelector('#rec-status');
  const saveRow = root.querySelector('#save-row');
  const titleInput = root.querySelector('#rec-title');

  recordBtn.addEventListener('click', () => {
    ensureAudioContext();
    if (!recorder.recording) {
      recorder.start();
      recordBtn.textContent = '⏹ Stop Recording';
      recIndicator.style.display = 'inline-block';
      recStatus.textContent = 'Recording…';
      saveRow.style.display = 'none';
    } else {
      recorder.stop();
      recordBtn.textContent = '⏺ Start Recording';
      recIndicator.style.display = 'none';
      recStatus.textContent = `Captured ${recorder.notes.length} notes`;
      saveRow.style.display = recorder.notes.length ? 'flex' : 'none';
      titleInput.value = `Recording ${new Date().toLocaleString()}`;
    }
  });

  root.querySelector('#btn-save').addEventListener('click', async () => {
    await recorder.save({ profileId: profile.id, title: titleInput.value || 'Untitled recording', tempoBpm: 80 });
    saveRow.style.display = 'none';
    recStatus.textContent = 'Saved!';
    await renderList();
  });
  root.querySelector('#btn-discard').addEventListener('click', () => {
    recorder.notes = [];
    saveRow.style.display = 'none';
    recStatus.textContent = 'Discarded';
  });

  await renderList();

  return () => {
    if (recorder.recording) recorder.stop();
    cancelPlayback?.();
    keyboard.destroy();
  };
}
