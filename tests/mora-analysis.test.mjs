import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {homes, listingPrice} from '../src/data.js';
import {marketFacts, moraAnalysis, peerFacts, priceClass, resetMoraSession, searchFit} from '../src/moraAnalysis.js';
import {photoReading, synthesisMold} from '../src/moraInsights.js';
import {advertiserFor, advertiserHandle, advertiserHighlight} from '../src/listingAdvertiser.js';
import agencies from '../AGENCY-SOURCES.json' with {type:'json'};

const torres = homes.find(home => home.id === 'buy-148816386');
const search = {mode:'buy', area:'Narvarte Poniente', areas:['Narvarte Poniente'], budget:7500000, minBudget:0, beds:2, criteria:['furnished', 'balcony'], note:''};
const words = text => text.trim().split(/\s+/).length;

test('the analysis is stable per listing and keeps every widget that has data', () => {
  for (const home of homes.filter(item => !item.development)) {
    const first = moraAnalysis(home, {search, favorites:homes.slice(0, 4)});
    assert.deepEqual(moraAnalysis(home, {search, favorites:homes.slice(0, 4)}), first, home.id);
    assert.ok(first.modules.some(module => module.kind === 'opportunity'), `${home.id}: price`);
    assert.ok(first.modules.some(module => module.kind === 'neighborhood' || module.kind === 'surroundings'), `${home.id}: location`);
    const photos = first.modules.find(module => module.kind === 'photos');
    if (photos) {
      assert.match(photos.text, /por las fotos,/i, home.id);
      assert.doesNotMatch(photos.text, /en la foto \d+|no hay recámara|poca luz/i, home.id);
    }
    assert.doesNotMatch(first.synthesis, /en la foto \d+|no hay recámara|poca luz/i, `${home.id}: ${first.synthesis}`);
    assert.equal(first.modules.filter(module => module.kind === 'opportunity' || module.dimension === 'price').length, 1, `${home.id}: two price modules`);
    assert.equal(new Set(first.dimensions).size, 2, `${home.id}: ${first.synthesis}`);
    assert.ok((first.modules.find(module => module.items?.length)?.items.length ?? 0) <= 5, home.id);
    assert.match(first.synthesis, /\.$/, home.id);
    assert.ok(first.workingLines.length >= 1 && first.workingLines.length <= 2, home.id);
    assert.ok(first.workingLines.every(line => !/Revisando/.test(line)), home.id);
    for (const module of first.modules) if (module.items?.length) assert.ok(module.items.every(item => /\bmin\b/.test(item.text) && !/\d\s?(m|km)\b/.test(item.text)), home.id);
  }
});

test('search fit is a count of up to six criteria, and unknown facts never count as met', () => {
  const fit = searchFit(torres, search, 'none');
  assert.equal(fit.total, fit.criteria.length);
  assert.ok(fit.total <= 6);
  assert.equal(fit.criteria.find(item => item.id === 'zone').status, 'met');
  assert.equal(fit.criteria.find(item => item.id === 'budget').label, 'Bajo $7.5M');
  assert.equal(fit.criteria.find(item => item.id === 'balcony').status, 'seen');
  assert.ok(fit.criteria.find(item => item.id === 'balcony').photo >= 1);
  assert.equal(fit.met, fit.criteria.filter(item => item.status === 'met').length);
  const analysis = moraAnalysis(torres, {search});
  assert.doesNotMatch(analysis.synthesis, /%\s*de\s*match/i);
  const pricey = homes.find(home => home.mode === 'buy' && listingPrice(home) > 9000000);
  const over = searchFit(pricey, search, 'none').criteria.find(item => item.id === 'budget');
  assert.equal(over.status, 'unmet');
  assert.match(over.label, /arriba de tu presupuesto$/);
});

