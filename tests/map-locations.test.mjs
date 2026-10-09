import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {homeCoordinates, neighborhoodCentroid, resultsBounds, searchBounds, compactPrice} from '../src/mapLocations.js';

const BBOX = {west: -99.36, south: 19.25, east: -99.05, north: 19.55};

test('every catalog listing resolves to a colonia centroid inside the local map extract', () => {
  for (const home of homes) {
    assert.notDeepEqual(neighborhoodCentroid(home), [-99.17, 19.41], `missing centroid for ${home.location}`);
    const [lng, lat] = homeCoordinates(home);
    assert.ok(lng > BBOX.west && lng < BBOX.east && lat > BBOX.south && lat < BBOX.north, `${home.id} outside bbox`);
  }
});

test('pin positions are deterministic, near their colonia and never identical', () => {
  const seen = new Set();
  for (const home of homes) {
    const first = homeCoordinates(home);
    assert.deepEqual(homeCoordinates({...home}), first);
    const [lng, lat] = neighborhoodCentroid(home);
    assert.ok(Math.abs(first[0] - lng) < 0.004 && Math.abs(first[1] - lat) < 0.004, `${home.id} drifted from its colonia`);
    const key = first.join(',');
    assert.equal(seen.has(key), false, `${home.id} stacks on another pin`);
    seen.add(key);
  }
});

test('results bounds cover every visible pin', () => {
  const sample = homes.slice(0, 12);
  const [[west, south], [east, north]] = resultsBounds(sample);
  for (const home of sample) {
    const [lng, lat] = homeCoordinates(home);
    assert.ok(lng >= west && lng <= east && lat >= south && lat <= north);
  }
  assert.equal(resultsBounds([]), null);
});

test('search bounds stay on the queried colonia instead of the whole catalog', () => {
  const search = {areas: ['Narvarte Poniente']};
  const [[west, south], [east, north]] = searchBounds(homes, search);
  const narvarte = homes.filter(home => home.area === 'Narvarte Poniente');
  const outsider = homes.find(home => home.area !== 'Narvarte Poniente');
  assert.ok(narvarte.length);
  for (const home of narvarte) {
    const [lng, lat] = homeCoordinates(home);
    assert.ok(lng >= west && lng <= east && lat >= south && lat <= north);
  }
  const [lng, lat] = homeCoordinates(outsider);
  assert.equal(lng >= west && lng <= east && lat >= south && lat <= north, false);
  assert.deepEqual(searchBounds(homes, {}), resultsBounds(homes));
});

test('compact pin prices follow language and demo currency', () => {
  assert.equal(compactPrice(4800000, 'MXN', 'es-MX'), '$4.8 M');
  assert.equal(compactPrice(4800000, 'MXN', 'pt-BR'), '$4,8 mi');
  assert.equal(compactPrice(28000, 'MXN', 'es-MX'), '$28 mil');
  assert.equal(compactPrice(4800000, 'USD', 'es-MX'), 'US$240 mil');
  assert.equal(compactPrice(null), '—');
});
