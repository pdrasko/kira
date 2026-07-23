// Cross-attempt mistake tracking. Every wrong note the practice engine
// sees gets tallied per (song, measure, expected note-set) so a mistake
// that shows up once is noise, but one that recurs past PROBLEM_THRESHOLD
// is worth surfacing — as a colored overlay directly on the sheet music
// (see sheetmusic.js `highlightProblemNotes`) rather than a separate text
// panel, so it stays in the same visual context you're already reading.

import { db } from './db.js';

export const PROBLEM_THRESHOLD = 3;

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
 * Notes worth flagging on the sheet music: recurring wrong notes (or timing
 * misses) past PROBLEM_THRESHOLD, as {measureIndex, expected, missCount}
 * triples the sheet-music renderer can match against notes under its
 * cursor while it walks the piece.
 */
export async function getProblemNoteMarkers(songId) {
  const stats = (await getMistakeStatsForSong(songId)).filter((s) => s.missCount >= PROBLEM_THRESHOLD);
  return stats.map((s) => ({ measureIndex: s.measureIndex, expected: s.expected, missCount: s.missCount }));
}
