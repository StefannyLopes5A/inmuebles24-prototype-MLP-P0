import readings from './data/listing-reading.json' with {type:'json'};
import {listingText} from './listingText.js';
import {listingPrice} from './data.js';
import {pricePerM2} from './compareReading.js';
import {listingDetails} from './listingPresentation.js';
import {coloniaVision, textOf} from './mapWidgetContent.js';
import {prototypeResults} from './journey.js';

/** Closed vocabulary for the curated photo catalog. `photo` is the 1-based gallery index. */
export const PHOTO_LIGHT = ['alta', 'media', 'baja'];
export const PHOTO_VIEW = ['ciudad', 'verde', 'calle', 'interior'];
export const PHOTO_CONDITION = ['remodelado', 'bueno', 'para actualizar'];
export const PHOTO_SPACES = ['terraza', 'balcón', 'jardín', 'cocina', 'baño', 'recámara', 'estudio', 'alberca', 'gimnasio', 'roof', 'estacionamiento'];
export const PHOTO_MISSING = ['baños', 'cocina', 'recámara'];

const SPACE_LABEL = {
  terraza:['terraço', 'terraza'], balcón:['varanda', 'balcón'], jardín:['jardim', 'jardín'],
  cocina:['cozinha', 'cocina'], baño:['banheiro', 'baño'], recámara:['quarto', 'recámara'],
  estudio:['estúdio', 'estudio'], alberca:['piscina', 'alberca'], gimnasio:['academia', 'gimnasio'],
  roof:['roof', 'roof'], estacionamiento:['vaga', 'estacionamiento'],
};

const session = {cache:new Map(), molds:new Map(), named:new Set(), recent:[], results:new Map()};

/** Forget what Mora already said. Tests and a fresh page load start clean; the app keeps one session. */
export function resetMoraSession() {
  session.cache.clear();
  session.molds.clear();
  session.named.clear();
  session.recent = [];
  session.results.clear();
}

export function photoReading(home) {
  const reading = home?.photoSetId ? readings[home.photoSetId] : null;
  return reading && reading.light ? reading : null;
}

const spaceOf = (reading, kind) => reading?.spaces?.find(item => item.kind === kind) || null;

/** A photo can show a search criterion without turning it into a confirmed fact. */
export function photoProof(home, criterionId) {
  const reading = photoReading(home);
  if (!reading) return null;
  if (criterionId === 'furnished' && reading.furnished === true) {
    return {photo:spaceOf(reading, 'recámara')?.photo || reading.spaces?.[0]?.photo || 1, kind:'amueblado'};
  }
  if (criterionId === 'unfurnished' && reading.furnished === false) {
    return {photo:spaceOf(reading, 'recámara')?.photo || 1, kind:'sin muebles'};
  }
  if (criterionId === 'balcony') {
    const space = spaceOf(reading, 'balcón') || spaceOf(reading, 'terraza');
    return space ? {photo:space.photo, kind:space.kind} : null;
  }
  return null;
}

/**
 * Sentence shape, so two listings that only swap a number or a place name count as the same mold.
 * Used by selection and by the repetition test.
 */
export function synthesisMold(text) {
  return String(text || '')
    .replace(/\$[\d.,]+|\d+%?|\d+/g, '#')
    .replace(/\b(en|de|del|a|para)\s+[A-ZÁÉÍÓÚÑ][^,;.]*/g, '$1 #')
    .replace(/\s+/g, ' ')
    .trim();
}

const cap = text => text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';

const resultsFor = search => {
  const key = JSON.stringify({
    mode:search?.mode, areas:search?.areas, budget:search?.budget, minBudget:search?.minBudget,
    beds:search?.beds, criteria:search?.criteria, note:search?.note, address:search?.address, propertyType:search?.propertyType,
  });
  if (!session.results.has(key)) session.results.set(key, search ? prototypeResults(search) : []);
  return session.results.get(key);
};

const traitOf = home => {
  const text = listingText(home);
  const reading = photoReading(home);
  const ids = new Set(text.attributes.map(item => item.id));
  for (const space of reading?.spaces || []) {
    if (space.kind === 'terraza' || space.kind === 'roof') ids.add('terrace');
    if (space.kind === 'balcón') ids.add('balcony');
    if (space.kind === 'alberca') ids.add('pool');
    if (space.kind === 'jardín') ids.add('garden');
  }
  if (reading?.view === 'ciudad') ids.add('view');
  return ids;
};

