import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {DEFAULT_SEARCH, matchingHomes, normalizeSearch, pinShowcaseDevelopments, prototypeResults, readJourney, journeyUrl, spreadTourListings} from '../src/journey.js';
import {listingCardTags} from '../src/listingCardTags.js';
import {developmentFacts, developmentKind} from '../src/development/listingFacts.js';
import {BUILDING, floorAt, unitAt, unitId, unitIndex} from '../src/development/buildingConfig.js';
import {UNITS, available, RANGES, TORRE_OLMO_HOME, GALLERY, TYPOLOGIES, UNIT_HOMES, developmentGallery, unitHomeId} from '../src/development/torreOlmo.js';
import {DEFAULT_FILTERS, listedUnits, moraAnswer, moraIntent, priceHistogram, unitMatches} from '../src/development/units.js';
import {easeDrawer, easeInOut, easeOut} from '../src/development/easing.js';
import {nightFactor} from '../src/development/scene.js';
import {developmentAnalysis, unitAnalysis} from '../src/development/moraDevelopment.js';

const torre = homes.find(home => home.id === 'torre-olmo');

test('Torre Olmo enters the catalog as a development with a 3D tour', () => {
  assert.ok(torre);
  assert.equal(torre.id, TORRE_OLMO_HOME.id);
  assert.equal(torre.development, true);
  assert.equal(torre.mode, 'buy');
  assert.equal(torre.area, 'Polanco V Sección');
  assert.match(torre.image, /render-fachada/);
  assert.match(torre.video, /\.mp4$/);
  assert.equal(torre.price, RANGES.price[0]);
});

test('the card kind, facts and Tour 3D badge belong to the development', () => {
  assert.equal(developmentKind('es-MX'), 'Unidades desde');
  assert.equal(developmentKind('pt-BR'), 'Unidades a partir de');
  assert.deepEqual(developmentFacts('es-MX'), ['64–128 m²', '1–3 recámaras', '0–1 estac.']);
  assert.deepEqual(developmentFacts('pt-BR'), ['64–128 m²', '1–3 quartos', '0–1 vagas']);
  const tags = listingCardTags(torre, {language:'es-MX'});
  assert.equal(tags[0].id, 'tour3d');
  assert.equal(tags[0].shimmer, true);
  assert.ok(!tags.some(tag => tag.id === 'tour'));
});

test('search: default Narvarte stays apartments as matches, Polanco and Desarrollos surface the tower, tour=3d is only the tower', () => {
  const narvarte = matchingHomes(DEFAULT_SEARCH);
  assert.ok(!narvarte.some(home => home.development));
  assert.ok(!prototypeResults(DEFAULT_SEARCH).some(home => home.development));
  const grid = pinShowcaseDevelopments(spreadTourListings(prototypeResults(DEFAULT_SEARCH), 4), DEFAULT_SEARCH);
  assert.equal(grid[2].id, 'torre-olmo');
  const polanco = matchingHomes({mode:'buy', areas:['Polanco V Sección'], beds:2, budget:12_000_000});
  assert.ok(polanco.some(home => home.id === 'torre-olmo'));
  const desarrollos = prototypeResults({mode:'development'});
  assert.equal(desarrollos[0].id, 'torre-olmo');
  const only3d = prototypeResults({...DEFAULT_SEARCH, tour3d:true});
  assert.deepEqual(only3d.map(home => home.id), ['torre-olmo']);
  const url = journeyUrl({page:'results', search:normalizeSearch({...DEFAULT_SEARCH, tour3d:true})});
  assert.equal(new URL(url, 'https://example.test').searchParams.get('tour'), '3d');
  assert.equal(readJourney(url).search.tour3d, true);
  assert.equal(normalizeSearch({tour3d:false}).tour3d, undefined);
});

