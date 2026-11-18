import {homes as catalog} from './data.js';
import {normalizeSearch} from './journey.js';
import {insightListings, regionArea, regionSnapshot} from './priceInsights.js';

/**
 * Illustrative monthly costs in MXN for a CDMX household, not measured data. They scale with the typical home size
 * and the searched bedrooms; only maintenance comes from the catalog, as the fee the listings publish.
 */
const MODEL = {
  groceriesPerPerson: 3200,
  electricity: {base: 180, perM2: 2.4},
  gas: {base: 220, perPerson: 160},
  transportPerPerson: 680,
  water: {base: 110, perM2: 1.2},
  internet: 499,
  insuranceYearlyShare: 0.0015,
  contentsInsurance: 280,
};
/** Listings sometimes publish a placeholder such as 1; anything below this is not a real monthly fee. */
const MIN_FEE = 100;

export const COST_ITEMS = ['groceries', 'electricity', 'gas', 'transport', 'water', 'internet', 'maintenance', 'insurance'];

const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (value, step = 10) => Math.round(value / step) * step;

/** Monthly costs for the colonia the region section talks about. `maintenance.amount` is null when no listing publishes it. */
export function livingCosts(search, inventory = catalog) {
  const snapshot = regionSnapshot(search, inventory);
  if (!snapshot) return null;
  const {area, beds} = snapshot;
  const listings = insightListings({...search, areas: [area]}, inventory).filter(home => !beds || home.beds >= beds);
  const size = round(median(listings.map(home => home.size).filter(size => size > 0)) || 80, 5);
  const people = Math.min(4, Math.max(1, beds || normalizeSearch(search).beds || 2));
  const fees = inventory.filter(home => home.area === area && !home.development && home.fee >= MIN_FEE).map(home => home.fee);
  const rent = normalizeSearch(search).mode === 'rent';
  const items = {
    groceries: {amount: round(MODEL.groceriesPerPerson * people, 50), basis: 'estimate', people},
    electricity: {amount: round(MODEL.electricity.base + MODEL.electricity.perM2 * size), basis: 'estimate'},
    gas: {amount: round(MODEL.gas.base + MODEL.gas.perPerson * people), basis: 'estimate'},
    transport: {amount: round(MODEL.transportPerPerson * people, 50), basis: 'estimate'},
    water: {amount: round(MODEL.water.base + MODEL.water.perM2 * size), basis: 'estimate'},
    internet: {amount: MODEL.internet, basis: 'estimate'},
    maintenance: fees.length ? {amount: round(median(fees)), basis: 'published', count: fees.length} : {amount: null, basis: 'unknown', count: 0},
    insurance: rent
      ? {amount: MODEL.contentsInsurance, basis: 'estimate', kind: 'contents'}
      : {amount: round(snapshot.median * MODEL.insuranceYearlyShare / 12), basis: 'estimate', kind: 'home'},
  };
  return {area, size, people, rent, items};
}