const relevanceFor = (dimension, {search, pref, home, facts}) => {
  const criteria = new Set(search?.criteria || []);
  const note = search?.note || '';
  const visual = criteria.has('balcony') || criteria.has('furnished') || criteria.has('unfurnished') || criteria.has('gourmet');
  const work = /trabajo|trabalho|oficina|escrit/i.test(note);
  const family = pref === 'extra' || (search?.beds || 0) >= 3 || /hij|niñ|escuela|filh|crian|escola/i.test(note);
  const price = listingPrice(home);
  const tight = search?.budget && price >= search.budget * 0.9;
  const base = {
    photos:visual ? 0.95 : 0.5,
    text:visual ? 0.88 : 0.48,
    neighborhood:criteria.has('security') ? 0.96 : family ? 0.84 : 0.52,
    commute:work ? 1 : family ? 0.94 : 0.5,
    price:tight || (facts?.delta != null && Math.abs(facts.delta) >= 0.12) ? 0.86 : 0.5,
    results:0.62,
    favorites:0.58,
    attention:0.9,
    pattern:0.72,
  }[dimension] ?? 0.4;
  return base;
};

const galleryPhoto = (home, photo) => {
  const gallery = listingDetails(home).gallery || [];
  const index = Math.min(gallery.length, Math.max(1, photo || 1)) - 1;
  return {index, src:gallery[index] || home.image};
};

/**
 * One photo judgment, tied to the search. An empty room is still a bedroom.
 * Never an inventory of “en la foto N se ve…”.
 */
function photoJudgment(home, ctx) {
  const reading = photoReading(home);
  if (!reading) return null;
  const {say, search} = ctx;
  const criteria = new Set(search?.criteria || []);
  const label = kind => say(SPACE_LABEL[kind]?.[0] || kind, SPACE_LABEL[kind]?.[1] || kind);
  const shot = space => space?.photo || reading.spaces?.[0]?.photo || 1;
  if (criteria.has('furnished') && reading.furnished === false) {
    return {polarity:'minus', photo:shot(spaceOf(reading, 'recámara')), clause:say('pelas fotos, as recámaras parecem vazias', 'por las fotos, las recámaras se ven vacías')};
  }
  if (criteria.has('unfurnished') && reading.furnished === true) {
    return {polarity:'minus', photo:shot(spaceOf(reading, 'recámara')), clause:say('pelas fotos, parece mobiliado', 'por las fotos, parece amueblado')};
  }
  const balcony = criteria.has('balcony') ? photoProof(home, 'balcony') : null;
  if (balcony) {
    return {polarity:'plus', photo:balcony.photo, clause:say(`pelas fotos, parece ter ${label(balcony.kind)}`, `por las fotos, parece tener ${label(balcony.kind)}`)};
  }
  if (reading.condition === 'para actualizar') {
    return {polarity:'minus', photo:shot(spaceOf(reading, 'cocina')), clause:say('pelas fotos, a cozinha parece pedir obra', 'por las fotos, la cocina parece pedir obra')};
  }
  if (reading.missing?.includes('baños')) {
    return {polarity:'minus', photo:1, clause:say('pelas fotos, não aparecem os banheiros', 'por las fotos, no aparecen los baños')};
  }
  if (reading.missing?.includes('cocina')) {
    return {polarity:'minus', photo:1, clause:say('pelas fotos, não aparece a cozinha', 'por las fotos, no aparece la cocina')};
  }
  const amenity = ['alberca', 'roof', 'terraza', 'balcón', 'jardín', 'gimnasio'].map(kind => spaceOf(reading, kind)).find(Boolean);
  if (amenity) {
    return {polarity:'plus', photo:amenity.photo, clause:say(`pelas fotos, parece ter ${label(amenity.kind)}`, `por las fotos, parece tener ${label(amenity.kind)}`)};
  }
  if (reading.condition === 'remodelado') {
    return {polarity:'plus', photo:shot(spaceOf(reading, 'cocina')), clause:say('pelas fotos, os acabamentos parecem novos', 'por las fotos, los acabados se ven nuevos')};
  }
  return null;
}

