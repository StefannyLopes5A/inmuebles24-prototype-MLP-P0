import {flushSync} from 'react-dom';

const NAME = 'listing-hero';
const POP_TIMEOUT = 800;
const COVER_TTL = 4000;
let pendingPop = null;
let heroSettle = null;
let pendingCover = null;
let pendingCoverUntil = 0;

export const canMorph = () => typeof document !== 'undefined' && typeof document.startViewTransition === 'function'
  && !matchMedia('(prefers-reduced-motion:reduce)').matches;

export const visible = el => {
  if (!el?.isConnected || !el.getClientRects().length) return false;
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth && rect.width > 0;
};

/** The photo of a card on screen, wherever the card lives (results, rails, similar listings). */
export const cardPhoto = (id, scope = document) => [...scope.querySelectorAll(`[data-home-id="${CSS.escape(String(id))}"] .discovery-media`)].find(visible) || null;

/** The listing page's cover: the mosaic's first tile on desktop, the first strip photo on mobile. */
export const listingCover = () => [...document.querySelectorAll('.recorrido-cover, .pp-mosaic .pp-tile:first-child, .pp-strip-photo:first-child')].find(visible) || null;

function run(source, update, findTarget, direction, name = NAME, flag = 'heroMorph') {
  if (!canMorph() || !visible(source)) { update(); return; }
  const root = document.documentElement;
  let target = null;
  source.style.viewTransitionName = name;
  let finish = null;
  const settled = new Promise(resolve => { finish = resolve; });
  if (name === NAME && direction === 'forward') heroSettle = settled;
  const transition = document.startViewTransition(async () => {
    source.style.viewTransitionName = '';
    root.dataset[flag] = direction;
    await update();
    target = findTarget();
    if (target?.decode) { try { await target.decode(); } catch { /* the snapshot uses whatever has painted */ } }
    if (target) target.style.viewTransitionName = name;
  });
  transition.finished.then(() => finish(), () => finish());
  transition.finished.finally(() => {
    if (target) target.style.viewTransitionName = '';
    delete root.dataset[flag];
    if (heroSettle === settled) heroSettle = null;
  });
}

/** Resolves when the forward cover morph has finished. Immediate when none is running. */
export function whenHeroSettled() {
  return heroSettle || Promise.resolve();
}

/** The picture actually on screen: the playing tour frame, otherwise the current slide. */
function playingVideo(root) {
  const video = root?.querySelector?.('video');
  if (!video?.videoWidth) return null;
  const opacity = Number(getComputedStyle(video).opacity);
  return Number.isFinite(opacity) && opacity >= 0.5 ? video : null;
}

function currentSlide(root) {
  if (root?.tagName === 'IMG') return root;
  const track = root?.querySelector?.('.lp-track');
  if (track) {
    const imgs = [...track.querySelectorAll(':scope > img')];
    const match = /translateX\(([-\d.]+)%\)/.exec(track.style.transform || '');
    const index = match ? Math.round(Math.abs(parseFloat(match[1])) / 100) : 0;
    if (imgs[index]) return imgs[index];
  }
  return root?.querySelector?.('img') || null;
}

function stillOf(el) {
  if (!el) return null;
  if (el.tagName === 'VIDEO') {
    if (el.readyState < 2 || !el.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext('2d').drawImage(el, 0, 0);
    try { return canvas.toDataURL('image/jpeg', 0.92); } catch { return null; }
  }
  return el.currentSrc || el.getAttribute?.('src') || null;
}

function coverFrom(source) {
  const video = playingVideo(source);
  if (video) {
    try { video.pause(); } catch { /* freeze the frame the snapshot will use */ }
    const frame = stillOf(video);
    if (frame) return {picture:video, src:frame};
  }
  const picture = currentSlide(source) || source;
  return {picture, src:stillOf(picture)};
}

/** The bitmap the recorrido cover should wear, armed by the morph that just started. */
export function listingCoverSrc() {
  if (!pendingCover || performance.now() > pendingCoverUntil) return null;
  return pendingCover;
}

function armListingCover(src) {
  pendingCover = src || null;
  pendingCoverUntil = src ? performance.now() + COVER_TTL : 0;
}

/** Grows the visible mini-listing picture into the listing cover while `update` swaps the route. */
export function morphToListing(source, update) {
  const {picture, src} = coverFrom(source);
  armListingCover(src);
  run(picture || source, () => {
    document.querySelector('.lp-shell')?.style.setProperty('visibility', 'hidden');
    flushSync(update);
    window.scrollTo({top:0, behavior:'instant'});
  }, listingCover, 'forward');
}

/** Shrinks the cover back into the card it came from. With `viaHistory`, `go` calls `history.back()` and the popstate handler settles the morph. */
export function morphFromListing(id, go, {viaHistory = false} = {}) {
  const update = viaHistory ? () => new Promise(resolve => {
    const done = () => { clearTimeout(timer); pendingPop = null; resolve(); };
    const timer = setTimeout(done, POP_TIMEOUT);
    pendingPop = done;
    go();
  }) : () => { flushSync(go); };
  run(listingCover(), update, () => cardPhoto(id), 'back');
}

export const morphPending = () => pendingPop !== null;

/** Called by the popstate handler once the previous route is rendered. */
export function settlePop() { pendingPop?.(); }

/** Grows a mosaic photo into the same photo in the gallery index, or back. `update` may return a Promise that resolves once the DOM has settled. */
export function morphGallery(source, update, findTarget, direction) {
  run(source, update, () => { const target = findTarget(); return visible(target) ? target : null; }, direction, 'gallery-photo', 'galleryMorph');
}
