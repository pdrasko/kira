// Cross-attempt mistake tracking + the hint engine. Every wrong note the
// practice engine sees gets tallied per (song, measure, expected note-set)
// so a mistake that shows up once is noise, but one that recurs becomes a
// concrete, actionable hint: "you keep missing this — loop it."

import { db } from './db.js';
import { noteNumberToName } from './note-bus.js';

const HINT_THRESHOLD = 3;

function statKey(songId, measureIndex, expected) {
  return `${songId}::${measureIndex}::${[...expected].sort((a, b) => a - b).join(',')}`;
}

export async function recordMistake({ songId, measureIndex, expected }) {
  const key = statKey(songId, measureIndex, expected);
  const existing = await db.mistakeStats.get(key);
  const stat = existing || {
    id: key,
    songId,
    measureIndex,
    expected: [...expected],
    missCount: 0,
  };
  stat.missCount += 1;
  stat.lastMissedAt = new Date().toISOString();
  await db.mistakeStats.save(stat);
  return stat;
}

export async function getMistakeStatsForSong(songId) {
  return db.mistakeStats.find((s) => s.songId === songId);
}

/**
 * Returns actionable hints for a song, worst-first: recurring wrong notes
 * at a specific measure, each paired with a ready-to-use loop region
 * (a measure of padding on either side) so the UI can offer a one-click
 * "practice this section" drill.
 */
export async function getHintsForSong(songId, measureCount) {
  const stats = (await getMistakeStatsForSong(songId)).filter((s) => s.missCount >= HINT_THRESHOLD);
  stats.sort((a, b) => b.missCount - a.missCount);
  return stats.slice(0, 3).map((stat) => {
    const noteNames = stat.expected.map(noteNumberToName).join('/');
    const startMeasure = Math.max(1, stat.measureIndex + 1 - 1); // 1-based, one measure of lead-in
    const endMeasure = measureCount ? Math.min(measureCount, stat.measureIndex + 1 + 1) : stat.measureIndex + 2;
    return {
      songId,
      measureIndex: stat.measureIndex,
      missCount: stat.missCount,
      message: `You've missed ${noteNames} at measure ${stat.measureIndex + 1} ${stat.missCount} times — try looping measures ${startMeasure}-${endMeasure} slowly.`,
      loopRegion: { startMeasure, endMeasure },
    };
  });
}
