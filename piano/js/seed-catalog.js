// Built-in practice library. Hand-authored, public-domain/original melodies
// so the app has something to teach out of the box with zero network access.
//
// Chapter 1, "Starter Studies", mirrors the topic order of PianoNanny.com's
// well-known free 8-lesson "Starter Studies" course (keyboard orientation →
// black keys/sharps → note reading → time signature → tempo → sight-reading
// → finger exercises → putting it together) — but every exercise here is an
// original transcription, not a copy of theirs: their site returned 403 to
// automated fetches, so nothing of theirs was actually available to copy,
// and short pedagogical exercises like these aren't really "their" content
// to begin with. Same idea, our own notes.
//
// This also doubles as the "sheet music provider" extension point: `SONGS`
// below is just a list of Song records with a `musicXml` string attached.
// A real open-source sheet music provider (e.g. fetching public-domain
// MusicXML/MXL files from a library such as MuseScore's open scores or
// IMSLP) would populate the exact same shape — see `js/sheetmusic.js`
// `importMusicXmlFile()` for the user-facing side of that same seam.

import { buildMusicXml } from './musicxml-builder.js';
import { makeChapter, makeLesson, makeSong } from './models.js';
import { db } from './db.js';

const CATALOG_VERSION = 2;

// ---------- Chapter 1: Starter Studies ----------

const findingC = buildMusicXml(
  { title: 'Finding C', composer: 'Starter Studies exercise', fifths: 0, beats: 4, beatType: 4 },
  [[['C2', 16]], [['C3', 16]], [['C4', 16]], [['C5', 16]]]
);

const blackKeysIntro = buildMusicXml(
  { title: 'Sharps: The Black Keys', composer: 'Starter Studies exercise', fifths: 0, beats: 4, beatType: 4 },
  [
    [['C4', 4], ['C#4', 4], ['D4', 4], ['D#4', 4]],
    [['E4', 4], ['D#4', 4], ['D4', 4], ['C#4', 4]],
    [['C4', 16]],
  ]
);

const noteReadingCdefg = buildMusicXml(
  { title: 'Reading C-D-E-F-G', composer: 'Starter Studies exercise', fifths: 0, beats: 4, beatType: 4 },
  [
    [['C4', 4], ['D4', 4], ['E4', 4], ['F4', 4]],
    [['G4', 16]],
  ]
);

const timeSignatureRhythm = buildMusicXml(
  { title: 'Whole, Half & Quarter Notes', composer: 'Starter Studies exercise', fifths: 0, beats: 4, beatType: 4 },
  [
    [['C4', 16]],
    [['C4', 8], ['C4', 8]],
    [['C4', 4], ['C4', 4], ['C4', 4], ['C4', 4]],
    [['C4', 4], ['C4', 4], ['C4', 8]],
  ]
);

const tempoPattern = buildMusicXml(
  { title: 'Steady Tempo Walk', composer: 'Starter Studies exercise', fifths: 0, beats: 4, beatType: 4 },
  [
    [['C4', 4], ['D4', 4], ['E4', 4], ['F4', 4]],
    [['G4', 4], ['F4', 4], ['E4', 4], ['D4', 4]],
    [['C4', 16]],
  ]
);

const hotCrossBuns = buildMusicXml(
  { title: 'Hot Cross Buns', composer: 'Traditional', fifths: 0, beats: 4, beatType: 4 },
  [
    [['E4', 4], ['D4', 4], ['C4', 8]],
    [['E4', 4], ['D4', 4], ['C4', 8]],
    [['C4', 4], ['C4', 4], ['C4', 4], ['C4', 4]],
    [['D4', 4], ['D4', 4], ['D4', 4], ['D4', 4]],
    [['E4', 4], ['D4', 4], ['C4', 8]],
  ]
);

const fiveFingerPattern = buildMusicXml(
  { title: 'Five-Finger Pattern', composer: 'Traditional exercise', fifths: 0, beats: 4, beatType: 4 },
  [
    [['C4', 4], ['D4', 4], ['E4', 4], ['F4', 4]],
    [['G4', 8], ['F4', 4], ['E4', 4]],
    [['D4', 4], ['C4', 4], ['D4', 4], ['E4', 4]],
    [['C4', 16]],
  ]
);

const twinkleTwinkle = buildMusicXml(
  { title: 'Twinkle Twinkle Little Star', composer: 'Traditional', fifths: 0, beats: 4, beatType: 4 },
  [
    [['C4', 4], ['C4', 4], ['G4', 4], ['G4', 4]],
    [['A4', 4], ['A4', 4], ['G4', 8]],
    [['F4', 4], ['F4', 4], ['E4', 4], ['E4', 4]],
    [['D4', 4], ['D4', 4], ['C4', 8]],
  ]
);

