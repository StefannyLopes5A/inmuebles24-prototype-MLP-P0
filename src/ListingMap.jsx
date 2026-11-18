import React, {useEffect, useRef} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {Protocol} from 'pmtiles';
import {buildMapStyle, MAP_BOUNDS} from './mapStyle';
import {POI_CATEGORIES, NEARBY_RADIUS_M, poiCollection, poisNear} from './pois';
import {ensurePoiLayers, PIN_BOX, POI_NEAR_SOURCE, pinUrls, revealNear} from './poiLayers';

let protocolReady = false;
function ensureProtocol() {
  if (protocolReady) return;
  maplibregl.setWorkerUrl(mapWorkerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolReady = true;
}

const APPROX_M = 300;
function circle([lng, lat], meters, steps = 64) {
  const ring = Array.from({length:steps + 1}, (_, i) => {
    const angle = (i / steps) * Math.PI * 2;
    return [lng + meters * Math.cos(angle) / (111320 * Math.cos(lat * Math.PI / 180)), lat + meters * Math.sin(angle) / 111320];
  });
  return {type:'Feature', properties:{}, geometry:{type:'Polygon', coordinates:[ring]}};
}

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
const PIN_AT = 250, WAVE_AT = 520, WAVE_SPREAD = 560, POP = 320;

/**
 * Map first, then the home, then the places as a wave leaving it. Symbols can only fade, so the placed
 * pins get DOM stand-ins that scale in; once the wave lands the symbol layer takes over at the same spot.
 */
function playIntro(map, {host, dot, urls, stand}) {
  host?.classList.add('is-ready');
  dot.animate([
    {opacity:0, transform:'scale(.6)'},
    {opacity:1, transform:'scale(1.06)', offset:.6},
    {opacity:1, transform:'scale(1)'},
  ], {duration:420, delay:PIN_AT, easing:EASE_OUT, fill:'both'});
  const seen = new Set();
  const placed = map.queryRenderedFeatures({layers:['poi-near']}).filter(feature => {
    const key = `${feature.properties.name}:${feature.geometry.coordinates.join()}`;
    return !seen.has(key) && seen.add(key);
  });
  const far = Math.max(1, ...placed.map(feature => feature.properties.meters));
  const pops = placed.map(feature => {
    const el = document.createElement('div');
    el.className = 'pp-map-pop';
    const img = document.createElement('img');
    img.src = urls[feature.properties.categoria]; img.alt = ''; img.width = img.height = PIN_BOX;
    el.append(img);
    stand.push(new maplibregl.Marker({element:el, anchor:'center'}).setLngLat(feature.geometry.coordinates).addTo(map));
    return img.animate([{opacity:0, transform:'scale(.5)'}, {opacity:1, transform:'scale(1)'}],
      {duration:POP, delay:WAVE_AT + (feature.properties.meters / far) * WAVE_SPREAD, easing:EASE_OUT, fill:'both'}).finished;
  });
  let live = true;
  Promise.all(pops).then(() => {
    if (!live || !map.getLayer('poi-near')) return;
    map.setPaintProperty('poi-near', 'icon-opacity-transition', {duration:0, delay:0});
    map.setPaintProperty('poi-near', 'icon-opacity', 1);
    map.once('render', () => requestAnimationFrame(() => { stand.forEach(marker => marker.remove()); stand.length = 0; }));
  }).catch(() => {});
  return () => { live = false; };
}

/** Embedded map for the listing page: the approximate position, a soft area around it and the real places within 500 m. `preview` is the small still thumbnail in the intro. */
export default function ListingMap({center, language, say, preview = false}) {
  const host = useRef(null), mapRef = useRef(null), tip = useRef(null), tipMarker = useRef(null);

  useEffect(() => {
    ensureProtocol();
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const map = new maplibregl.Map({
      container:host.current, style:buildMapStyle({lang:language}), center, zoom:preview ? 13.4 : 15.4,
      minZoom:12, maxZoom:17, maxBounds:MAP_BOUNDS, interactive:!preview,
      attributionControl:false, dragRotate:false, pitchWithRotate:false, touchPitch:false, renderWorldCopies:false,
    });
    if (!preview) {
      map.scrollZoom.disable();
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.AttributionControl({compact:true}), 'bottom-left');
    }
    const home = document.createElement('div');
    home.className = 'pp-map-home';
    home.innerHTML = '<span class="pp-map-home-dot"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.3 2.6a1 1 0 0 1 1.4 0l8.6 7.7a1 1 0 0 1 .3.7V20a1.5 1.5 0 0 1-1.5 1.5H15v-6.2a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v6.2H4.4A1.5 1.5 0 0 1 2.9 20v-9a1 1 0 0 1 .3-.7Z"/></svg></span>';
    const dot = home.firstChild;
    dot.style.opacity = preview ? '1' : '0';
    new maplibregl.Marker({element:home, anchor:'center'}).setLngLat(center).addTo(map);
    if (!preview) {
      tip.current = document.createElement('div');
      tip.current.className = 'pp-map-tip';
      tip.current.setAttribute('aria-live', 'polite');
      tipMarker.current = new maplibregl.Marker({element:tip.current, anchor:'bottom', offset:[0, -18]});
    }
    let cancelled = false, cancel = () => {};
    const stand = [];
    if (preview) {
      map.on('load', () => host.current?.classList.add('is-ready'));
      mapRef.current = map;
      return () => { cancelled = true; map.remove(); mapRef.current = null; };
    }
    map.on('load', async () => {
      map.addSource('approx', {type:'geojson', data:circle(center, APPROX_M)});
      map.addLayer({id:'approx-fill', type:'fill', source:'approx', paint:{'fill-color':'#222222', 'fill-opacity':0.06}});
      map.addLayer({id:'approx-line', type:'line', source:'approx', paint:{'line-color':'#222222', 'line-opacity':0.24, 'line-width':1.5}});
      ensurePoiLayers(map);
      const near = poiCollection(poisNear(center, POI_CATEGORIES.map(category => category.id), {radius:NEARBY_RADIUS_M}));
      const urls = await pinUrls().catch(() => null);
      if (cancelled) return;
      if (!urls || reduce) {
        host.current?.classList.add('is-ready');
        dot.animate([{opacity:0}, {opacity:1}], {duration:200, easing:'ease-out', fill:'forwards'});
        cancel = revealNear(map, near, NEARBY_RADIUS_M, {reduce:true});
        return;
      }
      map.getSource(POI_NEAR_SOURCE).setData(near);
      map.once('idle', () => {
        if (cancelled) return;
        const observer = new IntersectionObserver(([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          cancel = playIntro(map, {host:host.current, dot, urls, stand});
        }, {threshold:0.35});
        observer.observe(host.current);
        cancel = () => observer.disconnect();
      });
    });
    map.on('click', 'poi-near', event => {
      const feature = event.features?.[0];
      if (!feature) return;
      tip.current.textContent = feature.properties.name;
      tip.current.classList.remove('is-visible');
      tipMarker.current.setLngLat(feature.geometry.coordinates).addTo(map);
      requestAnimationFrame(() => tip.current?.classList.add('is-visible'));
    });
    map.on('click', event => {
      if (!map.getLayer('poi-near') || map.queryRenderedFeatures(event.point, {layers:['poi-near']}).length) return;
      tip.current?.classList.remove('is-visible');
    });
    map.on('mouseenter', 'poi-near', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'poi-near', () => { map.getCanvas().style.cursor = ''; });
    mapRef.current = map;
    return () => { cancelled = true; cancel(); stand.forEach(marker => marker.remove()); tipMarker.current?.remove(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], language, preview]);

  return <div className={`pp-map${preview ? ' is-preview' : ''}`}>
    <div ref={host} className="pp-map-canvas" role={preview ? undefined : 'region'} aria-hidden={preview || undefined} aria-label={preview ? undefined : say('Mapa com a localização aproximada', 'Mapa con la ubicación aproximada')}/>
    {!preview && <div className="pp-map-zoom">
      <button type="button" aria-label={say('Aproximar', 'Acercar')} onClick={() => mapRef.current?.zoomIn()}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
      <button type="button" aria-label={say('Afastar', 'Alejar')} onClick={() => mapRef.current?.zoomOut()}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
    </div>}
  </div>;
}
