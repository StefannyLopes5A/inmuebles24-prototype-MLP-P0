import {foldSearchText, detailTokens} from './homeSearchModel.js';
import {parseSearchInput} from './searchInput.js';
import {addressFromPlaces, areasFromPlaces, combinePlaces, placeHits} from './locationSearch.js';

export const CRITERIA = [
  {id:'furnished', pt:'Mobiliado', es:'Amueblado', pattern:/\bamueblad[oa]\b|\bmobiliad[oa]\b|\bcom mobilia\b/},
  {id:'unfurnished', pt:'Sem mobília', es:'Sin muebles', pattern:/\bsin muebles\b|\bsem mobilia\b|\bno amueblad[oa]\b|\bnao mobiliad[oa]\b/},
  {id:'security', pt:'Portaria 24h', es:'Vigilancia 24h', pattern:/\b(?:vigilancia|seguridad|portaria|porteria)\s*(?:las\s*)?24\s*(?:h|horas)?\b/},
  {id:'balcony', pt:'Varanda', es:'Balcón', pattern:/\bbalcon\b|\bvaranda\b/},
  {id:'gourmet', pt:'Varanda gourmet', es:'Balcón con asador', pattern:/\b(?:balcon|varanda)\b.*\b(?:asador|gourmet)\b/},
  {id:'coworking', pt:'Coworking', es:'Coworking', pattern:/\bcoworking\b/},
  {id:'pool', pt:'Piscina', es:'Piscina', pattern:/\b(?:piscina|alberca)\b/},
  {id:'garden', pt:'Jardim', es:'Jardín', pattern:/\b(?:jardin(?:es)?|jardim(?:s)?)\b/},
  {id:'elevator', pt:'Elevador', es:'Elevador', pattern:/\b(?:elevador|ascensor)\b/},
  {id:'pets', pt:'Aceita pets', es:'Mascotas permitidas', pattern:/\bmascotas?\b|\bpet friendly\b|\baceita pets\b/},
  {id:'patio', pt:'Pátio', es:'Patio', pattern:/\bpatios?\b/},
  {id:'roof', pt:'Roof garden', es:'Roof garden', pattern:/\broof\s*garden\b|\bazotea\b/},
  {id:'gym', pt:'Academia', es:'Gimnasio', pattern:/\bgimnasio\b|\bgym\b|\bacademia\b/},
  {id:'party', pt:'Salão de festas', es:'Salón de fiestas', pattern:/\bsalon de (?:fiestas|eventos)\b|\bsalao de festas\b/},
  {id:'cinema', pt:'Cinema', es:'Cine', pattern:/\bcine\b|\bcinema\b/},
  {id:'padel', pt:'Quadra de padel', es:'Cancha de pádel', pattern:/\bpadel\b/},
  {id:'tennis', pt:'Quadra de tênis', es:'Cancha de tenis', pattern:/\b(?:cancha|quadra) de tenis\b/},
  {id:'aircon', pt:'Ar-condicionado', es:'Aire acondicionado', pattern:/\baire acondicionado\b|\bar[ -]condicionado\b|\bminisplit\b/},
  {id:'storage', pt:'Depósito', es:'Bodega', pattern:/\bbodega\b(?!\s+comercial)|\bdeposito privativo\b/},
  {id:'service', pt:'Quarto de serviço', es:'Cuarto de servicio', pattern:/\bcuarto de servicio\b|\bquarto de servico\b|\bdependencia de empregada\b/},
  {id:'accessible', pt:'Acessível', es:'Accesible', pattern:/\baccesib(?:le|ilidad)\b|\bacessive(?:l|is)\b|\bacessibilidade\b/},
  {id:'floors', pt:'Dois andares', es:'Dos plantas', pattern:/\b(?:dos|2) (?:plantas|niveles|pisos)\b|\bduplex\b|\bdois andares\b/},
  {id:'terrace', pt:'Terraço', es:'Terraza', pattern:/\bterrazas?\b|\bterracos?\b/},
  {id:'beach', pt:'Acesso à praia', es:'Acceso a la playa', pattern:/\bacceso a la playa\b|\bacesso a praia\b|\bpe na areia\b/},
  {id:'gated', pt:'Condomínio fechado', es:'Fraccionamiento privado', pattern:/\bfraccionamiento (?:privado|cerrado)\b|\bcondominio fechado\b/},
];
export const criterionLabel = (id, language) => CRITERIA.find(item => item.id === id)?.[language === 'pt-BR' ? 'pt' : 'es'] || id.replace(/^text:/, '');
export const normalizeCriteria = value => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && (CRITERIA.some(c => c.id === item) || /^text:.{1,120}$/u.test(item))).slice(0,12))] : [];
const isQuestion = text => /[?¿]/.test(text) || /^(?:como|qual|quais|onde|por que|o que|quanto|que|cual|cuales|donde|por que|cuanto|sera que|tem algum|hay algun)\b/.test(foldSearchText(text.trim()));

