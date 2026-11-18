import test from 'node:test';
import assert from 'node:assert/strict';
import {canStartSearch, canStartHomeSearch, detailTokens, foldSearchText, priceDistribution, parseBudgetAmount} from '../src/homeSearchModel.js';
import {homeQuerySuggestions} from '../src/homeQuerySuggest.js';
import {IDEA_RECENT_CARD_LIMIT, demoRecentIdeaCards, ideaSuggestionCards, recordSearchHistory, shouldRecordSearch} from '../src/searchHistory.js';
import {CITY_EXPLORE_LINKS, POPULAR_HOME_CITIES, cityLinkBudget} from '../src/popularHomeCities.js';
import {patchHomeQueryForChip, patchHomeQueryForCriterion, patchHomeQueryForPlace} from '../src/homeQuerySync.js';
import {composeHomeDraft, describeHomeQuery, homePhraseItems, homePhraseSegments, homeTypedArticle, releaseHomeTokenBefore, releaseLastHomeToken, replaceHomePhraseItem, replaceHomeQueryTail, spliceHomeQuery, splitHomeQuery} from '../src/searchCriteria.js';
import {areas} from '../src/data.js';
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

test('home filter chips rewrite the natural-language query', () => {
  const areas = ['Ambas zonas', 'Roma Norte', 'Narvarte Poniente'];
  const base = 'casa con 3 recamaras en Roma Norte';
  assert.equal(patchHomeQueryForChip(base, 'beds', 4, {language: 'es', areas}), 'casa con 4 recámaras en Roma Norte');
  assert.equal(patchHomeQueryForChip('casa con baño en Roma Norte', 'baths', 2, {language: 'es', areas}), 'casa con 2 baños en Roma Norte');
  assert.equal(patchHomeQueryForChip('casa com banheiro', 'baths', 1, {language: 'pt-BR', areas}), 'casa com 1 banheiro');
  assert.equal(patchHomeQueryForChip('casa con garaje en Roma Norte', 'parking', 2, {language: 'es', areas}), 'casa con 2 estacionamientos en Roma Norte');
  assert.equal(patchHomeQueryForChip('casa com vaga', 'parking', 1, {language: 'pt-BR', areas}), 'casa com 1 vaga');
  assert.equal(patchHomeQueryForChip(base, 'propertyType', 'condominium', {language: 'es', areas}), 'casa en condominio con 3 recamaras en Roma Norte');
  assert.equal(patchHomeQueryForChip(base, 'area', 'Narvarte Poniente', {language: 'es', areas}), 'casa con 3 recamaras en Narvarte Poniente');
  assert.match(patchHomeQueryForChip(base, 'budget', 40_000, {language: 'es', areas, budgetLabel: '$40,000 MXN'}), /hasta \$40,000 MXN/);
  const priced = patchHomeQueryForChip('casa hasta $8,500,000 MXN en Polanco', 'budget', 8_600_000, {language: 'es', areas, budgetLabel: '$8,600,000 MXN'});
  assert.equal(priced, 'casa hasta $8,600,000 MXN en Polanco');
  assert.equal(patchHomeQueryForChip(priced, 'budget', 8_700_000, {language: 'es', areas, budgetLabel: '$8,700,000 MXN'}), 'casa hasta $8,700,000 MXN en Polanco');
  assert.equal(patchHomeQueryForChip('casa hasta $8,500,000 MXN MXN MXN', 'budget', 8_600_000, {language: 'es', areas, budgetLabel: '$8,600,000 MXN'}), 'casa hasta $8,600,000 MXN');
  assert.equal(patchHomeQueryForChip('casa hasta $8,500,000 MXN MXN en Polanco MXN MXN', 'budget', 8_600_000, {language: 'es', areas, budgetLabel: '$8,600,000 MXN'}), 'casa hasta $8,600,000 MXN en Polanco');
  assert.equal(splitHomeQuery('casa hasta $8,500,000 MXN MXN MXN en Polanco').tail.includes('MXN'), false);
  const pool = patchHomeQueryForCriterion('departamento en Polanco', 'pool', true, 'es');
  assert.match(foldSearchText(pool), /piscina/);
  assert.equal(patchHomeQueryForCriterion(pool, 'pool', false, 'es'), 'departamento en Polanco');
  const withStreet = patchHomeQueryForPlace('departamento en Polanco', {label:'Narvarte Poniente'}, true, 'es');
  assert.match(withStreet, /en Narvarte Poniente/);
  assert.equal(patchHomeQueryForPlace(withStreet, {label:'Narvarte Poniente'}, false, 'es'), 'departamento en Polanco');
  assert.equal(patchHomeQueryForPlace('departamento en Narvarte Poniente y Polanco cerca del metro', {label:'Polanco'}, false, 'es'), 'departamento en Narvarte Poniente cerca del metro');
});

