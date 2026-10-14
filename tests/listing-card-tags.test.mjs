import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {listingCardTags, agencyTopService, LISTING_TAG_LIMIT} from '../src/listingCardTags.js';

test('agency top service starts at 4.7', () => {
  assert.equal(agencyTopService(4.6), false);
  assert.equal(agencyTopService(4.7), true);
});

test('listing card tags respect max two slots', () => {
  const home = homes.find(item => item.video) || homes[0];
  const tags = listingCardTags(home, {language:'pt-BR'});
  assert.ok(tags.length <= LISTING_TAG_LIMIT);
});

test('contacted reserves one tag slot', () => {
  const home = homes[0];
  const full = listingCardTags(home, {language:'pt-BR', contacted:false});
  const withContact = listingCardTags(home, {language:'pt-BR', contacted:true});
  assert.ok(withContact.length <= full.length);
});
