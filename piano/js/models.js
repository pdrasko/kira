// Plain factory functions describing the shape of every entity. These are
// the closest thing this app has to a schema — keeping them in one place
// makes it easy to see what a future cloud database's tables would look
// like (each factory ~= one table).

/** @typedef {{id:string, name:string, createdAt:string, dailyGoalMinutes:number, xp:number, streakCount:number, lastPracticeDate:string|null, metronome:{bpm:number,beatsPerMeasure:number,sound:boolean}}} Profile */
export function makeProfile({ name }) {
  return {
    name,
    dailyGoalMinutes: 30,
    xp: 0,
    streakCount: 0,
    lastPracticeDate: null,
    metronome: { bpm: 80, beatsPerMeasure: 4, sound: true },
  };
}

/** @typedef {{id:string, order:number, title:string, description:string, lessonIds:string[]}} Chapter */
export function makeChapter({ order, title, description, lessonIds = [] }) {
  return { order, title, description, lessonIds };
}

/** @typedef {{id:string, chapterId:string, order:number, title:string, description:string, songId:string, targetTempo:number, requiredAccuracy:number}} Lesson */
export function makeLesson({ chapterId, order, title, description = '', songId, targetTempo = 80, requiredAccuracy = 0.8 }) {
  return { chapterId, order, title, description, songId, targetTempo, requiredAccuracy };
}

/**
 * @typedef {{id:string, title:string, composer:string, source:'builtin'|'imported'|'recording',
 *   musicXml:string|null, notes:Array|null, defaultTempo:number, difficulty:'beginner'|'intermediate'|'advanced',
 *   repertoire:boolean}} Song
 */
export function makeSong({
  title,
  composer = 'Traditional',
  source = 'builtin',
  musicXml = null,
  notes = null,
  defaultTempo = 80,
  difficulty = 'beginner',
  repertoire = true,
}) {
  return { title, composer, source, musicXml, notes, defaultTempo, difficulty, repertoire };
}

/** @typedef {{id:string, profileId:string, songId:string, targetAccuracy:number, targetTempo:number, targetDate:string|null, notes:string}} Goal */
export function makeGoal({ profileId, songId, targetAccuracy = 0.9, targetTempo = null, targetDate = null, notes = '' }) {
  return { profileId, songId, targetAccuracy, targetTempo, targetDate, notes };
}

/**
 * @typedef {{id:string, profileId:string, songId:string, lessonId:string|null, mode:'wait'|'performance',
 *   startedAt:string, endedAt:string, durationMs:number, tempoBpm:number, accuracy:number, tempoConsistency:number,
 *   noteResults:Array<{measure:number, noteIndex:number, expected:string[], played:string|null, correct:boolean, timingErrorMs:number|null}>,
 *   stars:number, loopRegion:{startMeasure:number,endMeasure:number}|null}} Attempt
 */
export function makeAttempt(fields) {
  return {
    profileId: null,
    songId: null,
    lessonId: null,
    mode: 'wait',
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationMs: 0,
    tempoBpm: 80,
    accuracy: 0,
    tempoConsistency: 0,
    noteResults: [],
    stars: 0,
    loopRegion: null,
    ...fields,
  };
}

/** @typedef {{id:string, profileId:string, title:string, createdAt:string, tempoBpm:number, notes:Array<{pitch:number,velocity:number,startMs:number,durationMs:number}>}} Recording */
export function makeRecording({ profileId, title, tempoBpm = 80, notes = [] }) {
  return { profileId, title, tempoBpm, notes };
}

/** @typedef {{id:string, songId:string, measure:number, noteIndex:number, expected:string, missCount:number, lastMissedAt:string}} MistakeStat */
export function makeMistakeStat({ songId, measure, noteIndex, expected }) {
  return { songId, measure, noteIndex, expected, missCount: 0, lastMissedAt: null };
}

/** @typedef {{id:string, profileId:string, date:string, totalMs:number}} PracticeSession — one row per calendar day per profile. */
export function makePracticeSession({ profileId, date }) {
  return { profileId, date, totalMs: 0 };
}
