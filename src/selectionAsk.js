/**
 * What Mora answers about a piece of text the person selected anywhere in the portal. Pure and local: the lens comes
 * from the question first, then from the selected text; listing facts come from the catalog card around the selection.
 * Nothing here changes the search or sends anything, and what the listing doesn't say stays "a confirmar".
 */
import {listingPrice, money} from './data.js';
import {travelMinutes} from './compareReading.js';
import {listingDetails} from './listingPresentation.js';
import {ATTRIBUTES} from './listingText.js';
import {advertiserFor} from './listingAdvertiser.js';
import {homeCoordinates} from './mapLocations.js';
import {nearbyPois, poisFor} from './pois.js';
import {marketFacts, peerFacts, placeName, priceClass, ZONE_MEDIAN_DAYS} from './moraAnalysis.js';
import {MARKET_TOPICS, marketAnswer, marketQuestion, marketTopic} from './marketAnswers.js';
import {descriptionHighlights, listingNeighborhood} from './listingStory.js';
import {priceHistory} from './priceHistory.js';
import {offerIdeas} from './offerIdeas.js';
import {COST_DEFAULTS, purchaseCosts} from './purchaseCosts.js';

export const SELECTION_MIN = 2;
export const SELECTION_MAX = 280;

const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const plural = (count, one, many) => count === 1 ? one : many;

const QUESTION_LENSES = [
  ['agency', /pregunt\w* a la inmobiliaria|pergunt\w* a imobiliaria/],
  ['price', /\b(?:caro|cara|barat[oa]|precio|preco|vale la pena|vale a pena|cuesta|custa|m2|m²|mercado|negoci\w*)\b/],
  ['distance', /cerca|lejos|camin|a pie\b|a pe\b|\bmetro\b|minut|distancia|perto|longe|transporte|pasos/],
  ['pets', /mascota|perr[oa]|gat[oa]|\bpets?\b|cachorr|animal/],
  ['fee', /mantenimiento|manutencao|cuota|condominio/],
  ['availability', /disponib|\blibre\b|\blivre\b|sigue (?:en|publicad)|ya se (?:rento|vendio)/],
  ['review', /resena|opinion|confiable|avaliac|reputac/],
];

const TEXT_LENSES = [
  ['price', /\$\s?\d|\bmxn\b|\/m²|\/m2|\bprecio\b|\bpreco\b/],
  ['distance', /a (?:unos|pocos) pasos|cerca del? |\bmetro\b|min a pie|min caminando/],
  ['pets', /mascota|pet friendly|\bpets?\b/],
  ['fee', /mantenimiento|condominio/],
  ['availability', /disponib|entrega inmediata/],
  ['jargon', /oportunidad|remate|exclusiv|\bideal\b|de lujo|\bunic[oa]\b|increible|excelente|espectacular|hermos[oa]|impecable/],
];

/** Questions about the text itself ("¿qué significa?"), read through the text's own lens. */
const EXPLAIN = /significa|quiere decir|quer dizer|explica|que es esto|o que e isto|que dice|o que diz|me dices|me diz/;

const JARGON = /oportunidad|remate|exclusiv\w*|\bideal\b|de lujo|\bunic[oa]\b|increible|excelente|espectacular|hermos[oa]|impecable/;

/** The lens Mora reads with. `zone` is where on the page the selection sits (`review` inside the reviews). */
export function selectionLens({text = '', question = '', zone = null} = {}) {
  const q = fold(question), t = fold(text);
  const topic = marketTopic(question) || (!q.trim() ? marketTopic(text) : null);
  if (topic) return topic;
  for (const [lens, pattern] of QUESTION_LENSES) if (pattern.test(q)) return lens;
  if (zone === 'review') return 'review';
  // A real question that names no lens stays a question Mora can't answer from the text.
  if (q.trim() && !EXPLAIN.test(q)) return 'unknown';
  for (const [lens, pattern] of TEXT_LENSES) if (pattern.test(t)) return lens;
  if (ATTRIBUTES.some(item => item.pattern.test(text))) return 'attribute';
  return 'describe';
}

function nearestMetro(home) {
  const point = homeCoordinates(home);
  if (!point) return null;
  const poi = nearbyPois(point, poisFor(null, ['metro']), {radius:2500, limit:1})[0];
  if (!poi) return null;
  return {name:placeName('metro', poi.properties.name), walk:travelMinutes(Math.round(poi.properties.meters * 1.3), 'walk')};
}

/**
 * What a section pill on the listing page is asking. The price pill reads this listing against its colonia;
 * a section Mora does not read returns null, so the chat does not invent an answer.
 */
