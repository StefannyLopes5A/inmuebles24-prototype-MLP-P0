import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFolders} from '../src/favoriteLists.js';
import {adjacentStage, normalizeBoard, readBoard, stageFor, withGuest, withStage} from '../src/boardModel.js';

const folder = {id:'list-a', name:'Casa', homeIds:['h1', 'h2'], createdAt:1};

test('a saved home with no stage is a candidate, and a contact lands in Contactadas', () => {
  const board = readBoard(folder);
  assert.equal(stageFor('h1', board, false), 'interest');
  assert.equal(stageFor('h2', board, true), 'contacted');
  const contacted = withStage(folder, 'h2', 'contacted', {keepLater:true});
  assert.equal(contacted.board.stages.h2, 'contacted');
  const later = withStage({...contacted, homeIds:['h1', 'h2']}, 'h2', 'visited');
  assert.equal(withStage(later, 'h2', 'contacted', {keepLater:true}).board.stages.h2, 'visited');
  const offered = withStage(folder, 'h1', 'offer');
  assert.equal(withStage(offered, 'h1', 'contacted', {keepLater:true}).board.stages.h1, 'offer');
});

test('a drag stores the column and a bad stage does not survive a reload', () => {
  const moved = withStage(folder, 'h1', 'visit');
  assert.equal(stageFor('h1', readBoard(moved), true), 'visit');
  const known = new Set(['h1', 'h2']);
  const stored = normalizeFolders([{...moved, board:{stages:{h1:'visit', h9:'contacted', h2:'nope'}, labels:{interest:'Candidatas', visit:'  '}, guests:[{email:'Ana@Ejemplo.com'}, {email:'no'}, {email:'ana@ejemplo.com'}]}}], [], known);
  assert.deepEqual(stored[0].board.stages, {h1:'visit'});
  assert.deepEqual(stored[0].board.labels, {interest:'Candidatas'});
  assert.deepEqual(stored[0].board.guests, [{email:'ana@ejemplo.com'}]);
  assert.deepEqual(normalizeBoard({stages:{h1:'interest'}}, ['h1']), {stages:{h1:'interest'}});
  assert.equal(normalizeBoard({stages:{gone:'interest'}}, ['h1']), undefined);
});

test('a swipe wraps around the five columns in both directions', () => {
  assert.equal(adjacentStage('interest', 1), 'contacted');
  assert.equal(adjacentStage('contacted', 1), 'visit');
  assert.equal(adjacentStage('visit', 1), 'visited');
  assert.equal(adjacentStage('visited', 1), 'offer');
  assert.equal(adjacentStage('offer', 1), 'interest');
  assert.equal(adjacentStage('interest', -1), 'offer');
  assert.equal(adjacentStage('offer', -1), 'visited');
  assert.equal(adjacentStage('contacted', -1), 'interest');
});

test('the same guest is not added twice', () => {
  const first = withGuest(folder, ' persona@ejemplo.com ');
  assert.equal(first.added, true);
  assert.equal(withGuest(first.folder, 'PERSONA@ejemplo.com').added, false);
  assert.equal(withGuest(folder, 'no-es-correo').added, false);
});
