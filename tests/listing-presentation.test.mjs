import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {homes, listingPrice} from '../src/data.js';
import {DEFAULT_SEARCH, normalizeSearch, readJourney, journeyUrl} from '../src/journey.js';
import {listingDetails, listingSummary, answerListingQuestion} from '../src/listingPresentation.js';

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
