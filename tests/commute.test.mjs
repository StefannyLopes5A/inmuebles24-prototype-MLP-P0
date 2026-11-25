import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSearch, matchingHomes, alertKey, journeyUrl, readJourney} from '../src/journey.js';
import {searchPoiLocations, suggestedPoiLocations, isPoiPlace} from '../src/locationSearch.js';
import {commuteMinutes, normalizeCommute} from '../src/commute.js';

const poi = suggestedPoiLocations(8)[0];
const base = {mode:'buy', budget:1_000_000_000, beds:1};

test('the point-of-interest search lists mapped points only', () => {
  assert.ok(poi && isPoiPlace(poi));
  for (const place of [...suggestedPoiLocations(8), ...searchPoiLocations('polanco', 20)]) assert.ok(isPoiPlace(place), place.kind);
});

test('an invalid commute is dropped and a valid one gets defaults', () => {
  assert.equal(normalizeCommute({poi:{kind:'colonia', id:'Polanco'}, mode:'walk', minutes:15}), undefined);
  assert.equal(normalizeCommute({poi:{kind:poi.kind, id:'nope'}}), undefined);
  const commute = normalizeCommute({poi:{kind:poi.kind, id:poi.id}, mode:'jetpack', minutes:7});
  assert.deepEqual([commute.mode, commute.minutes], ['walk', 15]);
});

test('the commute narrows results by estimated straight-line time and faster modes reach more', () => {
  const all = matchingHomes(normalizeSearch(base));
  const at = (mode, minutes) => matchingHomes(normalizeSearch({...base, commute:{poi:{kind:poi.kind, id:poi.id}, mode, minutes}}));
  const walk = at('walk', 15), drive = at('drive', 60);
  assert.ok(walk.length <= drive.length && drive.length <= all.length);
  for (const home of walk) assert.ok(commuteMinutes(home, poi, 'walk') <= 15);
});

test('the commute travels in the URL and in the saved-search key', () => {
  const search = normalizeSearch({...base, commute:{poi:{kind:poi.kind, id:poi.id}, mode:'transit', minutes:30}});
  const url = journeyUrl({page:'results', search});
  const back = readJourney(url).search;
  assert.deepEqual([back.commute.poi.key, back.commute.mode, back.commute.minutes], [poi.key, 'transit', 30]);
  assert.notEqual(alertKey(search), alertKey(normalizeSearch(base)));
});
