import {homes, areas} from './data.js';
import {foldSearchText} from './homeSearchModel.js';
import collection from './data/pois.json' with {type: 'json'};

const UNIVERSITY = /\buniversidad\b|\buniversidade\b|\buniversity\b|\bunam\b|\bpolitecnico\b/;
const GROUP_ORDER = {state:0, city:1, colonia:2, street:3, university:4, school:5, hospital:6, metro:7, poi:8};
const GROUP_ALIASES = {
  school:['escuela', 'escola', 'colegio'],
  university:['universidad', 'universidade'],
  hospital:['hospital'],
  metro:['metro', 'estacion de metro'],
  poi:['punto de interes', 'ponto de interesse'],
};
const KNOWN = new Set(areas.filter(area => area !== 'Ambas zonas'));
const INDEX = new Map();

function add(place) {
  const key = `${place.kind}~${place.id}`;
  if (INDEX.has(key)) return;
  const labelFold = foldSearchText(place.label);
  INDEX.set(key, {...place, key, labelFold, folded:`${labelFold} ${foldSearchText([...(place.aliases || []), ...(GROUP_ALIASES[place.group] || [])].join(' '))}`.trim()});
}

add({kind:'state', id:'cdmx', label:'Ciudad de México', group:'state', aliases:['cdmx', 'distrito federal']});
add({kind:'city', id:'cdmx', label:'Ciudad de México', group:'city', aliases:['cdmx', 'df']});
for (const area of KNOWN) add({kind:'colonia', id:area, label:area, group:'colonia', area});

const seenStreets = new Set();
for (const home of homes) {
  if (!home.street || seenStreets.has(home.street)) continue;
  seenStreets.add(home.street);
  add({kind:'street', id:home.street, label:home.street, group:'street', area:KNOWN.has(home.area) ? home.area : '', areas:KNOWN.has(home.area) ? [home.area] : []});
}

for (const feature of collection.features || []) {
  const name = feature?.properties?.name;
  const category = feature?.properties?.categoria;
  if (!name || !feature?.properties?.id) continue;
  const folded = foldSearchText(name);
  const group = category === 'metro' ? 'metro'
    : category === 'hospital' ? 'hospital'
    : category === 'escola' && UNIVERSITY.test(folded) ? 'university'
    : category === 'escola' ? 'school'
    : 'poi';
  const catalogAreas = (feature.properties.areas || []).filter(area => KNOWN.has(area));
  add({
    kind:group, id:feature.properties.id, label:name, group,
    area:catalogAreas.length === 1 ? catalogAreas[0] : '',
    areas:catalogAreas,
    ...(group === 'poi' ? {category} : {}),
  });
}

const PLACES = [...INDEX.values()];
const GENERIC_LABELS = new Set(['casa', 'departamento', 'apartamento', 'oficina', 'terreno', 'renta', 'compra', 'local', 'bodega']);

function phraseAt(haystack, needle) {
  if (!needle) return -1;
  let from = 0;
  while (from <= haystack.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return -1;
    const before = at === 0 || !/[a-z0-9]/.test(haystack[at - 1]);
    const after = at + needle.length === haystack.length || !/[a-z0-9]/.test(haystack[at + needle.length]);
    if (before && after) return at;
    from = at + 1;
  }
  return -1;
}

function present(place) {
  const {folded, aliases, labelFold, ...rest} = place;
  return rest;
}

/** A city or state is the whole catalog only when the text names nothing narrower. */
export function focusPlaces(places) {
  const narrow = places.filter(place => place.kind !== 'city' && place.kind !== 'state');
  return narrow.length ? narrow : places;
}

let PLACE_TERMS = null;
function placeTerms() {
  if (PLACE_TERMS) return PLACE_TERMS;
  const byLength = new Map();
  for (const place of PLACES) {
    const terms = new Set([place.labelFold]);
    for (const alias of place.aliases || []) {
      const foldedAlias = foldSearchText(alias);
      if (foldedAlias.length >= 5) terms.add(foldedAlias);
    }
    for (const term of terms) {
      if (term.length < 5 || GENERIC_LABELS.has(term)) continue;
      const bucket = byLength.get(term.length) || [];
      bucket.push({place, term});
      byLength.set(term.length, bucket);
    }
  }
  PLACE_TERMS = byLength;
  return byLength;
}

