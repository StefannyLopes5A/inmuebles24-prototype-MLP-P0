import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {PRICE_BANDS, TRAVEL_MODES, byPricePerM2, compareReading, nearbyPlaces, priceBand, pricePerM2, travelMinutes} from '../src/compareReading.js';

const trio = ['buy-150922505', 'buy-150108941', 'buy-148816386'].map(id => homes.find(home => home.id === id));

test('the Narvarte trio reads price per m², zone delta and band from the catalog', () => {
  assert.equal(trio.every(Boolean), true);
  const reading = compareReading(trio);
  assert.deepEqual(reading.cards.map(card => card.ppm2), [58594, 33133, 24870]);
  assert.deepEqual(reading.cards.map(card => Math.round(card.delta * 100)), [30, -26, -45]);
  assert.deepEqual(reading.cards.map(card => card.band), ['p90-100', 'p30-70', 'p0-30']);
  assert.equal(reading.best.price, 'buy-148816386');
  assert.equal(reading.cards[2].priceNote, 'El m² más barato de lo que guardaste en Narvarte Poniente.');
  assert.deepEqual(reading.cards.map(card => card.summary.lead), ['Más estacionamientos', 'El metro más cerca', 'Más recámaras']);
  assert.deepEqual(compareReading(trio, 'pt-BR').cards.map(card => card.summary.lead), ['Mais vagas', 'Metrô mais perto', 'Mais quartos']);
  assert.deepEqual(reading.cards.map(card => card.priceNote), ['El m² más alto de tu lista.', 'El segundo m² más bajo de tu lista.', 'El m² más barato de lo que guardaste en Narvarte Poniente.']);
});

test('the price band maps the zone delta onto the Figma segments', () => {
  assert.equal(priceBand(null), null);
  assert.deepEqual(priceBand(-0.3), {id:'p30-70', position:PRICE_BANDS[1].start});
  assert.equal(priceBand(-0.9).position, 0);
  assert.equal(priceBand(2).position, 1);
  assert.equal(priceBand(0.29).id, 'p70-90');
  for (const delta of [-0.5, -0.1, 0.05, 0.2, 0.5]) {
    const band = priceBand(delta);
    const segment = PRICE_BANDS.find(item => item.id === band.id);
    assert.ok(band.position >= segment.start && band.position <= segment.end, `${delta}`);
  }
});

test('the comparison orders homes from the cheapest m², unknown sizes last', () => {
  const unknown = {...trio[0], id:'unknown-size', size:0};
  assert.deepEqual(byPricePerM2([unknown, ...trio]).map(home => home.id), ['buy-148816386', 'buy-150108941', 'buy-150922505', 'unknown-size']);
});

test('a single home or unknown size has no best price, and size stays unknown', () => {
  assert.equal(compareReading([trio[2]]).best.price, null);
  assert.equal(pricePerM2({...trio[0], size:0}), null);
});

test('every catalog home reads against a zone reference', () => {
  const missing = homes.filter(home => !home.development && compareReading([home]).cards[0].delta == null).map(home => `${home.mode} ${home.area}`);
  assert.deepEqual(missing, []);
});

test('every catalog home lists the closest metro, park, school and food place from its own pin', () => {
  for (const home of homes) assert.deepEqual(nearbyPlaces(home).map(place => place.kind), ['transport', 'green', 'education', 'food'], home.id);
  const [a, b] = trio.map(home => nearbyPlaces(home)[0].meters);
  assert.notEqual(a, b);
});

test('travel time grows with distance and each mode follows its own route', () => {
  assert.equal(travelMinutes(400, 'walk'), 5);
  assert.equal(travelMinutes(400, 'bike'), 3);
  assert.equal(travelMinutes(400, 'car'), 3);
  assert.equal(travelMinutes(400, 'car', 1), 8);
  assert.equal(travelMinutes(0, 'walk'), 1);
  assert.ok(travelMinutes(2000, 'car') < travelMinutes(2000, 'walk'));
  const places = homes.slice(0, 20).flatMap(home => nearbyPlaces(home));
  assert.ok(places.every(place => TRAVEL_MODES.every(mode => place.minutes[mode] >= 1)));
  const rank = mode => places.map(place => place.minutes[mode]).join();
  assert.notEqual(rank('walk'), rank('car'));
});

test('the fastest home for a place can change with the travel mode', () => {
  const group = ['buy-150851727', 'buy-148816386', 'buy-147346296', 'buy-150108941', 'buy-150922505'].map(id => nearbyPlaces(homes.find(home => home.id === id)));
  const winners = mode => group[0].map((_, kind) => {
    const times = group.map(places => places[kind].minutes[mode]);
    return times.map((value, index) => value === Math.min(...times) ? index : null).filter(index => index != null).join('+');
  }).join('|');
  assert.notEqual(winners('walk'), winners('car'));
});

test('"Lo que destaca" reads each column against the others, never a fixed blurb', () => {
  const words = text => text.trim().split(/\s+/).length;
  for (let start = 0; start + 3 <= homes.length; start += 3) {
    const group = homes.slice(start, start + 3);
    const cards = compareReading(group).cards;
    const leads = cards.map(card => card.summary.lead);
    const won = leads.filter(lead => !/zona|destaque/.test(lead));
    assert.equal(new Set(won).size, won.length, `${leads}`);
    for (const card of cards) {
      assert.ok(card.summary.lead && card.summary.text, card.home.id);
      assert.ok(words(card.summary.text) <= 20, card.summary.text);
      assert.doesNotMatch(`${card.summary.text} ${card.priceNote}`, /undefined|NaN|null/, card.home.id);
    }
  }
  const pair = compareReading(trio.slice(0, 2)).cards;
  assert.match(pair[0].summary.text, /el otro/);
  assert.match(compareReading([trio[0]]).cards[0].summary.text, /^Guarda otro favorito/);
});

test('rent and sale never compete on price', () => {
  const rent = homes.find(home => home.mode === 'rent');
  const reading = compareReading([trio[2], rent]);
  assert.equal(reading.best.price, null);
  assert.ok(reading.cards.every(card => card.summary.lead !== 'El más accesible'));
});
