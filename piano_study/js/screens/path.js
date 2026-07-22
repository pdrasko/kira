import { getCurrentProfile } from '../app-state.js';
import { getLessonProgress } from '../catalog.js';
import { navigate } from '../router.js';
import { escapeHtml, starsHtml } from '../util.js';

export async function renderPath(root) {
  const profile = await getCurrentProfile();
  const { chapters, stars, unlocked } = await getLessonProgress(profile.id);

  if (chapters.length === 0) {
    root.innerHTML = `<div class="panel"><h2>Path</h2><p class="muted">Your catalog is empty.</p></div>`;
    return;
  }

  root.innerHTML = chapters
    .map(
      (chapter) => `
    <div class="chapter-block">
      <div class="chapter-title">Chapter ${chapter.order}: ${escapeHtml(chapter.title)}</div>
      <div class="chapter-desc">${escapeHtml(chapter.description || '')}</div>
      <div class="path-track">
        ${chapter.lessons
          .map((lesson, i) => {
            const isLocked = !unlocked.get(lesson.id);
            const starCount = stars.get(lesson.id) || 0;
            const align = i % 2 === 0 ? 'align-left' : 'align-right';
            const stateClass = isLocked ? 'locked' : starCount > 0 ? '' : 'in-progress';
            return `
          <div class="path-node-wrap ${align}">
            <button class="path-node ${stateClass}" data-lesson-id="${lesson.id}" ${isLocked ? 'disabled' : ''} type="button" title="${escapeHtml(lesson.description || '')}">
              ${isLocked ? '🔒' : starCount > 0 ? '✓' : '▶'}
            </button>
            <div class="path-label">${escapeHtml(lesson.title)}</div>
            ${lesson.description ? `<div class="muted" style="font-size:11px;max-width:160px;text-align:center">${escapeHtml(lesson.description)}</div>` : ''}
            ${starsHtml(starCount)}
          </div>`;
          })
          .join('')}
      </div>
    </div>
  `
    )
    .join('');

  root.querySelectorAll('.path-node:not(.locked)').forEach((btn) => {
    btn.addEventListener('click', () => navigate(`/player/lesson/${btn.dataset.lessonId}`));
  });
}