/** Insert, delete, substitute and transpose. Stops once every edit exceeds `limit`. */
function editDistance(a, b, limit) {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > limit) return limit + 1;
  let older = new Uint16Array(n + 1);
  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);
  for (let column = 0; column <= n; column += 1) prev[column] = column;
  for (let row = 1; row <= m; row += 1) {
    curr[0] = row;
    let best = curr[0];
    for (let column = 1; column <= n; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      let value = Math.min(prev[column] + 1, curr[column - 1] + 1, prev[column - 1] + cost);
      if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) value = Math.min(value, older[column - 2] + 1);
      curr[column] = value;
      if (value < best) best = value;
    }
    if (best > limit) return limit + 1;
    [older, prev, curr] = [prev, curr, older];
  }
  return prev[n];
}

/** A one-letter word being typed ("casa c") is never a misspelling of another short word ("casa q"). */
function typoIsWholeWord(typed, term) {
  const typedWords = typed.split(' ');
  const termWords = term.split(' ');
  if (typedWords.length !== termWords.length) return true;
  return typedWords.every((word, index) => word === termWords[index] || word.length >= 4);
}

function fuzzyPlaceHits(folded, occupied) {
  const words = [...folded.matchAll(/[a-z0-9]+/g)].map(match => ({text:match[0], at:match.index, end:match.index + match[0].length}));
  const hits = [];
  const index = placeTerms();
  for (let size = 1; size <= 4; size += 1) {
    for (let start = 0; start + size <= words.length; start += 1) {
      const from = words[start].at;
      const to = words[start + size - 1].end;
      const typed = folded.slice(from, to);
      if (typed.length < 5 || occupied.some(span => from < span.end && span.at < to)) continue;
      const limit = typed.length >= 8 ? 2 : 1;
      let best = null;
      for (let length = typed.length - limit; length <= typed.length + limit; length += 1) {
        for (const entry of index.get(length) || []) {
          if (entry.term[0] !== typed[0] && entry.term[0] !== typed[1] && entry.term[1] !== typed[0]) continue;
          if (entry.term.startsWith(typed)) continue;
          const distance = editDistance(typed, entry.term, limit);
          if (distance < 1 || distance > limit) continue;
          if (!typoIsWholeWord(typed, entry.term)) continue;
          const rank = GROUP_ORDER[entry.place.group] ?? 9;
          const tied = best && distance === best.distance && rank === best.rank && entry.place.key !== best.place.key;
          if (!best || distance < best.distance || (distance === best.distance && rank < best.rank)) best = {place:entry.place, distance, rank, tie:false};
          else if (tied) best.tie = true;
        }
      }
      if (!best || best.tie) continue;
      hits.push({place:best.place, at:from, end:to});
    }
  }
  return hits;
}

/** Catalog places named in a description, including a close misspelling of the whole name. */
export function placeHits(text) {
  const folded = foldSearchText(String(text || ''));
  if (folded.length < 2) return [];
  const hits = [];
  for (const place of PLACES) {
    const needles = place.labelFold.length >= 4 && !GENERIC_LABELS.has(place.labelFold) ? [place.labelFold] : [];
    for (const alias of place.aliases || []) {
      const foldedAlias = foldSearchText(alias);
      if (foldedAlias.length >= 2) needles.push(foldedAlias);
    }
    for (const needle of needles) {
      const at = phraseAt(folded, needle);
      if (at < 0) continue;
      const before = folded.slice(0, at).trimEnd();
      const alias = (GROUP_ALIASES[place.group] || []).find(name => before.endsWith(name) && (before.length === name.length || !/[a-z0-9]/.test(before[before.length - name.length - 1] || '')));
      hits.push({place, at:alias ? before.length - alias.length : at, end:at + needle.length});
    }
  }
  hits.push(...fuzzyPlaceHits(folded, hits));
  hits.sort((a, b) => (b.end - b.at) - (a.end - a.at) || (a.place.kind === 'city' ? -1 : 0) - (b.place.kind === 'city' ? -1 : 0) || GROUP_ORDER[a.place.group] - GROUP_ORDER[b.place.group] || b.place.labelFold.length - a.place.labelFold.length);
  const used = [];
  const chosen = [];
  const seen = new Set();
  for (const hit of hits) {
    if (seen.has(hit.place.key) || used.some(span => hit.at < span.end && span.at < hit.end)) continue;
    seen.add(hit.place.key);
    used.push(hit);
    chosen.push({place:present(hit.place), at:hit.at, end:hit.end});
    if (chosen.length >= 8) break;
  }
  return chosen.sort((a, b) => a.at - b.at);
}

