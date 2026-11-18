import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {advertiserFor, advertiserReviews} from '../src/listingAdvertiser.js';
import {listingDetails} from '../src/listingPresentation.js';
import {categorizePhotos, listingFacts, listingGallery, listingStory, seededShuffle, similarListings} from '../src/listingStory.js';

const rent = homes.find(home => home.mode === 'rent');
const buy = homes.find(home => home.mode === 'buy' && home.photoSetId);

test('the invented story is stable per listing and keeps catalog facts', () => {
  const a = listingStory(rent), b = listingStory(rent);
  assert.deepEqual(a.facts, b.facts);
  assert.deepEqual(a.amenities, b.amenities);
  assert.deepEqual(a.description('es-MX'), b.description('es-MX'));
  const paragraph = a.description('es-MX').map(parts => parts.map(part => part.text).join('')).join(' ');
  assert.match(paragraph, new RegExp(String(a.facts.size)));
  assert.match(paragraph, new RegExp(String(a.facts.beds)));
  assert.ok(a.description('es-MX').flat().some(part => part.strong && part.text.includes(String(a.facts.size))));
  assert.equal(a.facts.beds, rent.beds);
  assert.equal(a.facts.size, rent.size);
  for (const home of homes) {
    const facts = listingFacts(home);
    if (home.beds != null) assert.equal(facts.beds, home.beds);
    assert.ok(facts.size >= 20, `${home.id} keeps a usable size`);
  }
});

test('the gallery partitions every photo once and keeps the published photo first', () => {
  for (const home of [rent, buy]) {
    const gallery = listingGallery(home);
    assert.equal(gallery.photos[0].src, listingDetails(home).gallery[0]);
    assert.equal(gallery.photos[0].borrowed, false);
    assert.equal(gallery.categories[0].id, 'general');
    const seen = gallery.categories.flatMap(category => category.photos.map(photo => photo.index)).sort((x, y) => x - y);
    assert.deepEqual(seen, gallery.photos.map(photo => photo.index));
  }
  assert.ok(listingGallery(rent).photos.length > 1, 'single-photo rentals borrow a set');
  assert.ok(listingGallery(buy).photos.every(photo => !photo.borrowed));
});

test('photo anchors claim their room and the next photo', () => {
  assert.deepEqual(categorizePhotos(6, [{kind:'cocina', photo:4}]), ['general', 'living', 'living', 'kitchen', 'kitchen', 'living']);
  assert.deepEqual(categorizePhotos(0), []);
});

test('similar listings share the operation, skip the open one and draw a stable order', () => {
  const list = similarListings(rent);
  assert.ok(list.length > 0 && list.length <= 10);
  assert.ok(list.every(home => home.mode === 'rent' && home.id !== rent.id));
  assert.deepEqual(list.map(home => home.id), similarListings(rent).map(home => home.id));
  assert.deepEqual(seededShuffle([1, 2, 3, 4], 'x'), seededShuffle([1, 2, 3, 4], 'x'));
});

test('the panel keeps its three reviews; the listing page extends the same list to twelve', () => {
  const advertiser = advertiserFor(rent);
  const three = advertiserReviews(advertiser, 'rent');
  const six = advertiserReviews(advertiser, 'rent', 6);
  const twelve = advertiserReviews(advertiser, 'rent', 12);
  assert.equal(three.length, 3);
  assert.equal(six.length, 6);
  assert.equal(twelve.length, 12);
  assert.deepEqual(six.slice(0, 3), three);
  assert.deepEqual(twelve.slice(0, 6), six);
  assert.equal(new Set(twelve.map(review => review.text[1])).size, 12);
  assert.equal(new Set(twelve.map(review => review.name)).size, 12);
  assert.equal(new Set(twelve.map(review => review.color)).size, 12);
});
