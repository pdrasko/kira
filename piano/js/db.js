// Storage layer for the piano study guide.
//
// Everything lives in localStorage today, but the shape of the data is
// designed so a later move to a real backend doesn't touch business logic:
//   - every record gets a stable `id` (uuid), `createdAt`/`updatedAt`, a
//     monotonic `_rev` counter, and a `_dirty` flag.
//   - all reads/writes go through the `StorageAdapter` interface below.
//     Swapping `LocalStorageAdapter` for e.g. a `RestApiAdapter` or a
//     Supabase/Firebase adapter that implements the same three methods
//     (getAll/put/delete) is the entire migration — `Repository` and every
//     caller stay the same.
//   - `_rev` + `updatedAt` are there so a future sync layer can do
//     last-write-wins or detect conflicts; `_dirty` is the seam where an
//     outbox/sync-queue would hook in (flip false once the cloud ack's it).

const NAMESPACE = 'kira.piano.v1';

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class StorageAdapter {
  async getAll(_collection) { throw new Error('StorageAdapter.getAll not implemented'); }
  async put(_collection, _record) { throw new Error('StorageAdapter.put not implemented'); }
  async delete(_collection, _id) { throw new Error('StorageAdapter.delete not implemented'); }
  async clear(_collection) { throw new Error('StorageAdapter.clear not implemented'); }
}

// Reference implementation for a future cloud adapter — same contract,
// different transport. Left unimplemented on purpose; wiring it up is the
// whole migration, described above.
// export class RestApiAdapter extends StorageAdapter {
//   constructor(baseUrl, authToken) { super(); this.baseUrl = baseUrl; this.authToken = authToken; }
//   async getAll(collection) { return fetch(`${this.baseUrl}/${collection}`, { headers: this.headers() }).then(r => r.json()); }
//   async put(collection, record) { return fetch(`${this.baseUrl}/${collection}/${record.id}`, { method: 'PUT', headers: this.headers(), body: JSON.stringify(record) }).then(r => r.json()); }
//   async delete(collection, id) { return fetch(`${this.baseUrl}/${collection}/${id}`, { method: 'DELETE', headers: this.headers() }); }
//   headers() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.authToken}` }; }
// }

export class LocalStorageAdapter extends StorageAdapter {
  key(collection) {
    return `${NAMESPACE}.${collection}`;
  }

  async getAll(collection) {
    const raw = localStorage.getItem(this.key(collection));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async put(collection, record) {
    const all = await this.getAll(collection);
    const idx = all.findIndex((r) => r.id === record.id);
    if (idx >= 0) all[idx] = record;
    else all.push(record);
    localStorage.setItem(this.key(collection), JSON.stringify(all));
    return record;
  }

  async delete(collection, id) {
    const all = await this.getAll(collection);
    const filtered = all.filter((r) => r.id !== id);
    localStorage.setItem(this.key(collection), JSON.stringify(filtered));
  }

  async clear(collection) {
    localStorage.removeItem(this.key(collection));
  }
}

export class Repository {
  constructor(adapter, collection) {
    this.adapter = adapter;
    this.collection = collection;
  }

  async all() {
    return this.adapter.getAll(this.collection);
  }

  async get(id) {
    if (!id) return null;
    const all = await this.all();
    return all.find((r) => r.id === id) || null;
  }

  async find(predicate) {
    const all = await this.all();
    return all.filter(predicate);
  }

  /** Insert or update. Stamps bookkeeping fields and bumps `_rev`. */
  async save(record) {
    const now = new Date().toISOString();
    const next = { ...record };
    if (!next.id) next.id = uuid();
    if (!next.createdAt) next.createdAt = now;
    next.updatedAt = now;
    next._rev = (next._rev || 0) + 1;
    next._dirty = true;
    await this.adapter.put(this.collection, next);
    return next;
  }

  async saveMany(records) {
    const saved = [];
    for (const record of records) saved.push(await this.save(record));
    return saved;
  }

  async remove(id) {
    return this.adapter.delete(this.collection, id);
  }

  async clear() {
    return this.adapter.clear(this.collection);
  }
}

export const storage = new LocalStorageAdapter();

/**
 * Removes every key this app owns (all collections, the event log, and the
 * "current profile" pointer) without touching localStorage keys any other
 * app on the same origin might use — this GitHub Pages user site hosts
 * several unrelated static apps under the same origin, so a blanket
 * `localStorage.clear()` would be collateral damage.
 */
export function clearAllPianoStudyData() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(NAMESPACE)) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export const db = {
  profiles: new Repository(storage, 'profiles'),
  chapters: new Repository(storage, 'chapters'),
  lessons: new Repository(storage, 'lessons'),
  songs: new Repository(storage, 'songs'),
  studyPlans: new Repository(storage, 'studyPlans'),
  attempts: new Repository(storage, 'attempts'),
  recordings: new Repository(storage, 'recordings'),
  mistakeStats: new Repository(storage, 'mistakeStats'),
  sessions: new Repository(storage, 'practiceSessions'),
  settings: new Repository(storage, 'settings'),
};
