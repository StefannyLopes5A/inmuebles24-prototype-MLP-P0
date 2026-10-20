import {cleanFolderName} from './favoriteLists.js';

/**
 * Shared folders live in this browser's localStorage, keyed by folder id, so an invite link (folder id or token,
 * never listing ids) opens in another tab of the same browser. Members carry only a display name; nothing leaves the device.
 */
export const SHARED_KEY = 'inmuebles24-v2-shared-folders';
export const SHARED_LIMIT = 12;
export const NOTE_MAX = 140;
export const REACTIONS = Object.freeze(['like', 'doubt', 'no']);

const FOLDER_ID = /^list-[a-z0-9-]{1,40}$/;
const TOKEN = /^[A-Za-z0-9_-]{22}$/;
const ACCOUNT = /^acct-[a-z0-9]{4,24}$/;
const GUEST = /^guest-[a-z0-9]{4,24}$/;
const NAME_POOL = ['Alex', 'Sofía', 'Diego', 'Mariana', 'Andrés', 'Lucía'];

export const isInviteToken = value => typeof value === 'string' && TOKEN.test(value);
export const isAccountId = value => typeof value === 'string' && ACCOUNT.test(value);
export const isGuestId = value => typeof value === 'string' && GUEST.test(value);

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** 128 random bits, base64url: an invite link cannot be guessed from a folder id. */
export function newInviteToken(bytes = randomBytes(16)) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const shortId = (bytes = randomBytes(8)) => [...bytes].map(byte => (byte % 36).toString(36)).join('');
export const newAccountId = bytes => `acct-${shortId(bytes)}`;
export const newGuestId = bytes => `guest-${shortId(bytes)}`;

/** The prototype persona is Alex; a second account in the same browser gets the next fictitious name. */
export function accountName(taken = []) {
  const used = new Set(taken);
  return NAME_POOL.find(name => !used.has(name)) || NAME_POOL[used.size % NAME_POOL.length];
}

function cleanMembers(raw) {
  const seen = new Set();
  const members = (Array.isArray(raw) ? raw : []).flatMap(member => {
    if (!member || !isAccountId(member.id) || seen.has(member.id)) return [];
    const name = cleanFolderName(member.name).slice(0, 24);
    if (!name) return [];
    seen.add(member.id);
    return [{id:member.id, name, role:member.role === 'owner' ? 'owner' : 'member', joinedAt:Number(member.joinedAt) || 0, ...(member.left ? {left:true} : {})}];
  });
  const owners = members.filter(member => member.role === 'owner' && !member.left);
  if (owners.length === 1) return members;
  // Exactly one active owner: the oldest active member when none is left, the first when several claim it.
  const keep = owners[0] || [...members].filter(member => !member.left).sort((a, b) => a.joinedAt - b.joinedAt)[0];
  return members.map(member => ({...member, role:member === keep ? 'owner' : 'member'}));
}

const isActor = id => isAccountId(id) || isGuestId(id);

function cleanReactions(raw, homeIds) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([homeId, byActor]) => {
    if (!homeIds.has(homeId) || !byActor || typeof byActor !== 'object') return [];
    const entries = Object.entries(byActor).filter(([actor, value]) => isActor(actor) && REACTIONS.includes(value?.kind))
      .map(([actor, value]) => [actor, {kind:value.kind, at:Number(value.at) || 0}]);
    return entries.length ? [[homeId, Object.fromEntries(entries)]] : [];
  }));
}

function cleanNotes(raw, homeIds) {
  if (!raw || typeof raw !== 'object') return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([homeId, byMember]) => {
    if (!homeIds.has(homeId) || !byMember || typeof byMember !== 'object') return [];
    const entries = Object.entries(byMember).flatMap(([member, value]) => {
      const text = cleanNote(value?.text);
      return isAccountId(member) && text ? [[member, {text, at:Number(value.at) || 0}]] : [];
    });
    return entries.length ? [[homeId, Object.fromEntries(entries)]] : [];
  }));
}

const EVENTS = new Set(['join', 'add', 'react']);
/** The latest change, so another tab of the same browser can say who joined, added or reacted. */
function cleanEvent(raw, homeIds) {
  if (!raw || !EVENTS.has(raw.kind) || !isActor(raw.by)) return null;
  const homeId = typeof raw.homeId === 'string' && homeIds.has(raw.homeId) ? raw.homeId : null;
  if (raw.kind !== 'join' && !homeId) return null;
  return {kind:raw.kind, by:raw.by, at:Number(raw.at) || 0, ...(homeId ? {homeId} : {}), ...(raw.kind === 'react' && REACTIONS.includes(raw.reaction) ? {reaction:raw.reaction} : {})};
}

