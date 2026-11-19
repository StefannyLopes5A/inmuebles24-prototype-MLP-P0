/**
 * Places a buyer can pin on a listing: real catalog points, with the minutes from the home's approximate
 * position. Nothing is geocoded and nothing is saved; a listing holds three at a time.
 */
import {travelMinutes} from './compareReading.js';
import {nearbyPois, POI_CATEGORIES, POI_CATEGORY, poisFor} from './pois.js';

export const MAX_PLACES = 3;
export const SUGGEST_LIMIT = 8;

const ALL = poisFor(null, POI_CATEGORIES.map(category => category.id));
const NEAR_M = 8000;

const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function routeOf(id) {
  let value = 2166136261;
  for (const char of String(id)) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return (value >>> 0) % 1000 / 1000;
}

/** Metro time: a walk to the stop and a wait, then a ride slower than driving. */
function transitMinutes(meters, route) {
  const access = 3 + Math.round(route * 4);
  const ride = meters * (1.15 + 0.35 * route) / 420;
  return Math.max(1, access + Math.ceil(ride));
}

function trip(feature) {
  const meters = feature.properties.meters;
  const route = routeOf(feature.properties.id);
  return {
    id: feature.properties.id,
    name: feature.properties.name,
    categoria: feature.properties.categoria,
    coordinates: feature.geometry.coordinates,
    meters,
    minutes: {
      walk: travelMinutes(meters, 'walk', route),
      car: travelMinutes(meters, 'car', route),
      bike: travelMinutes(meters, 'bike', route),
      transit: transitMinutes(meters, route),
    },
  };
}

const toMeters = ([lng1, lat1], [lng2, lat2]) => Math.hypot((lat1 - lat2) * 111320,
  (lng1 - lng2) * 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180));

/** A place tapped on the map instead of searched: the same card, measured from the home. */
export function placeFromPoint(center, {id, name, categoria}, coordinates) {
  if (!center || !coordinates || !POI_CATEGORY[categoria]) return null;
  return trip({properties: {id, name, categoria, meters: Math.max(1, Math.round(toMeters(center, coordinates)))}, geometry: {coordinates}});
}

const blob = feature => {
  const label = POI_CATEGORY[feature.properties.categoria]?.label;
  return fold(`${feature.properties.name} ${label?.es || ''} ${label?.pt || ''}`);
};

/**
 * Suggestions for the travel field. An empty query offers the closest place of each kind, then the closest
 * overall. Typed text matches the name or the kind, accent-insensitive, nearest first.
 */
export function suggestPlaces(center, query = '', {limit = SUGGEST_LIMIT, exclude = []} = {}) {
  if (!center) return [];
  const q = fold(query.trim());
  const taken = new Set(exclude);
  const pool = q ? ALL.filter(feature => !taken.has(feature.properties.id) && blob(feature).includes(q)) : ALL;
  const nearest = nearbyPois(center, pool, {radius: q ? Infinity : NEAR_M, limit: q ? 24 : 60})
    .filter(feature => !taken.has(feature.properties.id));
  if (q) return nearest.slice(0, limit).map(trip);
  const picked = [];
  const seen = new Set();
  for (const feature of nearest) {
    if (seen.has(feature.properties.categoria)) continue;
    seen.add(feature.properties.categoria);
    picked.push(feature);
  }
  for (const feature of nearest) {
    if (picked.length >= limit) break;
    if (!picked.includes(feature)) picked.push(feature);
  }
  return picked.slice(0, limit).map(trip);
}
