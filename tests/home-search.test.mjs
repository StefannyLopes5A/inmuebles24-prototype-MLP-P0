import test from 'node:test';
import assert from 'node:assert/strict';
import {canStartSearch, detailTokens, priceDistribution, parseBudgetAmount} from '../src/homeSearchModel.js';
import {createDetailHistory} from '../src/detailHistory.js';
import {createHomeIntro, homeIntroFrame} from '../src/homeIntro.js';
import {DEFAULT_SEARCH, normalizeSearch, journeyUrl, readJourney, matchingHomes} from '../src/journey.js';
import {homes, listingPrice} from '../src/data.js';

const introParts = [{text:'Quero'}, {key:'mode',text:'comprar'}, {text:'um'}, {key:'propertyType',text:'apartamento'}, {details:true,text:'Adicione aqui mais detalhes'}];

test('intro fades suggestions continuously before converting them, then overlaps the lower reveals', () => {
  const timeline = createHomeIntro(introParts);
  const initial = homeIntroFrame(timeline, 0);
  assert.equal(initial.words.every(word => word.count === 0 && !word.control), true);
  for (const [index, word] of timeline.words.entries()) {
    if (!word.interactive) continue;
    assert.equal(homeIntroFrame(timeline, word.morphAt - 1).words[index].count, word.letters.length);
    assert.equal(homeIntroFrame(timeline, word.morphAt - 1).words[index].control, false);
    assert.equal(homeIntroFrame(timeline, word.morphAt).words[index].control, true);
    assert.ok(timeline.words[index + 1].start < word.settledAt, 'the next phrase must not wait for filter conversion');
  }
  assert.ok(timeline.words.at(-1).typedAt < timeline.readyAt);
  assert.ok(timeline.readyAt < timeline.headingAt && timeline.headingAt < timeline.cardsAt && timeline.cardsAt < timeline.discoveryAt);
  assert.equal(homeIntroFrame(timeline, timeline.cardsAt).stage, 2);
  assert.ok(timeline.headingAt - timeline.readyAt <= 100, 'continue below while the CTA is entering');
  assert.ok(timeline.discoveryAt - timeline.readyAt < 700, 'discovery starts before the CTA entrance completes');
  assert.equal(timeline.words.every(word => word.reveal === 'phrase'), true);
});

test('intro catches up after background throttling and skipping leaves a fully usable static surface', () => {
  const timeline = createHomeIntro(introParts);
  for (const elapsed of [timeline.doneAt + 60000, Infinity]) {
    const frame = homeIntroFrame(timeline, elapsed);
    assert.equal(frame.done && frame.ready && frame.stage === 3, true);
    frame.words.forEach((word, index) => {
      assert.equal(word.count, timeline.words[index].letters.length);
      assert.equal(word.control, !!introParts[index].key);
      assert.equal(word.morphing || word.typing, false);
    });
    assert.equal(canStartSearch({}), false);
  }
});

test('both explicit mandatory choices are required; suggestions and optional filters cannot unlock the CTA', () => {
  for (const choices of [{}, {beds:true,area:true,budget:true,note:true}, {mode:true}, {propertyType:true}, {mode:'buy',propertyType:'apartment'}]) assert.equal(canStartSearch(choices), false);
  assert.equal(canStartSearch({mode:true,propertyType:true}), true);
});

test('recognition preserves original wording and offsets for editable semantic tokens', () => {
  const text = 'Deve ser mobiliado e com portaria 24 horas, perto do metrô';
  const tokens = detailTokens(text);
  assert.deepEqual(tokens.map(t => [t.kind,t.value,t.text]), [['furnishing','furnished','mobiliado'],['security','furnished','portaria 24 horas']]);
  for (const token of tokens) assert.equal(text.slice(token.start,token.end), token.text);
  assert.equal(detailTokens('sem mobília')[0].value, 'unfurnished');
  assert.equal(detailTokens('não mobiliado')[0].value, 'unfurnished');
  assert.equal(detailTokens('sin muebles')[0].value, 'unfurnished');
  assert.equal(detailTokens('amueblado con portería 24h').length, 2);
  assert.equal(detailTokens('desmobiliado, portaria 24, mobiliados').length, 0);
});

test('histogram counts each real listing exactly once and separates operations', () => {
  for (const mode of ['buy','rent']) {
    const source = homes.filter(h => h.mode === mode && h.area === 'Narvarte Poniente');
    const {bins,ceiling} = priceDistribution(source,mode);
    assert.equal(bins.reduce((sum,b) => sum+b.count,0),source.length);
    assert.ok(source.every(home => listingPrice(home) <= ceiling));
    assert.ok(bins.every(bin => bin.count >= 0 && bin.max > bin.min));
  }
  assert.equal(priceDistribution([], 'buy').bins.reduce((sum,b) => sum+b.count,0), 0);
});

test('new home criteria round-trip without turning houses or unsupported operations into apartments for sale', () => {
  const search = normalizeSearch({...DEFAULT_SEARCH,propertyType:'house',minBudget:2000000,note:'mobiliado e com portaria 24h'});
  assert.deepEqual(readJourney(journeyUrl({page:'results',search})).search,search);
  assert.equal(matchingHomes(search).length,0);
  assert.equal(matchingHomes({...DEFAULT_SEARCH,mode:'development'}).length,0);
  const apartments = matchingHomes({...DEFAULT_SEARCH,propertyType:'apartment',minBudget:6500000});
  assert.ok(apartments.length>0);
  assert.ok(apartments.every(home=>listingPrice(home)>=6500000));
  assert.equal(normalizeSearch({...DEFAULT_SEARCH,minBudget:9000000}).minBudget,undefined);
});

test('budget input accepts the displayed currency format and rejects malformed or negative prices', () => {
  assert.equal(parseBudgetAmount('$7,500,000'), 7500000);
  assert.equal(parseBudgetAmount('7.500.000'), 7500000);
  assert.equal(parseBudgetAmount('$375,000 USD', 20), 7500000);
  assert.equal(parseBudgetAmount('12,50', 20), 250);
  assert.equal(parseBudgetAmount(''), 0);
  for (const input of ['-500000', 'abc', '1,23,456', '3 milhões']) assert.ok(Number.isNaN(parseBudgetAmount(input)));
});

test('token replacement and removal can be undone and redone independently of DOM conversion', () => {
  const h = createDetailHistory('mobiliado e com portaria 24h');
  h.record({text:'sem mobília e com portaria 24h',start:11,end:11});
  h.record({text:'sem mobília e com ',start:18,end:18});
  assert.equal(h.undo().text,'sem mobília e com portaria 24h');
  assert.equal(h.undo().text,'mobiliado e com portaria 24h');
  assert.equal(h.redo().text,'sem mobília e com portaria 24h');
  h.record({text:'mobiliado',start:9,end:9});
  assert.equal(h.redo(),null);
});

test('detail history groups contiguous typing but splits caret moves, pauses and replacements', () => {
  const h = createDetailHistory();
  h.record({text:'a',start:1,end:1},'insertText',100);
  h.select({start:1,end:1});h.record({text:'ab',start:2,end:2},'insertText',200);
  h.select({start:0,end:0});h.record({text:'xab',start:1,end:1},'insertText',300);
  assert.equal(h.undo().text,'ab');
  assert.equal(h.undo().text,'');
  h.reset('restored');assert.equal(h.undo(),null);assert.equal(h.redo(),null);
});
