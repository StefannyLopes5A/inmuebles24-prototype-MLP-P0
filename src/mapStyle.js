import {LIGHT,layers} from '@protomaps/basemaps';

export const MAP_ASSETS='/assets/map';
export const MAP_SOURCE='protomaps';
export const MAP_BOUNDS=[[-99.36,19.25],[-99.05,19.55]];

export const MAP_PALETTE={
  land:'#f5f4f0',
  block:'#efede8',
  building:'#e9e7e2',
  park:'#d3ebc9',
  parkStrong:'#c4e3b6',
  water:'#aad3ee',
  road:'#ffffff',
  roadCasing:'#e2e0db',
  highwayCasing:'#d4d2cc',
  label:'#6f6f6f',
  labelSoft:'#8c8c8c',
  halo:'#ffffff',
};

const p=MAP_PALETTE;
export const MAP_FLAVOR={
  ...LIGHT,
  background:p.land,earth:p.land,
  park_a:p.park,park_b:p.parkStrong,wood_a:p.park,wood_b:p.parkStrong,scrub_a:p.park,scrub_b:p.parkStrong,zoo:p.park,
  hospital:p.block,industrial:p.block,school:p.block,pedestrian:p.block,military:p.block,aerodrome:p.block,runway:p.road,
  sand:'#f1ede2',beach:'#f1ede2',glacier:p.road,
  water:p.water,
  buildings:p.building,pier:p.road,
  other:p.road,minor_service:p.road,minor_a:p.road,minor_b:p.road,link:p.road,major:p.road,highway:p.road,
  minor_service_casing:p.roadCasing,minor_casing:p.roadCasing,link_casing:p.roadCasing,
  major_casing_early:p.roadCasing,major_casing_late:p.roadCasing,
  highway_casing_early:p.highwayCasing,highway_casing_late:p.highwayCasing,
  tunnel_other:'#f3f2ee',tunnel_minor:'#f3f2ee',tunnel_link:'#f3f2ee',tunnel_major:'#f3f2ee',tunnel_highway:'#f3f2ee',
  tunnel_other_casing:p.roadCasing,tunnel_minor_casing:p.roadCasing,tunnel_link_casing:p.roadCasing,tunnel_major_casing:p.roadCasing,tunnel_highway_casing:p.highwayCasing,
  bridges_other:p.road,bridges_minor:p.road,bridges_link:p.road,bridges_major:p.road,bridges_highway:p.road,
  bridges_other_casing:p.roadCasing,bridges_minor_casing:p.roadCasing,bridges_link_casing:p.roadCasing,bridges_major_casing:p.roadCasing,bridges_highway_casing:p.highwayCasing,
  railway:'#d9d6d0',boundaries:'#c9c6c0',
  roads_label_minor:p.labelSoft,roads_label_minor_halo:p.halo,roads_label_major:p.label,roads_label_major_halo:p.halo,
  subplace_label:p.labelSoft,subplace_label_halo:p.halo,city_label:p.label,city_label_halo:p.halo,
  state_label:p.labelSoft,state_label_halo:p.halo,country_label:p.labelSoft,ocean_label:'#6b9cc4',
  address_label:p.labelSoft,address_label_halo:p.halo,
  pois:{...LIGHT.pois,green:'#4f9a5a',blue:'#5b93b8',lapis:'#5b7fc4',pink:'#b98aa8',red:'#c98a95',slategray:'#8a8aa0',tangerine:'#c49060',turquoise:'#5bb5bf'},
  landcover:{...LIGHT.landcover,urban_area:p.land,grassland:p.park,forest:p.parkStrong,farmland:p.park,scrub:p.park,barren:p.land},
};

// The basemap `pois` layer would duplicate the local POIs drawn by SearchMap from src/data/pois.json.
const HIDDEN_LAYERS=new Set(['address_label','roads_oneway','roads_shields','boundaries_country','boundaries','pois']);

export function buildMapStyle({lang='es'}={}){
  const origin=typeof window==='undefined'?'':window.location.origin;
  const base=layers(MAP_SOURCE,MAP_FLAVOR,{lang:lang.startsWith('pt')?'pt':'es'}).filter(layer=>!HIDDEN_LAYERS.has(layer.id)).map(layer=>{
    if(layer.id==='places_subplace')return {...layer,layout:{...layer.layout,'text-transform':'uppercase','text-letter-spacing':.12,'text-size':11}};
    return layer;
  });
  return {
    version:8,
    glyphs:`${origin}${MAP_ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite:`${origin}${MAP_ASSETS}/sprites/light`,
    sources:{[MAP_SOURCE]:{type:'vector',url:`pmtiles://${origin}${MAP_ASSETS}/cdmx.pmtiles`,attribution:'© OpenStreetMap'}},
    layers:base,
  };
}
