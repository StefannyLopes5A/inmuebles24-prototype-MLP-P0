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

test('a vote toggles, a note is one per person, and a new guest answers on one listing', async () => {
  const {withVote, withComment, feedbackFor, withGuest, withoutGuest, readBoard, SELF} = await import('../src/boardModel.js');
  let folder = {id:'f', homeIds:['a', 'b', 'c']};
  folder = withVote(folder, 'a', SELF, 'up');
  assert.equal(feedbackFor(readBoard(folder), 'a').up, 1);
  folder = withVote(folder, 'a', SELF, 'up');
  assert.equal(feedbackFor(readBoard(folder), 'a').up, 0, 'the same vote again removes it');
  folder = withVote(withVote(folder, 'a', SELF, 'up'), 'a', SELF, 'down');
  assert.deepEqual([feedbackFor(readBoard(folder), 'a').up, feedbackFor(readBoard(folder), 'a').down], [0, 1]);
  folder = withComment(withComment(folder, 'a', SELF, 'Primera'), 'a', SELF, 'Segunda');
  assert.deepEqual(feedbackFor(readBoard(folder), 'a').notes.map(note => note.text), ['Segunda']);
  assert.equal(feedbackFor(readBoard(withComment(folder, 'a', SELF, '   ')), 'a').notes.length, 0);
  assert.equal(withVote(folder, 'zzz', SELF, 'up'), folder, 'unknown listings are ignored');

  const added = withGuest({id:'f', homeIds:['a', 'b', 'c']}, 'ana@example.com', {language:'pt-BR', now:1e12});
  assert.ok(added.added);
  const board = readBoard(added.folder);
  const touched = Object.keys(board.feedback);
  assert.equal(touched.length, 1, 'the guest answers on one listing');
  const entry = feedbackFor(board, touched[0]);
  assert.equal(entry.up, 1);
  assert.equal(entry.notes[0].actor, 'ana@example.com');
  assert.ok(entry.notes[0].at < 1e12, 'the note is from a few hours ago');
  assert.deepEqual(readBoard(withoutGuest(added.folder, 'ana@example.com')).feedback, {}, 'removing the guest removes their feedback');
});
