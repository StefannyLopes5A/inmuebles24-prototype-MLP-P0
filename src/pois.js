import collection from './data/pois.json' with {type: 'json'};
import {CITY_CATEGORIES, NEARBY_RADIUS_M, POI_CATEGORIES, POI_CATEGORY} from './poiCategories.js';

export * from './poiCategories.js';

const ALL = (collection.features || []).filter(feature =>
  POI_CATEGORY[feature?.properties?.categoria] && Array.isArray(feature?.geometry?.coordinates));

const BY_AREA = new Map();
for (const feature of ALL) {
  for (const area of feature.properties.areas || []) {
    if (!BY_AREA.has(area)) BY_AREA.set(area, []);
    BY_AREA.get(area).push(feature);
  }
}

/** Area membership for counts around a colonia. The map itself does not use this to hide points. */
export function poiScope(search, override) {
  const names = override ? [override] : (search?.areas || []).filter(name => name && name !== 'Ambas zonas');
  if (!names.length) return {kind: 'city', names: [], key: 'city'};
  return {kind: 'areas', names, key: `areas:${names.join('|')}`};
}

export function scopeCategories(scope) {
  return scope?.kind === 'city' ? CITY_CATEGORIES : POI_CATEGORIES.map(category => category.id);
}

function scopeFeatures(scope) {
  if (scope?.kind !== 'areas') return ALL.filter(feature => CITY_CATEGORIES.includes(feature.properties.categoria));
  if (scope.names.length === 1) return BY_AREA.get(scope.names[0]) || [];
  const seen = new Set();
  return scope.names.flatMap(name => BY_AREA.get(name) || []).filter(feature => {
    if (seen.has(feature.properties.id)) return false;
    seen.add(feature.properties.id);
    return true;
  });
}

/** Every catalog point in the active categories. Neighborhoods and the city selector do not narrow this set. */
export function poisFor(_scope, categories) {
  const active = new Set(categories || []);
  return ALL.filter(feature => active.has(feature.properties.categoria));
}

/** How many catalog points each category has. The map badges use this, not the selected areas. */
export function catalogCounts() {
  const counts = Object.fromEntries(POI_CATEGORIES.map(category => [category.id, 0]));
  for (const feature of ALL) {
    if (feature.properties.categoria in counts) counts[feature.properties.categoria] += 1;
  }
  return counts;
}

export function categoryCounts(scope) {
  const counts = Object.fromEntries(scopeCategories(scope).map(id => [id, 0]));
  for (const feature of scopeFeatures(scope)) {
    if (feature.properties.categoria in counts) counts[feature.properties.categoria] += 1;
  }
  return counts;
}

function meters([lng1, lat1], [lng2, lat2]) {
  const dLat = (lat1 - lat2) * 111320;
  const dLng = (lng1 - lng2) * 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

/** Closest points to `center`, nearest first, within `radius` meters. */
export function nearbyPois(center, features, {radius = NEARBY_RADIUS_M, limit = Infinity} = {}) {
  if (!center) return [];
  return features
    .map(feature => ({feature, meters: meters(center, feature.geometry.coordinates)}))
    .filter(item => item.meters <= radius)
    .sort((a, b) => a.meters - b.meters || a.feature.properties.id.localeCompare(b.feature.properties.id))
    .slice(0, limit)
    .map(({feature, meters: distance}) => ({...feature, properties: {...feature.properties, meters: Math.round(distance)}}));
}

/** Everything around a selected home, from any area of the catalog, for the active categories. */
export function poisNear(center, categories, options) {
  const active = new Set(categories || []);
  return nearbyPois(center, ALL.filter(feature => active.has(feature.properties.categoria)), options);
}

export function nearbyCounts(center, options) {
  const counts = Object.fromEntries(POI_CATEGORIES.map(category => [category.id, 0]));
  for (const feature of nearbyPois(center, ALL, options)) counts[feature.properties.categoria] += 1;
  return counts;
}

const WALK_M_PER_MIN = 80;
export const walkMinutes = distance => Math.max(1, Math.round(distance / WALK_M_PER_MIN));

function uniqueByName(features) {
  const seen = new Set(), unique = [];
  for (const feature of features) {
    if (seen.has(feature.properties.name)) continue;
    seen.add(feature.properties.name);
    unique.push({id: feature.properties.id, name: feature.properties.name, minutes: walkMinutes(feature.properties.meters)});
  }
  return unique;
}

/**
 * Places per category for the "Cerca de ti" card, on the same base as the map filters: every point of
 * `area` when given, otherwise the points within `radius` of `center`. `count` counts points like the
 * filters do; `items` lists the closest names to `center`, repeated names once. With nothing in the base,
 * `closest` is the nearest one anywhere within `reach`.
 */
export function placesAround(center, categories, {area, radius = NEARBY_RADIUS_M, limit = 5, reach = 2000} = {}) {
  if (!center) return null;
  const pool = area ? BY_AREA.get(area) || [] : ALL;
  const byCategory = Object.fromEntries(categories.map(categoria => {
    const own = pool.filter(feature => feature.properties.categoria === categoria);
    const base = nearbyPois(center, own, {radius: area ? Infinity : radius});
    const closest = base.length ? null
      : uniqueByName(nearbyPois(center, ALL.filter(feature => feature.properties.categoria === categoria), {radius: reach, limit: 1}))[0] || null;
    return [categoria, {count: base.length, items: uniqueByName(base).slice(0, limit), closest}];
  }));
  return {...byCategory, base: area ? {area} : {radius}};
}

const RANK = Object.fromEntries(POI_CATEGORIES.map((category, index) => [category.id, index]));

export function poiCollection(features) {
  return {type: 'FeatureCollection', features: features.map(feature => {
    const {id, name, categoria, meters: distance} = feature.properties;
    return {
      type: 'Feature',
      properties: {id, name, categoria, minzoom: POI_CATEGORY[categoria].minzoom, rank: RANK[categoria], ...(distance != null ? {meters: distance} : {})},
      geometry: feature.geometry,
    };
  })};
}
