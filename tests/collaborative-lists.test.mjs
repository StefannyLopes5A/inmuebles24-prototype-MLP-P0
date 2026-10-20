import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountName, activeMembers, can, deleteShared, findByToken, isCollaborative, isInviteToken, joinFolder, leaveFolder,
  migrateReactions, newEvent, newInviteToken, notesFor, ownerOf, react, reactionsFor, readSharedFolders, removeMember, revokeInvite,
  setNote, shareFolder, syncShared, transferOwnership, NOTE_MAX,
} from '../src/collaborativeLists.js';
import {mergeSharedHomes, removeHome, saveToFolder} from '../src/favoriteLists.js';

const alex = {id:'acct-alex1', name:'Alex'};
const sofia = {id:'acct-sofia1', name:'Sofía'};
const diego = {id:'acct-diego1', name:'Diego'};
const folder = {id:'list-casa', name:'Casa', homeIds:['h1', 'h2']};
let tick = 0;
const token = () => newInviteToken(Uint8Array.from({length:16}, (_, i) => (i * 7 + tick++) % 256));

function sharedWith(...people) {
  let shared = shareFolder({}, folder, 1, alex, token);
  let record = shared[folder.id];
  people.forEach((person, index) => {record = joinFolder(record, person, 10 + index);});
  return record;
}

test('the invite token is 128 random bits in base64url and only a valid, live token finds the folder', () => {
  const value = newInviteToken();
  assert.ok(isInviteToken(value));
  assert.notEqual(newInviteToken(), value);
  assert.equal(isInviteToken('list-casa'), false);
  const shared = shareFolder({}, folder, 1, alex, token);
  const record = shared[folder.id];
  assert.equal(findByToken(shared, record.inviteToken).id, folder.id);
  assert.equal(findByToken(shared, 'x'.repeat(22)), null);
  const revoked = revokeInvite(record, alex.id, token);
  assert.notEqual(revoked.inviteToken, record.inviteToken);
  assert.equal(findByToken({[folder.id]:revoked}, record.inviteToken), null);
});

test('sharing makes the person the owner; a folder becomes collaborative once someone joins', () => {
  const owned = sharedWith();
  assert.equal(ownerOf(owned).id, alex.id);
  assert.equal(isCollaborative(owned), false);
  const together = joinFolder(owned, sofia, 5);
  assert.equal(isCollaborative(together), true);
  assert.equal(joinFolder(together, sofia, 6), together);
  assert.deepEqual(activeMembers(together).map(member => member.role), ['owner', 'member']);
});

test('permissions follow section 8.6', () => {
  const record = sharedWith(sofia);
  for (const action of ['add', 'remove', 'react', 'note', 'invite']) {
    assert.equal(can(record, alex.id, action), true, action);
    assert.equal(can(record, sofia.id, action), true, action);
  }
  for (const action of ['rename', 'removeMember', 'revoke', 'delete']) {
    assert.equal(can(record, alex.id, action), true, action);
    assert.equal(can(record, sofia.id, action), false, action);
  }
  assert.equal(can(record, alex.id, 'leave'), false);
  assert.equal(can(record, sofia.id, 'leave'), true);
  assert.equal(can(record, diego.id, 'react'), false);
  assert.equal(revokeInvite(record, sofia.id, token), record);
  assert.equal(removeMember(record, sofia.id, alex.id), record);
});

test('the latest reaction replaces the previous one and the same reaction takes it back', () => {
  let record = sharedWith(sofia);
  record = react(record, sofia.id, 'h1', 'like', 1);
  record = react(record, sofia.id, 'h1', 'no', 2);
  assert.deepEqual(reactionsFor(record, 'h1').map(item => item.kind), ['no']);
  record = react(record, sofia.id, 'h1', 'no', 3);
  assert.deepEqual(reactionsFor(record, 'h1'), []);
  assert.equal(react(record, diego.id, 'h1', 'like'), record);
  assert.equal(react(record, sofia.id, 'unknown', 'like'), record);
});

test('an anonymous reaction keeps no personal data and moves to the account on sign-in', () => {
  let record = sharedWith();
  record = react(record, 'guest-abc123', 'h2', 'doubt', 4);
  const [anonymous] = reactionsFor(record, 'h2');
  assert.deepEqual(Object.keys(record.reactions.h2['guest-abc123']).sort(), ['at', 'kind']);
  assert.equal(anonymous.name, null);
  record = migrateReactions(joinFolder(record, sofia, 5), 'guest-abc123', sofia.id);
  assert.deepEqual(reactionsFor(record, 'h2').map(item => [item.actor, item.kind, item.name]), [[sofia.id, 'doubt', 'Sofía']]);
});

