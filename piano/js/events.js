// Append-only interaction log. Every meaningful thing that happens in the
// app — navigation, a note played, a mistake, a metronome toggle, a lesson
// finishing — gets logged here. Nothing analyzes it in real time today;
// the point is that it *all* lands somewhere so it can be mined for
// progress analysis later (locally now, batch-uploaded to a backend once
// there is one — see `flush()` below for that seam).

import { uuid } from './db.js';

const EVENTS_KEY = 'kira.piano.v1.events';
const MAX_EVENTS = 5000;
const sessionId = uuid();

function readAll() {
  const raw = localStorage.getItem(EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(events) {
  const trimmed = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
  localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
}

/** @param {string} type e.g. 'lesson.start', 'note.hit', 'metronome.toggle' */
export function logEvent(type, payload = {}) {
  const events = readAll();
  const event = { id: uuid(), ts: new Date().toISOString(), sessionId, type, payload };
  events.push(event);
  writeAll(events);
  return event;
}

export function getEvents({ type, since } = {}) {
  let events = readAll();
  if (type) events = events.filter((e) => e.type === type);
  if (since) events = events.filter((e) => e.ts >= since);
  return events;
}

export function clearEvents() {
  localStorage.removeItem(EVENTS_KEY);
}

/** Downloads the full event log as JSON, e.g. to feed into an offline analysis notebook. */
export function exportEventsAsFile() {
  const events = readAll();
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kira-piano-events-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Future seam: once there's a backend, a real `flush()` would POST the
// events with `_dirty`/unsynced markers to it in batches and prune the
// local copy on success. Left as a stub so the call site already exists.
export async function flush(_uploader) {
  return { uploaded: 0, pending: readAll().length };
}
