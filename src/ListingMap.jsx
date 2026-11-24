import React, {useEffect, useRef, useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {Protocol} from 'pmtiles';
import {buildMapStyle, MAP_BOUNDS} from './mapStyle';
import {POI_CATEGORIES, NEARBY_RADIUS_M, poiCollection, poisNear} from './pois';
import {ensurePoiLayers, PIN_BOX, POI_NEAR_SOURCE, pinUrls, revealNear} from './poiLayers';
import {MapPlaceSearch, TRIP_MODES, modeIcon} from './MapPlaceSearch';
import {poiIconUrl} from './pois';
import {placeFromPoint} from './placeTrips';
import {IconButton} from './IconButton.jsx';

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
const HOME_ZOOM = 15.4, PLACE_ZOOM = 16.5, SAME_KIND_RADIUS_M = 2500;
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
  const [place, setPlace] = useState(null);
  const [mode, setMode] = useState('walk');
  const [resetKey, setResetKey] = useState(0);
  const trip = useRef({pin: null, chip: null});
  useEffect(() => { setPlace(null); }, [center[0], center[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    ensureProtocol();
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    const map = new maplibregl.Map({
      container:host.current, style:buildMapStyle({lang:language}), center, zoom:preview ? 13.4 : HOME_ZOOM,
      minZoom:12, maxZoom:17, maxBounds:MAP_BOUNDS, interactive:!preview,
      attributionControl:false, dragRotate:false, pitchWithRotate:false, touchPitch:false, renderWorldCopies:false,
      cooperativeGestures:!preview,
      locale:language === 'pt-BR'
        ? {'CooperativeGesturesHandler.WindowsHelpText':'Use Ctrl + rolagem para aproximar o mapa', 'CooperativeGesturesHandler.MacHelpText':'Use ⌘ + rolagem para aproximar o mapa', 'CooperativeGesturesHandler.MobileHelpText':'Use dois dedos para mover o mapa'}
        : {'CooperativeGesturesHandler.WindowsHelpText':'Usa Ctrl + scroll para acercar el mapa', 'CooperativeGesturesHandler.MacHelpText':'Usa ⌘ + scroll para acercar el mapa', 'CooperativeGesturesHandler.MobileHelpText':'Usa dos dedos para mover el mapa'},
    });
    if (!preview) {
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
    // Tapping a place opens the same card as searching for it, and the map keeps only places of its kind.
    map.on('click', 'poi-near', event => {
      const feature = event.features?.[0];
      if (!feature) return;
      const next = placeFromPoint(center, feature.properties, feature.geometry.coordinates);
      if (next) { tip.current?.classList.remove('is-visible'); setPlace(next); }
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

  // The place picked in the search: a pin, a dotted line from the home and the minutes for the chosen mode.
  useEffect(() => {
    const map = mapRef.current;
    if (preview || !map) return undefined;
    let off = false;
    const apply = () => {
      if (off) return;
      const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
      const state = trip.current;
      state.pin?.remove(); state.chip?.remove(); state.pin = state.chip = null;
      if (!map.getSource('trip')) {
        map.addSource('trip', {type:'geojson', data:{type:'FeatureCollection', features:[]}});
        map.addLayer({id:'trip-line', type:'line', source:'trip', layout:{'line-cap':'round'}, paint:{'line-color':'#222222', 'line-width':3, 'line-dasharray':[0.1, 2]}});
      }
      // With a place picked the map keeps only places of its kind around it; cleared, it shows everything around the home again.
      const kind = place ? poiCollection(poisNear(place.coordinates, [place.categoria], {radius:SAME_KIND_RADIUS_M}))
        : poiCollection(poisNear(center, POI_CATEGORIES.map(category => category.id), {radius:NEARBY_RADIUS_M}));
      map.getSource(POI_NEAR_SOURCE)?.setData(kind);
      if (!place) {
        map.getSource('trip').setData({type:'FeatureCollection', features:[]});
        return;
      }
      const target = place.coordinates;
      map.getSource('trip').setData({type:'Feature', properties:{}, geometry:{type:'LineString', coordinates:[center, target]}});
      const pin = document.createElement('div');
      pin.className = 'pp-map-place';
      const icon = document.createElement('img');
      icon.src = poiIconUrl(place.categoria); icon.alt = ''; icon.width = icon.height = 22;
      pin.append(icon);
      state.pin = new maplibregl.Marker({element:pin, anchor:'bottom'}).setLngLat(target).addTo(map);
      const [, modeIconName, , ] = TRIP_MODES.find(item => item[0] === mode) || TRIP_MODES[0];
      const chip = document.createElement('div');
      chip.className = 'pp-map-chip';
      chip.setAttribute('aria-hidden', 'true');
      const glyph = document.createElement('img');
      glyph.src = modeIcon(modeIconName); glyph.alt = ''; glyph.width = glyph.height = 16;
      const text = document.createElement('span');
      text.textContent = `${place.minutes[mode]} min`;
      chip.append(glyph, text);
      state.chip = new maplibregl.Marker({element:chip, anchor:'bottom', offset:[0, -50]}).setLngLat(target).addTo(map);
      // The place always lands in the middle of the map, close up, wherever it is in the catalog.
      map.easeTo({center:target, zoom:PLACE_ZOOM, duration:reduce ? 0 : 700, essential:true});
    };
    if (map.isStyleLoaded()) apply(); else map.once("load", apply);
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, mode, language, center[0], center[1], preview]);

  // Back to the listing view when the search is cleared or reset.
  const hadPlace = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    const wasPlace = hadPlace.current;
    hadPlace.current = !!place;
    if (preview || !map || place || !wasPlace) return;
    map.easeTo({center, zoom:HOME_ZOOM, duration:matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 500});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  function reset() {
    setPlace(null);
    setMode('walk');
    setResetKey(key => key + 1);
    tip.current?.classList.remove('is-visible');
    mapRef.current?.easeTo({center, zoom:HOME_ZOOM, duration:matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 500});
  }

  return <div className={`pp-map${preview ? ' is-preview' : ''}${place ? ' has-place' : ''}`}>
    <div ref={host} className="pp-map-canvas" role={preview ? undefined : 'region'} aria-hidden={preview || undefined} aria-label={preview ? undefined : say('Mapa com a localização aproximada', 'Mapa con la ubicación aproximada')}/>
    {!preview && <MapPlaceSearch center={center} language={language} say={say} place={place} mode={mode} resetKey={resetKey} onPlace={next => { setPlace(next); }} onMode={setMode} onClose={reset}/>}
    {!preview && <IconButton icon="reset" className="pp-map-reset" label={say('Redefinir busca e mapa', 'Restablecer búsqueda y mapa')} title={say('Redefinir busca e mapa', 'Restablecer búsqueda y mapa')} onClick={reset}/>}
    {!preview && <div className="pp-map-zoom">
      <button type="button" aria-label={say('Aproximar', 'Acercar')} onClick={() => mapRef.current?.zoomIn()}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
      <button type="button" aria-label={say('Afastar', 'Alejar')} onClick={() => mapRef.current?.zoomOut()}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
    </div>}
  </div>;
}