export function sectionReading(section, home, language = 'es-MX') {
  if (!home || home.development) return null;
  if (section === 'price') return priceReading(home, say(language));
  if (section === 'description') return descriptionReading(home, language);
  if (section === 'offer') return offerReading(home, language);
  if (section === 'costs') return costsReading(home, language);
  if (section === 'history') return historyReading(home, language);
  return null;
}

/** The quick questions under each section pill, in the order the person is likely to ask them. */
const FOLLOW_UPS = {
  price: ['cheaper', 'speed'],
  description: ['nearby', 'fee'],
  offer: ['lower', 'negotiable'],
  costs: ['upfront', 'monthly'],
  history: ['forecast', 'own'],
};

const FOLLOW_UP_LABELS = {
  cheaper: ['Tem parecidos mais baratos?', '¿Hay parecidos más baratos?'],
  speed: ['Quanto tempo leva para vender?', '¿Cuánto tarda en venderse?'],
  nearby: ['O que tem perto?', '¿Qué hay cerca?'],
  fee: ['Quanto é o condomínio?', '¿Cuánto es el mantenimiento?'],
  lower: ['E se eu oferecer menos?', '¿Y si ofrezco menos?'],
  negotiable: ['O preço é negociável?', '¿El precio es negociable?'],
  upfront: ['Quanto preciso na assinatura?', '¿Cuánto necesito al firmar?'],
  monthly: ['Qual seria a parcela?', '¿Cuánto sería la mensualidad?'],
  forecast: ['Vai continuar subindo?', '¿Va a seguir subiendo?'],
  own: ['O anúncio já baixou de preço?', '¿El anuncio ya bajó de precio?'],
};

const sharePct = (share, locale) => `${share >= 0 ? '+' : '−'}${Math.abs(share * 100).toLocaleString(locale, {maximumFractionDigits:1})}%`;