test('unit math matches the shader: four homes per floor inside the body, nothing below floor 2', () => {
  assert.equal(BUILDING.levels, 12);
  assert.equal(UNITS.length, 44);
  assert.equal(available.length, 26);
  assert.deepEqual(available.map(unit => unit.id), [
    '201', '202', '204', '301', '302', '303', '402', '404', '501', '503', '504', '603', '604',
    '701', '801', '802', '804', '901', '903', '904', '1002', '1004', '1101', '1201', '1202', '1204',
  ]);
  assert.deepEqual(UNITS.filter(unit => unit.status === 'reserved').map(unit => unit.id), ['401', '803', '1102']);
  assert.equal(floorAt(BUILDING.base), 1);
  assert.equal(floorAt(BUILDING.base + BUILDING.floorHeight + 0.1), 2);
  assert.equal(unitAt([6, BUILDING.base + 0.2, -12]), null);
  const y = BUILDING.base + BUILDING.floorHeight + 0.2;
  const {x:[west, east], z:[north, south]} = BUILDING.body;
  assert.deepEqual(unitAt([west + 1, y, north + 1]), {floor:2, side:0, bay:0, id:'201'});
  assert.deepEqual(unitAt([east - 1, y, north + 1]), {floor:2, side:0, bay:1, id:'202'});
  assert.deepEqual(unitAt([west + 1, y, south - 1]), {floor:2, side:1, bay:0, id:'203'});
  assert.deepEqual(unitAt([east - 1, y, south - 1]), {floor:2, side:1, bay:1, id:'204'});
  assert.ok(BUILDING.body.x[0] > BUILDING.bounds.x[0] && BUILDING.body.z[1] < BUILDING.bounds.z[1]);
  assert.equal(unitId(12, 0), '1201');
  assert.equal(unitId(10, 1, 1), '1004');
  assert.equal(unitIndex({floor:2, side:0, bay:0}), 4);
  assert.equal(unitIndex({floor:12, side:1, bay:1}), 47);
  assert.equal(new Set(UNITS.map(unit => unit.index)).size, UNITS.length);
  for (const floor of new Set(UNITS.map(unit => unit.floor))) assert.equal(UNITS.filter(unit => unit.floor === floor).length, 4);
});

test('unit filters dim the 3D independently of Solo disponibles', () => {
  const three = unitMatches({...DEFAULT_FILTERS, beds:3});
  assert.ok([...three].every(id => UNITS.find(unit => unit.id === id).beds === 3));
  assert.ok(UNITS.some(unit => unit.beds === 3 && unit.status !== 'available' && three.has(unit.id)));
  const listed = listedUnits({...DEFAULT_FILTERS, beds:3, onlyAvailable:true});
  assert.ok(listed.every(unit => unit.status === 'available' && unit.beds === 3));
  const twelfth = listedUnits({...DEFAULT_FILTERS, floor:12});
  assert.ok(twelfth.length > 0 && twelfth.every(unit => unit.floor === 12 && unit.status === 'available'));
  const south = unitMatches({...DEFAULT_FILTERS, views:['sur']});
  assert.ok([...south].every(id => UNITS.find(unit => unit.id === id).orientation === 'sur'));
  const cap = UNITS.map(unit => unit.price).sort((a, b) => a - b)[Math.floor(UNITS.length / 2)];
  const cheaper = unitMatches({...DEFAULT_FILTERS, maxPrice:cap});
  assert.ok([...cheaper].every(id => UNITS.find(unit => unit.id === id).price <= cap));
  const desc = listedUnits(DEFAULT_FILTERS, 'price-desc');
  assert.ok(desc[0].price >= desc[desc.length - 1].price);
  const {counts} = priceHistogram();
  assert.equal(counts.length, 24);
  assert.equal(counts.reduce((sum, value) => sum + value, 0), UNITS.length);
  const muted = listedUnits({...DEFAULT_FILTERS, onlyAvailable:false});
  assert.ok(muted.some(unit => unit.status !== 'available'));
  assert.equal(moraIntent('¿Qué unidad tiene mejor vista?'), 'view');
  assert.equal(moraIntent('Qual é a mais barata por m²?'), 'cheapest');
  assert.equal(moraIntent('o que tem perto para crianças'), 'kids');
  assert.equal(moraIntent('quantas vagas tem o lobby'), 'free');
});

