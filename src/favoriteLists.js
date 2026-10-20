export const FOLDER_NAME_MAX = 50;
export const RECENT_LIMIT = 24;
export const RECENT_ID = 'recent';
export const DEFAULT_CITY = 'Ciudad de México';
const LEGACY_ID = 'list-favoritos';
const FOLDER_ID = /^list-[a-z0-9-]{1,40}$/;
const ALL_AREAS = 'Ambas zonas';
const DAY = 86_400_000;

/** A one-off comparison of a listing against some favorites; lives only in the URL, never in the saved folders. */
const PICK_ID = /^pick:[a-z0-9-]{1,40}(,[a-z0-9-]{1,40}){1,3}$/;
export const pickId = ids => `pick:${[...new Set(ids)].slice(0, 4).join(',')}`;
export const pickIds = id => typeof id === 'string' && PICK_ID.test(id) ? id.slice(5).split(',') : null;

export const isFolderId = id => typeof id === 'string' && (id === RECENT_ID || FOLDER_ID.test(id) || PICK_ID.test(id));

export function cleanFolderName(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FOLDER_NAME_MAX).trim();
}

/** City first, then as many searched areas as fit; never truncates an area mid-word. */
export function suggestedFolderName(search = {}, city = DEFAULT_CITY) {
  const areas = Array.isArray(search.areas) ? search.areas
    : search.area && search.area !== ALL_AREAS ? [search.area] : [];
  let name = city;
  for (const area of areas) {
    const next = `${name}, ${area}`;
    if (next.length > FOLDER_NAME_MAX) break;
    name = next;
  }
  return name.slice(0, FOLDER_NAME_MAX);
}

/** Adds " 2", " 3"… when the suggestion already names a list, keeping the 50-character cap. */
export function uniqueFolderName(name, folders = []) {
  const taken = new Set(folders.map(folder => folder.name.toLocaleLowerCase()));
  if (!taken.has(name.toLocaleLowerCase())) return name;
  for (let index = 2; ; index += 1) {
    const suffix = ` ${index}`;
    const next = `${name.slice(0, FOLDER_NAME_MAX - suffix.length).trim()}${suffix}`;
    if (!taken.has(next.toLocaleLowerCase())) return next;
  }
}

function uniqueIds(ids, known) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter(id => typeof id === 'string' && (!known || known.has(id))))];
}

/** Session data is untrusted: drops malformed folders and moves a legacy `saved` list into one folder. */
export function normalizeFolders(raw, legacySaved = [], known) {
  const seen = new Set();
  const folders = (Array.isArray(raw) ? raw : []).flatMap(folder => {
    if (!folder || !FOLDER_ID.test(folder.id) || seen.has(folder.id)) return [];
    const name = cleanFolderName(folder.name);
    if (!name) return [];
    seen.add(folder.id);
    return [{id:folder.id, name, homeIds:uniqueIds(folder.homeIds, known), createdAt:Number(folder.createdAt) || 0}];
  });
  if (Array.isArray(raw)) return dedupeHomes(folders);
  const legacy = uniqueIds(legacySaved, known);
  return legacy.length ? [{id:LEGACY_ID, name:'Favoritos', homeIds:legacy, createdAt:0}] : [];
}

function dedupeHomes(folders) {
  const placed = new Set();
  return folders.map(folder => ({...folder, homeIds:folder.homeIds.filter(id => !placed.has(id) && placed.add(id))}))
    .filter(folder => folder.homeIds.length);
}

export function normalizeRecent(raw, known) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || seen.has(entry.id) || (known && !known.has(entry.id))) return [];
    seen.add(entry.id);
    return [{id:entry.id, viewedAt:Number(entry.viewedAt) || 0}];
  }).slice(0, RECENT_LIMIT);
}

export const folderOf = (folders, homeId) => folders.find(folder => folder.homeIds.includes(homeId)) || null;
export const savedIds = folders => folders.flatMap(folder => folder.homeIds);
/** A list with no homes stops existing. */
export const removeHome = (folders, homeId) => folders
  .map(folder => ({...folder, homeIds:folder.homeIds.filter(id => id !== homeId)}))
  .filter(folder => folder.homeIds.length);

export function restoreHome(folders, folder, homeId) {
  if (folders.some(item => item.id === folder.id)) return saveToFolder(folders, folder.id, homeId).folders;
  return [{...folder, homeIds:[homeId]}, ...removeHome(folders, homeId)];
}

const newFolderId = now => `list-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** A home lives in one folder; the newest save becomes the folder cover. */
export function createFolder(folders, name, homeId, now = Date.now()) {
  const clean = cleanFolderName(name);
  if (!clean) return {folders, folder:null};
  const folder = {id:newFolderId(now), name:clean, homeIds:homeId ? [homeId] : [], createdAt:now};
  return {folders:[folder, ...removeHome(folders, homeId)], folder};
}

/** Choosing the folder that already holds the home removes it, like tapping a filled heart. */
export function saveToFolder(folders, folderId, homeId) {
  const target = folders.find(folder => folder.id === folderId);
  if (!target) return {folders, removed:false, folder:null};
  if (target.homeIds.includes(homeId)) return {folders:removeHome(folders, homeId), removed:true, folder:target};
  const next = removeHome(folders, homeId).map(folder => folder.id === folderId ? {...folder, homeIds:[homeId, ...folder.homeIds]} : folder);
  return {folders:next, removed:false, folder:next.find(folder => folder.id === folderId)};
}

export function recordView(recent, homeId, now = Date.now()) {
  if (!homeId) return recent;
  return [{id:homeId, viewedAt:now}, ...recent.filter(entry => entry.id !== homeId)].slice(0, RECENT_LIMIT);
}

/**
 * "Compartir" keeps a snapshot of the folder in this browser's localStorage, keyed by the folder id, so the link
 * (which carries only that id) opens the folder in another tab of the same browser. Nothing leaves the device.
 */
export const SHARED_KEY = 'inmuebles24-v2-shared-folders';
export const SHARED_LIMIT = 12;

export function readSharedFolders(raw, known) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(source).flatMap(([id, folder]) => {
    if (!FOLDER_ID.test(id) || !folder) return [];
    const name = cleanFolderName(folder.name), homeIds = uniqueIds(folder.homeIds, known);
    return name && homeIds.length ? [[id, {id, name, homeIds, sharedAt:Number(folder.sharedAt) || 0}]] : [];
  }).sort((a, b) => b[1].sharedAt - a[1].sharedAt).slice(0, SHARED_LIMIT));
}

export function shareFolder(shared, folder, now = Date.now()) {
  if (!folder || !FOLDER_ID.test(folder.id)) return shared;
  return readSharedFolders({...shared, [folder.id]:{name:folder.name, homeIds:folder.homeIds, sharedAt:now}});
}

export function savedCountLabel(count, language = 'es-MX') {
  if (language === 'pt-BR') return count === 1 ? '1 item salvo' : `${count} itens salvos`;
  return count === 1 ? '1 inmueble guardado' : `${count} inmuebles guardados`;
}

export function viewedLabel(timestamp, now = Date.now(), language = 'es-MX') {
  const pt = language === 'pt-BR';
  const start = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.max(0, Math.round((start(new Date(now)) - start(new Date(timestamp))) / DAY));
  if (days === 0) return pt ? 'Hoje' : 'Hoy';
  if (days === 1) return pt ? 'Ontem' : 'Ayer';
  return pt ? `Há ${days} dias` : `Hace ${days} días`;
}