/** Each answer uses the same numbers as its pill, and returns `{text, ask, note}` or null when the listing lacks them. */
const FOLLOW_UP_ANSWERS = {
  cheaper(home, s) {
    const peers = peerFacts(home);
    return {text:peers.cheaper
      ? s(`Sim: ${peers.cheaper} ${plural(peers.cheaper, 'parecido custa', 'parecidos custam')} até ${peers.savings}% menos no catálogo.`, `Sí: ${peers.cheaper} ${plural(peers.cheaper, 'parecido cuesta', 'parecidos cuestan')} hasta ${peers.savings}% menos en el catálogo.`)
      : s('No catálogo, nenhum parecido custa pelo menos 10% menos.', 'En el catálogo, ningún parecido cuesta al menos 10% menos.'), ask:false};
  },
  speed(home, s) {
    const facts = marketFacts(home);
    return {text:facts.days > ZONE_MEDIAN_DAYS
      ? s(`Em ${home.area}, um anúncio costuma durar ${ZONE_MEDIAN_DAYS} dias. Este já está no ar há ${facts.days}: isso dá margem para negociar.`, `En ${home.area}, un anuncio suele durar ${ZONE_MEDIAN_DAYS} días. Este ya lleva ${facts.days} publicado: eso da margen para negociar.`)
      : s(`Em ${home.area}, um anúncio costuma durar ${ZONE_MEDIAN_DAYS} dias. Este está no ar há ${facts.days}, ainda dentro do normal.`, `En ${home.area}, un anuncio suele durar ${ZONE_MEDIAN_DAYS} días. Este lleva ${facts.days} publicado, todavía dentro de lo normal.`), ask:false};
  },
  nearby(home, s) {
    return distanceReading(home, '', s);
  },
  fee(home, s) {
    return feeReading(home, null, s);
  },
  lower(home, s) {
    const ideas = offerIdeas(home);
    if (!ideas) return null;
    const [, , moderate, weak] = ideas.levels;
    return {text:s(
      `Entre ${money(moderate.from)} e ${money(moderate.to)}, a chance de fechar é de ${moderate.chance}%. Abaixo de ${money(weak.to)}, cai para ${weak.chance}%.`,
      `Entre ${money(moderate.from)} y ${money(moderate.to)}, la probabilidad de cerrar es ${moderate.chance}%. Por debajo de ${money(weak.to)}, baja a ${weak.chance}%.`), ask:false};
  },
  negotiable(home, s) {
    return {text:s(
      'Quem decide o preço é o dono, e quem sabe se há margem é a imobiliária. Pergunto?',
      'El precio lo decide el dueño, y quien sabe si hay margen es la inmobiliaria. ¿Le pregunto?'), ask:true};
  },
  upfront(home, s, language) {
    const costs = purchaseCosts({offer:listingPrice(home)});
    return {text:s(
      `Na assinatura, uns ${money(costs.upfront)}: entrada de ${money(costs.enganche)} e ${money(costs.isai + costs.closing)} de imposto, cartório e registro.`,
      `Al firmar, unos ${money(costs.upfront)}: enganche de ${money(costs.enganche)} y ${money(costs.isai + costs.closing)} de impuesto, notaría y registro.`),
    note:s('Referência ilustrativa', 'Referencia ilustrativa'), ask:false};
  },
  monthly(home, s, language) {
    const locale = language === 'pt-BR' ? 'pt-BR' : 'es-MX';
    const costs = purchaseCosts({offer:listingPrice(home)});
    const rate = (COST_DEFAULTS.rate * 100).toLocaleString(locale);
    return {text:s(
      `Com 20% de entrada, ${COST_DEFAULTS.years} anos e taxa fixa de ${rate}%, a parcela fica em ${money(costs.monthly)} por mês. Para não passar de 30% da renda, os bancos costumam pedir uns ${money(costs.income)} por mês.`,
      `Con 20% de enganche, ${COST_DEFAULTS.years} años y tasa fija de ${rate}%, la mensualidad queda en ${money(costs.monthly)} al mes. Para no pasar del 30% del ingreso, los bancos suelen pedir unos ${money(costs.income)} al mes.`),
    note:s('Referência ilustrativa', 'Referencia ilustrativa'), ask:false};
  },
  forecast(home, s, language) {
    const history = priceHistory(home, listingNeighborhood(home)?.(language));
    if (!history) return null;
    const locale = language === 'pt-BR' ? 'pt-BR' : 'es-MX';
    const ahead = Math.round(history.months.at(-1).value * (1 + history.forecast) / 100) * 100;
    return {text:s(
      `Se seguir a tendência, em um ano o m² ficaria perto de ${money(ahead)} (${sharePct(history.forecast, locale)}). É uma tendência da colônia, não uma promessa.`,
      `Si sigue la tendencia, en un año el m² estaría cerca de ${money(ahead)} (${sharePct(history.forecast, locale)}). Es una tendencia de la colonia, no una promesa.`), ask:false};
  },
  own(home, s, language) {
    const history = priceHistory(home, listingNeighborhood(home)?.(language));
    if (!history) return null;
    return {text:history.drop
      ? s(`Sim: já baixou ${money(history.drop)} há ${history.dropDays} dias.`, `Sí: ya bajó ${money(history.drop)} hace ${history.dropDays} días.`)
      : s(`Não. Não mudou de preço nos ${history.days} dias em que está no ar.`, `No. No cambió de precio en los ${history.days} días que lleva publicado.`), ask:false};
  },
};

/** The quick questions for a section pill, only where Mora reads that section for this listing. */
export function sectionFollowUps(section, home, language = 'es-MX') {
  if (!sectionReading(section, home, language)) return [];
  const s = say(language);
  return (FOLLOW_UPS[section] || []).map(id => ({id, label:s(...FOLLOW_UP_LABELS[id])}));
}

/** The local answer to one quick question; null when this listing lacks the figures it needs. */
export function followUpReading(id, home, language = 'es-MX') {
  if (!home || home.development || !FOLLOW_UP_ANSWERS[id]) return null;
  return FOLLOW_UP_ANSWERS[id](home, say(language), language);
}

/** The history pill: where the colonia's m² has gone and where its trend points, kept apart from this listing's price. */
function historyReading(home, language) {
  const history = priceHistory(home, listingNeighborhood(home)?.(language));
  if (!history) return null;
  const voice = say(language);
  const locale = language === 'pt-BR' ? 'pt-BR' : 'es-MX';
  const pct = share => `${share >= 0 ? '+' : '−'}${Math.abs(share * 100).toLocaleString(locale, {maximumFractionDigits:1})}%`;
  const first = history.months[0].value, last = history.months.at(-1).value;
  const ahead = Math.round(last * (1 + history.forecast) / 100) * 100;
  const own = history.drop
    ? voice(`Este anúncio já baixou ${money(history.drop)} há ${history.dropDays} dias.`, `Este anuncio ya bajó ${money(history.drop)} hace ${history.dropDays} días.`)
    : voice(`Este anúncio não mudou de preço nos ${history.days} dias em que está no ar.`, `Este anuncio no ha cambiado de precio en los ${history.days} días que lleva publicado.`);
  return {text:voice(
    `Em ${history.area}, o m² passou de ${money(first)} para ${money(last)} em 12 meses (${pct(history.change)}). Se seguir a tendência, em um ano ficaria perto de ${money(ahead)} (${pct(history.forecast)}). É uma tendência da colônia, não uma promessa. ${own}`,
    `En ${history.area}, el m² pasó de ${money(first)} a ${money(last)} en 12 meses (${pct(history.change)}). Si sigue la tendencia, en un año estaría cerca de ${money(ahead)} (${pct(history.forecast)}). Es una tendencia de la colonia, no una promesa. ${own}`), ask:false};
}

