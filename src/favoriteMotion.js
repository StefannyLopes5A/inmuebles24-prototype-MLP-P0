import {useEffect, useState} from 'react';

export const EASE_OUT = [0.23, 1, 0.32, 1];
export const EASE_DRAWER = [0.32, 0.72, 0, 1];
export const EASE = [0.25, 0.1, 0.25, 1];
export const STAGGER = 0.05;
export const MAX_STAGGERED = 8;

export function useMediaQuery(query) {
  const read = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Reduced motion keeps the fade and drops every positional change. */
export function riseIn(reduce, index = 0, distance = 8) {
  const delay = Math.min(index, MAX_STAGGERED) * STAGGER;
  return reduce
    ? {initial:{opacity:0}, animate:{opacity:1}, transition:{duration:0.2, ease:EASE_OUT, delay}}
    : {initial:{opacity:0, transform:`translateY(${distance}px)`}, animate:{opacity:1, transform:'translateY(0px)'}, transition:{duration:0.25, ease:EASE_OUT, delay}};
}
