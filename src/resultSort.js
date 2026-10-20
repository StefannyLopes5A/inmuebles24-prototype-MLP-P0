import {marketFacts, peerFacts} from './moraAnalysis.js';
import {seed} from './listingAdvertiser.js';
import {SORTS, canonicalSort} from './journey.js';

export {SORTS, canonicalSort};

/**
 * How the results grid can be ordered. Recommended is the existing order (exact matches first). The others reorder
 * inside the exact matches and inside the suggestions, so a listing outside the filters never jumps ahead of one inside.
 * Recent contacts, behind the high-demand card tag, are a prototype figure seeded per listing, like days on market.
 */

const RARE_PEERS = 2;
const NEAR_MEDIAN = 0.03;

export function sortLabel(sort, language = 'es-MX') {
  const pt = language === 'pt-BR';
  return {
    recommended:pt ? 'Recomendados' : 'Recomendados',
    price:pt ? 'Preço justo' : 'Precio justo',
    rarity:pt ? 'Raridade' : 'Rareza',
  }[canonicalSort(sort)];
}

export const recentContacts = home => seed(`contacts|${home.id}`) % 15;

function sortKey(home, sort) {
  if (sort === 'price') return marketFacts(home).delta ?? Infinity;
  if (sort === 'rarity') return peerFacts(home).count;
  return 0;
}

export function sortResults(items, sort, exactIds = new Set()) {
  const current = canonicalSort(sort);
  if (current === 'recommended') return items;
  const keyed = items.map((home, index) => ({home, index, exact:exactIds.has(home.id), key:sortKey(home, current)}));
  return keyed.sort((a, b) => Number(b.exact) - Number(a.exact) || a.key - b.key || a.index - b.index).map(item => item.home);
}

/**
 * The signal a sort shows: a short tag on the card photo, or the longer line under the price on the listing page.
 * Null when this listing has nothing to say for that sort.
 */
export function sortSignal(home, sort, language = 'es-MX', {long = false} = {}) {
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const current = canonicalSort(sort);
  if (!home || current === 'recommended') return null;
  if (current === 'price') {
    const {delta} = marketFacts(home);
    if (delta == null || delta > NEAR_MEDIAN) return null;
    if (delta < -NEAR_MEDIAN) return long ? say(`Abaixo da mediana de ${home.area}`, `Por debajo de la mediana de ${home.area}`) : say('Abaixo da mediana', 'Por debajo de la mediana');
    return long ? say(`Perto da mediana de ${home.area}`, `Cerca de la mediana de ${home.area}`) : say('Perto da mediana', 'Cerca de la mediana');
  }
  if (current === 'rarity') {
    const {count} = peerFacts(home);
    if (count > RARE_PEERS) return null;
    if (!long) return say('Poucos como este', 'Pocos como este');
    return count === 0 ? say('Nenhum parecido no catálogo', 'Ningún parecido en el catálogo')
      : count === 1 ? say('Só 1 parecido no catálogo', 'Solo 1 parecido en el catálogo')
      : say(`Só ${count} parecidos no catálogo`, `Solo ${count} parecidos en el catálogo`);
  }
  return null;
}
