import {homes, listingPrice} from './data.js';
import {available} from './development/torreOlmo.js';
import {normalizeCriteria, matchesCriteria, criteriaFromText} from './searchCriteria.js';
import {PROPERTY_TYPES, OPERATIONS} from './homeSearchModel.js';
import {addressFromPlaces, areasFromPlaces, placeCovers, resolvePlace} from './locationSearch.js';
import {isFolderId} from './favoriteLists.js';
import {isAccountId, isInviteToken} from './collaborativeLists.js';

const ALL_AREAS = 'Ambas zonas';
const knownAreas = new Set(homes.map(home => home.area));
const knownProperties = new Map(homes.map(home => [home.id, home]));
const preferences = new Set(['none', 'open', 'separate', 'extra']);
const canonicalPreference = pref => pref === 'separate' ? 'extra' : preferences.has(pref) ? pref : 'none';
/** How the results grid is ordered; recommended is the default and stays out of the URL. */
export const SORTS = Object.freeze(['recommended', 'price', 'rarity']);
export const canonicalSort = value => SORTS.includes(value) ? value : 'recommended';
export const DEFAULT_SEARCH = Object.freeze({
  mode:'buy', area:'Narvarte Poniente', areas:Object.freeze(['Narvarte Poniente']),
  address:'', budget:7_500_000, beds:2, note:'', fromIdea:false,
});

const plainText = (value, limit) => typeof value === 'string'
  ? value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u000c\u000e-\u001f\u007f]/g, ' ').replace(/^[^\S\n]+|[^\S\n]+$/gu, '').replace(/\n{3,}/g, '\n\n').slice(0, limit) : '';
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const validNumber = (value, fallback, max) => {
  const parsed = typeof value === 'number' || typeof value === 'string' && value.trim()
    ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= max ? Math.round(parsed) : fallback;
};
const optionalCount = (value, max) => {
  const parsed = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= max ? Math.round(parsed) : 0;
};
const optionalSpan = value => {
  const parsed = typeof value === 'number' || typeof value === 'string' && String(value).trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 100_000 ? Math.round(parsed) : 0;
};
function sizeFields(source) {
  let minSize = optionalSpan(source.minSize), maxSize = optionalSpan(source.maxSize);
  let minLot = optionalSpan(source.minLot), maxLot = optionalSpan(source.maxLot);
  if (minSize && maxSize && minSize > maxSize) [minSize, maxSize] = [maxSize, minSize];
  if (minLot && maxLot && minLot > maxLot) [minLot, maxLot] = [maxLot, minLot];
  return {
    ...(minSize ? {minSize} : {}), ...(maxSize ? {maxSize} : {}),
    ...(minLot ? {minLot} : {}), ...(maxLot ? {maxLot} : {}),
  };
}
/** Built area only when the listing publishes m² that is not a lot. */
export function builtArea(home) {
  const match = String(home?.features || '').match(/(\d+)\s*m²(?!\s*lote)/);
  return match ? Number(match[1]) : null;
}
/** Total area only when the listing publishes “m² lote”. Missing is not zero. */
export function lotArea(home) {
  const match = String(home?.features || '').match(/(\d+)\s*m²\s*lote/);
  return match ? Number(match[1]) : null;
}
export function parkingSpots(home) {
  const match = String(home?.features || '').match(/(\d+)\s*estac/);
  return match ? Number(match[1]) : 0;
}
function measureFits(value, min, max) {
  if (!min && !max) return true;
  if (!Number.isFinite(value)) return false;
  return (!min || value >= min) && (!max || value <= max);
}