export const cleanNote = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX).trim();

/** localStorage is untrusted: unknown listings, malformed members and stray reactions are dropped. */
export function readSharedFolders(raw, known) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(Object.entries(source).flatMap(([id, folder]) => {
    if (!FOLDER_ID.test(id) || !folder) return [];
    const name = cleanFolderName(folder.name);
    const homeIds = [...new Set((Array.isArray(folder.homeIds) ? folder.homeIds : []).filter(item => typeof item === 'string' && (!known || known.has(item))))];
    const members = cleanMembers(folder.members);
    if (!name || (!homeIds.length && !members.length)) return [];
    const placed = new Set(homeIds);
    const event = cleanEvent(folder.event, placed);
    return [[id, {
      ...(event ? {event} : {}),
      id, name, homeIds, sharedAt:Number(folder.sharedAt) || 0,
      ...(isInviteToken(folder.inviteToken) ? {inviteToken:folder.inviteToken} : {}),
      members, reactions:cleanReactions(folder.reactions, placed), notes:cleanNotes(folder.notes, placed),
      ...(folder.deleted ? {deleted:{at:Number(folder.deleted.at) || 0}} : {}),
    }]];
  }).sort((a, b) => b[1].sharedAt - a[1].sharedAt).slice(0, SHARED_LIMIT));
}

export const activeMembers = record => (record?.members || []).filter(member => !member.left);
export const memberOf = (record, id) => (record?.members || []).find(member => member.id === id && !member.left) || null;
export const ownerOf = record => activeMembers(record).find(member => member.role === 'owner') || null;
/** Collaborative once someone besides the owner is in. */
export const isCollaborative = record => !!record && !record.deleted && activeMembers(record).length > 1;
export const findByToken = (shared, token) => isInviteToken(token)
  ? Object.values(shared || {}).find(record => record.inviteToken === token && !record.deleted) || null : null;

const OWNER_ONLY = new Set(['rename', 'removeMember', 'revoke', 'delete']);
const EVERYONE = new Set(['add', 'remove', 'react', 'note', 'invite']);

/** Section 8.6: members add, react, note and invite; only the owner renames, removes members, revokes or deletes. */
export function can(record, id, action) {
  const member = memberOf(record, id);
  if (!member || record.deleted) return false;
  if (EVERYONE.has(action)) return true;
  if (OWNER_ONLY.has(action)) return member.role === 'owner';
  if (action === 'leave') return member.role !== 'owner';
  return false;
}

/** Creates the shared copy on first invite; later calls refresh name and listings and keep members. */
export function shareFolder(shared, folder, now = Date.now(), owner = null, token = newInviteToken) {
  if (!folder || !FOLDER_ID.test(folder.id)) return shared;
  const current = shared[folder.id];
  const base = current && !current.deleted ? current : {members:[], reactions:{}, notes:{}};
  let members = base.members;
  if (owner && isAccountId(owner.id) && !memberOf(base, owner.id)) {
    members = [...members.filter(member => member.id !== owner.id), {id:owner.id, name:owner.name, role:activeMembers(base).length ? 'member' : 'owner', joinedAt:now}];
  }
  const record = {...base, name:folder.name, homeIds:folder.homeIds, sharedAt:now, members,
    inviteToken:base.inviteToken || (owner ? token() : undefined)};
  delete record.deleted;
  return readSharedFolders({...shared, [folder.id]:record});
}

/** Local edits reach the shared copy; reactions and notes of listings that left are dropped. */
export function syncShared(record, folder, by = null, now = Date.now()) {
  if (!record || record.deleted || !folder) return record;
  const kept = new Set(folder.homeIds);
  const pick = map => Object.fromEntries(Object.entries(map || {}).filter(([homeId]) => kept.has(homeId)));
  const added = folder.homeIds.find(homeId => !record.homeIds.includes(homeId));
  return {...record, name:folder.name, homeIds:folder.homeIds, reactions:pick(record.reactions), notes:pick(record.notes),
    ...(added && isAccountId(by) ? {event:{kind:'add', by, homeId:added, at:now}} : {})};
}

export function joinFolder(record, account, now = Date.now()) {
  if (!record || record.deleted || !account || !isAccountId(account.id) || memberOf(record, account.id)) return record;
  const rest = record.members.filter(member => member.id !== account.id);
  return {...record, members:[...rest, {id:account.id, name:account.name, role:activeMembers(record).length ? 'member' : 'owner', joinedAt:now}],
    event:{kind:'join', by:account.id, at:now}};
}