/** The cost pill: what a bigger down payment trades, cash on signing day against the monthly payment and interest. */
function costsReading(home, language) {
  if (home.mode !== 'buy') return null;
  const offer = listingPrice(home);
  if (!(offer > 0)) return null;
  const voice = say(language);
  const {years, rate} = COST_DEFAULTS;
  const base = purchaseCosts({offer}), more = purchaseCosts({offer, down:0.3});
  const pct = (rate * 100).toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'es-MX');
  return {text:voice(
    `Com 20% de entrada, você precisa de uns ${money(base.upfront)} na assinatura e a parcela fica em ${money(base.monthly)} por ${years} anos. Com 30%, assina com ${money(more.upfront - base.upfront)} a mais, a parcela cai para ${money(more.monthly)} e você economiza ${money(base.interest - more.interest)} em juros. Taxa ilustrativa de ${pct}% fixa; a sua, quem dá é o banco.`,
    `Con 20% de enganche necesitas unos ${money(base.upfront)} al firmar y la mensualidad queda en ${money(base.monthly)} a ${years} años. Con 30%, firmas con ${money(more.upfront - base.upfront)} más, la mensualidad baja a ${money(more.monthly)} y te ahorras ${money(base.interest - more.interest)} en intereses. Tasa ilustrativa de ${pct}% fija; la tuya te la da el banco.`), ask:false};
}

/** The offer pill: the strong band read against comparable listings and how long this one has been published. */
function offerReading(home, language) {
  const ideas = offerIdeas(home);
  if (!ideas) return null;
  const voice = say(language);
  const facts = marketFacts(home), peers = peerFacts(home);
  const strong = ideas.levels[0];
  const cut = (strong.cut[1] * 100).toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'es-MX', {maximumFractionDigits:1});
  const pct = facts.delta == null ? null : Math.round(Math.abs(facts.delta) * 100);
  const position = pct == null ? ''
    : pct < 5 ? voice(` O m² está em linha com ${facts.comparables} parecidos em ${home.area}.`, ` El m² está en línea con ${facts.comparables} parecidos en ${home.area}.`)
    : facts.delta > 0 ? voice(` O m² está ${pct}% acima de ${facts.comparables} parecidos em ${home.area}.`, ` El m² está ${pct}% arriba de ${facts.comparables} parecidos en ${home.area}.`)
    : voice(` O m² está ${pct}% abaixo de ${facts.comparables} parecidos em ${home.area}.`, ` El m² está ${pct}% abajo de ${facts.comparables} parecidos en ${home.area}.`);
  const time = ideas.days > ideas.zoneDays
    ? voice(` Está há ${ideas.days} dias no ar, e a região vende em ${ideas.zoneDays}: isso dá margem.`, ` Lleva ${ideas.days} días publicado y la zona vende en ${ideas.zoneDays}: eso da margen.`)
    : voice(` Está há ${ideas.days} dias no ar, dentro dos ${ideas.zoneDays} da região: há pouca pressa do lado de quem vende.`, ` Lleva ${ideas.days} días publicado, dentro de los ${ideas.zoneDays} de la zona: hay poca prisa del lado de quien vende.`);
  const cheaper = peers.cheaper
    ? voice(` No catálogo, ${peers.cheaper} ${plural(peers.cheaper, 'parecido custa', 'parecidos custam')} até ${peers.savings}% menos.`, ` En el catálogo, ${peers.cheaper} ${plural(peers.cheaper, 'parecido cuesta', 'parecidos cuestan')} hasta ${peers.savings}% menos.`)
    : '';
  return {text:voice(`Uma oferta de até ${cut}% abaixo, ${money(strong.from)} ou mais, é a que mais chance tem de fechar.`, `Una oferta de hasta ${cut}% abajo, ${money(strong.from)} o más, es la que más chance tiene de cerrar.`)
    + position + time + cheaper, ask:false};
}

