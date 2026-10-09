import test from 'node:test';
import assert from 'node:assert/strict';
import {areas} from '../src/data.js';
import {NEIGHBORHOOD_CENTROIDS} from '../src/mapLocations.js';
import {
  coloniaContains, featureBounds, pickColonia, placeFeature, placeNivel, searchPlace,
} from '../src/coloniaPolygons.js';
import {overlayCollections, placeMatchesSearch} from '../src/mapWidgets.js';

const SELECTOR = areas.filter(name => name !== 'Ambas zonas');
const MISSING = [
  'Barrio Candelaria TicomAn',
  'Campestre Churubusco',
  'Crédito Constructor',
  'Del Valle Norte',
  'Lomas de Tarango',
  'Nápoles',
  'Portales Sur',
  'San José Insurgentes',
  'Xoco',
];

test('colonias.json covers the location selector except city and nine pending colonias', () => {
  assert.equal(placeFeature('Ciudad de México'), null);
  assert.equal(placeFeature('Ambas zonas'), null);
  assert.equal(placeNivel('Benito Juárez'), 'alcaldia');
  assert.equal(placeNivel('Narvarte Poniente'), 'colonia');
  for (const name of SELECTOR) {
    if (MISSING.includes(name)) assert.equal(placeFeature(name), null, name);
    else assert.ok(placeFeature(name), name);
  }
});

test('search place is city, alcaldía polygon, colonia polygon or listings-only', () => {
  assert.equal(searchPlace({areas: []}).kind, 'city');
  assert.equal(searchPlace({areas: ['Benito Juárez']}).kind, 'alcaldia');
  assert.equal(searchPlace({areas: ['Narvarte Poniente']}).kind, 'colonia');
  assert.equal(searchPlace({areas: ['Nápoles']}).kind, 'listings');
});

test('Narvarte centroid is inside its ring; Nápoles has no outline', () => {
  const narvarte = NEIGHBORHOOD_CENTROIDS['Narvarte Poniente'];
  assert.equal(coloniaContains('Narvarte Poniente', narvarte), true);
  const bounds = featureBounds(placeFeature('Narvarte Poniente'));
  assert.ok(bounds[0][0] < bounds[1][0] && bounds[0][1] < bounds[1][1]);
  assert.equal(overlayCollections({colonia: 'Narvarte Poniente'}).focus.features[0].properties.name, 'Narvarte Poniente');
  assert.equal(overlayCollections({colonia: 'Nápoles'}).focus.features.length, 0);
  assert.equal(overlayCollections({colonia: 'Benito Juárez'}).focus.features[0].properties.nivel, 'alcaldia');
});

test('pickColonia follows the polygon, then falls back to the nearest centroid', () => {
  const narvarte = NEIGHBORHOOD_CENTROIDS['Narvarte Poniente'];
  assert.equal(pickColonia(narvarte, 'Narvarte Poniente'), 'Narvarte Poniente');
  const delValle = NEIGHBORHOOD_CENTROIDS['Del Valle Centro'];
  assert.equal(pickColonia(delValle, 'Narvarte Poniente'), 'Del Valle Centro');
  assert.equal(pickColonia(NEIGHBORHOOD_CENTROIDS.Nápoles, 'Narvarte Poniente'), 'Nápoles');
});

test('alcaldía search still matches colonias inside it', () => {
  const search = {areas: ['Benito Juárez']};
  assert.equal(placeMatchesSearch('Benito Juárez', search), true);
  assert.equal(placeMatchesSearch('Narvarte Poniente', search), true);
  assert.equal(placeMatchesSearch('Polanco', search), false);
});
