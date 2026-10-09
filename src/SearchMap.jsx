import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {Protocol} from 'pmtiles';
import {buildMapStyle,MAP_BOUNDS} from './mapStyle';
import {compactPrice,homeCoordinates,neighborhoodCentroid,searchBounds,NEIGHBORHOOD_CENTROIDS} from './mapLocations';
import {boundsCenter,featureBounds,placeFeature,placeNivel,searchPlace} from './coloniaPolygons';
import {applyRect,isMorphing,mapMorphDuration,morphMap,readRect} from './searchMapMotion';
import {listingPrice} from './data';
import {useLanguage} from './i18n';
import {Icon} from './App';
import {HouseCard} from './Home';
import {MapWidgets} from './MapWidgetStack';
import {
  SETTLE_MS,WALK_HIGHLIGHT_M,buildStack,homePosition,legendFor,overlayCollections,
  pickColonia,placeMatchesSearch,resolveLevel,walkDistance,
} from './mapWidgets';
import {coloniaVision,textOf} from './mapWidgetContent';

const SPLIT_MIN = 951, COMPACT_MAX = 700, MINI_ZOOM = 13;
const EASE_OUT = [0.23, 1, 0.32, 1], EASE_DRAWER = [0.32, 0.72, 0, 1];
const HANDLERS = ['dragPan','scrollZoom','doubleClickZoom','touchZoomRotate','keyboard','boxZoom'];

let protocolReady = false;
function ensureProtocol() {
  if (protocolReady) return;
  maplibregl.setWorkerUrl(mapWorkerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolReady = true;
}

const viewportWidth = () => document.documentElement.clientWidth;
const prefersReduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const visibleMapMode = (mode, width) => mode === 'half' && width < SPLIT_MIN ? 'mini' : mode;

let savedCamera = null;
let lastBarHeight = 97;
function measureMetrics(probe) {
  const bar = document.querySelector('.search-flow-page .mora-bar');
  if (bar?.querySelector('.mora-collapsed')) lastBarHeight = bar.offsetHeight;
  // Where the sticky bar settles, not where it is mid-scroll; the same variable drives its `top`.
  const barTop = bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
  return {barBottom:barTop + lastBarHeight, safeBottom:probe ? parseFloat(getComputedStyle(probe).paddingBottom) || 0 : 0};
}

/** Viewport rect of each state; the half width matches `clamp(360px, 42vw, 760px)` in search-map.css. */
function rectFor(mode, {barBottom, safeBottom}) {
  const w = viewportWidth(), h = window.innerHeight, compact = w <= COMPACT_MAX;
  if (mode === 'mini') {
    const size = compact ? 128 : 192, gap = compact ? 16 : 48;
    return {top:h - gap - safeBottom - size, left:w - gap - size, width:size, height:size, radius:compact ? 20 : 24};
  }
  if (mode === 'half') {
    const width = Math.min(760, Math.max(360, w * .42)), top = barBottom + 24;
    return {top, left:w - 24 - width, width, height:h - top - 24, radius:16};
  }
  if (w < SPLIT_MIN) return {top:barBottom, left:0, width:w, height:h - barBottom, radius:0};
  const top = barBottom + 16;
  return {top, left:24, width:w - 48, height:h - top - 24, radius:16};
}

/** Keep what was visible inside `focus` in place while the map container changes size. */
function refocus(map, before, focus, after) {
  if (!map) return;
  const fx = focus.left + focus.width / 2, fy = focus.top + focus.height / 2;
  const anchor = map.unproject([fx - before.left, fy - before.top]);
  map.resize();
  map.jumpTo({center:anchor});
  map.panBy([after.left + after.width / 2 - fx, after.top + after.height / 2 - fy], {animate:false});
}

const SEARCH_ZOOM = 14;

function searchFocus(search) {
  const place = searchPlace(search);
  if (place.kind === 'city') return null;
  if (place.feature) {
    const center = boundsCenter(featureBounds(place.feature)) || NEIGHBORHOOD_CENTROIDS[place.name];
    return {name:place.name, center, zoom:SEARCH_ZOOM, feature:place.feature, nivel:place.kind};
  }
  if (place.name && NEIGHBORHOOD_CENTROIDS[place.name]) {
    return {name:place.name, center:NEIGHBORHOOD_CENTROIDS[place.name], zoom:SEARCH_ZOOM, nivel:'colonia'};
  }
  const name = search?.areas?.find(area => NEIGHBORHOOD_CENTROIDS[area]);
  return name ? {name, center:NEIGHBORHOOD_CENTROIDS[name], zoom:SEARCH_ZOOM, nivel:'colonia'} : null;
}

const EXPAND_PATH = 'M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z';
function SymbolIcon({path}) {
  return <svg width="24" height="24" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" focusable="false"><path d={path}/></svg>;
}
function PipIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2"/>
    <rect x="12" y="12" width="6" height="4" rx="1" fill="currentColor"/>
  </svg>;
}