/** An explicit empty areas array means all catalog areas; omitted areas uses the legacy area field. */
export function normalizeSearch(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const mode = OPERATIONS.some(([key]) => key === source.mode) ? source.mode : 'buy';
  let selected;
  if (Array.isArray(source.areas)) {
    selected = [...new Set(source.areas.filter(area => knownAreas.has(area)))];
    // Malformed links must not silently broaden a targeted search to every area.
    if (source.areas.length && !selected.length) selected = [...DEFAULT_SEARCH.areas];
  } else if (source.area === ALL_AREAS) selected = [];
  else selected = [knownAreas.has(source.area) ? source.area : DEFAULT_SEARCH.area];
  const places = Array.isArray(source.places) ? source.places.map(place => resolvePlace(place?.kind, place?.id)).filter(Boolean).filter((place, index, all) => all.findIndex(item => item.key === place.key) === index).slice(0, 12) : undefined;
  if (places) selected = areasFromPlaces(places);
  return {
    mode, area:selected[0] || ALL_AREAS, areas:selected,
    address:places ? addressFromPlaces(places) : plainText(source.address, 160),
    ...(places?.length ? {places} : {}),
    budget:validNumber(source.budget, mode === 'buy' ? DEFAULT_SEARCH.budget : 28_000, 1_000_000_000),
    beds:validNumber(source.beds, DEFAULT_SEARCH.beds, 10),
    baths:validNumber(source.baths, 1, 10),
    ...(optionalCount(source.parking, 10) ? {parking:optionalCount(source.parking, 10)} : {}),
    ...sizeFields(source),
    note:plainText(source.note, 600), fromIdea:source.fromIdea === true,
    criteria:Array.isArray(source.criteria) ? normalizeCriteria(source.criteria) : criteriaFromText(plainText(source.note, 600)),
    ...(PROPERTY_TYPES.some(([key]) => key === source.propertyType) ? {propertyType:source.propertyType} : {}),
    ...(Number(source.minBudget) > 0 && Number(source.minBudget) <= Number(source.budget) ? {minBudget:Math.round(Number(source.minBudget))} : {}),
    ...(plainText(source.ideaLabel, 160) ? {ideaLabel:plainText(source.ideaLabel, 160)} : {}),
    ...(source.tour3d === true ? {tour3d:true} : {}),
  };
}

export const selectedAreas = search => normalizeSearch(search).areas;

/** A search alert follows the hard filters, not the free text or the order of the grid. */
export function alertKey(search) {
  const current = normalizeSearch(search);
  const placeKey = (current.places || []).map(place => place.key).sort();
  return JSON.stringify([current.mode, current.propertyType || 'apartment', [...current.areas].sort(), current.address, placeKey, current.beds, current.baths, current.parking || 0, current.minSize || 0, current.maxSize || 0, current.minLot || 0, current.maxLot || 0, current.minBudget || 0, current.budget]);
}

// A development fits when one of its available units fits. Units publish built area, not lot area.
const developmentFits = (current) => {
  if (current.minLot || current.maxLot) return false;
  return available.some(unit => unit.beds >= current.beds
    && unit.baths >= current.baths
    && unit.parking >= (current.parking || 0)
    && measureFits(unit.size, current.minSize, current.maxSize)
    && unit.price <= current.budget && unit.price >= (current.minBudget || 0));
};

export function matchingHomes(search) {
  const current = normalizeSearch(search);
  const address = fold(current.address);
  const placed = Array.isArray(current.places);
  const inPlaces = home => !placed || !current.places.length || current.places.some(place => placeCovers(home, place));
  return homes.filter(home => home.mode === current.mode
    && (!current.tour3d || home.development)
    && (placed || !current.areas.length || current.areas.includes(home.area))
    && inPlaces(home)
    && (!current.propertyType || current.propertyType === 'apartment' || current.propertyType === 'any')
    && (home.development ? developmentFits(current) : Number.isFinite(listingPrice(home)) && listingPrice(home) <= current.budget && listingPrice(home) >= (current.minBudget || 0)
    && home.beds >= current.beds
    && home.baths >= current.baths
    && parkingSpots(home) >= (current.parking || 0)
    && measureFits(builtArea(home), current.minSize, current.maxSize)
    && measureFits(lotArea(home), current.minLot, current.maxLot))
    && matchesCriteria(home, current.criteria)
    && (placed || !address || fold(`${home.street} ${home.area} ${home.location || ''}`).includes(address)));
}

const developments = homes.filter(home => home.development);

export const PROTOTYPE_MIN_RESULTS = 40;
const SHOWCASE_SLOT = 2;

