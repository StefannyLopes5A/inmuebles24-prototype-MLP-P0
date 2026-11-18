import {DEMO_CITY_AREAS} from './data.js';

/** Real catalog covers that show a house front. The captured set is CDMX, so each city borrows a different facade. */
const CITY_FRONTS = {
  cdmx: '/assets/listings/sets/146481212/01.jpg',
  gdl: '/assets/listings/sets/147062385/01.jpg',
  mty: '/assets/listings/sets/150928014/01.jpg',
  pue: '/assets/listings/sets/148473080/01.jpg',
  qro: '/assets/listings/sets/151293636/01.jpg',
  cun: '/assets/listings/sets/150280233/01.jpg',
};

function sampleArea(dataKey, label) {
  if (dataKey === 'cdmx') return 'Roma Norte';
  const areas = DEMO_CITY_AREAS[dataKey];
  if (areas?.length) return areas[0];
  return label;
}

/** Figma 12846:67234 · local demo destinations (search uses a representative colonia). */
export const POPULAR_HOME_CITIES = [
  {id: 'cdmx', label: 'Ciudad de México', dataKey: 'cdmx', image: CITY_FRONTS.cdmx},
  {id: 'gdl', label: 'Guadalajara', dataKey: 'Jalisco', image: CITY_FRONTS.gdl},
  {id: 'mty', label: 'Monterrey', dataKey: 'Nuevo León', image: CITY_FRONTS.mty},
  {id: 'pue', label: 'Puebla', dataKey: 'Puebla', image: CITY_FRONTS.pue},
  {id: 'qro', label: 'Querétaro', dataKey: 'Querétaro', image: CITY_FRONTS.qro},
  {id: 'cun', label: 'Cancún', dataKey: 'Quintana Roo', image: CITY_FRONTS.cun},
].map(city => ({...city, sampleArea: sampleArea(city.dataKey === 'cdmx' ? 'cdmx' : city.dataKey, city.label)}));

export const CITY_EXPLORE_LINKS = [
  {id: 'houses-buy', propertyType: 'house', mode: 'buy', beds: 2},
  {id: 'apartments-buy', propertyType: 'apartment', mode: 'buy', beds: 2},
  {id: 'houses-rent', propertyType: 'house', mode: 'rent', beds: 2},
  {id: 'apartments-rent', propertyType: 'apartment', mode: 'rent', beds: 2},
  {id: 'studios-rent', propertyType: 'apartment', mode: 'rent', beds: 1},
];

export function cityLinkBudget(mode) {
  return mode === 'rent' ? 28_000 : 7_500_000;
}