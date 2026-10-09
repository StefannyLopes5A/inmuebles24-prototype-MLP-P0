import summaries from './compare-summaries.json' with {type:'json'};
import {homes as catalog, listingPrice} from './data.js';
import {homeCoordinates} from './mapLocations.js';
import {coloniaVision, nearestColonia, walkDistance} from './mapWidgets.js';

/** Invented zone figures for the prototype (MXN per m²; rent is monthly). Unlisted zones fall back to the catalog average. */
const ZONE_PRICE_M2 = {
  buy:{
    'Ampliación Granada':62000, 'Barrio Candelaria TicomAn':30000, 'Benito Juárez':42000, 'Bosques de las Lomas':70000,
    'Campestre Churubusco':52000, 'Ciudad de los Deportes':46000, 'Crédito Constructor':48000, 'Cuauhtémoc':50000,
    'Del Valle Centro':55000, 'Del Valle Norte':54000, 'El Yaqui':40000, 'Escandón II Sección':44000, 'Hipódromo':38000,
    'Jardines del Pedregal':62000, 'Juárez':55000, 'Lomas de Bezares':52000, 'Lomas de Chapultepec':85000,
    'Lomas de Vista Hermosa':58000, 'Lomas del Chamizal':56000, 'Narvarte Poniente':45000, 'Olivar de los Padres':62000,
    'Polanco II Sección':60000, 'Polanco V Sección':60000, 'Polanco':80000, 'Portales Sur':36000, 'Roma Norte':58000,
    'Roma Sur':70000, 'San José Insurgentes':52000, 'San Mateo Tlaltenango':50000, 'Santa Fe Centro':42000,
    'Santa Fe Cuajimalpa':55000, 'Santa Fe':68000, 'Xoco':40000,
  },
  rent:{
    'Ampliación Granada':520, 'Bosques de las Lomas':260, 'Colonia Centro':420, 'Cuauhtémoc':480, 'Del Valle Sur':320,
    'Granada':540, 'Granjas Palo Alto':300, 'Juárez':430, 'Lomas de Tarango':250, 'Nápoles':380, 'Periodista':360,
    'Polanco II Sección':560, 'Polanco III Sección':470, 'Polanco IV Sección':500, 'Polanco V Sección':520, 'Polanco':520,
    'Roma Sur':480, 'Santa Fe':330, 'Tabacalera':400,
  },
};

/** Zone percentile bands from the Figma bar; `start`/`end` are bar fractions, `min`/`max` the delta each band covers. */
export const PRICE_BANDS = [
  {id:'p0-30', start:0, end:0.2179, min:-0.6, max:-0.3},
  {id:'p30-70', start:0.2179, end:0.6699, min:-0.3, max:0.1},
  {id:'p70-90', start:0.6699, end:0.8942, min:0.1, max:0.3},
  {id:'p90-100', start:0.8942, end:1, min:0.3, max:0.8},
];

const sizeKnown = home => home.size >= 20;
export const pricePerM2 = home => sizeKnown(home) ? Math.round(listingPrice(home) / home.size) : null;

/** Cheapest m² first; homes without a usable size go last, in their saved order. */
export function byPricePerM2(homes) {
  return [...homes].sort((a, b) => (pricePerM2(a) ?? Infinity) - (pricePerM2(b) ?? Infinity));
}

export function zonePricePerM2(home, inventory = catalog) {
  const fixed = ZONE_PRICE_M2[home.mode]?.[home.area];
  if (fixed) return fixed;
  const peers = inventory.filter(item => item.mode === home.mode && item.area === home.area && sizeKnown(item));
  if (peers.length < 3) return null;
  return Math.round(peers.reduce((sum, item) => sum + pricePerM2(item), 0) / peers.length);
}