/** The description pill: the same phrases the page sets in bold, read back as what is worth a closer look. */
function descriptionReading(home, language) {
  const highlights = descriptionHighlights(home, language).slice(0, 4);
  if (!highlights.length) return null;
  const voice = say(language);
  return {text:voice(`O que vale olhar de perto: ${highlights.join('; ')}.`, `Lo que vale mirar de cerca: ${highlights.join('; ')}.`), ask:false};
}

function priceReading(home, say) {
  const facts = marketFacts(home);
  const kind = priceClass(facts);
  const peers = peerFacts(home);
  const area = home.area;
  const pct = facts.delta == null ? null : Math.round(Math.abs(facts.delta) * 100);
  const compared = say(`${facts.comparables} apartamentos comparados em ${area}`, `${facts.comparables} departamentos comparados en ${area}`);
  if (pct == null) return {text:say(
    `Sem a área publicada, não dá para comparar o m² com ${area}. Pergunto à imobiliária quantos m² tem?`,
    `Sin superficie publicada no se puede comparar por m² con ${area}. ¿Le pregunto a la inmobiliaria cuántos m² tiene?`), ask:true};
  const cheaper = peers.cheaper
    ? say(` Há ${peers.cheaper} ${plural(peers.cheaper, 'parecido', 'parecidos')} no catálogo até ${peers.savings}% mais ${plural(peers.cheaper, 'barato', 'baratos')}.`,
      ` Hay ${peers.cheaper} ${plural(peers.cheaper, 'parecido', 'parecidos')} en el catálogo hasta ${peers.savings}% más ${plural(peers.cheaper, 'barato', 'baratos')}.`)
    : '';
  const dropped = facts.drop ? say(` Já baixou ${money(facts.drop)} há ${facts.dropDays} dias.`, ` Ya bajó ${money(facts.drop)} hace ${facts.dropDays} días.`) : '';
  if (kind === 'review') return {text:say(
    `O m² está ${pct}% abaixo de ${compared}. É baixo a ponto de valer confirmar área e estado antes de visitar.`,
    `El m² está ${pct}% abajo de ${compared}. Es tan bajo que vale confirmar superficie y estado antes de visitar.`), ask:true};
  if (kind === 'opportunity') return {text:say(
    `Está ${pct}% abaixo do m² de ${compared}.${dropped} Se encaixa no que você busca, é dos que vale visitar primeiro.`,
    `Está ${pct}% abajo del m² de ${compared}.${dropped} Si encaja con lo que buscas, es de los que vale visitar primero.`), ask:false};
  if (kind === 'negotiate') {
    const position = facts.delta >= 0.05
      ? say(`Está ${pct}% acima do m² de ${compared}. `, `Está ${pct}% arriba del m² de ${compared}. `)
      : '';
    return {text:position + (facts.drop
      ? say(`Já baixou ${money(facts.drop)} há ${facts.dropDays} dias. Um preço que já cedeu costuma ter margem para pedir mais um pouco.`,
        `Ya bajó ${money(facts.drop)} hace ${facts.dropDays} días. Un precio que ya cedió suele tener margen para pedir otro poco.`)
      : say(`${position ? 'Mas está' : 'Está'} há ${facts.days} dias no ar, e em ${area} um anúncio dura ${ZONE_MEDIAN_DAYS} em média: há margem para pedir um preço melhor.`,
        `${position ? 'Pero lleva' : 'Lleva'} ${facts.days} días publicado, y en ${area} un anuncio dura ${ZONE_MEDIAN_DAYS} en promedio: hay margen para pedir un mejor precio.`)), ask:false};
  }
  if (kind === 'above') {
    const premium = peers.extraParking
      ? say(`; a diferença vem de ${peers.extraParking} ${plural(peers.extraParking, 'vaga', 'vagas')} a mais que parecidos.`, `; la diferencia viene de ${peers.extraParking} ${plural(peers.extraParking, 'estacionamiento', 'estacionamientos')} más que parecidos.`)
      : '.';
    return {text:say(`Está ${pct}% acima do m² de ${compared}${premium}`, `Está ${pct}% arriba del m² de ${compared}${premium}`)
      + (cheaper || say(' Se o preço pesa, vale perguntar se há margem.', ' Si el precio pesa, vale preguntar si hay margen.')), ask:!cheaper};
  }
  const trend = facts.trend >= 3 ? say(`, e a região subiu ${facts.trend}% no último ano.`, `, y la zona subió ${facts.trend}% en el último año.`) : '.';
  return {text:say(`Está em linha com o m² de ${compared}${trend}`, `Está en línea con el m² de ${compared}${trend}`)
    + (peers.cheaper
      ? say(` Mesmo assim, há ${peers.cheaper} ${plural(peers.cheaper, 'parecido', 'parecidos')} no catálogo até ${peers.savings}% mais ${plural(peers.cheaper, 'barato', 'baratos')}.`,
        ` Aun así, hay ${peers.cheaper} ${plural(peers.cheaper, 'parecido', 'parecidos')} en el catálogo hasta ${peers.savings}% más ${plural(peers.cheaper, 'barato', 'baratos')}.`)
      : say(' Não é caro nem barato para a região.', ' No es caro ni barato para la zona.')), ask:false};
}

