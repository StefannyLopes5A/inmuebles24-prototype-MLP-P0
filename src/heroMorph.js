import {flushSync} from 'react-dom';

const NAME = 'listing-hero';
const POP_TIMEOUT = 800;
let pendingPop = null;

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
  const transition = document.startViewTransition(async () => {
    source.style.viewTransitionName = '';
    root.dataset[flag] = direction;
    await update();
    target = findTarget();
    if (target) target.style.viewTransitionName = name;
  });
  transition.finished.finally(() => {
    if (target) target.style.viewTransitionName = '';
    delete root.dataset[flag];
  });
}

/** Grows `source` into the listing cover while `update` swaps the route. */
export function morphToListing(source, update) {
  run(source, () => {
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
