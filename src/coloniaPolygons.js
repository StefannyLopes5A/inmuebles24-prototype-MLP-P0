import collection from './data/colonias.json' with {type: 'json'};
import {NEIGHBORHOOD_CENTROIDS} from './mapLocations.js';

const BY_NAME = new Map();
for (const feature of collection.features || []) {
  const name = feature?.properties?.name;
  if (name) BY_NAME.set(name, feature);
}

export function placeFeature(name) {
  return name ? BY_NAME.get(name) || null : null;
}

export function placeNivel(name) {
  return placeFeature(name)?.properties?.nivel || null;
}

function walkRings(geometry, visit) {
  if (!geometry) return;
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates || []) visit(ring);
    return;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates || []) {
      for (const ring of polygon) visit(ring);
    }
  }
}

export function featureBounds(feature) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  walkRings(feature?.geometry, ring => {
    for (const point of ring || []) {
      const [lng, lat] = point;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      west = Math.min(west, lng); east = Math.max(east, lng);
      south = Math.min(south, lat); north = Math.max(north, lat);
    }
  });
  if (!Number.isFinite(west)) return null;
  return [[west, south], [east, north]];
}

export function boundsCenter(bounds) {
  if (!bounds) return null;
  const [[west, south], [east, north]] = bounds;
  return [(west + east) / 2, (south + north) / 2];
}

function ringContains([lng, lat], ring) {
  if (!ring || ring.length < 4) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (crosses) inside = !inside;
  }
  return inside;
}

function polygonContains(point, rings) {
  if (!rings?.length || !ringContains(point, rings[0])) return false;
  for (const hole of rings.slice(1)) if (ringContains(point, hole)) return false;
  return true;
}

export function featureContains(feature, point) {
  const geometry = feature?.geometry;
  if (!geometry || !point) return false;
  if (geometry.type === 'Polygon') return polygonContains(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(rings => polygonContains(point, rings));
  return false;
}

export function coloniaContains(name, point) {
  const feature = placeFeature(name);
  return feature ? featureContains(feature, point) : false;
}

function bboxArea(bounds) {
  if (!bounds) return Infinity;
  const [[west, south], [east, north]] = bounds;
  return (east - west) * (north - south);
}

/** Prefer a colonia ring that contains the point; ignore alcaldía here so pan stays at barrio level. */
export function pickColonia(center, previous) {
  const hits = [];
  for (const [name, feature] of BY_NAME) {
    if (feature.properties?.nivel !== 'colonia') continue;
    if (featureContains(feature, center)) hits.push({name, area: bboxArea(featureBounds(feature))});
  }
  if (hits.length) {
    hits.sort((a, b) => a.area - b.area || a.name.localeCompare(b.name, 'es'));
    if (previous && hits.some(item => item.name === previous)) return previous;
    return hits[0].name;
  }
  return nearestColoniaName(center, previous);
}

function nearestColoniaName(center, previous) {
  let best = null, bestDistance = Infinity;
  for (const [name, point] of Object.entries(NEIGHBORHOOD_CENTROIDS)) {
    const next = hypotMeters(center, point);
    if (next < bestDistance) {best = name; bestDistance = next;}
  }
  if (!previous || previous === best) return best;
  const previousPoint = NEIGHBORHOOD_CENTROIDS[previous];
  if (!previousPoint) return best;
  const previousDistance = hypotMeters(center, previousPoint);
  if (bestDistance * 1.35 < previousDistance && bestDistance < previousDistance * 0.85) return best;
  return previous;
}

function hypotMeters(a, b) {
  const [lng1, lat1] = a, [lng2, lat2] = b;
  const dLat = (lat1 - lat2) * 111320;
  const dLng = (lng1 - lng2) * 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

export function searchPlace(search) {
  const areas = search?.areas || [];
  if (!areas.length) return {kind: 'city'};
  const name = areas[0];
  const feature = placeFeature(name);
  if (feature) return {kind: feature.properties.nivel, name, feature};
  return {kind: 'listings', name};
}

export {collection as COLONIAS};
