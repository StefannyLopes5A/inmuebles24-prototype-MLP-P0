import {NEIGHBORHOOD_CENTROIDS} from './mapLocations.js';
import {boundsCenter, coloniaContains, featureBounds, placeFeature} from './coloniaPolygons.js';

/** Alcaldía of each catalog colonia. Used only to band the invented perception scores. */
export const ALCALDIA_BY_COLONIA = Object.freeze({
  'Ampliación Granada': 'Miguel Hidalgo',
  'Barrio Candelaria TicomAn': 'Gustavo A. Madero',
  'Bosques de las Lomas': 'Cuajimalpa de Morelos',
  'Campestre Churubusco': 'Coyoacán',
  'Ciudad de los Deportes': 'Benito Juárez',
  'Colonia Centro': 'Cuauhtémoc',
  'Crédito Constructor': 'Benito Juárez',
  'Cuauhtémoc': 'Cuauhtémoc',
  'Del Valle Centro': 'Benito Juárez',
  'Del Valle Norte': 'Benito Juárez',
  'Del Valle Sur': 'Benito Juárez',
  'El Yaqui': 'Cuajimalpa de Morelos',
  'Escandón II Sección': 'Miguel Hidalgo',
  'Granada': 'Miguel Hidalgo',
  'Granjas Palo Alto': 'Cuajimalpa de Morelos',
  'Hipódromo': 'Cuauhtémoc',
  'Jardines del Pedregal': 'Álvaro Obregón',
  'Juárez': 'Cuauhtémoc',
  'Lomas de Bezares': 'Miguel Hidalgo',
  'Lomas de Chapultepec': 'Miguel Hidalgo',
  'Lomas de Tarango': 'Álvaro Obregón',
  'Lomas de Vista Hermosa': 'Cuajimalpa de Morelos',
  'Lomas del Chamizal': 'Cuajimalpa de Morelos',
  'Narvarte Poniente': 'Benito Juárez',
  'Nápoles': 'Benito Juárez',
  'Olivar de los Padres': 'Álvaro Obregón',
  'Periodista': 'Miguel Hidalgo',
  'Polanco': 'Miguel Hidalgo',
  'Polanco II Sección': 'Miguel Hidalgo',
  'Polanco III Sección': 'Miguel Hidalgo',
  'Polanco IV Sección': 'Miguel Hidalgo',
  'Polanco V Sección': 'Miguel Hidalgo',
  'Portales Sur': 'Benito Juárez',
  'Roma Norte': 'Cuauhtémoc',
  'Roma Sur': 'Cuauhtémoc',
  'San José Insurgentes': 'Benito Juárez',
  'San Mateo Tlaltenango': 'Cuajimalpa de Morelos',
  'Santa Fe': 'Cuajimalpa de Morelos',
  'Santa Fe Centro': 'Cuajimalpa de Morelos',
  'Santa Fe Cuajimalpa': 'Cuajimalpa de Morelos',
  'Tabacalera': 'Cuauhtémoc',
  'Xoco': 'Coyoacán',
});

/** ENSU-inspired bands of perceived insecurity by alcaldía, rounded for the prototype. */
export const ALCALDIA_SAFETY = Object.freeze({
  'Benito Juárez': {feelSafe: 84, band: 'high', inseguridad: 16},
  'Cuajimalpa de Morelos': {feelSafe: 74, band: 'high', inseguridad: 26},
  'Miguel Hidalgo': {feelSafe: 58, band: 'mid', inseguridad: 42},
  'Coyoacán': {feelSafe: 56, band: 'mid', inseguridad: 44},
  'Álvaro Obregón': {feelSafe: 54, band: 'mid', inseguridad: 46},
  'Cuauhtémoc': {feelSafe: 50, band: 'mid', inseguridad: 50},
  'Gustavo A. Madero': {feelSafe: 32, band: 'low', inseguridad: 68},
});

const SOIL_RISK = new Set(['Colonia Centro', 'Tabacalera', 'Xoco', 'Juárez', 'Campestre Churubusco']);

function seed(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0;
}

function pick(list, n) {
  return list[n % list.length];
}

function sparkFrom(seed, direction) {
  const values = [];
  let y = 40 + (seed % 18);
  for (let i = 0; i < 12; i += 1) {
    const step = ((seed >>> (i + 3)) % 7) - (direction === 'down' ? 2 : direction === 'flat' ? 3 : 1);
    y = Math.max(12, Math.min(88, y + (direction === 'up' ? Math.abs(step) - 1 : direction === 'down' ? -Math.abs(step) + 1 : step - 2)));
    values.push(y);
  }
  return values;
}

