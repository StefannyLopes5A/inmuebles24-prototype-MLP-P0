import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_NAME_MAX, RECENT_LIMIT, suggestedFolderName, cleanFolderName, normalizeFolders, normalizeRecent,
  createFolder, saveToFolder, uniqueFolderName, savedIds, folderOf, recordView, isFolderId, viewedLabel, savedCountLabel, pickId, pickIds,
} from '../src/favoriteLists.js';
import {DEFAULT_SEARCH, journeyUrl, normalizeSearch, readJourney} from '../src/journey.js';

test('suggested folder name starts with the city and adds searched areas within 50 characters', () => {
  assert.equal(suggestedFolderName({areas:['Narvarte Poniente']}), 'Ciudad de México, Narvarte Poniente');
  assert.equal(suggestedFolderName({areas:[]}), 'Ciudad de México');
  const many = suggestedFolderName({areas:['Narvarte Poniente', 'Del Valle Centro', 'Santa María la Ribera']});
  assert.ok(many.length <= FOLDER_NAME_MAX);
  assert.equal(many, 'Ciudad de México, Narvarte Poniente');
});

test('a repeated suggestion gets a numeric suffix within the cap', () => {
  const folders = [{name:'Ciudad de México, Narvarte Poniente'}, {name:'Ciudad de México, Narvarte Poniente 2'}];
  assert.equal(uniqueFolderName('Ciudad de México, Narvarte Poniente', folders), 'Ciudad de México, Narvarte Poniente 3');
  assert.equal(uniqueFolderName('Nueva', folders), 'Nueva');
  assert.ok(uniqueFolderName('x'.repeat(50), [{name:'x'.repeat(50)}]).length <= FOLDER_NAME_MAX);
});

test('folder names are trimmed, single-line and capped at 50 characters', () => {
  assert.equal(cleanFolderName('  Casa\n nueva  '), 'Casa nueva');
  assert.equal(cleanFolderName('x'.repeat(80)).length, FOLDER_NAME_MAX);
  assert.equal(createFolder([], '   ', 'a').folder, null);
});

test('a home lives in a single folder and choosing its current folder removes it', () => {
  const {folders:first, folder:a} = createFolder([], 'Narvarte', 'home-1', 1);
  const {folders:second, folder:b} = createFolder(first, 'Del Valle', 'home-2', 2);
  assert.deepEqual(savedIds(second).sort(), ['home-1', 'home-2']);
  const moved = saveToFolder(second, b.id, 'home-1');
  assert.equal(moved.removed, false);
  assert.equal(folderOf(moved.folders, 'home-1').id, b.id);
  assert.deepEqual(moved.folders.find(folder => folder.id === b.id).homeIds, ['home-1', 'home-2']);
  assert.equal(moved.folders.find(folder => folder.id === a.id), undefined);
  const removed = saveToFolder(moved.folders, b.id, 'home-1');
  assert.equal(removed.removed, true);
  assert.equal(folderOf(removed.folders, 'home-1'), null);
});

test('a legacy saved list becomes one folder and malformed session folders are dropped', () => {
  const known = new Set(['a', 'b']);
  assert.deepEqual(normalizeFolders(undefined, ['a', 'zzz', 'b'], known), [{id:'list-favoritos', name:'Favoritos', homeIds:['a', 'b'], createdAt:0}]);
  assert.deepEqual(normalizeFolders([], ['a'], known), []);
  const cleaned = normalizeFolders([{id:'list-x', name:'Ok', homeIds:['a']}, {id:'bad id', name:'No'}, {id:'list-y', name:'', homeIds:[]}, {id:'list-z', name:'Dup', homeIds:['a', 'b']}], [], known);
  assert.deepEqual(cleaned.map(folder => folder.id), ['list-x', 'list-z']);
  assert.deepEqual(cleaned[1].homeIds, ['b']);
});

