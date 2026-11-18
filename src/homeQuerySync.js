import {foldSearchText} from './homeSearchModel.js';
import {CRITERIA, criterionLabel, replaceBathPhrase, replaceParkingPhrase} from './searchCriteria.js';

const escapePattern = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const BEDS_RE = /(\d+)\+?\s*(?:recámaras?|recamaras?|quartos?|habitaciones?)/iu;
const BUDGET_RE = /(?:hasta|ate|até|menos de)\s*(?:\$|USD\s*|MXN\s*)?[\d.,]+(?:\s*(?:mil|millones|millón|milhões|milhao|mi))?(?:\s*(?:MXN|USD))*/iu;
const RENT_RE = /\b(?:renta|rentar|alugar|aluguel)\b/iu;
const BUY_RE = /\b(?:compra|comprar|venta|venda)\b/iu;
const CITY_RE = /\b(?:ciudad de méxico|ciudad de mexico|cdmx|cidade do méxico|cidade do mexico)\b/iu;
const TYPE_REGEX = [
  ['condominium', /\bcasas?\s+(?:en|em)\s+condominio\b/iu],
  ['house', /\bcasas?\b/iu],
  ['apartment', /\b(?:departamentos?|apartamentos?)\b/iu],
];

const TYPE_PHRASE = {
  apartment: {es: 'departamento', pt: 'apartamento'},
  house: {es: 'casa', pt: 'casa'},
  condominium: {es: 'casa en condominio', pt: 'casa em condomínio'},
  office: {es: 'oficina', pt: 'escritório'},
  warehouse: {es: 'bodega comercial', pt: 'depósito comercial'},
  land: {es: 'terreno', pt: 'terreno'},
  industrial: {es: 'nave industrial', pt: 'galpão industrial'},
  commercial: {es: 'local comercial', pt: 'ponto comercial'},
};

function bedWord(count, language) {
  const pt = language === 'pt-BR';
  if (pt) return count === 1 ? 'quarto' : 'quartos';
  return count === 1 ? 'recámara' : 'recámaras';
}

function areaDisplayName(area, language) {
  if (area === 'Ambas zonas') return language === 'pt-BR' ? 'Cidade do México' : 'Ciudad de México';
  return area;
}

function findNamedArea(text, areas) {
  const normalized = foldSearchText(text);
  const catalog = (areas || []).filter(name => name && name !== 'Ambas zonas').sort((a, b) => b.length - a.length);
  for (const name of catalog) {
    const folded = foldSearchText(name);
    if (new RegExp(`(?:^|[^a-z0-9])${escapePattern(folded)}(?=$|[^a-z0-9])`).test(normalized)) {
      const pattern = new RegExp(`\\b${escapePattern(name).replace(/\\ /g, '[\\s-]+')}\\b`, 'iu');
      if (pattern.test(text)) return {name, pattern};
    }
  }
  if (CITY_RE.test(text)) return {name: 'Ambas zonas', pattern: CITY_RE};
  return null;
}

function bathWord(count, language) {
  if (language === 'pt-BR') return count === 1 ? 'banheiro' : 'banheiros';
  return count === 1 ? 'baño' : 'baños';
}

function patchBaths(text, baths, language) {
  const count = Math.min(10, Math.max(1, Number(baths) || 1));
  const phrase = `${count} ${bathWord(count, language)}`;
  if (!String(text || '').trim()) return phrase;
  return replaceBathPhrase(text, phrase) || `${text}${language === 'pt-BR' ? ' com ' : ' con '}${phrase}`.trim();
}

function parkingWord(count, language) {
  if (language === 'pt-BR') return count === 1 ? 'vaga' : 'vagas';
  return count === 1 ? 'estacionamiento' : 'estacionamientos';
}

function patchParking(text, parking, language) {
  const count = Math.min(6, Math.max(1, Number(parking) || 1));
  const phrase = `${count} ${parkingWord(count, language)}`;
  if (!String(text || '').trim()) return phrase;
  return replaceParkingPhrase(text, phrase) || `${text}${language === 'pt-BR' ? ' com ' : ' con '}${phrase}`.trim();
}

function patchBeds(text, beds, language) {
  const phrase = `${beds} ${bedWord(beds, language)}`;
  if (!String(text || '').trim()) return phrase;
  if (BEDS_RE.test(text)) return text.replace(BEDS_RE, phrase);
  const connector = language === 'pt-BR' ? ' com ' : ' con ';
  return `${text}${connector}${phrase}`.trim();
}

function patchPropertyType(text, propertyType, language) {
  const locale = language === 'pt-BR' ? 'pt' : 'es';
  const phrase = TYPE_PHRASE[propertyType]?.[locale] || TYPE_PHRASE.apartment[locale];
  for (const [, pattern] of TYPE_REGEX) {
    if (pattern.test(text)) return text.replace(pattern, phrase);
  }
  return text ? `${phrase} ${text}` : phrase;
}

function patchArea(text, area, language, areas) {
  const label = areaDisplayName(area, language);
  const found = findNamedArea(text, areas);
  if (found) return text.replace(found.pattern, label);
  const prep = language === 'pt-BR' ? ' em ' : ' en ';
  return `${text}${prep}${label}`.trim();
}