test('home composer unlocks search when the description names a location', () => {
  assert.equal(homeQuerySuggestions('es').length, 3);
  const bare = describeHomeQuery('departamento con 3 recámaras', areas);
  assert.equal(canStartHomeSearch('departamento con 3 recámaras', bare), false);
  const located = describeHomeQuery('departamento en Roma Norte', areas);
  assert.equal(located.area, 'Roma Norte');
  assert.equal(canStartHomeSearch('departamento en Roma Norte', located), true);
});

test('popular home cities expose explore links with localized budgets', () => {
  assert.ok(POPULAR_HOME_CITIES.length >= 4);
  assert.equal(CITY_EXPLORE_LINKS.length, 5);
  assert.equal(cityLinkBudget('rent'), 28_000);
  assert.equal(cityLinkBudget('buy'), 7_500_000);
  assert.ok(POPULAR_HOME_CITIES.every(city => city.sampleArea && city.image));
});

test('idea suggestion cards run a search payload; history records signed-in searches', () => {
  const cards = ideaSuggestionCards('buy', value => value);
  assert.equal(cards.length, 5);
  assert.equal(cards[0].recent, false);
  const demo = demoRecentIdeaCards('buy');
  assert.equal(demo.length, IDEA_RECENT_CARD_LIMIT);
  assert.equal(demo[0].recent, true);
  assert.match(demo[0].queryLead, /Narvarte Poniente/);
  assert.ok(cards[0].previewItems.length > 0);
  assert.deepEqual(cards[0].search.areas, [cards[0].search.areas[0]]);
  const search = {mode:'buy', areas:['Roma Norte'], area:'Roma Norte', beds:2, budget:7_500_000, note:'Departamento en Roma Norte'};
  assert.equal(shouldRecordSearch(search), true);
  const history = recordSearchHistory([], search);
  assert.equal(history.length, 1);
  assert.equal(history[0].recent, true);
  assert.equal(history[0].queryLead, 'Departamento en Roma Norte');
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

test('a finished filter word leaves the field while the rest can still be typed', () => {
  assert.deepEqual(splitHomeQuery('casa'), {base:'', tail:'casa'});
  assert.equal(splitHomeQuery('casa ').base, 'casa');
  assert.equal(splitHomeQuery('casa ').tail, ' ');
  assert.equal(splitHomeQuery('casa en ciu').tail, ' en ciu');
  assert.equal(splitHomeQuery('una casa en Ciudad de México con piscina').tail, ' con piscina');
  assert.equal(splitHomeQuery('casa hasta 750').tail, ' hasta 750');
  assert.equal(replaceHomeQueryTail('casa ', ' '), 'casa ');
  assert.equal(replaceHomeQueryTail('casa ', ' en ciu'), 'casa en ciu');
  assert.equal(replaceHomeQueryTail('casa ', 'en ciu'), 'casa en ciu');
  assert.equal(replaceHomeQueryTail('casa en ciu', 'en ciudad'), 'casa en ciudad');
  assert.equal(splitHomeQuery('casa\ncon piscina').base, 'casa');
  assert.equal(splitHomeQuery('casa\ncon piscina').tail, '\ncon piscina');
  assert.equal(replaceHomeQueryTail('casa ', '\n'), 'casa\n');
  assert.equal(homeTypedArticle('casa'), '');
  assert.equal(homeTypedArticle('una casa'), 'una');
  assert.equal(homeTypedArticle('un departamento'), 'un');
  assert.equal(homeTypedArticle('Uma casa en Roma'), 'uma');
  assert.equal(releaseLastHomeToken('casa'), 'cas');
  // Erasing what follows a filter keeps the filter; Backspace on the empty field then gives the word back.
  assert.equal(replaceHomeQueryTail('casa con', ''), 'casa ');
  assert.equal(replaceHomeQueryTail('casa ', ''), 'casa ');
  assert.equal(homePhraseItems(replaceHomeQueryTail('casa con', '')).length, 1);
  assert.equal(releaseLastHomeToken('casa '), 'cas');
  assert.equal(releaseLastHomeToken('casa con '), 'cas con ');
  const sentence = 'casa con 3 recamaras en Polanco y psicina';
  const segments = homePhraseSegments(`${sentence} `);
  assert.ok(segments.some(segment => segment.kind === 'text' && segment.value.includes('psicina')));
  assert.equal(spliceHomeQuery(sentence, sentence.indexOf('psicina'), sentence.indexOf('psicina') + 'psicina'.length, 'piscina'), 'casa con 3 recamaras en Polanco y piscina');
  const inserted = spliceHomeQuery(sentence, sentence.indexOf('psicina'), sentence.indexOf('psicina'), 'una ');
  assert.equal(inserted, 'casa con 3 recamaras en Polanco y una psicina');
  const roomsGap = homePhraseSegments(`${sentence} `).find(segment => segment.kind === 'text' && segment.value.includes('con'));
  assert.equal(releaseHomeTokenBefore(sentence, roomsGap.start), 'cas con 3 recamaras en Polanco y psicina');
});

test('changing a chip replaces that chip instead of adding another', () => {
  const query = 'casa con piscina en Ciudad de México con jardín ';
  const items = homePhraseItems(query);
  const city = items.find(item => item.kind === 'place');
  const garden = items.find(item => item.id === 'garden');
  const moved = replaceHomePhraseItem(query, city.key, 'Polanco II Sección');
  assert.equal(moved.includes('Ciudad de México'), false);
  assert.deepEqual(homePhraseItems(moved).filter(item => item.kind === 'place').map(item => item.place.label), ['Polanco II Sección']);
  assert.deepEqual(homePhraseItems(moved).map(item => item.kind), ['type', 'criterion', 'place', 'criterion']);
  const swapped = replaceHomePhraseItem(moved, garden.key, 'accesible');
  assert.deepEqual(homePhraseItems(swapped).filter(item => item.kind === 'criterion').map(item => item.id), ['pool', 'accessible']);
  const place = homePhraseItems(swapped).find(item => item.kind === 'place');
  const removed = replaceHomePhraseItem(swapped, place.key, '');
  assert.equal(homePhraseItems(removed).some(item => item.kind === 'place'), false);
  assert.match(removed, /^casa con piscina con accesible ?$/);
});

test('a price is identified once its thousands group is typed, and the separator stays with the number', () => {
  assert.deepEqual(homePhraseItems('casa hasta 7,000').map(item => [item.kind, item.lead]), [['type', '']]);
  assert.deepEqual(homePhraseItems('casa hasta 7,000 ').map(item => [item.kind, item.lead]), [['type', ''], ['budget', 'hasta']]);
  assert.equal(describeHomeQuery('casa hasta 7,000', areas).budget, 7000);
  assert.equal(splitHomeQuery('casa hasta 7,000').tail, ' hasta 7,000');
  assert.equal(splitHomeQuery('casa hasta 7,000 ').tail, ' ');
  for (const open of ['casa hasta 7', 'casa hasta 7,', 'casa hasta 7,00', 'casa hasta 750']) {
    assert.deepEqual(homePhraseItems(open).map(item => item.kind), ['type'], open);
  }
  // The field edits the open tail (" hasta 7"), so typing a comma or more digits keeps one number.
  assert.equal(replaceHomeQueryTail('casa hasta 7', ' hasta 7,'), 'casa hasta 7,');
  assert.equal(replaceHomeQueryTail('casa hasta 7,', ' hasta 7,00'), 'casa hasta 7,00');
  assert.equal(replaceHomeQueryTail('casa ', ','), 'casa ,');
  assert.equal(describeHomeQuery('casa hasta 7,00', areas).budget, null);
  assert.equal(describeHomeQuery('casa hasta 7,000', areas).budget, 7000);
  assert.deepEqual(homePhraseItems('casa hasta 7 con piscina ').map(item => item.kind), ['type', 'budget', 'criterion']);
});

test('the example sentence with plus-beds, several amenities and a currency code becomes filters only', () => {
  const sentence = 'casa con 2+ recámaras con piscina y jardín en Ciudad de México hasta $7,500,000 MXN ';
  const found = describeHomeQuery(sentence, areas);
  assert.equal(found.propertyType, 'house');
  assert.equal(found.beds, 2);
  assert.equal(found.parking, null);
  const parked = describeHomeQuery('casa con 2 garajes y parking space en Roma Norte', areas);
  assert.equal(parked.parking, 2);
  assert.equal(describeHomeQuery('departamento con estacionamiento', areas).parking, 1);
  assert.equal(describeHomeQuery('casa con 2 baños', areas).baths, 2);
  assert.equal(describeHomeQuery('departamento con baño', areas).baths, 1);
  assert.equal(describeHomeQuery('casa com 3 banheiros', areas).baths, 3);
  assert.equal(describeHomeQuery('casa', areas).baths, null);
  assert.deepEqual(homePhraseItems('casa con 2 baños ').map(item => item.kind), ['type', 'baths']);
  assert.equal(homePhraseItems('casa con baño').some(item => item.kind === 'baths'), false);
  assert.equal(describeHomeQuery('casa com 3 vagas', areas).parking, 3);
  assert.equal(describeHomeQuery('casa', areas).parking, null);
  assert.deepEqual(homePhraseItems('casa con garaje ').map(item => item.kind), ['type', 'parking']);
  assert.equal(homePhraseItems('casa con garaje').some(item => item.kind === 'parking'), false);
  const parkingDraft = composeHomeDraft({mode:'buy', area:'Roma Norte', areas:['Roma Norte'], address:'', budget:7_500_000, beds:2, note:'', fromIdea:false}, describeHomeQuery('casa con garaje en Roma Norte', areas), {}, 'casa con garaje en Roma Norte');
  assert.equal(parkingDraft.parking, 1);
  assert.deepEqual(found.criteria, ['pool', 'garden']);
  assert.equal(found.places[0].id, 'cdmx');
  assert.equal(found.budget, 7_500_000);
  assert.equal(splitHomeQuery(sentence).tail, ' ');
});

test('a close place name is corrected, and an amenity is recognized only when it is typed', () => {
  const typed = homePhraseItems('en Ciudad de México casa con psicina y jardín en Roma Norte ');
  assert.deepEqual(typed.map(item => item.kind), ['place', 'type', 'criterion', 'place']);
  assert.deepEqual(typed.map(item => item.lead), ['en', '', 'y', 'en']);
  assert.equal(typed[2].id, 'garden');
  assert.equal(typed[3].place.label, 'Roma Norte');
  assert.equal(splitHomeQuery('psicina').tail.trim(), 'psicina');
  assert.deepEqual(describeHomeQuery('psicina', areas).criteria, []);
  assert.deepEqual(describeHomeQuery('piscina', areas).criteria, ['pool']);
  assert.equal(describeHomeQuery('en Ciudad de Mexco', areas).places[0].label, 'Ciudad de México');
  assert.equal(homePhraseItems('pisci').length, 0);
});

test('a letter typed after a filter never turns the filter into a similar short place', () => {
  for (const typed of ['casa c', 'casa co', 'casa con', 'casa qu']) {
    const items = homePhraseItems(typed);
    assert.deepEqual(items.map(item => item.kind), ['type'], typed);
    assert.equal(splitHomeQuery(typed).base, 'casa', typed);
  }
});

test('a home description fills only the filters it names', () => {
  const found = describeHomeQuery('departamento con 3 recámaras en Ciudad de México hasta $7,500,000 con piscina', areas);
  assert.equal(found.mode, null);
  assert.equal(found.propertyType, 'apartment');
  assert.equal(found.beds, 3);
  assert.equal(found.area, 'Ambas zonas');
  assert.equal(found.budget, 7_500_000);
  assert.deepEqual(found.criteria, ['pool']);
  assert.deepEqual(describeHomeQuery('departamento con piscina y jardín y balcón', areas).criteria, ['pool', 'garden', 'balcony']);
  const rent = describeHomeQuery('quiero rentar una casa en Roma Norte hasta $40,000', areas);
  assert.equal(rent.mode, 'rent');
  assert.equal(rent.propertyType, 'house');
  assert.equal(rent.area, 'Roma Norte');
  assert.equal(rent.budget, 40_000);
  assert.equal(describeHomeQuery('casa en condominio', areas).propertyType, 'condominium');
  assert.equal(describeHomeQuery('¿hay departamentos con alberca?', areas).propertyType, null);
  assert.deepEqual(describeHomeQuery('¿hay departamentos con alberca?', areas).criteria, []);
  assert.equal(describeHomeQuery('', areas).beds, null);
  const several = describeHomeQuery('departamento en Narvarte Poniente y Polanco cerca de Metro Insurgentes Sur', areas);
  assert.deepEqual(several.places.map(place => place.label), ['Narvarte Poniente', 'Polanco', 'Metro Insurgentes Sur']);
  assert.equal(canStartHomeSearch('departamento en Narvarte Poniente y Polanco cerca de Metro Insurgentes Sur', several), true);
  assert.equal(canStartHomeSearch('departamento con 3 recámaras', describeHomeQuery('departamento con 3 recámaras', areas)), false);
  const origin = {mode:'buy', area:'Ambas zonas', areas:[], address:'', budget:50_000_000, beds:1, note:'', fromIdea:false};
  const draft = composeHomeDraft(origin, several, {}, 'departamento en Narvarte Poniente y Polanco cerca de Metro Insurgentes Sur');
  const listed = matchingHomes(draft);
  assert.ok(listed.some(home => home.area === 'Narvarte Poniente') && listed.some(home => home.area === 'Polanco'));
  assert.ok(listed.every(home => ['Narvarte Poniente', 'Polanco', 'Benito Juárez'].includes(home.area)));
  const cityAndNeighborhood = describeHomeQuery('departamento en Ciudad de México y Polanco', areas);
  assert.deepEqual(cityAndNeighborhood.places.map(place => place.label), ['Ciudad de México', 'Polanco']);
});

test('manual filter edits win until the description names that field again', () => {
  const origin = {mode:'buy', area:'Narvarte Poniente', areas:['Narvarte Poniente'], address:'', budget:7_500_000, beds:2, note:'', fromIdea:false};
  const detected = describeHomeQuery('quiero rentar', areas);
  const switched = composeHomeDraft(origin, detected, {}, 'quiero rentar');
  assert.equal(switched.mode, 'rent');
  assert.equal(switched.budget, 28_000);
  const kept = composeHomeDraft(origin, detected, {beds:4}, 'quiero rentar');
  assert.equal(kept.beds, 4);
  const priced = composeHomeDraft(origin, describeHomeQuery('departamento hasta $5,000,000', areas), {}, 'departamento hasta $5,000,000');
  assert.equal(priced.propertyType, 'apartment');
  assert.equal(priced.budget, 5_000_000);
  assert.equal(priced.minBudget, 0);
  assert.deepEqual(priced.areas, ['Narvarte Poniente']);
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
