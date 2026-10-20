import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {marketAnswer, marketQuestion, marketTopic} from '../src/marketAnswers.js';
import {SORTS, canonicalSort, sortLabel, sortResults, sortSignal} from '../src/resultSort.js';
import {leadLine, markVisit, normalizeSeeker, readSeeker, visitMomentLabel, writeSeeker} from '../src/seekerSignals.js';
import {DEFAULT_SEARCH, alertKey, journeyUrl, prototypeResults, readJourney} from '../src/journey.js';
import {readSharedFolders, shareFolder, SHARED_LIMIT} from '../src/collaborativeLists.js';
import {listingCardTags} from '../src/listingCardTags.js';
import {interpretSmartInput, matchStreet, smartDetailTokens, streetName} from '../src/searchCriteria.js';
import {areas} from '../src/data.js';
import {marketFacts, peerFacts} from '../src/moraAnalysis.js';

const memory = () => {
  const data = new Map();
  return {getItem:key => data.get(key) ?? null, setItem:(key, value) => data.set(key, String(value))};
};
const STREETS = homes.map(home => home.street);

test('market questions are recognized without mistaking the Crédito Constructor colonia', () => {
  assert.equal(marketTopic('¿Cuánto cobra el notario?'), 'notary');
  assert.equal(marketTopic('¿Qué garantía piden?'), 'guarantee');
  assert.equal(marketTopic('¿Puedo comprar con crédito?'), 'credit');
  assert.equal(marketTopic('Departamentos en Crédito Constructor'), null);
  for (const topic of ['notary', 'guarantee', 'credit']) assert.equal(marketTopic(marketQuestion(topic)), topic);
});

test('market answers are illustrative, scale with the price and only ask the agency what the listing decides', () => {
  const notary = marketAnswer('notary', {mode:'buy', price:5_000_000, listing:true});
  assert.match(notary.detail, /\$200k–\$350k MXN/);
  assert.equal(notary.note, 'Referencia ilustrativa');
  assert.equal(notary.ask, false);
  assert.equal(marketAnswer('guarantee', {mode:'rent', price:20_000, listing:true}).ask, true);
  assert.equal(marketAnswer('credit', {mode:'buy', price:3_000_000, listing:true}).ask, true);
  const bar = marketAnswer('credit', {mode:'buy', price:3_000_000});
  assert.equal(bar.ask, false);
  assert.match(bar.note, /no cambia tus filtros/);
  assert.equal(marketAnswer('other', {}), null);
});

test('the bar answers a market question without touching filters', () => {
  const result = interpretSmartInput('¿Cuánto cobra el notario?', DEFAULT_SEARCH, 'MXN', areas, 20, true, STREETS);
  assert.equal(result.kind, 'question');
  assert.deepEqual(result.search, DEFAULT_SEARCH);
});

test('sorting keeps exact matches ahead and orders by each signal', () => {
  assert.deepEqual(SORTS, ['recommended', 'price', 'rarity']);
  assert.equal(canonicalSort('nope'), 'recommended');
  assert.equal(canonicalSort('contacts'), 'recommended');
  assert.equal(sortLabel('price'), 'Precio justo');
  const items = homes.filter(home => home.mode === 'buy').slice(0, 20);
  const exact = new Set(items.slice(10).map(home => home.id));
  const byPrice = sortResults(items, 'price', exact);
  assert.deepEqual(new Set(byPrice.slice(0, 10).map(home => home.id)), exact);
  const byRarity = sortResults(items, 'rarity').map(home => peerFacts(home).count);
  assert.deepEqual(byRarity, [...byRarity].sort((a, b) => a - b));
  const deltas = sortResults(items, 'price').map(home => marketFacts(home).delta ?? Infinity);
  assert.deepEqual(deltas, [...deltas].sort((a, b) => a - b));
  assert.deepEqual(sortResults(items, 'recommended'), items);
});

test('sort signals only appear for the active sort and when the signal is real', () => {
  const cheap = homes.find(home => (marketFacts(home).delta ?? 0) < -0.03);
  assert.equal(sortSignal(cheap, 'price'), 'Por debajo de la mediana');
  assert.equal(sortSignal(cheap, 'recommended'), null);
  const rare = homes.find(home => peerFacts(home).count <= 2);
  assert.match(sortSignal(rare, 'rarity', 'es-MX', {long:true}), /parecido/);
});

