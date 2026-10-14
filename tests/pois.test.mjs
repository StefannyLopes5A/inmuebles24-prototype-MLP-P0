import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import collection from '../src/data/pois.json' with {type: 'json'};
import {placeFeature} from '../src/coloniaPolygons.js';
import {NEIGHBORHOOD_CENTROIDS} from '../src/mapLocations.js';
import {
  CITY_CATEGORIES, KIND_CATEGORY, NEARBY_RADIUS_M, POI_CATEGORIES, catalogCounts, categoryCounts, nearbyCounts, nearbyPois, poiCollection, poiIconUrl, poiScope,
  poisFor, poisNear, scopeCategories,
} from '../src/pois.js';

const ALL_IDS = POI_CATEGORIES.map(category => category.id);

test('every POI has a known category and areas that exist in the selector polygons', () => {
  assert.equal(collection.features.length, 5179);
  for (const feature of collection.features) {
    assert.ok(ALL_IDS.includes(feature.properties.categoria), feature.properties.id);
    for (const area of feature.properties.areas) assert.ok(placeFeature(area), area);
  }
});

test('the eight categories use local Maki icons and the agreed colors', () => {
  assert.deepEqual(ALL_IDS, ['metro', 'escola', 'parque', 'hospital', 'supermercado', 'cafe', 'bar_restaurante', 'comercio']);
  assert.deepEqual(POI_CATEGORIES.map(category => category.color),
    ['#2F6BFF', '#F5B800', '#16A34A', '#E5243B', '#0E9F9A', '#A8551B', '#F5641E', '#9B4DFF']);
  for (const category of POI_CATEGORIES) {
    assert.equal(category.ink, category.id === 'escola' ? '#1C1C1E' : '#FFFFFF');
    assert.ok(existsSync(new URL(`../public${poiIconUrl(category.id)}`, import.meta.url)), category.id);
  }
  for (const id of Object.values(KIND_CATEGORY)) assert.ok(ALL_IDS.includes(id));
});

test('the map shows every POI of the active categories, with no neighborhood filter', () => {
  const all = poisFor(poiScope({areas: ['Narvarte Poniente']}), ALL_IDS);
  assert.equal(all.length, collection.features.length);
  assert.equal(poisFor(poiScope({areas: []}), ALL_IDS).length, all.length);
  assert.equal(poisFor(poiScope({areas: ['Narvarte Poniente']}, 'Roma Norte'), ALL_IDS).length, all.length);
  const cafes = poisFor(null, ['cafe']);
  assert.ok(cafes.length > 0);
  assert.ok(cafes.every(feature => feature.properties.categoria === 'cafe'));
  assert.equal(poisFor(null, []).length, 0);
  assert.deepEqual(Object.keys(catalogCounts()), ALL_IDS);
  assert.equal(catalogCounts().cafe, cafes.length);
});

test('area counts still describe a colonia, for the nearby card', () => {
  const scope = poiScope({areas: ['Narvarte Poniente']});
  const inArea = collection.features.filter(feature => feature.properties.areas.includes('Narvarte Poniente'));
  assert.equal(Object.values(categoryCounts(scope)).reduce((sum, count) => sum + count, 0), inArea.length);
  const city = poiScope({areas: []});
  assert.equal(city.kind, 'city');
  assert.deepEqual(scopeCategories(city), CITY_CATEGORIES);
  assert.deepEqual(Object.keys(categoryCounts(city)), CITY_CATEGORIES);
  const picked = poiScope({areas: ['Narvarte Poniente']}, 'Roma Norte');
  assert.deepEqual(picked.names, ['Roma Norte']);
});

test('metro and schools always show; the other categories wait for closer zooms', () => {
  const minzoom = Object.fromEntries(POI_CATEGORIES.map(category => [category.id, category.minzoom]));
  assert.equal(minzoom.metro, 0);
  assert.equal(minzoom.escola, 0);
  for (const id of ALL_IDS.filter(id => !['metro', 'escola'].includes(id))) assert.ok(minzoom[id] >= 14, id);
  for (const category of POI_CATEGORIES) assert.ok(Number.isInteger(category.minzoom), category.id);
});

test('everything within the radius of a home shows, nearest first, from any area', () => {
  const center = NEIGHBORHOOD_CENTROIDS['Roma Norte'];
  const near = poisNear(center, ALL_IDS);
  assert.ok(near.length > 8);
  assert.ok(near.every(feature => feature.properties.meters <= NEARBY_RADIUS_M));
  for (let i = 1; i < near.length; i += 1) assert.ok(near[i - 1].properties.meters <= near[i].properties.meters);
  assert.equal(near.length, nearbyPois(center, collection.features).length);
  assert.deepEqual(nearbyPois(null, near), []);
});

test('nearby counts match the points shown around the home, per category', () => {
  const center = NEIGHBORHOOD_CENTROIDS['Roma Norte'];
  const counts = nearbyCounts(center);
  assert.deepEqual(Object.keys(counts), ALL_IDS);
  for (const id of ALL_IDS) assert.equal(counts[id], poisNear(center, [id]).length, id);
  assert.equal(poisNear(center, []).length, 0);
});

test('the map source carries id, name, category, its zoom rank and distance when known', () => {
  const fc = poiCollection(poisFor(poiScope({areas: ['Polanco']}), ['metro']));
  assert.equal(fc.type, 'FeatureCollection');
  assert.deepEqual(Object.keys(fc.features[0].properties).sort(), ['categoria', 'id', 'minzoom', 'name', 'rank']);
  const near = poiCollection(poisNear(NEIGHBORHOOD_CENTROIDS.Polanco, ['cafe']));
  assert.ok(near.features.every(feature => typeof feature.properties.meters === 'number'));
});
