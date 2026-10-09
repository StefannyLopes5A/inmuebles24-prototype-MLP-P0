import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {NEIGHBORHOOD_CENTROIDS} from '../src/mapLocations.js';
import {allColoniaNames, coloniaVision} from '../src/mapWidgetContent.js';
import {
  adaptiveSlot, buildStack, cityReading, pickColonia, resolveLevel, spoilerFor,
} from '../src/mapWidgets.js';

const search = {mode: 'buy', areas: ['Narvarte Poniente'], budget: 7_500_000, beds: 2, note: ''};

test('every catalog colonia has an invented perception score and alcaldía', () => {
  for (const name of Object.keys(NEIGHBORHOOD_CENTROIDS)) {
    const vision = coloniaVision(name);
    assert.ok(vision, name);
    assert.equal(vision.name, name);
    assert.ok(vision.feelSafe >= 28 && vision.feelSafe <= 92, `${name} feelSafe ${vision.feelSafe}`);
    assert.ok(['high', 'mid', 'low'].includes(vision.safetyBand));
    assert.ok(vision.alcaldia);
  }
  assert.equal(allColoniaNames().length, Object.keys(NEIGHBORHOOD_CENTROIDS).length);
});

test('zoom hysteresis keeps city until colonia zoom and does not flicker back immediately', () => {
  assert.equal(resolveLevel({zoom: 11.2, previous: 'colonia'}), 'city');
  assert.equal(resolveLevel({zoom: 12.3, previous: 'city'}), 'city');
  assert.equal(resolveLevel({zoom: 12.5, previous: 'city'}), 'colonia');
  assert.equal(resolveLevel({zoom: 12.3, previous: 'colonia'}), 'colonia');
  assert.equal(resolveLevel({zoom: 11.9, previous: 'colonia'}), 'city');
  assert.equal(resolveLevel({zoom: 14, selectedId: 'buy-1', previous: 'colonia'}), 'home');
});

test('colonia pick uses the local polygon when the center is inside it', () => {
  const narvarte = NEIGHBORHOOD_CENTROIDS['Narvarte Poniente'];
  assert.equal(pickColonia(narvarte, 'Narvarte Poniente'), 'Narvarte Poniente');
  const almost = [narvarte[0] + 0.002, narvarte[1] + 0.002];
  assert.equal(pickColonia(almost, 'Narvarte Poniente'), 'Narvarte Poniente');
  const delValle = NEIGHBORHOOD_CENTROIDS['Del Valle Centro'];
  assert.equal(pickColonia(delValle, 'Narvarte Poniente'), 'Del Valle Centro');
});

test('stack never exceeds four widgets and follows city, colonia and home recipes', () => {
  const city = buildStack({level: 'city', colonia: 'Polanco', search, language: 'es-MX', session: {homes}});
  assert.equal(city.widgets.length, 4);
  assert.equal(city.widgets[0].kind, 'summary');
  assert.match(city.widgets[0].title, /Benito Juárez/);
  assert.equal(city.widgets[0].title.includes('recorte'), false);
  assert.deepEqual(city.widgets.slice(1).map(widget => widget.id), ['matching', 'price', 'trend']);
  assert.equal(city.widgets.filter(widget => widget.mora).length, 1);
  assert.equal(city.widgets[1].items.length, 3);
  assert.equal(city.widgets[2].title, 'Precio en estas colonias');
  assert.equal(city.widgets[2].headline, '$62,400');
  assert.equal(city.widgets.some(widget => widget.kind === 'safety'), false);

  const colonia = buildStack({level: 'colonia', colonia: 'Narvarte Poniente', search, language: 'es-MX', session: {homes}});
  assert.equal(colonia.widgets.length, 4);
  assert.deepEqual(colonia.widgets.map(widget => widget.id), ['summary', 'price', 'trend', 'nearby']);
  assert.equal(colonia.widgets[1].title, 'Precio en Narvarte Poniente');
  const nearby = colonia.widgets[3];
  assert.equal(nearby.kicker, 'a pie');
  assert.deepEqual(nearby.tiles.map(tile => tile.kind), ['transport', 'green', 'education', 'food']);
  assert.equal(nearby.tiles[0].headline, 'Metro a 6 min');
  assert.equal(nearby.tiles[0].support, 'Metro Eugenia');
  assert.equal(nearby.bars, undefined);

  const home = homes.find(item => item.area === 'Narvarte Poniente' && item.size >= 20);
  const listing = buildStack({level: 'home', colonia: home.area, search, home, language: 'es-MX'});
  assert.equal(listing.widgets.length, 4);
  assert.equal(listing.widgets[1].id, 'vs-colonia');
});

test('city reading stays with the search alcaldía, not the map-center colonia', () => {
  const reading = cityReading({search, homes, language: 'es-MX'});
  assert.equal(reading.alcaldia, 'Benito Juárez');
  assert.equal(reading.items[0].name, 'Narvarte Poniente');
  assert.equal(reading.medianPerM2, 62_400);
  assert.equal(coloniaVision('Narvarte Poniente').alcaldia, 'Benito Juárez');
});

test('adaptive slot prefers commute, neighbors or nearby from the search, with safety as a mention', () => {
  const vision = coloniaVision('Narvarte Poniente');
  assert.equal(adaptiveSlot({search, vision, level: 'colonia'}).primary, 'nearby');
  assert.ok(adaptiveSlot({search, vision, level: 'colonia'}).mentions.includes('safety'));
  assert.equal(adaptiveSlot({search: {...search, beds: 3}, vision, level: 'colonia'}).primary, 'neighbors');
  assert.equal(adaptiveSlot({search: {...search, note: 'trabajo en Polanco'}, vision, level: 'colonia'}).primary, 'commute');
  const centro = coloniaVision('Colonia Centro');
  assert.equal(adaptiveSlot({search, vision: centro, level: 'colonia'}).primary, 'soil');
});

test('public stack omits spoiler numbers; spoilerFor returns them only when asked', () => {
  const stack = buildStack({level: 'colonia', colonia: 'Narvarte Poniente', search, language: 'es-MX', session: {homes}});
  const blob = JSON.stringify(stack);
  assert.equal(blob.includes('fairPerM2'), false);
  assert.equal(blob.includes('spoilerPct'), false);
  assert.equal(blob.includes('forecast3'), false);
  const price = spoilerFor('price', 'Narvarte Poniente');
  const trend = spoilerFor('trend', 'Narvarte Poniente');
  assert.equal(price.fairPerM2, 58_900);
  assert.equal(trend.forecast3, 9.1);
});
