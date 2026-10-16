import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {NEIGHBORHOOD_CENTROIDS} from '../src/mapLocations.js';
import {allColoniaNames, coloniaVision} from '../src/mapWidgetContent.js';
import {
  adaptiveSlot, buildStack, cityReading, nearbySlots, pickColonia, resolveLevel, spoilerFor,
} from '../src/mapWidgets.js';
import {KIND_CATEGORY, categoryCounts, nearbyCounts, placesAround, poiScope} from '../src/pois.js';

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
  assert.deepEqual(colonia.widgets.map(widget => widget.id), ['summary', 'nearby', 'price', 'trend']);
  assert.equal(colonia.widgets[2].title, 'Precio en Narvarte Poniente');
  assert.deepEqual(colonia.widgets[2].compare.map(row => row.current), [true, false, false]);
  assert.equal(city.widgets[2].compare.some(row => row.current != null), false);
  const trend = colonia.widgets[3];
  assert.equal(trend.statement, true);
  assert.equal(trend.support, undefined);
  assert.deepEqual(trend.legend, {subject: 'Narvarte Poniente', compare: 'CDMX'});
  const statements = {up: ['Sube más que CDMX', 'Sobe mais que a CDMX'], down: ['Baja frente a CDMX', 'Cai frente à CDMX'], flat: ['Al ritmo de CDMX', 'No ritmo da CDMX']};
  assert.equal(trend.headline, statements[trend.direction][0]);
  const trendPt = buildStack({level: 'colonia', colonia: 'Narvarte Poniente', search, language: 'pt-BR', session: {homes}}).widgets[3];
  assert.equal(trendPt.headline, statements[trendPt.direction][1]);
  const nearby = colonia.widgets[1];
  assert.equal(nearby.kicker, 'a pie');
  assert.deepEqual(nearby.tiles.map(tile => tile.kind), ['transport', 'green', 'education', 'food']);
  assert.equal(nearby.tiles[0].headline, 'Metro a 6 min');
  assert.equal(nearby.tiles[0].support, 'Metro Eugenia');
  assert.equal(nearby.bars, undefined);

  const places = placesAround(NEIGHBORHOOD_CENTROIDS['Narvarte Poniente'], Object.values(KIND_CATEGORY), {area: 'Narvarte Poniente'});
  const filters = categoryCounts(poiScope({areas: ['Narvarte Poniente']}));
  for (const categoria of Object.values(KIND_CATEGORY)) assert.equal(places[categoria].count, filters[categoria], categoria);
  const around = placesAround(NEIGHBORHOOD_CENTROIDS['Roma Norte'], Object.values(KIND_CATEGORY));
  const near = nearbyCounts(NEIGHBORHOOD_CENTROIDS['Roma Norte']);
  for (const categoria of Object.values(KIND_CATEGORY)) assert.equal(around[categoria].count, near[categoria], categoria);

  const empty = {count: 0, items: [], closest: null}, some = {count: 3, items: [{id: 'x', name: 'X', minutes: 2}], closest: null};
  const sparse = {metro: some, parque: empty, escola: empty, cafe: some, supermercado: empty, hospital: some, bar_restaurante: some, comercio: some, base: {radius: 500}};
  assert.deepEqual(nearbySlots(sparse), ['metro', 'hospital', 'bar_restaurante', 'cafe']);
  assert.deepEqual(nearbySlots({...sparse, hospital: empty, bar_restaurante: empty, comercio: empty}), ['metro', 'parque', 'escola', 'cafe']);
  const real = buildStack({level: 'colonia', colonia: 'Narvarte Poniente', search, places, language: 'es-MX', session: {homes}}).widgets[1];
  assert.equal(real.kind, 'nearby');
  for (const tile of real.tiles) {
    const place = places[tile.kind];
    assert.equal(tile.metric, String(place.count), tile.kind);
    assert.equal(tile.support, undefined);
    if (place.count) assert.ok(tile.items.length >= 1 && tile.items.length <= Math.min(5, place.count));
    else assert.equal(tile.items.length, place.closest ? 1 : 0);
    assert.ok(tile.items.every(item => item.name && item.minutes >= 1));
    assert.equal(new Set(tile.items.map(item => item.name)).size, tile.items.length);
    for (let i = 1; i < tile.items.length; i += 1) assert.ok(tile.items[i - 1].minutes <= tile.items[i].minutes);
  }

  const home = homes.find(item => item.area === 'Narvarte Poniente' && item.size >= 20);
  const listing = buildStack({level: 'home', colonia: home.area, search, home, language: 'es-MX'});
  assert.equal(listing.widgets.length, 4);
  assert.equal(listing.widgets[0].title, `Este inmueble en ${home.street}`);
  assert.equal(listing.widgets[1].id, 'vs-colonia');
});

test('city reading stays with the search alcaldía, not the map-center colonia', () => {
  const reading = cityReading({search, homes, language: 'es-MX'});
  assert.equal(reading.alcaldia, 'Benito Juárez');
  assert.equal(reading.items[0].name, 'Narvarte Poniente');
  assert.equal(reading.medianPerM2, 62_400);
  assert.equal(coloniaVision('Narvarte Poniente').alcaldia, 'Benito Juárez');
});

test('adaptive slot prefers commute, soil or nearby; neighbor reviews stay in the summary', () => {
  const vision = coloniaVision('Narvarte Poniente');
  assert.equal(adaptiveSlot({search, vision, level: 'colonia'}).primary, 'nearby');
  assert.ok(adaptiveSlot({search, vision, level: 'colonia'}).mentions.includes('safety'));
  assert.equal(adaptiveSlot({search: {...search, beds: 3}, vision, level: 'colonia'}).primary, 'nearby');
  assert.equal(adaptiveSlot({search, vision, session: {sawPoi: true}, level: 'colonia'}).primary, 'nearby');
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
