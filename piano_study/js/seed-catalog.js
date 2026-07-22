// Built-in practice library. Hand-authored, public-domain melodies so the
// app has something to teach out of the box with zero network access.
//
// This doubles as the "sheet music provider" extension point: `SONGS`
// below is just a list of Song records with a `musicXml` string attached.
// A real open-source sheet music provider (e.g. fetching public-domain
// MusicXML/MXL files from a library such as MuseScore's open scores or
// IMSLP) would populate the exact same shape — see `js/sheetmusic.js`
// `importMusicXmlFile()` for the user-facing side of that same seam.

import { buildMusicXml } from './musicxml-builder.js';
import { makeChapter, makeLesson, makeSong } from './models.js';
import { db } from './db.js';

const cMajorScale = buildMusicXml(
  { title: 'C Major Scale', composer: 'Traditional exercise', fifths: 0, beats: 4, beatType: 4 },
  [
    [['C4', 4], ['D4', 4], ['E4', 4], ['F4', 4]],
    [['G4', 4], ['A4', 4], ['B4', 4], ['C5', 4]],
    [['C5', 4], ['B4', 4], ['A4', 4], ['G4', 4]],
    [['F4', 4], ['E4', 4], ['D4', 4], ['C4', 4]],
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
  { key: 'cMajorScale', song: makeSong({ title: 'C Major Scale', composer: 'Traditional exercise', musicXml: cMajorScale, defaultTempo: 66, difficulty: 'beginner', repertoire: false }) },
  { key: 'fiveFingerPattern', song: makeSong({ title: 'Five-Finger Pattern', composer: 'Traditional exercise', musicXml: fiveFingerPattern, defaultTempo: 66, difficulty: 'beginner', repertoire: false }) },
  { key: 'twinkleTwinkle', song: makeSong({ title: 'Twinkle Twinkle Little Star', composer: 'Traditional', musicXml: twinkleTwinkle, defaultTempo: 90, difficulty: 'beginner', repertoire: true }) },
  { key: 'maryHadALittleLamb', song: makeSong({ title: 'Mary Had a Little Lamb', composer: 'Traditional', musicXml: maryHadALittleLamb, defaultTempo: 96, difficulty: 'beginner', repertoire: true }) },
  { key: 'odeToJoy', song: makeSong({ title: 'Ode to Joy (theme)', composer: 'Beethoven', musicXml: odeToJoy, defaultTempo: 100, difficulty: 'intermediate', repertoire: true }) },
];

/** Populates chapters/lessons/songs on first run only; a `settings` flag marks it done so re-visits don't duplicate rows or clobber user edits. */
export async function seedCatalogIfNeeded() {
  const marker = await db.settings.get('catalog-seed');
  if (marker && marker.seeded) return;

  const songByKey = {};
  for (const { key, song } of SONGS) {
    songByKey[key] = await db.songs.save(song);
  }

  const chapter1 = await db.chapters.save(
    makeChapter({ order: 1, title: 'Foundations', description: 'Find your way around the keyboard and play your first phrases.' })
  );
  const chapter2 = await db.chapters.save(
    makeChapter({ order: 2, title: 'First Melodies', description: 'Full nursery-rhyme melodies to build reading and timing.' })
  );

  const lesson1 = await db.lessons.save(
    makeLesson({ chapterId: chapter1.id, order: 1, title: 'C Major Scale', songId: songByKey.cMajorScale.id, targetTempo: 66, requiredAccuracy: 0.75 })
  );
  const lesson2 = await db.lessons.save(
    makeLesson({ chapterId: chapter1.id, order: 2, title: 'Five-Finger Pattern', songId: songByKey.fiveFingerPattern.id, targetTempo: 66, requiredAccuracy: 0.75 })
  );
  const lesson3 = await db.lessons.save(
    makeLesson({ chapterId: chapter1.id, order: 3, title: 'Twinkle Twinkle Little Star', songId: songByKey.twinkleTwinkle.id, targetTempo: 80, requiredAccuracy: 0.8 })
  );
  const lesson4 = await db.lessons.save(
    makeLesson({ chapterId: chapter2.id, order: 1, title: 'Mary Had a Little Lamb', songId: songByKey.maryHadALittleLamb.id, targetTempo: 84, requiredAccuracy: 0.8 })
  );
  const lesson5 = await db.lessons.save(
    makeLesson({ chapterId: chapter2.id, order: 2, title: 'Ode to Joy', songId: songByKey.odeToJoy.id, targetTempo: 90, requiredAccuracy: 0.85 })
  );

  chapter1.lessonIds = [lesson1.id, lesson2.id, lesson3.id];
  chapter2.lessonIds = [lesson4.id, lesson5.id];
  await db.chapters.save(chapter1);
  await db.chapters.save(chapter2);

  await db.settings.save({ id: 'catalog-seed', seeded: true });
}
