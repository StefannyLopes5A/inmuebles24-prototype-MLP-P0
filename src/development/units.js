import {SIDES} from './buildingConfig.js';
import {MORA_ANSWERS, TYPOLOGIES, UNITS, unitById} from './torreOlmo.js';

export const DEFAULT_FILTERS = Object.freeze({beds:null, minPrice:null, maxPrice:null, views:[], floor:null, onlyAvailable:true});
export const PRICE_BOUNDS = Object.freeze([Math.min(...UNITS.map(unit => unit.price)), Math.max(...UNITS.map(unit => unit.price))]);
export const SORTS = ['floor', 'price', 'price-desc', 'size'];

const fold = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const viewsOf = filters => (filters.views?.length ? filters.views : filters.view ? [filters.view] : []);
const ORDERS = {
  floor:(a, b) => b.floor - a.floor || a.index - b.index,
  price:(a, b) => a.price - b.price,
  'price-desc':(a, b) => b.price - a.price,
  size:(a, b) => b.size - a.size || b.floor - a.floor,
};

/** Price is a filter only when it actually cuts the inventory. */
export function priceActive(filters, [lo, hi] = PRICE_BOUNDS) {
  return (filters.minPrice != null && filters.minPrice > lo) || (filters.maxPrice != null && filters.maxPrice < hi);
}

/** Units that pass the 3D filters (bedrooms, price, view). "Solo disponibles" only trims the list. */
export function unitMatches(filters = DEFAULT_FILTERS, units = UNITS) {
  const views = viewsOf(filters);
  return new Set(units.filter(unit => (!filters.beds || unit.beds === filters.beds)
    && (!filters.floor || unit.floor === filters.floor)
    && (!filters.minPrice || unit.price >= filters.minPrice)
    && (!filters.maxPrice || unit.price <= filters.maxPrice)
    && (!views.length || views.includes(unit.orientation))).map(unit => unit.id));
}

export const filtersActive = filters => !!(filters.beds || filters.floor || priceActive(filters) || viewsOf(filters).length);

export function listedUnits(filters = DEFAULT_FILTERS, sort = 'floor', units = UNITS) {
  const matches = unitMatches(filters, units);
  return units.filter(unit => matches.has(unit.id) && (!filters.onlyAvailable || unit.status === 'available')).sort(ORDERS[sort] || ORDERS.floor);
}

/** 24 bins from the real unit prices, for the Unidades price panel. */
export function priceHistogram(units = UNITS, bins = 24) {
  const lo = PRICE_BOUNDS[0], hi = PRICE_BOUNDS[1], span = hi - lo || 1;
  const counts = Array.from({length:bins}, () => 0);
  for (const unit of units) counts[Math.min(bins - 1, Math.floor((unit.price - lo) / span * bins))] += 1;
  return {lo, hi, counts};
}

export function groupByTypology(units) {
  return TYPOLOGIES.map(type => ({type, units:units.filter(unit => unit.typology === type.id)})).filter(group => group.units.length);
}

