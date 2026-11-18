import {insightListings, insightMode, nearbyAreaPrices, regionArea} from './priceInsights.js';
import {matchingHomes, normalizeSearch, parkingSpots} from './journey.js';
import {CRITERIA, matchesCriteria} from './searchCriteria.js';
import {homes as catalog, listingPrice} from './data.js';

/** Each related-search column shows at least this many links. */
export const MIN_RELATED_LINKS = 5;

const publishedCounts = (listings, key, minimum = 1) => [...new Set(listings.map(home => home[key]).filter(count => count >= minimum))].sort((a, b) => a - b);
const publishedParking = listings => [...new Set(listings.map(parkingSpots).filter(count => count > 0))].sort((a, b) => a - b);
const publishedCriteria = listings => CRITERIA.filter(item => listings.some(home => matchesCriteria(home, [item.id]))).map(item => item.id);

/**
 * Related searches for the results page (Figma 12874:36444), on the same block as the home links.
 * Bedrooms, parking and nearby colonias come from the catalog. A short colonia borrows the same
 * kind of published fact from the nearest colonias so every column has at least five links.
 */
export function relatedSearches(search, inventory = catalog) {
  const area = regionArea(search, inventory);
  if (!area) return null;
  const listings = insightListings({...search, areas: [area]}, inventory);
  if (!listings.length) return null;
  const current = normalizeSearch(search);
  const beds = publishedCounts(listings, 'beds').slice(0, MIN_RELATED_LINKS);
  const parking = publishedParking(listings);
  const neighbors = nearbyAreaPrices({...search, areas: [area]}, {limit: 16, inventory}).filter(row => !row.current);
  const nearby = neighbors.slice(0, MIN_RELATED_LINKS).map(row => row.area);
  const traits = fillTraits(area, listings, neighbors, search, inventory);
  const amenities = fillAmenities(area, listings, neighbors, search, inventory);
  return {
    area, mode: insightMode(search), house: ['house', 'condominium'].includes(current.propertyType),
    count: listings.length, card: listings.find(home => home.image) || listings[0], beds, parking, nearby, traits, amenities,
  };
}

function fillTraits(area, listings, neighbors, search, inventory) {
  const links = [];
  const push = (kind, count, place) => {
    const id = `${kind}-${count}-${place}`;
    if (links.some(item => item.id === id)) return;
    const changes = {area: place, areas: [place], ...(kind === 'baths' ? {baths: count} : {beds: count})};
    links.push({id, kind, count, area: place, changes});
  };
  for (const count of publishedCounts(listings, 'beds')) push('beds', count, area);
  for (const count of publishedCounts(listings, 'baths', 2)) push('baths', count, area);
  for (const row of neighbors) {
    if (links.length >= MIN_RELATED_LINKS) break;
    const homes = insightListings({...search, areas: [row.area]}, inventory);
    for (const count of publishedCounts(homes, 'beds')) {
      if (links.length >= MIN_RELATED_LINKS) break;
      push('beds', count, row.area);
    }
    for (const count of publishedCounts(homes, 'baths', 2)) {
      if (links.length >= MIN_RELATED_LINKS) break;
      push('baths', count, row.area);
    }
  }
  return links;
}

function fillAmenities(area, listings, neighbors, search, inventory) {
  const links = [];
  const push = item => {
    if (links.some(current => current.id === item.id)) return;
    links.push(item);
  };
  const take = (homes, place) => {
    for (const count of publishedParking(homes)) {
      if (links.length >= MIN_RELATED_LINKS) return;
      push({id: `parking-${count}-${place}`, kind: 'parking', count, area: place, changes: {area: place, areas: [place], criteria: [`text:${count} estac`]}});
    }
    for (const criterion of publishedCriteria(homes)) {
      if (links.length >= MIN_RELATED_LINKS) return;
      push({id: `criterion-${criterion}-${place}`, kind: 'criterion', criterion, area: place, changes: {area: place, areas: [place], criteria: [criterion]}});
    }
  };
  take(listings, area);
  for (const row of neighbors) {
    if (links.length >= MIN_RELATED_LINKS) break;
    take(insightListings({...search, areas: [row.area]}, inventory), row.area);
  }
  return links;
}

/** The search a related link runs: the named colonia and fact, without the previous size, place or type narrowing. */
export function relatedLinkSearch(search, changes = {}) {
  const current = normalizeSearch(search);
  return normalizeSearch({
    ...current,
    criteria: [],
    address: '',
    parking: 0,
    baths: 1,
    beds: 1,
    minSize: 0,
    maxSize: 0,
    minLot: 0,
    maxLot: 0,
    minBudget: 0,
    tour3d: false,
    places: undefined,
    propertyType: 'apartment',
    ...changes,
    propertyType: 'apartment',
  });
}

/** Raises the budget only when the listing behind the link costs more than the current search. */
export function relatedLinkChanges(search, changes = {}) {
  const openBudget = insightMode(search) === 'rent' ? 500_000 : 500_000_000;
  const hits = matchingHomes(relatedLinkSearch(search, {...changes, budget: openBudget})).filter(home => !home.development);
  const needed = hits.reduce((lowest, home) => Math.min(lowest, listingPrice(home)), Infinity);
  const budget = Number.isFinite(needed) ? Math.max(normalizeSearch(search).budget, needed) : normalizeSearch(search).budget;
  return relatedLinkSearch(search, {...changes, budget});
}
