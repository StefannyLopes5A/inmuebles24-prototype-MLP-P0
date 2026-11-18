import {NEIGHBORHOOD_CENTROIDS} from './mapLocations.js';
import {POI_CATEGORIES, poisNear, walkMinutes} from './pois.js';
import {regionArea} from './priceInsights.js';

/** City driving pace with traffic, about 24 km/h. Like walking, it is measured in a straight line from the colonia centre. */
const DRIVE_M_PER_MIN = 400;
const driveMinutes = distance => Math.max(1, Math.round(distance / DRIVE_M_PER_MIN));

export const PLACE_CATEGORIES = ['metro', 'escola', 'supermercado', 'comercio', 'parque', 'hospital', 'cafe', 'bar_restaurante'];

/**
 * Catalog points of interest around the centre of the searched colonia, for the results section from Figma 12883:42934.
 * `counts` covers every category within `radius`; `items` takes the nearest place of each active category in turn,
 * repeated names once, and lists them nearest first.
 */
export function placesNear(search, {categories = PLACE_CATEGORIES, radius = 1500, limit = 12} = {}) {
  const area = regionArea(search);
  const center = area && NEIGHBORHOOD_CENTROIDS[area];
  if (!center) return null;
  const around = poisNear(center, PLACE_CATEGORIES, {radius});
  const counts = Object.fromEntries(PLACE_CATEGORIES.map(id => [id, 0]));
  const queues = new Map(), seen = new Set();
  for (const {properties: {id, name, categoria, meters}} of around) {
    counts[categoria] += 1;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (!queues.has(categoria)) queues.set(categoria, []);
    queues.get(categoria).push({id, name, categoria, meters, walk: walkMinutes(meters), drive: driveMinutes(meters)});
  }
  const active = POI_CATEGORIES.map(category => category.id).filter(id => categories.includes(id) && queues.has(id));
  const items = [];
  for (let round = 0; items.length < limit && active.some(id => queues.get(id).length > round); round += 1) {
    for (const id of active) {
      const place = queues.get(id)[round];
      if (place && items.length < limit) items.push(place);
    }
  }
  items.sort((a, b) => a.meters - b.meters || a.id.localeCompare(b.id));
  return {area, counts, items};
}