/** The home input and result input must recognize the same explicit details, in the order they were typed. */
export function criteriaFromText(text = '') {
  if (isQuestion(text)) return [];
  const ids = [];
  for (const hit of criterionMatches(text)) if (!ids.includes(hit.id)) ids.push(hit.id);
  let criteria = ids;
  if (criteria.includes('gourmet')) criteria = criteria.filter(id => id !== 'balcony');
  if (criteria.includes('unfurnished')) criteria = criteria.filter(id => id !== 'furnished');
  return criteria;
}

export function updateSearchNote(search, note) {
  const previous = criteriaFromText(search.note);
  const criteria = criteriaFromText(note);
  const retained = (search.criteria || []).filter(id => !previous.includes(id)
    && !(criteria.includes('furnished') && id === 'unfurnished')
    && !(criteria.includes('unfurnished') && id === 'furnished'));
  return {...search, note, criteria:normalizeCriteria([...retained, ...criteria])};
}

export function matchesCriteria(home, criteria = []) {
  // Only the captured listing text is evidence; photos and unverified layouts are not classified.
  const text = foldSearchText([home.title, home.features, home.description || ''].join(' '));
  return criteria.every(id => {
    if (id.startsWith('text:')) return text.includes(foldSearchText(id.slice(5)));
    const criterion = CRITERIA.find(item => item.id === id);
    if (id === 'furnished' && CRITERIA.find(item => item.id === 'unfurnished').pattern.test(text)) return false;
    return !!criterion?.pattern.test(text);
  });
}

export function smartDetailTokens(text, criteria = [], streets = []) {
  if (isQuestion(text)) return [];
  const street = matchStreet(text, streets);
  if (street?.address) {
    const start = text.search(/\S/);
    return [{start, end:start + street.typed.length, text:text.slice(start, start + street.typed.length), kind:'extra'}];
  }
  const tokens = detailTokens(text);
  const extra = /(?<![\p{L}\p{N}])(?:home\s*office|trabalhar\s+em\s+casa|trabajar\s+en\s+casa|varanda(?:\s+gourmet)?|balc[oó]n(?:\s+con\s+asador)?|coworking)(?![\p{L}\p{N}])/giu;
  const recognized=[...tokens, ...[...text.matchAll(extra)].map(m => ({start:m.index,end:m.index+m[0].length,text:m[0],kind:'extra'}))];
  for(const id of criteria.filter(id=>id.startsWith('text:'))) {const term=id.slice(5),start=text.toLowerCase().indexOf(term.toLowerCase());if(start>=0&&!recognized.some(token=>start<token.end&&start+term.length>token.start))recognized.push({start,end:start+term.length,text:text.slice(start,start+term.length),kind:'extra'});}
  return recognized.sort((a,b) => a.start-b.start);
}

const STREET_PREFIX = /^(?:calle|c\/|avenida|av\.?|calzada|rua|r\.)\s+(.{2,80})$/i;
/** "Calle Arquímedes 54" → "Calle Arquímedes": the catalog street without its number, for the token and the filter. */
export const streetName = street => String(street || '').replace(/,.*$/, '').replace(/\s+(?:al\s+)?\d+[a-z]?$/i, '').trim();

