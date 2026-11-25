/**
 * What Mora answers about this listing in the mini-listing chat, beyond the market questions: fair price, how long it has
 * been up, the area's trend, the real monthly cost, how it stacks up against similar listings, what is missing, what is
 * around, what it is like to live there, the commute, how many people are looking, what to ask on a visit, and whether
 * it fits the person's budget. Pure and local; every figure is the one the listing page already shows, and what the
 * catalog does not say stays "por confirmar". Nothing here changes a filter or sends anything.
 */
import {listingPrice, money} from './data.js';
import {listingDetails} from './listingPresentation.js';
import {listingFacts, listingNeighborhood, listingPlaces} from './listingStory.js';
import {marketFacts, moraAnalysis, peerFacts, ZONE_MEDIAN_DAYS} from './moraAnalysis.js';
import {photoReading} from './moraInsights.js';
import {listingHighlights, DEMAND_HOURS} from './listingHighlights.js';
import {fairPriceScore} from './fairPrice.js';
import {COST_DEFAULTS, INCOME_SHARE, purchaseCosts} from './purchaseCosts.js';
import {sectionReading} from './selectionAsk.js';

export const LISTING_TOPICS = ['fair', 'stale', 'trend', 'tco', 'compare', 'catch', 'walk', 'vibe', 'commute', 'demand', 'brief', 'afford'];