/** One currency word stays on the budget phrase. Any other MXN or USD is a leftover from the price control. */
export function tidyBudgetCurrency(text) {
  const raw = String(text || '');
  const collapsed = raw.replace(new RegExp(BUDGET_RE.source, 'giu'), match => {
    const currencies = [...match.matchAll(/\b(?:MXN|USD)\b/giu)];
    if (currencies.length <= 1) return match;
    return `${match.replace(/\s*\b(?:MXN|USD)\b/giu, '')} ${currencies[0][0]}`;
  });
  const spans = [...collapsed.matchAll(new RegExp(BUDGET_RE.source, 'giu'))].map(match => [match.index, match.index + match[0].length]);
  const stripped = collapsed.replace(/\b(?:MXN|USD)\b/giu, (word, index) => spans.some(([start, end]) => index >= start && index < end) ? word : '');
  const next = stripped.replace(/[^\S\n]{2,}/gu, ' ');
  return stripped === collapsed ? next : next.replace(/[^\S\n]+$/gu, '');
}

function patchBudget(text, budgetLabel, language) {
  const lead = language === 'pt-BR' ? 'até ' : 'hasta ';
  const phrase = `${lead}${budgetLabel}`;
  const replaced = BUDGET_RE.test(text) ? text.replace(BUDGET_RE, phrase) : `${text} ${phrase}`.trim();
  return tidyBudgetCurrency(replaced);
}

function patchMode(text, mode, language) {
  const pt = language === 'pt-BR';
  const rentWord = pt ? 'alugar' : 'rentar';
  const buyWord = 'comprar';
  if (mode === 'rent') {
    if (BUY_RE.test(text)) return text.replace(BUY_RE, rentWord);
    if (RENT_RE.test(text)) return text;
    return `${rentWord} ${text}`.trim();
  }
  if (mode === 'buy') {
    if (RENT_RE.test(text)) return text.replace(RENT_RE, buyWord);
    if (BUY_RE.test(text)) return text;
    return `${buyWord} ${text}`.trim();
  }
  return text;
}

function insertCriterionPhrase(text, id, language) {
  const label = criterionLabel(id, language).toLowerCase();
  const folded = foldSearchText(text);
  const item = CRITERIA.find(entry => entry.id === id);
  if (item?.pattern.test(folded)) return text;
  const connector = language === 'pt-BR' ? ' com ' : ' con ';
  return `${text}${connector}${label}`.trim();
}

function removeCriterionPhrase(text, id) {
  const item = CRITERIA.find(entry => entry.id === id);
  if (!item) return text;
  let next = text;
  const flags = item.pattern.flags.includes('g') ? item.pattern.flags : `${item.pattern.flags}g`;
  const pattern = new RegExp(item.pattern.source, flags);
  next = next.replace(pattern, '');
  return next
    .replace(/\s+(?:con|com|y|e)\s*$/iu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

/** Keep the natural-language query aligned when a home filter chip changes. */
export function patchHomeQueryForChip(query, key, value, {language, areas, budgetLabel} = {}) {
  let text = String(query || '');
  switch (key) {
    case 'beds':
      text = patchBeds(text, Math.min(10, Math.max(1, Number(value) || 1)), language);
      break;
    case 'baths':
      text = patchBaths(text, value, language);
      break;
    case 'parking':
      text = patchParking(text, value, language);
      break;
    case 'propertyType':
      text = patchPropertyType(text, value, language);
      break;
    case 'area':
      text = patchArea(text, value, language, areas);
      break;
    case 'budget':
      if (budgetLabel) text = patchBudget(text, budgetLabel, language);
      break;
    case 'mode':
      text = patchMode(text, value, language);
      break;
    default:
      break;
  }
  return text.slice(0, 600);
}

function containsPhrase(text, phrase) {
  const folded = foldSearchText(text);
  const needle = foldSearchText(phrase);
  if (needle.length < 2) return false;
  let from = 0;
  while (from <= folded.length) {
    const at = folded.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 || !/[a-z0-9]/.test(folded[at - 1]);
    const after = at + needle.length === folded.length || !/[a-z0-9]/.test(folded[at + needle.length]);
    if (before && after) return true;
    from = at + 1;
  }
  return false;
}

/** Add or remove a place the way an amenity phrase is added or removed. */
export function patchHomeQueryForPlace(query, place, active, language) {
  const label = place?.label || '';
  let text = String(query || '').trim();
  if (!label) return text.slice(0, 600);
  if (active) {
    if (containsPhrase(text, label)) return text.slice(0, 600);
    const prep = language === 'pt-BR' ? ' em ' : ' en ';
    return `${text}${prep}${label}`.trim().slice(0, 600);
  }
  const pattern = new RegExp(`(?:\\s*(?:en|em)\\s+)?${escapePattern(label).replace(/\\ /g, '[\\s-]+')}`, 'iu');
  return text
    .replace(pattern, ' ')
    .replace(/\s+(?:y|e)\s+(?=(?:y|e|cerca|en|em|con|com|hasta|ate|até|,|\.|$))/iu, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim()
    .slice(0, 600);
}

/** Add or remove an amenity phrase when its chip toggles. */
export function patchHomeQueryForCriterion(query, id, active, language) {
  let text = String(query || '').trim();
  if (!text) return text;
  text = active ? insertCriterionPhrase(text, id, language) : removeCriterionPhrase(text, id);
  return text.slice(0, 600);
}
