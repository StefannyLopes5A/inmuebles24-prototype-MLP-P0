import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSearchInput} from '../src/searchInput.js';
const initial={mode:'buy',area:'Ambas zonas',budget:4500000,beds:2,note:'luz',address:''};
const parse=(q,c='MXN')=>parseSearchInput(q,initial,c,['Ambas zonas','Roma Norte']);
test('parses locale budgets without confusing bedroom counts',()=>{
  assert.equal(parse('até 4,5 milhões').search.budget,4500000);
  assert.equal(parse('hasta $4.500.000 MXN').search.budget,4500000);
  assert.equal(parse('até 225 mil USD').search.budget,4500000);
  assert.equal(parse('3 quartos até $225,000','USD').search.beds,3);
});
test('changes operation without retaining purchase budget for rent',()=>assert.equal(parse('alugar em Roma Norte').search.budget,28000));
test('preserves preferences and recognizes unstructured assistance',()=>{
  const result=parse('trabalho de casa');assert.equal(result.structured,false);assert.equal(result.search.note,'trabalho de casa');
  assert.equal(parse('Roma Norte 3 quartos').search.note,'luz');
});

test('decimal currency values preserve cents instead of increasing the budget a hundredfold',()=>{
  assert.equal(parse('hasta $6,300,000.00 MXN').search.budget,6_300_000);
  assert.equal(parse('até $6.300.000,50 MXN').search.budget,6_300_000.5);
  assert.equal(parse('até $315,000.25 USD').search.budget,6_300_005);
  assert.equal(parse('até $315.000,25 USD').search.budget,6_300_005);
  assert.equal(parse('até $315,000.25','USD').search.budget,6_300_005);
  assert.equal(parse('hasta $225,000 MXN').search.budget,225_000);
});

test('explicit area detection is accent-insensitive, boundary-aware and prefers the most specific name',()=>{
  const choices=['Ambas zonas','Juárez','Polanco','Polanco II Sección','Santa Fe','Santa Fe Centro'];
  const query=value=>parseSearchInput(value,initial,'MXN',choices);
  assert.equal(query('Juarez').search.area,'Juárez');
  assert.equal(query('Juarez').areaExplicit,true);
  assert.equal(query('Polanco II Seccion').search.area,'Polanco II Sección');
  assert.equal(query('Santa Fe Centro').search.area,'Santa Fe Centro');
  assert.equal(query('Polancoo').areaExplicit,false);
  assert.equal(query('hasta 5 millones').areaExplicit,false);
  const alreadySelected={...initial,area:'Juárez',areas:['Juárez','Polanco']};
  assert.equal(parseSearchInput('Juarez',alreadySelected,'MXN',choices).areaExplicit,true);
});