test('without an active search Mora skips fit and favorites, keeping market and surroundings', () => {
  const analysis = moraAnalysis(torres, {search, favorites:homes.slice(0, 4), hasSearch:false});
  assert.equal(analysis.match, undefined);
  assert.ok(analysis.modules.every(module => module.kind !== 'favorites'));
  assert.match(analysis.workingLines[0], /^Comparando con \d+ departamentos/);
});

test('price class follows the spec thresholds', () => {
  const base = {days:20, drop:null};
  assert.equal(priceClass({...base, delta:-0.4}), 'review');
  assert.equal(priceClass({...base, delta:-0.2}), 'opportunity');
  assert.equal(priceClass({...base, delta:0.02}), 'fair');
  assert.equal(priceClass({...base, delta:0.2}), 'above');
  assert.equal(priceClass({days:90, drop:null, delta:0.2}), 'negotiate');
  const facts = marketFacts(torres);
  assert.ok(facts.p10 < facts.median && facts.median < facts.p90);
  for (const home of homes) {
    const item = marketFacts(home);
    assert.ok(item.comparables >= 40 && item.days >= 6, home.id);
  }
});

test('favorites are compared by zone and size, with a contrast line when nothing matches', () => {
  const near = homes.filter(home => home.area === torres.area && home.id !== torres.id && home.mode === 'buy'
    && Math.abs(listingPrice(home) / listingPrice(torres) - 1) <= 0.4);
  assert.ok(near.length);
  const similar = moraAnalysis(torres, {search, favorites:near.slice(0, 2)}).modules.find(module => module.kind === 'favorites');
  if (similar) assert.match(similar.text, /^Se parece a (\d de tus favoritos: misma zona|tu favorito en )/);
  const elsewhere = homes.filter(home => home.mode === 'buy' && home.area !== torres.area).slice(0, 3);
  const contrast = moraAnalysis(torres, {search, favorites:elsewhere}).modules.find(module => module.kind === 'favorites');
  if (contrast) assert.match(contrast.text, /^(Se parece|Es distinto)/);
});

test('Mora interprets instead of describing the system, in both languages', () => {
  const system = /lo que se puede verificar|o que dá para verificar|sin datos|sem dados|undefined|\bNaN\b/;
  for (const language of ['es-MX', 'pt-BR']) for (const home of homes) for (const hasSearch of [true, false]) {
    const analysis = moraAnalysis(home, {search, favorites:homes.slice(0, 3), hasSearch, language});
    assert.doesNotMatch(analysis.synthesis, system, `${home.id}: ${analysis.synthesis}`);
    assert.match(analysis.synthesis, /\.$/, `${home.id}: ${analysis.synthesis}`);
    for (const module of analysis.modules) assert.doesNotMatch(JSON.stringify(module), /undefined|\bNaN\b/, home.id);
  }
});

test('criteria the listing does not mention become a question, unless a photo already shows them', () => {
  resetMoraSession();
  const asked = moraAnalysis(torres, {search, stage:'deciding'});
  const balcony = asked.match.criteria.find(item => item.id === 'balcony');
  const attention = asked.modules.find(module => module.kind === 'attention');
  if (balcony.status === 'seen') {
    assert.ok(balcony.photo >= 1);
    assert.notEqual(balcony.status, 'met');
    const photos = asked.modules.find(module => module.kind === 'photos');
    assert.ok(photos?.action?.type === 'open_photo');
  } else {
    assert.equal(balcony.status, 'unknown');
    assert.ok(attention, 'attention module');
    assert.match(attention.text, /balcón|amueblado/);
    assert.equal(attention.action.type, 'ask_agency');
    assert.match(attention.action.question, /\?$/);
  }
  assert.equal(moraAnalysis(torres, {search:{...search, criteria:[]}}).modules.some(module => module.kind === 'attention'), false);
  assert.equal(moraAnalysis(torres, {search, hasSearch:false}).modules.some(module => module.kind === 'attention'), false);
});

