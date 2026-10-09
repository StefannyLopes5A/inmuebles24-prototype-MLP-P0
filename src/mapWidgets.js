import {listingPrice} from './data.js';
import {homeCoordinates, NEIGHBORHOOD_CENTROIDS} from './mapLocations.js';
import {ALCALDIA_BY_COLONIA, ALCALDIA_SAFETY, allColoniaNames, coloniaVision, textOf} from './mapWidgetContent.js';
import {pickColonia, placeFeature, placeNivel} from './coloniaPolygons.js';

export {pickColonia};

const CDMX_FEEL_SAFE = 52;
const CDMX_MEDIAN_M2 = 58_900;
const CITY_TREND_SPARK = [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47];
const NARVARTE_CITY_FIT = [
  {name: 'Narvarte Poniente', count: 22},
  {name: 'Del Valle Sur', count: 15},
  {name: 'Portales Sur', count: 11},
];

export const CITY_ZOOM = 12.15;
export const COLONIA_ZOOM = 12.45;
export const SETTLE_MS = 600;
export const WALK_HIGHLIGHT_M = 800;

const FAMILY_NOTE = /escuel|escol|hij[oa]|filh[oa]|familia|família|niñ|crianc/i;
const COMMUTE_NOTE = /trabajo|trabalho|oficina|destino|polanco|santa fe|reform/i;

export function resolveLevel({zoom, selectedId, previous = 'colonia'}) {
  if (selectedId) return 'home';
  if (previous === 'city') return zoom >= COLONIA_ZOOM ? 'colonia' : 'city';
  return zoom < CITY_ZOOM ? 'city' : 'colonia';
}

