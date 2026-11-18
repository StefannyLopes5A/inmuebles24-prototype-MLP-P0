/**
 * What buying costs on signing day and per month, from an offer, a down payment and a fixed-rate term.
 * Illustrative CDMX rates, inside the 4% to 7% closing range Mora quotes in marketAnswers.js; the notary and the
 * bank close the real numbers. Local arithmetic only: nothing is sent and no credit bureau is consulted.
 */
export const COST_DEFAULTS = {down:0.2, years:20, rate:0.11};
export const ISAI_RATE = 0.035;
export const CLOSING_RATE = 0.016;
/** Share of monthly income banks usually accept for the mortgage payment. */
export const INCOME_SHARE = 0.3;

export const COST_LIMITS = {offer:[100000, 500000000], down:[0.05, 0.9], years:[5, 30], rate:[0.01, 0.3]};

const hundred = amount => Math.round(amount / 100) * 100;
export const clampCost = (key, value) => Math.min(COST_LIMITS[key][1], Math.max(COST_LIMITS[key][0], value));

export function purchaseCosts({offer, down = COST_DEFAULTS.down, years = COST_DEFAULTS.years, rate = COST_DEFAULTS.rate}) {
  const enganche = hundred(offer * down);
  const isai = hundred(offer * ISAI_RATE);
  const closing = hundred(offer * CLOSING_RATE);
  const principal = Math.max(0, offer - enganche);
  const r = rate / 12, n = years * 12;
  const monthly = principal ? (r ? principal * r / (1 - (1 + r) ** -n) : principal / n) : 0;
  return {
    enganche, isai, closing,
    upfront: enganche + isai + closing,
    principal,
    monthly: hundred(monthly),
    income: hundred(monthly / INCOME_SHARE),
    interest: hundred(monthly * n - principal),
  };
}
