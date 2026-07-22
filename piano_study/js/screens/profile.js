import { getCurrentProfile, createProfile, listProfiles, setCurrentProfileId } from '../app-state.js';
import { db, clearAllPianoStudyData } from '../db.js';
import { onMidiStatusChange, connectMidi } from '../midi.js';
import { importMusicXmlFile } from '../sheetmusic.js';
import { makeSong } from '../models.js';
import { setSynthEnabled, isSynthEnabled } from '../synth.js';
import { escapeHtml } from '../util.js';

export async function renderProfile(root) {
  const profile = await getCurrentProfile();
  const profiles = await listProfiles();

  root.innerHTML = `
    <div class="panel">
      <h2 style="margin-top:0">Profile &amp; Settings</h2>
      <div class="field">
        <label>Active profile</label>
        <div class="row">
          <select id="profile-select">
            ${profiles.map((p) => `<option value="${p.id}" ${p.id === profile.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
          </select>
          <button class="btn secondary small" id="btn-new-profile" type="button">+ New profile</button>
        </div>
      </div>
      <div class="field">
        <label>Daily practice goal (minutes)</label>
        <input type="number" id="input-goal" min="5" max="180" value="${profile.dailyGoalMinutes}">
      </div>
      <div class="field">
        <label>Metronome — beats per measure</label>
        <input type="number" id="input-beats" min="1" max="12" value="${profile.metronome?.beatsPerMeasure || 4}">
      </div>
      <button class="btn" id="btn-save-profile" type="button">Save</button>
    </div>

    <div class="panel">
      <h3 style="margin-top:0">MIDI input</h3>
      <p class="muted" id="midi-status">Checking…</p>
      <button class="btn secondary" id="btn-connect-midi" type="button">Connect MIDI device</button>
      <div class="field" style="margin-top:12px">
        <label><input type="checkbox" id="chk-synth" ${isSynthEnabled() ? 'checked' : ''}> Play a synth sound for notes (useful for silent MIDI controllers or the on-screen keyboard)</label>
      </div>
    </div>

    <div class="panel">
      <h3 style="margin-top:0">Add sheet music</h3>
      <p class="muted">
        Import an uncompressed MusicXML file — e.g. exported from an open-source notation tool, or
        downloaded from an open sheet-music library — and it's added to your Repertoire. This is the
        same seam a live "pull from an open-source provider" integration would plug into later; it's
        file-based for now since a static, no-backend page can't reliably fetch third-party sheet
        music services directly (CORS).
      </p>
      <input type="file" id="input-file" accept=".xml,.musicxml">
      <div id="import-status" class="muted" style="margin-top:8px"></div>
    </div>

    <div class="panel">
      <h3 style="margin-top:0">Data</h3>
      <p class="muted">Everything is stored locally in this browser for now — see the README for the cloud-migration path this was designed around.</p>
      <button class="btn danger" id="btn-clear-data" type="button">Clear all local data</button>
    </div>
  `;

  root.querySelector('#profile-select').addEventListener('change', (e) => {
    setCurrentProfileId(e.target.value);
    window.location.reload();
  });

  root.querySelector('#btn-new-profile').addEventListener('click', async () => {
    const name = prompt('Name for the new profile?');
    if (!name) return;
    await createProfile(name);
    window.location.reload();
  });

  root.querySelector('#btn-save-profile').addEventListener('click', async () => {
    profile.dailyGoalMinutes = Number(root.querySelector('#input-goal').value) || 30;
    profile.metronome = { ...profile.metronome, beatsPerMeasure: Number(root.querySelector('#input-beats').value) || 4 };
    await db.profiles.save(profile);
    window.dispatchEvent(new CustomEvent('kira:profile-updated'));
    alert('Saved.');
  });

  const midiStatusEl = root.querySelector('#midi-status');
  const unsubMidi = onMidiStatusChange(({ supported, inputs }) => {
    if (!supported) {
      midiStatusEl.textContent = 'Web MIDI is not supported in this browser (works in Chrome/Edge on desktop or Android — not on iOS).';
      return;
    }
    midiStatusEl.textContent = inputs.length
      ? `${inputs.length} device(s) connected: ${inputs.map((i) => i.name).join(', ')}`
      : 'No MIDI devices connected yet. The on-screen keyboard always works as a fallback.';
  });
  root.querySelector('#btn-connect-midi').addEventListener('click', () => connectMidi());
  root.querySelector('#chk-synth').addEventListener('change', (e) => setSynthEnabled(e.target.checked));

  root.querySelector('#input-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = root.querySelector('#import-status');
    try {
      const musicXml = await importMusicXmlFile(file);
      const song = makeSong({
        title: file.name.replace(/\.(musicxml|xml)$/i, ''),
        composer: 'Imported',
        source: 'imported',
        musicXml,
        repertoire: true,
      });
      await db.songs.save(song);
      statusEl.textContent = `Imported "${song.title}" — find it in Repertoire.`;
    } catch (err) {
      statusEl.textContent = `Import failed: ${err.message}`;
    }
  });

  root.querySelector('#btn-clear-data').addEventListener('click', () => {
    if (!confirm('This deletes every profile, lesson progress, recording, and event log entry this app stored on this device. Continue?')) return;
    clearAllPianoStudyData();
    window.location.reload();
  });

  return () => unsubMidi();
}