/** Keep the concept browsable: exact matches first, then nearby catalog suggestions. */
export function prototypeResults(search) {
  const current = normalizeSearch(search);
  // "Solo con tour 3D" is a showcase filter: only the developments with a tour, whatever else is set.
  if (current.tour3d) return developments;
  const found = matchingHomes(current);
  // A catalog street is a precise place: the grid keeps only that street (all of it if the other filters leave none).
  if (current.address) {
    const onStreet = homes.filter(home => home.mode === (current.mode === 'rent' ? 'rent' : 'buy') && fold(home.street).includes(fold(current.address)));
    if (onStreet.length) return found.length ? found : onStreet;
  }
  // Desarrollos has a single development in the catalog; it leads, and buy listings fill the grid.
  const exact = current.mode === 'development' ? [...developments, ...found.filter(home => !home.development)] : found;
  if (exact.length >= PROTOTYPE_MIN_RESULTS) return exact;
  const selected = new Set(exact.map(home => home.id));
  const mode = current.mode === 'rent' ? 'rent' : 'buy';
  const address = fold(current.address);
  const distance = home => {
    const price = listingPrice(home);
    const priceDistance = Math.max(0, price - current.budget, (current.minBudget || 0) - price) / Math.max(1, current.budget);
    const placed = Array.isArray(current.places);
    const outside = placed
      ? current.places.length && !current.places.some(place => placeCovers(home, place)) ? 60 : 0
      : (current.areas.length && !current.areas.includes(home.area) ? 60 : 0) + (address && !fold(`${home.street} ${home.area} ${home.location || ''}`).includes(address) ? 80 : 0);
    return outside
      + Math.max(0, current.beds - (home.beds ?? 0)) * 8
      + Math.max(0, current.baths - (home.baths ?? 0)) * 6
      + Math.max(0, (current.parking || 0) - parkingSpots(home)) * 6
      + (measureFits(builtArea(home), current.minSize, current.maxSize) ? 0 : 10)
      + (measureFits(lotArea(home), current.minLot, current.maxLot) ? 0 : 10)
      + current.criteria.filter(id => !matchesCriteria(home, [id])).length * 12
      + Math.min(priceDistance, 10) * 20;
  };
  const suggestions = homes.filter(home => home.mode === mode && !home.development && !selected.has(home.id))
    .sort((a,b) => distance(a) - distance(b) || listingPrice(a) - listingPrice(b) || a.id.localeCompare(b.id))
    .slice(0, PROTOTYPE_MIN_RESULTS - exact.length);
  return [...exact, ...suggestions];
}

/** The 3D development is the third card in a mixed buy grid, even when the search is in another colonia. */
export function pinShowcaseDevelopments(items, search) {
  const current = search || {};
  if (current.tour3d || current.mode === 'rent') return items;
  const extra = developments.filter(home => !items.some(item => item.id === home.id));
  const featured = [...items.filter(home => home.development), ...extra];
  if (!featured.length) return items;
  const rest = items.filter(home => !home.development);
  if (!rest.length) return featured;
  if (current.mode === 'development') return extra.length ? [...featured, ...rest] : items;
  const pool = extra.length ? rest.slice(0, Math.max(0, rest.length - extra.length)) : rest;
  const slot = Math.min(SHOWCASE_SLOT, pool.length);
  return [...pool.slice(0, slot), ...featured, ...pool.slice(slot)];
}

/** Keep tour cards near the top of a results grid without placing them next to each other. */
export function spreadTourListings(items, columns) {
  const width = Math.max(1, columns | 0);
  const tours = items.filter(home => home.video && !home.development);
  if (!tours.length) return items;
  const slots = [];
  const claim = index => {
    let slot = Math.max(0, index);
    while (slots.some(other => Math.abs(other - slot) < 2)) slot += 1;
    slots.push(slot);
  };
  claim(0);
  if (tours.length > 1) claim(width === 1 ? 2 : width + 1);
  for (let index = 2; index < tours.length; index += 1) {
    const column = width === 1 ? 0 : index % width;
    claim((index + 1) * width + column);
  }
  const ordered = items.filter(home => !home.video || home.development);
  tours.forEach((home, index) => ordered.splice(Math.min(slots[index], ordered.length), 0, home));
  return ordered;
}

/** Only an explicit call can extend the area selection; all other constraints remain intact. */
export function addArea(search, area) {
  const current = normalizeSearch(search);
  if (!knownAreas.has(area) || !current.areas.length || current.areas.includes(area)) return current;
  return normalizeSearch({...current, areas:[...current.areas, area]});
}