test('notes are one short line per member per listing', () => {
  let record = sharedWith(sofia);
  record = setNote(record, sofia.id, 'h1', `  Muy luminoso\n${'x'.repeat(200)}`, 1);
  assert.equal(notesFor(record, 'h1')[0].text.length, NOTE_MAX);
  record = setNote(record, sofia.id, 'h1', '   ');
  assert.deepEqual(notesFor(record, 'h1'), []);
  assert.equal(setNote(record, diego.id, 'h1', 'hola'), record);
});

test('leaving keeps reactions and notes; an owner who leaves hands the folder to the oldest member', () => {
  let record = sharedWith(sofia, diego);
  record = react(record, sofia.id, 'h1', 'like', 1);
  record = leaveFolder(record, sofia.id);
  assert.equal(activeMembers(record).length, 2);
  assert.equal(reactionsFor(record, 'h1')[0].left, true);
  assert.equal(transferOwnership(record, alex.id).members.find(member => member.role === 'owner').id, diego.id);
  const handed = leaveFolder(sharedWith(sofia, diego), alex.id);
  assert.equal(ownerOf(handed).id, sofia.id);
  assert.equal(removeMember(handed, sofia.id, diego.id).members.find(member => member.id === diego.id).left, true);
});

test('deleting leaves a tombstone without a live link, and only the owner can delete', () => {
  const record = sharedWith(sofia);
  const shared = {[folder.id]:record};
  assert.equal(deleteShared(shared, folder.id, sofia.id), shared);
  const deleted = readSharedFolders(deleteShared(shared, folder.id, alex.id, 9));
  assert.equal(deleted[folder.id].deleted.at, 9);
  assert.equal(deleted[folder.id].inviteToken, undefined);
  assert.equal(isCollaborative(deleted[folder.id]), false);
  assert.equal(findByToken(deleted, record.inviteToken), null);
});

test('stored shared folders are untrusted', () => {
  const read = readSharedFolders({'list-x':{name:'X', homeIds:['h1', 'zzz'], members:[{id:'acct-a1b2', name:'Alex', role:'member', joinedAt:1}, {id:'bad', name:'No'}],
    reactions:{h1:{'acct-a1b2':{kind:'like'}, 'acct-zz99':{kind:'wow'}}, zzz:{'acct-a1b2':{kind:'like'}}}, inviteToken:'short'}}, new Set(['h1']));
  assert.deepEqual(read['list-x'].homeIds, ['h1']);
  assert.equal(read['list-x'].members.length, 1);
  assert.equal(read['list-x'].members[0].role, 'owner');
  assert.deepEqual(Object.keys(read['list-x'].reactions), ['h1']);
  assert.deepEqual(Object.keys(read['list-x'].reactions.h1), ['acct-a1b2']);
  assert.equal(read['list-x'].inviteToken, undefined);
});

test('local edits reach the shared copy and drop reactions of listings that left', () => {
  const record = react(sharedWith(sofia), sofia.id, 'h2', 'like', 1);
  const synced = syncShared(record, {...folder, name:'Casa nueva', homeIds:['h1']});
  assert.equal(synced.name, 'Casa nueva');
  assert.deepEqual(synced.reactions, {});
});

test('a shared folder survives empty while a private one disappears', () => {
  const folders = [{id:'list-a', name:'A', homeIds:['h1'], collab:true}, {id:'list-b', name:'B', homeIds:['h2']}];
  assert.deepEqual(removeHome(removeHome(folders, 'h1'), 'h2').map(item => item.id), ['list-a']);
  assert.equal(saveToFolder(folders, 'list-a', 'h1').removed, true);
  const merged = mergeSharedHomes(folders, 'list-a', 'A', ['h1', 'h2']);
  assert.deepEqual(merged.map(item => item.id), ['list-a']);
});

test('another tab hears who joined, added or reacted, but not its own changes', () => {
  const before = sharedWith();
  const joined = readSharedFolders({[folder.id]:joinFolder(before, sofia, 20)})[folder.id];
  assert.deepEqual([newEvent(before, joined, alex.id).kind, newEvent(before, joined, alex.id).name], ['join', 'Sofía']);
  assert.equal(newEvent(before, joined, sofia.id), null);
  const added = syncShared(joined, {...folder, homeIds:['h3', 'h1', 'h2']}, sofia.id, 30);
  assert.equal(added.event.kind, 'add');
  const reacted = react(added, 'guest-zz11', 'h1', 'like', 40);
  assert.deepEqual([newEvent(added, reacted, alex.id).reaction, newEvent(added, reacted, alex.id).name], ['like', null]);
  assert.equal(newEvent(reacted, reacted, alex.id), null);
});

test('a second account in the same browser does not reuse the persona name', () => {
  assert.equal(accountName([]), 'Alex');
  assert.equal(accountName(['Alex']), 'Sofía');
});
