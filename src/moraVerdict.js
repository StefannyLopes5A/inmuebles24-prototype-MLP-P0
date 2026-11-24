import agencies from '../AGENCY-SOURCES.json' with {type:'json'};
import {listingPrice} from './data.js';
import {advertiserFor, advertiserHighlight, seed} from './listingAdvertiser.js';
import {listingText} from './listingText.js';
import {photoReading} from './moraInsights.js';
import {listingHighlights} from './listingHighlights.js';

const MAX_FACTS = 3;
const MAX_SENTENCE = 150;
const OUTDOOR = ['roof', 'terraza', 'alberca', 'jardín', 'balcón'];
const OUTDOOR_TEXT = {roof:'roof', terraza:'terrace', alberca:'pool', jardín:'garden', balcón:'balcony'};
const OUTDOOR_LABEL = {
  roof:['roof garden', 'roof garden'],
  terraza:['terraço', 'terraza'],
  alberca:['piscina', 'alberca'],
  jardín:['jardim', 'jardín'],
  balcón:['varanda', 'balcón'],
};
const HAS = [['Tem', 'Tiene'], ['Conta com', 'Cuenta con'], ['Inclui', 'Incluye']];
const WITH = [['com', 'con'], ['com direito a', 'con su']];
const TEXT_LABEL = {
  penthouse:['É penthouse', 'Es penthouse', 'penthouse', 'penthouse'],
  levels:['Tem dois andares', 'Tiene dos niveles', 'em dois andares', 'en dos niveles'],
  loft:['É tipo loft', 'Es tipo loft', 'tipo loft', 'tipo loft'],
  view:['Vista', 'Vista', 'com vista', 'con vista'],
};
const MISSING = {
  cocina:['Sem fotos da cozinha', 'Sin fotos de la cocina', 'a cozinha não aparece', 'no se ve la cocina'],
  baños:['Sem fotos dos banheiros', 'Sin fotos de los baños', 'os banheiros não aparecem', 'no se ven los baños'],
};

/**
 * Same meaning, different words: each listing draws its own wording from these sets, stable per `home.id`,
 * and a rotor hands out notes in turn so two facts in one card never share a line.
 */
const PHOTO_NOTE = [['Pelas fotos', 'Por las fotos'], ['Aparece nas fotos', 'Se ve en las fotos'], ['As fotos mostram', 'Las fotos lo muestran'], ['Dá para ver nas fotos', 'Salta a la vista en las fotos']];
const TEXT_NOTE = [['Diz o anúncio', 'Lo dice el anuncio'], ['Segundo o anúncio', 'Según el anuncio'], ['Está na descrição', 'Viene en la descripción']];
const BOTH_NOTE = [['No anúncio e nas fotos', 'En el anuncio y las fotos'], ['Anúncio e fotos confirmam', 'Lo confirman anuncio y fotos']];
const PEERS = [['parecidos', 'parecidos'], ['similares', 'similares'], ['comparáveis', 'comparables']];
const BUT = [['mas', 'pero'], ['porém', 'aunque'], ['só que', 'solo que']];

function wording(home, say) {
  const turns = {};
  const pick = (slot, options) => {
    const [br, es] = options[(seed(`${home.id}:${slot}`) + (turns[slot] || 0)) % options.length];
    return say(br, es);
  };
  return {
    pick,
    next: (slot, options) => { const text = pick(slot, options); turns[slot] = (turns[slot] || 0) + 1; return text; },
  };
}

