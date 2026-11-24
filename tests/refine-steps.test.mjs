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

import {MAX_PLACES, togglePlaceList, placesFull, resolvePlace, suggestedLocations} from '../src/locationSearch.js';

test('a search holds at most three places', () => {
  const [a, b, c, d] = suggestedLocations(8).filter(place => place.kind === 'colonia');
  let list = [];
  for (const place of [a, b, c, d]) list = togglePlaceList(list, place);
  assert.equal(MAX_PLACES, 3);
  assert.deepEqual(list.map(place => place.key), [a, b, c].map(place => place.key));
  assert.equal(placesFull(list, d), true);
  assert.equal(togglePlaceList(list, a).length, 2);
  assert.equal(normalizeSearch({places: [a, b, c, d]}).places.length, 3);
});

import {limitPlaces, placeState, combinePlaces} from '../src/locationSearch.js';

test('up to three places of any kind in one state; a state stands alone; another state starts over', () => {
  const colonias = suggestedLocations(8).filter(place => place.kind === 'colonia');
  const city = resolvePlace('city', 'cdmx');
  const state = resolvePlace('state', 'cdmx');
  let list = togglePlaceList([], colonias[0]);
  list = togglePlaceList(list, city);
  list = togglePlaceList(list, colonias[1]);
  assert.deepEqual(list.map(place => place.kind), ['colonia', 'city', 'colonia']);
  assert.equal(togglePlaceList(list, colonias[2]), list);
  assert.deepEqual(togglePlaceList(list, state), [state]);
  assert.deepEqual(togglePlaceList([state], colonias[0]).map(place => place.key), [colonias[0].key]);
  const elsewhere = {kind: 'colonia', id: 'Otra', label: 'Otra', key: 'colonia~Otra', state: 'jal'};
  assert.equal(placeState(colonias[0]), 'cdmx');
  assert.deepEqual(togglePlaceList(list, elsewhere), [elsewhere]);
  assert.deepEqual(limitPlaces([colonias[0], elsewhere, colonias[1]]).map(place => place.key), [colonias[0].key, colonias[1].key]);
  assert.equal(combinePlaces([], colonias.slice(0, 5)).length, 3);
});

import {locationMenuChoices} from '../src/locationSearch.js';

test('the location menu shows the chosen places, or suggestions when none is chosen; typing searches', () => {
  const colonias = suggestedLocations(8).filter(place => place.kind === 'colonia');
  assert.deepEqual(locationMenuChoices([], '').map(place => place.key), suggestedLocations(8).map(place => place.key));
  assert.deepEqual(locationMenuChoices([colonias[0]], '').map(place => place.key), [colonias[0].key]);
  assert.ok(locationMenuChoices([colonias[0]], 'polanco').some(place => place.label === 'Polanco'));
});