function photoCandidates(home, ctx) {
  const judgment = photoJudgment(home, ctx);
  if (!judgment) return [];
  const {say} = ctx;
  const {index, src} = galleryPhoto(home, judgment.photo);
  return [candidate(home, ctx, {
    dimension:'photos', polarity:judgment.polarity, mold:`photos:${synthesisMold(judgment.clause)}`, confidence:0.8,
    relevance:judgment.polarity === 'minus' ? 0.84 : 0.72,
    clause:judgment.clause,
    module:{kind:'photos', dimension:'photos', photo:judgment.photo, image:src, index, text:cap(judgment.clause) + '.', action:{type:'open_photo', photo:judgment.photo}},
  })];
}

/** A title claim is not a widget. If it says the place needs work, the sentence says what the photos show. */
function remodelClause(home, say) {
  const reading = photoReading(home);
  const claim = say('o anúncio diz que é para reformar', 'el anuncio dice que es para remodelar');
  if (!reading) return say(`${claim}, mas não mostra o que falta fazer`, `${claim}, pero no muestra qué falta hacer`);
  if (reading.condition === 'remodelado') return say(`${claim}, mas as fotos mostram acabamento novo. Vale perguntar o que ainda falta`, `${claim}, pero las fotos muestran acabados nuevos. Vale preguntar qué falta`);
  if (reading.condition === 'para actualizar') {
    const kitchen = spaceOf(reading, 'cocina');
    return kitchen
      ? say(`${claim}: pelas fotos, a cozinha é o que pede obra`, `${claim}: por las fotos, la cocina es lo que pide obra`)
      : say(`${claim}: pelas fotos, os acabamentos pedem obra`, `${claim}: por las fotos, los acabados piden obra`);
  }
  return say(`${claim}. Pelas fotos o estado está razoável; confirme o que ainda falta`, `${claim}. Por las fotos el estado se ve razonable; confirma qué falta`);
}

function textCandidates(home, ctx) {
  const text = listingText(home);
  const {say} = ctx;
  const out = [];
  if (text.attributes.some(item => item.id === 'to-remodel')) {
    out.push(candidate(home, ctx, {
      dimension:'text', mold:'text:to-remodel', confidence:0.88,
      clause:remodelClause(home, say),
      module:null,
    }));
  }
  const lead = text.attributes.find(item => ['penthouse', 'roof', 'loft', 'terrace', 'levels', 'pool', 'view', 'remodeled'].includes(item.id));
  if (lead) {
    out.push(candidate(home, ctx, {
      dimension:'text', mold:`text:${lead.id}`, confidence:0.6,
      clause:say(`o anúncio fala em ${lead.pt}`, `el anuncio habla de ${lead.es}`),
      module:null,
    }));
  }
  if (text.inconsistencies.includes('beds')) {
    const rooms = String(home.title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/(\d+)\s*recamaras?/);
    const named = rooms ? say(`${rooms[1]} no título e ${home.beds} na ficha`, `${rooms[1]} en el título y ${home.beds} en la ficha`) : say('números que não fecham', 'números que no coinciden');
    out.push(candidate(home, ctx, {
      dimension:'text', mold:'text:beds', confidence:0.7,
      clause:say(`os quartos não fecham: ${named}`, `las recámaras no coinciden: ${named}`),
      module:null,
    }));
  }
  if (text.inconsistencies.includes('furnished') || text.inconsistencies.includes('condition')) {
    out.push(candidate(home, ctx, {
      dimension:'text', mold:'text:clash', confidence:0.7,
      clause:say('o título afirma duas coisas opostas sobre o estado', 'el título afirma dos cosas opuestas sobre el estado'),
      module:null,
    }));
  }
  return out;
}