function offsetFrom(center, index, extra, meters = 180 + (index % 5) * 90) {
  const [lng, lat] = center;
  const angle = ((index * 1.7) + extra * 0.01) % (Math.PI * 2);
  const dLat = meters * Math.sin(angle) / 111320;
  const dLng = meters * Math.cos(angle) / (111320 * Math.cos(lat * Math.PI / 180));
  return [Number((lng + dLng).toFixed(6)), Number((lat + dLat).toFixed(6))];
}

function offsetPoi(center, index, extra, name) {
  const candidate = offsetFrom(center, index, extra);
  if (!name || !placeFeature(name) || coloniaContains(name, candidate)) return candidate;
  const mid = boundsCenter(featureBounds(placeFeature(name))) || center;
  const closer = offsetFrom(mid, index, extra, 80);
  return coloniaContains(name, closer) ? closer : mid;
}

function loc(es, pt) {
  return {es, pt};
}

function generateVision(name) {
  const n = seed(name);
  const alcaldia = ALCALDIA_BY_COLONIA[name] || 'Cuauhtémoc';
  const base = ALCALDIA_SAFETY[alcaldia] || ALCALDIA_SAFETY.Cuauhtémoc;
  const feelSafe = Math.min(92, Math.max(28, base.feelSafe + (n % 11) - 5));
  const direction = n % 9 === 0 ? 'down' : n % 5 === 0 ? 'flat' : 'up';
  const medianPerM2 = 38_000 + (n % 55) * 800;
  const center = NEIGHBORHOOD_CENTROIDS[name] || [-99.17, 19.41];
  const metroMin = 4 + (n % 14);
  const parks = 2 + (n % 6);
  const schools = 4 + (n % 10);
  const cafes = 8 + (n % 28);
  const walk = 70 + (n % 22);
  const pet = 62 + (n % 28);
  const quiet = 40 + (n % 40);
  const reviews = 40 + (n % 160);
  const tropes = [
    [loc('el parque del barrio', 'o parque do bairro'), loc('el tráfico en las avenidas', 'o trânsito nas avenidas')],
    [loc('los cafés de la zona', 'os cafés da zona'), loc('el ruido nocturno', 'o ruído noturno')],
    [loc('la vida de barrio', 'a vida de bairro'), loc('pocos espacios verdes', 'poucos espaços verdes')],
    [loc('el metro cerca', 'o metrô perto'), loc('las obras en la avenida', 'as obras na avenida')],
  ];
  const tropesPick = pick(tropes, n);
  return {
    name,
    alcaldia,
    feelSafe,
    safetyBand: feelSafe >= 70 ? 'high' : feelSafe >= 48 ? 'mid' : 'low',
    soilRisk: SOIL_RISK.has(name),
    medianPerM2,
    neighborMedianPerM2: Math.round(medianPerM2 * (1.08 + (n % 7) / 100)),
    neighborName: name.includes('Del Valle') ? 'Narvarte Poniente' : name.includes('Narvarte') ? 'Del Valle Centro' : 'Roma Norte',
    offerLine: 8 + (n % 16),
    trend: {
      direction,
      spark: sparkFrom(n, direction),
      spoilerPct: Number(((direction === 'up' ? 2.4 : direction === 'down' ? -1.6 : 0.4) + (n % 21) / 10).toFixed(1)),
      forecast1: Number(((direction === 'down' ? -0.4 : 1.8) + (n % 13) / 10).toFixed(1)),
      forecast3: Number(((direction === 'down' ? -0.8 : 6.2) + (n % 17) / 10).toFixed(1)),
    },
    priceSpoiler: {
      fairPerM2: Math.round(medianPerM2 * 0.94),
      closeVsAsk: -0.04 - (n % 5) / 100,
      negotiate: [3, 7 + (n % 4)],
    },
    nearby: {
      metroMin,
      parks,
      schools,
      cafes,
      pois: [
        {id: `${name}-metro`, kind: 'transport', name: loc('Estación de Metro', 'Estação de metrô'), walk: metroMin, coordinates: offsetPoi(center, 0, n, name)},
        {id: `${name}-park`, kind: 'green', name: loc('Parque del barrio', 'Parque do bairro'), walk: 4 + (n % 8), coordinates: offsetPoi(center, 1, n, name)},
        {id: `${name}-school`, kind: 'education', name: loc('Escuela cercana', 'Escola próxima'), walk: 6 + (n % 7), coordinates: offsetPoi(center, 2, n, name)},
        {id: `${name}-cafe`, kind: 'food', name: loc('Café de la esquina', 'Café da esquina'), walk: 3 + (n % 5), coordinates: offsetPoi(center, 3, n, name)},
        {id: `${name}-clinic`, kind: 'health', name: loc('Clínica', 'Clínica'), walk: 8 + (n % 6), coordinates: offsetPoi(center, 4, n, name)},
      ],
    },
    neighbors: {
      reviews,
      walkable: walk,
      pet,
      quiet,
      sentiment: quiet < 55 ? 'positive-nuance' : 'positive',
      plus: [tropesPick[0], loc('el metro cerca', 'o metrô perto')],
      minus: [tropesPick[1], loc('el ruido en avenida', 'o ruído na avenida')],
      ideal: [loc('jóvenes profesionistas', 'jovens profissionais'), loc('parejas', 'casais')],
    },
    commute: {destination: loc('Polanco', 'Polanco'), minutes: 22 + (n % 24)},
    sources: loc('reseñas de vecinos, foros públicos, anuncios', 'avaliações de vizinhos, fóruns públicos, anúncios'),
    copy: {
      title: loc(`Así se vive en ${name}`, `Assim se vive em ${name}`),
      closed: [
        {text: loc('Valoran ', 'Valorizam ')},
        {text: tropesPick[0], widget: 'neighbors', poi: `${name}-park`},
        {text: loc(' y señalan ', ' e apontam ')},
        {text: tropesPick[1], widget: 'neighbors'},
        {text: loc(
          `. En ${alcaldia}, la percepción de seguridad queda ${feelSafe >= 70 ? 'por encima' : feelSafe >= 48 ? 'cerca' : 'por debajo'} del promedio de CDMX. Para tu presupuesto, `,
          `. Em ${alcaldia}, a percepção de segurança fica ${feelSafe >= 70 ? 'acima' : feelSafe >= 48 ? 'perto' : 'abaixo'} da média da CDMX. Para o seu orçamento, `,
        )},
        {text: loc('los precios de esta colonia', 'os preços desta colônia'), widget: 'price'},
        {text: loc('.', '.')},
      ],
    },
  };
}

