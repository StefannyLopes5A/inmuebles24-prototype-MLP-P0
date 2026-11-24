import test from 'node:test';
import assert from 'node:assert/strict';
import {nextRefineStep, applyRefineAnswer, isTooOpen, refineOptions} from '../src/refineSteps.js';
import {normalizeSearch} from '../src/journey.js';

const open = {areas: [], area: 'Ambas zonas', mode: 'buy', beds: 2, budget: 7_500_000, criteria: [], address: ''};

test('asks in order: location, operation, type, rooms, price, amenities', () => {
  const seen = new Set();
  let search = {...open};
  const asked = [];
  for (let i = 0; i < 8; i++) {
    const step = nextRefineStep(search, {}, seen);
    if (!step) break;
    asked.push(step); seen.add(step);
    const option = refineOptions(step, search)[0];
    search = applyRefineAnswer(step, option.value, search);
  }
  assert.deepEqual(asked, ['area', 'mode', 'propertyType', 'beds', 'budget', 'criteria']);
});

test('a location-only search asks for the operation next', () => {
  const search = normalizeSearch({areas: ['Narvarte Poniente']});
  assert.equal(nextRefineStep(search), 'mode');
  assert.equal(isTooOpen(search), true);
});

test('home choices count and a full search is not too open', () => {
  const search = normalizeSearch({areas: ['Narvarte Poniente'], propertyType: 'apartment'});
  assert.equal(nextRefineStep(search, {mode: true, propertyType: true, beds: true, budget: true}), 'criteria');
  assert.equal(isTooOpen(search, {mode: true, propertyType: true, beds: true, budget: true}), false);
});

test('rooms are skipped for non-residential types', () => {
  const search = normalizeSearch({areas: ['Narvarte Poniente'], propertyType: 'office'});
  assert.equal(nextRefineStep(search, {budget: true}), 'criteria');
});

test('answers land in the filters; changing operation resets the budget', () => {
  const rent = applyRefineAnswer('mode', 'rent', normalizeSearch({areas: ['Narvarte Poniente']}));
  assert.equal(rent.mode, 'rent'); assert.equal(rent.budget, 28_000);
  assert.deepEqual(applyRefineAnswer('criteria', 'pets', rent).criteria, ['pets']);
  assert.equal(normalizeSearch(applyRefineAnswer('beds', 3, rent)).beds, 3);
  const placed = normalizeSearch(applyRefineAnswer('area', refineOptions('area', open)[0].value, normalizeSearch(open)));
  assert.ok(placed.areas.length >= 1);
});
