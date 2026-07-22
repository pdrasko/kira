// Which profile is "current" is a UI convenience, not sync-relevant data,
// so it's kept out of the db.* repositories and just pointed to by a
// plain localStorage key.

import { db } from './db.js';
import { makeProfile } from './models.js';

const CURRENT_PROFILE_KEY = 'kira.piano.v1.currentProfileId';

export async function getCurrentProfile() {
  const id = localStorage.getItem(CURRENT_PROFILE_KEY);
  if (id) {
    const profile = await db.profiles.get(id);
    if (profile) return profile;
  }
  const all = await db.profiles.all();
  if (all.length > 0) {
    localStorage.setItem(CURRENT_PROFILE_KEY, all[0].id);
    return all[0];
  }
  return null;
}

export async function createProfile(name) {
  const saved = await db.profiles.save(makeProfile({ name }));
  localStorage.setItem(CURRENT_PROFILE_KEY, saved.id);
  return saved;
}

export function setCurrentProfileId(id) {
  localStorage.setItem(CURRENT_PROFILE_KEY, id);
}

export async function listProfiles() {
  return db.profiles.all();
}
