import assert from 'node:assert/strict';
import test from 'node:test';
import {alertKey, journeyUrl, matchingHomes, normalizeSearch, readJourney} from '../src/journey.js';
import {readSavedSearches, savedSearchChips, savedSearchMeta, savedSearchTitle} from '../src/savedSearches.js';

const money = amount => `$${new Intl.NumberFormat('es-MX', {maximumFractionDigits:0}).format(amount)}`;

test('saved searches describe the real filters and reopen from the account page', () => {
  const search = normalizeSearch({mode:'buy', propertyType:'house', areas:[], beds:2, budget:7_500_000});
  assert.equal(savedSearchTitle(search, 'es-MX'), 'Casas con 2 recámaras en venta en Ciudad de México');
  const chips = savedSearchChips(search, {language:'es-MX', money, currency:'MXN'});
  assert.deepEqual(chips.slice(0, 3), ['Comprar', 'Casa', 'Ciudad de México']);
  assert.ok(chips.includes('2 recámaras+'));
  assert.equal(chips.some(chip => /baño/.test(chip)), false);
  const located = normalizeSearch({mode:'buy', beds:2, budget:7_500_000, places:[
    {kind:'colonia', id:'Narvarte Poniente'},
    {kind:'metro', id:'node/12603540631'},
  ]});
  assert.match(savedSearchTitle(located, 'es-MX'), /Narvarte Poniente y Metro Insurgentes Sur/);
  assert.equal(savedSearchMeta(0, null, 'es-MX'), '0 inmuebles coinciden hoy');
  assert.match(savedSearchMeta(matchingHomes(located).length, Date.parse('2026-11-17T18:00:00Z'), 'es-MX'), /coinciden hoy · Guardada el 17 de noviembre/);
  const key = alertKey(search);
  const fromKey = readSavedSearches([key]);
  assert.equal(fromKey[0].search.propertyType, 'house');
  assert.equal(fromKey[0].savedAt, null);
  const read = readSavedSearches([{key, savedAt:1, search}, {key:'nope'}]);
  assert.equal(read.length, 1);
  assert.equal(read[0].savedAt, 1);
  assert.equal(readJourney(journeyUrl({page:'saved', search:located})).page, 'saved');
});
