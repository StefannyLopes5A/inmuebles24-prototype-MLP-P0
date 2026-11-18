/** Door in front of the prototype. This is not an account password. */
export const PROTOTYPE_PASSWORD = 'CONQUISTARELMUNDO';
export const UNLOCK_KEY = 'i24-prototype-unlock';

export function passwordSource() {
  const fromEnv = import.meta.env?.VITE_PROTOTYPE_PASSWORD;
  return typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : PROTOTYPE_PASSWORD;
}

export function passwordMatches(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string' || expected.length === 0) return false;
  if (value.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) diff |= value.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

export function readPrototypeUnlock(storage) {
  try { return storage?.getItem(UNLOCK_KEY) === '1'; } catch { return false; }
}

export function writePrototypeUnlock(storage) {
  try { storage?.setItem(UNLOCK_KEY, '1'); } catch { /* the door simply asks again */ }
}