const cap = text => text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : '';
const join = (parts, and) => parts.length < 2 ? parts[0] || '' : `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;

/** What the listing itself shows: the photos first, then what the title claims. Never a search label. */
function placeFacts(home, criteria, say, words) {
  const {pick, next} = words;
  const photoNote = () => next('photo', PHOTO_NOTE), textNote = () => next('text', TEXT_NOTE);
  const reading = photoReading(home);
  const text = listingText(home);
  const claims = new Set(text.attributes.map(item => item.id));
  const out = [];
  if (reading?.condition === 'remodelado' || (claims.has('remodeled') && !claims.has('to-remodel'))) {
    const seen = reading?.condition === 'remodelado';
    out.push({id:'remodeled', icon:'remodel', polarity:'plus', weight:0.8,
      title:pick('remodeled', [['Já está reformado', 'Ya está remodelado'], ['Vem reformado', 'Se entrega remodelado'], ['Reformado e pronto para morar', 'Remodelado y listo para habitar']]),
      note:seen ? pick('finish', [['Pelas fotos, acabamento novo', 'Por las fotos, acabados nuevos'], ['Acabamentos novos nas fotos', 'Acabados nuevos en las fotos'], ['As fotos mostram acabamento recente', 'Las fotos muestran acabados recientes']]) : textNote(),
      phrase:pick('remodeled-phrase', [['reformado', 'remodelado'], ['já reformado', 'ya remodelado'], ['pronto para morar', 'listo para habitar']])});
  }
  if (reading?.condition === 'para actualizar' || claims.has('to-remodel')) {
    out.push({id:'work', icon:'remodel', polarity:'minus', weight:0.85,
      title:pick('work', [['Precisa de reforma', 'Necesita remodelación'], ['Pede reforma', 'Pide remodelación'], ['Vai precisar de obra', 'Va a requerir obra']]),
      note:reading?.condition === 'para actualizar' ? pick('dated', [['Pelas fotos, acabamento antigo', 'Por las fotos, acabados para actualizar'], ['Acabamentos antigos nas fotos', 'Acabados antiguos en las fotos'], ['As fotos mostram acabamento gasto', 'Las fotos muestran acabados gastados']]) : say('O anúncio diz para reformar', 'El anuncio dice para remodelar'),
      clause:reading?.condition === 'para actualizar' ? pick('dated-clause', [['as fotos mostram acabamentos para reformar', 'las fotos muestran acabados para actualizar'], ['os acabamentos pedem reforma', 'los acabados piden renovarse']]) : say('o anúncio diz que é para reformar', 'el anuncio dice que es para remodelar')});
  }
  const outdoor = OUTDOOR.find(kind => reading?.spaces?.some(space => space.kind === kind) || claims.has(OUTDOOR_TEXT[kind]));
  if (outdoor) {
    const both = reading?.spaces?.some(space => space.kind === outdoor) && claims.has(OUTDOOR_TEXT[outdoor]);
    const photo = reading?.spaces?.some(space => space.kind === outdoor);
    const [br, es] = OUTDOOR_LABEL[outdoor];
    const asked = criteria.has('balcony') && (outdoor === 'balcón' || outdoor === 'terraza');
    const [hasBr, hasEs] = HAS[seed(`${home.id}:has`) % HAS.length];
    const [withBr, withEs] = WITH[seed(`${home.id}:with`) % WITH.length];
    out.push({id:'outdoor', icon:'outdoor', polarity:'plus', weight:asked ? 0.95 : 0.75, photo:reading?.spaces?.find(space => space.kind === outdoor)?.photo,
      title:say(`${hasBr} ${br}`, `${hasEs} ${es}`),
      note:both ? pick('both', BOTH_NOTE) : photo ? photoNote() : textNote(),
      phrase:say(`${withBr} ${br}`, `${withEs} ${es}`)});
  }
  for (const id of ['penthouse', 'levels', 'loft']) {
    if (!claims.has(id)) continue;
    const [br, es, phraseBr, phraseEs] = TEXT_LABEL[id];
    out.push({id, icon:'levels', polarity:'plus', weight:0.6, title:say(br, es), note:textNote(), phrase:say(phraseBr, phraseEs)});
    break;
  }
  if (reading?.view === 'ciudad' || reading?.view === 'verde') {
    const green = reading.view === 'verde';
    out.push({id:'view', icon:'view', polarity:'plus', weight:0.6,
      title:green
        ? pick('view', [['Tem vista para o verde', 'Tiene vista a áreas verdes'], ['Dá para áreas verdes', 'Mira hacia áreas verdes'], ['Janelas para o verde', 'Ventanas hacia lo verde']])
        : pick('view', [['Tem vista da cidade', 'Tiene vista a la ciudad'], ['Vista aberta da cidade', 'Vista abierta a la ciudad'], ['Dá para a cidade', 'Mira hacia la ciudad']]),
      note:photoNote(),
      phrase:green
        ? pick('view-phrase', [['com vista para o verde', 'con vista a áreas verdes'], ['de frente para o verde', 'frente a áreas verdes']])
        : pick('view-phrase', [['com vista da cidade', 'con vista a la ciudad'], ['com a cidade na janela', 'con la ciudad en la ventana']])});
  } else if (reading?.light === 'alta') {
    out.push({id:'light', icon:'light', polarity:'plus', weight:0.55,
      title:pick('light', [['Recebe muita luz natural', 'Recibe mucha luz natural'], ['É bem iluminado', 'Es muy luminoso'], ['Entra muita luz natural', 'Entra mucha luz natural']]),
      note:photoNote(), phrase:pick('light-phrase', [['com muita luz', 'con mucha luz'], ['bem iluminado', 'muy luminoso'], ['cheio de luz', 'lleno de luz']])});
  }
  if (criteria.has('furnished') && reading?.furnished === true) {
    out.push({id:'furnished', icon:'furnished', polarity:'plus', weight:0.9, photo:reading.spaces?.find(space => space.kind === 'recámara')?.photo, title:pick('furnished', [['Vem mobiliado', 'Viene amueblado'], ['Já tem móveis', 'Ya tiene muebles'], ['Entregue mobiliado', 'Se entrega amueblado']]), note:photoNote(), phrase:pick('furnished-phrase', [['mobiliado', 'amueblado'], ['já com móveis', 'ya con muebles']])});
  }
  if (criteria.has('furnished') && reading?.furnished === false) {
    out.push({id:'unfurnished', icon:'furnished', polarity:'minus', weight:0.9, title:pick('unfurnished', [['Vem sem móveis', 'Viene sin muebles'], ['Está vazio', 'Está vacío'], ['Não inclui móveis', 'No incluye muebles']]), note:say('Pelas fotos; você pediu mobiliado', 'Por las fotos; pediste amueblado'),
      clause:say('as fotos o mostram sem móveis', 'las fotos lo muestran sin muebles')});
  }
  const missing = (reading?.missing || []).find(kind => MISSING[kind]);
  if (missing) {
    const [br, es, clauseBr, clauseEs] = MISSING[missing];
    out.push({id:'missing', icon:'camera', polarity:'minus', weight:0.7, title:say(br, es), note:pick('missing', [['Vale pedir antes de visitar', 'Vale pedirlas antes de visitar'], ['Peça antes de ir', 'Pídelas antes de ir'], ['Dá para pedir à imobiliária', 'Puedes pedirlas a la inmobiliaria']]), clause:say(clauseBr, clauseEs)});
  }
  return out;
}

/** The first place in the walk list: the commute the person declared, or the closest point that changes a day. */
function aroundFact(surroundings, say, {pick}) {
  const first = surroundings?.items?.[0];
  if (!first) return null;
  const work = first.icon === 'work';
  const minutes = Number(String(first.time).match(/\d+/)?.[0]);
  const near = work || first.icon === 'transport' ? minutes <= 12 || work : minutes <= 8;
  if (!near) return null;
  const phrase = work
    ? say(`a ${first.time} de ${first.place.charAt(0).toLowerCase()}${first.place.slice(1)}`, `a ${first.time} de ${first.place.charAt(0).toLowerCase()}${first.place.slice(1)}`)
    : say(`a ${minutes} min a pé do ${first.place}`, `a ${minutes} min ${first.place.startsWith('Metro') ? 'del' : 'de'} ${first.place}`);
  return {id:'around', icon:first.icon, polarity:'plus', weight:work ? 0.9 : first.icon === 'transport' ? (minutes <= 8 ? 0.82 : 0.7) : 0.5, title:first.time, note:work ? cap(first.place) : pick('around', [[`Até o ${first.place}`, `Hasta ${first.place.startsWith('Metro') ? 'el ' : ''}${first.place}`], [`Para chegar ao ${first.place}`, `Para llegar ${first.place.startsWith('Metro') ? 'al ' : 'a '}${first.place}`]]), phrase};
}

/** Price only as a cause the listing explains: what you pay more, and why. A fair price goes into the sentence, not a badge. */
function priceFact(home, {facts, peers, search, short, say}, {pick}) {
  const price = listingPrice(home);
  const like = pick('peers', PEERS);
  const cheaper = pct => pick('cheaper', [[`${pct}% mais barato que ${like}`, `${pct}% más barato que ${like}`], [`${pct}% mais em conta que ${like}`, `${pct}% más económico que ${like}`], [`${pct}% abaixo de ${like}`, `${pct}% por debajo de ${like}`]]);
  const pricier = pct => pick('pricier', [[`${pct}% mais caro que ${like}`, `${pct}% más caro que ${like}`], [`${pct}% acima de ${like}`, `${pct}% arriba de ${like}`], [`${pct}% por cima de ${like}`, `${pct}% por encima de ${like}`]]);
  const against = count => pick('against', [[`Por m², contra ${count} imóveis ${like}`, `Por m², contra ${count} inmuebles ${like}`], [`Comparado por m² com ${count} imóveis`, `Comparado por m² con ${count} inmuebles`]]);
  if (search?.budget && price > search.budget) {
    const over = short(price - search.budget);
    const ceiling = short(search.budget);
    return {id:'budget', icon:'price', polarity:'minus', weight:1,
      title:pick('budget', [[`${over} acima do seu orçamento`, `${over} arriba de tu presupuesto`], [`${over} além do seu orçamento`, `${over} por encima de tu presupuesto`], [`Passa ${over} do seu orçamento`, `Se pasa ${over} de tu presupuesto`]]),
      note:pick('ceiling', [[`Seu teto é ${ceiling}`, `Tu tope es ${ceiling}`], [`Você busca até ${ceiling}`, `Buscas hasta ${ceiling}`], [`Seu limite: ${ceiling}`, `Tu límite: ${ceiling}`]]),
      clause:pick('budget-clause', [[`está ${over} acima do seu orçamento`, `está ${over} arriba de tu presupuesto`], [`passa ${over} do seu orçamento`, `se pasa ${over} de tu presupuesto`], [`supera seu orçamento em ${over}`, `supera tu presupuesto por ${over}`]]), wait:true};
  }
  if (facts?.delta == null) return null;
  const pct = Math.round(Math.abs(facts.delta) * 100);
  if (facts.delta <= -0.35) {
    return {id:'price', icon:'price', polarity:'minus', weight:0.95, title:cheaper(pct), note:pick('too-cheap', [['Por m²; confirme a área antes de visitar', 'Por m²; confirma la superficie antes de visitar'], ['Por m²; vale checar a área', 'Por m²; vale revisar los metros'], ['Por m²; confirme os metros', 'Por m²; confirma los metros']]),
      clause:pick('too-cheap-clause', [[`o m² fica ${pct}% abaixo de ${like} sem explicação`, `su m² queda ${pct}% abajo de ${like} sin explicación`], [`o m² sai ${pct}% abaixo de ${like} e o anúncio não explica`, `el m² sale ${pct}% abajo de ${like} y el anuncio no explica por qué`]])};
  }
  if (facts.delta >= 0.12) {
    const parking = peers?.extraParking;
    if (parking) {
      return {id:'price', icon:'price', polarity:'minus', weight:0.85, title:pricier(pct),
        note:say(`Por ${parking} ${parking === 1 ? 'vaga' : 'vagas'} a mais`, `Por ${parking} ${parking === 1 ? 'estacionamiento' : 'estacionamientos'} extra`),
        sentence:parking === 1
          ? say(`Os ${pct}% a mais são pela vaga extra.`, `El ${pct}% de más es por el estacionamiento extra.`)
          : say(`Os ${pct}% a mais são pelas vagas extras.`, `El ${pct}% de más es por los estacionamientos extra.`),
        clause:say(`está ${pct}% acima de ${like} pelas vagas a mais`, `está ${pct}% arriba de ${like} por los estacionamientos de más`)};
    }
    if (facts.drop) {
      return {id:'price', icon:'price', polarity:'minus', weight:0.8, title:pricier(pct), note:say(`Mesmo depois de baixar ${short(facts.drop)} há ${facts.dropDays} dias`, `Aun después de bajar ${short(facts.drop)} hace ${facts.dropDays} días`),
        clause:say(`está ${pct}% acima de ${like} mesmo depois de baixar`, `está ${pct}% arriba de ${like} aun después de bajar`)};
    }
    if (facts.days > 74) {
      return {id:'price', icon:'price', polarity:'minus', weight:0.75, title:pricier(pct),
        note:pick('days', [[`Há ${facts.days} dias no ar; dá para negociar`, `Lleva ${facts.days} días publicado; hay margen`], [`${facts.days} dias anunciado; há espaço para negociar`, `${facts.days} días en línea; se puede negociar`]]),
        clause:say(`está ${pct}% acima de ${like} e há ${facts.days} dias no ar`, `está ${pct}% arriba de ${like} y lleva ${facts.days} días publicado`),
        brief:say(`está ${pct}% acima de ${like}`, `está ${pct}% arriba de ${like}`)};
    }
    return {id:'price', icon:'price', polarity:'minus', weight:0.75, title:pricier(pct), note:against(facts.comparables),
      clause:say(`está ${pct}% acima de ${like}`, `está ${pct}% arriba de ${like}`)};
  }
  if (facts.delta <= -0.12) {
    return {id:'price', icon:'price', polarity:'plus', weight:0.85, title:cheaper(pct), note:against(facts.comparables),
      phrase:pick('cheaper-phrase', [[`${pct}% mais barato por m² que ${like}`, `${pct}% más barato por m² que ${like}`], [`com o m² ${pct}% abaixo de ${like}`, `con el m² ${pct}% abajo de ${like}`]])};
  }
  if (facts.drop) {
    return {id:'price', icon:'price', polarity:'plus', weight:0.7, title:pick('drop', [[`O preço baixou ${short(facts.drop)}`, `El precio bajó ${short(facts.drop)}`], [`Já baixou ${short(facts.drop)}`, `Ya bajó ${short(facts.drop)}`], [`${short(facts.drop)} a menos que antes`, `${short(facts.drop)} menos que antes`]]), note:say(`Há ${facts.dropDays} dias`, `Hace ${facts.dropDays} días`),
      phrase:say(`baixou ${short(facts.drop)} há ${facts.dropDays} dias`, `bajó ${short(facts.drop)} hace ${facts.dropDays} días`), dropOnly:true};
  }
  return {id:'fair', polarity:'fair', weight:0};
}

/** The card's highlights told in Mora's rows: a price drop and high demand both read as signals in the listing's favor. */
function highlightFacts(home, short, say) {
  const {drop, demand} = listingHighlights(home);
  const facts = [];
  if (drop) facts.push({id:'drop', icon:'trend-down', polarity:'plus', weight:1.2,
    title:say(`Baixou ${drop.pct}% de preço`, `Bajó ${drop.pct}% de precio`),
    note:say(`Há ${drop.days} dias, de ${short(drop.was)} para ${short(drop.price)}`, `Hace ${drop.days} días, de ${short(drop.was)} a ${short(drop.price)}`)});
  if (demand) {
    const times = demand.factor.toFixed(1).replace('.', ',');
    facts.push({id:'demand', icon:'trend-up', polarity:'plus', weight:1.1,
      title:say('Alta procura', 'Alta demanda'),
      note:say(`${times}x mais visitas e favoritos que o bairro em ${demand.hours} h`, `${times}x más visitas y favoritos que el barrio en ${demand.hours} h`)});
  }
  return facts;
}

/** A search criterion the listing never mentions: one line, and the question Mora brings to the chat. */
function gapFact(fit, covered, say, {pick}) {
  const missing = (fit?.criteria || []).find(item => item.status === 'unknown' && !covered.has(item.id));
  if (!missing) return null;
  const topic = missing.topic || missing.label.replace(/,.*$/, '').toLowerCase();
  return {id:'gap', icon:'unknown', polarity:'minus', weight:0.65,
    title:pick('gap', [[`Não diz se tem ${topic}`, `No dice si tiene ${topic}`], [`Não menciona ${topic}`, `No menciona ${topic}`], [`Sem dados de ${topic}`, `Sin datos de ${topic}`]]),
    note:pick('gap-note', [['Dá para perguntar à Mora', 'Puedes preguntarle a Mora'], ['Pergunte à Mora', 'Pregúntale a Mora'], ['A Mora pode perguntar por você', 'Mora puede preguntarlo por ti']]),
    clause:pick('gap-clause', [[`o anúncio não fala de ${topic}`, `el anuncio no dice nada de ${topic}`], [`o anúncio não menciona ${topic}`, `el anuncio no menciona ${topic}`], [`faltam dados de ${topic}`, `faltan datos de ${topic}`]])};
}

/**
 * Service, told through the reviews the panel shows: what clients praise, plus the WhatsApp speed for Domi advertisers.
 * The host line already has the rating and reply hours, so neither repeats here.
 */
function serviceClause(advertiser, {pick}, say, fast) {
  const topic = say(...advertiserHighlight(advertiser));
  if (!fast) return pick('voice', [[`as avaliações destacam que ${topic}`, `sus reseñas destacan que ${topic}`], [`no Google contam que ${topic}`, `en Google cuentan que ${topic}`], [`os clientes dizem que ${topic}`, `sus clientes dicen que ${topic}`]]);
  const speed = pick('speed', [['respondem rápido no WhatsApp', 'contestan rápido por WhatsApp'], ['atendem rápido', 'atienden rápido'], ['respondem em pouco tempo', 'responden en poco tiempo']]);
  return pick('voice', [[`${speed} e, segundo as avaliações, ${topic}`, `${speed} y, según sus reseñas, ${topic}`], [`${speed}; no Google contam que ${topic}`, `${speed}; en Google cuentan que ${topic}`], [`${speed} e os clientes dizem que ${topic}`, `${speed} y sus clientes dicen que ${topic}`]]);
}

/**
 * The mini-listing reading: what the listing is, what that changes, and one catch if there is one.
 * Search fit and market only pick and explain the facts; they never become a label.
 */
export function listingVerdict(home, {facts, peers, search, fit, surroundings, attention, short, say}) {
  const criteria = new Set(search?.criteria || []);
  const advertiser = advertiserFor(home, agencies.logos);
  const words = wording(home, say);
  const place = placeFacts(home, criteria, say, words);
  const around = aroundFact(surroundings, say, words);
  const price = priceFact(home, {facts, peers, search, short, say}, words);
  const seen = new Set(place.map(item => item.id));
  const covered = new Set([
    ...(seen.has('furnished') || seen.has('unfurnished') ? ['furnished', 'unfurnished'] : []),
    ...(seen.has('outdoor') ? ['balcony'] : []),
  ]);
  const gap = gapFact(fit, covered, say, words);
  const all = [...place, around, price, gap].filter(item => item && item.polarity !== 'fair');
  const byWeight = list => [...list].sort((a, b) => b.weight - a.weight);
  const minus = byWeight(all.filter(item => item.polarity === 'minus'));
  const plus = byWeight(all.filter(item => item.polarity === 'plus'));
  const and = say('e', 'y');
  const catches = minus.slice(0, 2);
  const stance = catches.length >= 2 || catches.some(item => item.wait) ? 'wait' : catches.length ? 'but' : 'go';
  const leads = plus.slice(0, Math.max(1, MAX_FACTS - catches.length));
  const order = ['drop', 'demand', 'remodeled', 'outdoor', 'penthouse', 'levels', 'loft', 'view', 'light', 'furnished', 'work', 'unfurnished', 'missing', 'around', 'gap', 'price', 'budget'];
  const rank = item => order.indexOf(item.id);
  const shown = [...leads, ...catches].slice(0, MAX_FACTS).sort((a, b) => rank(a) - rank(b));
  const leadText = count => cap(join(leads.slice(0, count).sort((a, b) => rank(a) - rank(b)).map(item => item.phrase), and));
  const but = words.pick('but', BUT);
  const fair = words.pick('fair', [['o m² está em linha com parecidos', 'el m² está en línea con parecidos'], ['o preço por m² acompanha a região', 'el precio por m² va con la zona'], ['o m² está na faixa de similares', 'el m² está en el rango de similares']]);
  // 2: speed and reviews, 1: reviews only, 0: no service. The facts come first; service only takes the room left.
  const service = reply => reply === 2 ? serviceClause(advertiser, words, say, true) : reply === 1 ? serviceClause(advertiser, words, say, false) : null;
  const build = (count, reply) => {
    const lead = leadText(count) || say(`Em ${home.area}`, `En ${home.area}`);
    const extra = service(reply);
    if (stance === 'go') {
      const tail = [price?.polarity === 'fair' ? fair : null, extra].filter(Boolean);
      return tail.length ? `${lead}. ${cap(join(tail, and))}.` : `${lead}.`;
    }
    const after = extra ? ` ${cap(extra)}.` : '';
    if (stance === 'wait') {
      const [first, second] = catches;
      const both = second ? `${first.brief || first.clause} ${and} ${second.brief || second.clause}` : first.clause;
      return (leads.length && count > 0 ? `${lead}, ${but} ${both}.` : `${cap(both)}.`) + after;
    }
    const only = catches[0];
    return (only.sentence ? `${lead}. ${only.sentence}` : `${lead}, ${but} ${only.clause}.`) + after;
  };
  const replies = advertiser.domi ? [2, 1, 0] : [1, 0];
  // Service outranks a second lead (the rows below already list it), but never the only one.
  const counts = Array.from({length:leads.length + 1}, (_, i) => leads.length - i);
  const tries = [...replies.filter(Boolean).flatMap(reply => counts.filter(count => count >= Math.min(1, leads.length)).map(count => [count, reply])), ...counts.map(count => [count, 0])];
  const sentence = tries.map(([count, reply]) => build(count, reply)).find(text => text.length <= MAX_SENTENCE) || build(0, false);
  // The card's pills come first: a listing that shows one there says it here too. The drop replaces the price line that only said so.
  const highlights = highlightFacts(home, short, say);
  const hasDrop = highlights.some(item => item.id === 'drop');
  const redundant = item => hasDrop && item.dropOnly;
  const pick = ({id, icon, title, note, polarity, photo}) => ({id, icon, title, note, polarity, photo});
  // The catches that set the stance stay; the highlights take the next slots, then whatever else was shown.
  const kept = shown.filter(item => !redundant(item));
  const cards = [...kept.filter(item => item.polarity === 'minus'), ...highlights, ...kept.filter(item => item.polarity !== 'minus')]
    .slice(0, MAX_FACTS).sort((a, b) => rank(a) - rank(b));
  return {
    stance,
    sentence,
    facts:cards.map(({id, icon, title, note, polarity}) => ({id, icon, title, note, polarity})),
    candidates:[...highlights, ...byWeight(all).filter(item => !redundant(item))].map(pick),
    question:attention?.action?.question || null,
  };
}
