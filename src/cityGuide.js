import {DEMO_CITY_AREAS} from './data.js';

/**
 * Landmark photos from the city-guide design export. Each file is the square
 * JPEG embedded in that SVG, in the same left-to-right, top-to-bottom order.
 * cdmx — Palacio de Bellas Artes
 * guadalajara — Catedral de Guadalajara
 * monterrey — Santa Lucía and Cerro de la Silla
 * puebla — historic center
 * tijuana — CECUT
 * toluca — Cosmovitral
 * leon — Catedral Basílica
 * juarez — Monumento a la Mexicanidad
 */
const CARDS = [
  {id: 'cdmx', label: 'Ciudad de México', kicker: 'Explora', image: '/assets/city-guide/cdmx.jpg', focus: 'center', dataKey: 'cdmx', area: 'Roma Norte'},
  {id: 'gdl', label: 'Guadalajara', kicker: 'Explora', image: '/assets/city-guide/guadalajara.jpg', focus: 'center', dataKey: 'Jalisco'},
  {id: 'mty', label: 'Monterrey', kicker: 'Explora', image: '/assets/city-guide/monterrey.jpg', focus: 'center', dataKey: 'Nuevo León'},
  {id: 'pue', label: 'Puebla', kicker: 'Explora', image: '/assets/city-guide/puebla.jpg', focus: 'center', dataKey: 'Puebla'},
  {id: 'tij', label: 'Tijuana', kicker: 'Descubre', image: '/assets/city-guide/tijuana.jpg', focus: 'center'},
  {id: 'tol', label: 'Toluca', kicker: 'Viaja a', image: '/assets/city-guide/toluca.jpg', focus: 'center', dataKey: 'Edo. de México', area: 'Toluca Centro'},
  {id: 'leon', label: 'León', kicker: 'Visita', image: '/assets/city-guide/leon.jpg', focus: 'center'},
  {id: 'juarez', label: 'Ciudad Juárez', kicker: 'Relájate en', image: '/assets/city-guide/juarez.jpg', focus: 'center'},
];

function sampleArea(city) {
  if (city.area) return city.area;
  const areas = city.dataKey ? DEMO_CITY_AREAS[city.dataKey] : null;
  return areas?.[0] || '';
}

export const CITY_GUIDE = CARDS.map(city => ({...city, sampleArea: sampleArea(city)}));