/** A typed street ("Calle Arquímedes") against the catalog streets. Only a street prefix makes text a street. */
export function matchStreet(text, streets = []) {
  const typed = text.trim().match(STREET_PREFIX);
  if (!typed) return null;
  const term = foldSearchText(typed[1].replace(/\s+\d+[a-z]?$/i, '').trim());
  if (term.length < 3) return null;
  const found = streets.find(street => foldSearchText(street).includes(term));
  return {typed:typed[0].replace(/\s+\d+[a-z]?$/i, '').trim(), address:found ? streetName(found) : null};
}

export function interpretSmartInput(value, search, currency, areas, rate = 20, commit = false, streets = []) {
  const text = value.trim(), folded = foldSearchText(text);
  if (!text) return {kind:'empty',search};
  // Questions are classified first, so a price or neighborhood inside a question never changes filters.
  if (isQuestion(text)) return {kind:'question',question:text,search};
  // A street the catalog has becomes the location token; one it doesn't have is answered by Mora, never a text criterion.
  const street = matchStreet(text, streets);
  if (street) {
    if (!street.address) return commit ? {kind:'street-missing',street:street.typed,search} : {kind:'draft',search};
    return {kind:'filters',search:{...search,areas:[],area:'Ambas zonas',address:street.address},qualify:false,street:true};
  }
  const parsed = parseSearchInput(text, search, currency, areas, rate);
  const type=[['condominium',/\bcasa(?:s)? (?:em|en) condominio\b/],['house',/\bcasas?\b/],['apartment',/\b(?:apartamentos?|departamentos?)\b/],['land',/\b(?:terrenos?|lotes?)\b/]].find(([,pattern])=>pattern.test(folded))?.[0];
  if(type){parsed.search.propertyType=type;parsed.structured=true;}
  const criteria = criteriaFromText(text);
  const qualify = /\b(home\s*office|trabalhar em casa|trabajar en casa)\b/.test(folded);
  const next = {...parsed.search, ...(parsed.areaExplicit ? {areas:[parsed.search.area]} : {}), note:search.note};
  if (next.mode !== search.mode) next.minBudget = 0;
  if (criteria.length || qualify) {
    const merged = [...(search.criteria || [])].filter(id => !(criteria.includes('furnished') && id === 'unfurnished') && !(criteria.includes('unfurnished') && id === 'furnished'));
    next.criteria = normalizeCriteria([...merged, ...criteria]);
    next.note = [...new Set([search.note, text].filter(Boolean))].join('; ').slice(0,600);
  }
  if (!parsed.structured && !criteria.length && !qualify) {
    if (!commit) return {kind:'draft',search};
    const term = text.replace(/^(?:(?:quero|quiero|busco|preciso|de|com|con|e|y)\b[\s,]*)+/i, '').trim().slice(0,120);
    // Removing a chip can leave only introductory words; those are not a new criterion.
    if (!term) return {kind:'empty',search};
    next.criteria = normalizeCriteria([...(search.criteria || []), `text:${term}`]);
    next.note = [...new Set([search.note,text].filter(Boolean))].join('; ').slice(0,600);
  }
  return {kind:'filters',search:next,qualify};
}

const EMPTY_DESCRIPTION = Object.freeze({mode:null, propertyType:null, beds:null, baths:null, parking:null, area:null, budget:null, criteria:[], places:[]});
const PARKING_BODY = String.raw`(?:\d+\+?\s*)?(?:garajes?|garages?|garagem|garagens|estacionamientos?|estacionamentos?|cocheras?|vagas?|parking(?:\s+spaces?)?)`;
const BATH_FOLDED = String.raw`(?:\d+\+?\s*)?(?:banos?|banheiros?|bathrooms?)`;
const BATH_RAW = String.raw`(?:\d+\+?\s*)?(?:baños?|banos?|banheiros?|bathrooms?)`;

