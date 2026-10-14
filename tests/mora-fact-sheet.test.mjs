import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {marketFacts} from '../src/moraAnalysis.js';
import {factSheet, normalizeAddress} from '../src/moraFactSheet.js';
import gold from '../src/data/mora-gold.json' with {type:'json'};

const polanco = homes.find(home => home.id === 'buy-151031662');
const ticoman = homes.find(home => home.id === 'buy-150911591');
const goldPolanco = gold.examples.find(item => item.id === 'gold-polanco-cocina').factSheet;

function strings(value, path = '', out = []) {
  if (typeof value === 'string') out.push([path, value]);
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) strings(item, `${path}.${key}`, out);
  return out;
}

test('Polanco market numbers match the golden example and the price ruler', () => {
  const sheet = factSheet(polanco);
  const facts = marketFacts(polanco);
  for (const key of ['pricePerM2', 'comparablesCount', 'comparablesMedianPerM2', 'comparablesP10PerM2', 'comparablesP90PerM2', 'diffVsMedianPct', 'classification']) {
    assert.equal(sheet.market[key], goldPolanco.market[key], key);
  }
  assert.equal(sheet.market.pricePerM2, facts.ppm2);
  assert.equal(sheet.market.comparablesMedianPerM2, facts.median);
  assert.equal(sheet.market.daysListed, facts.days);
  assert.equal(sheet.listing.price, goldPolanco.listing.price);
});

test('points of interest go declared, search, park, each with minutes and mode', () => {
  const {poisRanked} = factSheet(polanco).neighborhood;
  assert.deepEqual(poisRanked.map(item => item.reason), ['declared:office', 'search:nearMetro', 'nearest:park']);
  assert.deepEqual(poisRanked.map(item => item.name), ['Tu oficina en Reforma', 'Metro Polanco', 'Parque Lincoln']);
  assert.ok(poisRanked.every(item => Number.isInteger(item.minutes) && item.mode));
  for (const home of homes) {
    const names = factSheet(home).neighborhood.poisRanked.map(item => item.name).join(' ');
    assert.doesNotMatch(names, /starbucks|woolworth|oxxo|similares|walmart|7-eleven/i, home.id);
  }
});

test('the sheet holds facts only: no sentence besides catalog names and the curated photo note', () => {
  for (const home of homes.slice(0, 30)) {
    const sheet = factSheet(home);
    for (const [path, value] of strings(sheet)) {
      if (/address|street|colonia|alcaldia|zone|\.name$|Label$|note$|\.value$/.test(path)) continue;
      assert.ok(value.trim().split(/\s+/).length < 3, `${home.id} ${path}: ${value}`);
    }
  }
});

test('addresses are normalized without repeating the colonia', () => {
  assert.equal(normalizeAddress(ticoman).address, 'Av. Acueducto 833, Candelaria Ticomán, Gustavo A. Madero');
  assert.equal(normalizeAddress(polanco).address, 'Calle Monte Elbruz 105, Polanco II Sección, Miguel Hidalgo');
  assert.doesNotMatch(normalizeAddress(homes.find(home => /constructor/i.test(home.area))).address, /function|native code/);
});

test('favorites resolve to the catalog and similarity follows the numbers', () => {
  const sheet = factSheet(polanco);
  const cuauhtemoc = sheet.comparisonWithFavorites.find(item => item.favoriteId === 'fav-cuauhtemoc-661');
  assert.equal(cuauhtemoc.favoriteListingId, 'buy-150922505');
  assert.equal(cuauhtemoc.priceDiffPct, -24);
  assert.notEqual(cuauhtemoc.similarity, 'high');
  assert.deepEqual(sheet.favoritesUnresolved, ['fav-luz-savinon']);
  for (const home of homes) for (const item of factSheet(home).comparisonWithFavorites) {
    if (item.similarity === 'high') assert.ok(Math.abs(item.priceDiffPct) <= 10, home.id);
  }
});