function distanceReading(home, text, say) {
  const metro = nearestMetro(home);
  const steps = /a (?:unos|pocos) pasos/.test(fold(text));
  if (!metro) return {text:say(
    `Não há Metro a menos de meia hora a pé deste imóvel em ${home.area}. Para o dia a dia, conte com carro ou transporte de superfície.`,
    `No hay Metro a menos de media hora a pie de este inmueble en ${home.area}. Para el día a día, cuenta con auto o transporte de superficie.`), ask:false};
  const {name, walk} = metro;
  const claimed = /metro|estacion/.test(fold(text)) ? Number(fold(text).match(/(\d+)\s*min/)?.[1]) || null : null;
  if (claimed && Math.abs(claimed - walk) >= 2) return {text:say(
    `O texto diz ${claimed} min; pela rota a pé, o ${name} fica a ${walk}. Conte com ${walk} para o dia a dia.`,
    `El texto dice ${claimed} min; por la ruta a pie, el ${name} queda a ${walk}. Cuenta con ${walk} para el día a día.`), ask:false};
  if (claimed) return {text:say(`Fecha: o ${name} fica a ${walk} min a pé.`, `Cuadra: el ${name} queda a ${walk} min a pie.`), ask:false};
  if (steps) return {text:walk <= 5
    ? say(`O anúncio diz «a poucos passos», e desta vez fecha: o ${name} fica a ${walk} min a pé.`, `El anuncio dice «a unos pasos», y esta vez cuadra: el ${name} queda a ${walk} min a pie.`)
    : say(`O anúncio diz «a poucos passos». O ${name} fica a ${walk} min a pé, não na esquina.`, `El anuncio dice «a unos pasos». El ${name} queda a ${walk} min a pie, no a la vuelta de la esquina.`), ask:false};
  return {text:walk <= 10
    ? say(`O ${name} fica a ${walk} min a pé. Dá para viver sem carro no dia a dia.`, `El ${name} queda a ${walk} min a pie. Se puede vivir sin auto en el día a día.`)
    : say(`O ${name} fica a ${walk} min a pé. Para ir todo dia, conte com bicicleta, ônibus ou carro.`, `El ${name} queda a ${walk} min a pie. Para ir diario, cuenta con bici, camión o auto.`), ask:false};
}

function petsReading(home, text, say) {
  const claims = /acepta mascotas|pet friendly|se aceptan mascotas/.test(fold(text));
  if (home && listingDetails(home).pets === true) return {text:say(
    'O anúncio diz que aceita pets. Não diz porte nem quantos. Pergunto à imobiliária?',
    'El anuncio dice que acepta mascotas. No dice tamaño ni cuántas. ¿Le pregunto a la inmobiliaria?'), ask:true};
  if (home && claims) return {text:say(
    'Aqui diz que aceita pets, mas não diz porte nem quantos. Pergunto à imobiliária?',
    'Aquí dice que acepta mascotas, pero no dice tamaño ni cuántas. ¿Le pregunto a la inmobiliaria?'), ask:true};
  if (home) return {text:say(
    'No que você marcou não aparece, e o anúncio também não diz. Pergunto à imobiliária?',
    'En lo que marcaste no aparece, y el anuncio tampoco lo dice. ¿Le pregunto a la inmobiliaria?'), ask:true};
  return {text:claims
    ? say('O texto diz que aceita pets. É o que o anúncio afirma; o porte e quantos, a imobiliária confirma.', 'El texto dice que acepta mascotas. Es lo que afirma el anuncio; tamaño y cuántas lo confirma la inmobiliaria.')
    : say('Este texto não fala de pets. Isso se confirma no anúncio de cada imóvel.', 'Este texto no habla de mascotas. Eso se confirma en el anuncio de cada inmueble.'), ask:false};
}