export function expansionOptions(search) {
  const current = normalizeSearch(search);
  if (!current.areas.length) return [];
  const existing = new Set(matchingHomes(current).map(home => home.id));
  const counts = new Map();
  for (const home of matchingHomes({...current, areas:[]})) {
    if (!current.areas.includes(home.area) && !existing.has(home.id)) {
      counts.set(home.area, (counts.get(home.area) || 0) + 1);
    }
  }
  return [...counts].map(([area, additional]) => ({area, additional, total:existing.size + additional}))
    .sort((a, b) => b.additional - a.additional || a.area.localeCompare(b.area, 'es-MX'));
}

function asUrl(locationLike) {
  if (typeof locationLike === 'string' || locationLike instanceof URL) {
    try { return new URL(String(locationLike), 'https://prototype.invalid'); } catch { return new URL('https://prototype.invalid'); }
  }
  const pathname = typeof locationLike?.pathname === 'string' ? locationLike.pathname : '/';
  const query = typeof locationLike?.search === 'string' ? locationLike.search : '';
  return new URL(`${pathname.startsWith('/') ? pathname : '/'}${query.startsWith('?') ? query : ''}`, 'https://prototype.invalid');
}

export function readJourney(locationLike = {}) {
  const url = asUrl(locationLike);
  const params = url.searchParams;
  const page = params.get('view') === 'compare' ? 'compare'
    : params.get('view') === 'folder' ? 'folder'
    : params.get('view') === 'favorites' ? 'favorites'
    : params.get('view') === 'saved' ? 'saved'
    : params.get('view') === 'listing' ? 'listing'
    : params.get('view') === 'results' || /^\/(results|resultados)\/?$/.test(url.pathname) ? 'results'
    : 'home';
  const rawAreas = params.has('areas') ? params.get('areas').split('|').filter(Boolean) : undefined;
  const search = normalizeSearch({
    mode:params.get('mode'), area:params.get('area') || DEFAULT_SEARCH.area,
    ...(rawAreas ? {areas:rawAreas} : {}),
    budget:params.get('budget'), beds:params.get('beds'), baths:params.get('baths'), parking:params.get('parking'),
    minSize:params.get('minSize'), maxSize:params.get('maxSize'), minLot:params.get('minLot'), maxLot:params.get('maxLot'),
    address:params.get('address'),
    ...(params.getAll('place').length ? {places:params.getAll('place').map(value => {const cut = value.indexOf('~'); return cut > 0 ? {kind:value.slice(0, cut), id:value.slice(cut + 1)} : null;}).filter(Boolean)} : {}),
    propertyType:params.get('type'), minBudget:params.get('minBudget'),
    criteria:params.has('criterion') ? params.getAll('criterion') : undefined,
    note:params.get('note'), fromIdea:params.get('idea') === '1', ideaLabel:params.get('ideaLabel'),
    tour3d:params.get('tour') === '3d',
  });
  const pref = canonicalPreference(params.get('pref'));
  const requestedId = params.get('property');
  const propertyId = knownProperties.has(requestedId)
    && (page !== 'results' || prototypeResults(search).some(home => home.id === requestedId)) ? requestedId : null;
  const rawList = params.get('list');
  const listId = (page === 'compare' && isFolderId(rawList)) || (page === 'folder' && /^list-[a-z0-9-]{1,40}$/.test(rawList || '')) ? rawList : null;
  const map = (page === 'results' || page === 'listing') ? canonicalMapMode(params.get('map')) : 'mini';
  const sort = (page === 'results' || page === 'listing') ? canonicalSort(params.get('sort')) : 'recommended';
  // An invite token rides only on a listing or a folder; `de` is an opaque sender id, never a name or contact.
  const invite = (page === 'listing' || page === 'folder') && isInviteToken(params.get('invite')) ? params.get('invite') : null;
  const from = isAccountId(params.get('de')) ? params.get('de') : null;
  // A withdrawn listing stays on its invite so the sender's banner can explain it.
  const landing = page === 'listing' && !propertyId && !invite ? 'results' : page === 'folder' && !listId && !invite ? 'favorites' : page;
  return {page:landing, search, pref, propertyId, ...(listId ? {listId} : {}), ...(map !== 'mini' ? {map} : {}), ...(sort !== 'recommended' ? {sort} : {}),
    ...(invite ? {invite} : {}), ...(from && (page === 'listing' || page === 'folder') ? {from} : {})};
}

