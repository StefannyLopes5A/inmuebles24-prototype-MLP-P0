import {homes as catalog} from './data.js';
import {homeCoordinates} from './mapLocations.js';
import {walkDistance} from './mapWidgets.js';
import {compareReading} from './compareReading.js';
import {similarListings} from './listingStory.js';

const COLUMN_LIMIT = 8;

/** Parking only when the ad itself publishes it. A missing mention is not zero. */
export function publishedParking(home) {
  const match = String(home?.features || '').match(/(\d+)\s*estac/);
  return match ? Number(match[1]) : null;
}

/** The street line, without the colonia the address repeats after the comma. */
export function streetLine(home) {
  const street = String(home?.street || '').split(',')[0].trim();
  return street || null;
}

/** This listing first, then the closest same-operation ads. Developments stay out: their price is "desde". */
export function similarPriceHomes(home, pool = catalog) {
  if (!home || home.development) return [];
  const others = similarListings(home, pool, COLUMN_LIMIT - 1).filter(item => !item.development);
  return others.length ? [home, ...others] : [];
}

/**
 * One column per home. Price per m² and the zone bar come from the same reading as the favorites comparison.
 * Distance is from this listing's approximate pin. Unknown catalog fields stay null.
 */
export function similarPriceRows(home, pool = catalog) {
  const homes = similarPriceHomes(home, pool);
  if (!homes.length) return [];
  const origin = homeCoordinates(home);
  const reading = compareReading(homes, 'es-MX', pool);
  const rows = reading.cards.map(card => {
    const meters = card.home.id === home.id ? 0 : Math.max(10, Math.round(walkDistance(origin, homeCoordinates(card.home)) / 10) * 10);
    return {
      home: card.home,
      current: card.home.id === home.id,
      ppm2: card.ppm2,
      delta: card.delta,
      band: card.band,
      position: card.position,
      best: card.home.id === reading.best.price,
      meters,
      size: card.home.size >= 20 ? card.home.size : null,
      beds: card.home.beds ?? null,
      baths: card.home.baths ?? null,
      parking: publishedParking(card.home),
      street: streetLine(card.home),
      area: card.home.area || null,
    };
  });
  // The best price leads the table; the other columns keep their order (this listing, then the closest ads).
  return [...rows.filter(row => row.best), ...rows.filter(row => !row.best)];
}
