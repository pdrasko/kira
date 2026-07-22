import { getCurrentProfile } from '../app-state.js';
import { getPracticeCalendar, getAttemptHistoryForSong, levelForXp } from '../stats.js';
import { db } from '../db.js';
import { exportEventsAsFile } from '../events.js';
import { escapeHtml, formatPercent } from '../util.js';

// Chart series colors — validated for dark-surface categorical use via the
// dataviz skill's contrast/CVD checker (both PASS on #1a1a19-family surfaces;
// a lighter stock green like #22c55e fails the lightness band on dark mode).
const SERIES_ACCURACY = '#16a34a';
const SERIES_TEMPO = '#3b82f6';

export async function renderStats(root) {
  const profile = await getCurrentProfile();
  const level = levelForXp(profile.xp || 0);
  const calendar = await getPracticeCalendar(profile.id, 84);
  const songs = await db.songs.all();

  root.innerHTML = `
    <div class="panel">
      <h2 style="margin-top:0">Your Progress</h2>
      <div class="metric-row">
        <div class="metric"><div class="value">${level}</div><div class="label">Level (${profile.xp || 0} XP)</div></div>
        <div class="metric"><div class="value">🔥 ${profile.streakCount || 0}</div><div class="label">Day streak</div></div>
        <div class="metric"><div class="value">${profile.dailyGoalMinutes}</div><div class="label">Daily goal (min)</div></div>
      </div>
    </div>

    <div class="panel">
      <h3 style="margin-top:0">Practice — last 12 weeks</h3>
      <p class="muted" style="margin-top:-6px">Darker = closer to your daily goal. Hover a day for details.</p>
      <div class="calendar-grid" id="calendar"></div>
    </div>

    <div class="panel">
      <div class="row between">
        <h3 style="margin:0">Accuracy &amp; tempo over time</h3>
        <select id="song-select"></select>
      </div>
      <div class="row" style="gap:16px; margin:10px 0">
        <span class="muted"><span style="color:${SERIES_ACCURACY}">●</span> Accuracy</span>
        <span class="muted"><span style="color:${SERIES_TEMPO}">●</span> Tempo consistency</span>
      </div>
      <div class="chart-wrap" id="chart-wrap"></div>
    </div>

    <div class="panel">
      <h3 style="margin-top:0">Raw data</h3>
      <p class="muted">Every interaction — notes played, mistakes, sessions — is logged locally. Export it as JSON to analyze offline.</p>
      <button class="btn secondary" id="btn-export" type="button">Export event log</button>
    </div>
  `;

  const goalMs = (profile.dailyGoalMinutes || 30) * 60000;
  root.querySelector('#calendar').innerHTML = calendar
    .map((day) => {
      const ratio = Math.min(1, (day.minutes * 60000) / goalMs);
      const alpha = day.minutes > 0 ? 0.15 + 0.85 * ratio : 0;
      const bg = alpha > 0 ? `rgba(59,130,246,${alpha.toFixed(2)})` : 'var(--border)';
      return `<div class="calendar-cell" title="${day.date}: ${day.minutes.toFixed(1)} min" style="background:${bg}"></div>`;
    })
    .join('');

  const songSelect = root.querySelector('#song-select');
  songSelect.innerHTML = songs.map((s) => `<option value="${s.id}">${escapeHtml(s.title)}</option>`).join('');

  async function renderChart() {
    const songId = songSelect.value;
    const attempts = await getAttemptHistoryForSong(songId, profile.id);
    root.querySelector('#chart-wrap').innerHTML = buildChartSvg(attempts);
  }

  songSelect.addEventListener('change', renderChart);
  if (songs.length) await renderChart();

  root.querySelector('#btn-export').addEventListener('click', () => exportEventsAsFile());
}

function buildChartSvg(attempts) {
  if (attempts.length === 0) {
    return '<p class="muted">No attempts yet — practice this song to start tracking accuracy and tempo.</p>';
  }
  const width = Math.max(360, attempts.length * 48);
  const height = 180;
  const padding = { top: 10, right: 46, bottom: 24, left: 10 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const x = (i) => padding.left + (attempts.length === 1 ? plotW / 2 : (i / (attempts.length - 1)) * plotW);
  const y = (value) => padding.top + plotH - value * plotH;

  const accuracyPoints = attempts.map((a, i) => [x(i), y(a.accuracy)]);
  const tempoPoints = attempts.map((a, i) => [x(i), y(a.tempoConsistency)]);

  const toPath = (points) => points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((v) => `<line x1="${padding.left}" x2="${width - padding.right}" y1="${y(v)}" y2="${y(v)}" stroke="#2c3644" stroke-width="1"/>`)
    .join('');

  const circles = (points, color, values) =>
    points
      .map(
        ([px, py], i) =>
          `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="${color}"><title>Attempt ${i + 1}: ${formatPercent(values[i])}</title></circle>`
      )
      .join('');

  const lastAccuracy = accuracyPoints[accuracyPoints.length - 1];
  const lastTempo = tempoPoints[tempoPoints.length - 1];

  return `
    <svg width="${width}" height="${height}" role="img" aria-label="Accuracy and tempo consistency over attempts">
      ${gridLines}
      <path d="${toPath(accuracyPoints)}" fill="none" stroke="${SERIES_ACCURACY}" stroke-width="2"/>
      <path d="${toPath(tempoPoints)}" fill="none" stroke="${SERIES_TEMPO}" stroke-width="2"/>
      ${circles(accuracyPoints, SERIES_ACCURACY, attempts.map((a) => a.accuracy))}
      ${circles(tempoPoints, SERIES_TEMPO, attempts.map((a) => a.tempoConsistency))}
      <text x="${lastAccuracy[0] + 6}" y="${lastAccuracy[1] + 4}" fill="${SERIES_ACCURACY}" font-size="11">${formatPercent(attempts[attempts.length - 1].accuracy)}</text>
      <text x="${lastTempo[0] + 6}" y="${lastTempo[1] + 4}" fill="${SERIES_TEMPO}" font-size="11">${formatPercent(attempts[attempts.length - 1].tempoConsistency)}</text>
    </svg>
  `;
}
