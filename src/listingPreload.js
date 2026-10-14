import {useEffect, useRef} from 'react';
import {listingDetails} from './listingPresentation.js';

const warm = new Set();

/** Hover or focus intent: fetch the first photos and keep Mora's reading ready for this listing. */
export function warmListing(home) {
  if (!home || warm.has(home.id)) return;
  warm.add(home.id);
  if (typeof Image === 'undefined') return;
  for (const src of listingDetails(home).gallery.slice(0, 2)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
  }
}

export const isWarm = id => warm.has(id);

export function useHoverIntent(home, delay = 120) {
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    onPointerEnter: event => {
      if (event.pointerType === 'touch') return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => warmListing(home), delay);
    },
    onPointerLeave: () => clearTimeout(timer.current),
    onFocus: () => warmListing(home),
  };
}
