import collection from './data/pois.json' with {type: 'json'};
import {isPoiPlace, resolvePlace} from './locationSearch.js';
import {homeCoordinates} from './mapLocations.js';

/**
 * Travel time to a point of interest. It is an estimate: the straight line from the listing's approximate position to the
 * point, at an average speed for each way of travelling. It is not a route, and the filter deck says so.
 */
export const COMMUTE_MODES = [
  ['walk', 'A pé', 'A pie', 4.5],
  ['transit', 'Transporte público', 'Transporte público', 15],
  ['drive', 'Carro', 'Auto', 22],
];
export const COMMUTE_MINUTES = [10, 15, 30, 45, 60];
export const DEFAULT_COMMUTE = {mode:'walk', minutes:15};

const COORDINATES = new Map((collection.features || []).map(feature => [feature.properties?.id, feature.geometry?.coordinates]));
const EARTH_METERS = 6_371_000;

export function poiCoordinates(place) {
  return isPoiPlace(place) ? COORDINATES.get(place.id) || null : null;
}

function distanceMeters([lngA, latA], [lngB, latB]) {
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(latB - latA), dLng = rad(lngB - lngA);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latA)) * Math.cos(rad(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_METERS * Math.asin(Math.sqrt(a));
}

/** Estimated minutes from a listing to the point, or null when the point has no position. */
export function commuteMinutes(home, place, mode) {
  const target = poiCoordinates(place);
  const speed = COMMUTE_MODES.find(([id]) => id === mode)?.[3];
  if (!target || !speed) return null;
  return distanceMeters(homeCoordinates(home), target) / 1000 / speed * 60;
}

/** A valid commute is a mapped point plus a known mode and time; anything else is dropped. */
export function normalizeCommute(value) {
  if (!value || typeof value !== 'object') return undefined;
  const place = resolvePlace(value.poi?.kind, value.poi?.id);
  if (!place || !isPoiPlace(place) || !poiCoordinates(place)) return undefined;
  const mode = COMMUTE_MODES.some(([id]) => id === value.mode) ? value.mode : DEFAULT_COMMUTE.mode;
  const minutes = COMMUTE_MINUTES.includes(Number(value.minutes)) ? Number(value.minutes) : DEFAULT_COMMUTE.minutes;
  return {poi:place, mode, minutes};
}

export function commuteFits(home, commute) {
  if (!commute) return true;
  const minutes = commuteMinutes(home, commute.poi, commute.mode);
  return minutes !== null && minutes <= commute.minutes;
}
