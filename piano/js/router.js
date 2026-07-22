// Tiny hash router. Each route handler renders into the given root element
// and may return a cleanup function (to unsubscribe listeners, stop a
// PracticePlayer, tear down a SheetMusicRenderer, ...) which is called
// right before the next navigation.

const routes = [];
let currentCleanup = null;
let onNavigate = null;

export function registerRoute(pattern, handler) {
  const paramNames = [];
  const regex = new RegExp(
    '^' +
      pattern.replace(/:[^/]+/g, (m) => {
        paramNames.push(m.slice(1));
        return '([^/]+)';
      }) +
      '$'
  );
  routes.push({ regex, paramNames, handler });
}

function matchRoute(path) {
  for (const route of routes) {
    const match = route.regex.exec(path);
    if (!match) continue;
    const params = {};
    route.paramNames.forEach((name, i) => {
      params[name] = decodeURIComponent(match[i + 1]);
    });
    return { handler: route.handler, params };
  }
  return null;
}

export function navigate(path) {
  window.location.hash = path;
}

export function setOnNavigate(fn) {
  onNavigate = fn;
}

async function render() {
  const path = window.location.hash.replace(/^#/, '') || '/home';
  const matched = matchRoute(path) || matchRoute('/home');
  if (typeof currentCleanup === 'function') {
    try {
      currentCleanup();
    } catch (err) {
      console.error('Screen cleanup failed', err);
    }
  }
  currentCleanup = null;
  const root = document.getElementById('screen-root');
  root.innerHTML = '';
  try {
    currentCleanup = await matched.handler(root, matched.params);
  } catch (err) {
    console.error('Screen render failed', err);
    root.innerHTML = `<div class="panel"><h3>Something went wrong</h3><p class="muted">${String(err && err.message)}</p></div>`;
  }
  onNavigate?.(path);
}

window.addEventListener('hashchange', render);

export function startRouter() {
  render();
}
