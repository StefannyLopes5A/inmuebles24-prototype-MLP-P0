import test from 'node:test';
import assert from 'node:assert/strict';
import {pagerWindow, resultsBlockSize, resultsPageSize} from '../src/resultsPager.js';

test('a results page is two blocks of four rows of the current grid', () => {
  assert.equal(resultsBlockSize(4), 16);
  assert.equal(resultsPageSize(4), 32, 'two blocks of four rows');
  assert.equal(resultsPageSize(1), 8);
  assert.equal(resultsPageSize(0), 8);
});

test('the pager shows every page when they fit, and centers the current one when they do not', () => {
  assert.deepEqual(pagerWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pagerWindow(1, 10), [1, 2, 3, 4, 5]);
  assert.deepEqual(pagerWindow(5, 10), [3, 4, 5, 6, 7]);
  assert.deepEqual(pagerWindow(10, 10), [6, 7, 8, 9, 10]);
  assert.deepEqual(pagerWindow(2, 4, 3), [1, 2, 3]);
  assert.deepEqual(pagerWindow(1, 0), []);
});
