import React, {useEffect, useRef} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import {Protocol} from 'pmtiles';
import {buildMapStyle} from './mapStyle';
import {boundsCenter, featureBounds, placeFeature} from './coloniaPolygons.js';
import {neighborhoodCentroid} from './mapLocations.js';

let protocolReady = false;
function ensureProtocol() {
  if (protocolReady) return;
  maplibregl.setWorkerUrl(mapWorkerUrl);
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolReady = true;
}

/** A still map of one colonia: its outline over the city, drawn like the results map's focus (soft grey fill, thin dark line). */
export default function RegionMap({area, language}) {
  const host = useRef(null);
  useEffect(() => {
    ensureProtocol();
    const feature = placeFeature(area);
    const bounds = featureBounds(feature);
    const center = boundsCenter(bounds) || neighborhoodCentroid({area}) || [-99.1332, 19.4326];
    const map = new maplibregl.Map({
      container: host.current, style: buildMapStyle({lang: language}), center, zoom: 13.4, minZoom: 10, maxZoom: 17,
      interactive: false, attributionControl: false, dragRotate: false, pitchWithRotate: false, renderWorldCopies: false,
    });
    map.on('load', () => {
      map.resize();
      if (feature) {
        map.addSource('region', {type: 'geojson', data: feature});
        map.addLayer({id: 'region-fill', type: 'fill', source: 'region', paint: {'fill-color': '#111', 'fill-opacity': 0.07}});
        map.addLayer({id: 'region-line', type: 'line', source: 'region', paint: {'line-color': '#111', 'line-width': 1.6, 'line-opacity': 0.85}});
        if (bounds) map.fitBounds(bounds, {padding: 28, duration: 0, maxZoom: 15.5});
      }
    });
    return () => map.remove();
  }, [area, language]);
  return <div ref={host} className="region-map" aria-hidden="true"/>;
}