test('the sort signal takes the slot after a perfect match on the card', () => {
  const tags = listingCardTags(homes[0], {signal:'Pocos como este', perfect:true});
  assert.ok(tags.length <= 2);
  assert.ok(tags.some(tag => tag.label === 'Pocos como este'));
});

test('sort lives in the route only on results and listing, and is omitted when recommended', () => {
  const url = journeyUrl({page:'results', search:DEFAULT_SEARCH, sort:'rarity'});
  assert.match(url, /sort=rarity/);
  assert.equal(readJourney(new URL(url, 'https://local.test')).sort, 'rarity');
  assert.doesNotMatch(journeyUrl({page:'results', search:DEFAULT_SEARCH, sort:'recommended'}), /sort=/);
  assert.doesNotMatch(journeyUrl({page:'home', search:DEFAULT_SEARCH, sort:'rarity'}), /sort=/);
});

test('an alert belongs to the search, not to its order or free text', () => {
  const base = alertKey(DEFAULT_SEARCH);
  assert.equal(alertKey({...DEFAULT_SEARCH, note:'algo'}), base);
  assert.notEqual(alertKey({...DEFAULT_SEARCH, budget:DEFAULT_SEARCH.budget + 1000}), base);
});

test('a shared folder is a local snapshot of valid listings, newest first and capped', () => {
  const ids = homes.slice(0, 2).map(home => home.id);
  const shared = shareFolder({}, {id:'list-casa', name:'Casa', homeIds:[...ids, 'unknown']}, 10);
  assert.deepEqual(readSharedFolders(shared, new Set(ids))['list-casa'].homeIds, ids);
  assert.equal(shareFolder(shared, {id:'recent', name:'x', homeIds:ids}), shared);
  let many = {};
  for (let index = 0; index < SHARED_LIMIT + 3; index++) many = shareFolder(many, {id:`list-${index}`, name:`F${index}`, homeIds:ids}, index);
  const kept = Object.keys(readSharedFolders(many));
  assert.equal(kept.length, SHARED_LIMIT);
  assert.equal(kept[0], `list-${SHARED_LIMIT + 2}`);
});

test('seeker signals are validated and feed a lead line that skips the current listing', () => {
  const store = memory();
  assert.deepEqual(readSeeker(store), normalizeSeeker(null));
  writeSeeker({move:'months', credit:'open', asked:true}, store);
  markVisit('a', store);markVisit('b', store);markVisit('a', store);markVisit('c', store);
  const seeker = readSeeker(store);
  assert.deepEqual(seeker.visits, ['a', 'b', 'c']);
  assert.equal(normalizeSeeker({move:'tomorrow'}).move, null);
  const line = leadLine({search:{mode:'buy', areas:['Narvarte']}, seeker, homeId:'c'});
  assert.equal(line, 'Compra en Narvarte, se mudaría en los próximos meses, crédito aún abierto. Ya señaló visita en 2 anuncios.');
  assert.doesNotMatch(leadLine({search:{mode:'rent', areas:[]}, seeker, homeId:'z'}), /crédito/);
  assert.equal(visitMomentLabel('weekend'), 'El fin de semana');
});

test('a catalog street becomes the location and the grid keeps that street', () => {
  const home = homes.find(item => /^Calle Arquímedes/.test(item.street));
  assert.ok(home);
  assert.equal(streetName(home.street), 'Calle Arquímedes');
  assert.equal(matchStreet('Arquímedes', STREETS), null);
  const result = interpretSmartInput('Calle Arquímedes', {...DEFAULT_SEARCH, mode:home.mode}, 'MXN', areas, 20, false, STREETS);
  assert.equal(result.kind, 'filters');
  assert.equal(result.search.address, 'Calle Arquímedes');
  assert.deepEqual(result.search.areas, []);
  assert.ok(prototypeResults(result.search).every(item => /Arquímedes/.test(item.street)));
  assert.equal(smartDetailTokens('Calle Arquímedes', [], STREETS)[0].text, 'Calle Arquímedes');
});

test('an unknown street is answered by Mora instead of becoming a criterion', () => {
  assert.equal(interpretSmartInput('Calle Inventada', DEFAULT_SEARCH, 'MXN', areas, 20, false, STREETS).kind, 'draft');
  const result = interpretSmartInput('Calle Inventada', DEFAULT_SEARCH, 'MXN', areas, 20, true, STREETS);
  assert.equal(result.kind, 'street-missing');
  assert.equal(result.street, 'Calle Inventada');
  assert.deepEqual(result.search, DEFAULT_SEARCH);
});