const EMPTY_FC = {type:'FeatureCollection', features:[]};

function ensureOverlays(map) {
  if (map.getSource('mora-focus')) return;
  map.addSource('mora-focus', {type:'geojson', data:EMPTY_FC});
  map.addLayer({id:'mora-focus-fill', type:'fill', source:'mora-focus', paint:{'fill-color':'#111','fill-opacity':0.07}});
  map.addLayer({id:'mora-focus-line', type:'line', source:'mora-focus', paint:{'line-color':'#111','line-width':1.6,'line-opacity':0.85}});
  map.addSource('mora-heat', {type:'geojson', data:EMPTY_FC});
  map.addLayer({id:'mora-heat-fill', type:'fill', source:'mora-heat', paint:{
    'fill-color':['get','fill'],
    'fill-opacity':0.32,
  }});
  map.addSource('mora-commute', {type:'geojson', data:EMPTY_FC});
  map.addLayer({id:'mora-commute-fill', type:'fill', source:'mora-commute', paint:{
    'fill-color':'#111','fill-opacity':['interpolate', ['linear'], ['get','ring'], 0, 0.12, 2, 0.04],
  }});
  map.addLayer({id:'mora-commute-line', type:'line', source:'mora-commute', paint:{'line-color':'#111','line-width':1,'line-dasharray':[2,2],'line-opacity':0.35}});
}

function setOverlayData(map, collections) {
  if (!map?.getSource('mora-focus')) return;
  map.getSource('mora-focus').setData(collections.focus);
  map.getSource('mora-heat').setData(collections.heat);
  map.getSource('mora-commute').setData(collections.commute);
}

function PoiPin({poi, selected, language, onSelect}) {
  return <button type="button" className="map-poi" data-kind={poi.kind} data-state={selected ? 'selected' : undefined}
    aria-label={`${textOf(poi.name, language)}${poi.walk ? `, ${poi.walk} min` : ''}`} onClick={() => onSelect(poi.id)}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {poi.kind === 'transport' && <path d="M6 10h12v8H6zM8 6h8l2 4H6zM8 20v1m8-1v1"/>}
      {poi.kind === 'green' && <path d="M12 22V10M7 12c3-6 7-6 10 0"/>}
      {poi.kind === 'education' && <path d="M3 10 12 5l9 5-9 5-9-5zm3 3v5l6 3 6-3v-5"/>}
      {poi.kind === 'food' && <path d="M8 3v8m0 0H5m3 0h3M16 3c0 4-2 5-2 8v5h6v-5c0-3-2-4-2-8"/>}
      {poi.kind === 'health' && <path d="M12 6v12M6 12h12"/>}
    </svg>
    {selected && <span>{textOf(poi.name, language)} · {poi.walk} min a pie</span>}
  </button>;
}

function PricePin({home, order, state, interactive, onSelect, dim}) {
  const {language,money,currency,t}=useLanguage();
  return <button type="button" className="map-pin" data-state={state} data-dim={dim || undefined} style={{'--pin-order':order}} tabIndex={interactive ? 0 : -1}
    aria-pressed={state === 'selected'} aria-label={`${money(listingPrice(home))} ${currency} · ${home.street} · ${home.area}. ${t('Ubicación aproximada')}`}
    onClick={() => onSelect(home.id)}>
    {compactPrice(listingPrice(home), currency, language)}
  </button>;
}

