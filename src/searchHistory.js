import {homes, inspirationCollections, listingPrice} from './data.js';
import {matchesCriteria} from './searchCriteria.js';
import {alertKey, matchingHomes, normalizeSearch} from './journey.js';

export const IDEA_RECENT_CARD_LIMIT = 4;

const DEMO_RECENT_SPECS = {
  buy: [
    {queryLead: 'Departamento de 3 recámaras en Narvarte Poniente', area: 'Narvarte Poniente', beds: 3, budget: 7_500_000, note: 'Departamento de 3 recámaras en Narvarte Poniente'},
    {queryLead: 'Departamento de 1 recámara en Roma Norte, CDMX', area: 'Roma Norte', beds: 1, budget: 4_500_000, note: 'Departamento de 1 recámara en Roma Norte'},
    {queryLead: 'Departamento de 2 recámaras en Del Valle Centro', area: 'Del Valle Centro', beds: 2, budget: 10_000_000, note: 'Departamento de 2 recámaras en Del Valle Centro'},
    {queryLead: 'Casa con jardín en Juárez, CDMX', area: 'Juárez', beds: 3, budget: 12_000_000, note: 'Casa con jardín en Juárez', propertyType: 'house'},
  ],
  rent: [
    {queryLead: 'Departamento de 2 recámaras en Polanco, CDMX', area: 'Polanco', beds: 2, budget: 45_000, note: 'Departamento de 2 recámaras en Polanco'},
    {queryLead: 'Departamento de 1 recámara en Nápoles', area: 'Nápoles', beds: 1, budget: 28_000, note: 'Departamento de 1 recámara en Nápoles'},
    {queryLead: 'Departamento de 3 recámaras en Narvarte Poniente', area: 'Narvarte Poniente', beds: 3, budget: 40_000, note: 'Departamento de 3 recámaras en Narvarte Poniente'},
    {queryLead: 'Departamento de 2 recámaras en Del Valle Centro', area: 'Del Valle Centro', beds: 2, budget: 38_000, note: 'Departamento de 2 recámaras en Del Valle Centro'},
  ],
};

function searchFromDemoSpec(mode, spec) {
  return normalizeSearch({
    mode,
    propertyType: spec.propertyType || 'apartment',
    criteria: [],
    minBudget: 0,
    area: spec.area,
    areas: [spec.area],
    address: '',
    beds: spec.beds,
    budget: spec.budget,
    note: spec.note,
    ideaLabel: spec.queryLead,
    fromIdea: false,
  });
}

export function searchHistoryLabel(search) {
  const label = String(search.ideaLabel || search.note || '').trim();
  if (label) return label.slice(0, 120);
  const area = search.areas?.[0] || (search.area && search.area !== 'Ambas zonas' ? search.area : '');
  const chunks = [];
  if (area) chunks.push(area);
  if (search.beds) chunks.push(`${search.beds}+`);
  return chunks.join(' · ') || 'Búsqueda reciente';
}

export function normalizeSearchHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(item => item && typeof item === 'object' && item.search)
    .map(item => ({
      id: String(item.id || alertKey(item.search)),
      queryLead: String(item.queryLead || searchHistoryLabel(item.search)).slice(0, 120),
      recent: item.recent !== false,
      search: normalizeSearch(item.search),
    }))
    .slice(0, 8);
}

export function shouldRecordSearch(search) {
  const current = normalizeSearch(search);
  const area = current.areas?.[0] || (current.area && current.area !== 'Ambas zonas' ? current.area : '');
  return !!(area || (current.note || '').trim() || (current.address || '').trim());
}

export function recordSearchHistory(history, search) {
  const normalized = normalizeSearch(search);
  if (!shouldRecordSearch(normalized)) return history;
  const entry = {
    id: alertKey(normalized),
    queryLead: searchHistoryLabel(normalized),
    recent: true,
    search: {...normalized, fromIdea: false},
  };
  return [entry, ...history.filter(item => item.id !== entry.id)].slice(0, 8);
}

export function previewHomesForSearch(search, limit = 3) {
  const matched = matchingHomes(search);
  if (matched.length) return matched.slice(0, limit);
  const area = search.areas?.[0] || search.area;
  return homes.filter(home => home.mode === search.mode && (!area || area === 'Ambas zonas' || home.area === area)).slice(0, limit);
}

export function ideaCardsFromHistory(history, mode) {
  return normalizeSearchHistory(history)
    .filter(item => item.search.mode === mode)
    .slice(0, IDEA_RECENT_CARD_LIMIT)
    .map(item => ({
      id: item.id,
      queryLead: item.queryLead,
      recent: true,
      previewItems: previewHomesForSearch(item.search),
      search: item.search,
    }));
}