function neighborhoodCandidates(home, ctx) {
  const vision = coloniaVision(home.area);
  if (!vision) return [];
  const {say} = ctx;
  const quiet = vision.neighbors?.quiet ?? 60;
  const park = (vision.nearby?.pois || []).find(item => item.kind === 'green');
  const parkMin = park?.walk;
  const parks = vision.nearby?.parks;
  const band = vision.safetyBand || (vision.feelSafe >= 70 ? 'high' : vision.feelSafe >= 48 ? 'mid' : 'low');
  const versus = band === 'high' ? say('acima', 'por encima') : band === 'low' ? say('abaixo', 'por debajo') : say('perto', 'cerca');
  let clause;
  let detail;
  let mold;
  if (quiet >= 68 && parkMin && parkMin <= 10) {
    mold = 'neighborhood:quiet-park';
    clause = say(`rua mais calma que a média de ${home.area}, com parque a ${parkMin} min`, `calle más tranquila que el promedio de ${home.area}, con parque a ${parkMin} min`);
    detail = say(`Rua mais calma que a média de ${home.area}, com parque a ${parkMin} min.`, `Calle más tranquila que el promedio de ${home.area}, con parque a ${parkMin} min.`);
  } else if (quiet < 50) {
    mold = 'neighborhood:noise';
    clause = say(`mais ruído noturno que a média de ${home.area}`, `más ruido nocturno que el promedio de ${home.area}`);
    detail = say(`Mais ruído noturno que a média de ${home.area}.`, `Más ruido nocturno que el promedio de ${home.area}.`);
  } else if (parkMin && parkMin <= 10 && parks >= 3) {
    mold = 'neighborhood:parks';
    clause = say(`${parks} parques na zona; o mais perto fica a ${parkMin} min`, `${parks} parques en la zona; el más cercano queda a ${parkMin} min`);
    detail = say(`${parks} parques na zona; o mais perto fica a ${parkMin} min.`, `${parks} parques en la zona; el más cercano queda a ${parkMin} min.`);
  } else {
    mold = `neighborhood:safety-${band}`;
    clause = say(`em ${vision.alcaldia}, a percepção de segurança fica ${versus} da média da CDMX`, `en ${vision.alcaldia}, la percepción de seguridad queda ${versus} del promedio de CDMX`);
    detail = say(`Em ${vision.alcaldia}, a percepção de segurança fica ${versus} da média da CDMX.`, `En ${vision.alcaldia}, la percepción de seguridad queda ${versus} del promedio de CDMX.`);
  }
  const plus = (vision.neighbors?.plus || []).slice(0, 1).map(item => textOf(item, ctx.language));
  const minus = (vision.neighbors?.minus || []).slice(0, 1).map(item => textOf(item, ctx.language));
  return [candidate(home, ctx, {
    dimension:'neighborhood', mold, clause, confidence:0.8,
    module:{kind:'neighborhood', dimension:'neighborhood', text:detail, plus, minus},
  })];
}

function commuteCandidate(home, ctx) {
  const surroundings = ctx.surroundings;
  const first = surroundings?.items?.[0];
  if (!first) return [];
  return [candidate(home, ctx, {
    dimension:'commute', mold:first.icon === 'work' ? 'commute:work' : `commute:${first.icon}`,
    clause:first.text.replace(/\.$/, '').charAt(0).toLowerCase() + first.text.replace(/\.$/, '').slice(1),
    confidence:first.icon === 'work' ? 0.7 : 0.85,
    module:{...surroundings, dimension:'commute'},
  })];
}

function priceCandidate(home, ctx) {
  const {facts, peers, say, priceModule} = ctx;
  if (!priceModule || facts?.delta == null) return [];
  const pct = Math.round(Math.abs(facts.delta) * 100);
  let mold = 'price:fair';
  let clause = say('o m² está na mediana de parecidos', 'su m² está en la mediana de parecidos');
  if (facts.delta <= -0.35) {
    mold = 'price:review';
    clause = say('o m² fica muito abaixo da zona; confirme a área antes de visitar', 'el m² queda muy por debajo de la zona; confirma la superficie antes de visitar');
  } else if (facts.delta <= -0.12) {
    mold = 'price:low';
    clause = say(`custa ${pct}% menos por m² que parecidos`, `cuesta ${pct}% menos por m² que parecidos`);
  } else if (facts.delta >= 0.12 && peers?.extraParking) {
    mold = 'price:parking';
    clause = say(`${pct}% acima de parecidos, pelas vagas a mais`, `${pct}% arriba de parecidos, por los estacionamientos extra`);
  } else if (facts.delta >= 0.12 && facts.drop) {
    mold = 'price:drop';
    clause = say(`está ${pct}% acima e baixou há ${facts.dropDays} dias`, `está ${pct}% arriba y bajó hace ${facts.dropDays} días`);
  } else if (facts.delta >= 0.12 && facts.days > 74) {
    mold = 'price:stale';
    clause = say(`está ${pct}% acima e há ${facts.days} dias no ar`, `está ${pct}% arriba y lleva ${facts.days} días publicado`);
  } else if (facts.delta >= 0.12) {
    mold = 'price:high';
    clause = say(`está ${pct}% acima de parecidos`, `está ${pct}% arriba de parecidos`);
  } else if (facts.drop) {
    mold = 'price:cut';
    clause = say(`baixou há ${facts.dropDays} dias: há margem para negociar`, `bajó hace ${facts.dropDays} días: hay margen para negociar`);
  }
  return [candidate(home, ctx, {dimension:'price', mold, clause, confidence:0.9, module:{...priceModule, dimension:'price'}})];
}

