import test from 'node:test';
import assert from 'node:assert/strict';
import {homes, listingPrice} from '../src/data.js';
import {DEFAULT_SEARCH, normalizeSearch, matchingHomes, prototypeResults, expansionOptions, addArea, readJourney, journeyUrl, factualReason, migratePrototypeUrl, builtArea, lotArea, parkingSpots} from '../src/journey.js';

test('retired animation links open final V2 without losing search, criteria or detail state', () => {
  const query='?v=6&bar=home&reference=1&view=results&mode=rent&areas=&budget=28000&beds=2&type=apartment&note=Precisa+ter+portaria+24h+e+ser+mobiliado&criterion=security&criterion=furnished&property=rent-149449697';
  for (const path of ['/proto/search-transition/','/proto/home-motion/','/proto/search-transition/index.html']) {
    const original=new URL('https://example.test'+path+query+'#results');
    const migrated=new URL(migratePrototypeUrl(original.href),'https://example.test');
    assert.equal(migrated.pathname,'/');
    assert.equal(migrated.hash,'#results');
    for (const key of ['v','bar','reference']) assert.equal(migrated.searchParams.has(key),false);
    for (const key of ['view','mode','areas','budget','beds','type','note','property']) assert.equal(migrated.searchParams.get(key),original.searchParams.get(key));
    assert.deepEqual(migrated.searchParams.getAll('criterion'),['security','furnished']);
    assert.deepEqual(readJourney(migrated),readJourney(original));
  }
  assert.equal(migratePrototypeUrl('https://example.test/?view=results'),null);
  assert.equal(migratePrototypeUrl('https://example.test/proto/search-transition-other/'),null);
});

test('default scenario includes three independently verified advertisers without changing criteria', () => {
  const results = matchingHomes(DEFAULT_SEARCH);
  for (const id of ['buy-148816386', 'buy-150108941', 'buy-150922505']) {
    const home = results.find(item => item.id === id);
    assert.ok(home, `${id} must remain within the example search`);
    assert.ok(home.brokerLogo);
    assert.notEqual(home.broker, 'Anunciante en Inmuebles24');
    assert.equal(home.area, 'Narvarte Poniente');
    assert.ok(home.beds >= 2 && listingPrice(home) <= 7_500_000);
  }
  assert.equal(new Set(results.filter(home => home.brokerLogo).map(home => home.broker)).size, 3);
});

test('multi-area criteria, context and selected property round-trip through shareable URLs', () => {
  const search = normalizeSearch({...DEFAULT_SEARCH, areas:['Narvarte Poniente', 'Roma Norte'], note:'Trabalho de casa', fromIdea:true, ideaLabel:'Duas regiões'});
  const state = {page:'results', search, pref:'extra', propertyId:'buy-148816386'};
  assert.deepEqual(readJourney(journeyUrl(state)), state);
  assert.deepEqual(readJourney({pathname:'/', search:journeyUrl(state).slice(1)}), state);
  assert.equal(readJourney('/resultados').page, 'results');
  assert.equal(readJourney('/results/').page, 'results');
});

test('favorites is a flat page and the removed folder, compare and invite views fall back to home', () => {
  const search = normalizeSearch({...DEFAULT_SEARCH, areas:['Narvarte Poniente']});
  const url = journeyUrl({page:'favorites', search});
  assert.match(url, /view=favorites/);
  assert.equal(readJourney(url).page, 'favorites');
  assert.equal(url.includes('list='), false);
  assert.equal(url.includes('invite='), false);
  for (const view of ['compare', 'folder'])
    assert.equal(readJourney(`/?view=${view}&mode=buy&areas=Narvarte+Poniente&budget=7500000&beds=2`).page, 'home');
});

test('legacy separate preference is canonicalized to the current three-bedroom priority', () => {
  assert.equal(readJourney('/?view=results&pref=separate').pref, 'extra');
  assert.equal(readJourney(journeyUrl({page:'results', pref:'separate'})).pref, 'extra');
  assert.match(journeyUrl({page:'results', pref:'separate'}), /pref=extra/);
});