function parkingMentions(folded) {
  const mentions = [];
  const pattern = new RegExp(String.raw`(^|[^a-z0-9])(${PARKING_BODY})(?=$|[^a-z0-9])`, 'g');
  for (const match of String(folded || '').matchAll(pattern)) {
    const token = match[2];
    const start = match.index + match[1].length;
    const count = token.match(/^(\d+)/);
    mentions.push({start, end:start + token.length, count:Math.min(6, Math.max(1, Number(count?.[1] || 1)))});
  }
  return mentions;
}

function bathMentions(folded) {
  const mentions = [];
  const pattern = new RegExp(String.raw`(^|[^a-z0-9])(${BATH_FOLDED})(?=$|[^a-z0-9])`, 'g');
  for (const match of String(folded || '').matchAll(pattern)) {
    const token = match[2];
    const start = match.index + match[1].length;
    const count = token.match(/^(\d+)/);
    mentions.push({start, end:start + token.length, count:Math.min(10, Math.max(1, Number(count?.[1] || 1)))});
  }
  return mentions;
}

/** Swap a typed bathroom word for the canonical count, or report that the sentence has none. */
export function replaceBathPhrase(text, phrase) {
  const pattern = new RegExp(String.raw`(^|[^\p{L}\p{N}])(${BATH_RAW})(?=$|[^\p{L}\p{N}])`, 'iu');
  if (!pattern.test(String(text || ''))) return null;
  return String(text).replace(pattern, (_, lead) => `${lead}${phrase}`);
}

/** Swap a typed parking word for the canonical count, or report that the sentence has none. */
export function replaceParkingPhrase(text, phrase) {
  const pattern = new RegExp(String.raw`(^|[^\p{L}\p{N}])(${PARKING_BODY})(?=$|[^\p{L}\p{N}])`, 'iu');
  if (!pattern.test(String(text || ''))) return null;
  return String(text).replace(pattern, (_, lead) => `${lead}${phrase}`);
}
const PROPERTY_PATTERNS = [
  ['condominium', /\bcasas? (?:em|en) condominio\b/],
  ['house', /\bcasas?\b/],
  ['apartment', /\b(?:apartamentos?|departamentos?)\b/],
  ['office', /\b(?:escritorios?|oficinas?)\b/],
  ['warehouse', /\b(?:depositos? comerciais|bodegas? comerciales)\b/],
  ['land', /\b(?:terrenos?|lotes?)\b/],
  ['industrial', /\b(?:galpoes? industriais|galpao industrial|naves? industriales)\b/],
  ['commercial', /\b(?:pontos? comerciais|locais? comerciais)\b/],
];

const HOME_CONNECTOR = /^(?:quiero|quero|una|um|un|uma|con|com|en|em|hasta|ate|até|y|e|de|del|cerca)$/iu;

/**
 * A price typed at the end of the field is still open until its digits are grouped:
 * "hasta 750" or "hasta 7,00" wait; "hasta 7,000" is a price. Words like "mil" or "MXN" close it.
 */
function budgetAmountOpen(text) {
  const amount = text.replace(/^(?:hasta|ate|até|menos de)\s*(?:\$|USD\s*|MXN\s*)?/iu, '');
  if (!/[\d.,]$/u.test(amount)) return false;
  return !/[.,]\d{3}$/u.test(amount);
}

function foldMap(text) {
  let folded = '';
  const toOrig = [];
  let index = 0;
  for (const char of text) {
    const piece = foldSearchText(char);
    for (let step = 0; step < piece.length; step += 1) toOrig.push(index);
    folded += piece;
    index += char.length;
  }
  return {folded, toOrig, end:index};
}

function origSpan(map, start, end) {
  if (start < 0 || start >= map.toOrig.length || end <= start) return null;
  const from = map.toOrig[start];
  const to = end >= map.toOrig.length ? map.end : map.toOrig[end];
  return to > from ? [from, to] : null;
}