function feeReading(home, shown, say) {
  // The full listing page fills a missing fee with a demo figure; Mora names it and keeps it to confirm.
  if (!home.fee && shown) return {text:say(
    `Esta página mostra ${shown} de condomínio, mas o anúncio original não publica esse valor. Confirme com a imobiliária antes de contar com ele.`,
    `Esta página muestra ${shown} de mantenimiento, pero el anuncio original no publica ese número. Confírmalo con la inmobiliaria antes de contar con él.`), ask:true};
  if (!home.fee) return {text:say(
    'O anúncio não publica o condomínio. Sem esse número, o custo mensal não se compara bem. Pergunto à imobiliária?',
    'El anuncio no publica el mantenimiento. Sin ese número, el costo mensual no se compara bien. ¿Le pregunto a la inmobiliaria?'), ask:true};
  const price = listingPrice(home);
  if (home.mode === 'rent' && price) {
    const pct = Math.round(home.fee / price * 100);
    return {text:say(`Publicam ${money(home.fee)} de condomínio. Sobre este aluguel, é cerca de ${pct}% a mais por mês.`, `Publican ${money(home.fee)} de mantenimiento. Sobre esta renta, es cerca de ${pct}% extra al mes.`), ask:false};
  }
  return {text:say(`Publicam ${money(home.fee)} de condomínio por mês: uns ${money(home.fee * 12)} por ano, além da prestação se houver financiamento.`, `Publican ${money(home.fee)} de mantenimiento al mes: unos ${money(home.fee * 12)} al año, aparte de la mensualidad si hay crédito.`), ask:false};
}

function jargonReading(home, text, say) {
  const word = fold(text).match(JARGON)?.[0] || '';
  const pct = home ? marketFacts(home).delta : null;
  const number = pct == null ? '' : say(
    ` O número diz outra coisa: o m² está ${Math.round(Math.abs(pct) * 100)}% ${pct < 0 ? 'abaixo' : 'acima'} da região.`,
    ` El número dice otra cosa: el m² está ${Math.round(Math.abs(pct) * 100)}% ${pct < 0 ? 'abajo' : 'arriba'} de la zona.`);
  return {text:say(`«${word}» é palavra do anúncio, não um dado.${number}`, `«${word}» es una palabra del anuncio, no un dato.${number}`), ask:false};
}

const say = language => (br, es) => language === 'pt-BR' ? br : es;

function chipsFor(lens, {home, ask, language}) {
  const s = say(language);
  const agency = s('Perguntar à imobiliária', 'Preguntar a la inmobiliaria');
  if (!home) return MARKET_TOPICS.filter(topic => topic !== lens).slice(0, 2).map(topic => marketQuestion(topic, language));
  const listing = {
    price:s('Está caro?', '¿Está caro?'),
    distance:s('O que tem perto?', '¿Qué hay cerca?'),
    fee:s('Quanto é o condomínio?', '¿Cuánto es el mantenimiento?'),
    pets:s('Aceita pets?', '¿Acepta mascotas?'),
  };
  const rest = Object.entries(listing).filter(([key]) => key !== lens).map(([, label]) => label);
  return ask ? [agency, rest[0]] : rest.slice(0, 2);
}

/**
 * `{lens, text, note, ask, chips}`. `home` is the catalog listing around the selection, or null; `around` is the text of
 * the line the selection sits in. `ask` means the answer depends on the agency, so the next step offered is the agency
 * question; Mora still sends nothing from here.
 */