function distance(a, b) {
  const [lng1, lat1] = a, [lng2, lat2] = b;
  const dLat = (lat1 - lat2) * 111320;
  const dLng = (lng1 - lng2) * 111320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

export function nearestColonia(center) {
  let best = null, bestDistance = Infinity;
  for (const [name, point] of Object.entries(NEIGHBORHOOD_CENTROIDS)) {
    const next = distance(center, point);
    if (next < bestDistance) {best = name; bestDistance = next;}
  }
  return {name: best, distance: bestDistance};
}

export function placeMatchesSearch(name, search) {
  const areas = search?.areas || [];
  if (!areas.length) return true;
  if (areas.includes(name)) return true;
  return areas.some(area => placeNivel(area) === 'alcaldia' && ALCALDIA_BY_COLONIA[name] === area);
}

export function adaptiveSlot({search, vision, session = {}, level}) {
  if (level !== 'colonia' || !vision) return {primary: 'nearby', mentions: ['safety']};
  const note = search?.note || '';
  const ranked = [];
  if (COMMUTE_NOTE.test(note)) ranked.push('commute');
  if ((search?.beds || 0) >= 3 || FAMILY_NOTE.test(note)) ranked.push('neighbors');
  if (vision.soilRisk) ranked.push('soil');
  if (session.sawPoi) ranked.push('neighbors');
  ranked.push('nearby');
  const unique = [...new Set(ranked)];
  const primary = unique[0];
  const mentions = unique.slice(1, 3);
  if (!mentions.includes('safety')) mentions.push('safety');
  return {primary, mentions: mentions.filter(id => id !== primary).slice(0, 2)};
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function catalogStats(homes, colonia, search) {
  const inColonia = (homes || []).filter(home => home.area === colonia);
  const matching = inColonia.filter(home => {
    const price = listingPrice(home);
    return price <= (search?.budget || Infinity) && home.beds >= (search?.beds || 0);
  });
  const perM2 = inColonia
    .filter(home => home.size >= 20 && listingPrice(home) > 0)
    .map(home => listingPrice(home) / home.size);
  return {
    matching: matching.length,
    medianPerM2: perM2.length >= 10 ? median(perM2) : null,
  };
}

export function homePosition(home, vision) {
  if (!home || home.size < 20 || !vision?.medianPerM2) return null;
  const value = listingPrice(home) / home.size;
  const delta = (value - vision.medianPerM2) / vision.medianPerM2;
  if (delta < -0.08) return 'below';
  if (delta > 0.08) return 'above';
  return 'median';
}

export function spoilerFor(widgetId, colonia) {
  const vision = coloniaVision(colonia);
  if (!vision) return null;
  if (widgetId === 'price' || widgetId === 'vs-colonia') return {...vision.priceSpoiler};
  if (widgetId === 'trend') {
    return {pct: vision.trend.spoilerPct, forecast1: vision.trend.forecast1, forecast3: vision.trend.forecast3};
  }
  return null;
}

function publicVision(vision) {
  if (!vision) return vision;
  const {priceSpoiler, trend, ...rest} = vision;
  return {...rest, trend: {direction: trend.direction, spark: trend.spark}};
}

function publicWidget(widget) {
  const copy = {...widget};
  delete copy.spoiler;
  return copy;
}

function langOf(language) {
  return language === 'pt-BR' ? 'pt-BR' : 'es-MX';
}

function moneyM2(value, language) {
  const formatted = new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX', {maximumFractionDigits: 0}).format(value);
  return `$${formatted}`;
}

function budgetLabel(search, language) {
  const budget = search?.budget || 7_500_000;
  if (search?.mode === 'rent') {
    return new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX', {style: 'currency', currency: 'MXN', maximumFractionDigits: 0}).format(budget);
  }
  const millions = budget / 1e6;
  const number = new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX', {maximumFractionDigits: millions >= 10 ? 0 : 1}).format(millions);
  return language === 'pt-BR' ? `$${number} mi` : `$${number} M`;
}

export function matchingColonias(search, homes = [], limit = 3) {
  const preferred = search?.areas?.filter(name => NEIGHBORHOOD_CENTROIDS[name] || placeNivel(name) === 'alcaldia') || [];
  if (preferred.includes('Narvarte Poniente')) {
    return NARVARTE_CITY_FIT.slice(0, limit).map(item => ({
      ...item,
      vision: coloniaVision(item.name),
      centroid: NEIGHBORHOOD_CENTROIDS[item.name],
    }));
  }
  const budget = search?.budget || Infinity;
  const beds = search?.beds || 0;
  const counted = new Map();
  for (const home of homes || []) {
    if (search?.mode && home.mode !== search.mode) continue;
    if (home.beds < beds) continue;
    if (listingPrice(home) > budget) continue;
    counted.set(home.area, (counted.get(home.area) || 0) + 1);
  }
  const alcaldia = placeNivel(preferred[0]) === 'alcaldia' ? preferred[0] : ALCALDIA_BY_COLONIA[preferred[0]];
  const ranked = allColoniaNames().map(name => {
    const vision = coloniaVision(name);
    return {
      name,
      count: counted.get(name) || vision.offerLine,
      vision,
      centroid: NEIGHBORHOOD_CENTROIDS[name],
    };
  }).sort((a, b) => {
    const aPref = preferred.includes(a.name) ? 1 : 0;
    const bPref = preferred.includes(b.name) ? 1 : 0;
    const aAlk = alcaldia && ALCALDIA_BY_COLONIA[a.name] === alcaldia ? 1 : 0;
    const bAlk = alcaldia && ALCALDIA_BY_COLONIA[b.name] === alcaldia ? 1 : 0;
    return bPref - aPref || bAlk - aAlk || b.count - a.count || a.name.localeCompare(b.name, 'es');
  });
  return ranked.slice(0, limit);
}

function regionOf(points, language) {
  if (!points.length) return language === 'pt-BR' ? 'centro' : 'centro';
  const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  if (lat < 19.40) return language === 'pt-BR' ? 'sul' : 'sur';
  if (lat > 19.43) return 'norte';
  if (lng < -99.19) return language === 'pt-BR' ? 'oeste' : 'poniente';
  return 'centro';
}

export function cityReading({search, homes = [], language = 'es-MX'}) {
  const items = matchingColonias(search, homes, 3);
  const lead = items[0];
  const alcaldia = lead?.vision.alcaldia || 'Benito Juárez';
  const region = regionOf(items.map(item => item.centroid).filter(Boolean), language);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const focused = search?.areas?.[0];
  const focusedItem = items.find(item => item.name === focused);
  const medianPerM2 = focusedItem?.vision.medianPerM2 || lead?.vision.medianPerM2 || 62_400;
  const alcaldiaFeel = ALCALDIA_SAFETY[alcaldia]?.feelSafe || CDMX_FEEL_SAFE;
  const trendUp = items.filter(item => item.vision.trend.direction === 'up').length >= Math.ceil(items.length / 2);
  const place = language === 'pt-BR'
    ? `no ${region} de ${alcaldia}`
    : `en el ${region} de ${alcaldia}`;
  return {items, lead, alcaldia, region, place, total, medianPerM2, alcaldiaFeel, cityFeel: CDMX_FEEL_SAFE, trendUp};
}

function summaryWidget({place, vision, copy, mentions, language, stats, offerCount}) {
  const pt = language === 'pt-BR';
  const neighbors = vision.neighbors || {};
  const count = offerCount ?? vision.offerLine ?? stats?.matching;
  const tags = [];
  if (count) tags.push({id: 'offer', label: pt ? `${count} aptos.` : `${count} deptos`});
  if (vision.trend?.direction === 'up') tags.push({id: 'rise', label: pt ? 'Zona em alta' : 'Zona en alza', tone: 'up'});
  return {
    id: 'summary',
    kind: 'summary',
    place,
    title: textOf(copy.title, language),
    segments: copy.closed.map(segment => ({
      text: textOf(segment.text, language),
      widget: segment.widget,
      poi: segment.poi,
    })),
    mentions,
    reviews: neighbors.reviews,
    more: pt ? 'Ver mais' : 'Ver más',
    bars: [
      {id: 'pet', label: 'Pet-friendly', value: neighbors.pet, detail: `${neighbors.pet}%`},
      {id: 'exercise', label: pt ? 'Bom para exercício' : 'Bueno para ejercitarse', value: neighbors.walkable, detail: `${neighbors.walkable}%`},
      {id: 'light', label: pt ? 'Ruas bem iluminadas' : 'Calles bien iluminadas', value: neighbors.quiet, detail: `${neighbors.quiet}%`},
      {id: 'safe', label: pt ? 'Percebido como seguro' : 'Se percibe seguro', value: vision.feelSafe, detail: `${vision.feelSafe}%`},
    ].filter(row => row.value != null),
    tags,
    feelSafe: vision.feelSafe,
    mora: true,
  };
}

function priceWidget({vision, search, stats, language, highlightLogin, scope = 'colonia', medianPerM2}) {
  const pt = language === 'pt-BR';
  const value = medianPerM2 || vision.medianPerM2;
  const count = vision.offerLine || stats?.matching;
  const beds = search?.beds || 2;
  const title = scope === 'city'
    ? (pt ? 'Preço nestas colônias' : 'Precio en estas colonias')
    : (pt ? `Preço em ${vision.name}` : `Precio en ${vision.name}`);
  return publicWidget({
    id: 'price',
    kind: 'price',
    layer: 'price',
    title,
    headline: moneyM2(value, language),
    unit: 'MXN/m² mediana',
    support: scope === 'city' ? null : (pt
      ? `Com ${budgetLabel(search, language)} há ${count} apts. de ${beds} quartos aqui`
      : `Con ${budgetLabel(search, language)} hay ${count} deptos de ${beds} rec. aquí`),
    compare: scope === 'city'
      ? matchingColonias(search, undefined, 3).map(item => ({label: item.name, value: item.vision.medianPerM2}))
      : [
          {label: vision.name, value: vision.medianPerM2},
          {label: vision.neighborName, value: vision.neighborMedianPerM2},
          {label: 'CDMX', value: CDMX_MEDIAN_M2},
        ].filter(row => row.value),
    teaser: pt ? 'Preço justo e de fechamento' : 'Precio justo y de cierre',
    highlightLogin,
  });
}

function trendWidget({vision, language, scope = 'colonia'}) {
  const pt = language === 'pt-BR';
  const label = vision.trend.direction === 'up' ? (pt ? 'Sobe' : 'Sube')
    : vision.trend.direction === 'down' ? (pt ? 'Desce' : 'Baja')
    : (pt ? 'Estável' : 'Estable');
  return publicWidget({
    id: 'trend',
    kind: 'trend',
    layer: 'trend',
    title: pt ? 'Tendência de valorização' : 'Tendencia de plusvalía',
    kicker: pt ? '12 meses' : '12 meses',
    headline: label,
    support: vision.trend.direction === 'up'
      ? (pt ? 'mais que a média da CDMX' : 'más que el promedio de CDMX')
      : vision.trend.direction === 'down'
        ? (pt ? 'abaixo da média da CDMX' : 'por debajo del promedio de CDMX')
        : (pt ? 'no ritmo da CDMX' : 'al ritmo de CDMX'),
    spark: vision.trend.spark,
    citySpark: scope === 'city' || scope === 'colonia' ? CITY_TREND_SPARK : null,
    direction: vision.trend.direction,
    teaser: pt ? '% exato e prognóstico' : '% exacto y pronóstico',
  });
}

function nearbyWidget({vision, language, id = 'nearby'}) {
  const pt = language === 'pt-BR';
  const nearby = vision.nearby;
  const poiOf = kind => nearby.pois.find(poi => poi.kind === kind);
  const supportOf = kind => {
    const poi = poiOf(kind);
    if (!poi) return null;
    const name = textOf(poi.name, language);
    return kind === 'transport' || poi.walk == null ? name : `${name} · ${poi.walk} min`;
  };
  return {
    id,
    kind: 'nearby',
    title: pt ? 'Perto de você' : 'Cerca de ti',
    kicker: pt ? 'a pé' : 'a pie',
    tiles: [
      {
        kind: 'transport',
        label: pt ? 'Metrô' : 'Metro',
        metric: `${nearby.metroMin}'`,
        headline: pt ? `Metrô a ${nearby.metroMin} min` : `Metro a ${nearby.metroMin} min`,
        support: supportOf('transport'),
        poi: poiOf('transport')?.id,
      },
      {
        kind: 'green',
        label: pt ? 'Parques' : 'Parques',
        metric: String(nearby.parks),
        headline: pt ? `${nearby.parks} parques` : `${nearby.parks} parques`,
        support: supportOf('green'),
        poi: poiOf('green')?.id,
      },
      {
        kind: 'education',
        label: pt ? 'Escolas' : 'Escuelas',
        metric: String(nearby.schools),
        headline: pt ? `${nearby.schools} escolas` : `${nearby.schools} escuelas`,
        support: supportOf('education'),
        poi: poiOf('education')?.id,
      },
      {
        kind: 'food',
        label: pt ? 'Cafés' : 'Cafés',
        metric: String(nearby.cafes),
        headline: `${nearby.cafes} cafés`,
        support: supportOf('food'),
        poi: poiOf('food')?.id,
      },
    ],
  };
}

function neighborsWidget({vision, language}) {
  const pt = language === 'pt-BR';
  return {
    id: 'neighbors',
    kind: 'neighbors',
    title: pt ? 'O que dizem os vizinhos' : 'Lo que dicen los vecinos',
    support: pt ? `${vision.neighbors.reviews} avaliações` : `${vision.neighbors.reviews} reseñas`,
    bars: [
      {id: 'walkable', label: pt ? 'Caminhável' : 'Caminable', value: vision.neighbors.walkable, detail: `${vision.neighbors.walkable}%`},
      {id: 'pet', label: 'Pet-friendly', value: vision.neighbors.pet, detail: `${vision.neighbors.pet}%`},
      {id: 'quiet', label: pt ? 'Tranquilo à noite' : 'Tranquilo de noche', value: vision.neighbors.quiet, detail: `${vision.neighbors.quiet}%`},
    ],
  };
}

function commuteWidget({vision, language, id = 'commute'}) {
  const pt = language === 'pt-BR';
  return {
    id,
    kind: 'commute',
    layer: 'commute',
    title: pt ? 'Deslocamentos' : 'Traslados',
    headline: `${vision.commute.minutes} min`,
    unit: pt
      ? `até ${textOf(vision.commute.destination, language)}`
      : `hasta ${textOf(vision.commute.destination, language)}`,
    track: {position: Math.min(88, Math.round((vision.commute.minutes / 60) * 100)), label: `${vision.commute.minutes} min`},
    rings: [15, 30, 45],
  };
}

function soilWidget({vision, language}) {
  const pt = language === 'pt-BR';
  return {
    id: 'soil',
    kind: 'soil',
    layer: 'soil',
    title: pt ? 'Risco do solo' : 'Riesgo del suelo',
    headline: pt ? 'Zona lacustre' : 'Zona lacustre',
    bars: [
      {id: 'firm', label: pt ? 'Firme' : 'Firme', value: 28},
      {id: 'transition', label: pt ? 'Transição' : 'Transición', value: 46},
      {id: 'lake', label: pt ? 'Lacustre' : 'Lacustre', value: 78},
    ],
    support: pt
      ? `Leitura de ${vision.alcaldia}. Confirme com um especialista.`
      : `Lectura de ${vision.alcaldia}. Confirma con un especialista.`,
  };
}

function matchingWidget({search, homes, language}) {
  const pt = language === 'pt-BR';
  const items = matchingColonias(search, homes, 3);
  const max = Math.max(...items.map(item => item.count), 1);
  return {
    id: 'matching',
    kind: 'matching',
    title: pt ? 'Colônias que encaixam' : 'Colonias que encajan',
    kicker: pt ? 'aptos.' : 'deptos',
    hint: pt ? 'Toque uma colônia para vê-la no mapa' : 'Toca una colonia para verla en el mapa',
    items: items.map(item => ({
      name: item.name,
      count: item.count,
      share: Math.round((item.count / max) * 100),
      price: moneyM2(item.vision.medianPerM2, language),
    })),
  };
}

function vsColoniaWidget({home, vision, language, highlightLogin}) {
  const pt = language === 'pt-BR';
  const position = homePosition(home, vision);
  const listing = listingPrice(home) / Math.max(20, home.size);
  const median = vision.medianPerM2;
  const span = median * 0.4;
  const homeAt = Math.round(Math.min(88, Math.max(12, ((listing - (median - span)) / (span * 2)) * 100)));
  const label = position === 'below' ? (pt ? 'Abaixo da mediana' : 'Abajo de la mediana')
    : position === 'above' ? (pt ? 'Acima da mediana' : 'Arriba de la mediana')
    : (pt ? 'Na mediana da colônia' : 'En la mediana de la colonia');
  return publicWidget({
    id: 'vs-colonia',
    kind: 'price',
    title: pt ? 'Este apto vs. a colônia' : 'Este depto vs. la colonia',
    headline: moneyM2(Math.round(listing), language),
    unit: 'MXN/m²',
    support: label,
    track: {position: homeAt, label: pt ? 'Este anúncio' : 'Este anuncio', median: 50, medianLabel: pt ? 'Mediana' : 'Mediana'},
    teaser: pt ? 'Preço justo deste anúncio' : 'Precio justo de este anuncio',
    highlightLogin,
  });
}

const DEEP_WIDGETS = {
  nearby: nearbyWidget,
  neighbors: neighborsWidget,
  commute: commuteWidget,
  soil: soilWidget,
};

export function panelContent({widgetId, vision, search, language, home}) {
  const lang = langOf(language);
  const sources = textOf(vision.sources, lang);
  if (widgetId === 'summary' || widgetId === 'neighbors') {
    return {
      title: textOf(vision.copy.title, lang),
      segments: vision.copy.closed.map(segment => ({
        text: textOf(segment.text, lang),
        widget: segment.widget,
        poi: segment.poi,
      })),
      components: [
        {id: 'bars', type: 'bars', bars: [
          {label: lang === 'pt-BR' ? 'Caminhável' : 'Caminable', value: vision.neighbors.walkable},
          {label: 'Pet-friendly', value: vision.neighbors.pet},
          {label: lang === 'pt-BR' ? 'Tranquilo à noite' : 'Tranquilo de noche', value: vision.neighbors.quiet},
        ], reviews: vision.neighbors.reviews, binds: 'neighbors'},
        {id: 'chips', type: 'chips', plus: vision.neighbors.plus.map(item => textOf(item, lang)), minus: vision.neighbors.minus.map(item => textOf(item, lang)), binds: 'neighbors'},
        {id: 'price-compare', type: 'compare', rows: [
          {label: vision.name, value: moneyM2(vision.medianPerM2, lang)},
          {label: vision.neighborName, value: moneyM2(vision.neighborMedianPerM2, lang)},
        ], spoiler: true, binds: 'price'},
      ],
      sources,
      ask: lang === 'pt-BR'
        ? `Como é a vida em ${vision.name}?`
        : `¿Cómo es la vida en ${vision.name}?`,
    };
  }
  if (widgetId === 'price' || widgetId === 'vs-colonia') {
    return {
      title: lang === 'pt-BR' ? `Preço em ${vision.name}` : `Precio en ${vision.name}`,
      segments: [
        {text: lang === 'pt-BR' ? 'A mediana pedida nesta colônia fica em ' : 'La mediana pedida en esta colonia queda en '},
        {text: `${moneyM2(vision.medianPerM2, lang)} / m²`, widget: 'price'},
        {text: lang === 'pt-BR' ? `, abaixo de ${vision.neighborName} para o mesmo recorte.` : `, por debajo de ${vision.neighborName} para el mismo recorte.`},
      ],
      components: [
        {id: 'price-compare', type: 'compare', rows: [
          {label: vision.name, value: moneyM2(vision.medianPerM2, lang)},
          {label: vision.neighborName, value: moneyM2(vision.neighborMedianPerM2, lang)},
        ], spoiler: true, binds: 'price'},
      ],
      sources,
      ask: lang === 'pt-BR' ? `Esse preço em ${vision.name} é justo?` : `¿Es justo el precio en ${vision.name}?`,
    };
  }
  if (widgetId === 'trend') {
    return {
      title: lang === 'pt-BR' ? 'Valorização da zona' : 'Plusvalía de la zona',
      segments: [
        {text: lang === 'pt-BR' ? 'A leitura dos últimos 12 meses ' : 'La lectura de los últimos 12 meses '},
        {text: vision.trend.direction === 'up' ? (lang === 'pt-BR' ? 'sobe' : 'sube') : vision.trend.direction === 'down' ? (lang === 'pt-BR' ? 'desce' : 'baja') : (lang === 'pt-BR' ? 'se mantém estável' : 'se mantiene estable'), widget: 'trend'},
        {text: lang === 'pt-BR' ? '. É uma estimativa do protótipo, não uma promessa de retorno.' : '. Es una estimación del prototipo, no una promesa de retorno.'},
      ],
      components: [{id: 'spark', type: 'spark', spark: vision.trend.spark, direction: vision.trend.direction, binds: 'trend'}],
      sources,
      ask: lang === 'pt-BR' ? `Essa zona está valorizando?` : `¿Esta zona se está valorizando?`,
    };
  }
  if (widgetId === 'nearby') {
    return {
      title: lang === 'pt-BR' ? `Perto em ${vision.name}` : `Cerca en ${vision.name}`,
      segments: [
        {text: lang === 'pt-BR' ? 'A pé, o mais útil desta busca é o ' : 'A pie, lo más útil de esta búsqueda es el '},
        {text: lang === 'pt-BR' ? `metrô a ${vision.nearby.metroMin} min` : `metro a ${vision.nearby.metroMin} min`, widget: 'nearby', poi: vision.nearby.pois[0]?.id},
        {text: lang === 'pt-BR' ? ' e os parques do bairro.' : ' y los parques del barrio.'},
      ],
      components: [{id: 'places', type: 'places', places: vision.nearby.pois.map(poi => ({id: poi.id, kind: poi.kind, name: textOf(poi.name, lang), walk: poi.walk})), binds: 'nearby'}],
      sources,
      ask: lang === 'pt-BR' ? `O que tem perto em ${vision.name}?` : `¿Qué hay cerca en ${vision.name}?`,
    };
  }
  if (widgetId === 'safety') {
    return {
      title: lang === 'pt-BR' ? 'Percepção de segurança' : 'Percepción de seguridad',
      segments: [
        {text: lang === 'pt-BR'
          ? `Se sente seguro segundo ${vision.feelSafe}% de vizinhos nesta visão. Não é incidência oficial; a ENSU do INEGI mede alcaldías, não colônias.`
          : `Se siente seguro según el ${vision.feelSafe}% de vecinos en esta visión. No es incidencia oficial; la ENSU del INEGI mide alcaldías, no colonias.`},
      ],
      components: [{id: 'safety-bar', type: 'bars', bars: [{label: lang === 'pt-BR' ? 'Se sente seguro' : 'Se siente seguro', value: vision.feelSafe}], reviews: vision.neighbors.reviews, binds: 'safety'}],
      sources: lang === 'pt-BR'
        ? 'Visão do protótipo, inspirada na ENSU (INEGI) por alcaldía'
        : 'Visión del prototipo, inspirada en la ENSU (INEGI) por alcaldía',
      ask: lang === 'pt-BR' ? `Como se sente a segurança em ${vision.name}?` : `¿Cómo se siente la seguridad en ${vision.name}?`,
    };
  }
  if (widgetId === 'commute') {
    return {
      title: lang === 'pt-BR' ? 'Deslocamentos' : 'Traslados',
      segments: [
        {text: lang === 'pt-BR'
          ? `O anel ilustrativo de ${vision.commute.minutes} min chega a ${textOf(vision.commute.destination, lang)}. Não é uma rota calculada.`
          : `El anillo ilustrativo de ${vision.commute.minutes} min llega a ${textOf(vision.commute.destination, lang)}. No es una ruta calculada.`},
      ],
      components: [{id: 'rings', type: 'chips', plus: ['15 min', '30 min', '45 min'], minus: [], binds: 'commute'}],
      sources,
      ask: lang === 'pt-BR'
        ? `Quanto tempo até ${textOf(vision.commute.destination, lang)} desde ${vision.name}?`
        : `¿Cuánto tardo a ${textOf(vision.commute.destination, lang)} desde ${vision.name}?`,
    };
  }
  if (widgetId === 'matching') {
    const items = matchingColonias(search);
    return {
      title: lang === 'pt-BR' ? 'Colônias que encaixam' : 'Colonias que encajan',
      segments: [{text: lang === 'pt-BR' ? 'Estas colônias concentram a oferta da busca. Tocar uma aproxima o mapa.' : 'Estas colonias concentran la oferta de tu búsqueda. Tocar una acerca el mapa.'}],
      components: [{id: 'list', type: 'places', places: items.map(item => ({id: item.name, kind: 'transport', name: `${item.name} · ${item.count}`, walk: null})), binds: 'matching'}],
      sources,
      ask: lang === 'pt-BR' ? 'Quais colônias cabem na minha busca?' : '¿Qué colonias encajan con mi búsqueda?',
    };
  }
  if (widgetId === 'soil') {
    return {
      title: lang === 'pt-BR' ? 'Risco do solo' : 'Riesgo del suelo',
      segments: [{text: lang === 'pt-BR'
        ? 'Esta leitura marca zona lacustre. É uma visão do protótipo para conversar, não um laudo.'
        : 'Esta lectura marca zona lacustre. Es una visión del prototipo para conversar, no un dictamen.'}],
      components: [],
      sources,
      ask: lang === 'pt-BR' ? `É seguro construir em ${vision.name}?` : `¿Es seguro construir en ${vision.name}?`,
    };
  }
  return panelContent({widgetId: 'summary', vision, search, language, home});
}

export function buildStack({level, colonia, search, home, language = 'es-MX', session = {}}) {
  const lang = langOf(language);
  const highlightLogin = session.loginHighlight !== false;
  if (level === 'city' || placeNivel(colonia) === 'alcaldia') {
    const reading = cityReading({search, homes: session.homes, language: lang});
    const vision = reading.lead?.vision || coloniaVision(colonia) || coloniaVision('Narvarte Poniente');
    const stats = catalogStats(session.homes, vision.name, search);
    const beds = search?.beds || 2;
    const context = lang === 'pt-BR' ? 'Sua busca na CDMX' : 'Tu búsqueda en CDMX';
    const widgets = [
      summaryWidget({
        place: context,
        vision,
        copy: {
          title: {es: `Lo que buscas está ${reading.place}`, pt: `O que você busca está ${reading.place}`},
          closed: citySegments(reading, beds, lang),
        },
        mentions: ['matching', 'price', 'trend'],
        language: lang,
        offerCount: reading.total,
      }),
      matchingWidget({search, homes: session.homes, language: lang}),
      priceWidget({vision, search, stats, language: lang, highlightLogin, scope: 'city', medianPerM2: reading.medianPerM2}),
      trendWidget({vision, language: lang, scope: 'city'}),
    ];
    return {level: 'city', place: context, colonia: vision.name, vision: publicVision(vision), widgets, search, reading};
  }
  const vision = coloniaVision(colonia) || coloniaVision('Narvarte Poniente');
  const stats = catalogStats(session.homes, colonia, search);
  if (level === 'home' && home) {
    const widgets = [
      summaryWidget({
        place: home.area,
        vision,
        copy: {
          title: {es: `Este inmueble en ${home.area}`, pt: `Este imóvel em ${home.area}`},
          closed: homeSegments(home, vision, lang),
        },
        mentions: ['vs-colonia', 'nearby', 'commute'],
        language: lang,
        stats,
      }),
      vsColoniaWidget({home, vision, language: lang, highlightLogin}),
      nearbyWidget({vision, language: lang}),
      commuteWidget({vision, language: lang}),
    ];
    return {level, place: home.area, colonia: home.area, vision: publicVision(vision), widgets, homeId: home.id, search, home};
  }
  const slot = adaptiveSlot({search, vision, session, level: 'colonia'});
  const deep = DEEP_WIDGETS[slot.primary] || nearbyWidget;
  const widgets = [
    summaryWidget({place: vision.name, vision, copy: vision.copy, mentions: slot.mentions, language: lang, stats}),
    priceWidget({vision, search, stats, language: lang, highlightLogin, scope: 'colonia'}),
    trendWidget({vision, language: lang, scope: 'colonia'}),
    deep({vision, language: lang}),
  ];
  return {level: 'colonia', place: vision.name, colonia: vision.name, vision: publicVision(vision), widgets, mentions: slot.mentions, adaptive: slot.primary, search};
}

function citySegments(reading, beds, language) {
  const count = reading.items.length;
  const pt = language === 'pt-BR';
  return [
    {text: pt ? `${count} colônias` : `${count} colonias`, widget: 'matching'},
    {text: pt
      ? ` concentram a oferta de ${beds} quartos dentro do seu orçamento.`
      : ` concentran la oferta de ${beds} rec. dentro de tu presupuesto.`},
  ];
}

function homeSegments(home, vision, language) {
  const position = homePosition(home, vision);
  const phrase = position === 'below'
    ? (language === 'pt-BR' ? 'está abaixo da mediana da colônia' : 'está debajo de la mediana de la colonia')
    : position === 'above'
      ? (language === 'pt-BR' ? 'está acima da mediana da colônia' : 'está por encima de la mediana de la colonia')
      : (language === 'pt-BR' ? 'cai perto da mediana da colônia' : 'cae cerca de la mediana de la colonia');
  return [
    {text: language === 'pt-BR' ? 'Neste recorte, o anúncio ' : 'En este recorte, el anuncio '},
    {text: phrase, widget: 'vs-colonia'},
    {text: language === 'pt-BR' ? '. Perto daqui, ' : '. Cerca de aquí, '},
    {text: language === 'pt-BR' ? `o metrô fica a ${vision.nearby.metroMin} min a pé` : `el metro queda a ${vision.nearby.metroMin} min a pie`, widget: 'nearby', poi: vision.nearby.pois[0]?.id},
    {text: '.'},
  ];
}

export function circlePolygon(center, radiusMeters, steps = 64) {
  const [lng, lat] = center;
  const coordinates = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const dLat = (radiusMeters * Math.sin(angle)) / 111320;
    const dLng = (radiusMeters * Math.cos(angle)) / (111320 * Math.cos(lat * Math.PI / 180));
    coordinates.push([lng + dLng, lat + dLat]);
  }
  return {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [coordinates]}};
}