function criterionMatches(text) {
  const raw = String(text || '');
  const map = foldMap(raw);
  const hits = [];
  for (const item of CRITERIA) {
    const matcher = new RegExp(item.pattern.source, 'g');
    for (const match of map.folded.matchAll(matcher)) {
      const span = origSpan(map, match.index, match.index + match[0].length);
      if (span) hits.push({id:item.id, start:span[0], end:span[1], foldedStart:match.index, foldedEnd:match.index + match[0].length});
    }
  }
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const taken = [];
  const chosen = [];
  for (const hit of hits) {
    if (taken.some(span => hit.start < span.end && span.start < hit.end)) continue;
    taken.push(hit);
    chosen.push(hit);
  }
  return chosen;
}

const SPAN_PRIORITY = {type:0, beds:1, baths:1, parking:1, budget:2, criterion:3, mode:4, place:5};

/** Filter words in the order they were typed. A mode word is consumed but not shown. */
function collectHomeSpans(text) {
  const raw = String(text || '');
  const map = foldMap(raw);
  const found = [];
  const pushFolded = (kind, start, end, extra) => {
    const span = origSpan(map, start, end);
    if (span) found.push({kind, start:span[0], end:span[1], ...extra});
  };
  for (const [id, pattern] of PROPERTY_PATTERNS) {
    const matcher = new RegExp(pattern.source, 'g');
    for (const match of map.folded.matchAll(matcher)) pushFolded('type', match.index, match.index + match[0].length, {key:'propertyType', id});
  }
  for (const match of map.folded.matchAll(/\d+\+?\s*(?:recamaras?|quartos?|habitaciones?)/g)) pushFolded('beds', match.index, match.index + match[0].length, {key:'beds'});
  for (const mention of bathMentions(map.folded)) pushFolded('baths', mention.start, mention.end, {key:'baths'});
  for (const mention of parkingMentions(map.folded)) pushFolded('parking', mention.start, mention.end, {key:'parking'});
  for (const match of map.folded.matchAll(/\b(?:renta|rentar|alugar|aluguel|compra|comprar|venta|venda)\b/g)) pushFolded('mode', match.index, match.index + match[0].length, {key:`mode:${match.index}`});
  const budget = /(?:hasta|ate|até|menos de)\s*(?:\$|USD\s*|MXN\s*)?[\d.,]+(?:\s*(?:mil|millones|millón|milhões|milhao|mi))?(?:\s*(?:MXN|USD))*/giu;
  for (const match of raw.matchAll(budget)) {
    const end = match.index + match[0].length;
    if (end >= raw.trimEnd().length && budgetAmountOpen(match[0])) continue;
    // The keyword ("hasta", "menos de") is part of the span, so it is kept as the chip's lead.
    const keyword = match[0].match(/^(?:hasta|ate|até|menos de)/iu)[0];
    found.push({kind:'budget', start:match.index, end, key:'budget', fixedLead:keyword.toLowerCase()});
  }
  for (const hit of criterionMatches(raw)) found.push({kind:'criterion', start:hit.start, end:hit.end, key:`criterion:${hit.id}`, id:hit.id});
  for (const hit of placeHits(raw)) {
    const span = origSpan(map, hit.at, hit.end);
    if (span) found.push({kind:'place', start:span[0], end:span[1], key:`place:${hit.place.key}`, place:hit.place});
  }
  found.sort((a, b) => (b.end - b.start) - (a.end - a.start) || SPAN_PRIORITY[a.kind] - SPAN_PRIORITY[b.kind] || a.start - b.start);
  const taken = [];
  const chosen = [];
  const seen = new Set();
  for (const item of found) {
    if (seen.has(item.key) || taken.some(span => item.start < span.end && span.start < item.end)) continue;
    seen.add(item.key);
    taken.push(item);
    const leadMatch = raw.slice(0, item.start).match(/(\S+)\s*$/u);
    const lead = leadMatch && HOME_CONNECTOR.test(leadMatch[1]) ? leadMatch[1].toLowerCase() : '';
    chosen.push({...item, lead: item.fixedLead ?? lead});
  }
  // A word stays in the field until a space finishes it, so typing does not jump into a chip.
  return chosen.filter(item => item.end < raw.length && /\s/u.test(raw[item.end])).sort((a, b) => a.start - b.start);
}

