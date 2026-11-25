import React, {useEffect, useRef, useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {Protocol} from 'pmtiles';
import {buildMapStyle, MAP_BOUNDS} from './mapStyle';
import {searchBounds} from './mapLocations';
import {useLanguage} from './i18n';

let protocolReady = false;
function ensureProtocol() {
  if (protocolReady) return;
  maplibregl.setWorkerUrl(mapWorkerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolReady = true;
}

const EXPAND_PATH = 'M200-200v-240h80v160h160v80H200Zm480-320v-160H520v-80h240v240h-80Z';

/**
 * The floating map card on the results page: a quiet, non-interactive map of the search area.
 * It does not split the screen; it opens the full-screen map. It steps aside once the price block below the grid is in view.
 */
export default function MapFloat({homes, search, label, onOpen}) {
  const {language, t} = useLanguage();
  const host = useRef(null), mapRef = useRef(null);
  const [tucked, setTucked] = useState(false);

  useEffect(() => {
    ensureProtocol();
    const map = new maplibregl.Map({
      container:host.current, style:buildMapStyle({lang:language}), center:[-99.17, 19.41], zoom:12,
      minZoom:10, maxZoom:17, maxBounds:MAP_BOUNDS, interactive:false, attributionControl:false, renderWorldCopies:false,
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  // One mini map per page; it reframes when the results change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const key = homes.map(home => home.id).join(',');
  useEffect(() => {
    const map = mapRef.current;
    const bounds = searchBounds(homes, search);
    if (map && bounds) map.fitBounds(bounds, {padding:24, maxZoom:14, duration:0});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, language]);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const rich = document.querySelector('.price-insights');
      if (!rich) { setTucked(false); return; }
      const compact = document.documentElement.clientWidth <= 700;
      setTucked(rich.getBoundingClientRect().top < window.innerHeight - (compact ? 144 : 240));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', schedule, {passive:true});
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  }, [key]);

  return <section className="map-float" data-tuck={tucked || undefined} aria-label={t('Mapa de resultados')} inert={tucked || undefined}>
    <div ref={host} className="map-float-canvas" aria-hidden="true"/>
    <button type="button" className="map-float-trigger" aria-label={`${t('Abrir mapa')}: ${label}`} onClick={onOpen}>
      <span className="map-float-shade" aria-hidden="true"/>
      <span className="map-float-title">{label}</span>
      <span className="map-float-expand" aria-hidden="true"><svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor"><path d={EXPAND_PATH}/></svg></span>
    </button>
  </section>;
}
