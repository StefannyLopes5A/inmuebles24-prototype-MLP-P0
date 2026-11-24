import {hasChosenLocation} from './homeSearchModel.js';
import {suggestedLocations} from './locationSearch.js';
import {criterionLabel} from './searchCriteria.js';

/** Order in which Mora narrows a search that arrives too open. */
export const REFINE_STEPS = Object.freeze(['area', 'mode', 'propertyType', 'beds', 'budget', 'criteria']);
/** Types where bedrooms are a meaningful question. */
const RESIDENTIAL = new Set(['apartment', 'house', 'condominium', 'any']);
const DEFAULT_BUDGET = {buy: 7_500_000, rent: 28_000};
const BUDGETS = {buy: [4_000_000, 7_500_000, 12_000_000], rent: [20_000, 28_000, 45_000]};
const AMENITIES = ['pets', 'security', 'balcony'];

/**
 * Which dimensions the person already decided. Home flags (`chosen`) win; for links and
 * shared URLs, which carry defaults, a value that differs from the default counts as a choice.
 */
export function specifiedSteps(search = {}, chosen = {}, answered = new Set()) {
  const has = key => answered.has(key);
  return {
    area: has('area') || hasChosenLocation(search),
    mode: has('mode') || !!chosen.mode || search.mode === 'rent' || !!search.propertyType,
    propertyType: has('propertyType') || !!chosen.propertyType || !!search.propertyType,
    beds: has('beds') || !!chosen.beds || (search.beds ?? 2) !== 2,
    budget: has('budget') || !!chosen.budget || !!search.minBudget || search.budget !== (DEFAULT_BUDGET[search.mode === 'rent' ? 'rent' : 'buy']),
    criteria: has('criteria') || (search.criteria || []).length > 0,
  };
}

/** The next question, or null when the search is specific enough (or the person is done). */
export function nextRefineStep(search, chosen = {}, answered = new Set()) {
  const known = specifiedSteps(search, chosen, answered);
  return REFINE_STEPS.find(step => !known[step] && (step !== 'beds' || RESIDENTIAL.has(search.propertyType || 'apartment'))) || null;
}

/** A conversation only starts when something before the amenities is open. */
export const isTooOpen = (search, chosen = {}) => {
  const step = nextRefineStep(search, chosen);
  return !!step && step !== 'criteria';
};

export function refineOptions(step, search, language = 'es-MX') {
  const pt = language === 'pt-BR';
  if (step === 'area') return suggestedLocations(4).filter(place => place.kind !== 'city').slice(0, 3).map(place => ({value: place, label: place.label}));
  if (step === 'mode') return [['buy', 'Comprar', 'Comprar'], ['rent', 'Alugar', 'Rentar'], ['development', 'Lançamentos', 'Desarrollos']].map(([value, br, es]) => ({value, label: pt ? br : es}));
  if (step === 'propertyType') return [['apartment', 'Apartamento', 'Departamento'], ['house', 'Casa', 'Casa'], ['condominium', 'Casa em condomínio', 'Casa en condominio']].map(([value, br, es]) => ({value, label: pt ? br : es}));
  if (step === 'beds') return [1, 2, 3, 4].map(value => ({value, label: `${value}${value === 4 ? '+' : ''} ${pt ? (value === 1 ? 'quarto' : 'quartos') : (value === 1 ? 'recámara' : 'recámaras')}`}));
  if (step === 'budget') return BUDGETS[search.mode === 'rent' ? 'rent' : 'buy'].map(value => ({value, amount: true}));
  return AMENITIES.map(value => ({value, label: criterionLabel(value, language)}));
}

/** Writes the answer into the filters the way the bar's own controls do. */
export function applyRefineAnswer(step, value, search) {
  if (step === 'area') return {...search, places: [value]};
  if (step === 'mode') {
    const next = {...search, mode: value};
    if (value !== search.mode) {next.budget = value === 'rent' ? DEFAULT_BUDGET.rent : DEFAULT_BUDGET.buy; next.minBudget = 0;}
    return next;
  }
  if (step === 'propertyType') return {...search, propertyType: value};
  if (step === 'beds') return {...search, beds: value};
  if (step === 'budget') return {...search, budget: value};
  return {...search, criteria: [...new Set([...(search.criteria || []), value])]};
}
