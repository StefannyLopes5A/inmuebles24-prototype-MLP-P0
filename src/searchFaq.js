import {marketAnswer, marketQuestion, MARKET_TOPICS} from './marketAnswers.js';
import {normalizeSearch} from './journey.js';
import {livingCosts} from './costOfLiving.js';
import {regionArea} from './priceInsights.js';

/**
 * Four questions for the results FAQ (Figma 12908:21304). Notary, guarantee and credit reuse Mora's market answers
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
  const fee = livingCosts(search)?.items.maintenance;
  items.push({id: 'maintenance', question: null, teaser: null, answer: null, note: null, amount: fee?.amount ?? null, count: fee?.count ?? 0});
  return {area, mode, items};
}
