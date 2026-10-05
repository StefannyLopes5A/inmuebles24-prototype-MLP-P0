import {normalizeContactProfile} from './contactFlow.js';

export const CONTACT_PROFILE_KEY = 'inmuebles24-v2-contact-profile';

function profileFields(value) {
  const fields = ['name', 'email', 'phone'];
  return normalizeContactProfile(Object.fromEntries(fields.map(field => [
    field, typeof value?.[field] === 'string' ? value[field] : '',
  ])));
}

// Identity is browser-local. Search URLs and per-property receipts never own this profile.
export function readContactProfile(legacyProfile, storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage)?.getItem(CONTACT_PROFILE_KEY) || 'null');
    if (value && typeof value === 'object' && !Array.isArray(value)) return profileFields(value);
  } catch { /* A blocked or corrupt store must not prevent the prototype from opening. */ }
  return profileFields(legacyProfile);
}

export function writeContactProfile(profile, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(CONTACT_PROFILE_KEY, JSON.stringify(profileFields(profile)));
    return true;
  } catch { return false; }
}
