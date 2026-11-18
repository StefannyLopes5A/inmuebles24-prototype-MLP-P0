import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {publishedParking, similarPriceRows, streetLine} from '../src/similarPrices.js';

const home = homes.find(item => item.id === 'buy-148816386');

test('the comparison starts with this listing and only published facts', () => {
  const rows = similarPriceRows(home);
  assert.ok(rows.length >= 2);
  assert.equal(rows[0].current, true);
  assert.equal(rows[0].home.id, home.id);
  assert.equal(rows[0].meters, 0);
  assert.equal(rows[0].size, 193);
  assert.equal(rows[0].beds, 5);
  assert.equal(rows[0].parking, 1);
  assert.equal(rows[0].street, 'Torres Adalid');
  assert.ok(rows[0].ppm2 > 0);
  assert.equal(rows.filter(row => row.best).length, 1);
  for (const row of rows) {
    assert.equal(row.home.mode, home.mode);
    assert.equal(row.home.development || false, false);
    if (!/estac/.test(row.home.features || '')) assert.equal(row.parking, null);
    if (!(row.home.size >= 20)) assert.equal(row.size, null);
    assert.ok(row.current || row.meters >= 10);
  }
});

test('a street keeps the address line and drops the repeated colonia', () => {
  const listed = homes.find(item => item.id === 'buy-150590132');
  assert.equal(streetLine(listed), 'Av. Nevado 52');
  assert.equal(publishedParking(homes.find(item => item.id === 'buy-150851727')), null);
});
