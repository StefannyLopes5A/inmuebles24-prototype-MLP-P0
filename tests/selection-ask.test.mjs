import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {followUpReading, sectionFollowUps, sectionReading, selectableText, selectionAnswer, selectionLens} from '../src/selectionAsk.js';
import {offerIdeas} from '../src/offerIdeas.js';
import {purchaseCosts} from '../src/purchaseCosts.js';
import {priceHistory} from '../src/priceHistory.js';
import {listingNeighborhood} from '../src/listingStory.js';

const buy = homes.find(home => home.id === 'buy-148816386');
const rent = homes.find(home => home.mode === 'rent' && !home.development);

test('the question picks the lens before the selected text', () => {
  assert.equal(selectionLens({text:'a unos pasos del metro', question:'¿Está caro?'}), 'price');
  assert.equal(selectionLens({text:'a unos pasos del metro'}), 'distance');
  assert.equal(selectionLens({text:'$4,800,000'}), 'price');
  assert.equal(selectionLens({text:'Excelente oportunidad'}), 'jargon');
  assert.equal(selectionLens({text:'Con roof garden privado'}), 'attribute');
  assert.equal(selectionLens({text:'Muy amables', zone:'review'}), 'review');
  assert.equal(selectionLens({text:'Bienvenido'}), 'describe');
});

test('market questions reuse the illustrative ranges, per operation', () => {
  const sale = selectionAnswer({text:'$4,800,000', question:'¿Cuánto cobra el notario?', home:buy});
  assert.equal(sale.lens, 'notary');
  assert.match(sale.text, /4% y 7%/);
  assert.equal(sale.note, 'Referencia ilustrativa');
  const lease = selectionAnswer({text:'Renta', question:'¿Cuánto cobra el notario?', home:rent});
  assert.match(lease.text, /Al rentar no se escritura/);
  const loose = selectionAnswer({text:'Hola', question:'¿Qué garantía piden?'});
  assert.match(loose.note, /no cambia tus filtros/);
});

test('a price pill answers whether this listing is fair for its colonia', () => {
  const price = sectionReading('price', buy, 'es-MX');
  assert.match(price.text, /Narvarte Poniente/);
  assert.match(price.text, /m²|zona/);
  assert.equal(sectionReading('pets', buy, 'es-MX'), null);
  const about = sectionReading('description', buy, 'es-MX');
  assert.match(about.text, /mirar de cerca/);
  assert.match(about.text, /m²/);
  assert.equal(about.ask, false);
  assert.equal(sectionReading('price', null, 'es-MX'), null);
});

test('offer ideas are bands under the asking price, and the offer pill reads the strong one', () => {
  const ideas = offerIdeas(buy);
  assert.deepEqual(ideas.levels.map(level => level.id), ['strong', 'competitive', 'moderate', 'weak']);
  const [strong, competitive, moderate, weak] = ideas.levels;
  assert.ok(strong.from < ideas.price && strong.to == null);
  assert.equal(competitive.to, strong.from);
  assert.equal(moderate.to, competitive.from);
  assert.equal(weak.to, moderate.from);
  assert.ok(strong.chance > competitive.chance && competitive.chance > moderate.chance && moderate.chance > weak.chance);
  assert.equal(offerIdeas(rent), null);
  const offer = sectionReading('offer', buy, 'es-MX');
  assert.match(offer.text, /más chance tiene de cerrar/);
  assert.match(offer.text, /días publicado/);
  assert.match(sectionReading('offer', buy, 'pt-BR').text, /mais chance tem de fechar/);
  assert.equal(sectionReading('offer', rent, 'es-MX'), null);
});

test('the cost calculator adds down payment and closing costs, and Mora reads the down-payment trade-off', () => {
  const costs = purchaseCosts({offer:6000000});
  assert.equal(costs.enganche, 1200000);
  assert.equal(costs.isai, 210000);
  assert.equal(costs.upfront, costs.enganche + costs.isai + costs.closing);
  const closingShare = (costs.isai + costs.closing) / 6000000;
  assert.ok(closingShare >= 0.04 && closingShare <= 0.07);
  assert.ok(costs.monthly > 0 && costs.interest > 0);
  assert.ok(purchaseCosts({offer:6000000, down:0.3}).monthly < costs.monthly);
  const reading = sectionReading('costs', buy, 'es-MX');
  assert.match(reading.text, /20% de enganche/);
  assert.match(reading.text, /ilustrativa/);
  assert.equal(sectionReading('costs', rent, 'es-MX'), null);
});

test('price and distance read the listing around the selection', () => {
  const price = selectionAnswer({text:'$4,800,000', question:'¿Está caro?', home:buy});
  assert.match(price.text, /Narvarte Poniente/);
  assert.match(price.text, /m²/);
  const steps = selectionAnswer({text:'a unos pasos del metro', home:buy});
  assert.equal(steps.lens, 'distance');
  assert.match(steps.text, /«a unos pasos»/);
  assert.match(steps.text, /min a pie/);
  const claimed = selectionAnswer({text:'la estación queda a 40 min a pie', home:buy});
  assert.match(claimed.text, /^El texto dice 40 min; por la ruta a pie/);
});

