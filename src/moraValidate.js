import gold from './data/mora-gold.json' with {type:'json'};

/** Rule checks for Mora fixtures. A fixture is {factSheet, output}; every error names the rule and the text that broke it. */

const MAX_SYNTHESIS_WORDS = 30;
const MAX_ACTION_WORDS = 5;
const CONNECTIVES = ['probablemente porque', 'porque', 'así que', 'aunque', 'y ya', 'pero', 'además', 'por eso'];
const FORBIDDEN = [
  'lo que se puede verificar', 'información no disponible', 'excelente', 'ideal', 'perfecto para ti', 'increíble',
  'buena ubicación', 'zona tranquila', 'barrio tranquilo', 'exclusivo', 'oportunidad única', 'te recomiendo comprar', 'precio justo', 'plusvalía',
];
const VERBS = new Set(['ver', 'pedir', 'comparar', 'agregar', 'preguntar', 'abrir', 'buscar', 'explorar', 'guardar', 'mostrar', 'quitar', 'cambiar', 'aplicar', 'solicitar', 'agendar', 'revisar', 'confirmar']);
const UNIT = /^(m²|m2|km)$/i;
const POI_ICON = {office:'briefcase', metro:'train', park:'tree'};

const words = text => String(text || '').trim().split(/\s+/).filter(Boolean);
const tokens = text => String(text || '').toLowerCase().replace(/[.,;:¿?¡!()"“”]/g, ' ').split(/\s+/).filter(Boolean);
const fold = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Numbers, travel list and address come from code, not from the model. */
export function codeOwnedFields(output, sheet) {
  const market = sheet.market;
  const ruler = {p10:market.comparablesP10PerM2, p90:market.comparablesP90PerM2, median:market.comparablesMedianPerM2, value:market.pricePerM2, unit:'m2',
    ...(market.aboveRange ? {aboveRange:true} : {}), ...(market.belowRange ? {belowRange:true} : {})};
  return {
    ...output,
    address:sheet.listing.address,
    marketRuler:{...(output.marketRuler || {}), ...ruler},
    insights:(output.insights || []).map(item => item.ruler ? {...item, ruler:{...item.ruler, ...ruler}} : item),
    pois:(sheet.neighborhood?.poisRanked || []).map(item => ({icon:POI_ICON[item.category] || 'pin', text:item.name, meta:`${item.minutes} min ${item.mode}`})),
  };
}

function sheetNumbers(sheet, persona) {
  const out = new Set();
  const walk = value => {
    if (typeof value === 'number') { out.add(value); out.add(Math.abs(value)); }
    else if (typeof value === 'string') for (const match of value.matchAll(/\d+(?:\.\d+)?/g)) out.add(Number(match[0]));
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(sheet);
  walk(persona);
  return [...out];
}

/** Every number written in a text, with how precisely it was written, so $33.1k matches 33,100 and $3.9M matches 3,885,000. */
export function numbersIn(text) {
  const found = [];
  let rest = String(text || '');
  rest = rest.replace(/\$\s?(\d[\d,]*(?:\.\d+)?)\s?(k|M|millones)?/g, (_, digits, unit) => {
    const plain = digits.replace(/,/g, '');
    const scale = unit === 'k' ? 1e3 : unit ? 1e6 : 1;
    const decimals = (plain.split('.')[1] || '').length;
    found.push({raw:`$${digits}${unit || ''}`, value:Number(plain) * scale, tolerance:unit ? scale * 10 ** -decimals / 2 : 0});
    return ' ';
  });
  rest = rest.replace(/[−-]?(\d+(?:\.\d+)?)\s?%/g, (_, digits) => {
    found.push({raw:`${digits}%`, value:Number(digits), tolerance:0});
    return ' ';
  });
  for (const match of rest.matchAll(/\d+(?:\.\d+)?/g)) found.push({raw:match[0], value:Number(match[0]), tolerance:0});
  return found;
}

function texts(output) {
  return [
    ['synthesis', output.synthesis],
    ...(output.insights || []).map((item, i) => [`insights[${i}]`, item.text]),
    ...(output.marketRuler?.badge ? [['marketRuler.badge', output.marketRuler.badge]] : []),
  ].filter(([, text]) => text);
}

function placeTimes(text, pois, park) {
  const errors = [];
  const near = (index, length) => [...text.slice(Math.max(0, index - 30), index + length + 30).matchAll(/(\d+)\s?min/g)].map(match => Number(match[1]));
  for (const poi of pois) {
    const index = fold(text).indexOf(fold(poi.name));
    if (index < 0) continue;
    const times = near(index, poi.name.length);
    if (times.length && !times.includes(poi.minutes)) errors.push(`${poi.name}: text says ${times.join('/')} min, list says ${poi.minutes}`);
  }
  if (park && !fold(text).includes(fold(park.name))) {
    const match = text.match(/parques?[^.]{0,40}?(\d+)\s?min/i);
    if (match && Number(match[1]) !== park.minutes) errors.push(`nearest park: text says ${match[1]} min, list says ${park.minutes}`);
  }
  return errors;
}

function similarityFor(text, sheet, persona) {
  const labels = new Map((persona.favorites || []).map(item => [item.id, item.label]));
  const entries = (sheet.comparisonWithFavorites || []).map(item => ({...item, label:item.favoriteLabel || labels.get(item.favoriteId) || ''}));
  const named = entries.filter(item => item.label && fold(text).includes(fold(item.label)));
  return (named.length ? named : entries).map(item => item.similarity);
}

/** Rules that need one fixture only. */
export function validateFixture({factSheet:sheet, output}, persona = gold.userContext) {
  const errors = [];
  const fail = (rule, detail) => errors.push({rule, detail});
  const synthesis = String(output.synthesis || '');
  const insights = output.insights || [];

  if (words(synthesis).length > MAX_SYNTHESIS_WORDS) fail('synthesis-length', `${words(synthesis).length} words`);
  if (/\b(y|pero)\s*,?\s*por las fotos/i.test(synthesis)) fail('photo-joined', synthesis);

  const synthesisTokens = tokens(synthesis);
  const grams = new Set(synthesisTokens.map((_, i) => synthesisTokens.slice(i, i + 5).join(' ')).filter((_, i) => i + 5 <= synthesisTokens.length));
  insights.forEach((item, i) => {
    const own = tokens(item.text);
    for (let k = 0; k + 5 <= own.length; k += 1) {
      const gram = own.slice(k, k + 5).join(' ');
      if (grams.has(gram)) { fail('repeats-synthesis', `insights[${i}]: "${gram}"`); break; }
    }
  });

  const dims = insights.map(item => item.dimension);
  for (const dim of new Set(dims)) if (dims.filter(item => item === dim).length > 1) fail('same-dimension', dim);

  const allowed = sheetNumbers(sheet, persona);
  for (const [where, text] of texts(output)) {
    for (const number of numbersIn(text)) {
      if (!allowed.some(value => Math.abs(value - number.value) <= number.tolerance)) fail('number-not-in-sheet', `${where}: ${number.raw}`);
    }
    for (const detail of placeTimes(text, sheet.neighborhood?.poisRanked || [], sheet.neighborhood?.nearestPark)) fail('place-time', `${where}: ${detail}`);
    if (/se parece/i.test(text) && !similarityFor(text, sheet, persona).includes('high')) fail('se-parece', `${where}: ${text}`);
    for (const word of FORBIDDEN) if (new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu').test(text)) fail('forbidden', `${where}: "${word}"`);
    if (/\d+\s?(metros|km|m)(?![²\p{L}\d])/iu.test(text.replace(/\$\s?\d[\d,]*(?:\.\d+)?\s?(k|M|millones)?/g, ' '))) fail('forbidden', `${where}: distance in meters`);
  }

  insights.forEach((item, i) => {
    if ((item.source === 'photo_inference' || item.dimension === 'photos') && !/por las fotos|parece/i.test(item.text)) fail('photo-hedge', `insights[${i}]: ${item.text}`);
  });

  const actions = [...insights.map(item => item.action), ...(output.extractedTags || []).map(item => item.action)].filter(Boolean);
  for (const action of actions) {
    const label = words(action.label).filter(word => !UNIT.test(word));
    const first = fold(label[0] || '');
    if (label.length > MAX_ACTION_WORDS) fail('action-label', `${action.label}: ${label.length} words`);
    if (!VERBS.has(first) && !/(ar|er|ir)$/.test(first)) fail('action-label', `${action.label}: does not start with a verb`);
  }

  const ruler = output.marketRuler || insights.find(item => item.ruler)?.ruler;
  if (ruler) {
    const market = sheet.market;
    const expected = {p10:market.comparablesP10PerM2, p90:market.comparablesP90PerM2, median:market.comparablesMedianPerM2, value:market.pricePerM2};
    for (const [key, value] of Object.entries(expected)) if (ruler[key] !== value) fail('ruler-number', `${key}: ${ruler[key]} vs sheet ${value}`);
  }

  if (output.address && sheet.listing?.address && output.address !== sheet.listing.address) fail('address', output.address);
  if (!output.fit?.criteria?.length) fail('fit-missing', 'no fit block');
  return {ok:errors.length === 0, errors};
}

const connectiveAt = text => {
  const list = tokens(text);
  for (let i = 0; i < list.length; i += 1) {
    const hit = CONNECTIVES.find(item => list.slice(i, i + item.split(' ').length).join(' ') === item);
    if (hit) return `${hit}@${i}`;
  }
  return null;
};

/** Rules across listings: the same questions or the same sentence shape in two listings is a template. */
export function validateSet(fixtures) {
  const errors = [];
  for (let i = 0; i < fixtures.length; i += 1) {
    for (let j = i + 1; j < fixtures.length; j += 1) {
      const [a, b] = [fixtures[i], fixtures[j]];
      const pair = `${a.id} / ${b.id}`;
      const promptsA = new Set((a.output.conversationPrompts || []).map(fold));
      const shared = (b.output.conversationPrompts || []).filter(item => promptsA.has(fold(item)));
      if (shared.length) errors.push({rule:'same-prompts', detail:`${pair}: ${shared.join(' | ')}`});
      const [ta, tb] = [tokens(a.output.synthesis).slice(0, 3).join(' '), tokens(b.output.synthesis).slice(0, 3).join(' ')];
      if (ta && ta === tb) errors.push({rule:'same-opening', detail:`${pair}: "${ta}"`});
      const [ca, cb] = [connectiveAt(a.output.synthesis), connectiveAt(b.output.synthesis)];
      if (ca && ca === cb) errors.push({rule:'same-connective', detail:`${pair}: ${ca}`});
    }
  }
  return {ok:errors.length === 0, errors};
}

/** The current output in the anti-examples, in fixture shape, so the same rules can reject it. */
export function antiExampleFixture(anti) {
  const example = gold.examples.find(item => item.id === anti.relatedGoldId);
  const current = anti.currentOutput;
  const insights = [
    current.marketSubtitle && {dimension:'market', text:current.marketSubtitle},
    current.neighborhoodHeadline && {dimension:'neighborhood', text:current.neighborhoodHeadline},
    current.favorites && {dimension:'comparison', text:current.favorites},
    current.photos && {dimension:'photos', source:'photo_inference', text:current.photos},
  ].filter(Boolean);
  return {
    id:`anti:${anti.relatedGoldId}`,
    factSheet:example.factSheet,
    output:{
      ...(current.address ? {address:current.address} : {}),
      synthesis:current.synthesis,
      insights,
      pois:(current.pois || []).map(text => ({text})),
      conversationPrompts:current.chips || [],
    },
  };
}

export const goldFixtures = () => gold.examples.map(item => ({id:item.id, factSheet:item.factSheet, output:item.expectedOutput}));
export const antiFixtures = () => gold.antiExamples.map(antiExampleFixture);