const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const say = language => (br, es) => language === 'pt-BR' ? br : es;
const first = text => text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}`.replace(/[.\s]+$/, '') : '';
const join = (parts, and) => parts.length < 2 ? parts[0] || '' : `${parts.slice(0, -1).join(', ')} ${and} ${parts.at(-1)}`;
const illustrative = s => s('Referência ilustrativa', 'Referencia ilustrativa');

/** Most specific first: a question about visits or budget must not fall into "what is nearby". */
const PATTERNS = [
  ['brief', /que (?:le )?(?:pregunt\w*|debo preguntar)|preguntas? (?:para|de) (?:la )?visita|prepar\w* (?:mi |la )?(?:consulta|visita)|o que (?:devo )?perguntar|roteiro de visita/],
  ['afford', /alcanza|presupuesto|orcamento|ingresos?|cuanto (?:necesito )?ganar|puedo pagar|pagarlo|asequib|sueldo|salario|consigo pagar|cabe no (?:meu )?orcamento|me cabe/],
  ['commute', /trabajo|oficina|traslado|trayecto|cuanto tardo|universidad|trabalho|escritorio|deslocamento|chegar (?:ao|no)/],
  ['tco', /costo mensual|costo real|gastos|cuanto pago al mes|mensualidad|predial|iptu|mantenimiento|custo mensal|custos|condominio/],
  ['demand', /competencia|competitiv|mucha gente|muchas personas|viendo|interesad|muita gente|de olho|visualizacion|urgencia|apurar|alta demanda|concorrencia|visualizac|procura/],
  ['stale', /cuanto (?:tiempo )?lleva|publicad|dias (?:en el mercado|no ar)|bajado de precio|bajo de precio|rebaj|negoci|margen para|regate|desconto|descuento|baixou/],
  ['fair', /buen precio|bom preco|preco (?:e )?justo|precio (?:es )?justo|preco justo|puntaje|score|pontuacao|\bcaro\b|\bcara\b|barato|barata|vale la pena|vale a pena|por metro|m2|m²/],
  ['trend', /plusvalia|valoriz|revalor|tendencia|tendencia|historial|historico|evolucion|liquidez|cuanto tarda en venderse|demora para vender/],
  ['catch', /\bpros\b|contras|que falta|que debo confirmar|por confirmar|a confirmar|trampa|riesgo|desventaj|ventaj|ascensor|elevador|o que falta|o que confirmar|prós|contras/],
  ['compare', /compar\w*|parecid|alternativ|similar|mejor opcion|cual conviene|otras opciones|melhor opcao/],
  ['vibe', /como es vivir|ambiente|tranquil|ruido|seguridad|\bseguro\b|vecin|vida nocturna|como e morar|como e viver|barulho|vizinh|\bvibe\b/],
  ['walk', /cerca|caminar|a pie|a pe\b|supermercado|escuela|escola|parque|hospital|farmacia|\bmetro\b|transporte|alrededor|entorno|perto/],
];

/** The topic a typed question is about, or null. Market topics (notary, guarantee, credit) are matched before this. */
export function listingTopic(text = '') {
  const folded = fold(text);
  return PATTERNS.find(([, pattern]) => pattern.test(folded))?.[0] || null;
}

const QUESTIONS = {
  fair:['É um bom preço?', '¿Es un buen precio?'],
  stale:['Dá para negociar o preço?', '¿Hay margen para negociar?'],
  trend:['A região está valorizando?', '¿La zona se está revalorizando?'],
  tco:['Qual é o custo mensal real?', '¿Cuál es el costo mensual real?'],
  compare:['Como ele se compara aos parecidos?', '¿Cómo se compara con parecidos?'],
  catch:['O que falta confirmar?', '¿Qué falta por confirmar?'],
  walk:['O que tem perto a pé?', '¿Qué hay cerca a pie?'],
  vibe:['Como é viver aqui?', '¿Cómo es vivir aquí?'],
  commute:['Quanto levo até meu trabalho?', '¿Cuánto tardo a mi trabajo?'],
  demand:['Tem muita gente de olho?', '¿Hay mucha gente interesada?'],
  brief:['O que perguntar na visita?', '¿Qué preguntar en la visita?'],
  afford:['Cabe no meu orçamento?', '¿Cabe en mi presupuesto?'],
};

/** The chip that asks a topic. Both the chat's suggestions and its follow-ups use these. */
export function topicQuestion(topic, language = 'es-MX') {
  const pair = QUESTIONS[topic];
  return pair ? say(language)(pair[0], pair[1]) : null;
}

/** The next few topics after this one, so the chips keep moving through what Mora can read. */
export function nextTopics(topic, count = 3) {
  const at = Math.max(0, LISTING_TOPICS.indexOf(topic));
  return Array.from({length:count}, (_, step) => LISTING_TOPICS[(at + 1 + step) % LISTING_TOPICS.length]);
}

/** What the catalog does not publish, as short labels with the question that would settle each. */
export function missingFacts(home, language = 'es-MX') {
  if (!home || home.development) return [];
  const s = say(language);
  const details = listingDetails(home);
  const items = [];
  if (details.parking == null) items.push({id:'parking', label:s('vaga', 'estacionamiento'), question:s('Tem vaga? Quantas e cobertas?', '¿Tiene estacionamiento? ¿Cuántos y techados?')});
  if (details.floor == null) items.push({id:'elevator', label:s('andar e elevador', 'piso y elevador'), question:s('Em que andar fica e há elevador?', '¿En qué piso está y hay elevador?')});
  if (details.pets == null) items.push({id:'pets', label:s('pets', 'mascotas'), question:s('Aceita animais?', '¿Acepta mascotas?')});
  if (!(home.size >= 20)) items.push({id:'size', label:s('área', 'superficie'), question:s('Quantos m² tem de área útil?', '¿Cuántos m² tiene de superficie útil?')});
  if (home.fee == null) items.push({id:'fee', label:s('condomínio', 'mantenimiento'), question:s('Quanto é o condomínio e o que inclui?', '¿Cuánto es el mantenimiento y qué incluye?')});
  items.push(home.mode === 'rent'
    ? {id:'deposit', label:s('depósito', 'depósito'), question:s('Que depósito e garantia pedem?', '¿Qué depósito y garantía piden?')}
    : {id:'tax', label:s('IPTU', 'predial'), question:s('Quanto é o IPTU por ano e está em dia?', '¿Cuánto es el predial al año y está al corriente?')});
  return items;
}

const BAND = {
  review:['muito abaixo do mercado', 'muy por debajo del mercado'],
  below:['abaixo do mercado', 'por debajo del mercado'],
  fair:['preço justo', 'precio justo'],
  above:['acima do mercado', 'por encima del mercado'],
};

function fairReading(home, s, language) {
  const fair = fairPriceScore(home);
  const base = sectionReading('price', home, language)?.text;
  if (!fair) return base ? {text:base} : null;
  const label = BAND[fair.band][language === 'pt-BR' ? 0 : 1];
  return {text:`${s('Pontuação de preço justo', 'Puntaje de precio justo')}: ${fair.score}/100, ${label}. ${base || ''}`.trim(), note:illustrative(s)};
}

function staleReading(home, s, language) {
  const offer = sectionReading('offer', home, language);
  if (offer) return {text:offer.text};
  const facts = marketFacts(home);
  const drop = facts.drop ? s(` Já baixou ${money(facts.drop)} há ${facts.dropDays} dias.`, ` Ya bajó ${money(facts.drop)} hace ${facts.dropDays} días.`) : '';
  return {text:s(`Está há ${facts.days} dias no ar; na região, um anúncio dura ${ZONE_MEDIAN_DAYS} em média.${drop}`, `Lleva ${facts.days} días publicado; en la zona un anuncio dura ${ZONE_MEDIAN_DAYS} en promedio.${drop}`), note:illustrative(s)};
}

function trendReading(home, s, language) {
  const history = sectionReading('history', home, language);
  const facts = marketFacts(home);
  const pace = facts.days > ZONE_MEDIAN_DAYS * 2
    ? s(` Na região, um anúncio leva uns ${ZONE_MEDIAN_DAYS} dias para sair; este já passou muito disso.`, ` En la zona un anuncio tarda unos ${ZONE_MEDIAN_DAYS} días en salir; este ya pasó de sobra.`)
    : s(` Na região, um anúncio leva uns ${ZONE_MEDIAN_DAYS} dias para sair, e este está dentro disso.`, ` En la zona un anuncio tarda unos ${ZONE_MEDIAN_DAYS} días en salir, y este va dentro de eso.`);
  if (history) return {text:history.text + pace, note:illustrative(s)};
  const hood = listingNeighborhood(home)?.(language);
  if (!hood) return null;
  const direction = {up:s('em alta', 'al alza'), down:s('em baixa', 'a la baja'), flat:s('estável', 'estable')}[hood.trend.direction];
  return {text:s(`A valorização de ${hood.name} em 12 meses está ${direction}.`, `La plusvalía de ${hood.name} en 12 meses va ${direction}.`) + pace, note:illustrative(s)};
}

function tcoReading(home, s, language) {
  const price = listingPrice(home);
  const fee = listingFacts(home).fee;
  const estimated = home.fee == null ? s(' O condomínio é uma estimativa: confirme com a imobiliária.', ' El mantenimiento es una estimación: confírmalo con la inmobiliaria.') : '';
  if (home.mode === 'rent') {
    if (!(price > 0) || !(fee > 0)) return null;
    return {text:s(`Aluguel ${money(price)} mais ${money(fee)} de condomínio, se não estiver incluído: ${money(price + fee)} por mês.${estimated}`, `Renta de ${money(price)} más ${money(fee)} de mantenimiento, si no está incluido: ${money(price + fee)} al mes.${estimated}`), note:illustrative(s)};
  }
  if (!(price > 0)) return null;
  const costs = purchaseCosts({offer:price});
  const {years} = COST_DEFAULTS;
  return {text:s(
    `Com 20% de entrada, a parcela fica em ${money(costs.monthly)} por ${years} anos. Somando ${money(fee)} de condomínio, o custo mensal real é ${money(costs.monthly + fee)}, fora o IPTU, que está por confirmar.${estimated}`,
    `Con 20% de enganche, la mensualidad queda en ${money(costs.monthly)} a ${years} años. Sumando ${money(fee)} de mantenimiento, el costo mensual real es ${money(costs.monthly + fee)}, sin contar el predial, que está por confirmar.${estimated}`), note:illustrative(s)};
}

const LIGHT = {alta:['muita luz natural', 'mucha luz natural'], media:['luz natural razoável', 'luz natural media'], baja:['pouca luz natural', 'poca luz natural']};
const CONDITION = {remodelado:['acabamentos reformados', 'acabados remodelados'], bueno:['bom estado', 'buen estado'], 'para actualizar':['acabamentos para atualizar', 'acabados para actualizar']};

function compareReading(home, s, language) {
  const peers = peerFacts(home);
  const idx = language === 'pt-BR' ? 0 : 1;
  if (!peers.count) return {text:s('Não tenho parecidos no catálogo com o mesmo tamanho e número de quartos para comparar de verdade. Posso olhar por m² ou pelos seus favoritos.', 'No tengo parecidos en el catálogo con el mismo tamaño y número de recámaras para comparar de verdad. Puedo mirarlo por m² o con tus favoritos.')};
  const bits = [];
  bits.push(peers.cheaper
    ? s(`${peers.cheaper} de ${peers.count} parecidos custam menos, o mais barato ${peers.savings}% menos`, `${peers.cheaper} de ${peers.count} parecidos cuestan menos, el más barato ${peers.savings}% menos`)
    : s(`nenhum dos ${peers.count} parecidos custa pelo menos 10% menos`, `ninguno de los ${peers.count} parecidos cuesta al menos 10% menos`));
  if (peers.extraParking) bits.push(s(`este tem ${peers.extraParking} ${peers.extraParking === 1 ? 'vaga' : 'vagas'} a mais`, `este tiene ${peers.extraParking} ${peers.extraParking === 1 ? 'estacionamiento' : 'estacionamientos'} más`));
  const reading = photoReading(home);
  if (reading) {
    const photo = [LIGHT[reading.light]?.[idx], CONDITION[reading.condition]?.[idx]].filter(Boolean);
    if (photo.length) bits.push(s(`nas fotos, ${join(photo, 'e')}`, `en fotos, ${join(photo, 'y')}`));
  }
  const text = s(`Frente aos parecidos no catálogo: ${join(bits, 'e')}.`, `Frente a los parecidos del catálogo: ${join(bits, 'y')}.`);
  return {text:text.charAt(0).toUpperCase() + text.slice(1)};
}

function catchReading(home, s, language, search) {
  const analysis = moraAnalysis(home, {search, language});
  const facts = analysis?.verdict?.facts || [];
  const plus = facts.filter(fact => fact.polarity === 'plus' && fact.title).slice(0, 3).map(fact => first(fact.title));
  const minus = facts.filter(fact => fact.polarity === 'minus' && fact.title).slice(0, 3).map(fact => first(fact.title));
  const missing = missingFacts(home, language).slice(0, 4).map(item => item.label);
  const parts = [];
  if (plus.length) parts.push(s(`A favor: ${join(plus, 'e')}.`, `A favor: ${join(plus, 'y')}.`));
  if (minus.length) parts.push(s(`Para pesar: ${join(minus, 'e')}.`, `A considerar: ${join(minus, 'y')}.`));
  if (missing.length) parts.push(s(`O anúncio não confirma: ${join(missing, 'e')}.`, `El anuncio no confirma: ${join(missing, 'y')}.`));
  return parts.length ? {text:parts.join(' ')} : null;
}

const KIND = [['metro', ['metrô', 'metro']], ['supermercado', ['mercado', 'súper']], ['parque', ['parque', 'parque']], ['escola', ['escola', 'escuela']]];

const shortName = name => {const base = String(name).split(/ - |\//)[0].trim(); return base.length > 36 ? `${base.slice(0, 34).trim()}…` : base;};

function walkReading(home, s, language) {
  const places = listingPlaces(home).places.filter(place => !place.invented && Number.isFinite(place.minutes));
  const idx = language === 'pt-BR' ? 0 : 1;
  const bits = [];
  for (const [categoria, names] of KIND) {
    const nearest = places.filter(place => place.categoria === categoria).sort((a, b) => a.minutes - b.minutes)[0];
    if (nearest) bits.push(`${names[idx]} ${shortName(nearest.name)} ${s('a', 'a')} ${nearest.minutes} min`);
  }
  if (!bits.length) return {text:s('Não tenho lugares marcados a menos de uma caminhada curta deste imóvel.', 'No tengo lugares marcados a una caminata corta de este inmueble.')};
  return {text:s(`A pé: ${join(bits, 'e')}.`, `A pie: ${join(bits, 'y')}.`)};
}

function vibeReading(home, s, language) {
  const hood = listingNeighborhood(home)?.(language);
  if (!hood) return null;
  const bar = id => hood.bars.find(item => item.id === id)?.value;
  const quiet = bar('quiet'), walk = bar('walk');
  const figures = [
    quiet != null && s(`tranquilo à noite ${quiet}/100`, `tranquilo de noche ${quiet}/100`),
    walk != null && s(`tudo a pé ${walk}/100`, `todo a pie ${walk}/100`),
  ].filter(Boolean);
  return {text:`${hood.reading}${figures.length ? ` ${s('Nos mapas', 'En los mapas')}: ${join(figures, s('e', 'y'))}.` : ''}`};
}

function commuteReading(home, s, language, search) {
  const analysis = moraAnalysis(home, {search, language});
  const work = analysis?.surroundings?.items?.find(item => item.icon === 'work');
  if (work) return {text:s(`${work.time} até ${first(work.place)}.`, `${work.time} a ${first(work.place)}.`), note:illustrative(s)};
  const hood = listingNeighborhood(home)?.(language);
  const base = hood ? s(`Até ${hood.commute.destination} são uns ${hood.commute.minutes} min em transporte. `, `Hasta ${hood.commute.destination} son unos ${hood.commute.minutes} min en transporte. `) : '';
  return {text:base + s('Para o seu trajeto, escreva seu trabalho ou faculdade na busca, como «trabalho em Reforma», e eu calculo.', 'Para tu trayecto, escribe tu trabajo o universidad en la búsqueda, como «trabajo en Reforma», y lo calculo.'), note:hood ? illustrative(s) : null};
}

function demandReading(home, s) {
  const demand = listingHighlights(home).demand;
  const facts = marketFacts(home);
  if (demand) {
    const times = demand.factor.toFixed(1).replace('.', ',');
    return {text:s(`Tem ${times}x mais visualizações e favoritos que o bairro nas últimas ${DEMAND_HOURS} h. Se gostou, vale contatar logo.`, `Tiene ${times}x más visualizaciones y favoritos que el barrio en las últimas ${DEMAND_HOURS} h. Si te gustó, conviene contactar pronto.`), note:illustrative(s)};
  }
  return {text:s(`Não vejo procura fora do normal: está há ${facts.days} dias no ar e o ritmo é o da região. Não há pressa especial.`, `No veo demanda fuera de lo normal: lleva ${facts.days} días publicado y el ritmo es el de la zona. No hay prisa especial.`), note:illustrative(s)};
}

function briefReading(home, s, language) {
  const asks = missingFacts(home, language).slice(0, 3).map(item => item.question);
  const checks = [s('luz natural no fim da tarde', 'luz natural al final de la tarde'), s('barulho da rua no horário de pico', 'ruido de la calle en hora pico'), s('pressão da água e umidade', 'presión del agua y humedad')];
  return {text:s(`Para perguntar à imobiliária: ${asks.join(' ')} Para ver na visita: ${join(checks, 'e')}.`, `Para preguntar a la inmobiliaria: ${asks.join(' ')} Para ver en la visita: ${join(checks, 'y')}.`)};
}

function affordReading(home, s, search) {
  const price = listingPrice(home);
  if (!(price > 0)) return null;
  const budget = search?.budget > 0 && search.mode === home.mode ? search.budget : null;
  const fit = budget
    ? price <= budget
      ? s(` Está dentro do seu teto de ${money(budget)}.`, ` Queda dentro de tu tope de ${money(budget)}.`)
      : s(` Passa ${money(price - budget)} do seu teto de ${money(budget)}.`, ` Se pasa ${money(price - budget)} de tu tope de ${money(budget)}.`)
    : '';
  const share = Math.round(INCOME_SHARE * 100);
  if (home.mode === 'rent') return {text:s(`Costumam pedir renda de uns três aluguéis: para ${money(price)}, uns ${money(price * 3)} por mês.${fit}`, `Suelen pedir ingresos de unas tres rentas: para ${money(price)}, unos ${money(price * 3)} al mes.${fit}`), note:illustrative(s)};
  const costs = purchaseCosts({offer:price});
  return {text:s(
    `Com 20% de entrada (${money(costs.enganche)}), a parcela é ${money(costs.monthly)}. Pela regra de não passar de ${share}% da renda, convém ganhar uns ${money(costs.income)} por mês.${fit}`,
    `Con 20% de enganche (${money(costs.enganche)}), la mensualidad es ${money(costs.monthly)}. Con la regla de no pasar de ${share}% del ingreso, conviene ganar unos ${money(costs.income)} al mes.${fit}`), note:illustrative(s)};
}

/** `{text, note, think}` for a topic about this listing, or null when the listing lacks what the topic needs. */
export function topicReading(topic, home, {language = 'es-MX', search = {}} = {}) {
  if (!home || home.development || !LISTING_TOPICS.includes(topic)) return null;
  const s = say(language);
  const reading = {
    fair:() => fairReading(home, s, language),
    stale:() => staleReading(home, s, language),
    trend:() => trendReading(home, s, language),
    tco:() => tcoReading(home, s, language),
    compare:() => compareReading(home, s, language),
    catch:() => catchReading(home, s, language, search),
    walk:() => walkReading(home, s, language),
    vibe:() => vibeReading(home, s, language),
    commute:() => commuteReading(home, s, language, search),
    demand:() => demandReading(home, s),
    brief:() => briefReading(home, s, language),
    afford:() => affordReading(home, s, search),
  }[topic]();
  if (!reading) return null;
  return {text:reading.text, note:reading.note || null};
}