const NARVARTE = {
  ...generateVision('Narvarte Poniente'),
  feelSafe: 86,
  safetyBand: 'high',
  medianPerM2: 62_400,
  neighborMedianPerM2: 71_800,
  neighborName: 'Del Valle Centro',
  offerLine: 22,
  trend: {
    direction: 'up',
    spark: [32, 34, 33, 38, 40, 42, 41, 46, 48, 52, 55, 61],
    spoilerPct: 4.8,
    forecast1: 3.2,
    forecast3: 9.1,
  },
  priceSpoiler: {fairPerM2: 58_900, closeVsAsk: -0.06, negotiate: [4, 8]},
  nearby: {
    metroMin: 6, parks: 4, schools: 9, cafes: 23,
    pois: [
      {id: 'narvarte-metro', kind: 'transport', name: loc('Metro Eugenia', 'Metrô Eugenia'), walk: 6, coordinates: [-99.1552, 19.3948]},
      {id: 'narvarte-park', kind: 'green', name: loc('Parque Ciudades Hermanas', 'Parque Ciudades Hermanas'), walk: 8, coordinates: [-99.1608, 19.3984]},
      {id: 'narvarte-market', kind: 'food', name: loc('Mercado de Narvarte', 'Mercado de Narvarte'), walk: 7, coordinates: [-99.1544, 19.3976]},
      {id: 'narvarte-school', kind: 'education', name: loc('Escuelas del barrio', 'Escolas do bairro'), walk: 9, coordinates: [-99.1596, 19.3932]},
      {id: 'narvarte-eje', kind: 'transport', name: loc('Eje Central', 'Eje Central'), walk: 11, coordinates: [-99.1518, 19.3955]},
    ],
  },
  neighbors: {
    reviews: 128, walkable: 92, pet: 88, quiet: 61, sentiment: 'positive-nuance',
    plus: [loc('Mercados', 'Mercados'), loc('Metro cerca', 'Metrô perto')],
    minus: [loc('Tráfico en Eje Central', 'Trânsito no Eje Central'), loc('Ruido', 'Ruído')],
    ideal: [loc('jóvenes profesionistas', 'jovens profissionais'), loc('parejas', 'casais')],
  },
  commute: {destination: loc('Polanco', 'Polanco'), minutes: 28},
  copy: {
    title: loc('Así se vive en Narvarte Poniente', 'Assim se vive em Narvarte Poniente'),
    closed: [
      {text: loc('Valoran ', 'Valorizam ')},
      {text: loc('la vida de barrio y lo caminable', 'a vida de bairro e o que dá para fazer a pé'), widget: 'neighbors', poi: 'narvarte-market'},
      {text: loc(' y señalan ', ' e apontam ')},
      {text: loc('el tráfico en las avenidas', 'o trânsito nas avenidas'), widget: 'neighbors', poi: 'narvarte-eje'},
      {text: loc('. En Benito Juárez, la percepción de seguridad queda por encima del promedio de CDMX. Para tu presupuesto, ', '. Em Benito Juárez, a percepção de segurança fica acima da média da CDMX. Para o seu orçamento, ')},
      {text: loc('los precios siguen por debajo de Del Valle', 'os preços seguem abaixo de Del Valle'), widget: 'price'},
      {text: loc('.', '.')},
    ],
  },
};