// ---------- Chapter 2: First Melodies ----------

const maryHadALittleLamb = buildMusicXml(
  { title: 'Mary Had a Little Lamb', composer: 'Traditional', fifths: 0, beats: 4, beatType: 4 },
  [
    [['E4', 4], ['D4', 4], ['C4', 4], ['D4', 4]],
    [['E4', 4], ['E4', 4], ['E4', 8]],
    [['D4', 4], ['D4', 4], ['D4', 8]],
    [['E4', 4], ['G4', 4], ['G4', 8]],
    [['E4', 4], ['D4', 4], ['C4', 4], ['D4', 4]],
    [['E4', 4], ['E4', 4], ['E4', 4], ['E4', 4]],
    [['D4', 4], ['D4', 4], ['E4', 4], ['D4', 4]],
    [['C4', 16]],
  ]
);

const odeToJoy = buildMusicXml(
  { title: 'Ode to Joy (theme)', composer: 'Beethoven', fifths: 0, beats: 4, beatType: 4 },
  [
    [['E4', 4], ['E4', 4], ['F4', 4], ['G4', 4]],
    [['G4', 4], ['F4', 4], ['E4', 4], ['D4', 4]],
    [['C4', 4], ['C4', 4], ['D4', 4], ['E4', 4]],
    [['E4', 6], ['D4', 2], ['D4', 8]],
    [['E4', 4], ['E4', 4], ['F4', 4], ['G4', 4]],
    [['G4', 4], ['F4', 4], ['E4', 4], ['D4', 4]],
    [['C4', 4], ['C4', 4], ['D4', 4], ['E4', 4]],
    [['D4', 6], ['C4', 2], ['C4', 8]],
  ]
);

const SONGS = [
  { key: 'findingC', song: makeSong({ title: 'Finding C', composer: 'Starter Studies exercise', musicXml: findingC, defaultTempo: 60, difficulty: 'beginner', repertoire: false }) },
  { key: 'blackKeysIntro', song: makeSong({ title: 'Sharps: The Black Keys', composer: 'Starter Studies exercise', musicXml: blackKeysIntro, defaultTempo: 60, difficulty: 'beginner', repertoire: false }) },
  { key: 'noteReadingCdefg', song: makeSong({ title: 'Reading C-D-E-F-G', composer: 'Starter Studies exercise', musicXml: noteReadingCdefg, defaultTempo: 66, difficulty: 'beginner', repertoire: false }) },
  { key: 'timeSignatureRhythm', song: makeSong({ title: 'Whole, Half & Quarter Notes', composer: 'Starter Studies exercise', musicXml: timeSignatureRhythm, defaultTempo: 66, difficulty: 'beginner', repertoire: false }) },
  { key: 'tempoPattern', song: makeSong({ title: 'Steady Tempo Walk', composer: 'Starter Studies exercise', musicXml: tempoPattern, defaultTempo: 96, difficulty: 'beginner', repertoire: false }) },
  { key: 'hotCrossBuns', song: makeSong({ title: 'Hot Cross Buns', composer: 'Traditional', musicXml: hotCrossBuns, defaultTempo: 100, difficulty: 'beginner', repertoire: true }) },
  { key: 'fiveFingerPattern', song: makeSong({ title: 'Five-Finger Pattern', composer: 'Traditional exercise', musicXml: fiveFingerPattern, defaultTempo: 66, difficulty: 'beginner', repertoire: false }) },
  { key: 'twinkleTwinkle', song: makeSong({ title: 'Twinkle Twinkle Little Star', composer: 'Traditional', musicXml: twinkleTwinkle, defaultTempo: 90, difficulty: 'beginner', repertoire: true }) },
  { key: 'maryHadALittleLamb', song: makeSong({ title: 'Mary Had a Little Lamb', composer: 'Traditional', musicXml: maryHadALittleLamb, defaultTempo: 96, difficulty: 'beginner', repertoire: true }) },
  { key: 'odeToJoy', song: makeSong({ title: 'Ode to Joy (theme)', composer: 'Beethoven', musicXml: odeToJoy, defaultTempo: 100, difficulty: 'intermediate', repertoire: true }) },
];

