export const MAP_EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const running = new WeakMap();

export const mapMorphDuration = (from, to) => (from === 'full' || to === 'full') ? 420 : 360;

export function applyRect(el, rect) {
  Object.assign(el.style, {top:`${rect.top}px`, left:`${rect.left}px`, width:`${rect.width}px`, height:`${rect.height}px`});
}

export function readRect(el) {
  const top = parseFloat(el.style.top), left = parseFloat(el.style.left);
  const width = parseFloat(el.style.width), height = parseFloat(el.style.height);
  if ([top, left, width, height].every(Number.isFinite)) return {top, left, width, height};
  const box = el.getBoundingClientRect();
  return {top:box.top, left:box.left, width:box.width, height:box.height};
}

function union(a, b) {
  const top = Math.min(a.top, b.top), left = Math.min(a.left, b.left);
  const right = Math.max(a.left + a.width, b.left + b.width), bottom = Math.max(a.top + a.height, b.top + b.height);
  return {top, left, width:right - left, height:bottom - top, radius:0};
}

const inset = (rect, stage) => `inset(${rect.top - stage.top}px ${stage.left + stage.width - rect.left - rect.width}px ${stage.top + stage.height - rect.top - rect.height}px ${rect.left - stage.left}px round ${rect.radius}px)`;

/** Visible rect of an interrupted morph, read back from the live clip-path. */
function liveRect(el, state) {
  const match = getComputedStyle(el).clipPath.match(/inset\(([-\d.]+)px(?: ([-\d.]+)px)?(?: ([-\d.]+)px)?(?: ([-\d.]+)px)?(?: round ([-\d.]+)px)?/);
  if (!match) return state.to;
  const [t, r = t, b = t, l = r, radius = state.to.radius] = match.slice(1).map(value => value === undefined ? undefined : Number(value));
  const {stage} = state;
  return {top:stage.top + t, left:stage.left + l, width:stage.width - l - r, height:stage.height - t - b, radius};
}

/**
 * Morph the map between two viewport rects without stretching the canvas:
 * the element covers the union of both rects and a clip-path travels from one to the other.
 * `onStage(stage)` runs before the clip starts and `onSettle(to)` once the final rect is applied.
 */
export function morphMap(el, {from, to, duration, easing = MAP_EASE_IN_OUT, onStage, onSettle}) {
  const previous = running.get(el);
  if (previous) {
    from = liveRect(el, previous);
    previous.cancel();
  }
  if (reduced()) {
    applyRect(el, to); el.style.borderRadius = `${to.radius}px`; el.style.clipPath = '';
    onStage?.(to, from); onSettle?.(to);
    const fade = el.animate([{opacity:0}, {opacity:1}], {duration:150, easing:'ease'});
    return () => fade.cancel();
  }
  const stage = union(from, to);
  applyRect(el, stage); el.style.borderRadius = '0px'; el.style.clipPath = inset(from, stage);
  onStage?.(stage, from);
  const animation = el.animate([{clipPath:inset(from, stage)}, {clipPath:inset(to, stage)}], {duration, easing, fill:'forwards'});
  let done = false;
  const state = {stage, to, cancel:() => {done = true; animation.cancel(); running.delete(el);}};
  running.set(el, state);
  animation.finished.then(() => {
    if (done) return;
    running.delete(el); animation.cancel();
    applyRect(el, to); el.style.borderRadius = `${to.radius}px`; el.style.clipPath = '';
    onSettle?.(to, stage);
  }, () => {});
  return state.cancel;
}

export function isMorphing(el) {
  return running.has(el);
}