/** Chips in the order the person typed them. */
export function homePhraseItems(text) {
  return collectHomeSpans(text).filter(item => item.kind !== 'mode');
}

/** Put a new value where one chip is, instead of adding another chip. An empty replacement removes the chip and its connector. */
export function replaceHomePhraseItem(text, key, replacement) {
  const raw = String(text || '');
  const item = homePhraseItems(raw).find(entry => entry.key === key);
  if (!item) return raw.slice(0, 600);
  let start = item.start;
  if (!replacement && item.lead) {
    const before = raw.slice(0, start);
    const lead = before.match(/([^\S\n]*)(\S+)[^\S\n]*$/u);
    if (lead && HOME_CONNECTOR.test(lead[2])) start -= lead[0].length;
  }
  return `${raw.slice(0, start)}${replacement}${raw.slice(item.end)}`
    .replace(/[^\S\n]{2,}/gu, ' ')
    .replace(/^[^\S\n]+/gu, '')
    .slice(0, 600);
}

/** Character ranges of filter words already complete in the description. */
function homeValueSpans(text) {
  return collectHomeSpans(text).map(item => [item.start, item.end]);
}

function expandFilterSpan(text, start, blockedAt) {
  let at = start;
  while (at > blockedAt) {
    const match = text.slice(0, at).match(/([^\S\n]*)(\S+)[^\S\n]*$/u);
    if (!match || !HOME_CONNECTOR.test(match[2])) break;
    const wordStart = at - match[0].length;
    if (wordStart < blockedAt) break;
    at = wordStart;
  }
  return at;
}

/** The words that already became filters, and the text the person is still typing. */
export function splitHomeQuery(text) {
  const raw = String(text || '');
  const values = homeValueSpans(raw);
  if (!values.length) return {base:'', tail:raw};
  const ranges = [];
  let blocked = 0;
  for (const [start, end] of values) {
    const from = expandFilterSpan(raw, start, blocked);
    ranges.push([from, end]);
    blocked = end;
  }
  const baseParts = [];
  let tail = '';
  let cursor = 0;
  for (const [start, end] of ranges) {
    const gap = raw.slice(cursor, start);
    const piece = raw.slice(start, end).trim();
    if (gap.trim()) tail += gap;
    else if (piece) {
      const breaks = (gap.match(/\n/g) || []).length;
      baseParts.push(`${breaks ? '\n'.repeat(breaks) : baseParts.length ? ' ' : ''}${piece}`);
    }
    cursor = end;
  }
  tail += raw.slice(cursor);
  return {base:baseParts.join('').replace(/[^\S\n]+/gu, ' ').trim(), tail:tail.replace(/[^\S\n]+/gu, ' ')};
}

/** The typed sentence split into editable gaps and the filter chips between them. */
export function homePhraseSegments(text, editKey = null) {
  const raw = String(text || '');
  const items = homePhraseItems(raw);
  const segments = [];
  let cursor = 0;
  const pushGap = (start, end, afterKey) => {
    const value = raw.slice(start, end);
    const lines = value.split('\n');
    let at = start;
    lines.forEach((line, index) => {
      if (index) segments.push({kind:'break', key:`break:${afterKey}:${index}`});
      const lineEnd = at + line.length;
      segments.push({kind:'text', key:`gap:${afterKey}:${index}`, start:at, end:lineEnd, value:line, grow:false, tone:'text'});
      at = lineEnd + 1;
    });
  };
  items.forEach(item => {
    pushGap(cursor, item.start, item.key);
    if (item.key === editKey) {
      segments.push({kind:'text', key:`edit:${item.key}`, start:item.start, end:item.end, value:raw.slice(item.start, item.end), grow:false, tone:'filter', item});
    } else {
      segments.push({kind:'chip', key:item.key, item, start:item.start, end:item.end});
    }
    cursor = item.end;
  });
  pushGap(cursor, raw.length, 'tail');
  const lastText = [...segments].reverse().find(segment => segment.kind === 'text' && segment.tone !== 'filter');
  if (lastText) lastText.grow = true;
  else segments.push({kind:'text', key:'tail', start:raw.length, end:raw.length, value:'', grow:true, tone:'text'});
  return segments;
}