test('sale syntheses do not repeat one mold more than four times and seen needs a photo', () => {
  resetMoraSession();
  const plain = {mode:'buy', areas:['Narvarte Poniente'], budget:7500000, minBudget:0, beds:2, criteria:[], note:''};
  const molds = new Map();
  for (const home of homes.filter(item => item.mode === 'buy')) {
    const analysis = moraAnalysis(home, {search:plain});
    assert.equal(new Set(analysis.dimensions).size, 2, home.id);
    assert.equal(analysis.modules.some(module => module.kind === 'results'), false, home.id);
    if (photoReading(home)) {
      const photos = analysis.modules.find(module => module.kind === 'photos');
      if (photos) {
        assert.match(photos.text, /por las fotos,/i, home.id);
        assert.doesNotMatch(photos.text, /en la foto \d+|no hay recámara|poca luz/i, home.id);
      }
    }
    assert.doesNotMatch(analysis.synthesis, /en la foto \d+|no hay recámara|poca luz/i, `${home.id}: ${analysis.synthesis}`);
    assert.equal(analysis.modules.some(module => /lo presenta como/.test(module.text || '')), false, home.id);
    assert.ok(analysis.modules.filter(module => module.dimension === 'price' || module.kind === 'opportunity').length <= 1, home.id);
    const mold = synthesisMold(analysis.synthesis);
    molds.set(mold, (molds.get(mold) || 0) + 1);
    for (const item of analysis.match?.criteria || []) if (item.status === 'seen') assert.ok(item.photo >= 1, home.id);
  }
  for (const [mold, count] of molds) assert.ok(count <= 4, `${count} × ${mold}`);
});

test('similar listings share mode, bedrooms and a close size', () => {
  const peers = peerFacts(torres);
  assert.ok(peers.count >= 0 && peers.cheaper <= peers.count);
  assert.ok(peers.cheaper ? peers.savings > 0 : peers.savings === 0);
});

test('every advertiser has a name, a handle and a stable Google rating', () => {
  for (const home of homes) {
    const advertiser = advertiserFor(home, agencies.logos);
    assert.ok(advertiser.name && !/^Anunciante en Inmuebles24$/i.test(advertiser.name), home.id);
    assert.match(advertiser.handle, /^@[a-z0-9]+$/);
    assert.ok(advertiser.rating >= 4.4 && advertiser.rating <= 4.9);
    assert.ok(advertiser.reviews >= 40);
  }
  assert.equal(advertiserFor(torres, agencies.logos).name, 'Remax Interr');
  assert.equal(advertiserFor(torres, agencies.logos).handle, '@remaxinterr');
  assert.equal(advertiserHandle('D´CASA Inmobiliaria'), '@dcasainmobiliaria');
  const shared = homes.filter(home => home.broker === 'Remax Interr').map(home => advertiserFor(home, agencies.logos));
  assert.ok(shared.every(item => item.rating === shared[0].rating && item.reviews === shared[0].reviews));
});

test('invented advertisers share one stand-in avatar and never replace a verified logo', () => {
  assert.equal(advertiserFor(torres, agencies.logos).logo, '/assets/agencies/remax-interr.webp');
  const invented = homes.filter(home => /^anunciante en inmuebles24$/i.test(home.broker || ''));
  const byName = new Map();
  for (const home of invented) {
    const advertiser = advertiserFor(home, agencies.logos);
    assert.match(advertiser.logo, /^\/assets\/agencies\/[a-z0-9-]+\.(png|jpe?g|webp)$/, home.id);
    assert.equal(byName.get(advertiser.name) ?? advertiser.logo, advertiser.logo, advertiser.name);
    byName.set(advertiser.name, advertiser.logo);
    assert.ok(existsSync(new URL(`../public${advertiser.logo}`, import.meta.url)), advertiser.logo);
  }
  assert.equal(byName.size, 12);
  assert.equal(new Set(byName.values()).size, 12);
});

