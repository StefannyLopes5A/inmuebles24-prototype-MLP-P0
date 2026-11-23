import {marketAnswer, marketQuestion, MARKET_TOPICS} from './marketAnswers.js';
import {normalizeSearch} from './journey.js';
import {livingCosts} from './costOfLiving.js';
import {regionArea} from './priceInsights.js';

/**
 * Four questions for the results FAQ (a fifth, `living`, for wide screens) (Figma 12908:21304). Notary, guarantee and credit reuse Mora's market answers
 * on this search's budget. Maintenance uses the fee the colonia's listings publish.
 */
export function searchFaq(search, language = 'es-MX') {
  const area = regionArea(search);
  if (!area) return null;
  const current = normalizeSearch(search);
  const mode = current.mode === 'rent' ? 'rent' : 'buy';
  const items = MARKET_TOPICS.map(topic => {
    const answer = marketAnswer(topic, {mode, price: current.budget, language});
    return {id: topic, question: marketQuestion(topic, language), teaser: answer.headline, answer: answer.detail, note: answer.note};
  });
  const costs = livingCosts(search);
  const fee = costs?.items.maintenance;
  items.push({id: 'maintenance', question: null, teaser: null, answer: null, note: null, amount: fee?.amount ?? null, count: fee?.count ?? 0});
  // Fifth question, shown on wide screens: the monthly household costs the cost-of-living section models.
  const amounts = costs ? Object.values(costs.items).map(item => item.amount).filter(Number.isFinite) : [];
  const living = costs && amounts.length ? {total: amounts.reduce((sum, amount) => sum + amount, 0), people: costs.people, withFee: Number.isFinite(fee?.amount)} : null;
  return {area, mode, items, living};
}