const DEL_VALLE = {
  ...generateVision('Del Valle Centro'),
  feelSafe: 88,
  safetyBand: 'high',
  medianPerM2: 71_800,
  neighborMedianPerM2: 62_400,
  neighborName: 'Narvarte Poniente',
  offerLine: 11,
  trend: {
    direction: 'up',
    spark: [28, 30, 31, 36, 37, 41, 44, 47, 49, 53, 58, 64],
    spoilerPct: 5.4,
    forecast1: 3.6,
    forecast3: 10.2,
  },
  priceSpoiler: {fairPerM2: 67_200, closeVsAsk: -0.05, negotiate: [3, 7]},
  nearby: {
    metroMin: 8, parks: 5, schools: 12, cafes: 31,
    pois: [
      {id: 'delvalle-metro', kind: 'transport', name: loc('Metro Etiopía', 'Metrô Etiopía'), walk: 8, coordinates: [-99.1652, 19.3798]},
      {id: 'delvalle-park', kind: 'green', name: loc('Parque Hundido', 'Parque Hundido'), walk: 10, coordinates: [-99.1724, 19.3842]},
      {id: 'delvalle-cafe', kind: 'food', name: loc('Cafés de Amores', 'Cafés de Amores'), walk: 4, coordinates: [-99.1668, 19.3866]},
      {id: 'delvalle-school', kind: 'education', name: loc('Colegios del valle', 'Colégios do vale'), walk: 7, coordinates: [-99.1695, 19.3814]},
    ],
  },
  neighbors: {
    reviews: 164, walkable: 89, pet: 81, quiet: 72, sentiment: 'positive',
    plus: [loc('Parques', 'Parques'), loc('Comercios', 'Comércios')],
    minus: [loc('Precios más altos', 'Preços mais altos'), loc('Tráfico en Insurgentes', 'Trânsito na Insurgentes')],
    ideal: [loc('familias', 'famílias'), loc('parejas', 'casais')],
  },
  copy: {
    title: loc('Así se vive en Del Valle Centro', 'Assim se vive em Del Valle Centro'),
    closed: [
      {text: loc('Es una colonia consolidada: valoran ', 'É uma colônia consolidada: valorizam ')},
      {text: loc('los parques y la vida de barrio', 'os parques e a vida de bairro'), widget: 'neighbors', poi: 'delvalle-park'},
      {text: loc(', y señalan ', ', e apontam ')},
      {text: loc('el tráfico en Insurgentes', 'o trânsito na Insurgentes'), widget: 'neighbors'},
      {text: loc('. Para tu presupuesto, ', '. Para o seu orçamento, ')},
      {text: loc('sale más cara que Narvarte', 'sai mais cara que Narvarte'), widget: 'price'},
      {text: loc('.', '.')},
    ],
  },
};

const OVERRIDES = {
  'Narvarte Poniente': NARVARTE,
  'Del Valle Centro': DEL_VALLE,
};

const CACHE = new Map();

export function coloniaVision(name) {
  if (!name || !NEIGHBORHOOD_CENTROIDS[name]) return null;
  if (CACHE.has(name)) return CACHE.get(name);
  const vision = OVERRIDES[name] || generateVision(name);
  CACHE.set(name, vision);
  return vision;
}

export function allColoniaNames() {
  return Object.keys(NEIGHBORHOOD_CENTROIDS);
}

export function textOf(value, language) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return language === 'pt-BR' ? value.pt : value.es;
}
