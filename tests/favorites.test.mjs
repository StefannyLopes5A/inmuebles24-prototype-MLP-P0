import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeRecent, normalizeSaved, recordView, SAVED_LIMIT, toggleSaved} from '../src/favorites.js';

test('saved ids are deduplicated, limited to known listings and capped', () => {
  assert.deepEqual(normalizeSaved(['a', 'a', 'b', 'x', 7], new Set(['a', 'b'])), ['a', 'b']);
  assert.deepEqual(normalizeSaved('nope'), []);
  assert.equal(normalizeSaved(Array.from({length:SAVED_LIMIT + 5}, (_, i) => `h${i}`)).length, SAVED_LIMIT);
});

test('the heart toggles a flat favorite and the newest comes first', () => {
  const first = toggleSaved([], 'a');
  assert.deepEqual(first, {ids:['a'], saved:true});
  assert.deepEqual(toggleSaved(first.ids, 'b').ids, ['b', 'a']);
  assert.deepEqual(toggleSaved(['b', 'a'], 'b'), {ids:['a'], saved:false});
});

test('recent views keep one entry per listing, newest first', () => {
  const list = recordView(recordView([], 'a', 1), 'b', 2);
  assert.deepEqual(recordView(list, 'a', 3).map(entry => entry.id), ['a', 'b']);
  assert.deepEqual(normalizeRecent([{id:'a'}, {id:'a'}, {id:'z'}], new Set(['a'])).map(entry => entry.id), ['a']);
});
