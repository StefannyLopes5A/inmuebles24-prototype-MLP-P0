import test from 'node:test';
import assert from 'node:assert/strict';
import {countInRange, insightListings, insightMode, nearbyAreaPrices, regionArea, regionPhotos, regionSnapshot} from '../src/priceInsights.js';
import {homes, listingPrice} from '../src/data.js';
import {COST_ITEMS, livingCosts} from '../src/costOfLiving.js';
import {searchFaq} from '../src/searchFaq.js';
import {MIN_RELATED_LINKS, relatedLinkChanges, relatedSearches} from '../src/relatedSearches.js';
import {matchesCriteria} from '../src/searchCriteria.js';
import {matchingHomes} from '../src/journey.js';
import {headerMenus} from '../src/headerMenuData.js';

const narvarte = {mode:'buy', areas:['Narvarte Poniente'], budget:7_500_000};

test('price card listings follow the operation and areas, without developments', () => {
  const listings = insightListings(narvarte);
  assert.ok(listings.length > 0);
  assert.ok(listings.every(home => home.mode === 'buy' && home.area === 'Narvarte Poniente' && !home.development));
  assert.equal(insightListings({mode:'rent', areas:[], budget:28_000}).length, homes.filter(home => home.mode === 'rent' && !home.development).length);
  assert.equal(insightMode({mode:'development'}), 'buy');
});

test('range count is inclusive on both ends', () => {
  const listings = insightListings(narvarte);
  const prices = listings.map(listingPrice).sort((a, b) => a - b);
  assert.equal(countInRange(listings, prices[0], prices.at(-1)), listings.length);
  assert.equal(countInRange(listings, prices.at(-1) + 1, prices.at(-1) + 2), 0);
});

test('nearby areas start with the searched area and stay in the operation', () => {
  const rows = nearbyAreaPrices(narvarte);
  assert.equal(rows[0].area, 'Narvarte Poniente');
  assert.equal(rows[0].current, true);
  assert.equal(rows.length, 7);
  assert.equal(new Set(rows.map(row => row.area)).size, rows.length);
  const buyAreas = new Set(homes.filter(home => home.mode === 'buy').map(home => home.area));
  assert.ok(rows.every(row => buyAreas.has(row.area) && row.value > 0 && row.count > 0));
});

