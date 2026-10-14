import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {homes} from '../src/data.js';
import {listingDetails} from '../src/listingPresentation.js';
import readings from '../src/data/listing-reading.json' with {type:'json'};
import {PHOTO_CONDITION, PHOTO_LIGHT, PHOTO_MISSING, PHOTO_SPACES, PHOTO_VIEW} from '../src/moraInsights.js';

const sets = [...new Set(homes.map(home => home.photoSetId).filter(Boolean))];

test('every catalog photo set has a reading in the closed vocabulary', () => {
  assert.ok(sets.length >= 50);
  for (const id of sets) {
    const reading = readings[id];
    assert.ok(reading, id);
    assert.ok(PHOTO_LIGHT.includes(reading.light), `${id} light`);
    assert.ok(PHOTO_VIEW.includes(reading.view), `${id} view`);
    assert.ok(PHOTO_CONDITION.includes(reading.condition), `${id} condition`);
    assert.equal(typeof reading.furnished, 'boolean', id);
    assert.equal(typeof reading.render, 'boolean', id);
    assert.ok(Array.isArray(reading.spaces), id);
    const home = homes.find(item => item.photoSetId === id);
    const gallery = listingDetails(home).gallery;
    for (const space of reading.spaces) {
      assert.ok(PHOTO_SPACES.includes(space.kind), `${id} ${space.kind}`);
      assert.ok(Number.isInteger(space.photo) && space.photo >= 1 && space.photo <= gallery.length, `${id} photo ${space.photo}`);
      const file = gallery[space.photo - 1];
      assert.ok(existsSync(`public${file}`), file);
    }
    for (const missing of reading.missing || []) assert.ok(PHOTO_MISSING.includes(missing), `${id} missing ${missing}`);
    assert.equal(typeof reading.notes?.es, 'string', id);
    assert.equal(typeof reading.notes?.pt, 'string', id);
    assert.doesNotMatch(`${reading.notes.es} ${reading.notes.pt}`, /excelente|ideal|perfecto|!/i);
  }
});