test('tour chat answers its own questions from the inventory and leaves the rest to the developer', () => {
  const say = (pt, es) => es;
  const money = value => `$${value}`;
  const view = moraAnswer(moraIntent('¿Qué unidad tiene mejor vista?'), say, money);
  assert.ok(view.text && UNITS.some(unit => unit.id === view.view));
  const cheapest = moraAnswer(moraIntent('¿Cuál es la más barata por m²?'), say, money);
  const unit = UNITS.find(item => item.id === cheapest.unit);
  assert.ok(cheapest.text.includes(money(unit.perMeter)));
  assert.ok(moraAnswer(moraIntent('¿Qué hay cerca para niños?'), say, money).poi);
  assert.equal(moraIntent('¿Aceptan crédito Infonavit?'), 'free');
});

test('development Mora reads in the mini-listing verdict shape, with what helps and what to weigh', () => {
  const {verdict} = developmentAnalysis({language:'es-MX'});
  assert.ok(verdict.sentence);
  assert.ok(verdict.facts.some(fact => fact.polarity === 'plus'));
  assert.ok(verdict.facts.some(fact => fact.polarity === 'minus'));
});

test('unit Mora reuses the verdict card and stays out of the search catalog', () => {
  const unit = available.find(item => item.id === '501') || available[0];
  assert.ok(unitAnalysis(unit, {language:'es-MX'}).verdict.facts.length >= 2);
  assert.match(unitAnalysis(unit, {language:'es-MX'}).verdict.sentence, /501|planta|piso|vista/i);
  assert.equal(unitHomeId(unit.id), `torre-olmo-u-${unit.id}`);
  assert.ok(UNIT_HOMES.some(home => home.unitId === unit.id && home.unitOf === 'torre-olmo'));
  assert.ok(!homes.some(home => home.id === unitHomeId(unit.id)));
});

test('the gallery shows distinct development photos, and each typology keeps its plan', () => {
  assert.ok(GALLERY.length > 5);
  const tiles = GALLERY.slice(0, 5);
  assert.equal(new Set(tiles.map(item => item.src)).size, 5);
  assert.match(GALLERY[0].src, /render-fachada/);
  assert.match(TYPOLOGIES.find(item => item.id === 'A').plan, /tipo-a\.png$/);
  assert.match(TYPOLOGIES.find(item => item.id === 'B').plan, /tipo-b\.png$/);
  assert.match(TYPOLOGIES.find(item => item.id === 'C').plan, /tipo-c\.png$/);
  assert.match(TYPOLOGIES.find(item => item.id === 'C').planAlt, /tipo-c-alt\.png$/);
  assert.match(available.find(item => item.id === '501').plan, /tipo-a\.png$/);
  const gallery = developmentGallery();
  assert.equal(gallery.photos.length, GALLERY.length);
  assert.equal(gallery.categories.reduce((count, room) => count + room.photos.length, 0), GALLERY.length);
  assert.deepEqual(gallery.categories.map(room => room.id), ['general', 'outdoor', 'amenities']);
  assert.equal(gallery.video, TORRE_OLMO_HOME.video);
});

test('camera easing and night factor stay on the documented curves', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.ok(easeInOut(0.5) > 0.4 && easeInOut(0.5) < 0.6);
  assert.ok(easeOut(0.2) > 0.2);
  assert.equal(easeDrawer(0), 0);
  assert.equal(easeDrawer(1), 1);
  assert.ok(easeDrawer(0.4) > 0.4);
  assert.equal(nightFactor(12), 0);
  assert.equal(nightFactor(21), 1);
  assert.ok(nightFactor(19) > 0 && nightFactor(19) < 1);
});