test('region snapshot bounds the median with the cheapest and priciest fitting listing', () => {
  const snapshot = regionSnapshot({...narvarte, beds:2});
  assert.equal(snapshot.area, 'Narvarte Poniente');
  assert.equal(snapshot.beds, 2);
  const fitting = insightListings(narvarte).filter(home => home.beds >= 2).map(listingPrice);
  assert.equal(listingPrice(snapshot.lowest), Math.min(...fitting));
  assert.equal(listingPrice(snapshot.highest), Math.max(...fitting));
  assert.ok(snapshot.median >= Math.min(...fitting) && snapshot.median <= Math.max(...fitting));
  assert.match(snapshot.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test('region falls back to every listing when none has enough bedrooms, and to the busiest area', () => {
  assert.equal(regionSnapshot({...narvarte, beds:10}).beds, null);
  const area = regionArea({mode:'rent', areas:[], budget:28_000});
  assert.ok(homes.some(home => home.mode === 'rent' && home.area === area));
});

test('region photos are distinct catalog photos, the searched colonia first', () => {
  const photos = regionPhotos(narvarte);
  assert.equal(photos.length, 4);
  assert.equal(new Set(photos.map(home => home.image)).size, 4);
  assert.equal(photos[0].area, 'Narvarte Poniente');
  assert.ok(photos.every(home => home.mode === 'buy' && !home.development));
});

test('total is the median listing price; m² is a smaller per-meter figure', () => {
  const [total] = nearbyAreaPrices(narvarte);
  const prices = insightListings(narvarte).map(listingPrice).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  assert.equal(total.value, Math.round(prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2));
  const [m2] = nearbyAreaPrices(narvarte, {metric:'m2'});
  assert.ok(m2.value > 0 && m2.value < total.value);
});

test('living costs take maintenance from published fees and label every other figure as an estimate', () => {
  const costs = livingCosts({...narvarte, beds:2});
  assert.equal(costs.area, 'Narvarte Poniente');
  assert.deepEqual(Object.keys(costs.items), COST_ITEMS);
  const fees = homes.filter(home => home.area === 'Narvarte Poniente' && home.fee >= 100);
  assert.equal(costs.items.maintenance.basis, 'published');
  assert.equal(costs.items.maintenance.count, fees.length);
  assert.ok(COST_ITEMS.filter(item => item !== 'maintenance').every(item => costs.items[item].basis === 'estimate' && costs.items[item].amount > 0));
  assert.equal(costs.items.insurance.kind, 'home');
});

test('living costs ignore placeholder fees, leave unpublished maintenance unknown and use contents insurance for rent', () => {
  const polanco = livingCosts({mode:'rent', areas:['Polanco'], budget:28_000, beds:2});
  const fees = homes.filter(home => home.area === 'Polanco' && home.fee).map(home => home.fee);
  assert.ok(fees.some(fee => fee < 100), 'the catalog keeps a placeholder fee for this check');
  const real = fees.filter(fee => fee >= 100).sort((a, b) => a - b);
  const middle = Math.floor(real.length / 2);
  const expected = real.length % 2 ? real[middle] : (real[middle - 1] + real[middle]) / 2;
  assert.equal(polanco.items.maintenance.count, real.length);
  assert.equal(polanco.items.maintenance.amount, Math.round(expected / 10) * 10);
  assert.equal(polanco.items.insurance.kind, 'contents');
  const unknown = livingCosts({mode:'buy', areas:['Crédito Constructor'], budget:20_000_000, beds:1});
  assert.equal(unknown.items.maintenance.amount, null);
  assert.equal(unknown.items.maintenance.basis, 'unknown');
});

test('search faq reuses the market answers for this budget and the colonia maintenance fee', () => {
  const faq = searchFaq({...narvarte, beds:2});
  assert.equal(faq.area, 'Narvarte Poniente');
  assert.equal(faq.mode, 'buy');
  assert.deepEqual(faq.items.map(item => item.id), ['notary', 'guarantee', 'credit', 'maintenance']);
  assert.match(faq.items[0].teaser, /4%/);
  assert.match(faq.items[0].answer, /\$300k/);
  assert.equal(faq.items[3].amount, livingCosts({...narvarte, beds:2}).items.maintenance.amount);
  const rent = searchFaq({mode:'rent', areas:['Polanco'], budget:28_000, beds:2});
  assert.equal(rent.mode, 'rent');
  assert.match(rent.items[0].teaser, /notario/);
  assert.equal(searchFaq({mode:'buy', areas:['Crédito Constructor'], budget:20_000_000, beds:1}).items[3].amount, null);
});

test('related searches use the searched colonia, its bedrooms and the next colonias', () => {
  const related = relatedSearches({...narvarte, beds:2});
  assert.equal(related.area, 'Narvarte Poniente');
  assert.equal(related.card.area, 'Narvarte Poniente');
  assert.ok(related.card.image);
  assert.deepEqual(related.beds, [2, 3, 5]);
  assert.ok(related.nearby.length > 0 && !related.nearby.includes('Narvarte Poniente'));
  assert.ok(related.parking.includes(1));
  assert.ok(homes.some(home => home.area === 'Narvarte Poniente' && matchesCriteria(home, ['text:1 estac'])));
  assert.ok(related.traits.length >= MIN_RELATED_LINKS);
  assert.ok(related.amenities.length >= MIN_RELATED_LINKS);
  assert.ok(related.nearby.length >= MIN_RELATED_LINKS);
  const fourBaths = related.traits.find(item => item.kind === 'baths' && item.count === 4);
  const raised = relatedLinkChanges({...narvarte, beds:2}, fourBaths.changes);
  assert.ok(raised.budget >= 12_500_000);
  assert.ok(matchingHomes(raised).some(home => home.area === 'Narvarte Poniente' && home.baths >= 4));
  const twoBeds = related.traits.find(item => item.kind === 'beds' && item.count === 2);
  assert.equal(relatedLinkChanges({...narvarte, beds:2}, twoBeds.changes).budget, 7_500_000);
});

test('every related-search column has seven links and every header column has at least five', () => {
  const areas = [...new Set(homes.filter(home => !home.development).map(home => home.area))];
  for (const area of areas) {
    for (const mode of ['buy', 'rent']) {
      const related = relatedSearches({mode, areas:[area], area, budget:mode === 'rent' ? 30_000 : 20_000_000, beds:1});
      if (!related) continue;
      assert.ok(related.traits.length >= MIN_RELATED_LINKS, `${mode} ${area} traits ${related.traits.length}`);
      assert.ok(related.amenities.length >= MIN_RELATED_LINKS, `${mode} ${area} amenities ${related.amenities.length}`);
      assert.ok(related.nearby.length >= MIN_RELATED_LINKS, `${mode} ${area} nearby ${related.nearby.length}`);
      assert.ok(related.traits.every(item => item.area && item.count > 0));
      assert.ok(related.amenities.every(item => item.area && (item.kind === 'parking' ? item.count > 0 : item.criterion)));
      const search = {mode, areas:[area], area, budget:mode === 'rent' ? 30_000 : 20_000_000, beds:1};
      for (const item of [...related.traits, ...related.amenities]) {
        const hits = matchingHomes(relatedLinkChanges(search, item.changes));
        assert.ok(hits.some(home => home.area === item.area), `${mode} ${area} ${item.id}`);
      }
      for (const name of related.nearby) {
        const hits = matchingHomes(relatedLinkChanges(search, {area:name, areas:[name]}));
        assert.ok(hits.some(home => home.area === name), `${mode} ${area} nearby ${name}`);
      }
    }
  }
  for (const menu of headerMenus) {
    for (const column of menu.columns) {
      assert.ok(column.items.length >= 5, `${menu.id} ${column.titleKey} ${column.items.length}`);
    }
  }
});
