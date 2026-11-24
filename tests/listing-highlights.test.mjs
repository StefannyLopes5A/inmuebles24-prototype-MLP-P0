import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {DEMAND_CONTACTS, highlightCopy, listingHighlights, listingSeo} from '../src/listingHighlights.js';
import {moraAnalysis} from '../src/moraAnalysis.js';
import {recentContacts} from '../src/resultSort.js';

const listings = homes.filter(home => !home.development);
const say = (br, es) => es;
const money = value => `$${value}`;

test('some listings carry a price drop, some high demand, some both, some neither', () => {
  const states = new Set(listings.map(home => {
    const {drop, demand} = listingHighlights(home);
    return `${!!drop}|${!!demand}`;
  }));
  assert.deepEqual([...states].sort(), ['false|false', 'false|true', 'true|false', 'true|true']);
  const plain = listings.filter(home => !listingHighlights(home).drop && !listingHighlights(home).demand);
  assert.ok(plain.length > listings.length / 3);
});

test('highlights are stable and follow the contact count and the published drop', () => {
  for (const home of listings) {
    assert.deepEqual(listingHighlights(home), listingHighlights(home));
    assert.equal(!!listingHighlights(home).demand, recentContacts(home) >= DEMAND_CONTACTS, home.id);
    const {drop} = listingHighlights(home);
    if (drop) assert.ok(drop.pct >= 1 && drop.was > drop.price && drop.days > 0, home.id);
  }
});

test('pill and tooltip copy name the figures', () => {
  const home = listings.find(item => listingHighlights(item).drop && listingHighlights(item).demand);
  const copy = highlightCopy(listingHighlights(home), {say, money});
  assert.match(copy.drop.label, /^\d+%$/);
  assert.match(copy.drop.tip.join(''), /^Bajó \d+% de precio hace \d+ días/);
  assert.match(copy.demand.label, /\d,\dx más visualizaciones/);
  assert.match(copy.demand.tip.join(''), /^Alta competitividad: \d,\dx más visitas y favoritos/);
  assert.deepEqual(highlightCopy({drop: null, demand: null}, {say, money}), {drop: null, demand: null});
});

test('Mora carries the card highlights into the verdict facts and the page reading', () => {
  for (const language of ['es-MX', 'pt-BR']) {
    for (const home of listings) {
      const {drop, demand} = listingHighlights(home);
      const {verdict} = moraAnalysis(home, {language});
      const ids = verdict.facts.map(fact => fact.id);
      assert.equal(ids.includes('drop'), !!drop, `${home.id} ${language}`);
      assert.equal(ids.includes('demand'), !!demand, `${home.id} ${language}`);
      assert.ok(verdict.facts.length >= 1 && verdict.facts.length <= 3, home.id);
      assert.equal(verdict.candidates.some(fact => fact.id === 'drop'), !!drop, home.id);
    }
  }
});

test('the SEO line uses only published fields', () => {
  const home = listings.find(item => item.size >= 20 && item.mode !== 'rent');
  const text = listingSeo(home, 'es-MX');
  assert.match(text, new RegExp(`en venta de ${home.size} m² en `));
  assert.ok(text.includes(home.area) && text.endsWith('.'));
  assert.match(listingSeo({...home, mode: 'rent'}, 'pt-BR'), /para alugar/);
});
