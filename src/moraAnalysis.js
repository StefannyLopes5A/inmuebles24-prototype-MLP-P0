import {homes as catalog, listingPrice} from './data.js';
import {pricePerM2, travelMinutes, zonePricePerM2} from './compareReading.js';
import {listingDetails} from './listingPresentation.js';
import {homeCoordinates} from './mapLocations.js';
import {coloniaVision} from './mapWidgetContent.js';
import {nearbyPois, poisFor} from './pois.js';
import {criterionLabel, matchesCriteria} from './searchCriteria.js';
import {seed} from './listingAdvertiser.js';
import {cachedReading, photoProof, selectReading, clearReadingCache} from './moraInsights.js';
import {listingVerdict} from './moraVerdict.js';

// Days on market, price drops, comparables and commute times are prototype figures seeded per listing.
const ZONE_DAYS = 37;
const FALLBACK_M2 = {buy:[32000, 70000], rent:[250, 560]};
const MAX_CRITERIA = 6;
const STATUS_ORDER = {met:0, seen:1, unmet:2, unknown:3};

/** Drop the session memory of openings, so a new visit does not inherit the last reading. */
export const resetMoraSession = clearReadingCache;

const roundTo = (value, step) => Math.max(step, Math.round(value / step) * step);
const trim = value => String(Number(value.toFixed(1)));
const mxn = amount => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0}).format(amount);
export const shortMoney = amount => amount >= 1e6 ? `$${trim(amount / 1e6)}M` : amount >= 1e3 ? `$${trim(amount / 1e3)}k` : `$${Math.round(amount)}`;

export const ZONE_MEDIAN_DAYS = ZONE_DAYS;

