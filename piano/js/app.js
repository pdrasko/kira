import './synth.js'; // side effect: wires the WebAudio synth to every note-on/off
import { seedCatalogIfNeeded } from './seed-catalog.js';
import { getCurrentProfile, createProfile } from './app-state.js';
import { getDailyProgressMinutes } from './stats.js';
import { registerRoute, startRouter, setOnNavigate, navigate } from './router.js';
import { logEvent } from './events.js';
import { connectMidi, onMidiStatusChange } from './midi.js';
import { renderHome } from './screens/home.js';
import { renderPath } from './screens/path.js';
import { renderRepertoire } from './screens/repertoire.js';
import { renderPlayer } from './screens/player.js';
import { renderRecord } from './screens/record.js';
import { renderStats } from './screens/stats.js';
import { renderProfile } from './screens/profile.js';

let routesRegistered = false;
let navWired = false;

async function refreshHeader() {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const minutes = await getDailyProgressMinutes(profile.id);
  const pct = Math.min(100, Math.round((minutes / profile.dailyGoalMinutes) * 100));
  const ring = document.getElementById('header-goal-ring');
  ring.style.setProperty('--pct', String(pct));
  ring.title = `${minutes.toFixed(0)}/${profile.dailyGoalMinutes} min practiced today`;
  document.getElementById('header-streak').textContent = profile.streakCount ? `🔥 ${profile.streakCount}` : '';
}

function wireMidiChip() {
  const chip = document.getElementById('header-midi-chip');
  onMidiStatusChange(({ supported, inputs }) => {
    if (!supported) {
      chip.textContent = '🎹 MIDI: unsupported browser';
      chip.className = 'midi-chip unsupported';
      chip.title = 'Web MIDI needs Chrome or Edge (desktop or Android) — not available on iOS.';
      return;
    }
    if (inputs.length === 0) {
      chip.textContent = '🎹 MIDI: connect keyboard';
      chip.className = 'midi-chip disconnected';
      chip.title = 'No MIDI device detected. Click to grant permission / plug in a USB-MIDI keyboard.';
    } else {
      chip.textContent = `🎹 MIDI: ${inputs.length} connected`;
      chip.className = 'midi-chip connected';
      chip.title = inputs.map((i) => i.name).join(', ');
    }
  });
  chip.addEventListener('click', () => connectMidi());
}

function wireNav() {
  document.querySelectorAll('.app-nav button').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });
  setOnNavigate((path) => {
    document.querySelectorAll('.app-nav button').forEach((btn) => {
      btn.classList.toggle('active', path === btn.dataset.route || path.startsWith(`${btn.dataset.route}/`));
    });
    logEvent('nav', { path });
    refreshHeader();
  });
}

function registerRoutes() {
  registerRoute('/home', renderHome);
  registerRoute('/path', renderPath);
  registerRoute('/repertoire', renderRepertoire);
  registerRoute('/player/lesson/:lessonId', renderPlayer);
  registerRoute('/player/song/:songId', renderPlayer);
  registerRoute('/player/recording/:recordingId', renderPlayer);
  registerRoute('/record', renderRecord);
  registerRoute('/stats', renderStats);
  registerRoute('/profile', renderProfile);
}

function renderOnboarding() {
  const root = document.getElementById('screen-root');
  root.innerHTML = `
    <div class="panel" style="max-width:420px;margin:60px auto">
      <h2 style="margin-top:0">Welcome 👋</h2>
      <p class="muted">Let's set up your practice profile. Everything is stored locally in this browser.</p>
      <div class="field">
        <label>Your name</label>
        <input type="text" id="onboard-name" placeholder="e.g. Alex">
      </div>
      <button class="btn" id="onboard-start" type="button">Start learning</button>
    </div>
  `;
  const input = root.querySelector('#onboard-name');
  root.querySelector('#onboard-start').addEventListener('click', async () => {
    await createProfile(input.value.trim() || 'Pianist');
    boot();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') root.querySelector('#onboard-start').click();
  });
  input.focus();
}

async function boot() {
  await seedCatalogIfNeeded();
  const profile = await getCurrentProfile();
  if (!profile) {
    renderOnboarding();
    return;
  }
  if (!routesRegistered) {
    registerRoutes();
    routesRegistered = true;
  }
  if (!navWired) {
    wireNav();
    navWired = true;
  }
  await refreshHeader();
  startRouter();
}

window.addEventListener('kira:profile-updated', refreshHeader);

wireMidiChip();
connectMidi(); // try automatically so a returning visitor with permission already granted doesn't have to click anything
boot();