/** Catalog places named in a description. Longer names win when they overlap. */
export function placesInText(text) {
  return placeHits(text).map(hit => hit.place);
}

/** Text finds and manual chips share one list. An explicit city or state replaces narrower places. */
export function combinePlaces(detectedPlaces = [], extraPlaces = [], hiddenKeys = []) {
  const hidden = new Set(hiddenKeys);
  const extras = [];
  const seen = new Set();
  for (const place of extraPlaces) {
    if (!place?.key || hidden.has(place.key) || seen.has(place.key)) continue;
    seen.add(place.key);
    extras.push(place);
  }
  const fromText = [];
  for (const place of detectedPlaces) {
    if (!place?.key || hidden.has(place.key) || seen.has(place.key)) continue;
    seen.add(place.key);
    fromText.push(place);
  }
  const explicitBroad = extras.some(place => place.kind === 'city' || place.kind === 'state');
  const combined = explicitBroad
    ? [...fromText, ...extras].filter(place => place.kind === 'city' || place.kind === 'state')
    : [...fromText, ...extras];
  return combined.slice(0, 8);
}

export function resolvePlace(kind, id) {
  const place = INDEX.get(`${kind}~${id}`);
  if (!place) return null;
  const {folded, aliases, labelFold, ...rest} = place;
  return rest;
}

/** Places the bar can show: an explicit selection, or the colonia and street already in the search. */
export function visiblePlaces(search) {
  if (Array.isArray(search?.places)) return search.places.map(place => resolvePlace(place.kind, place.id)).filter(Boolean);
  const found = [];
  for (const area of search?.areas || []) {
    const place = resolvePlace('colonia', area);
    if (place) found.push(place);
  }
  if (search?.address) {
    const street = resolvePlace('street', search.address);
    if (street) found.push(street);
  }
  return found;
}

/** Colonias implied by the selection. A state or city alone means the whole catalog. A narrower place named with it still counts. */
export function areasFromPlaces(places) {
  const narrow = places.filter(place => place.kind !== 'city' && place.kind !== 'state');
  const source = narrow.length ? narrow : [];
  return [...new Set(source.flatMap(place => place.kind === 'colonia' ? [place.id] : place.areas || []))];
}

/** A single street can stay in the legacy address field. Several places match as a union instead. */
export function addressFromPlaces(places) {
  const streets = places.filter(place => place.kind === 'street');
  return streets.length === 1 && places.length === 1 ? streets[0].id : '';
}

export function placeCovers(home, place) {
  if (!place || !home) return false;
  if (place.kind === 'city' || place.kind === 'state') return true;
  if (place.kind === 'colonia') return home.area === place.id;
  if (place.kind === 'street') return foldSearchText(home.street) === foldSearchText(place.id);
  return Array.isArray(place.areas) && place.areas.includes(home.area);
}

/** Places to offer before anyone types: the city, then the colonias with the most listings. */
export function suggestedLocations(limit = 8) {
  const counts = new Map();
  for (const home of homes) {
    if (!KNOWN.has(home.area)) continue;
    counts.set(home.area, (counts.get(home.area) || 0) + 1);
  }
  const colonias = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .slice(0, Math.max(0, limit - 1))
    .map(([area]) => INDEX.get(`colonia~${area}`))
    .filter(Boolean)
    .map(present);
  const city = INDEX.get('city~cdmx');
  return [city ? present(city) : null, ...colonias].filter(Boolean).slice(0, limit);
}

/** Suggestions from the catalog only: the city, its colonias, listing streets and mapped places. */
export function searchLocations(query, limit = 8) {
  const folded = foldSearchText(String(query || '').trim());
  if (folded.length < 2) return [];
  const hits = [];
  for (const place of PLACES) {
    const at = place.labelFold.indexOf(folded);
    const aliasAt = at < 0 ? place.folded.indexOf(folded) : -1;
    if (at < 0 && aliasAt < 0) continue;
    const rank = at < 0 ? 2 : at === 0 || place.labelFold[at - 1] === ' ' ? 0 : 1;
    const boost = folded.length >= 4 && (GROUP_ALIASES[place.group] || []).some(alias => alias.startsWith(folded)) ? -1 : GROUP_ORDER[place.group];
    hits.push({place, rank, boost});
  }
  hits.sort((a, b) => a.rank - b.rank || a.boost - b.boost || a.place.label.localeCompare(b.place.label, 'es'));
  return hits.slice(0, limit).map(({place}) => present(place));
}
