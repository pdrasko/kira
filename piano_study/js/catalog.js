// Read-side helpers over chapters/lessons: ordering, simple linear
// unlock rule (a lesson unlocks once the previous one has any passing —
// i.e. 1+ star — attempt), and "what's next" for the home screen's
// "Continue Lesson Plan" card.

import { db } from './db.js';
import { getBestStarsForLesson } from './stats.js';

export async function getOrderedChapters() {
  const chapters = await db.chapters.all();
  chapters.sort((a, b) => a.order - b.order);
  const withLessons = [];
  for (const chapter of chapters) {
    const lessons = await db.lessons.find((l) => l.chapterId === chapter.id);
    lessons.sort((a, b) => a.order - b.order);
    withLessons.push({ ...chapter, lessons });
  }
  return withLessons;
}

export async function getLessonProgress(profileId) {
  const chapters = await getOrderedChapters();
  const flatLessons = chapters.flatMap((c) => c.lessons);
  const stars = new Map();
  for (const lesson of flatLessons) {
    stars.set(lesson.id, await getBestStarsForLesson(lesson.id, profileId));
  }
  const unlocked = new Map();
  flatLessons.forEach((lesson, i) => {
    if (i === 0) {
      unlocked.set(lesson.id, true);
      return;
    }
    const prev = flatLessons[i - 1];
    unlocked.set(lesson.id, (stars.get(prev.id) || 0) > 0);
  });
  return { chapters, stars, unlocked, flatLessons };
}

export async function findNextLesson(profileId) {
  const { flatLessons, stars, unlocked } = await getLessonProgress(profileId);
  for (const lesson of flatLessons) {
    if ((stars.get(lesson.id) || 0) === 0 && unlocked.get(lesson.id)) return lesson;
  }
  return flatLessons[flatLessons.length - 1] || null;
}

export async function getLesson(lessonId) {
  return db.lessons.get(lessonId);
}

export async function getSong(songId) {
  return db.songs.get(songId);
}

export async function getRepertoireSongs() {
  return db.songs.find((s) => s.repertoire);
}
