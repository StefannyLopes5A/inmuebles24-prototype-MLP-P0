/**
 * Offer ideas for a sale: four strengths, each a discount band under the asking price with a chance of closing.
 * Prototype figures seeded from the same market facts Mora reads (days on market, a past drop, m² against the zone),
 * so the section and Mora's answer agree. Nothing is sent; the seller's answer is never known in advance.
 */
import {listingPrice} from './data.js';
import {marketFacts, ZONE_MEDIAN_DAYS} from './moraAnalysis.js';

export const OFFER_LEVELS = ['strong', 'competitive', 'moderate', 'weak'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const step = amount => Math.round(amount / 10000) * 10000;

export function offerIdeas(home) {
  if (!home || home.development || home.mode !== 'buy') return null;
  const price = listingPrice(home);
  if (!(price > 0)) return null;
  const facts = marketFacts(home);
  const slow = Math.min(facts.days / ZONE_MEDIAN_DAYS, 3);
  const pricey = facts.delta == null ? 0 : clamp(facts.delta * 0.15, -0.02, 0.03);
  const room = clamp(0.03 + 0.01 * slow + (facts.drop ? 0.01 : 0) + pricey, 0.02, 0.09);
  const cuts = [room, room + 0.03, room + 0.07].map(cut => Math.round(cut * 1000) / 1000);
  const lean = Math.round(clamp((slow - 1) * 4, -6, 8));
  const [strong, competitive, moderate, weak] = [75, 52, 30, 12].map(chance => clamp(chance + lean, 5, 90));
  const at = cut => step(price * (1 - cut));
  return {
    price,
    days: facts.days,
    zoneDays: ZONE_MEDIAN_DAYS,
    levels: [
      {id:'strong', chance:strong, from:at(cuts[0]), to:null, cut:[0, cuts[0]]},
      {id:'competitive', chance:competitive, from:at(cuts[1]), to:at(cuts[0]), cut:[cuts[0], cuts[1]]},
      {id:'moderate', chance:moderate, from:at(cuts[2]), to:at(cuts[1]), cut:[cuts[1], cuts[2]]},
      {id:'weak', chance:weak, from:null, to:at(cuts[2]), cut:[cuts[2], null]},
    ],
  };
}
