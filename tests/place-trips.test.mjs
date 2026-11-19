import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {homeCoordinates} from '../src/mapLocations.js';
import {MAX_PLACES, suggestPlaces} from '../src/placeTrips.js';

const center = homeCoordinates(homes.find(home => home.id === 'buy-148816386'));

test('an empty query suggests the closest places, one of each kind first', () => {
  const places = suggestPlaces(center, '');
  assert.equal(places.length, 8);
  assert.equal(new Set(places.slice(0, 7).map(place => place.categoria)).size, 7);
  assert.ok(places.every(place => place.meters > 0 && place.minutes.walk >= 1 && place.minutes.transit >= 1));
  assert.ok(places.every(place => Array.isArray(place.coordinates) && place.coordinates.length === 2));
  const [near, far] = [...places].sort((a, b) => a.meters - b.meters);
  assert.ok(far.minutes.walk >= near.minutes.walk);
});

test('typing matches the name or the kind, and a chosen place drops out', () => {
  const schools = suggestPlaces(center, 'escuela');
  assert.ok(schools.length > 0);
  assert.ok(schools.every(place => place.categoria === 'escola'));
  const metros = suggestPlaces(center, 'metro');
  assert.ok(metros.every((place, index) => index === 0 || place.meters >= metros[index - 1].meters));
  const first = suggestPlaces(center, '')[0];
  const again = suggestPlaces(center, first.name.slice(0, 5));
  assert.ok(again.some(place => place.id === first.id));
  assert.ok(suggestPlaces(center, '', {exclude:[first.id]}).every(place => place.id !== first.id));
  assert.deepEqual(suggestPlaces(center, 'zzzz-ningun-lugar'), []);
  assert.equal(MAX_PLACES, 3);
});
