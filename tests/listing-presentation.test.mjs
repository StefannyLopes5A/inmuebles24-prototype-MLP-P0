import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {homes, listingPrice} from '../src/data.js';
import {DEFAULT_SEARCH, normalizeSearch, matchingHomes, readJourney, journeyUrl} from '../src/journey.js';
import {listingDetails, listingSummary, answerListingQuestion, compareFavorites, profileFitReason} from '../src/listingPresentation.js';

test('the local listing page round-trips its property and search without contact identity', () => {
  const home = homes.find(item => item.area !== DEFAULT_SEARCH.area);
  const route = {page:'listing', propertyId:home.id, search:normalizeSearch(DEFAULT_SEARCH), pref:'open'};
  const url = journeyUrl({...route, profile:{name:'Marina',email:'marina@example.com'}});
  assert.deepEqual(readJourney(url), route);
  assert.equal(url.includes('Marina'), false);
  assert.equal(readJourney('/?view=listing&property=missing').page, 'results');
});

test('summaries distinguish close suggestions from complete matches, including price floor and unsupported type', () => {
  const home = homes[0];
  const search = normalizeSearch({...DEFAULT_SEARCH, areas:[home.area], budget:listingPrice(home), beds:home.beds});
  assert.equal(listingSummary(home,search,'none','pt-BR').hasMatch,true);
  assert.equal(listingSummary(home,{...search,propertyType:'house'},'none').hasMatch,false);
  const belowFloor = listingSummary(home,{...search,budget:listingPrice(home)+100,minBudget:listingPrice(home)+1},'none','pt-BR');
  assert.equal(belowFloor.hasMatch,false);
  assert.match(belowFloor.considerations.join(' '),/menor que o mínimo/);
  assert.equal(belowFloor.matches.some(text=>/orçamento/.test(text)),false);
});

test('work preferences never become a verified office or room-layout claim', () => {
  const home = homes.find(item=>item.beds>=3);
  const search=normalizeSearch({...DEFAULT_SEARCH,areas:[home.area],budget:listingPrice(home),beds:home.beds+1});
  const summary=listingSummary(home,search,'extra','pt-BR');
  assert.equal(summary.matches.includes('Dentro do seu orçamento'),true);
  assert.equal(summary.matches.some(text=>/3 ou mais/.test(text)),false);
  assert.match(summary.considerations.join(' '),/planta|você busca/);
  assert.match(answerListingQuestion(home,'O espaço de home office tem janela?','pt-BR'),/precisa ser confirmada/);
});

test('every gallery resolves to local catalog photos and unknown details remain unknown', () => {
  for(const home of homes){
    const data=listingDetails(home);
    assert.ok(data.gallery.length);
    assert.equal(data.gallery[0],home.image);
    for(const photo of data.gallery){assert.match(photo,/^\/assets\/listings\//);assert.ok(existsSync(new URL(`../public${photo}`,import.meta.url)));}
  }
  const unknown=homes.find(item=>listingDetails(item).pets===null);
  assert.match(answerListingQuestion(unknown,'Aceita pets?','pt-BR'),/precisa ser confirmada/);
});

test('compare favorites lifts shared lines and leaves a single strongest insight per column', () => {
  const matched = matchingHomes(normalizeSearch(DEFAULT_SEARCH)).slice(0, 2);
  assert.equal(matched.length, 2);
  const search = normalizeSearch({...DEFAULT_SEARCH, areas:matched.map(home => home.area).filter((area, index, all) => all.indexOf(area) === index)});
  const reading = compareFavorites(matched, search, 'none', 'pt-BR');
  assert.ok(reading.sharedMatches.includes('Dentro do seu orçamento'));
  for (const card of reading.cards) {
    assert.equal(card.goodAt === null || !reading.sharedMatches.includes(card.goodAt), true);
    assert.equal(card.consider === null || !reading.sharedConsiderations.includes(card.consider), true);
  }
});

test('compare favorites keeps a leader only when ranks differ and never invents office facts', () => {
  const search = normalizeSearch(DEFAULT_SEARCH);
  const exactMatches = matchingHomes(search);
  const exact = exactMatches[0];
  const outside = homes.find(home => home.mode === search.mode && !exactMatches.some(match => match.id === home.id));
  assert.ok(exact && outside);
  const clear = compareFavorites([exact, outside], search, 'none', 'pt-BR');
  assert.equal(clear.leaderId, exact.id);
  assert.match(clear.verdict, new RegExp(exact.street));

  const twin = exactMatches.find(home => home.id !== exact.id);
  assert.ok(twin);
  const tied = compareFavorites([exact, twin], search, 'none', 'pt-BR');
  assert.equal(tied.leaderId, null);
  assert.match(tied.verdict, /igualmente perto/);

  const profile = profileFitReason(exact, search, 'open', 'pt-BR');
  assert.match(profile, /espaço de trabalho na sala/);
  assert.equal(/tem escritório|home office confirmado/i.test(profile), false);
});
