import {placesAround} from './pois.js';
import {neighborhoodCentroid} from './mapLocations.js';

/**
 * The name that stands for a colonia on its card: its park first, then its metro station, then the colonia itself.
 * Names come from the catalog's real points of interest (`pois.json`).
 */
export function regionLandmark(area, language = 'es-MX') {
  const center = neighborhoodCentroid({area});
  const found = center ? placesAround(center, ['parque', 'metro'], {area, limit: 1}) : null;
  const park = found?.parque?.items?.[0]?.name;
  if (park) return park;
  const station = found?.metro?.items?.[0]?.name;
  if (station) return `${language === 'pt-BR' ? 'Metrô' : 'Metro'} ${station}`;
  return area;
}