/** Replace one stretch of the sentence without moving the words around it. */
export function spliceHomeQuery(query, start, end, next) {
  const raw = String(query || '');
  const from = Math.max(0, Math.min(raw.length, start));
  const to = Math.max(from, Math.min(raw.length, end));
  return `${raw.slice(0, from)}${next ?? ''}${raw.slice(to)}`.slice(0, 600);
}

/** Backspace at a filter boundary returns that word to the sentence, one letter shorter. */
export function releaseHomeTokenBefore(query, offset) {
  const raw = String(query || '');
  const at = Math.max(0, Math.min(raw.length, offset));
  const previous = [...homeValueSpans(raw)].reverse().find(span => span[1] <= at && span[1] > span[0]);
  if (!previous) return at > 0 ? raw.slice(0, at - 1) + raw.slice(at) : raw;
  if (raw.slice(previous[1], at).trim()) return at > 0 ? raw.slice(0, at - 1) + raw.slice(at) : raw;
  return raw.slice(0, previous[1] - 1) + raw.slice(previous[1]);
}

export function replaceHomeQueryTail(query, nextTail) {
  const {base} = splitHomeQuery(query);
  const left = base.trim();
  const right = String(nextTail ?? '');
  if (!left) return right;
  // Emptying the field keeps the space that finished the filter, so the filter stays and the field stays put.
  if (!right) return /\s$/u.test(left) ? left : `${left} `;
  if (/^\s/u.test(right) || /\n$/u.test(left)) return `${left}${right}`;
  // A thousands or decimal separator continues the number in front of it ("hasta 7" + "," = "hasta 7,").
  if (/^[.,]/u.test(right) && /\d$/u.test(left)) return `${left}${right}`;
  return `${left} ${right}`;
}

const HOME_ARTICLE = /^(?:una|un|uma|um)$/iu;

/** The article in front of the property type, only when the person actually typed it. */
export function homeTypedArticle(text) {
  const raw = String(text || '');
  const map = foldMap(raw);
  let found = null;
  for (const [, pattern] of PROPERTY_PATTERNS) {
    const matcher = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    const match = matcher.exec(map.folded);
    if (!match) continue;
    const span = origSpan(map, match.index, match.index + match[0].length);
    if (span && (!found || span[0] < found[0])) found = span;
  }
  if (!found) return '';
  const word = raw.slice(0, found[0]).match(/(\S+)\s*$/u);
  return word && HOME_ARTICLE.test(word[1]) ? word[1].toLowerCase() : '';
}

/** Backspace after the last filter returns that word to the field, one letter shorter, so it can be edited. */
export function releaseLastHomeToken(query) {
  const raw = String(query || '');
  const spans = homeValueSpans(raw);
  const last = spans[spans.length - 1];
  if (!last || last[1] <= last[0]) return raw.slice(0, -1);
  const rest = raw.slice(last[1]);
  // The space that finished the word goes with it; text typed after it stays.
  return raw.slice(0, last[1] - 1) + (rest.trim() ? rest : '');
}