test('without a listing Mora says what she cannot tell', () => {
  const price = selectionAnswer({text:'$28,500', question:'¿Está caro?'});
  assert.match(price.text, /no sé de qué anuncio/);
  const loose = selectionAnswer({text:'Encuentra tu lugar'});
  assert.equal(loose.lens, 'describe');
  assert.match(loose.text, /no es un dato de un anuncio/);
  const offTopic = selectionAnswer({text:'Narvarte', question:'¿Llueve mucho en esta colonia?', home:buy});
  assert.equal(offTopic.lens, 'unknown');
  assert.match(offTopic.text, /no está en el anuncio/);
});

test('unknown listing facts stay to confirm, and the agency is offered instead', () => {
  const fee = selectionAnswer({text:'Mantenimiento', home:{...buy, fee:null}});
  assert.equal(fee.ask, true);
  assert.match(fee.text, /no publica el mantenimiento/);
  assert.equal(fee.chips[0], 'Preguntar a la inmobiliaria');
  const shown = selectionAnswer({text:'Mantenimiento al mes', around:'$4,000 MXN Mantenimiento al mes', home:{...buy, fee:null}});
  assert.match(shown.text, /muestra \$4,000.*no publica/);
  const agency = selectionAnswer({text:'Mantenimiento', question:'Preguntar a la inmobiliaria', home:buy});
  assert.equal(agency.lens, 'agency');
  assert.match(agency.text, /no se envía nada/);
});

test('every answer has two chips and a Portuguese pair', () => {
  for (const args of [{text:'$4,800,000', home:buy}, {text:'Hola'}, {text:'a unos pasos', home:buy}]) {
    const es = selectionAnswer(args), br = selectionAnswer({...args, language:'pt-BR'});
    assert.equal(es.chips.length, 2);
    assert.notEqual(es.text, br.text);
  }
});

test('selection length is bounded', () => {
  assert.equal(selectableText('a'), null);
  assert.equal(selectableText('  dos   palabras '), 'dos palabras');
  assert.equal(selectableText('x'.repeat(281)), null);
});

test('each section pill offers its own quick questions, answered locally in both languages', () => {
  for (const section of ['price', 'description', 'offer', 'costs', 'history']) {
    const es = sectionFollowUps(section, buy, 'es-MX');
    const br = sectionFollowUps(section, buy, 'pt-BR');
    assert.equal(es.length, 2, section);
    assert.deepEqual(es.map(item => item.id), br.map(item => item.id));
    for (const item of es) {
      const answer = followUpReading(item.id, buy, 'es-MX');
      assert.ok(answer.text.length > 20, item.id);
      assert.notEqual(answer.text, followUpReading(item.id, buy, 'pt-BR').text, item.id);
    }
  }
  assert.deepEqual(sectionFollowUps('costs', rent, 'es-MX'), []);
  assert.deepEqual(sectionFollowUps('pets', buy, 'es-MX'), []);
  assert.equal(followUpReading('upfront', null, 'es-MX'), null);
});

test('quick questions answer from the same numbers as their pill, and only the negotiation one goes to the agency', () => {
  assert.equal(followUpReading('negotiable', buy, 'es-MX').ask, true);
  for (const id of ['cheaper', 'speed', 'nearby', 'lower', 'upfront', 'monthly', 'forecast', 'own']) assert.equal(followUpReading(id, buy, 'es-MX').ask, false, id);
  assert.match(followUpReading('upfront', buy, 'es-MX').text, /Al firmar, unos/);
  assert.match(followUpReading('monthly', buy, 'es-MX').text, /la mensualidad queda en/);
  const history = priceHistory(buy, listingNeighborhood(buy)('es-MX'));
  assert.match(followUpReading('own', buy, 'es-MX').text, history.drop ? /ya bajó/ : /No cambió de precio/);
  assert.match(followUpReading('forecast', buy, 'es-MX').text, /no una promesa|no es una promesa/);
});

test('the price history ends at the colonia median and keeps the listing events in order', () => {
  const hood = listingNeighborhood(buy)('es-MX');
  const now = new Date(2026, 10, 17);
  const history = priceHistory(buy, hood, now);
  assert.equal(history.months.length, 12);
  assert.equal(history.months.at(-1).value, hood.medianPerM2);
  assert.equal(history.months[0].date.getMonth(), 11);
  assert.ok(Math.abs(history.months.at(-1).value / history.months[0].value - 1 - hood.trend.spoilerPct / 100) < 0.01);
  const listed = history.rows.find(row => row.kind === 'listed');
  assert.equal(Math.round((now - listed.date) / 86400000), history.days);
  const drop = history.rows.find(row => row.kind === 'drop');
  if (drop) assert.ok(drop.date > listed.date);
  assert.deepEqual([...history.rows].sort((a, b) => b.date - a.date), history.rows);
  const reading = sectionReading('history', buy, 'es-MX');
  assert.match(reading.text, /en 12 meses/);
  assert.match(reading.text, /no una promesa/);
  assert.equal(priceHistory(rent, hood, now), null);
});
