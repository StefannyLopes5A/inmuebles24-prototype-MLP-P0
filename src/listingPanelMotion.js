export const SPRING_MORPH = {type:'spring', stiffness:380, damping:38, mass:1};
export const SPRING_SETTLE = {type:'spring', stiffness:260, damping:18, mass:1};
export const SPRING_SHEET = {type:'spring', duration:0.5, bounce:0.2};
export const EASE_FADE = [0.2, 0.8, 0.2, 1];
export const CONTENT_DELAY = 180;
export const CONTENT_OUT = 140;
export const FOCUS_DELAY = 500;
export const SPRING_SIZE = {type:'spring', stiffness:320, damping:34, mass:1};
export const MORA_WORK = 3000;
export const MORA_LINE_SWAP = {duration:0.28, ease:[0.2, 0.8, 0.2, 1]};
export const CARD_RADIUS = 16;
export const SHEET_BREAKPOINT = 768;
export const SIDE_BY_SIDE_MIN = 880;
export const PANEL_EDGE = 24;
export const SHEET_DETENTS = [0.6, 0.92];
export const DISMISS_VELOCITY = 0.11;

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches;
const lerp = (a, b, t) => a + (b - a) * t;

export function relativeRect(rect, base) {
  return {left:rect.left - base.left, top:rect.top - base.top, width:rect.width, height:rect.height};
}

export function lerpRect(a, b, t) {
  return {left:lerp(a.left, b.left, t), top:lerp(a.top, b.top, t), width:lerp(a.width, b.width, t), height:lerp(a.height, b.height, t)};
}

export function unionRect(a, b) {
  const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
  return {left, top, width:Math.max(a.left + a.width, b.left + b.width) - left, height:Math.max(a.top + a.height, b.top + b.height) - top};
}

export const lerpCorners = (a, b, t) => a.map((value, i) => lerp(value, b[i], t));
export const cornerCss = corners => corners.map(value => `${value.toFixed(2)}px`).join(' ');

/** The clip that shows `rect` inside a stage box, both relative to the same origin. */
export function insetWithin(rect, stage, corners) {
  const top = rect.top - stage.top, left = rect.left - stage.left;
  const right = stage.width - left - rect.width, bottom = stage.height - top - rect.height;
  return `inset(${top.toFixed(2)}px ${right.toFixed(2)}px ${bottom.toFixed(2)}px ${left.toFixed(2)}px round ${cornerCss(corners)})`;
}

export function readCorners(el) {
  const style = getComputedStyle(el);
  return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(key => parseFloat(style[key]) || 0);
}

export function contentBox(el) {
  const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
  const left = parseFloat(style.paddingLeft) || 0, right = parseFloat(style.paddingRight) || 0;
  return {left:rect.left + left, top:rect.top, width:rect.width - left - right, height:rect.height};
}

/** Top limit for the panel: it always opens below the header and the search bar, as they stand when it opens. */
export function safeTop() {
  const bar = document.querySelector('.mora-bar');
  const header = document.querySelector('.home-header');
  const headerHeight = header && !header.classList.contains('is-header-hidden') ? header.offsetHeight : 0;
  if (!bar) return Math.max(PANEL_EDGE, Math.round(headerHeight + 16));
  const stuck = parseFloat(getComputedStyle(bar).top);
  return Math.round((Number.isFinite(stuck) ? stuck : headerHeight) + bar.offsetHeight + 16);
}

/** Inline panel on the clicked card's row at the results width, or a bottom sheet below 768 px. `reach` stretches it to a right edge, such as the half map's. */
export function panelPlacement({card, container, reach}) {
  const width = innerWidth, height = innerHeight;
  if (width < SHEET_BREAKPOINT) return {mode:'sheet', compact:height * SHEET_DETENTS[0] < 620};
  const top = safeTop();
  const loose = Math.min(1040, width - 48);
  const measured = container?.isConnected ? contentBox(container) : null;
  const box = measured?.width ? measured : {left:(width - loose) / 2, width:loose};
  if (measured?.width && reach > box.left + box.width) box.width = reach - box.left;
  const boxWidth = Math.min(box.width, width - 32);
  const stacked = boxWidth < SIDE_BY_SIDE_MIN;
  const available = height - top - 24;
  const ideal = stacked ? Math.min(820, height * 0.86) : 700;
  const panelHeight = Math.round(Math.max(420, Math.min(ideal, available)));
  const cardTop = card ? card.getBoundingClientRect().top : top;
  return {
    mode:'inline',
    top:Math.round(cardTop + scrollY),
    left:Math.round(Math.max(16, box.left) + scrollX),
    width:Math.round(boxWidth),
    height:panelHeight,
    stacked,
    compact:panelHeight < 700,
  };
}

/** Distance to scroll so the whole panel fits in the viewport, with 24 px of air above and below. */
export function scrollDelta(placement) {
  if (placement.mode !== 'inline') return 0;
  const top = placement.top - scrollY, limit = safeTop();
  if (top < limit) return top - limit;
  const overflow = top + placement.height - (innerHeight - 24);
  return overflow > 0 ? Math.min(overflow, top - limit) : 0;
}