export function priceBand(delta) {
  if (delta == null) return null;
  const band = PRICE_BANDS.find(item => delta < item.max) || PRICE_BANDS[PRICE_BANDS.length - 1];
  const clamped = Math.min(band.max, Math.max(band.min, delta));
  return {id:band.id, position:band.start + (band.end - band.start) * (clamped - band.min) / (band.max - band.min)};
}

export const TRAVEL_MODES = ['walk', 'bike', 'car'];
/** Walking distance is ~1.3× the straight line. Bike lanes and one-way streets bend the other routes per place. */
const ROUTE_FACTOR = 1.3;
const SPEED = {walk:{metersPerMin:80, extra:0}, bike:{metersPerMin:250, extra:1}, car:{metersPerMin:330, extra:1}};
const DETOUR = {walk:[1, 0], bike:[0.85, 0.5], car:[1.1, 1.2]};
const NEARBY_KINDS = ['transport', 'green', 'education', 'food'];

function seed(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0;
}

/** `route` (0–1) is the place's own detour and, by car, its parking time (0–4 min). */
export function travelMinutes(meters, mode, route = 0) {
  const speed = SPEED[mode] || SPEED.walk;
  const [base, spread] = DETOUR[mode] || DETOUR.walk;
  const parking = mode === 'car' ? Math.round(route * 4) : 0;
  return Math.max(1, Math.ceil(meters * (base + spread * route) / speed.metersPerMin) + speed.extra + parking);
}

/** The closest place of each map-widget kind, measured from the home's map pin. */
export function nearbyPlaces(home) {
  const point = homeCoordinates(home);
  const vision = coloniaVision(home.area) || coloniaVision(nearestColonia(point).name);
  if (!vision) return [];
  return NEARBY_KINDS.map(kind => {
    const pois = vision.nearby.pois.filter(poi => poi.kind === kind && (kind !== 'transport' || /metro/i.test(poi.name.es)));
    const closest = pois
      .map(poi => ({kind, name:poi.name, meters:Math.round(walkDistance(point, poi.coordinates) * ROUTE_FACTOR)}))
      .sort((a, b) => a.meters - b.meters)[0];
    if (!closest) return null;
    const minutes = Object.fromEntries(TRAVEL_MODES.map(mode => [mode, travelMinutes(closest.meters, mode, (seed(`${home.id}|${kind}|${mode}`) % 1000) / 1000)]));
    return {...closest, minutes};
  }).filter(Boolean);
}

/** Demo copy written for the prototype; it is not taken from the listing. */
export function listingSummary(home, language = 'es-MX') {
  const entry = summaries[home.id]?.[language === 'pt-BR' ? 'br' : 'es'];
  return entry || {lead:'', text:home.title, priceNote:''};
}

function cheapestId(entries) {
  const known = entries.filter(entry => entry.ppm2 != null).sort((a, b) => a.ppm2 - b.ppm2);
  if (known.length < 2 || known[0].ppm2 === known[1].ppm2) return null;
  return known[0].home.id;
}

export function compareReading(homes, language = 'es-MX', inventory = catalog) {
  const entries = (homes || []).map(home => {
    const ppm2 = pricePerM2(home), zone = zonePricePerM2(home, inventory);
    const delta = ppm2 && zone ? ppm2 / zone - 1 : null;
    const band = priceBand(delta);
    return {home, ppm2, zone, delta, band:band?.id || null, position:band?.position ?? null};
  });
  const best = cheapestId(entries);
  const pt = language === 'pt-BR';
  const cards = entries.map(entry => {
    const summary = listingSummary(entry.home, language);
    const priceNote = entry.home.id === best
      ? (pt ? `O m² mais barato do que você salvou em ${entry.home.area}.` : `El m² más barato de lo que guardaste en ${entry.home.area}.`)
      : summary.priceNote;
    return {...entry, summary:{lead:summary.lead, text:summary.text}, priceNote, nearby:nearbyPlaces(entry.home)};
  });
  return {cards, best:{price:best}};
}