const STARTER_STUDIES_LESSONS = [
  { key: 'findingC', title: 'First Look at the Keyboard', description: 'Every C sits just left of a group of two black keys. Find and play C in four different octaves.', targetTempo: 60, requiredAccuracy: 0.7 },
  { key: 'blackKeysIntro', title: 'Sharps: The Black Keys', description: 'A sharp (♯) raises a note by one black key. Walk up and back down by half steps from C.', targetTempo: 60, requiredAccuracy: 0.7 },
  { key: 'noteReadingCdefg', title: 'Reading the Notes You Play', description: 'Match five notes on the staff to five keys: C, D, E, F, G.', targetTempo: 66, requiredAccuracy: 0.75 },
  { key: 'timeSignatureRhythm', title: 'Fractions & Time Signature', description: 'One pitch, four rhythms: a whole note, two halves, four quarters, and a quarter-quarter-half — feel how they all fill the same measure.', targetTempo: 66, requiredAccuracy: 0.75 },
  { key: 'tempoPattern', title: 'Learning About Tempo', description: 'Turn on the metronome and keep this up-and-down phrase locked to a steady beat.', targetTempo: 96, requiredAccuracy: 0.75 },
  { key: 'hotCrossBuns', title: 'Beginning to Sight-Read', description: 'A complete, classic 3-note tune — read it through top to bottom without stopping.', targetTempo: 100, requiredAccuracy: 0.8 },
  { key: 'fiveFingerPattern', title: 'Finger Exercising', description: 'One finger per note, C through G and back — the classic five-finger warm-up.', targetTempo: 66, requiredAccuracy: 0.8 },
  { key: 'twinkleTwinkle', title: 'Put It All Together', description: 'Keys, rhythm, tempo, and reading, all at once, in a full song.', targetTempo: 90, requiredAccuracy: 0.8 },
];

const FIRST_MELODIES_LESSONS = [
  { key: 'maryHadALittleLamb', title: 'Mary Had a Little Lamb', targetTempo: 84, requiredAccuracy: 0.8 },
  { key: 'odeToJoy', title: 'Ode to Joy', targetTempo: 90, requiredAccuracy: 0.85 },
];

/** Seeds (or re-seeds, on a version bump) chapters/lessons/built-in songs. User data — profiles, attempts, recordings, imported songs — is never touched. */
export async function seedCatalogIfNeeded() {
  const marker = await db.settings.get('catalog-seed');
  if (marker && marker.version === CATALOG_VERSION) return;

  if (marker) {
    // Upgrading from an older catalog version: drop the old built-in
    // chapters/lessons/songs before reseeding. User-created data
    // (profiles, attempts, recordings, imported songs) is untouched —
    // only `source: 'builtin'` songs and all chapters/lessons go.
    for (const chapter of await db.chapters.all()) await db.chapters.remove(chapter.id);
    for (const lesson of await db.lessons.all()) await db.lessons.remove(lesson.id);
    for (const song of await db.songs.find((s) => s.source === 'builtin')) await db.songs.remove(song.id);
  }

  const songByKey = {};
  for (const { key, song } of SONGS) {
    songByKey[key] = await db.songs.save(song);
  }

  const chapter1 = await db.chapters.save(
    makeChapter({ order: 1, title: 'Starter Studies', description: 'Keyboard orientation, black keys, note reading, rhythm, and tempo — the fundamentals, in order.' })
  );
  const chapter2 = await db.chapters.save(
    makeChapter({ order: 2, title: 'First Melodies', description: 'Full nursery-rhyme melodies to build reading and timing.' })
  );

  const chapter1LessonIds = [];
  for (const [i, l] of STARTER_STUDIES_LESSONS.entries()) {
    const lesson = await db.lessons.save(
      makeLesson({
        chapterId: chapter1.id,
        order: i + 1,
        title: l.title,
        description: l.description,
        songId: songByKey[l.key].id,
        targetTempo: l.targetTempo,
        requiredAccuracy: l.requiredAccuracy,
      })
    );
    chapter1LessonIds.push(lesson.id);
  }

  const chapter2LessonIds = [];
  for (const [i, l] of FIRST_MELODIES_LESSONS.entries()) {
    const lesson = await db.lessons.save(
      makeLesson({
        chapterId: chapter2.id,
        order: i + 1,
        title: l.title,
        songId: songByKey[l.key].id,
        targetTempo: l.targetTempo,
        requiredAccuracy: l.requiredAccuracy,
      })
    );
    chapter2LessonIds.push(lesson.id);
  }

  chapter1.lessonIds = chapter1LessonIds;
  chapter2.lessonIds = chapter2LessonIds;
  await db.chapters.save(chapter1);
  await db.chapters.save(chapter2);

  await db.settings.save({ id: 'catalog-seed', version: CATALOG_VERSION, seeded: true });
}
