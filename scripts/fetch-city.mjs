// One-off extract of the city around Torre Olmo from OpenStreetMap (© OpenStreetMap contributors, ODbL).
// Writes public/data/city.json in local metres centred on the lot. The app never calls a map service at runtime.
// Usage: node scripts/fetch-city.mjs
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LOT} from '../src/development/buildingConfig.js';

const RADIUS = 1500;
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const METERS_PER_DEGREE = 111320;
const cosLat = Math.cos(LOT.lat * Math.PI / 180);
const project = ({lon, lat}) => [
  Math.round((lon - LOT.lon) * METERS_PER_DEGREE * cosLat * 10) / 10,
  Math.round(-(lat - LOT.lat) * METERS_PER_DEGREE * 10) / 10,
];

const query = `[out:json][timeout:120];
(
  way["building"](around:${RADIUS},${LOT.lat},${LOT.lon});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian)$"](around:${RADIUS},${LOT.lat},${LOT.lon});
  way["leisure"~"^(park|garden)$"](around:${RADIUS},${LOT.lat},${LOT.lon});
  way["natural"="water"](around:${RADIUS},${LOT.lat},${LOT.lon});
  node["railway"="station"](around:${RADIUS},${LOT.lat},${LOT.lon});
  node["station"="subway"](around:${RADIUS},${LOT.lat},${LOT.lon});
  node["amenity"~"^(cafe|school|kindergarten|hospital)$"]["name"](around:${RADIUS},${LOT.lat},${LOT.lon});
);
out geom;`;

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0;
}
function area(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}
const inside = ([x, y], poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
function height(tags, id) {
  const tagged = parseFloat(tags.height);
  if (Number.isFinite(tagged) && tagged > 2) return Math.min(tagged, 200);
  const levels = parseFloat(tags['building:levels']);
  if (Number.isFinite(levels) && levels > 0) return Math.min(levels * 3.2, 200);
  return 9 + (hash(id) % 16);
}
const ring = element => {
  const points = (element.geometry || []).map(project);
  if (points.length > 2 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
  return points;
};

async function overpass() {
  const failures = [];
  for (const endpoint of ENDPOINTS) {
    const response = await fetch(endpoint, {
      method:'POST',
      headers:{'User-Agent':'inmuebles24-prototype/1.0 (one-off city extract)', Accept:'application/json'},
      body:new URLSearchParams({data:query}),
    });
    if (response.ok) return response.json();
    failures.push(`${endpoint} ${response.status}`);
  }
  throw new Error(`Overpass unavailable: ${failures.join(', ')}`);
}
// The raw answer is kept outside the repo so the filler step can be tuned without asking Overpass again.
const cache = join(tmpdir(), 'torre-olmo-osm.json');
const {elements} = existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : await overpass();
if (!existsSync(cache)) writeFileSync(cache, JSON.stringify({elements}));
const lot = LOT.footprint;
const city = {
  attribution:'© OpenStreetMap contributors (ODbL)',
  center:{lon:LOT.lon, lat:LOT.lat}, radius:RADIUS, capturedAt:new Date().toISOString().slice(0, 10),
  buildings:[], roads:[], parks:[], water:[], pois:[],
};
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary']);
for (const element of elements) {
  const tags = element.tags || {};
  if (element.type === 'node') {
    const [x, z] = project(element);
    const kind = tags.railway === 'station' || tags.station === 'subway' ? 'transport'
      : tags.amenity === 'cafe' ? 'food' : tags.amenity === 'hospital' ? 'health' : 'education';
    city.pois.push({name:tags.name, kind, x, z});
    continue;
  }
  const points = ring(element);
  if (points.length < 2) continue;
  if (tags.building) {
    if (points.length < 3 || area(points) < 30) continue;
    if (points.some(point => inside(point, lot)) || lot.some(point => inside(point, points))) continue;
    city.buildings.push({h:Math.round(height(tags, element.id) * 10) / 10, p:points});
  } else if (tags.highway) {
    city.roads.push({major:MAJOR.has(tags.highway), w:MAJOR.has(tags.highway) ? 14 : tags.highway === 'tertiary' ? 10 : 7, p:points});
  } else if (tags.leisure) {
    if (points.length >= 3) city.parks.push({name:tags.name || null, p:points});
  } else if (tags.natural === 'water' && points.length >= 3) {
    city.water.push({p:points});
  }
}
// Parks with a name become points of interest too, so Ciudad and the window view can label them.
for (const park of city.parks) {
  if (!park.name || area(park.p) < 4000) continue;
  const [x, z] = park.p.reduce(([sx, sz], [px, pz]) => [sx + px / park.p.length, sz + pz / park.p.length], [0, 0]);
  city.pois.push({name:park.name, kind:'green', x:Math.round(x), z:Math.round(z)});
}
// OSM maps few CDMX footprints. Empty frontage along the streets gets deterministic massing (g:1),
// so the model reads as a city; it never sits on a park, a road, water, the lot or a mapped building.
const CELL = 6;
const occupied = new Set();
const key = (x, z) => `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`;
function markPolygon(points) {
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  for (let x = Math.min(...xs); x <= Math.max(...xs) + CELL; x += CELL) {
    for (let z = Math.min(...zs); z <= Math.max(...zs) + CELL; z += CELL) {
      const cx = (Math.floor(x / CELL) + 0.5) * CELL, cz = (Math.floor(z / CELL) + 0.5) * CELL;
      if (inside([cx, cz], points)) occupied.add(key(cx, cz));
    }
  }
}
const cellsOf = points => {
  const cells = [];
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  for (let x = Math.floor(Math.min(...xs) / CELL) * CELL; x <= Math.max(...xs); x += CELL) {
    for (let z = Math.floor(Math.min(...zs) / CELL) * CELL; z <= Math.max(...zs); z += CELL) {
      if (inside([x + CELL / 2, z + CELL / 2], points)) cells.push(key(x + CELL / 2, z + CELL / 2));
    }
  }
  return cells;
};
city.buildings.forEach(b => markPolygon(b.p));
city.parks.forEach(p => markPolygon(p.p));
city.water.forEach(w => markPolygon(w.p));
markPolygon([[-40, -40], [40, -40], [40, 40], [-40, 40]]);
for (const road of city.roads) {
  for (let i = 1; i < road.p.length; i += 1) {
    const [ax, az] = road.p[i - 1], [bx, bz] = road.p[i];
    const length = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= length; t += 2) {
      const x = ax + (bx - ax) * t / length, z = az + (bz - az) * t / length;
      for (let dx = -road.w / 2; dx <= road.w / 2; dx += 2) for (let dz = -road.w / 2; dz <= road.w / 2; dz += 2) occupied.add(key(x + dx, z + dz));
    }
  }
}
let generated = 0;
for (const [roadIndex, road] of city.roads.entries()) {
  for (let i = 1; i < road.p.length; i += 1) {
    const [ax, az] = road.p[i - 1], [bx, bz] = road.p[i];
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 16) continue;
    const ux = (bx - ax) / length, uz = (bz - az) / length, nx = -uz, nz = ux;
    for (let t = 8; t < length - 8; t += 19) {
      for (const sideSign of [-1, 1]) {
        const seed = hash(`${roadIndex}:${i}:${t}:${sideSign}`);
        const width = 14 + seed % 6, depth = 14 + (seed >>> 4) % 10;
        const offset = road.w / 2 + 3 + depth / 2;
        const cx = ax + ux * t + nx * offset * sideSign, cz = az + uz * t + nz * offset * sideSign;
        if (Math.hypot(cx, cz) > RADIUS - 60) continue;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [
          Math.round((cx + ux * a * width / 2 + nx * b * depth / 2) * 10) / 10,
          Math.round((cz + uz * a * width / 2 + nz * b * depth / 2) * 10) / 10,
        ]);
        const cells = cellsOf(corners);
        if (!cells.length || cells.some(cell => occupied.has(cell))) continue;
        cells.forEach(cell => occupied.add(cell));
        const tall = seed % 23 === 0;
        city.buildings.push({h:tall ? 36 + seed % 40 : 7 + (seed >>> 8) % 20, p:corners, g:1});
        generated += 1;
      }
    }
  }
}
writeFileSync('public/data/city.json', JSON.stringify(city));
console.log(`generated ${generated}`);
console.log(`buildings ${city.buildings.length}, roads ${city.roads.length}, parks ${city.parks.length}, water ${city.water.length}, pois ${city.pois.length}`);
