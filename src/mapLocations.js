/** Same fixed demo rate as `DEMO_MXN_PER_USD` in i18n.jsx, which node tests cannot import. */
const MXN_PER_USD = 20;

/** Approximate public centroids [lng, lat]; listings carry no coordinates of their own. */
export const NEIGHBORHOOD_CENTROIDS = Object.freeze({
  'Ampliación Granada': [-99.1885, 19.4405],
  'Barrio Candelaria TicomAn': [-99.1395, 19.5065],
  'Bosques de las Lomas': [-99.2470, 19.3925],
  'Campestre Churubusco': [-99.1340, 19.3420],
  'Ciudad de los Deportes': [-99.1785, 19.3830],
  'Colonia Centro': [-99.1335, 19.4326],
  'Crédito Constructor': [-99.1790, 19.3640],
  'Cuauhtémoc': [-99.1640, 19.4300],
  'Del Valle Centro': [-99.1680, 19.3850],
  'Del Valle Norte': [-99.1690, 19.3920],
  'Del Valle Sur': [-99.1660, 19.3720],
  'El Yaqui': [-99.2900, 19.3740],
  'Escandón II Sección': [-99.1810, 19.4020],
  'Granada': [-99.1950, 19.4375],
  'Granjas Palo Alto': [-99.2620, 19.3800],
  'Hipódromo': [-99.1690, 19.4110],
  'Jardines del Pedregal': [-99.2050, 19.3170],
  'Juárez': [-99.1590, 19.4270],
  'Lomas de Bezares': [-99.2380, 19.4040],
  'Lomas de Chapultepec': [-99.2150, 19.4240],
  'Lomas de Tarango': [-99.2280, 19.3610],
  'Lomas de Vista Hermosa': [-99.2600, 19.3940],
  'Lomas del Chamizal': [-99.2700, 19.3880],
  'Narvarte Poniente': [-99.1580, 19.3960],
  'Nápoles': [-99.1760, 19.3940],
  'Olivar de los Padres': [-99.2250, 19.3300],
  'Periodista': [-99.2080, 19.4510],
  'Polanco': [-99.1950, 19.4330],
  'Polanco II Sección': [-99.1960, 19.4310],
  'Polanco III Sección': [-99.1930, 19.4370],
  'Polanco IV Sección': [-99.2030, 19.4300],
  'Polanco V Sección': [-99.1880, 19.4300],
  'Portales Sur': [-99.1460, 19.3650],
  'Roma Norte': [-99.1620, 19.4180],
  'Roma Sur': [-99.1600, 19.4070],
  'San José Insurgentes': [-99.1830, 19.3660],
  'San Mateo Tlaltenango': [-99.2730, 19.3470],
  'Santa Fe': [-99.2550, 19.3660],
  'Santa Fe Centro': [-99.2600, 19.3600],
  'Santa Fe Cuajimalpa': [-99.2770, 19.3640],
  'Tabacalera': [-99.1530, 19.4370],
  'Xoco': [-99.1680, 19.3590],
});

const BOROUGH_CENTROIDS = Object.freeze({
  'Benito Juárez': [-99.1600, 19.3800],
  'Cuauhtémoc': [-99.1520, 19.4280],
  'Miguel Hidalgo': [-99.2000, 19.4300],
  'Alvaro Obregón': [-99.2200, 19.3600],
  'Cuajimalpa de Morelos': [-99.2800, 19.3700],
  'Coyoacán': [-99.1600, 19.3400],
  'Gustavo A. Madero': [-99.1150, 19.4900],
});
const CITY_CENTER = [-99.1700, 19.4100];
const OFFSET_METERS = 300;
const METERS_PER_DEGREE = 111320;

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0;
}

export function neighborhoodCentroid(home) {
  const [colonia, borough] = String(home?.location || '').split(',').map(part => part.trim());
  return NEIGHBORHOOD_CENTROIDS[colonia] || NEIGHBORHOOD_CENTROIDS[home?.area] || BOROUGH_CENTROIDS[borough] || BOROUGH_CENTROIDS[colonia] || CITY_CENTER;
}

/** Deterministic spread inside the colonia so pins of the same area don't stack. */
export function homeCoordinates(home) {
  const [lng, lat] = neighborhoodCentroid(home);
  const seed = hash(home?.id);
  const angle = (seed % 3600) / 3600 * Math.PI * 2;
  const radius = Math.sqrt(((seed >>> 12) % 1000) / 1000) * OFFSET_METERS;
  const dLat = radius * Math.sin(angle) / METERS_PER_DEGREE;
  const dLng = radius * Math.cos(angle) / (METERS_PER_DEGREE * Math.cos(lat * Math.PI / 180));
  return [Number((lng + dLng).toFixed(6)), Number((lat + dLat).toFixed(6))];
}

export function resultsBounds(homes) {
  if (!homes?.length) return null;
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const home of homes) {
    const [lng, lat] = homeCoordinates(home);
    west = Math.min(west, lng); east = Math.max(east, lng);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  return [[west, south], [east, north]];
}

/** Frame the search colonias, not catalog suggestions outside the query. */
export function searchBounds(homes, search) {
  const areas = (search?.areas || []).filter(name => NEIGHBORHOOD_CENTROIDS[name]);
  if (!areas.length) return resultsBounds(homes);
  const focused = (homes || []).filter(home => areas.includes(home.area));
  if (focused.length) return resultsBounds(focused);
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const name of areas) {
    const [lng, lat] = NEIGHBORHOOD_CENTROIDS[name];
    west = Math.min(west, lng); east = Math.max(east, lng);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  const pad = 0.008;
  return [[west - pad, south - pad], [east + pad, north + pad]];
}

/** Short pin label: `$4.8 M`, `$28 mil` (es-MX) / `$4,8 mi`, `$28 mil` (pt-BR). USD stays demonstrative. */
export function compactPrice(amount, currency = 'MXN', language = 'es-MX') {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  const value = currency === 'USD' ? amount / MXN_PER_USD : amount;
  const pt = language === 'pt-BR';
  const number = n => new Intl.NumberFormat(pt ? 'pt-BR' : 'es-MX', {maximumFractionDigits: n >= 10 ? 0 : 1}).format(n);
  const prefix = currency === 'USD' ? 'US$' : '$';
  if (value >= 1e6) return `${prefix}${number(value / 1e6)} ${pt ? 'mi' : 'M'}`;
  if (value >= 1e3) return `${prefix}${number(Math.round(value / 1e3))} mil`;
  return `${prefix}${number(Math.round(value))}`;
}
