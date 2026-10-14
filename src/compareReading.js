import {homes as catalog, listingPrice} from './data.js';
import {listingDetails} from './listingPresentation.js';
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

// A development's "desde" price and smallest unit are not one apartment, so it never enters a m² comparison.
const sizeKnown = home => home.size >= 20 && !home.development;
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

const pct = (a, b) => Math.round(Math.abs(a / b - 1) * 100);

/** Each dimension reads one known fact per home; `low` means the smallest value wins. Unknown values never compete. */
const DIMENSIONS = [
  {id:'price', low:true, value:entry => listingPrice(entry.home) || null,
    say:(win, next, {t, other}) => ({lead:t('O mais acessível', 'El más accesible'), text:t(`Custa ${pct(win, next)}% menos que ${other.pt}.`, `Cuesta ${pct(win, next)}% menos que ${other.es}.`)})},
  {id:'size', value:entry => sizeKnown(entry.home) ? entry.home.size : null,
    say:(win, next, {t, other}) => ({lead:t('O mais amplo', 'El más amplio'), text:t(`${win} m², ${pct(win, next)}% a mais que ${other.pt}.`, `${win} m², ${pct(win, next)}% más que ${other.es}.`)})},
  {id:'beds', value:entry => entry.home.beds || null,
    say:(win, next, {t, other}) => ({lead:t('Mais quartos', 'Más recámaras'), text:t(`${win} quartos, ${win - next} a mais que ${other.pt}.`, `${win} recámaras, ${win - next} más que ${other.es}.`)})},
  {id:'parking', value:entry => listingDetails(entry.home).parking ?? null,
    say:(win, next, {t, pair}) => ({lead:t('Mais vagas', 'Más estacionamientos'), text:pair
      ? next ? t(`${win} vagas; o outro tem ${next}.`, `${win} estacionamientos; el otro tiene ${next}.`) : t(`${win} vagas; o outro não tem.`, `${win} estacionamientos; el otro no tiene.`)
      : next ? t(`${win} vagas; os outros têm até ${next}.`, `${win} estacionamientos; los otros tienen hasta ${next}.`) : t(`${win} vagas; os outros não têm.`, `${win} estacionamientos; los otros no tienen.`)})},
  {id:'metro', low:true, value:entry => entry.nearby.find(place => place.kind === 'transport')?.minutes.walk ?? null,
    say:(win, next, {t, pair}, entry) => {
      const name = entry.nearby.find(place => place.kind === 'transport').name;
      return {lead:t('Metrô mais perto', 'El metro más cerca'), text:pair
        ? t(`${name.pt} a ${win} min a pé; o outro fica a ${next}.`, `${name.es} a ${win} min a pie; el otro queda a ${next}.`)
        : t(`${name.pt} a ${win} min a pé; os outros ficam a ${next} ou mais.`, `${name.es} a ${win} min a pie; los otros quedan a ${next} o más.`)};
    }},
];
/** A lead below this relative margin is a tie, not a highlight. */
const MIN_MARGIN = 0.1;

/** What each column has that the others don't: the dimension it wins by the widest margin. */
function highlights(entries, t) {
  const taken = new Set();
  const pair = entries.length === 2;
  const other = pair ? {pt:'o outro', es:'el otro'} : {pt:'o próximo da sua lista', es:'el siguiente de tu lista'};
  // Rent and sale prices don't compare.
  const mixed = new Set(entries.map(entry => entry.home.mode)).size > 1;
  const wins = entries.map(() => []), losses = entries.map(() => []);
  for (const dimension of DIMENSIONS) {
    if (mixed && dimension.id === 'price') continue;
    const known = entries.map((entry, index) => ({index, value:dimension.value(entry)})).filter(item => item.value != null)
      .sort((a, b) => dimension.low ? a.value - b.value : b.value - a.value);
    if (known.length < 2) continue;
    const [win, next] = known;
    const margin = Math.abs(win.value - next.value) / Math.max(win.value, next.value);
    if (margin >= MIN_MARGIN) wins[win.index].push({dimension, margin, win:win.value, next:next.value});
    const [last, before] = known.slice(-2).reverse();
    const gap = Math.abs(last.value - before.value) / Math.max(last.value, before.value);
    if (gap >= MIN_MARGIN) losses[last.index].push({dimension, margin:gap});
  }
  return entries.map((entry, index) => {
    const best = wins[index].sort((a, b) => b.margin - a.margin).find(item => !taken.has(item.dimension.id));
    if (best) {
      taken.add(best.dimension.id);
      return best.dimension.say(best.win, best.next, {t, other, pair}, entry);
    }
    const worst = losses[index].sort((a, b) => b.margin - a.margin)[0];
    const lead = zoneLead(entry, t);
    return worst
      ? {lead, text:t(`Não lidera em nada da sua lista e é ${WORST[worst.dimension.id].pt}.`, `No lidera en nada de tu lista y es ${WORST[worst.dimension.id].es}.`)}
      : {lead, text:t('Fica no meio da sua lista em preço, espaço e metrô.', 'Queda en medio de tu lista en precio, espacio y metro.')};
  });
}

const WORST = {
  price:{pt:'o mais caro', es:'el más caro'}, size:{pt:'o menor', es:'el más chico'}, beds:{pt:'o de menos quartos', es:'el de menos recámaras'},
  parking:{pt:'o de menos vagas', es:'el de menos estacionamientos'}, metro:{pt:'o mais longe do metrô', es:'el más lejos del metro'},
};

/** Zone position, as the lead of a column that wins nothing or stands alone. */
function zoneLead({delta}, t) {
  if (delta == null) return t('Sem destaque claro', 'Sin algo que destaque');
  if (delta <= -0.1) return t('Abaixo da região', 'Abajo de su zona');
  if (delta >= 0.1) return t('Acima da região', 'Arriba de su zona');
  return t('Na mediana da região', 'En la mediana de su zona');
}

/** The zone delta already sits on the bar, so the note says where the m² falls inside the list. */
function priceNoteFor(entry, entries, t) {
  const known = entries.filter(item => item.ppm2 != null && item.home.mode === entry.home.mode).sort((a, b) => a.ppm2 - b.ppm2);
  const rank = known.indexOf(entry);
  if (known.length < 2 || rank < 0) return '';
  if (rank === 0) return t('Divide o m² mais baixo da sua lista.', 'Comparte el m² más bajo de tu lista.');
  if (rank === known.length - 1) return t('O m² mais alto da sua lista.', 'El m² más alto de tu lista.');
  if (rank === 1) return t('O segundo m² mais baixo da sua lista.', 'El segundo m² más bajo de tu lista.');
  return t('O m² fica no meio da sua lista.', 'Su m² queda en medio de tu lista.');
}

function cheapestId(entries) {
  if (new Set(entries.map(entry => entry.home.mode)).size > 1) return null;
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
  const t = (br, es) => pt ? br : es;
  const located = entries.map(entry => ({...entry, nearby:nearbyPlaces(entry.home)}));
  const leads = highlights(located, t);
  const cards = located.map((entry, index) => {
    const priceNote = entry.home.id === best
      ? t(`O m² mais barato do que você salvou em ${entry.home.area}.`, `El m² más barato de lo que guardaste en ${entry.home.area}.`)
      : priceNoteFor(entry, located, t);
    const summary = located.length > 1 ? leads[index] : {lead:zoneLead(entry, t), text:t('Salve outro favorito para ver no que este se destaca.', 'Guarda otro favorito para ver en qué destaca este.')};
    return {...entry, summary, priceNote};
  });
  return {cards, best:{price:best}};
}
