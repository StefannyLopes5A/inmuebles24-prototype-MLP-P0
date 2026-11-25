// Favorites are a flat list of listing ids: no folders, no sharing, no comparison.
export const SAVED_LIMIT = 100;
export const RECENT_LIMIT = 24;

export function normalizeSaved(raw, known) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).filter(id => typeof id === 'string' && !seen.has(id) && (!known || known.has(id)) && seen.add(id)).slice(0, SAVED_LIMIT);
}

export function toggleSaved(ids, id) {
  if (ids.includes(id)) return {ids: ids.filter(item => item !== id), saved: false};
  return {ids: [id, ...ids].slice(0, SAVED_LIMIT), saved: true};
}

export function normalizeRecent(raw, known) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || seen.has(entry.id) || (known && !known.has(entry.id))) return [];
    seen.add(entry.id);
    return [{id:entry.id, viewedAt:Number(entry.viewedAt) || 0}];
  }).slice(0, RECENT_LIMIT);
}

export function recordView(recent, homeId, now = Date.now()) {
  if (!homeId) return recent;
  return [{id:homeId, viewedAt:now}, ...recent.filter(entry => entry.id !== homeId)].slice(0, RECENT_LIMIT);
}

export function savedCountLabel(count, language = 'es-MX') {
  if (language === 'pt-BR') return count === 1 ? '1 item salvo' : `${count} itens salvos`;
  return count === 1 ? '1 inmueble guardado' : `${count} inmuebles guardados`;
}
