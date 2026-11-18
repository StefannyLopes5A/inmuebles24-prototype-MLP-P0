import {normalizeSearch} from './journey.js';
import {OPERATIONS, PROPERTY_TYPES} from './homeSearchModel.js';
import {criterionLabel} from './searchCriteria.js';

const PLURAL = {
  apartment:['Departamentos', 'Apartamentos'],
  house:['Casas', 'Casas'],
  condominium:['Casas en condominio', 'Casas em condomínio'],
  office:['Oficinas', 'Escritórios'],
  commercial:['Locales comerciales', 'Pontos comerciais'],
  warehouse:['Bodegas comerciales', 'Depósitos comerciais'],
  land:['Terrenos', 'Terrenos'],
  industrial:['Naves industriales', 'Galpões industriais'],
  any:['Inmuebles', 'Imóveis'],
};
const SALE = {
  buy:['en venta', 'à venda'],
  rent:['en renta', 'para alugar'],
  development:['en desarrollos', 'em desenvolvimentos'],
  auction:['en remate', 'em liquidação'],
};

export const savedKey = item => typeof item === 'string' ? item : item?.key || '';

/** Session copies may be a bare alert key or a saved search with the filters and the day it was kept. */
export function readSavedSearches(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const entries = [];
  for (const item of value) {
    const key = savedKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const savedAt = item && typeof item === 'object' && Number.isFinite(Number(item.savedAt)) ? Number(item.savedAt) : null;
    const search = item && typeof item === 'object' && item.search && typeof item.search === 'object' ? item.search : searchFromAlertKey(key);
    if (!search) continue;
    entries.push({key, savedAt, search});
    if (entries.length >= 20) break;
  }
  return entries;
}

/** Rebuild a search from the alert key used before searches were stored whole. */
export function searchFromAlertKey(key) {
  let parts;
  try {parts = JSON.parse(key);} catch {return null;}
  if (!Array.isArray(parts) || parts.length < 14) return null;
  const [mode, propertyType, areas, address, placeKey, beds, baths, parking, minSize, maxSize, minLot, maxLot, minBudget, budget] = parts;
  const places = Array.isArray(placeKey) ? placeKey.map(value => {
    const text = String(value);
    const cut = text.indexOf('~');
    return cut > 0 ? {kind:text.slice(0, cut), id:text.slice(cut + 1)} : null;
  }).filter(Boolean) : [];
  return normalizeSearch({
    mode, propertyType, beds, baths, parking, minSize, maxSize, minLot, maxLot, minBudget, budget,
    ...(places.length ? {places} : {areas:Array.isArray(areas) ? areas : [], address:typeof address === 'string' ? address : ''}),
  });
}

function es(language) {return language !== 'pt-BR';}

function locationNames(search, language) {
  if (search.places?.length) return search.places.map(place => place.label);
  if (search.address && !search.areas?.length) return [search.address];
  if (search.areas?.length) return search.areas;
  return [es(language) ? 'Ciudad de México' : 'Cidade do México'];
}

function locationPhrase(names, language) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} ${es(language) ? 'y' : 'e'} ${names[1]}`;
  return `${names[0]} +${names.length - 1}`;
}

/** The card title describes the saved filters, not a placeholder listing. */
export function savedSearchTitle(search, language) {
  const current = normalizeSearch(search);
  const spanish = es(language);
  const type = current.propertyType || 'apartment';
  const plural = PLURAL[type]?.[spanish ? 0 : 1] || PLURAL.apartment[spanish ? 0 : 1];
  const rooms = current.beds;
  const roomWord = spanish ? (rooms === 1 ? 'recámara' : 'recámaras') : (rooms === 1 ? 'quarto' : 'quartos');
  const sale = SALE[current.mode]?.[spanish ? 0 : 1] || SALE.buy[spanish ? 0 : 1];
  const where = locationPhrase(locationNames(current, language), language);
  const withRooms = spanish ? `con ${rooms} ${roomWord}` : `com ${rooms} ${roomWord}`;
  return `${plural} ${withRooms} ${sale} ${spanish ? 'en' : 'em'} ${where}`;
}

/** Filter chips in the order the saved-search card shows them. */
export function savedSearchChips(search, {language, money, currency}) {
  const current = normalizeSearch(search);
  const spanish = es(language);
  const locale = spanish ? 2 : 1;
  const operation = OPERATIONS.find(([key]) => key === current.mode)?.[locale] || (spanish ? 'Comprar' : 'Comprar');
  const type = PROPERTY_TYPES.find(([key]) => key === (current.propertyType || 'apartment'))?.[locale] || (spanish ? 'Departamento' : 'Apartamento');
  const chips = [operation, type, ...locationNames(current, language)];
  chips.push(`${spanish ? 'Hasta' : 'Até'} ${money(current.budget)} ${currency}`);
  const rooms = current.beds;
  chips.push(`${rooms} ${spanish ? (rooms === 1 ? 'recámara' : 'recámaras') : (rooms === 1 ? 'quarto' : 'quartos')}+`);
  if (current.baths > 1) chips.push(`${current.baths} ${spanish ? (current.baths === 1 ? 'baño' : 'baños') : (current.baths === 1 ? 'banheiro' : 'banheiros')}+`);
  if (current.parking) chips.push(`${current.parking} ${spanish ? (current.parking === 1 ? 'estacionamiento' : 'estacionamientos') : (current.parking === 1 ? 'vaga' : 'vagas')}+`);
  if (current.minSize || current.maxSize) chips.push(spanLabel(current.minSize, current.maxSize, 'm²', spanish));
  if (current.minLot || current.maxLot) chips.push(spanLabel(current.minLot, current.maxLot, spanish ? 'm² lote' : 'm² lote', spanish));
  for (const id of current.criteria || []) chips.push(criterionLabel(id, language));
  return chips;
}

function spanLabel(min, max, unit, spanish) {
  if (min && max) return `${min}–${max} ${unit}`;
  if (min) return `${spanish ? 'Desde' : 'A partir de'} ${min} ${unit}`;
  return `${spanish ? 'Hasta' : 'Até'} ${max} ${unit}`;
}

export function savedSearchMeta(count, savedAt, language) {
  const spanish = es(language);
  const formatted = new Intl.NumberFormat(language).format(count);
  const matches = count === 1
    ? (spanish ? `${formatted} inmueble coincide hoy` : `${formatted} imóvel corresponde hoje`)
    : (spanish ? `${formatted} inmuebles coinciden hoy` : `${formatted} imóveis correspondem hoje`);
  if (!savedAt) return matches;
  const date = new Intl.DateTimeFormat(language, {day:'numeric', month:'long'}).format(savedAt);
  return `${matches} · ${spanish ? 'Guardada el' : 'Salva em'} ${date}`;
}
