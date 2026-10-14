import {POI_CATEGORIES,poiIconUrl} from './poiCategories';

export const POI_SOURCE = 'poi';
export const POI_NEAR_SOURCE = 'poi-near';
export const POI_LAYERS = ['poi-dot', 'poi-point', 'poi-point-key'];
/** Below this zoom each POI is a small dot in its category color; from it on, the full pin with the Maki glyph. */
export const POI_FULL_ZOOM = 15.5;
const EMPTY = {type:'FeatureCollection', features:[]};
const OPACITY = {'poi-dot':['circle-opacity','circle-stroke-opacity'], 'poi-point':['icon-opacity'], 'poi-point-key':['icon-opacity']};
const BY_ZOOM = ['>=', ['zoom'], ['get','minzoom']];
const KEY = ['<=', ['get','rank'], 1];
const PIN_IMAGE = ['concat', 'poi-', ['get','categoria']];
const PIN = 28, BORDER = 2, GLYPH = 14, PAD = 4, RATIO = 2;
const CATEGORY_COLOR = ['match', ['get','categoria'], ...POI_CATEGORIES.flatMap(category => [category.id, category.color]), '#1C1C1E'];

let images = null;

function loadGlyph(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

/** Same pin as `.map-poi` in search-map.css: category fill, 2 px white ring, Maki glyph in the category ink. */
async function drawPin(category) {
  const size = (PIN + PAD * 2) * RATIO, mid = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.shadowColor = 'rgba(0,0,0,.24)'; ctx.shadowBlur = 4 * RATIO; ctx.shadowOffsetY = RATIO;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mid, mid, PIN / 2 * RATIO, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = category.color; ctx.beginPath(); ctx.arc(mid, mid, (PIN / 2 - BORDER) * RATIO, 0, Math.PI * 2); ctx.fill();
  const glyph = await loadGlyph(poiIconUrl(category.id));
  const g = GLYPH * RATIO, tint = document.createElement('canvas');
  tint.width = tint.height = g;
  const tctx = tint.getContext('2d');
  tctx.drawImage(glyph, 0, 0, g, g);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = category.ink; tctx.fillRect(0, 0, g, g);
  ctx.drawImage(tint, mid - g / 2, mid - g / 2);
  return ctx.getImageData(0, 0, size, size);
}

export function pinImages() {
  if (!images) images = Promise.all(POI_CATEGORIES.map(async category => [category.id, await drawPin(category)])).then(Object.fromEntries);
  return images;
}

/** The same pins as data URLs, for DOM stand-ins that can scale while the symbol layer cannot. */
export async function pinUrls() {
  const list = await pinImages();
  return Object.fromEntries(Object.entries(list).map(([id, data]) => {
    const canvas = document.createElement('canvas');
    canvas.width = data.width; canvas.height = data.height;
    canvas.getContext('2d').putImageData(data, 0, 0);
    return [id, canvas.toDataURL()];
  }));
}
export const PIN_BOX = PIN + PAD * 2;

export function ensurePoiLayers(map) {
  if (!map || map.getSource(POI_SOURCE)) return;
  map.addSource(POI_SOURCE, {type:'geojson', data:EMPTY});
  map.addSource(POI_NEAR_SOURCE, {type:'geojson', data:EMPTY});
  map.addLayer({id:'poi-dot', type:'circle', source:POI_SOURCE, maxzoom:POI_FULL_ZOOM, filter:BY_ZOOM, paint:{
    'circle-color':CATEGORY_COLOR,
    'circle-radius':['interpolate', ['linear'], ['zoom'], 12, 2.5, POI_FULL_ZOOM, 4],
    'circle-stroke-width':1, 'circle-stroke-color':'#fff',
    'circle-opacity':0, 'circle-stroke-opacity':0,
  }});
  // Leisure and shops give way to each other when they collide; metro and schools never hide.
  map.addLayer({id:'poi-point', type:'symbol', source:POI_SOURCE, minzoom:POI_FULL_ZOOM, filter:['all', BY_ZOOM, ['!', KEY]], layout:{
    'icon-image':PIN_IMAGE, 'symbol-sort-key':['get','rank'], 'icon-padding':1,
  }, paint:{'icon-opacity':0}});
  map.addLayer({id:'poi-point-key', type:'symbol', source:POI_SOURCE, minzoom:POI_FULL_ZOOM, filter:KEY, layout:{
    'icon-image':PIN_IMAGE, 'icon-allow-overlap':true,
  }, paint:{'icon-opacity':0}});
  map.addLayer({id:'poi-near', type:'symbol', source:POI_NEAR_SOURCE, layout:{
    'icon-image':PIN_IMAGE, 'symbol-sort-key':['+', ['*', ['get','rank'], 1000], ['get','meters']], 'icon-padding':1,
  }, paint:{'icon-opacity':0}});
  pinImages().then(list => {
    if (!map.getSource(POI_SOURCE)) return;
    for (const [id, data] of Object.entries(list)) if (!map.hasImage(`poi-${id}`)) map.addImage(`poi-${id}`, data, {pixelRatio:RATIO});
  }).catch(() => {});
}

export function setPoiOpacity(map, value, duration) {
  for (const [layer, props] of Object.entries(OPACITY)) {
    if (!map?.getLayer(layer)) continue;
    for (const prop of props) {
      map.setPaintProperty(layer, `${prop}-transition`, {duration, delay:0});
      map.setPaintProperty(layer, prop, value);
    }
  }
}

export function setPoiVisible(map, visible) {
  for (const layer of [...POI_LAYERS, 'poi-near']) if (map?.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
}

/**
 * Points around a selected home appear as a wave leaving the home: each pin fades in over its last
 * 80 m as the radius grows to `radius`. Paint-only, so the symbols are never re-laid out mid-wave.
 */
export function revealNear(map, collection, radius, {reduce = false} = {}) {
  const source = map?.getSource(POI_NEAR_SOURCE);
  if (!source) return () => {};
  source.setData(collection);
  map.setPaintProperty('poi-near', 'icon-opacity-transition', {duration:reduce ? 150 : 0, delay:0});
  if (reduce) {
    map.setPaintProperty('poi-near', 'icon-opacity', 0);
    const frame = requestAnimationFrame(() => map.setPaintProperty('poi-near', 'icon-opacity', 1));
    return () => cancelAnimationFrame(frame);
  }
  const duration = 420, start = performance.now();
  let frame;
  const step = now => {
    const t = Math.min(1, (now - start) / duration);
    const reach = (radius + 80) * (1 - Math.pow(1 - t, 3));
    map.setPaintProperty('poi-near', 'icon-opacity', t < 1
      ? ['interpolate', ['linear'], ['-', reach, ['get','meters']], 0, 0, 80, 1]
      : 1);
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

export function hideNear(map) {
  if (!map?.getLayer('poi-near')) return () => {};
  map.setPaintProperty('poi-near', 'icon-opacity-transition', {duration:150, delay:0});
  map.setPaintProperty('poi-near', 'icon-opacity', 0);
  const timer = setTimeout(() => map.getSource(POI_NEAR_SOURCE)?.setData(EMPTY), 160);
  return () => clearTimeout(timer);
}

/** Swap the points and fade the layer back in once the source has loaded them. Returns a cancel function. */
export function setPoiData(map, collection, target) {
  const source = map?.getSource(POI_SOURCE);
  if (!source) return () => {};
  setPoiOpacity(map, 0, 0);
  source.setData(collection);
  let done = false, timer;
  const fadeIn = () => {
    if (done) return;
    done = true;
    map.off('sourcedata', onData);
    clearTimeout(timer);
    setPoiOpacity(map, target(), 180);
  };
  const onData = event => {if (event.sourceId === POI_SOURCE && map.isSourceLoaded(POI_SOURCE)) fadeIn();};
  map.on('sourcedata', onData);
  timer = setTimeout(fadeIn, 400);
  return () => {done = true;map.off('sourcedata', onData);clearTimeout(timer);};
}