export const MAP_MODES = Object.freeze(['mini', 'half', 'full']);
export const canonicalMapMode = value => MAP_MODES.includes(value) ? value : 'mini';

/** Shareable URLs contain criteria and a folder id at most; never contact identity, receipts or saved listing ids. */
export function journeyUrl({page = 'home', search = DEFAULT_SEARCH, pref = 'none', propertyId = null, listId = null, map = 'mini', sort = 'recommended', invite = null, from = null} = {}) {
  const current = normalizeSearch(search);
  const view = page === 'compare' ? 'compare'
    : page === 'saved' ? 'saved'
    : page === 'folder' && (listId || isInviteToken(invite)) ? 'folder'
    : page === 'favorites' || page === 'folder' ? 'favorites'
    : page === 'listing' && (knownProperties.has(propertyId) || isInviteToken(invite)) ? 'listing'
    : page === 'results' || page === 'listing' ? 'results'
    : 'home';
  const params = new URLSearchParams({view, mode:current.mode,
    areas:current.areas.join('|'), budget:String(current.budget), beds:String(current.beds)});
  if (current.baths > 1) params.set('baths', String(current.baths));
  if (current.parking) params.set('parking', String(current.parking));
  if (current.minSize) params.set('minSize', String(current.minSize));
  if (current.maxSize) params.set('maxSize', String(current.maxSize));
  if (current.minLot) params.set('minLot', String(current.minLot));
  if (current.maxLot) params.set('maxLot', String(current.maxLot));
  if (current.propertyType) params.set('type', current.propertyType);
  if (current.minBudget) params.set('minBudget', String(current.minBudget));
  if (current.address) params.set('address', current.address);
  for (const place of current.places || []) params.append('place', place.key);
  if (current.note) params.set('note', current.note);
  for (const criterion of current.criteria || []) params.append('criterion', criterion);
  // An explicit empty selection prevents a removed detail from returning on refresh.
  if (current.note && !current.criteria.length) params.set('criterion', '');
  if (current.fromIdea) params.set('idea', '1');
  if (current.ideaLabel) params.set('ideaLabel', current.ideaLabel);
  if (current.tour3d) params.set('tour', '3d');
  const canonicalPref = canonicalPreference(pref);
  if (canonicalPref !== 'none') params.set('pref', canonicalPref);
  if (knownProperties.has(propertyId) && (page !== 'results' || prototypeResults(current).some(home => home.id === propertyId))) params.set('property', propertyId);
  if (page === 'compare' && isFolderId(listId)) params.set('list', listId);
  if (view === 'folder' && /^list-[a-z0-9-]{1,40}$/.test(listId || '')) params.set('list', listId);
  if ((view === 'listing' || view === 'folder') && isInviteToken(invite)) params.set('invite', invite);
  if ((view === 'listing' || view === 'folder') && isAccountId(from)) params.set('de', from);
  const mapMode = canonicalMapMode(map);
  if ((view === 'results' || view === 'listing') && mapMode !== 'mini') params.set('map', mapMode);
  if ((view === 'results' || view === 'listing') && canonicalSort(sort) !== 'recommended') params.set('sort', canonicalSort(sort));
  return `/?${params}`;
}

/** Retired animation links keep their search, but open the only supported V2 route. */
export function migratePrototypeUrl(href) {
  const url = new URL(href);
  if (!/^\/proto\/(home-motion|search-transition)(?:\/|$)/.test(url.pathname)) return null;
  url.pathname = '/';
  for (const key of ['v','bar','reference']) url.searchParams.delete(key);
  return url.pathname+url.search+url.hash;
}

export function factualReason(home, search, language = 'es-MX') {
  const portuguese = language === 'pt-BR';
  if (!home || !matchingHomes(search).some(match => match.id === home.id)) {
    return portuguese ? 'Fora dos filtros atuais.' : 'Fuera de los filtros actuales.';
  }
  return `${home.beds} ${portuguese ? home.beds === 1 ? 'quarto' : 'quartos' : home.beds === 1 ? 'recámara' : 'recámaras'} · ${home.area} · ${portuguese ? 'Dentro do orçamento' : 'Dentro del presupuesto'}`;
}