/** Local simulation shown for signed-in users before their first recorded search. */
export function demoSearchHistory(mode = 'buy') {
  const specs = DEMO_RECENT_SPECS[mode] || DEMO_RECENT_SPECS.buy;
  return specs.map(spec => {
    const search = searchFromDemoSpec(mode, spec);
    return {id: alertKey(search), queryLead: spec.queryLead, recent: true, search, simulated: true};
  });
}

export function demoRecentIdeaCards(mode = 'buy') {
  return demoSearchHistory(mode).slice(0, IDEA_RECENT_CARD_LIMIT).map(entry => ({
    id: entry.id,
    queryLead: entry.queryLead,
    recent: true,
    previewItems: previewHomesForSearch(entry.search),
    search: entry.search,
  }));
}

/**
 * Amenity variations of the suggestions. A criterion is only applied when the catalog's own text confirms it for the
 * area, so the results are never empty; `pets` has no evidence in the catalog, so it stays a preference in the note
 * and the listings keep their "confirm with the agency" caveat.
 */
const AMENITY_SPECS = {
  buy: [
    {lead:'Departamento pet friendly en Roma Norte, CDMX', area:'Roma Norte', beds:2, budget:9_000_000, preference:true},
    {lead:'Departamento con alberca en Xoco', area:'Xoco', criteria:['pool']},
    {lead:'Departamento con gimnasio en Xoco', area:'Xoco', criteria:['gym']},
    {lead:'Departamento con jardín en Jardines del Pedregal', area:'Jardines del Pedregal', criteria:['garden']},
    {lead:'Departamento con balcón en Del Valle Norte', area:'Del Valle Norte', criteria:['balcony']},
    {lead:'Departamento con terraza en Polanco', area:'Polanco', criteria:['terrace']},
  ],
  rent: [
    {lead:'Departamento pet friendly en Nápoles', area:'Nápoles', beds:1, budget:30_000, preference:true},
    {lead:'Departamento amueblado en Ampliación Granada', area:'Ampliación Granada', criteria:['furnished']},
    {lead:'Departamento con roof garden en Polanco', area:'Polanco', criteria:['roof']},
    {lead:'Departamento con terraza en Polanco', area:'Polanco', criteria:['terrace']},
    {lead:'Departamento con balcón en Del Valle Sur', area:'Del Valle Sur', criteria:['balcony']},
  ],
};

function amenitySuggestionCards(mode) {
  return AMENITY_SPECS[mode].flatMap(spec => {
    const inArea = homes.filter(home => home.mode === mode && home.area === spec.area);
    const matched = spec.criteria ? inArea.filter(home => matchesCriteria(home, spec.criteria)) : inArea;
    if (!matched.length) return [];
    const beds = spec.beds ?? Math.max(1, Math.min(...matched.map(home => home.beds || 1)));
    const priciest = Math.max(...matched.map(home => listingPrice(home)));
    const step = mode === 'buy' ? 100_000 : 1_000;
    return [{
      id: `suggest-amenity-${spec.area}-${(spec.criteria || ['pets'])[0]}`.replace(/\s+/g, '-').toLowerCase(),
      queryLead: spec.lead,
      recent: false,
      previewItems: matched.slice(0, 3),
      search: normalizeSearch({
        mode,
        propertyType: 'apartment',
        criteria: spec.criteria || [],
        minBudget: 0,
        area: spec.area,
        areas: [spec.area],
        address: '',
        beds,
        budget: spec.budget ?? Math.ceil(priciest / step) * step,
        note: spec.lead,
        ideaLabel: spec.lead,
        fromIdea: true,
      }),
    }];
  });
}

export function ideaSuggestionCards(mode, translate = value => value) {
  const areaCards = ideaAreaSuggestionCards(mode, translate);
  const amenityCards = amenitySuggestionCards(mode).map(card => ({...card, search:{...card.search, note:translate(card.search.note)}}));
  // One amenity card after each area card, so the rail alternates between places and wishes.
  return areaCards.flatMap((card, index) => amenityCards[index] ? [card, amenityCards[index]] : [card]).concat(amenityCards.slice(areaCards.length));
}

function ideaAreaSuggestionCards(mode, translate) {
  return inspirationCollections(mode).map(idea => ({
    id: `suggest-${idea.id}`,
    queryLead: idea.queryLead,
    recent: false,
    previewItems: idea.previewItems,
    search: normalizeSearch({
      mode,
      propertyType: 'apartment',
      criteria: [],
      minBudget: 0,
      area: idea.area,
      areas: [idea.area],
      address: '',
      beds: idea.beds,
      budget: idea.budget,
      note: translate(idea.note),
      ideaLabel: idea.queryLead,
      fromIdea: true,
    }),
  }));
}