/** One or two comparative lines about a unit, from the inventory only. */
export function unitLine(unit, say, money) {
  const peers = UNITS.filter(item => item.status === 'available');
  const sameView = peers.filter(item => item.orientation === unit.orientation);
  const lines = [];
  const view = say(SIDES[unit.side] === 'norte' ? 'norte' : 'sul', SIDES[unit.side]);
  if (sameView.length > 1 && sameView.every(item => item.perMeter >= unit.perMeter)) {
    lines.push(say(`É a unidade mais barata por m² entre as de vista ${view}.`, `Es la unidad más barata por m² entre las de vista ${view}.`));
  }
  const twin = peers.filter(item => item.floor !== unit.floor && item.typology === unit.typology).sort((a, b) => Math.abs(a.floor - unit.floor) - Math.abs(b.floor - unit.floor))[0];
  if (twin) {
    const floors = Math.abs(twin.floor - unit.floor), diff = Math.abs(twin.price - unit.price);
    const up = twin.floor > unit.floor;
    lines.push(up
      ? say(`A ${twin.id} tem a mesma planta, ${floors} ${floors === 1 ? 'andar' : 'andares'} acima, por ${money(diff)} a mais.`, `La ${twin.id} tiene la misma planta, ${floors} ${floors === 1 ? 'piso' : 'pisos'} más arriba, por ${money(diff)} más.`)
      : say(`A ${twin.id} tem a mesma planta, ${floors} ${floors === 1 ? 'andar' : 'andares'} abaixo, por ${money(diff)} a menos.`, `La ${twin.id} tiene la misma planta, ${floors} ${floors === 1 ? 'piso' : 'pisos'} más abajo, por ${money(diff)} menos.`));
  }
  if (!lines.length) lines.push(unit.floor >= 8
    ? say('Do 8º andar para cima, nada alto fica na frente da fachada.', 'Del piso 8 hacia arriba, nada alto queda frente a la fachada.')
    : say('Abaixo do 8º andar, os prédios vizinhos entram na vista.', 'Debajo del piso 8, los edificios vecinos entran en la vista.'));
  return lines.slice(0, 2);
}

export const similarUnits = unit => UNITS.filter(item => item.id !== unit.id && item.typology === unit.typology && item.status !== 'sold')
  .sort((a, b) => Math.abs(a.floor - unit.floor) - Math.abs(b.floor - unit.floor)).slice(0, 3);

/** Which mocked answer a question gets; anything else gets the generic reply and leaves the camera alone. */
export function moraIntent(text) {
  const value = fold(text);
  if (/vista|view|mirar|panoram/.test(value)) return 'view';
  if (/barat|m2|m²|metro cuadrado|precio por|preco por|economic/.test(value)) return 'cheapest';
  if (/nin|crianc|kid|hij|filh|escuel|escola|kinder|colegio|parque infantil/.test(value)) return 'kids';
  return 'free';
}

export function moraAnswer(intent, say, money) {
  if (intent === 'view') {
    const [first, ...rest] = MORA_ANSWERS.view.units;
    return {intent, units:MORA_ANSWERS.view.units, view:MORA_ANSWERS.view.view,
      text:say(`As de melhor vista são a ${first}, a ${rest.join(' e a ')}: do 8º andar para cima nada alto tapa o Parque Lincoln ao sul nem o Parque América ao norte.`,
        `Las de mejor vista son la ${first}, la ${rest.join(' y la ')}: del piso 8 hacia arriba nada alto tapa el Parque Lincoln al sur ni el Parque América al norte.`)};
  }
  if (intent === 'cheapest') {
    const unit = unitById(MORA_ANSWERS.cheapest.unit);
    return {intent, unit:unit.id,
      text:say(`A ${unit.id} é a mais barata por m²: ${money(unit.perMeter)} por m², ${unit.beds} ${unit.beds === 1 ? 'quarto' : 'quartos'}, de frente para o norte.`,
        `La ${unit.id} es la más barata por m²: ${money(unit.perMeter)} por m², ${unit.beds} ${unit.beds === 1 ? 'recámara' : 'recámaras'}, hacia el norte.`)};
  }
  if (intent === 'kids') return {intent, poi:MORA_ANSWERS.kids.poi,
    text:say('O Kínder & Primaria Lafontaine fica a 4 min a pé, e o Parque Lincoln, com área de brincar, também a 4 min. Mostro na cidade.',
      'El Kínder & Primaria Lafontaine está a 4 min a pie, y el Parque Lincoln, con juegos, también a 4 min. Te lo muestro en la ciudad.')};
  return {intent:'free', text:say('Posso ajudar com unidades, preço por m², vistas e o que há por perto. Experimente uma das sugestões.', 'Puedo ayudarte con unidades, precio por m², vistas y qué hay cerca. Prueba con una de las sugerencias.')};
}