function resultsCandidate(home, ctx) {
  const {say, search} = ctx;
  if (!search) return [];
  const results = resultsFor(search);
  if (results.length < 2) return [];
  const mine = traitOf(home);
  const counts = new Map();
  for (const item of results) for (const trait of traitOf(item)) counts.set(trait, (counts.get(trait) || 0) + 1);
  const labels = {
    terrace:['terraço próprio', 'terraza propia'], balcony:['varanda', 'balcón'], pool:['piscina', 'alberca'],
    garden:['jardim', 'jardín'], view:['vista aberta', 'vista abierta'], penthouse:['penthouse', 'penthouse'],
    roof:['roof garden', 'roof garden'], loft:['loft', 'loft'],
  };
  const rare = [...mine].filter(trait => labels[trait] && (counts.get(trait) || 0) / results.length <= 0.2)
    .sort((a, b) => (counts.get(a) || 0) - (counts.get(b) || 0));
  if (rare.length) {
    const trait = rare[0];
    const count = counts.get(trait) || 1;
    const name = say(labels[trait][0], labels[trait][1]);
    const clause = count === 1
      ? say(`o único dos seus ${results.length} resultados com ${name}`, `el único de tus ${results.length} resultados con ${name}`)
      : say(`um dos poucos resultados com ${name}`, `de los pocos resultados con ${name}`);
    return [candidate(home, ctx, {
      dimension:'results', mold:`results:${trait}`, clause, confidence:0.85, rare:count / results.length < 0.15,
      module:null,
    })];
  }
  const ranked = results.filter(item => pricePerM2(item)).sort((a, b) => pricePerM2(a) - pricePerM2(b));
  const rank = ranked.findIndex(item => item.id === home.id);
  if (rank < 0 || rank > 2) return [];
  const clause = rank === 0
    ? say('o m² mais baixo dos seus resultados', 'el m² más bajo de tus resultados')
    : rank === 1
      ? say('o segundo m² mais baixo dos seus resultados', 'el segundo m² más bajo de tus resultados')
      : say('entre os m² mais baixos dos seus resultados', 'entre los m² más bajos de tus resultados');
  return [candidate(home, ctx, {
    dimension:'results', mold:`results:m2-${rank}`, clause, confidence:0.85,
    module:null,
  })];
}

function favoritesCandidate(home, ctx) {
  if (!ctx.favoritesModule) return [];
  const text = ctx.favoritesModule.text.replace(/\.$/, '');
  return [candidate(home, ctx, {
    dimension:'favorites', mold:ctx.favoritesModule.similar ? 'favorites:like' : 'favorites:unlike',
    clause:text.charAt(0).toLowerCase() + text.slice(1),
    confidence:0.8,
    module:{...ctx.favoritesModule, dimension:'favorites'},
  })];
}

function attentionCandidate(home, ctx) {
  if (!ctx.attentionModule) return [];
  const text = ctx.attentionModule.text.replace(/\.$/, '');
  return [candidate(home, ctx, {
    dimension:'attention', mold:'attention:gap',
    clause:text.charAt(0).toLowerCase() + text.slice(1),
    confidence:0.9,
    module:{...ctx.attentionModule, dimension:'attention'},
  })];
}

