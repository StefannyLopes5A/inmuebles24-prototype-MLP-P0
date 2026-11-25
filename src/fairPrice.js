import {marketFacts} from './moraAnalysis.js';

/** The rule runs from 50% below to 50% above the median m² of similar listings; "fair" is the same ±12% band Mora uses elsewhere. */
export const FAIR_SPAN = 0.5;
export const FAIR_BAND = 0.12;
export const REVIEW_BELOW = -0.35;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * Where this listing's price per m² sits against comparable listings. The score is how close it is to the median
 * (100 = right on it); the rule's marker says which side. Illustrative: the same stable market figures Mora's readings use.
 */
export function fairPriceScore(home) {
  if (!home || home.development) return null;
  const market = marketFacts(home);
  if (market.delta == null || !market.ppm2 || !market.median) return null;
  const delta = market.delta;
  const band = delta <= REVIEW_BELOW ? 'review' : delta <= -FAIR_BAND ? 'below' : delta >= FAIR_BAND ? 'above' : 'fair';
  return {
    score:clamp(Math.round(100 - Math.abs(delta) * 150), 0, 100),
    band,
    delta,
    pct:Math.round(Math.abs(delta) * 100),
    position:clamp((delta + FAIR_SPAN) / (2 * FAIR_SPAN), 0.03, 0.97) * 100,
    ppm2:market.ppm2,
    median:market.median,
    comparables:market.comparables,
    area:home.area,
  };
}