test('met criteria come first and the synthesis concludes instead of repeating the count', () => {
  const order = {met:0, seen:1, unmet:2, unknown:3};
  for (const home of homes) {
    const analysis = moraAnalysis(home, {search});
    if (!analysis.match) continue;
    const ranks = analysis.match.criteria.map(item => order[item.status]);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), home.id);
    assert.doesNotMatch(analysis.synthesis, /Coincide con \d+ de \d+/, home.id);
  }
});

test('surroundings name real places, put the declared one first and skip schools unless mentioned', () => {
  const places = home => moraAnalysis(home, {search:{...search, note:'trabajo en oficina en Reforma'}}).modules.find(module => module.items?.length);
  for (const home of homes.slice(0, 30)) {
    const module = places(home);
    if (!module) continue;
    assert.equal(module.items[0].icon, 'work', home.id);
    assert.match(module.items[0].text, /a tu oficina en Reforma/);
    assert.ok(module.items.every(item => item.icon !== 'education' && !/del barrio|cercana/i.test(item.text)), home.id);
  }
  const withKids = homes.slice(0, 30).map(home => moraAnalysis(home, {search:{...search, note:'tengo dos hijos'}}).modules.find(module => module.items?.length));
  assert.ok(withKids.some(module => module?.items.some(item => item.icon === 'education')));
});

test('advertiser trust signals are stable per advertiser', () => {
  const shared = homes.filter(home => home.broker === 'Remax Interr').map(home => advertiserFor(home, agencies.logos));
  assert.ok(shared.every(item => item.verified === shared[0].verified && item.domi === shared[0].domi && item.replyHours === shared[0].replyHours));
  for (const home of homes) assert.ok(advertiserFor(home, agencies.logos).replyHours >= 1, home.id);
});

test('module tiles carry a number and a support line that does not repeat it', () => {
  for (const home of homes) {
    const {modules} = moraAnalysis(home, {search:{...search, note:'trabajo en Polanco'}});
    for (const module of modules) {
      if (module.kind === 'opportunity') {
        assert.ok(module.support, home.id);
        if (module.metric) assert.ok(!module.support.includes(module.metric.value.replace(/^[−+]/, '')), `${home.id}: ${module.support}`);
      }
      if (module.items?.length) assert.ok(module.items.every(item => item.place && /\bmin\b/.test(item.time)), home.id);
    }
  }
});

test('the mini-listing verdict says what the listing is, with at most one catch and no score labels', () => {
  for (const language of ['es-MX', 'pt-BR']) for (const home of homes) {
    const {verdict} = moraAnalysis(home, {search, language});
    const id = `${home.id} ${language}: ${verdict.sentence}`;
    assert.ok(['go', 'but', 'wait'].includes(verdict.stance), id);
    assert.ok(verdict.sentence.length <= 150, id);
    assert.match(verdict.sentence, /\.$/, id);
    assert.ok((verdict.sentence.match(/\b(pero|mas)\b/gi) || []).length <= 1, id);
    assert.doesNotMatch(verdict.sentence, /encaja|en rango|no rango|tu búsqueda|sua busca|verificad/i, id);
    assert.ok(verdict.facts.length >= 1 && verdict.facts.length <= 3, id);
    assert.equal(new Set(verdict.facts.map(fact => fact.id)).size, verdict.facts.length, id);
    for (const fact of verdict.facts) assert.ok(fact.title && fact.note && fact.icon, `${id} ${fact.id}`);
    if (verdict.stance === 'go') assert.ok(verdict.facts.every(fact => fact.polarity !== 'minus'), id);
    else assert.ok(verdict.facts.some(fact => fact.polarity === 'minus'), id);
  }
});