function patternCandidate(home, ctx) {
  const {say, search} = ctx;
  if (!search?.budget) return [];
  const results = resultsFor(search);
  if (results.length < 8) return [];
  const over = results.filter(item => listingPrice(item) > search.budget).length / results.length;
  if (over < 0.6 || listingPrice(home) <= search.budget || session.named.has('overBudget')) return [];
  return [candidate(home, ctx, {
    dimension:'pattern', mold:'pattern:budget', confidence:0.95, pattern:'overBudget',
    clause:say('como a maioria dos seus resultados, está acima do seu orçamento', 'como la mayoría de tus resultados, está arriba de tu presupuesto'),
    module:null,
  })];
}

function candidate(home, ctx, fields) {
  const clause = String(fields.clause || '').replace(/\s+/g, ' ').trim();
  const relevance = fields.relevance ?? relevanceFor(fields.dimension, ctx);
  if (ctx.stage === 'deciding' && fields.dimension === 'attention') fields = {...fields, relevance:Math.max(relevance, 0.98)};
  if (ctx.stage === 'deciding' && fields.dimension === 'price') fields = {...fields, relevance:Math.max(relevance, 0.92)};
  const used = session.molds.get(fields.mold) || 0;
  const recent = session.recent[0] === fields.mold ? 0.35 : session.recent.includes(fields.mold) ? 0.7 : 1;
  const rare = fields.rare ? 1.35 : 1;
  const novelty = (used >= 4 ? 0.05 : 1 - used * 0.18) * recent * rare;
  const weight = fields.relevance ?? relevance;
  return {...fields, clause, relevance:weight, novelty, priority:weight * Math.max(0.05, novelty) * fields.confidence};
}

/** One sentence. A photo point joins the search; it does not open a second inventory. */
function connectorFor(left, right) {
  const molds = `${left?.mold || ''} ${right?.mold || ''}`;
  const photo = [left, right].find(item => item?.dimension === 'photos');
  const other = photo === left ? right : left;
  if (photo?.polarity === 'minus' && !/price:(high|stale|drop|parking|review)/.test(other?.mold || '')) return ', pero';
  if (photo?.polarity === 'plus' && /price:(high|stale|drop|parking|review)|attention:/.test(other?.mold || '')) return ', pero';
  return /price:(high|stale|drop|parking|review)|attention:|pattern:|text:(beds|clash|to-remodel)/.test(molds) ? ', pero' : ' y';
}

/** Each dimension stays a complete thought. A contrast can share one sentence; otherwise the reading is two sentences and can run long. */
function joinClauses(left, right, connector, say) {
  const finish = text => {
    const clean = String(text || '').replace(/\.$/, '').trim();
    return clean ? `${cap(clean)}.` : '';
  };
  const first = finish(left.clause);
  const second = finish(right.clause);
  if (!first || !second) return null;
  if (connector === ';') return `${first} ${second}`;
  const lowered = second.charAt(0).toLowerCase() + second.slice(1);
  const link = connector === ', pero' ? say(', mas ', ', pero ') : say(' e ', ' y ');
  return `${first.slice(0, -1)}${link}${lowered}`;
}

/** The walk list and the street reading are one location card: the sentence on top, the tags under it, the places inside. */
function foldLocation(modules) {
  const hood = modules.find(item => item.kind === 'neighborhood');
  const places = modules.find(item => item.kind === 'surroundings');
  if (!hood || !places) return modules;
  const merged = {...hood, items:places.items};
  let used = false;
  return modules.flatMap(item => {
    if (item !== hood && item !== places) return [item];
    if (used) return [];
    used = true;
    return [merged];
  });
}

function pickModules(ranked) {
  const chosen = [];
  const dims = new Set();
  for (const item of ranked) {
    if (!item.module || dims.has(item.dimension)) continue;
    if (item.dimension === 'price' && chosen.some(entry => entry.dimension === 'price')) continue;
    chosen.push(item);
    dims.add(item.dimension);
  }
  const order = ['price', 'neighborhood', 'commute', 'favorites', 'photos', 'attention'];
  const rank = dimension => {
    const index = order.indexOf(dimension);
    return index < 0 ? order.length : index;
  };
  chosen.sort((a, b) => rank(a.dimension) - rank(b.dimension));
  return chosen.map(item => item.module);
}