/** Structured filters the home description actually names. Unmentioned fields stay unset. */
export function describeHomeQuery(text, areas = [], currency = 'MXN', rate = 20) {
  const raw = String(text || '').trim();
  const folded = foldSearchText(raw);
  if (!raw || isQuestion(raw)) return EMPTY_DESCRIPTION;
  const mode = /\b(?:renta|rentar|alugar|aluguel)\b/.test(folded) ? 'rent' : /\b(?:compra|comprar|venta|venda)\b/.test(folded) ? 'buy' : null;
  const propertyType = PROPERTY_PATTERNS.find(([, pattern]) => pattern.test(folded))?.[0] || null;
  const rooms = folded.match(/(\d+)\+?\s*(?:recamaras?|quartos?|habitaciones?)/);
  const baths = bathMentions(folded)[0]?.count ?? null;
  const parking = parkingMentions(folded)[0]?.count ?? null;
  const probe = {mode:mode || 'buy', area:'Ambas zonas', areas:[], address:'', budget:0, beds:1, note:''};
  // An amount still being typed ("hasta 7,00") is not a price yet, so it cannot set the budget.
  const priced = raw.replace(/(?:hasta|ate|até|menos de)\s*(?:\$|USD\s*|MXN\s*)?[\d.,]+$/iu, match => budgetAmountOpen(match) ? '' : match);
  const parsed = parseSearchInput(priced, probe, currency, areas, rate);
  const city = /\b(?:ciudad de mexico|cidade do mexico|cdmx)\b/.test(folded);
  const places = placeHits(raw).map(hit => hit.place);
  const narrow = areasFromPlaces(places);
  return {
    mode,
    propertyType,
    beds:rooms ? Math.min(10, Math.max(1, Number(rooms[1]))) : null,
    baths,
    parking,
    area:places.length ? (narrow[0] || 'Ambas zonas') : (parsed.areaExplicit ? parsed.search.area : city ? 'Ambas zonas' : null),
    budget:parsed.search.budget > 0 ? parsed.search.budget : null,
    criteria:criteriaFromText(raw),
    places,
  };
}

/** Apply a description onto the search the person had before this typing session. */
export function composeHomeDraft(origin, detected, overrides = {}, note = '', extraCriteria = [], hiddenCriteria = [], extraPlaces = [], hiddenPlaceKeys = []) {
  const mode = overrides.mode ?? detected.mode ?? origin.mode;
  const propertyType = overrides.propertyType ?? detected.propertyType ?? origin.propertyType;
  const beds = overrides.beds ?? detected.beds ?? origin.beds;
  const baths = overrides.baths ?? detected.baths ?? origin.baths ?? 1;
  const parking = overrides.parking ?? detected.parking ?? origin.parking ?? 0;
  const areaTouched = overrides.area != null || detected.area != null;
  const area = areaTouched ? (overrides.area ?? detected.area) : origin.area;
  let budget = origin.budget;
  let minBudget = origin.minBudget || 0;
  if (overrides.budget != null) {
    budget = overrides.budget;
    if (overrides.minBudget != null) minBudget = overrides.minBudget;
  } else if (detected.budget != null) {
    budget = detected.budget;
    minBudget = 0;
  } else if ((overrides.mode != null || detected.mode != null) && mode !== origin.mode) {
    budget = mode === 'rent' ? 28000 : 7500000;
    minBudget = 0;
  }
  const criteria = [...new Set([
    ...(detected.criteria || []).filter(id => !hiddenCriteria.includes(id)),
    ...extraCriteria,
  ])].slice(0, 12);
  const places = combinePlaces(detected.places, extraPlaces, hiddenPlaceKeys);
  const placesTouched = places.length > 0 || hiddenPlaceKeys.length > 0;
  const areas = placesTouched ? areasFromPlaces(places) : (areaTouched ? (area === 'Ambas zonas' ? [] : [area]) : (origin.areas || []));
  return {
    ...origin,
    mode, beds, baths, parking, budget, minBudget,
    area:placesTouched ? (areas[0] || 'Ambas zonas') : area,
    areas,
    address:placesTouched ? addressFromPlaces(places) : (areaTouched ? '' : (origin.address || '')),
    note:String(note || '').slice(0, 600),
    criteria, fromIdea:false,
    ...(propertyType ? {propertyType} : {}),
    ...(placesTouched ? {places} : {}),
  };
}
