import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {Protocol} from 'pmtiles';
import {Icon} from './App';
import {createPortal} from 'react-dom';
import {HouseCard} from './Home';
import {buildMapStyle, MAP_BOUNDS} from './mapStyle';
import {compactPrice, homeCoordinates, searchBounds} from './mapLocations';
import {listingPrice} from './data';
import {useLanguage} from './i18n';

/** How much of the footer stays visible under the map when the page is at the top. */
const FOOTER_PEEK = 140;

let protocolReady = false;
function ensureProtocol() {
  if (protocolReady) return;
  maplibregl.setWorkerUrl(mapWorkerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolReady = true;
}

/** The same house card as the results grid, with the approximate-location note and a close button. */
function MapCard({home, saved, compact, docked, onSave, onClose, onOpen, search, say}) {
  return <article className={'map-card' + (compact ? ' is-compact' : '') + (docked ? ' is-docked' : '')}>
    <HouseCard home={home} search={search} saved={saved} onLike={onSave} onOpen={target => onOpen(target)}/>
    <p className="map-card-note">{say('Localização aproximada', 'Ubicación aproximada')}</p>
    <button type="button" className="map-card-close" aria-label={say('Fechar prévia', 'Cerrar vista previa')} onClick={onClose}><Icon name="close" size={16}/></button>
  </article>;
}

/**
 * The results on a map, opened from the floating map card. It replaces only the main content of the results page: the
 * header, the filter bar and the footer stay. "Ver lista" sits in the top right corner and brings the list back; Escape
 * and the browser Back button do the same. Pins carry the price; a pin opens a small card that leads to the listing page.
 */
export default function ResultsMap({homes, search, saved, onSave, onOpen, onClose}) {
  const {language, money, currency, t} = useLanguage();
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const host = useRef(null), shell = useRef(null), mapRef = useRef(null), markers = useRef(new Map());
  const [selectedId, setSelectedId] = useState(null);
  const [height, setHeight] = useState(null);
  const [compact, setCompact] = useState(() => window.innerWidth <= 700);
  const cardMarker = useRef(null), cardHost = useRef(null);
  const selected = homes.find(home => home.id === selectedId) || null;
  // A tall card does not fit above its pin on a short map: it docks at the bottom left instead.
  const docked = !compact && height != null && height < 560;

  // The map fills what is left under the sticky header and filter bar, and stops short of the bottom so the top of the footer shows.
  useLayoutEffect(() => {
    const measure = () => {
      const bar = document.querySelector('.mora-bar');
      const top = bar ? bar.getBoundingClientRect().bottom + window.scrollY : 0;
      setHeight(Math.max(480, window.innerHeight - top - FOOTER_PEEK));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  useEffect(() => { mapRef.current?.resize(); }, [height]);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth <= 700);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const key = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('.home-popover, dialog[open]')) return;
      if (selectedId) setSelectedId(null); else onClose();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [selectedId, onClose]);

  useEffect(() => {
    ensureProtocol();
    const map = new maplibregl.Map({
      container:host.current, style:buildMapStyle({lang:language}), center:[-99.17, 19.41], zoom:12,
      minZoom:10, maxZoom:17, maxBounds:MAP_BOUNDS, attributionControl:false,
      dragRotate:false, pitchWithRotate:false, touchPitch:false, renderWorldCopies:false,
      // With a mouse the wheel zooms the map while the cursor is over it; outside the map the page scrolls as usual.
      // On touch screens two fingers move the map so a single finger can still scroll the page.
      cooperativeGestures:matchMedia('(pointer:coarse)').matches,
      locale:language === 'pt-BR'
        ? {'CooperativeGesturesHandler.WindowsHelpText':'Use Ctrl + rolagem para aproximar o mapa', 'CooperativeGesturesHandler.MacHelpText':'Use ⌘ + rolagem para aproximar o mapa', 'CooperativeGesturesHandler.MobileHelpText':'Use dois dedos para mover o mapa'}
        : {'CooperativeGesturesHandler.WindowsHelpText':'Usa Ctrl + scroll para acercar el mapa', 'CooperativeGesturesHandler.MacHelpText':'Usa ⌘ + scroll para acercar el mapa', 'CooperativeGesturesHandler.MobileHelpText':'Usa dos dedos para mover el mapa'},
    });
    map.addControl(new maplibregl.AttributionControl({compact:true}), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'bottom-right');
    map.touchZoomRotate.disableRotation();
    map.on('click', event => { if (!event.originalEvent.target.closest?.('.rm-pin')) setSelectedId(null); });
    mapRef.current = map;
    cardHost.current = document.createElement('div');
    cardHost.current.className = 'map-card-host';
    cardMarker.current = new maplibregl.Marker({element:cardHost.current, anchor:'bottom', offset:[0, -22]});
    const bounds = searchBounds(homes, search);
    const frame = () => { if (bounds) map.fitBounds(bounds, {padding:{top:96, bottom:48, left:48, right:48}, maxZoom:15, duration:0}); };
    map.once('load', frame);
    frame();
    return () => { cardMarker.current?.remove(); markers.current.forEach(marker => marker.remove()); markers.current.clear(); map.remove(); mapRef.current = null; };
  // The map is built once per opening; pins follow the results below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const live = new Set(homes.map(home => home.id));
    for (const [id, marker] of markers.current) if (!live.has(id)) { marker.remove(); markers.current.delete(id); }
    for (const home of homes) {
      if (markers.current.has(home.id)) continue;
      const pin = document.createElement('button');
      pin.type = 'button'; pin.className = 'rm-pin'; pin.dataset.id = home.id;
      pin.textContent = compactPrice(listingPrice(home), currency, language);
      pin.setAttribute('aria-label', `${home.street}, ${money(listingPrice(home))} ${currency}`);
      pin.addEventListener('click', event => { event.stopPropagation(); selectRef.current(home.id); });
      markers.current.set(home.id, new maplibregl.Marker({element:pin, anchor:'center'}).setLngLat(homeCoordinates(home)).addTo(map));
    }
  }, [homes, currency, language, money]);

  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const pin = marker.getElement();
      pin.dataset.state = id === selectedId ? 'selected' : '';
      pin.style.zIndex = id === selectedId ? '2' : '';
    });
  }, [selectedId, homes]);

  /** Selecting a pin opens its card above it and pans the map so the whole card is in view. */
  function select(id) {
    if (id === selectedId) { setSelectedId(null); return; }
    setSelectedId(id);
    const map = mapRef.current, home = homes.find(item => item.id === id);
    if (!map || !home) return;
    const point = map.project(homeCoordinates(home)), box = map.getContainer();
    const w = box.clientWidth, h = box.clientHeight, margin = 16;
    let dx = 0, dy = 0;
    if (compact) {
      const free = Math.max(80, h - 400);
      if (point.y > free) dy = point.y - free; else if (point.y < 64) dy = point.y - 64;
    } else if (docked) {
      const clear = 16 + 296 + 40;
      if (point.x < clear) dx = point.x - clear; else if (point.x > w - 48) dx = point.x - (w - 48);
      if (point.y < 56) dy = point.y - 56; else if (point.y > h - 48) dy = point.y - (h - 48);
    } else {
      const half = 296 / 2 + margin;
      if (point.x < half) dx = point.x - half; else if (point.x > w - half) dx = point.x - (w - half);
      const need = Math.min(486, h - 40);
      if (point.y < need) dy = point.y - need; else if (point.y > h - 40) dy = point.y - (h - 40);
    }
    if (dx || dy) map.panBy([dx, dy], {duration:matchMedia('(prefers-reduced-motion:reduce)').matches ? 0 : 300});
  }
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    const marker = cardMarker.current, map = mapRef.current;
    if (!marker || !map) return;
    if (selected && !compact && !docked) marker.setLngLat(homeCoordinates(selected)).addTo(map); else marker.remove();
  }, [selectedId, compact, docked, homes]);

  return <section ref={shell} className="rm-page" style={height ? {height} : undefined} aria-label={say('Mapa de resultados', 'Mapa de resultados')}>
    <div ref={host} className="rm-canvas"/>
    <header className="rm-bar">
      <p className="rm-count" role="status">{new Intl.NumberFormat(language).format(homes.length)} {say(homes.length === 1 ? 'imóvel' : 'imóveis', homes.length === 1 ? 'inmueble' : 'inmuebles')}</p>
      <button type="button" className="rm-close" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg><span>{say('Ver lista', 'Ver lista')}</span></button>
    </header>
    {selected && !compact && !docked && cardHost.current && createPortal(<MapCard home={selected} search={search} saved={saved.includes(selected.id)} onSave={onSave} onClose={() => setSelectedId(null)} onOpen={onOpen} say={say}/>, cardHost.current)}
    {selected && (compact || docked) && <MapCard compact={compact} docked={docked} home={selected} search={search} saved={saved.includes(selected.id)} onSave={onSave} onClose={() => setSelectedId(null)} onOpen={onOpen} say={say}/>}
  </section>;
}
