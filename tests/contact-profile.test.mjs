import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTACT_PROFILE_KEY, readContactProfile, writeContactProfile} from '../src/contactProfile.js';

const empty = {name:'', email:'', phone:''};
function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {getItem:key => values.get(key) ?? null, setItem:(key,value) => values.set(key,value)};
}

test('a new session reads the reusable identity saved by an earlier contact', () => {
  const storage = memoryStore();
  assert.equal(writeContactProfile({name:' Ana ',email:' ana@example.com ',phone:''}, storage), true);
  assert.deepEqual(readContactProfile(undefined, storage), {name:'Ana',email:'ana@example.com',phone:''});
  writeContactProfile({name:'Ana',email:'ana.nova@example.com',phone:'+52 55 1234 5678'}, storage);
  assert.equal(readContactProfile(undefined, storage).email, 'ana.nova@example.com');
});

test('the previous V2 session profile is a fallback and persistent identity takes precedence', () => {
  const legacy = {name:'Ana',email:'ana@example.com',phone:''};
  const storage = memoryStore();
  assert.deepEqual(readContactProfile(legacy, storage), legacy);
  writeContactProfile({name:'Bia',email:'bia@example.com',phone:''}, storage);
  assert.equal(readContactProfile(legacy, storage).name, 'Bia');
});

test('only reusable identity is persisted, without property-specific contact content', () => {
  const storage = memoryStore();
  writeContactProfile({name:'Ana',email:'ana@example.com',propertyId:'rent-1',message:'Private draft',receipts:[1]}, storage);
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(CONTACT_PROFILE_KEY))), ['name','email','phone']);
});

test('corrupt, unavailable and wrongly typed storage keep the contact flow usable', () => {
  const storage = memoryStore({[CONTACT_PROFILE_KEY]:'{broken'});
  assert.deepEqual(readContactProfile(undefined, storage), empty);
  storage.setItem(CONTACT_PROFILE_KEY, '[1,2]');
  assert.deepEqual(readContactProfile(undefined, storage), empty);
  storage.setItem(CONTACT_PROFILE_KEY, '{"name":{"unexpected":true},"email":1,"phone":null}');
  assert.deepEqual(readContactProfile(undefined, storage), empty);
  const blocked = {getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.deepEqual(readContactProfile({name:'Ana'}, blocked), {...empty,name:'Ana'});
  assert.equal(writeContactProfile({name:'Ana'}, blocked), false);
});