test('all-area intent remains all-area on reload, without becoming the default neighborhood', () => {
  const search = normalizeSearch({...DEFAULT_SEARCH, area:'Ambas zonas', areas:[]});
  const loaded = readJourney(journeyUrl({page:'results', search})).search;
  assert.deepEqual(loaded.areas, []);
  assert.equal(loaded.area, 'Ambas zonas');
  assert.deepEqual(matchingHomes(loaded).map(home => home.id), matchingHomes(search).map(home => home.id));
  assert.deepEqual(expansionOptions(loaded), []);
});

test('malformed parameters cannot broaden filters, accept unknown properties or introduce invalid numbers', () => {
  const state = readJourney('/?view=results&mode=invalid&areas=unknown&budget=-1&beds=NaN&pref=anything&property=unknown');
  assert.deepEqual(state.search, normalizeSearch(DEFAULT_SEARCH));
  assert.equal(state.pref, 'none');
  assert.equal(state.propertyId, null);
  assert.equal(readJourney('/?view=results&budget=Infinity&beds=999').search.budget, DEFAULT_SEARCH.budget);
  assert.equal(normalizeSearch({mode:'rent', budget:0}).budget, 28_000);
  assert.equal(normalizeSearch({budget:true}).budget, DEFAULT_SEARCH.budget);
  assert.equal(normalizeSearch(null).beds, DEFAULT_SEARCH.beds);
  assert.equal(normalizeSearch({note:'x'.repeat(2000)}).note.length, 600);
  const displayed = new Set(prototypeResults(DEFAULT_SEARCH).map(home => home.id));
  const outside = homes.find(home => !displayed.has(home.id));
  assert.equal(readJourney(`/?view=results&property=${outside.id}`).propertyId, null, 'A property outside the displayed selection cannot become selected');
  assert.equal(readJourney('/?view=home&property=unknown').propertyId, null);
});

test('home inspiration details round-trip for any catalog listing, without broadening result-detail eligibility', () => {
  const inspirational = homes.find(home => home.mode === 'rent');
  const homeState = {page:'home', search:normalizeSearch(DEFAULT_SEARCH), pref:'none', propertyId:inspirational.id};
  assert.deepEqual(readJourney(journeyUrl(homeState)), homeState);
  assert.equal(readJourney(journeyUrl({...homeState, page:'results'})).propertyId, null);
  assert.equal(readJourney(`/?view=results&property=${inspirational.id}`).propertyId, null);
  assert.equal(readJourney(journeyUrl({...homeState, propertyId:'unknown'})).propertyId, null);
});

test('expansion proposes unique new areas with correct additional versus total counts and unchanged limits', () => {
  const source = normalizeSearch(DEFAULT_SEARCH);
  const before = structuredClone(source);
  const baseline = matchingHomes(source);
  const options = expansionOptions(source);
  assert.ok(options.length > 0);
  assert.equal(new Set(options.map(option => option.area)).size, options.length);
  for (const option of options) {
    assert.ok(!source.areas.includes(option.area));
    const extended = addArea(source, option.area);
    const results = matchingHomes(extended);
    assert.equal(option.total, results.length);
    assert.equal(option.additional, results.length - baseline.length);
    assert.ok(option.additional > 0);
    assert.equal(extended.mode, source.mode);
    assert.equal(extended.budget, source.budget);
    assert.equal(extended.beds, source.beds);
    assert.equal(extended.address, source.address);
    assert.equal(extended.area, source.area);
    assert.ok(results.every(home => home.mode === source.mode && home.beds >= source.beds && listingPrice(home) <= source.budget));
    assert.deepEqual(addArea(extended, option.area), extended, 'Selecting one area twice must be idempotent');
    assert.ok(!expansionOptions(extended).some(next => next.area === option.area));
  }
  assert.deepEqual(source, before, 'Suggestions and expansion must not mutate active criteria');
  assert.deepEqual(addArea(source, 'Not in the catalog'), source);
});

test('address constraints survive expansion and exact filtered count ignores accent/case differences', () => {
  const narrow = normalizeSearch({...DEFAULT_SEARCH, address:'Cuauhtémoc'});
  const equivalent = normalizeSearch({...DEFAULT_SEARCH, address:'CUAUHTEMOC'});
  assert.deepEqual(matchingHomes(narrow).map(home => home.id), matchingHomes(equivalent).map(home => home.id));
  for (const option of expansionOptions(narrow)) {
    const expanded = addArea(narrow, option.area);
    assert.equal(expanded.address, narrow.address);
    assert.equal(matchingHomes(expanded).length, option.total);
  }
});

