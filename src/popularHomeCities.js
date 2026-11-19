import {DEMO_CITY_AREAS, homes} from './data.js';

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

/**
 * Eight searches per city. `photo` says which catalog photo stands for the link: a house front of the city, or the
 * cover of a catalog listing of that kind (the catalog is CDMX only, so each city borrows a different one).
 */
export const CITY_EXPLORE_LINKS = [
  {id: 'houses-buy', propertyType: 'house', mode: 'buy', beds: 2, photo: {front: 0}},
  {id: 'apartments-buy', propertyType: 'apartment', mode: 'buy', beds: 2, photo: {mode: 'buy', beds: [2, 2]}},
  {id: 'houses-rent', propertyType: 'house', mode: 'rent', beds: 2, photo: {front: 1}},
  {id: 'apartments-rent', propertyType: 'apartment', mode: 'rent', beds: 2, photo: {mode: 'rent', beds: [2, 2]}},
  {id: 'studios-rent', propertyType: 'apartment', mode: 'rent', beds: 1, photo: {mode: 'rent', beds: [0, 1]}},
  {id: 'family-buy', propertyType: 'apartment', mode: 'buy', beds: 3, photo: {mode: 'buy', beds: [3, 9]}},
  {id: 'premium-buy', propertyType: 'apartment', mode: 'buy', beds: 2, budget: 15_000_000, photo: {mode: 'buy', title: /penthouse|pent\b|ph\b|loft|roof/i}},
  {id: 'budget-rent', propertyType: 'apartment', mode: 'rent', beds: 1, budget: 15_000, photo: {mode: 'rent', beds: [1, 2], cheap: true}},
];

const fronts = Object.values(CITY_FRONTS);
const rentPrice = home => home.rent ?? home.price ?? 0;

/** The photo that stands for one link in one city; the same city and link always give the same picture. */
export function cityLinkImage(city, link) {
  const index = POPULAR_HOME_CITIES.findIndex(item => item.id === city.id);
  const {photo} = link;
  if (photo.front != null) return fronts[(Math.max(0, index) + photo.front) % fronts.length];
  let pool = homes.filter(home => home.mode === photo.mode && home.image
    && (!photo.beds || (home.beds >= photo.beds[0] && home.beds <= photo.beds[1]))
    && (!photo.title || photo.title.test(home.title || '')));
  if (photo.cheap) pool = [...pool].sort((a, b) => rentPrice(a) - rentPrice(b)).slice(0, 12);
  if (!pool.length) return city.image;
  return pool[(Math.max(0, index) * 3 + CITY_EXPLORE_LINKS.indexOf(link)) % pool.length].image;
}

export function cityLinkBudget(mode) {
  return mode === 'rent' ? 28_000 : 7_500_000;
}