function heatFill(metric, vision) {
  if (metric === 'safety') return vision.safetyBand === 'high' ? '#b7d4c2' : vision.safetyBand === 'low' ? '#e0c0b6' : '#e2d4a8';
  if (metric === 'trend') return vision.trend.direction === 'up' ? '#8fbf88' : vision.trend.direction === 'down' ? '#d4a09a' : '#c8c4b8';
  if (vision.medianPerM2 < 50_000) return '#d7e3d0';
  if (vision.medianPerM2 < 70_000) return '#c4b48a';
  return '#c9a07a';
}

export function choroplethFeatures(metric = 'price') {
  return allColoniaNames().flatMap(name => {
    const outline = placeFeature(name);
    if (!outline) return [];
    const vision = coloniaVision(name);
    const value = metric === 'safety' ? vision.feelSafe
      : metric === 'trend' ? (vision.trend.direction === 'up' ? 1 : vision.trend.direction === 'down' ? -1 : 0)
      : vision.medianPerM2;
    return [{
      type: 'Feature',
      geometry: outline.geometry,
      properties: {name, value, band: vision.safetyBand, fill: heatFill(metric, vision), alcaldia: ALCALDIA_BY_COLONIA[name], direction: vision.trend.direction},
    }];
  });
}

export function walkDistance(from, to) {
  return distance(from, to);
}