test('factual fit copy reports catalog facts without inferred office layout or perfect-match claims', () => {
  const home = matchingHomes(DEFAULT_SEARCH)[0];
  const es = factualReason(home, DEFAULT_SEARCH);
  const pt = factualReason(home, DEFAULT_SEARCH, 'pt-BR');
  assert.ok(es.includes(home.area) && es.includes('recámaras'));
  assert.ok(pt.includes('quartos') && pt.includes('Dentro do orçamento'));
  assert.doesNotMatch(`${es} ${pt}`, /perfect|perfeit|office|oficina|escritório|ventana/i);
  const outside = homes.find(item => item.mode === 'rent');
  assert.equal(factualReason(outside, DEFAULT_SEARCH), 'Fuera de los filtros actuales.');
});

test('URL serialization ignores contact identity and normalizes duplicate areas', () => {
  const search = {...DEFAULT_SEARCH, areas:['Narvarte Poniente', 'Narvarte Poniente'], profile:{email:'private@example.com'}, phone:'5512345678'};
  const url = journeyUrl({page:'results', search, profile:search.profile});
  assert.doesNotMatch(url, /private|example|phone|profile|551234/);
  assert.deepEqual(readJourney(url).search.areas, ['Narvarte Poniente']);
});

test('the full-screen map is a results-only view; other map modes and routes drop it', () => {
  const at = url => readJourney(new URL(url, 'https://example.test'));
  const property = prototypeResults(DEFAULT_SEARCH)[0].id;
  const url = journeyUrl({page:'results', search:DEFAULT_SEARCH, map:'full'});
  assert.match(url, /map=full/);
  assert.equal(at(url).map, 'full');
  assert.doesNotMatch(journeyUrl({page:'results', search:DEFAULT_SEARCH}), /map=/);
  assert.doesNotMatch(journeyUrl({page:'listing', search:DEFAULT_SEARCH, propertyId:property, map:'full'}), /map=/);
  assert.doesNotMatch(journeyUrl({page:'favorites', search:DEFAULT_SEARCH, map:'full'}), /map=/);
  assert.equal(at('/?view=results&map=half').map, undefined);
  assert.equal(at('/?view=listing&map=full').map, undefined);
});

test('baths, parking and published area narrow the catalog without inventing missing measures', () => {
  const broad = matchingHomes({...DEFAULT_SEARCH, areas:[], beds:1, budget:50_000_000});
  const baths = matchingHomes({...DEFAULT_SEARCH, areas:[], beds:1, baths:4, budget:50_000_000});
  assert.ok(baths.length && baths.every(home => home.baths >= 4) && baths.length < broad.length);
  const parked = matchingHomes({...DEFAULT_SEARCH, areas:[], beds:1, parking:2, budget:50_000_000});
  assert.ok(parked.length && parked.length < broad.length && parked.every(home => parkingSpots(home) >= 2));
  const built = matchingHomes({...DEFAULT_SEARCH, areas:[], beds:1, minSize:100, maxSize:150, budget:50_000_000});
  assert.ok(built.length && built.every(home => {const size = builtArea(home); return size >= 100 && size <= 150 && lotArea(home) == null;}));
  const lots = matchingHomes({mode:'rent', areas:[], beds:1, minLot:80, maxLot:150, budget:200_000});
  assert.ok(lots.length && lots.every(home => {const lot = lotArea(home); return lot >= 80 && lot <= 150;}));
  assert.ok(lots.every(home => builtArea(home) == null));
  const round = readJourney(journeyUrl({page:'results', search:{...DEFAULT_SEARCH, baths:3, parking:2, minSize:50, maxSize:100, minLot:80, maxLot:150}}));
  assert.equal(round.search.baths, 3);
  assert.equal(round.search.parking, 2);
  assert.equal(round.search.minSize, 50);
  assert.equal(round.search.maxLot, 150);
  assert.doesNotMatch(journeyUrl({page:'results', search:DEFAULT_SEARCH}), /baths=|parking=|minSize=/);
});
