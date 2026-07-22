import { getCurrentProfile } from '../app-state.js';
import { getDailyProgressMinutes, levelForXp } from '../stats.js';
import { findNextLesson } from '../catalog.js';
import { navigate } from '../router.js';
import { db } from '../db.js';
import { escapeHtml } from '../util.js';

export async function renderHome(root) {
  const profile = await getCurrentProfile();
  const minutes = await getDailyProgressMinutes(profile.id);
  const nextLesson = await findNextLesson(profile.id);
  const recordingCount = (await db.recordings.find((r) => r.profileId === profile.id)).length;
  const level = levelForXp(profile.xp || 0);

  root.innerHTML = `
    <div class="panel row between">
      <div>
        <h2 style="margin:0">Welcome back, ${escapeHtml(profile.name)}</h2>
        <p class="muted" style="margin:6px 0 0">
          Today: ${minutes.toFixed(minutes < 10 ? 1 : 0)} / ${profile.dailyGoalMinutes} min practiced &middot;
          🔥 ${profile.streakCount || 0} day streak &middot; Level ${level} (${profile.xp || 0} XP)
        </p>
      </div>
    </div>
    <div class="home-cards">
      <button class="action-card" id="card-continue" type="button">
        <span class="icon">🎯</span>
        <h3>Continue Lesson Plan</h3>
        <p>${nextLesson ? `Next up: ${escapeHtml(nextLesson.title)}` : 'No lessons in your catalog yet'}</p>
      </button>
      <button class="action-card" id="card-repertoire" type="button">
        <span class="icon">🎵</span>
        <h3>Play from Repertoire</h3>
        <p>Pick any song and play it freely</p>
      </button>
      <button class="action-card" id="card-record" type="button">
        <span class="icon">⏺</span>
        <h3>Record a Song</h3>
        <p>Capture notes &amp; timing to practice later${recordingCount ? ` &middot; ${recordingCount} saved` : ''}</p>
      </button>
    </div>
  `;

  root.querySelector('#card-continue').addEventListener('click', () => {
    navigate(nextLesson ? `/player/lesson/${nextLesson.id}` : '/path');
  });
  root.querySelector('#card-repertoire').addEventListener('click', () => navigate('/repertoire'));
  root.querySelector('#card-record').addEventListener('click', () => navigate('/record'));
}