function MapCard({home, saved, compact, onSave, onClose, onOpen}) {
  const {t}=useLanguage();
  const reduce = useReducedMotion();
  const hiddenState = reduce ? {opacity:0} : {opacity:0, transform:compact ? 'translateY(100%)' : 'scale(0.96)'};
  const shownState = reduce ? {opacity:1} : {opacity:1, transform:compact ? 'translateY(0%)' : 'scale(1)'};
  return <motion.article className={'map-card'+(compact ? ' is-compact' : '')} initial={hiddenState} animate={shownState}
    exit={{...hiddenState, transition:{duration:.15, ease:EASE_OUT}}}
    transition={reduce ? {duration:.15} : {duration:compact ? .3 : .2, ease:compact ? EASE_DRAWER : EASE_OUT}}>
    <HouseCard home={home} saved={saved} onLike={onSave} onOpen={target => onOpen(target)}/>
    <p className="map-card-note">{t('Ubicación aproximada')}</p>
    <button type="button" className="map-card-close" aria-label={t('Cerrar vista previa')} onClick={onClose}><Icon name="close" size={16}/></button>
  </motion.article>;
}

export default function SearchMap({mode, onMode, homes, hoveredId, saved, recent, areaLabel:label, hidden, onOpenListing, onSave, search, signedIn=false, onLogin, onAskMora}) {
  const {t,language}=useLanguage();
  const shell=useRef(null), host=useRef(null), probe=useRef(null), mapRef=useRef(null);
  const miniButton=useRef(null), halfButton=useRef(null), fullButton=useRef(null);
  const pinHosts=useRef(new Map()), markers=useRef(new Map()), cardMarker=useRef(null), cardHost=useRef(null);
  const poiHosts=useRef(new Map()), poiMarkers=useRef(new Map());
  const applied=useRef(null), appliedWidth=useRef(0), fittedKey=useRef(''), styleLanguage=useRef(language), cancelMorph=useRef(()=>{});
  const pointerOnStack=useRef(false), settleTimer=useRef(null), pendingLogin=useRef(null), sawPoi=useRef(false), userMoved=useRef(false);
  const [width,setWidth]=useState(viewportWidth);
  const [layoutTick,setLayoutTick]=useState(0);
  const [entered,setEntered]=useState(false);
  const [ready,setReady]=useState(false);
  const [selectedId,setSelectedId]=useState(null);
  const [colonia,setColonia]=useState(() => search?.areas?.[0] || homes[0]?.area || 'Narvarte Poniente');
  const [level,setLevel]=useState('colonia');
  const [settling,setSettling]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [expandedId,setExpandedId]=useState(null);
  const [activeLayer,setActiveLayer]=useState(null);
  const [poiOn,setPoiOn]=useState(() => new Set());
  const [hoverWidget,setHoverWidget]=useState(null);
  const [selectedPoi,setSelectedPoi]=useState(null);
  const shown=visibleMapMode(mode, width);
  const compact=width <= COMPACT_MAX;
  const widgetsOn=shown === 'full' && width >= SPLIT_MIN && !hidden;
  const homesKey=homes.map(home => home.id).join('|');
  const selected=homes.find(home => home.id === selectedId) || null;
  const seen=new Set(recent);
  const vision=coloniaVision(colonia);
  const stack=widgetsOn ? buildStack({
    level: selected ? 'home' : level, colonia: selected?.area || colonia, search, home: selected,
    language, session:{homes, sawPoi:sawPoi.current, loginHighlight:true},
  }) : null;
  if (!cardHost.current && typeof document !== 'undefined') {cardHost.current=document.createElement('div');cardHost.current.className='map-card-host';}

  function frameBounds(map, bounds, {nivel, animate=false} = {}) {
    if (!map || !bounds) return;
    const open = nivel === 'alcaldia' || nivel === 'city';
    const edge = open ? 96 : 56;
    const widgets = shown === 'full' && width >= SPLIT_MIN;
    map.fitBounds(bounds, {
      padding: widgets ? {top:edge, right:edge, bottom:edge, left:400 + (open ? 24 : 0)} : edge,
      maxZoom: open ? 12.4 : 15,
      duration: animate && !prefersReduced() ? 400 : 0,
    });
  }

  function applySearchCamera(map, {animate=false} = {}) {
    if (!map) return;
    const place=searchPlace(search);
    if (place.kind === 'city') {
      setLevel('city');
      frameBounds(map, searchBounds(homes, search), {nivel:'city', animate});
      return;
    }
    setColonia(place.name);
    setLevel(place.kind === 'alcaldia' ? 'city' : 'colonia');
    if (place.feature) {
      frameBounds(map, featureBounds(place.feature), {nivel:place.kind, animate});
      return;
    }
    frameBounds(map, searchBounds(homes, {areas:[place.name]}), {nivel:'colonia', animate});
  }

  function applyPlaceCamera(map, name, {animate=true} = {}) {
    if (!map || !name) return;
    const feature=placeFeature(name);
    setColonia(name);
    setLevel(placeNivel(name) === 'alcaldia' ? 'city' : 'colonia');
    setSelectedId(null);
    if (feature) {
      frameBounds(map, featureBounds(feature), {nivel:feature.properties.nivel, animate});
      return;
    }
    frameBounds(map, searchBounds(homes, {areas:[name]}), {nivel:'colonia', animate});
  }

  function hostForPoi(id) {
    let el=poiHosts.current.get(id);
    if (!el) {el=document.createElement('div');el.className='map-poi-host';poiHosts.current.set(id,el);}
    return el;
  }

  function hostFor(id) {
    let el=pinHosts.current.get(id);
    if (!el) {el=document.createElement('div');el.className='map-pin-host';pinHosts.current.set(id,el);}
    return el;
  }

  useEffect(() => {
    ensureProtocol();
    const first=homes[0];
    const resume=savedCamera?.key === homesKey && shown !== 'mini' ? savedCamera : null;
    const map=new maplibregl.Map({
      container:host.current, style:buildMapStyle({lang:language}),
      center:resume?.center || (first ? neighborhoodCentroid(first) : [-99.17, 19.41]), zoom:resume?.zoom ?? MINI_ZOOM,
      minZoom:10, maxZoom:17, maxBounds:MAP_BOUNDS,
      attributionControl:false, dragRotate:false, pitchWithRotate:false, touchPitch:false, renderWorldCopies:false,
    });
    map.addControl(new maplibregl.AttributionControl({compact:true}), 'bottom-left');
    map.touchZoomRotate.disableRotation();
    map.on('load', () => {ensureOverlays(map);setReady(true);});
    map.on('dragstart', () => {userMoved.current=true;});
    map.on('zoomstart', event => {if (event.originalEvent) userMoved.current=true;});
    map.on('click', event => {
      if (!event.originalEvent.target.closest?.('.map-pin,.map-card,.map-poi,.map-widget-stack,.map-widget-panel,.map-widget-pill')) {
        setSelectedId(null);setSelectedPoi(null);
      }
    });
    mapRef.current=map;
    fittedKey.current=resume ? homesKey : '';
    cardMarker.current=new maplibregl.Marker({element:cardHost.current, anchor:'bottom', offset:[0,-22]});
    return () => {
      savedCamera=applied.current && applied.current !== 'mini' ? {key:fittedKey.current, center:map.getCenter().toArray(), zoom:map.getZoom()} : null;
      cancelMorph.current();markers.current.forEach(marker => marker.remove());markers.current.clear();
      poiMarkers.current.forEach(marker => marker.remove());poiMarkers.current.clear();
      map.remove();mapRef.current=null;};
  }, []);

  useEffect(() => {
    const map=mapRef.current;
    if (!map || styleLanguage.current === language) return;
    styleLanguage.current=language;
    map.setStyle(buildMapStyle({lang:language}));
    map.once('idle', () => ensureOverlays(map));
  }, [language]);

  useEffect(() => {
    const map=mapRef.current;
    if (!map) return;
    for (const handler of HANDLERS) shown === 'mini' ? map[handler].disable() : map[handler].enable();
    map.touchZoomRotate.disableRotation();
    if (shown === 'mini') {userMoved.current=false;setSelectedId(null);setExpandedId(null);setActiveLayer(null);setPoiOn(new Set());}
  }, [shown]);

  useEffect(() => {
    const map=mapRef.current;
    if (!map) return;
    const ids=new Set(homes.map(home => home.id));
    for (const [id, marker] of markers.current) if (!ids.has(id)) {marker.remove();markers.current.delete(id);}
    for (const home of homes) if (!markers.current.has(home.id)) markers.current.set(home.id, new maplibregl.Marker({element:hostFor(home.id), anchor:'center'}).setLngLat(homeCoordinates(home)).addTo(map));
    if (selectedId && !ids.has(selectedId)) setSelectedId(null);
    if (applied.current === 'mini' || !applied.current) {
      const focus=searchFocus(search);
      if (focus) map.jumpTo({center:focus.center, zoom:MINI_ZOOM});
      else if (homes[0]) map.jumpTo({center:neighborhoodCentroid(homes[0]), zoom:MINI_ZOOM});
    } else if (fittedKey.current !== homesKey) {
      fittedKey.current=homesKey;
      applySearchCamera(map, {animate:shown !== 'mini'});
    }
  }, [homesKey]);

  useEffect(() => {
    const map=mapRef.current;
    if (!map || !widgetsOn) return;
    const readContext=() => {
      if (pointerOnStack.current) return;
      const nextLevel=resolveLevel({zoom:map.getZoom(), selectedId, previous:level});
      const focus=searchFocus(search);
      const nextColonia=userMoved.current || !focus ? pickColonia(map.getCenter().toArray(), colonia) : focus.name;
      if (nextLevel !== level) setLevel(nextLevel);
      if (nextColonia !== colonia) {
        setSettling(true);
        setColonia(nextColonia);
        setExpandedId(null);
        window.setTimeout(() => setSettling(false), prefersReduced() ? 0 : 280);
      }
    };
    const onMove=() => {
      clearTimeout(settleTimer.current);
      settleTimer.current=setTimeout(readContext, SETTLE_MS);
    };
    map.on('moveend', onMove);
    map.on('zoomend', onMove);
    readContext();
    return () => {map.off('moveend', onMove);map.off('zoomend', onMove);clearTimeout(settleTimer.current);};
  }, [widgetsOn, ready, selectedId, colonia, level, search]);

  useEffect(() => {
    const map=mapRef.current;
    if (!map || !ready) return;
    ensureOverlays(map);
    const outlineOn = shown !== 'mini' && !hidden;
    if (!outlineOn) {
      setOverlayData(map, {focus:EMPTY_FC, heat:EMPTY_FC, commute:EMPTY_FC});
      return;
    }
    const placeName = selected?.area || colonia;
    const collections=overlayCollections({
      colonia: placeName,
      layer: widgetsOn ? activeLayer : null,
      commuteFrom: selected ? homeCoordinates(selected) : NEIGHBORHOOD_CENTROIDS[colonia],
    });
    if (!widgetsOn) collections.heat = EMPTY_FC, collections.commute = EMPTY_FC;
    setOverlayData(map, collections);
    const alcaldia = placeNivel(placeName) === 'alcaldia';
    if (map.getLayer('mora-focus-line')) {
      map.setPaintProperty('mora-focus-line', 'line-width', alcaldia ? (hoverWidget ? 3.4 : 2.8) : (hoverWidget ? 2.2 : 1.6));
      map.setPaintProperty('mora-focus-line', 'line-opacity', alcaldia ? 0.95 : 0.85);
    }
    if (map.getLayer('mora-focus-fill')) {
      map.setPaintProperty('mora-focus-fill', 'fill-opacity', alcaldia ? 0.04 : 0.07);
    }
  }, [widgetsOn, ready, shown, hidden, colonia, selectedId, activeLayer, hoverWidget, language]);

  useEffect(() => {
    const map=mapRef.current;
    if (!map) return;
    const pois=(poiOn.size && vision?.nearby?.pois) ? vision.nearby.pois.filter(poi => poiOn.has(poi.kind)) : [];
    const ids=new Set(pois.map(poi => poi.id));
    for (const [id, marker] of poiMarkers.current) if (!ids.has(id)) {marker.remove();poiMarkers.current.delete(id);}
    for (const poi of pois) if (!poiMarkers.current.has(poi.id)) {
      poiMarkers.current.set(poi.id, new maplibregl.Marker({element:hostForPoi(poi.id), anchor:'center'}).setLngLat(poi.coordinates).addTo(map));
    }
  }, [poiOn, colonia, vision, ready]);

  const poiReady = widgetsOn && !!vision?.nearby?.pois?.length && placeNivel(colonia) !== 'alcaldia';
  useEffect(() => {
    if (!poiReady) {
      setPoiOn(new Set());
      return;
    }
    setPoiOn(new Set(['transport']));
  }, [poiReady, colonia]);

  useEffect(() => {
    if (signedIn && pendingLogin.current) {
      setExpandedId(pendingLogin.current);
      pendingLogin.current=null;
    }
  }, [signedIn]);

  useEffect(() => {
    for (const [id, el] of pinHosts.current) el.style.zIndex=id === selectedId ? '3' : id === hoveredId ? '2' : '';
    const marker=cardMarker.current, map=mapRef.current;
    if (!marker || !map) return;
    if (selected && !compact) marker.setLngLat(homeCoordinates(selected)).addTo(map);
  }, [selectedId, hoveredId, compact]);

  useEffect(() => {
    const onResize=() => setWidth(viewportWidth());
    const relayout=() => setLayoutTick(tick => tick + 1);
    window.addEventListener('resize', onResize);
    const observer=new MutationObserver(relayout);
    observer.observe(document.documentElement, {attributes:true, attributeFilter:['style']});
    return () => {window.removeEventListener('resize', onResize);observer.disconnect();};
  }, []);

  useEffect(() => {
    let frame, timer;
    const check=() => {
      if (document.querySelector('.transition-scene')) {timer=setTimeout(check, 150);return;}
      setEntered(true);
    };
    frame=requestAnimationFrame(() => {frame=requestAnimationFrame(check);});
    return () => {cancelAnimationFrame(frame);clearTimeout(timer);};
  }, []);

  useEffect(() => {
    const root=document.documentElement;
    if (hidden) delete root.dataset.mapMode; else root.dataset.mapMode=shown;
    return () => {delete root.dataset.mapMode;};
  }, [shown, hidden]);

  useLayoutEffect(() => {
    const el=shell.current, map=mapRef.current;
    if (!el) return;
    const to=rectFor(shown, measureMetrics(probe.current));
    const previous=applied.current, widthChanged=appliedWidth.current !== width;
    applied.current=shown;
    appliedWidth.current=width;
    const before=readRect(el);
    if (previous === shown && !widthChanged && Math.abs(before.top - to.top) < .5 && Math.abs(before.height - to.height) < .5 && !isMorphing(el)) return;
    if (!previous || (previous === shown && (widthChanged || prefersReduced()))) {
      cancelMorph.current();
      applyRect(el, to); el.style.borderRadius=`${to.radius}px`; el.style.clipPath='';
      map?.resize();
      if (!previous && shown !== 'mini') {
        fittedKey.current=homesKey;
        applySearchCamera(map);
      }
      return;
    }
    if (previous === shown) {
      cancelMorph.current=morphMap(el, {
        from:{...before, radius:to.radius}, to, duration:220, easing:'cubic-bezier(0.23, 1, 0.32, 1)',
        onStage:(stage, visible) => refocus(map, before, visible, stage),
        onSettle:(target, stage) => {if (stage) refocus(map, stage, target, target); else map?.resize();},
      });
      return;
    }
    const from={...before, radius:parseFloat(el.style.borderRadius) || 0};
    const keyboardFocus=el.contains(document.activeElement);
    const opening=previous === 'mini' && shown !== 'mini';
    cancelMorph.current=morphMap(el, {
      from, to, duration:mapMorphDuration(previous, shown),
      onStage:(stage, visible) => {
        refocus(map, before, visible, stage);
      },
      onSettle:(target, stage) => {
        if (stage) refocus(map, stage, target, target); else map?.resize();
        if (shown === 'mini') {
          fittedKey.current='';
          const focus=searchFocus(search);
          if (focus) map?.easeTo({center:focus.center, zoom:MINI_ZOOM, duration:prefersReduced() ? 0 : 300});
          else if (homes[0]) map?.easeTo({center:neighborhoodCentroid(homes[0]), zoom:MINI_ZOOM, duration:prefersReduced() ? 0 : 300});
        } else if (opening || (shown === 'full' && previous === 'half' && !userMoved.current)) {
          fittedKey.current=homesKey;
          applySearchCamera(map);
        }
        if (keyboardFocus) ({mini:miniButton, half:halfButton, full:fullButton})[shown].current?.focus({preventScroll:true});
      },
    });
  }, [shown, width, layoutTick]);

  useEffect(() => {
    const onKey=event => {
      if (event.key !== 'Escape' || event.defaultPrevented || hidden || shown === 'mini') return;
      if (document.querySelector('dialog[open],.home-popover[data-open="true"]') || !document.querySelector('.search-flow-page .mora-collapsed')) return;
      if (expandedId) {event.preventDefault();setExpandedId(null);return;}
      if (selectedPoi) {event.preventDefault();setSelectedPoi(null);return;}
      if (selectedId) {event.preventDefault();setSelectedId(null);return;}
      if (shown === 'full') {event.preventDefault();onMode(width < SPLIT_MIN ? 'mini' : 'half');}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedPoi, expandedId, shown, hidden, width, onMode]);

  function select(id) {
    if (id === selectedId) {setSelectedId(null);return;}
    setSelectedId(id);
    const map=mapRef.current, home=homes.find(item => item.id === id);
    if (!map || !home) return;
    const point=map.project(homeCoordinates(home)), box=map.getContainer();
    const w=box.clientWidth, h=box.clientHeight, margin=16;
    let dx=0, dy=0;
    if (compact) {
      const free=Math.max(80, h - 400);
      if (point.y > free) dy=point.y - free;
      else if (point.y < 64) dy=point.y - 64;
    } else {
      const half=296 / 2 + margin;
      const left=widgetsOn ? 400 : half;
      if (point.x < left) dx=point.x - left; else if (point.x > w - half) dx=point.x - (w - half);
      if (point.y < 420) dy=point.y - 420; else if (point.y > h - 40) dy=point.y - (h - 40);
    }
    if (dx || dy) map.panBy([dx, dy], {duration:prefersReduced() ? 0 : 300});
  }

  const interactive=shown !== 'mini' && !hidden;
  const highlightPoi=selectedPoi && vision?.nearby?.pois.find(poi => poi.id === selectedPoi);
  const dimHome=home => highlightPoi ? walkDistance(homeCoordinates(home), highlightPoi.coordinates) > WALK_HIGHLIGHT_M : false;
  const hoveredHome=hoveredId ? homes.find(home => home.id === hoveredId) : null;
  const hoveredPosition=hoveredHome && vision ? homePosition(hoveredHome, vision) : null;
  const outOfSearch=!!search?.areas?.length && colonia && !placeMatchesSearch(colonia, search);
  const visiblePois=(poiOn.size && vision?.nearby?.pois) ? vision.nearby.pois.filter(poi => poiOn.has(poi.kind)) : [];
  const card=selected && interactive ? <MapCard key="map-card" home={selected} saved={saved.includes(selected.id)} compact={compact}
    onSave={onSave} onClose={() => setSelectedId(null)} onOpen={onOpenListing}/> : null;

  return createPortal(<>
    <div className="map-backdrop" data-active={shown === 'full' && !hidden} aria-hidden="true"/>
    <section ref={shell} className="map-shell" data-mode={shown} data-entered={entered} data-hidden={hidden} aria-label={t('Mapa de resultados')} inert={hidden || undefined}>
    <span ref={probe} className="map-safe-probe" aria-hidden="true"/>
    <div ref={host} className="map-canvas" data-ready={ready}/>
    <button ref={miniButton} type="button" className="map-mini-trigger" tabIndex={shown === 'mini' ? 0 : -1} aria-hidden={shown !== 'mini'}
      aria-label={`${t('Abrir mapa')}: ${label}`} onClick={() => onMode(width < SPLIT_MIN ? 'full' : 'half')}>
      <span className="map-mini-shade" aria-hidden="true"/>
      <span className="map-mini-title">{label}</span>
      <span className="map-mini-expand" aria-hidden="true"><SymbolIcon path={EXPAND_PATH}/></span>
    </button>
    <div className="map-controls" inert={shown === 'mini' || undefined}>
      <div className="map-controls-end">
        <button ref={halfButton} type="button" className="map-control" data-only="half" aria-label={t('Ampliar mapa')} onClick={() => onMode('full')}><SymbolIcon path={EXPAND_PATH}/></button>
        <button type="button" className="map-control" data-only="half" aria-label={t('Reducir mapa')} onClick={() => onMode('mini')}><PipIcon/></button>
        <button ref={fullButton} type="button" className="map-control" data-only="full" aria-label={t('Cerrar mapa')} onClick={() => onMode(width < SPLIT_MIN ? 'mini' : 'half')}><Icon name="close" size={18}/></button>
        <div className="map-zoom" role="group" aria-label={t('Zoom')}>
          <button type="button" aria-label={t('Acercar')} onClick={() => mapRef.current?.zoomIn()}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
          <button type="button" aria-label={t('Alejar')} onClick={() => mapRef.current?.zoomOut()}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
        </div>
      </div>
    </div>
    {homes.map((home, index) => createPortal(<PricePin home={home} order={Math.min(index, 8)} interactive={interactive} onSelect={select}
      dim={dimHome(home)}
      state={home.id === selectedId ? 'selected' : home.id === hoveredId ? 'hovered' : seen.has(home.id) ? 'seen' : undefined}/>, hostFor(home.id), home.id))}
    {visiblePois.map(poi => createPortal(<PoiPin poi={poi} selected={poi.id === selectedPoi} language={language}
      onSelect={id => {sawPoi.current=true;setSelectedPoi(current => current === id ? null : id);}}/>, hostForPoi(poi.id), poi.id))}
    {createPortal(<AnimatePresence>{!compact && card}</AnimatePresence>, cardHost.current)}
    <AnimatePresence>{compact && card}</AnimatePresence>
    {widgetsOn && <MapWidgets stack={stack} settling={settling} collapsed={collapsed} expandedId={expandedId}
      activeLayer={activeLayer} poiOn={poiOn} hoverWidget={hoverWidget} signedIn={signedIn} language={language}
      outOfSearch={outOfSearch} hoveredHome={hoveredPosition} legend={legendFor(activeLayer, language)}
      onToggleCollapse={() => setCollapsed(current => !current)}
      onExpand={id => setExpandedId(id)}
      onBack={() => setExpandedId(null)}
      onActivate={id => {
        const widget=stack?.widgets.find(item => item.id === id);
        if (widget?.layer) setActiveLayer(current => current === widget.layer ? null : widget.layer);
        else setExpandedId(id);
      }}
      onHover={(id, poiId) => {setHoverWidget(id);if (poiId) setSelectedPoi(poiId);}}
      onTogglePoi={(kind, poiId) => {setPoiOn(new Set([kind]));setSelectedPoi(poiId || vision?.nearby?.pois.find(poi => poi.kind === kind)?.id || null);}}
      onLogin={id => {pendingLogin.current=id;onLogin?.();}}
      onAsk={text => onAskMora?.(text)}
      onPickColonia={name => {
        userMoved.current=false;
        applyPlaceCamera(mapRef.current, name, {animate:true});
      }}
      onReturnSearch={() => {
        userMoved.current=false;
        applySearchCamera(mapRef.current, {animate:true});
      }}
      onPointerInside={inside => {pointerOnStack.current=inside;}}/>}
  </section>
  </>, document.body);
}
