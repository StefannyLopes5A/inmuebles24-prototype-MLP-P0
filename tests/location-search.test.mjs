import assert from 'node:assert/strict';
import test from 'node:test';
import {matchingHomes, journeyUrl, readJourney} from '../src/journey.js';
import {searchLocations, suggestedLocations, visiblePlaces, areasFromPlaces} from '../src/locationSearch.js';

const groups = query => new Set(searchLocations(query, 8).map(place => place.group));

test('location search recognizes the city, colonias, streets and mapped places', () => {
  const city = searchLocations('ciudad de mexico', 4);
  assert.ok(city.some(place => place.kind === 'city') && city.some(place => place.kind === 'state'));
  assert.ok(searchLocations('narvarte', 8).some(place => place.kind === 'colonia' && place.label === 'Narvarte Poniente'));
  const street = searchLocations('arquimedes', 8).find(place => place.kind === 'street');
  assert.ok(street, 'a catalog street is suggested');
  assert.ok(groups('universidad').has('university'));
  assert.ok(groups('escuela').has('school'));
  assert.ok(groups('hospital').has('hospital'));
  assert.ok(groups('metro').has('metro'));
  assert.equal(searchLocations('x', 8).length, 0);
  const suggested = suggestedLocations(8);
  assert.equal(suggested[0]?.kind, 'city');
  assert.ok(suggested.slice(1).every(place => place.kind === 'colonia'));
  assert.ok(suggested.length > 1);
});

test('several places match as a union and a saved search keeps each pill', () => {
  const narvarte = searchLocations('narvarte poniente', 4).find(place => place.kind === 'colonia');
  const polanco = searchLocations('polanco', 8).find(place => place.kind === 'colonia' && place.label === 'Polanco');
  const homes = matchingHomes({mode:'buy', beds:1, budget:50_000_000, places:[narvarte, polanco]});
  assert.ok(homes.some(home => home.area === 'Narvarte Poniente') && homes.some(home => home.area === 'Polanco'));
  assert.ok(homes.every(home => home.area === 'Narvarte Poniente' || home.area === 'Polanco'));
  const metro = searchLocations('metro', 40).find(place => place.kind === 'metro' && matchingHomes({mode:'buy', beds:1, budget:50_000_000, places:[place]}).length);
  const near = matchingHomes({mode:'buy', beds:1, budget:50_000_000, places:[metro]});
  assert.ok(near.length && near.every(home => metro.areas.includes(home.area)));
  const round = readJourney(journeyUrl({page:'results', search:{mode:'buy', beds:2, budget:7_500_000, places:[narvarte, metro]}}));
  assert.deepEqual(round.search.places.map(place => place.key), [narvarte.key, metro.key]);
  assert.deepEqual(visiblePlaces(round.search).map(place => place.label), [narvarte.label, metro.label]);
  assert.deepEqual(areasFromPlaces([{kind:'city', id:'cdmx'}]), []);
});