const EMPTY_FC = {type: 'FeatureCollection', features: []};

export function overlayCollections({colonia, layer, commuteFrom}) {
  const outline = placeFeature(colonia);
  const focus = outline
    ? {type: 'FeatureCollection', features: [outline]}
    : EMPTY_FC;
  const heat = layer === 'price' || layer === 'trend' || layer === 'safety' || layer === 'soil'
    ? {type: 'FeatureCollection', features: choroplethFeatures(layer === 'trend' ? 'trend' : layer === 'safety' || layer === 'soil' ? 'safety' : 'price')}
    : EMPTY_FC;
  const commute = layer === 'commute' && commuteFrom
    ? {type: 'FeatureCollection', features: [15, 30, 45].map((minutes, index) => ({
      ...circlePolygon(commuteFrom, minutes * 80),
      properties: {ring: index},
    }))}
    : EMPTY_FC;
  return {focus, heat, commute};
}

export function legendFor(layer, language) {
  const pt = language === 'pt-BR';
  if (layer === 'price') {
    return {title: pt ? 'Preço pedido / m²' : 'Precio pedido / m²', items: [
      {label: pt ? 'Mais acessível' : 'Más accesible', color: '#d7e3d0'},
      {label: pt ? 'Médio' : 'Medio', color: '#c4b48a'},
      {label: pt ? 'Mais alto' : 'Más alto', color: '#c9a07a'},
    ]};
  }
  if (layer === 'trend') {
    return {title: pt ? 'Valorização' : 'Plusvalía', items: [
      {label: pt ? 'Sobe' : 'Sube', color: '#8fbf88'},
      {label: pt ? 'Estável' : 'Estable', color: '#c8c4b8'},
      {label: pt ? 'Desce' : 'Baja', color: '#d4a09a'},
    ]};
  }
  if (layer === 'safety' || layer === 'soil') {
    return {title: pt ? 'Percepção de segurança' : 'Percepción de seguridad', items: [
      {label: pt ? 'Se sente mais seguro' : 'Se siente más seguro', color: '#b7d4c2'},
      {label: pt ? 'Misto' : 'Mixto', color: '#e2d4a8'},
      {label: pt ? 'Se sente menos seguro' : 'Se siente menos seguro', color: '#e0c0b6'},
    ]};
  }
  if (layer === 'commute') {
    return {title: pt ? 'A pé (ilustrativo)' : 'A pie (ilustrativo)', items: [
      {label: '15 min', color: '#11111122'},
      {label: '30 min', color: '#11111118'},
      {label: '45 min', color: '#11111110'},
    ]};
  }
  return null;
}

export {coloniaVision, textOf, ALCALDIA_BY_COLONIA};
