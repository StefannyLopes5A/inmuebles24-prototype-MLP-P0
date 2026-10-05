import test from 'node:test';
import assert from 'node:assert/strict';
import {priceDistribution} from '../src/homeSearchModel.js';
import {priceRangeAtBar, priceRangeEdge, selectedPriceBars} from '../src/priceRange.js';
import {DEFAULT_SEARCH, journeyUrl, matchingHomes, readJourney} from '../src/journey.js';
import {listingPrice} from '../src/data.js';

const {bins, ceiling} = priceDistribution([], 'buy', 32);

test('a full selection can contract from either end and never swaps bounds', () => {
  const selection = selectedPriceBars(bins, 0, ceiling);
  assert.equal(priceRangeEdge(.5, selection), 'min');
  assert.equal(priceRangeEdge(31.5, selection), 'max');
  assert.deepEqual(priceRangeAtBar(bins, 0, ceiling, 'min', 5), {minBudget:2500000,budget:16000000});
  assert.deepEqual(priceRangeAtBar(bins, 0, ceiling, 'max', 12), {minBudget:0,budget:6500000});
  assert.deepEqual(priceRangeAtBar(bins, 2500000, 6500000, 'min', 100), {minBudget:6000000,budget:6500000});
  assert.deepEqual(priceRangeAtBar(bins, 2500000, 6500000, 'max', -100), {minBudget:2500000,budget:3000000});
});

test('unselected bars extend only the bound on their own side', () => {
  const selection = selectedPriceBars(bins, 2500000, 6500000);
  const left = priceRangeAtBar(bins, 2500000, 6500000, priceRangeEdge(2.5, selection), 2);
  const right = priceRangeAtBar(bins, 2500000, 6500000, priceRangeEdge(20.5, selection), 20);
  assert.deepEqual(left, {minBudget:1000000,budget:6500000});
  assert.deepEqual(right, {minBudget:2500000,budget:10500000});
  assert.equal(priceRangeEdge(5.5, selection), 'min');
  assert.equal(priceRangeEdge(12.5, selection), 'max');
});

test('both ends remain reachable when only one price bin is selected', () => {
  const selection = selectedPriceBars(bins, 2500000, 3000000);
  assert.deepEqual(selection, {first:5,last:5});
  assert.equal(priceRangeEdge(5.2, selection), 'min');
  assert.equal(priceRangeEdge(5.8, selection), 'max');
  assert.deepEqual(priceRangeAtBar(bins, 2500000, 3000000, 'min', 2), {minBudget:1000000,budget:3000000});
  assert.deepEqual(priceRangeAtBar(bins, 2500000, 3000000, 'max', 8), {minBudget:2500000,budget:4500000});
});

test('drag clamps outside the chart and preserves the exact opposite typed amount', () => {
  assert.deepEqual(priceRangeAtBar(bins, 2123456, 7123456, 'min', -100), {minBudget:0,budget:7123456});
  assert.deepEqual(priceRangeAtBar(bins, 2123456, 7123456, 'max', 100), {minBudget:2123456,budget:ceiling});
  assert.deepEqual(priceRangeAtBar(bins, 20000000, 25000000, 'max', 1), {minBudget:20000000,budget:25000000});
  assert.deepEqual(priceRangeAtBar(bins, 20000000, 25000000, 'min', 3), {minBudget:1500000,budget:25000000});
});

test('rental bins use rental prices, and graph changes survive navigation and filter real results', () => {
  const rental = priceDistribution([], 'rent', 32);
  assert.deepEqual(priceRangeAtBar(rental.bins, 0, 80000, 'max', 5), {minBudget:0,budget:30000});
  const range = priceRangeAtBar(bins, 0, 7500000, 'min', 10);
  const search = {...DEFAULT_SEARCH, propertyType:'apartment', ...range};
  const restored = readJourney(journeyUrl({page:'results',search})).search;
  assert.equal(restored.minBudget, 5000000);
  assert.equal(restored.budget, 7500000);
  const matches = matchingHomes(restored);
  assert.ok(matches.length > 0);
  assert.ok(matches.every(home => listingPrice(home) >= 5000000 && listingPrice(home) <= 7500000));
});