test('recently viewed keeps the newest first without duplicates and with a cap', () => {
  let recent = [];
  for (let i = 0; i < RECENT_LIMIT + 5; i += 1) recent = recordView(recent, `h${i}`, i);
  recent = recordView(recent, 'h10', 999);
  assert.equal(recent.length, RECENT_LIMIT);
  assert.equal(recent[0].id, 'h10');
  assert.equal(recent.filter(entry => entry.id === 'h10').length, 1);
  assert.deepEqual(normalizeRecent([{id:'a', viewedAt:1}, {id:'a', viewedAt:2}, null]), [{id:'a', viewedAt:1}]);
});

test('labels for counts and viewed dates follow the language', () => {
  const now = new Date(2026, 9, 8, 12).getTime();
  assert.equal(viewedLabel(now, now, 'pt-BR'), 'Hoje');
  assert.equal(viewedLabel(new Date(2026, 9, 7, 23).getTime(), now, 'pt-BR'), 'Ontem');
  assert.equal(viewedLabel(new Date(2026, 9, 4).getTime(), now), 'Hace 4 días');
  assert.equal(savedCountLabel(3, 'pt-BR'), '3 itens salvos');
  assert.equal(savedCountLabel(1), '1 inmueble guardado');
});

test('favorites routes carry only a folder id, never listing ids', () => {
  const search = normalizeSearch(DEFAULT_SEARCH);
  assert.equal(readJourney(journeyUrl({page:'favorites', search})).page, 'favorites');
  const url = journeyUrl({page:'compare', search, listId:'list-abc-12'});
  assert.match(url, /list=list-abc-12/);
  assert.equal(readJourney(url).listId, 'list-abc-12');
  assert.equal(readJourney(journeyUrl({page:'compare', search, listId:'recent'})).listId, 'recent');
  assert.equal(readJourney('/?view=compare&list=buy-148816386').listId, undefined);
  assert.equal(isFolderId('buy-148816386'), false);
  assert.equal(journeyUrl({page:'favorites', search, listId:'list-abc'}).includes('list='), false);
});

test('a folder page and an invite carry only a folder id, a token and an opaque sender', () => {
  const search = normalizeSearch(DEFAULT_SEARCH);
  const invite = 'AbCdEfGhIjKlMnOpQrStUv';
  const folder = readJourney(journeyUrl({page:'folder', search, listId:'list-abc-12'}));
  assert.equal(folder.page, 'folder');
  assert.equal(folder.listId, 'list-abc-12');
  assert.equal(readJourney('/?view=folder&list=recent').page, 'favorites');
  const guest = readJourney(journeyUrl({page:'folder', search, invite, from:'acct-alex1'}));
  assert.deepEqual([guest.page, guest.invite, guest.from], ['folder', invite, 'acct-alex1']);
  const listing = journeyUrl({page:'listing', search, propertyId:'buy-1', invite, from:'acct-alex1'});
  assert.equal(readJourney(listing).invite, invite);
  assert.doesNotMatch(listing, /Alex|@/);
  assert.equal(readJourney('/?view=listing&property=gone&invite=AbCdEfGhIjKlMnOpQrStUv').page, 'listing');
  assert.equal(readJourney('/?view=listing&property=gone').page, 'results');
  assert.equal(readJourney('/?view=folder&invite=short').page, 'favorites');
  assert.equal(readJourney('/?view=results&invite=AbCdEfGhIjKlMnOpQrStUv&de=acct-alex1').invite, undefined);
});

test('a listing compared with some favorites travels in the URL as a one-off list', () => {
  const search = normalizeSearch(DEFAULT_SEARCH);
  const id = pickId(['buy-1', 'fav-torres-adalid', 'buy-1']);
  assert.equal(id, 'pick:buy-1,fav-torres-adalid');
  assert.deepEqual(pickIds(readJourney(journeyUrl({page:'compare', search, listId:id})).listId), ['buy-1', 'fav-torres-adalid']);
  assert.equal(pickIds('pick:buy-1'), null);
  assert.equal(isFolderId('pick:<script>,x'), false);
});