/**
 * Two different dimensions for the sentence. Every widget with data stays on the card; nothing is dropped to fit a count.
 * A fact true of most of the result list does not open the sentence except once.
 */
export function selectReading(home, ctx) {
  const say = ctx.say;
  const ranked = [
    ...photoCandidates(home, ctx),
    ...textCandidates(home, ctx),
    ...neighborhoodCandidates(home, ctx),
    ...commuteCandidate(home, ctx),
    ...priceCandidate(home, ctx),
    ...resultsCandidate(home, ctx),
    ...favoritesCandidate(home, ctx),
    ...attentionCandidate(home, ctx),
    ...patternCandidate(home, ctx),
  ].sort((a, b) => b.priority - a.priority);
  const pairs = [];
  for (const left of ranked.slice(0, 8)) {
    for (const right of ranked.slice(0, 8)) {
      if (left.dimension === right.dimension) continue;
      const ordered = left.dimension === 'photos' && right.dimension !== 'photos' ? [right, left] : [left, right];
      const connector = connectorFor(ordered[0], ordered[1]);
      const text = joinClauses(ordered[0], ordered[1], connector, say);
      if (!text) continue;
      const mold = synthesisMold(text);
      const count = session.molds.get(mold) || 0;
      if (count >= 4) continue;
      pairs.push({text, mold, left:ordered[0], right:ordered[1], score:(ordered[0].priority + ordered[1].priority) * (1 - count * 0.2)});
    }
  }
  const bestOf = list => [...list].sort((a, b) => b.score - a.score)[0] || null;
  const touches = (pair, item) => pair.left === item || pair.right === item;
  const photo = ranked.find(item => item.dimension === 'photos');
  const results = ranked.find(item => item.dimension === 'results');
  const attention = ranked.find(item => item.dimension === 'attention');
  const remodel = ranked.find(item => item.mold === 'text:to-remodel');
  const price = ranked.find(item => item.dimension === 'price');
  const restates = photo && results && /balcón|terraza|alberca|jardín|varanda|terraço|piscina|jardim/.test(`${photo.clause} ${results.clause}`)
    && ['balcón', 'terraza', 'alberca', 'jardín', 'varanda', 'terraço', 'piscina', 'jardim'].filter(word => photo.clause.includes(word) && results.clause.includes(word)).length > 0;
  const best = (photo && results && !restates && bestOf(pairs.filter(pair => touches(pair, photo) && touches(pair, results))))
    || (photo && attention && bestOf(pairs.filter(pair => touches(pair, photo) && touches(pair, attention))))
    || (photo && price && bestOf(pairs.filter(pair => touches(pair, photo) && touches(pair, price))))
    || (remodel && price && bestOf(pairs.filter(pair => touches(pair, remodel) && touches(pair, price))))
    || (photo && bestOf(pairs.filter(pair => touches(pair, photo))))
    || (results && bestOf(pairs.filter(pair => touches(pair, results))))
    || bestOf(pairs) || {
    text:cap(ranked[0]?.clause || say('em ' + home.area, 'en ' + home.area)) + '.',
    mold:synthesisMold(ranked[0]?.clause || home.id),
    left:ranked[0],
    right:ranked[1] || ranked[0],
  };
  session.molds.set(best.mold, (session.molds.get(best.mold) || 0) + 1);
  for (const side of [best.left, best.right]) {
    if (side?.mold) session.recent.unshift(side.mold);
    if (side?.pattern) session.named.add(side.pattern);
  }
  session.recent = session.recent.slice(0, 8);
  const modules = foldLocation(pickModules(ranked));
  const dimensions = [...new Set([best.left?.dimension, best.right?.dimension].filter(Boolean))];
  return {synthesis:best.text, dimensions, modules, lead:best.left?.dimension || 'price'};
}

const analysisCache = new Map();

export function cachedReading(key, compute) {
  if (analysisCache.has(key)) return analysisCache.get(key);
  const value = compute();
  analysisCache.set(key, value);
  return value;
}

export function clearReadingCache() {
  analysisCache.clear();
  resetMoraSession();
}
