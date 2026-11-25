import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {LISTING_TOPICS, listingTopic, missingFacts, nextTopics, topicQuestion, topicReading} from '../src/moraTopics.js';

const search = {mode:'buy', area:'Narvarte Poniente', areas:['Narvarte Poniente'], budget:7500000, minBudget:0, beds:2, criteria:[], note:'trabajo en Reforma'};
const listings = homes.filter(home => !home.development);

test('typed questions land on the topic they ask about', () => {
  const cases = {
    '¿Es un buen precio?':'fair', '¿Cuál es el puntaje de precio justo?':'fair',
    '¿Hay margen para negociar?':'stale', '¿Cuánto lleva publicado?':'stale',
    '¿La zona tiene plusvalía?':'trend',
    '¿Cuál es el costo mensual real?':'tco', '¿Hay gastos además de la renta?':'tco', '¿Cuánto es el predial?':'tco',
    '¿Cómo se compara con parecidos?':'compare',
    '¿Qué falta por confirmar?':'catch', '¿Tiene elevador?':'catch',
    '¿Qué hay cerca a pie?':'walk', '¿Hay un supermercado cerca?':'walk',
    '¿Cómo es vivir aquí?':'vibe', '¿Es tranquilo?':'vibe',
    '¿Cuánto tardo a mi trabajo?':'commute',
    '¿Hay mucha competencia?':'demand', '¿La están viendo muchas personas?':'demand',
    '¿Qué preguntar en la visita?':'brief',
    '¿Me alcanza con mis ingresos?':'afford', '¿Cuánto necesito ganar?':'afford',
    'O preço é justo?':'fair', 'O que perguntar na visita?':'brief',
  };
  for (const [question, topic] of Object.entries(cases)) assert.equal(listingTopic(question), topic, question);
  assert.equal(listingTopic('¿Aceptan mascotas?'), null, 'what only the agency knows stays with the agency');
  assert.equal(listingTopic('hola'), null);
});

test('every topic has a chip in both languages and the chips keep moving', () => {
  for (const topic of LISTING_TOPICS) {
    assert.ok(topicQuestion(topic, 'es-MX').startsWith('¿'), topic);
    assert.ok(topicQuestion(topic, 'pt-BR').endsWith('?'), topic);
    assert.equal(listingTopic(topicQuestion(topic, 'es-MX')), topic, `${topic}: its own chip asks it`);
    assert.equal(listingTopic(topicQuestion(topic, 'pt-BR')), topic, `${topic}: its own chip asks it in Portuguese`);
  }
  assert.equal(nextTopics('afford', 3).length, 3);
  assert.ok(!nextTopics('fair', 3).includes('fair'));
});

test('each topic reads from the listing in both languages, with no empty figures', () => {
  let answered = 0;
  for (const home of listings) {
    for (const language of ['es-MX', 'pt-BR']) {
      for (const topic of LISTING_TOPICS) {
        const reading = topicReading(topic, home, {language, search});
        if (!reading) continue;
        answered += 1;
        assert.ok(reading.text.length > 20, `${home.id} ${topic}`);
        assert.doesNotMatch(reading.text, /undefined|NaN|null|\[object/, `${home.id} ${topic}: ${reading.text}`);
      }
    }
  }
  assert.ok(answered > listings.length * 12, 'most topics answer for most listings');
  for (const topic of ['fair', 'stale', 'tco', 'catch', 'walk', 'demand', 'brief', 'afford']) {
    assert.ok(listings.some(home => topicReading(topic, home, {search})), `${topic} answers somewhere`);
  }
});

test('illustrative figures say so, and what the catalog does not publish stays to confirm', () => {
  const home = listings.find(item => item.mode === 'buy');
  for (const topic of ['fair', 'tco', 'demand', 'afford']) assert.match(topicReading(topic, home, {search}).note, /ilustrativa/i, topic);
  assert.match(topicReading('tco', home, {search}).text, /predial.*por confirmar/i);
  const asks = missingFacts(home, 'es-MX');
  assert.ok(asks.some(item => item.id === 'tax'), 'the property tax is never in the catalog');
  assert.ok(asks.every(item => item.question.endsWith('?')));
});

test('a budget the listing passes is named, and developments are left to their own page', () => {
  const home = listings.find(item => item.mode === 'buy');
  const over = topicReading('afford', home, {search:{...search, budget:1000000}});
  assert.match(over.text, /se pasa/i);
  const inside = topicReading('afford', home, {search:{...search, budget:900000000}});
  assert.match(inside.text, /dentro de tu tope/i);
  assert.equal(topicReading('fair', homes.find(item => item.development), {search}), null);
});
