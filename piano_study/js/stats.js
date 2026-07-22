// Gamification + progress math: stars, XP/levels, day streaks, the 30-
// minute daily goal, and the data prep chart components need (accuracy
// and tempo consistency over time, and a practice-minutes calendar).

import { db } from './db.js';
import { makePracticeSession } from './models.js';

export function computeStars({ accuracy, tempoConsistency }) {
  const combined = accuracy * 0.7 + tempoConsistency * 0.3;
  if (combined >= 0.92) return 3;
  if (combined >= 0.8) return 2;
  if (combined >= 0.6) return 1;
  return 0;
}

export function xpForAttempt(attempt) {
  return 10 + attempt.stars * 15;
}

export function levelForXp(xp) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordPracticeTime(profileId, ms) {
  const date = todayStr();
  const existing = (await db.sessions.find((s) => s.profileId === profileId && s.date === date))[0];
  const session = existing || makePracticeSession({ profileId, date });
  session.totalMs = (session.totalMs || 0) + ms;
  return db.sessions.save(session);
}

export async function updateStreak(profile) {
  const today = todayStr();
  if (profile.lastPracticeDate === today) return profile;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  profile.streakCount = profile.lastPracticeDate === yesterday ? (profile.streakCount || 0) + 1 : 1;
  profile.lastPracticeDate = today;
  return db.profiles.save(profile);
}

export async function awardXp(profileId, amount) {
  const profile = await db.profiles.get(profileId);
  if (!profile) return null;
  profile.xp = (profile.xp || 0) + amount;
  return db.profiles.save(profile);
}

/** Bundles the bookkeeping that happens after any finished attempt: practice time, streak, XP. */
export async function applyAttemptSideEffects(attempt) {
  const profile = await db.profiles.get(attempt.profileId);
  if (!profile) return null;
  await recordPracticeTime(profile.id, attempt.durationMs);
  await updateStreak(profile);
  return awardXp(profile.id, xpForAttempt(attempt));
}

export async function getDailyProgressMinutes(profileId) {
  const date = todayStr();
  const sessions = await db.sessions.find((s) => s.profileId === profileId && s.date === date);
  const totalMs = sessions.reduce((sum, s) => sum + s.totalMs, 0);
  return totalMs / 60000;
}

/** Last `days` calendar days (oldest first) with practice minutes, for a streak/heatmap view. */
export async function getPracticeCalendar(profileId, days = 84) {
  const sessions = await db.sessions.find((s) => s.profileId === profileId);
  const byDate = new Map(sessions.map((s) => [s.date, s.totalMs]));
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, minutes: (byDate.get(key) || 0) / 60000 });
  }
  return result;
}

export async function getAttemptHistoryForSong(songId, profileId) {
  const attempts = await db.attempts.find((a) => a.songId === songId && a.profileId === profileId);
  attempts.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  return attempts;
}

export async function getBestStarsForLesson(lessonId, profileId) {
  const attempts = await db.attempts.find((a) => a.lessonId === lessonId && a.profileId === profileId);
  return attempts.reduce((max, a) => Math.max(max, a.stars), 0);
}
