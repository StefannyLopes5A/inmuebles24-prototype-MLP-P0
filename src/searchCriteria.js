import {foldSearchText, detailTokens} from './homeSearchModel.js';
import {parseSearchInput} from './searchInput.js';

export const CRITERIA = [
  {id:'furnished', pt:'Mobiliado', es:'Amueblado', pattern:/\bamueblad[oa]\b|\bmobiliad[oa]\b|\bcom mobilia\b/},
  {id:'unfurnished', pt:'Sem mobília', es:'Sin muebles', pattern:/\bsin muebles\b|\bsem mobilia\b|\bno amueblad[oa]\b|\bnao mobiliad[oa]\b/},
  {id:'security', pt:'Portaria 24h', es:'Vigilancia 24h', pattern:/\b(?:vigilancia|seguridad|portaria|porteria)\s*(?:las\s*)?24\s*(?:h|horas)?\b/},
  {id:'balcony', pt:'Varanda', es:'Balcón', pattern:/\bbalcon\b|\bvaranda\b/},
  {id:'gourmet', pt:'Varanda gourmet', es:'Balcón con asador', pattern:/\b(?:balcon|varanda)\b.*\b(?:asador|gourmet)\b/},
  {id:'coworking', pt:'Coworking', es:'Coworking', pattern:/\bcoworking\b/},
];
export const criterionLabel = (id, language) => CRITERIA.find(item => item.id === id)?.[language === 'pt-BR' ? 'pt' : 'es'] || id.replace(/^text:/, '');
export const normalizeCriteria = value => Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && (CRITERIA.some(c => c.id === item) || /^text:.{1,120}$/u.test(item))).slice(0,12))] : [];
const isQuestion = text => /[?¿]/.test(text) || /^(?:como|qual|quais|onde|por que|o que|quanto|que|cual|cuales|donde|por que|cuanto|sera que|tem algum|hay algun)\b/.test(foldSearchText(text.trim()));

/** The home input and result input must recognize the same explicit details. */
export function criteriaFromText(text = '') {
  if (isQuestion(text)) return [];
  const folded = foldSearchText(text);
  let criteria = CRITERIA.filter(item => item.pattern.test(folded)).map(item => item.id);
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