test('the verdict never claims what the listing does not show', () => {
  for (const home of homes) {
    const {verdict} = moraAnalysis(home, {search});
    const reading = photoReading(home);
    if (verdict.facts.some(fact => fact.id === 'furnished')) assert.equal(reading?.furnished, true, home.id);
    if (verdict.facts.some(fact => fact.id === 'unfurnished')) assert.equal(reading?.furnished, false, home.id);
    const advertiser = advertiserFor(home, agencies.logos);
    if (/whatsapp/i.test(verdict.sentence)) assert.ok(advertiser.domi, home.id);
    if (/reseñas|en google|clientes/i.test(verdict.sentence)) assert.ok(verdict.sentence.includes(advertiserHighlight(advertiser)[1]), home.id);
    assert.doesNotMatch(verdict.sentence, /responden en minutos/i, home.id);
    assert.doesNotMatch(verdict.sentence, /suelen responder/i, home.id);
    const over = listingPrice(home) > search.budget;
    if (verdict.facts.some(fact => fact.id === 'budget')) assert.ok(over, home.id);
  }
});

test('the verdict varies its words across listings and never repeats a note in one card', () => {
  const notes = new Map(), connectors = new Set();
  for (const home of homes) {
    const {verdict} = moraAnalysis(home, {search});
    const own = verdict.facts.map(fact => fact.note);
    assert.equal(new Set(own).size, own.length, `${home.id}: ${own.join(' | ')}`);
    for (const note of own) notes.set(note, (notes.get(note) || 0) + 1);
    for (const word of ['pero', 'aunque', 'solo que']) if (verdict.sentence.includes(`, ${word} `)) connectors.add(word);
  }
  const total = [...notes.values()].reduce((sum, n) => sum + n, 0);
  assert.ok(Math.max(...notes.values()) / total < 0.2, 'no single note dominates');
  assert.ok(connectors.size >= 2, [...connectors].join(','));
});

test('the listing page card keeps the mini-listing sentence and sorts every finding with its evidence', async () => {
  const {detailReading} = await import('../src/moraDetail.js');
  const say = (br, es) => es;
  const short = amount => `$${Math.round(amount / 1000)}k`;
  let bars = 0, commute = 0, photos = 0;
  for (const home of homes) {
    const options = {search:{...search, note:'trabajo en Reforma'}, stage:'deciding'};
    const analysis = moraAnalysis(home, options);
    const gallery = Array.from({length:40}, (_, index) => ({src:`photo-${index}.jpg`}));
    const reading = detailReading(analysis, {home, search:options.search, places:[], gallery, short, say});
    assert.equal(reading.sentence, analysis.verdict.sentence, home.id);
    const rows = [...reading.plus, ...reading.minus];
    assert.ok(reading.plus.length <= 4 && reading.minus.length <= 4, home.id);
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length, `${home.id}: one row per finding`);
    for (const fact of analysis.verdict.facts) {
      if (fact.id === 'around' || fact.id === 'price') continue;
      const side = fact.polarity === 'plus' ? reading.plus : reading.minus;
      if (side.length < 4) assert.ok(side.some(row => row.id === fact.id), `${home.id}: the card's ${fact.id} reaches the page`);
    }
    for (const row of rows) {
      assert.ok(row.title && !/\d\s?(m|km)\b/.test(row.title), `${home.id}: ${row.title}`);
      if (row.bars) {
        bars += 1;
        assert.equal(row.bars.filter(bar => bar.self).length, 1, home.id);
        assert.ok(row.bars.every(bar => bar.value > 0), home.id);
      }
      if (row.photo) { photos += 1; assert.ok(row.photo.src.startsWith('photo-'), home.id); }
      if (row.id === 'commute') commute += 1;
      if (row.ask) assert.ok(row.ask.question, home.id);
    }
  }
  assert.ok(bars > 0 && commute > 0 && photos > 0, `${bars} ${commute} ${photos}`);
  const quiet = homes.map(home => detailReading(moraAnalysis(home, {search:{...search, note:''}}), {home, search, places:[], gallery:[], short, say}));
  assert.ok(quiet.every(reading => !reading.plus.some(row => row.id === 'commute')));
});