export function selectionAnswer({text = '', question = '', home = null, zone = null, around = '', language = 'es-MX'} = {}) {
  const s = say(language);
  const lens = selectionLens({text, question, zone});
  const listing = home && !home.development ? home : null;
  let reading;
  if (MARKET_TOPICS.includes(lens)) {
    const answer = marketAnswer(lens, {mode:listing?.mode || 'buy', price:listing ? listingPrice(listing) : null, language, listing:!!listing});
    reading = {text:`${answer.headline} ${answer.detail}`, note:answer.note, ask:answer.ask};
  } else if (lens === 'agency') {
    const agency = listing ? advertiserFor(listing).name : s('a imobiliária', 'la inmobiliaria');
    reading = {text:listing
      ? s(`Abra o imóvel e use «Falar deste imóvel com a Mora»: de lá eu envio sua pergunta a ${agency}. Daqui não sai nada.`, `Abre el inmueble y usa «Hablar de este inmueble con Mora»: desde ahí le envío tu pregunta a ${agency}. Desde aquí no se envía nada.`)
      : s('Para perguntar, abra um imóvel: a pergunta vai para a imobiliária dele. Daqui não sai nada.', 'Para preguntar, abre un inmueble: la pregunta va a su inmobiliaria. Desde aquí no se envía nada.'), ask:false};
  } else if (lens === 'price') {
    reading = listing ? priceReading(listing, s) : {text:s(
      'É um preço, mas não sei de qual anúncio. Selecione dentro de um card ou da página do imóvel e eu comparo com a região.',
      'Es un precio, pero no sé de qué anuncio. Selecciónalo dentro de un card o de la página del inmueble y lo comparo con la zona.'), ask:false};
  } else if (lens === 'distance') {
    reading = listing ? distanceReading(listing, text, s) : {text:s(
      'Para dar minutos, preciso saber de qual anúncio é. Selecione o texto dentro de um card ou da página do imóvel.',
      'Para darte minutos necesito saber de qué anuncio es. Selecciona el texto dentro de un card o de la página del inmueble.'), ask:false};
  } else if (lens === 'pets') {
    reading = petsReading(listing, text, s);
  } else if (lens === 'fee') {
    reading = listing ? feeReading(listing, `${text} ${around}`.match(/\$\s?[\d.,]+/)?.[0].replace(/\s/g, '') || null, s) : {text:s(
      'O condomínio muda a cada prédio. Selecione dentro de um anúncio e eu digo se ele publica o valor.',
      'El mantenimiento cambia en cada edificio. Selecciónalo dentro de un anuncio y te digo si lo publica.'), ask:false};
  } else if (lens === 'availability') {
    reading = {text:listing
      ? s('O anúncio segue publicado e foi atualizado há pouco. Que continue livre, quem confirma é a imobiliária. Pergunto?', 'El anuncio sigue publicado y se actualizó hace poco. Que siga libre lo confirma la inmobiliaria. ¿Le pregunto?')
      : s('Disponibilidade se confirma anúncio por anúncio, com a imobiliária.', 'La disponibilidad se confirma anuncio por anuncio, con la inmobiliaria.'), ask:!!listing};
  } else if (lens === 'review') {
    const agency = listing ? advertiserFor(listing).name : s('a imobiliária', 'la inmobiliaria');
    reading = {text:s(
      `Isto é de alguém que tratou com ${agency}, não uma descrição do apartamento. Serve para saber como respondem, não como o imóvel está.`,
      `Esto es de alguien que trató con ${agency}, no una descripción del departamento. Sirve para saber cómo responden, no cómo está el inmueble.`), ask:false};
  } else if (lens === 'jargon') {
    reading = jargonReading(listing, text, s);
  } else if (lens === 'attribute') {
    const found = ATTRIBUTES.find(item => item.pattern.test(text));
    const name = language === 'pt-BR' ? found.pt : found.es;
    reading = {text:s(
      `O anúncio diz ${name}. É o que o anunciante afirma; vale ver na visita ou pedir fotos. Pergunto à imobiliária?`,
      `El anuncio dice ${name}. Es lo que afirma el anunciante; vale verlo en la visita o pedir fotos. ¿Le pregunto a la inmobiliaria?`), ask:!!listing};
  } else if (lens === 'unknown') {
    reading = {text:listing
      ? s(`Isso não está no anúncio nem no que tenho de ${listing.area}. Deste texto, o que posso dizer é se ele afirma um dado ou só sugere.`, `Eso no está en el anuncio ni en lo que tengo de ${listing.area}. De este texto, lo que sí puedo decir es si afirma un dato o solo lo sugiere.`)
      : s('Isso não está no que tenho. Deste texto, o que posso dizer é se ele afirma um dado ou só sugere.', 'Eso no está en lo que tengo. De este texto, lo que sí puedo decir es si afirma un dato o solo lo sugiere.'), ask:false};
  } else {
    reading = {text:listing
      ? s(`Isto vem do anúncio em ${listing.street || listing.area}, ${listing.area}. Posso dizer se o preço fecha com a região, o que tem perto ou o que o texto não confirma.`, `Esto viene del anuncio en ${listing.street || listing.area}, ${listing.area}. Puedo decirte si el precio cuadra con la zona, qué hay cerca o qué no confirma el texto.`)
      : s('Posso ler isto, mas não é um dado de um anúncio. Pergunte sobre preço, distância ou algo que o texto não confirma.', 'Puedo leer esto, pero no es un dato de un anuncio. Pregúntame por precio, distancia o algo que el texto no confirma.'), ask:false};
  }
  return {lens, text:reading.text, note:reading.note || null, ask:!!reading.ask, chips:chipsFor(lens, {home:listing, ask:reading.ask, language})};
}

/** Whether a selected string is worth offering Mora: a few characters up to a short paragraph. */
export function selectableText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length >= SELECTION_MIN && text.length <= SELECTION_MAX ? text : null;
}
