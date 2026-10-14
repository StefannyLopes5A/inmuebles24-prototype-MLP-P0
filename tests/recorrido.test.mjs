import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {DEFAULT_SEARCH, matchingHomes, normalizeSearch, pinShowcaseDevelopments, prototypeResults, readJourney, journeyUrl, spreadTourListings} from '../src/journey.js';
import {listingCardTags} from '../src/listingCardTags.js';
import {developmentFacts, developmentKind} from '../src/development/listingFacts.js';
import {BUILDING, floorAt, unitAt, unitId, unitIndex} from '../src/development/buildingConfig.js';
import {UNITS, available, RANGES, TORRE_OLMO_HOME} from '../src/development/torreOlmo.js';
import {DEFAULT_FILTERS, listedUnits, moraIntent, unitMatches} from '../src/development/units.js';
import {easeInOut, easeOut} from '../src/development/easing.js';
import {nightFactor} from '../src/development/scene.js';

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

test('unit math matches the shader: two homes per floor, nothing below floor 2', () => {
  assert.equal(BUILDING.levels, 12);
  assert.equal(UNITS.length, 22);
  assert.equal(available.length, 9);
  assert.equal(floorAt(BUILDING.base), 1);
  assert.equal(floorAt(BUILDING.base + BUILDING.floorHeight + 0.1), 2);
  assert.equal(unitAt([6, BUILDING.base + 0.2, -12]), null);
  const north = unitAt([6, BUILDING.base + BUILDING.floorHeight + 0.2, BUILDING.bounds.z[0] + 1]);
  const south = unitAt([6, BUILDING.base + BUILDING.floorHeight + 0.2, BUILDING.bounds.z[1] - 1]);
  assert.deepEqual(north, {floor:2, side:0, id:'201'});
  assert.deepEqual(south, {floor:2, side:1, id:'202'});
  assert.equal(unitId(12, 0), '1201');
  assert.equal(unitIndex({floor:2, side:0}), 2);
  assert.equal(unitIndex({floor:12, side:1}), 23);
});

test('unit filters dim the 3D independently of Solo disponibles', () => {
  const three = unitMatches({...DEFAULT_FILTERS, beds:3});
  assert.ok([...three].every(id => UNITS.find(unit => unit.id === id).beds === 3));
  assert.ok(UNITS.some(unit => unit.beds === 3 && unit.status !== 'available' && three.has(unit.id)));
  const listed = listedUnits({...DEFAULT_FILTERS, beds:3, onlyAvailable:true});
  assert.ok(listed.every(unit => unit.status === 'available' && unit.beds === 3));
  assert.equal(moraIntent('¿Qué unidad tiene mejor vista?'), 'view');
  assert.equal(moraIntent('Qual é a mais barata por m²?'), 'cheapest');
  assert.equal(moraIntent('o que tem perto para crianças'), 'kids');
  assert.equal(moraIntent('quantas vagas tem o lobby'), 'free');
});

test('camera easing and night factor stay on the documented curves', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.ok(easeInOut(0.5) > 0.4 && easeInOut(0.5) < 0.6);
  assert.ok(easeOut(0.2) > 0.2);
  assert.equal(nightFactor(12), 0);
  assert.equal(nightFactor(21), 1);
  assert.ok(nightFactor(19) > 0 && nightFactor(19) < 1);
});
