import assert from 'node:assert/strict';
import test from 'node:test';
import {UNLOCK_KEY, passwordMatches, readPrototypeUnlock, writePrototypeUnlock} from '../src/prototypeAccess.js';

test('only the exact prototype password opens the door', () => {
  assert.equal(passwordMatches('CONQUISTARELMUNDO', 'CONQUISTARELMUNDO'), true);
  for (const value of ['', ' ', 'conquistarelmundo', 'CONQUISTARELMUNDO ', 'errada', null]) {
    assert.equal(passwordMatches(value, 'CONQUISTARELMUNDO'), false, String(value));
  }
  assert.equal(passwordMatches('CONQUISTARELMUNDO', ''), false);
});

test('the unlock flag is stored without the password', () => {
  const saved = new Map();
  const storage = {getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value)};
  assert.equal(readPrototypeUnlock(storage), false);
  writePrototypeUnlock(storage);
  assert.equal(saved.get(UNLOCK_KEY), '1');
  assert.equal([...saved.values()].some(value => String(value).includes('CONQUISTARELMUNDO')), false);
  assert.equal(readPrototypeUnlock(storage), true);
  assert.equal(readPrototypeUnlock({getItem() { throw new Error('blocked'); }}), false);
});