/** The oldest active member inherits the folder. */
export function transferOwnership(record, fromId) {
  const heir = activeMembers(record).filter(member => member.id !== fromId).sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!heir) return record;
  return {...record, members:record.members.map(member => member.id === heir.id ? {...member, role:'owner'} : member.id === fromId ? {...member, role:'member'} : member)};
}

/** Leaving keeps the person's reactions and notes; their avatar is shown faded. */
export function leaveFolder(record, id) {
  const member = memberOf(record, id);
  if (!member) return record;
  const handed = member.role === 'owner' ? transferOwnership(record, id) : record;
  return {...handed, members:handed.members.map(item => item.id === id ? {...item, role:'member', left:true} : item)};
}

export function removeMember(record, byId, memberId) {
  if (!can(record, byId, 'removeMember') || byId === memberId) return record;
  return leaveFolder(record, memberId);
}

/** A new token: links already sent stop opening the folder. */
export function revokeInvite(record, byId, token = newInviteToken) {
  if (!can(record, byId, 'revoke')) return record;
  return {...record, inviteToken:token()};
}

/** The latest reaction replaces the previous one; the same reaction again takes it back. */
export function react(record, actorId, homeId, kind, now = Date.now()) {
  if (!record || record.deleted || !isActor(actorId) || !REACTIONS.includes(kind) || !record.homeIds.includes(homeId)) return record;
  if (isAccountId(actorId) && !memberOf(record, actorId)) return record;
  const byActor = {...(record.reactions[homeId] || {})};
  const takenBack = byActor[actorId]?.kind === kind;
  if (takenBack) delete byActor[actorId];
  else byActor[actorId] = {kind, at:now};
  const reactions = {...record.reactions, [homeId]:byActor};
  if (!Object.keys(byActor).length) delete reactions[homeId];
  return {...record, reactions, ...(takenBack ? {} : {event:{kind:'react', by:actorId, homeId, reaction:kind, at:now}})};
}

/** An anonymous guest's reactions become the account's once they sign in and join. */
export function migrateReactions(record, guestId, accountId) {
  if (!record || !isGuestId(guestId) || !isAccountId(accountId)) return record;
  const reactions = Object.fromEntries(Object.entries(record.reactions).map(([homeId, byActor]) => {
    if (!byActor[guestId]) return [homeId, byActor];
    const {[guestId]:moved, ...rest} = byActor;
    const mine = rest[accountId];
    return [homeId, {...rest, [accountId]:!mine || mine.at < moved.at ? moved : mine}];
  }));
  return {...record, reactions};
}

export function setNote(record, memberId, homeId, text, now = Date.now()) {
  if (!can(record, memberId, 'note') || !record.homeIds.includes(homeId)) return record;
  const clean = cleanNote(text);
  const byMember = {...(record.notes[homeId] || {})};
  if (clean) byMember[memberId] = {text:clean, at:now}; else delete byMember[memberId];
  const notes = {...record.notes, [homeId]:byMember};
  if (!Object.keys(byMember).length) delete notes[homeId];
  return {...record, notes};
}

/** Deleting leaves a tombstone so members learn about it and can keep a copy. */
export function deleteShared(shared, folderId, byId, now = Date.now()) {
  const record = shared[folderId];
  if (!can(record, byId, 'delete')) return shared;
  return {...shared, [folderId]:{...record, inviteToken:undefined, deleted:{at:now}}};
}

export function reactionsFor(record, homeId) {
  const byActor = record?.reactions?.[homeId] || {};
  return Object.entries(byActor).map(([actor, value]) => {
    const member = (record.members || []).find(item => item.id === actor);
    return {actor, kind:value.kind, at:value.at, name:member?.name || null, left:!!member?.left};
  }).sort((a, b) => a.at - b.at);
}

/** A change made by someone else since `previous`, worth a toast in this tab. */
export function newEvent(previous, next, me) {
  const event = next?.event;
  if (!event || event.by === me || (previous?.event && previous.event.at >= event.at)) return null;
  const member = (next.members || []).find(item => item.id === event.by);
  return {...event, name:member?.name || null};
}

export function notesFor(record, homeId) {
  const byMember = record?.notes?.[homeId] || {};
  return Object.entries(byMember).map(([member, value]) => {
    const found = (record.members || []).find(item => item.id === member);
    return {member, text:value.text, at:value.at, name:found?.name || null, left:!!found?.left};
  }).sort((a, b) => a.at - b.at);
}