export function marketFacts(home) {
  const n = seed(`market|${home.id}`);
  const price = listingPrice(home);
  const ppm2 = pricePerM2(home);
  const [low, high] = FALLBACK_M2[home.mode] || FALLBACK_M2.buy;
  const zone = zonePricePerM2(home) ?? roundTo(low + n % (high - low), home.mode === 'rent' ? 10 : 500);
  const step = home.mode === 'rent' ? 1 : 100;
  const median = roundTo(zone * (0.8 + (n % 19) / 100), step);
  const dropped = n % 3 === 0;
  const days = 6 + (n % 110);
  const colonia = coloniaVision(home.area);
  return {
    price, ppm2, median,
    p10: roundTo(median * 0.64, step),
    p90: roundTo(median * 1.46, step),
    delta: ppm2 ? ppm2 / median - 1 : null,
    days,
    drop: dropped ? roundTo(price * (0.03 + (n % 5) / 100), home.mode === 'rent' ? 500 : 50000) : null,
    dropDays: dropped ? Math.min(4 + (n % 24), days - 1) : null,
    comparables: 40 + ((n >>> 4) % 220),
    // The colonia's 12-month change is the one the location section and the price history draw.
    trend: colonia?.trend.spoilerPct ?? Number((((n >>> 8) % 90) / 10 - 1.5).toFixed(1)),
  };
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

/** Catalog listings like this one (same operation, close in bedrooms and size), and what sets this one apart from them. */
export function peerFacts(home, inventory = catalog) {
  const peers = inventory.filter(item => item.id !== home.id && item.mode === home.mode && pricePerM2(item)
    && (home.beds == null || item.beds == null || item.beds === home.beds)
    && (!(home.size >= 20) || Math.abs(item.size / home.size - 1) <= 0.25));
  const price = listingPrice(home);
  const cheaper = peers.filter(item => listingPrice(item) <= price * 0.9);
  const savings = cheaper.length ? Math.round(Math.max(...cheaper.map(item => 1 - listingPrice(item) / price)) * 100) : 0;
  const parking = listingDetails(home).parking;
  const usual = median(peers.map(item => listingDetails(item).parking).filter(value => value != null));
  return {count:peers.length, cheaper:cheaper.length, savings, parking, extraParking:parking != null && usual != null && parking - usual >= 1 ? parking - usual : 0};
}

const ASK = {
  furnished:['Vem mobiliado?', '¿Viene amueblado?'],
  unfurnished:['É entregue sem móveis?', '¿Se entrega sin muebles?'],
  security:['Tem portaria 24h?', '¿Tiene vigilancia 24 h?'],
  balcony:['Tem varanda?', '¿Tiene balcón?'],
  gourmet:['A varanda tem churrasqueira?', '¿El balcón tiene asador?'],
  coworking:['O prédio tem coworking?', '¿El edificio tiene coworking?'],
  workspace:['Há espaço para trabalhar em casa?', '¿Hay espacio para trabajar en casa?'],
  beds:['Quantos quartos tem?', '¿Cuántas recámaras tiene?'],
};

/** A search criterion the listing does not mention becomes a question Mora can send with the contact. */
function attentionModule(fit, {say}) {
  const missing = (fit?.criteria || []).filter(item => item.status === 'unknown');
  if (!missing.length) return null;
  const topics = missing.map(item => item.topic || item.label.replace(/,.*$/, '').toLowerCase()).slice(0, 2);
  const question = missing.slice(0, 3).map(item => {
    const known = ASK[item.id];
    return known ? say(known[0], known[1]) : say(`Tem ${item.topic || item.label}?`, `¿Tiene ${item.topic || item.label}?`);
  }).join(' ');
  return {
    kind:'attention',
    text:say(`O anúncio não menciona ${join(topics, 'nem')}, e isso está na sua busca.`, `El anuncio no menciona ${join(topics, 'ni')}, y es parte de lo que buscas.`),
    action:{type:'ask_agency', label:say('Perguntar à imobiliária', 'Preguntar a la inmobiliaria'), question},
    strength:0.8,
  };
}

export function priceClass(facts) {
  const stale = facts.days > 2 * ZONE_DAYS || !!facts.drop;
  if (facts.delta == null) return stale ? 'negotiate' : null;
  if (facts.delta <= -0.35) return 'review';
  if (facts.delta <= -0.12) return 'opportunity';
  if (facts.delta >= 0.12) return stale ? 'negotiate' : 'above';
  return facts.delta > 0 && stale ? 'negotiate' : 'fair';
}

/** Explicit filters and declared preferences; unknown listing facts never count as met. */
export function searchFit(home, search, pref = 'none', {language = 'es-MX', money = mxn, short = shortMoney} = {}) {
  const say = (br, es) => language === 'pt-BR' ? br : es;
  const items = [];
  const areas = (search.areas || []).filter(area => area && area !== 'Ambas zonas');
  if (areas.length) items.push(areas.includes(home.area)
    ? {id:'zone', status:'met', label:home.area}
    : {id:'zone', status:'unmet', label:say('Fora dos seus bairros', 'Fuera de tus zonas')});
  const price = listingPrice(home);
  if (search.budget) {
    if (price > search.budget) items.push({id:'budget', status:'unmet', label:say(`${money(price - search.budget)} acima do orçamento`, `${money(price - search.budget)} arriba de tu presupuesto`)});
    else if (price < (search.minBudget || 0)) items.push({id:'budget', status:'unmet', label:say('Abaixo do seu mínimo', 'Abajo de tu mínimo')});
    else items.push({id:'budget', status:'met', label:say(`Até ${short(search.budget)}`, `Bajo ${short(search.budget)}`)});
  }
  const beds = pref === 'extra' ? Math.max(3, search.beds || 0) : search.beds;
  if (beds) {
    const label = say(`${beds}+ quartos`, `${beds}+ rec.`);
    items.push(home.beds == null
      ? {id:'beds', status:'unknown', label:say('Quartos, sem dado', 'Recámaras, sin dato')}
      : {id:'beds', status:home.beds >= beds ? 'met' : 'unmet', label});
  }
  for (const id of search.criteria || []) {
    const label = criterionLabel(id, language);
    const proof = photoProof(home, id);
    if (matchesCriteria(home, [id])) items.push({id, status:'met', label});
    else if (proof) items.push({id, status:'seen', label, photo:proof.photo, proofKind:proof.kind});
    else items.push({id, status:'unknown', topic:label.toLowerCase(), label:say(`${label}, sem dado`, `${label}, sin dato`)});
  }
  if (pref === 'open') items.push({id:'workspace', status:'unknown', topic:say('espaço de trabalho', 'espacio de trabajo'), label:say('Espaço de trabalho, sem dado', 'Espacio de trabajo, sin dato')});
  if (!items.length) return null;
  const keep = new Set(items.filter(item => item.status !== 'met').slice(0, MAX_CRITERIA).map(item => item.id));
  for (const item of items) if (keep.size < MAX_CRITERIA) keep.add(item.id);
  // Met first, so the filled segments read as a count from the left rather than as a step.
  const criteria = items.filter(item => keep.has(item.id)).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  return {criteria, met:criteria.filter(item => item.status === 'met').length, total:criteria.length};
}

function marketModule(home, facts, kind, peers, {say, money, short}) {
  if (!kind) return null;
  const pct = facts.delta == null ? null : Math.round(Math.abs(facts.delta) * 100);
  const dropped = facts.drop ? say(`baixou ${money(facts.drop)} há ${facts.dropDays} dias`, `bajó ${money(facts.drop)} hace ${facts.dropDays} días`) : null;
  const premium = peers?.extraParking
    ? say(`a diferença vem de ${peers.extraParking} ${peers.extraParking === 1 ? 'vaga' : 'vagas'} a mais que parecidos`, `la diferencia viene de ${peers.extraParking} ${peers.extraParking === 1 ? 'estacionamiento' : 'estacionamientos'} más que parecidos`)
    : null;
  const copy = {
    opportunity: [say('Abaixo do mercado', 'Abajo del mercado'), dropped || say(`${pct}% abaixo de ${facts.comparables} apartamentos comparados em ${home.area}`, `${pct}% abajo de ${facts.comparables} departamentos comparados en ${home.area}`)],
    fair: [say('Na mediana da região', 'En la mediana de la zona'), facts.trend >= 3 ? say(`${home.area} subiu ${facts.trend}% no último ano`, `${home.area} subió ${facts.trend}% en el último año`) : say('em linha com a região', 'en línea con la zona')],
    negotiate: [say('Com margem para negociar', 'Con margen para negociar'), facts.drop ? say(`na região, um anúncio fica ${ZONE_DAYS} dias no ar em média`, `en la zona, un anuncio dura ${ZONE_DAYS} días en promedio`) : say(`a região vende em ${ZONE_DAYS} dias em média; este está há ${facts.days}`, `la zona vende en ${ZONE_DAYS} días en promedio; este lleva ${facts.days}`)],
    above: [say('Acima do mercado', 'Arriba del mercado'), say(`comparado com ${facts.comparables} apartamentos em ${home.area}`, `comparado con ${facts.comparables} departamentos en ${home.area}`)],
    review: [say('Revise antes de visitar', 'Revisar antes de visitar'), say(`m² muito baixo para ${home.area}. Confirme área e estado`, `m² muy bajo para ${home.area}. Confirma superficie y estado`)],
  }[kind];
  const ruler = facts.ppm2 ? {
    ...facts,
    value:facts.ppm2,
    position:Math.min(1, Math.max(0, (facts.ppm2 - facts.p10) / (facts.p90 - facts.p10))),
    range:facts.ppm2 < facts.p10 ? 'below' : facts.ppm2 > facts.p90 ? 'above' : null,
    note:say(`${short(facts.ppm2)}/m², mediana ${short(facts.median)}/m²`, `${short(facts.ppm2)}/m², mediana ${short(facts.median)}/m²`),
  } : null;
  // The tile shows `metric` as the number and `support` as the line that the number does not already say.
  const fell = facts.drop ? {value:say(`Baixou ${money(facts.drop)}`, `Bajó ${money(facts.drop)}`), unit:say(`há ${facts.dropDays} dias`, `hace ${facts.dropDays} días`)} : null;
  const versus = pct != null ? say('vs. a região', 'vs. la zona') : null;
  const compared = say(`comparado com ${facts.comparables} apartamentos em ${home.area}`, `comparado con ${facts.comparables} departamentos en ${home.area}`);
  const zoneDays = say(`a região vende em ${ZONE_DAYS} dias em média`, `la zona vende en ${ZONE_DAYS} días en promedio`);
  const [metric, support] = {
    opportunity: fell ? [fell, pct != null ? say(`${pct}% abaixo de ${facts.comparables} apartamentos em ${home.area}`, `${pct}% abajo de ${facts.comparables} departamentos en ${home.area}`) : compared] : [pct != null ? {value:`−${pct}%`, unit:versus} : null, compared],
    negotiate: [fell || {value:String(facts.days), unit:say('dias no ar', 'días publicado')}, zoneDays],
    above: [pct != null ? {value:`+${pct}%`, unit:versus} : null, premium || compared],
    fair: facts.trend >= 3 ? [{value:`+${facts.trend}%`, unit:say('em 12 meses', 'en 12 meses')}, say(`preço de ${home.area} no último ano`, `precio de ${home.area} en el último año`)] : [null, copy[1]],
    review: [null, copy[1]],
  }[kind];
  const strength = {review:0.95, opportunity:0.55 + (pct || 0) / 100 + (facts.drop ? 0.3 : 0), negotiate:0.5 + (facts.drop ? 0.2 : 0), above:0.45, fair:0.25}[kind];
  return {kind:'opportunity', priceClass:kind, label:copy[0], evidence:copy[1], metric, support, ruler, strength};
}

function favoritesModule(home, favorites, {say}) {
  const others = favorites.filter(item => item && item.id !== home.id);
  if (!others.length) return null;
  const price = listingPrice(home);
  const priceGap = item => Math.abs(listingPrice(item) / price - 1);
  const similar = others.filter(item => item.mode === home.mode && ((item.area === home.area && priceGap(item) <= 0.4)
    || (home.size >= 20 && item.size >= 20 && Math.abs(item.size / home.size - 1) <= 0.25 && priceGap(item) <= 0.3)));
  if (similar.length) {
    const sameZone = similar.every(item => item.area === home.area);
    const average = similar.reduce((sum, item) => sum + listingPrice(item), 0) / similar.length;
    const diff = price / average - 1, pct = Math.round(Math.abs(diff) * 100);
    const why = sameZone ? say('mesmo bairro', 'misma zona') : say('tamanho e preço parecidos', 'tamaño y precio parecidos');
    const delta = pct < 5 ? say('preço parecido', 'precio parecido') : diff < 0 ? say(`${pct}% mais barato`, `${pct}% más barato`) : say(`${pct}% mais caro`, `${pct}% más caro`);
    const count = similar.length;
    const first = similar[0];
    const rooms = count === 1 && home.beds != null && first.beds != null && home.beds !== first.beds ? home.beds - first.beds : 0;
    const extra = rooms ? say(`, com ${Math.abs(rooms)} ${Math.abs(rooms) === 1 ? 'quarto' : 'quartos'} a ${rooms > 0 ? 'mais' : 'menos'}`, `, con ${Math.abs(rooms)} ${Math.abs(rooms) === 1 ? 'recámara' : 'recámaras'} ${rooms > 0 ? 'más' : 'menos'}`) : '';
    return {
      kind:'favorites',
      text:count === 1
        ? say(`Parece com seu favorito em ${first.street}: ${why}, ${delta}${extra}.`, `Se parece a tu favorito en ${first.street}: ${why}, ${delta}${extra}.`)
        : say(`Parece com ${count} dos seus favoritos: ${why}, ${delta}.`, `Se parece a ${count} de tus favoritos: ${why}, ${delta}.`),
      favoriteIds:similar.slice(0, 3).map(item => item.id),
      similar:true,
      strength:0.45 + Math.min(3, count) * 0.12,
    };
  }
  if (others.length < 2) return null;
  const sized = others.filter(item => item.size >= 20);
  const averageSize = sized.length ? sized.reduce((sum, item) => sum + item.size, 0) / sized.length : null;
  const parts = [];
  if (averageSize && home.size >= 20 && home.size / averageSize >= 1.25) parts.push(say('maior', 'más grande'));
  if (averageSize && home.size >= 20 && home.size / averageSize <= 0.75) parts.push(say('menor', 'más chico'));
  if (!others.some(item => item.area === home.area)) parts.push(say('em outro bairro', 'en otra zona'));
  if (!parts.length) return null;
  return {
    kind:'favorites',
    text:say(`É diferente do que você costuma salvar: ${parts.join(' e ')}.`, `Es distinto a lo que sueles guardar: ${parts.join(' y ')}.`),
    favoriteIds:others.slice(0, 3).map(item => item.id),
    similar:false,
    strength:0.35,
  };
}

const DECLARED_PLACE = /(trabajo|trabalho|oficina|escrit[oó]rio)\s+(?:en|em|na|no)\s+([\p{Lu}][\p{L}]+(?:\s[\p{Lu}][\p{L}]+)?)/u;
const MENTIONS_SCHOOL = /\b(hij[oa]s?|niñ[oa]s?|escuelas?|colegios?|filh[oa]s?|crianças?|escolas?)\b/iu;
const PLACE_KINDS = [['metro', 'transport'], ['escola', 'education'], ['parque', 'green'], ['supermercado', 'grocery'], ['cafe', 'food'], ['hospital', 'health'], ['bar_restaurante', 'restaurant'], ['comercio', 'shop']];
const MAX_PLACES = 5;
const MAX_WALK = 18;
export const placeName = (category, name) => category === 'metro' ? `Metro ${name.split('/')[0].replace(/\s+L\d+$/, '').trim()}` : name;
/** Car minutes to a place the person declared. Seeded per listing, shared with the fact sheet so both say the same number. */
export const declaredMinutes = (home, place) => 12 + seed(`${home.id}|${place}`) % 24;

/** Places the person declared come first; real nearby points follow, and schools only when they were mentioned. */
function surroundingsModule(home, search, {say}) {
  const items = [];
  const note = search?.note || '';
  const declared = note.match(DECLARED_PLACE);
  if (declared) {
    const office = /oficina|escrit/i.test(declared[1]);
    const minutes = declaredMinutes(home, declared[2]);
    items.push({icon:'work', minutes,
      place:office ? say(`Seu escritório em ${declared[2]}`, `Tu oficina en ${declared[2]}`) : say(`Seu trabalho em ${declared[2]}`, `Tu trabajo en ${declared[2]}`),
      time:say(`${minutes} min de carro`, `${minutes} min en auto`),
      text:office
      ? say(`${minutes} min de carro até seu escritório em ${declared[2]}`, `${minutes} min en auto a tu oficina en ${declared[2]}`)
      : say(`${minutes} min de carro até seu trabalho em ${declared[2]}`, `${minutes} min en auto a tu trabajo en ${declared[2]}`)});
  }
  const point = homeCoordinates(home);
  const schools = MENTIONS_SCHOOL.test(note);
  for (const [category, icon] of PLACE_KINDS) {
    if (category === 'escola' && !schools) continue;
    const poi = nearbyPois(point, poisFor(null, [category]), {radius:2500, limit:1})[0];
    if (!poi) continue;
    const meters = Math.round(poi.properties.meters * 1.3);
    const walk = travelMinutes(meters, 'walk');
    if (walk > MAX_WALK) continue;
    const name = placeName(category, poi.properties.name);
    items.push({icon, minutes:walk, place:name, time:say(`${walk} min a pé`, `${walk} min a pie`), text:say(`${walk} min a pé até ${name}`, `${walk} min caminando a ${name}`)});
  }
  const picked = items.slice(0, MAX_PLACES);
  if (!picked.length) return null;
  const metro = picked.find(item => item.icon === 'transport');
  return {kind:'surroundings', items:picked.map(({icon, place, time, text}) => ({icon, place, time, text})), strength:declared ? 0.7 : metro && metro.minutes <= 8 ? 0.6 : 0.3};
}

const join = (parts, and) => parts.length < 2 ? parts[0] || '' : `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;

const FOCUS_LINE = {
  photos:['Vendo as fotos…', 'Viendo las fotos…'],
  text:['Lendo o que o anúncio diz…', 'Leyendo lo que dice el anuncio…'],
  neighborhood:['Vendo como se vive no bairro…', 'Viendo cómo se vive en la colonia…'],
  results:['Situando entre os seus resultados…', 'Ubicándolo entre tus resultados…'],
  favorites:['Comparando com os seus favoritos…', 'Comparando con tus favoritos…'],
  attention:['Separando o que vale perguntar antes de visitar…', 'Separando lo que vale preguntar antes de visitar…'],
};

/** What Mora says about one listing for this person. The sentence crosses two dimensions; price is only one of them. */
export function moraAnalysis(home, {search = {}, pref = 'none', favorites = [], hasSearch = true, stage = 'exploring', language = 'es-MX', money = mxn, short = shortMoney} = {}) {
  const key = JSON.stringify({
    id:home.id, search, pref, favorites:(favorites || []).map(item => item?.id), hasSearch, stage, language, money:money(1_000_000),
  });
  return cachedReading(key, () => {
    const say = (br, es) => language === 'pt-BR' ? br : es;
    const tools = {say, money, short};
    const facts = marketFacts(home);
    const kind = priceClass(facts);
    const peers = peerFacts(home);
    const fit = hasSearch ? searchFit(home, search, pref, {language, money, short}) : null;
    const attention = attentionModule(fit, tools);
    const favoritesInsight = hasSearch ? favoritesModule(home, favorites, tools) : null;
    const surroundings = surroundingsModule(home, hasSearch ? search : null, tools);
    const reading = selectReading(home, {
      say, search:hasSearch ? search : null, pref, home, facts, peers, stage, language,
      priceModule:marketModule(home, facts, kind, peers, tools),
      favoritesModule:favoritesInsight,
      surroundings,
      attentionModule:attention,
    });
    const commute = surroundings?.items[0]?.icon === 'work';
    const focus = FOCUS_LINE[reading.lead];
    const around = commute ? say('Calculando o trajeto até seu trabalho…', 'Calculando el trayecto a tu trabajo…')
      : focus ? say(focus[0], focus[1])
      : surroundings ? say(`Vendo o que há a pé em ${home.area}…`, `Viendo qué hay a pie en ${home.area}…`) : null;
    return {
      workingLines:[say(`Comparando com ${facts.comparables} apartamentos em ${home.area}…`, `Comparando con ${facts.comparables} departamentos en ${home.area}…`), around].filter(Boolean).slice(0, 2),
      synthesis:reading.synthesis,
      verdict:listingVerdict(home, {facts, peers, search:hasSearch ? search : null, fit, surroundings, attention, short, say}),
      dimensions:reading.dimensions,
      match:fit || undefined,
      modules:reading.modules,
      priceClass:kind,
      surroundings:surroundings || null,
      favorites:favoritesInsight?.similar ? favoritesInsight : null,
      peers,
      market:facts,
      attention,
    };
  });
}
