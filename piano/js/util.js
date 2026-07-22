export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

export function formatPercent(fraction) {
  return `${Math.round((fraction || 0) * 100)}%`;
}

export function formatMinutes(minutes) {
  return minutes >= 10 ? Math.round(minutes) : minutes.toFixed(1);
}

export function starsHtml(count, max = 3) {
  let html = '';
  for (let i = 0; i < max; i++) {
    html += `<span class="star${i < count ? '' : ' empty'}">★</span>`;
  }
  return `<span class="stars-row">${html}</span>`;
}
