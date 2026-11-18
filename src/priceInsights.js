import {homes as catalog, listingPrice} from './data.js';
import {pricePerM2, zonePricePerM2} from './compareReading.js';
import {neighborhoodCentroid} from './mapLocations.js';
import {normalizeSearch} from './journey.js';

/** Price insights only know the two catalog operations; developments and auctions read as purchases. */
export const insightMode = search => normalizeSearch(search).mode === 'rent' ? 'rent' : 'buy';

const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
};

/** Catalog listings behind the price card: the search's operation and areas, never developments. */
export function insightListings(search, inventory = catalog) {
  const {areas} = normalizeSearch(search);
  const mode = insightMode(search);
  return inventory.filter(home => !home.development && home.mode === mode
    && Number.isFinite(listingPrice(home)) && (!areas.length || areas.includes(home.area)));
}

export const countInRange = (listings, min, max) => listings.filter(home => {
  const price = listingPrice(home);
  return price >= min && price <= max;
}).length;

const distance = ([lngA, latA], [lngB, latB]) => Math.hypot((lngA - lngB) * Math.cos(latA * Math.PI / 180), latA - latB);

/**
 * Median price per catalog area nearest to the search's first area (the searched areas lead).
 * `metric` is `total` (median listing price) or `m2` (median price per m², falling back to the prototype zone figure).
 */
export function nearbyAreaPrices(search, {metric = 'total', limit = 7, inventory = catalog} = {}) {
  const {areas} = normalizeSearch(search);
  const mode = insightMode(search);
  const byArea = new Map();
  for (const home of inventory) {
    if (home.development || home.mode !== mode || !Number.isFinite(listingPrice(home))) continue;
    byArea.set(home.area, [...(byArea.get(home.area) || []), home]);
  }
  const anchor = areas.length ? neighborhoodCentroid({area:areas[0]}) : null;
  const rows = [...byArea].map(([area, listings]) => {
    const value = metric === 'm2'
      ? median(listings.map(pricePerM2)) ?? zonePricePerM2({mode, area}, inventory)
      : median(listings.map(listingPrice));
    return {area, value, count:listings.length, current:areas.includes(area),
      distance:anchor ? distance(anchor, neighborhoodCentroid({area})) : -listings.length};
  }).filter(row => Number.isFinite(row.value));
  rows.sort((a, b) => Number(b.current) - Number(a.current) || a.distance - b.distance || a.area.localeCompare(b.area, 'es'));
  return rows.slice(0, limit).map(({distance: _, ...row}) => row);
}

/** The colonia the region section talks about: the first searched one, else the operation's busiest catalog area. */
export function regionArea(search, inventory = catalog) {
  const {areas} = normalizeSearch(search);
  if (areas.length) return areas[0];
  const counts = new Map();
  for (const home of insightListings(search, inventory)) counts.set(home.area, (counts.get(home.area) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0]?.[0] || null;
}

/**
 * Median, highest and lowest listing of a colonia for the searched bedrooms.
 * When no listing there has enough bedrooms, every listing of the colonia counts and `beds` is null.
 */
export function regionSnapshot(search, inventory = catalog) {
  const area = regionArea(search, inventory);
  if (!area) return null;
  const all = insightListings({...search, areas:[area]}, inventory);
  if (!all.length) return null;
  const {beds} = normalizeSearch(search);
  const fitting = all.filter(home => home.beds >= beds);
  const listings = fitting.length ? fitting : all;
  const byPrice = [...listings].sort((a, b) => listingPrice(a) - listingPrice(b) || a.id.localeCompare(b.id));
  const medianPrice = median(listings.map(listingPrice));
  const representative = [...byPrice].sort((a, b) => Math.abs(listingPrice(a) - medianPrice) - Math.abs(listingPrice(b) - medianPrice))[0];
  return {
    area, beds:fitting.length ? beds : null, count:listings.length,
    median:medianPrice, medianPerM2:median(listings.map(pricePerM2)),
    lowest:byPrice[0], highest:byPrice.at(-1), representative,
    updatedAt:listings.map(home => home.capturedAt).filter(Boolean).sort().at(-1) || null,
  };
}

/** Distinct listing photos from the colonia first, then from the nearest colonias, for the region preview fan. */
export function regionPhotos(search, {limit = 4, inventory = catalog} = {}) {
  const area = regionArea(search, inventory);
  const mode = insightMode(search);
  const order = [area, ...nearbyAreaPrices({...search, areas:area ? [area] : []}, {limit:20, inventory}).map(row => row.area)];
  const picked = [], images = new Set();
  for (const name of new Set(order)) {
    for (const home of inventory) {
      if (picked.length >= limit) return picked;
      if (home.area !== name || home.mode !== mode || home.development || !home.image || images.has(home.image)) continue;
      images.add(home.image); picked.push(home);
    }
  }
  return picked;
}
