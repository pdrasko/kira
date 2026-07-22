import { getRepertoireSongs } from '../catalog.js';
import { getCurrentProfile } from '../app-state.js';
import { getAttemptHistoryForSong } from '../stats.js';
import { navigate } from '../router.js';
import { escapeHtml, formatPercent } from '../util.js';

export async function renderRepertoire(root) {
  const profile = await getCurrentProfile();
  const songs = await getRepertoireSongs();

  const cards = [];
  for (const song of songs) {
    const attempts = await getAttemptHistoryForSong(song.id, profile.id);
    const best = attempts.reduce((max, a) => (a.accuracy > max ? a.accuracy : max), 0);
    cards.push(`
      <button class="action-card" data-song-id="${song.id}" type="button">
        <span class="icon">🎼</span>
        <h3>${escapeHtml(song.title)}</h3>
        <p>${escapeHtml(song.composer)} &middot; ${song.difficulty}</p>
        <p class="muted">${attempts.length ? `Best accuracy: ${formatPercent(best)} over ${attempts.length} attempt(s)` : 'Not played yet'}</p>
      </button>
    `);
  }

  root.innerHTML = `
    <div class="panel">
      <h2 style="margin-top:0">Repertoire</h2>
      <p class="muted">Play any song freely — no lesson gate, no locked path.</p>
    </div>
    <div class="home-cards">${cards.join('') || '<p class="muted">No songs yet.</p>'}</div>
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-top:0">Bring your own sheet music</h3>
      <p class="muted">Import a MusicXML file (e.g. exported from MuseScore's open score library or any open-source notation tool) to add it here.</p>
      <a class="btn secondary" href="#/profile">Import in Profile &amp; Settings →</a>
    </div>
  `;

  root.querySelectorAll('.action-card[data-song-id]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(`/player/song/${btn.dataset.songId}`));
  });
}
