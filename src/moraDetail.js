const minutesOf = time => Number(String(time).match(/\d+/)?.[0]);
const first = text => text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : '';

/** The commute rows: the place the person declared, then the metro, and a park close by from the page's walking list. */
function placeRows(surroundings, places, say) {
  const items = surroundings?.items || [];
  const rows = [];
  const work = items.find(item => item.icon === 'work');
  if (work) rows.push({id:'commute', icon:'work', title:work.time, note:say(`Até ${first(work.place)}`, `A ${first(work.place)}`)});
  const metro = items.find(item => item.icon === 'transport');
  // Same minutes as the sentence above the row, which reads them from the same surroundings.
  const minutes = metro && minutesOf(metro.time);
  if (metro && minutes <= 12) {
    const park = places?.find(place => place.categoria === 'parque' && !place.invented && place.minutes <= 8);
    rows.push({id:'metro', icon:'transport',
      title:say(`${minutes} min a pé do ${metro.place}`, `${minutes} min a pie del ${metro.place}`),
      note:park ? say(`E ${park.name} a ${park.minutes} min`, `Y ${park.name} a ${park.minutes} min`) : null});
  }
  return rows;
}

/**
 * Price as two bars anyone can read: this listing's m² next to what similar ones ask. The title says the ratio in words;
 * the line under the bars says what that means against the catalog, never a range or a percentile.
 */
function priceRow(home, market, peers, short, say) {
  if (!market?.ppm2 || market.delta == null || Math.abs(market.delta) < 0.12) return null;
  const ratio = market.ppm2 / market.median;
  const pct = Math.round(Math.abs(market.delta) * 100);
  const above = market.delta > 0;
  const title = ratio >= 1.9
    ? say('O m² custa mais que o dobro', 'El m² cuesta más del doble')
    : above ? say(`O m² custa ${pct}% a mais`, `El m² cuesta ${pct}% más`) : say(`O m² custa ${pct}% a menos`, `El m² cuesta ${pct}% menos`);
  const why = peers?.extraParking
    ? say(`Parte vem de ${peers.extraParking} ${peers.extraParking === 1 ? 'vaga' : 'vagas'} a mais que os parecidos.`, `Parte viene de ${peers.extraParking} ${peers.extraParking === 1 ? 'estacionamiento' : 'estacionamientos'} más que los parecidos.`)
    : above && peers?.cheaper
      ? say(`${peers.cheaper} de ${peers.count} parecidos em tamanho custam menos; o mais barato, ${peers.savings}% menos.`, `${peers.cheaper} de ${peers.count} parecidos en tamaño cuestan menos; el más barato, ${peers.savings}% menos.`)
      : market.drop ? say(`Já baixou ${short(market.drop)} há ${market.dropDays} dias.`, `Ya bajó ${short(market.drop)} hace ${market.dropDays} días.`) : null;
  return {id:'price', icon:'price', polarity:above ? 'minus' : 'plus', title, note:why,
    bars:[
      {label:say('Este', 'Este'), value:market.ppm2, self:true},
      {label:say(`Parecidos em ${home.area}`, `Parecidos en ${home.area}`), value:market.median},
    ]};
}

/** What the search asked and the listing does not give: rooms and zone. The verdict leaves these to the card's tags. */
function fitRows(home, match, search, say) {
  const rows = [];
  for (const item of match?.criteria || []) {
    if (item.status !== 'unmet') continue;
    if (item.id === 'beds' && home.beds != null && search?.beds) {
      rows.push({id:'beds', icon:'levels',
        title:say(`${home.beds} ${home.beds === 1 ? 'quarto' : 'quartos'}; você busca ${search.beds}`, `${home.beds} ${home.beds === 1 ? 'recámara' : 'recámaras'}; buscas ${search.beds}`)});
    }
    if (item.id === 'zone') {
      const areas = (search?.areas || []).filter(area => area && area !== 'Ambas zonas');
      rows.push({id:'zone', icon:'green', title:say(`Fica em ${home.area}`, `Está en ${home.area}`),
        note:areas.length ? say(`Você busca em ${areas.join(', ')}`, `Buscas en ${areas.join(', ')}`) : null});
    }
  }
  return rows;
}

const PLUS_ORDER = ['outdoor', 'remodeled', 'furnished', 'commute', 'metro', 'price', 'view', 'light', 'penthouse', 'levels', 'loft'];
const MINUS_ORDER = ['budget', 'price', 'beds', 'zone', 'unfurnished', 'work', 'missing', 'gap'];
const MAX_ROWS = 4;

/**
 * The listing page's card: the mini-listing's sentence on top, so the reading is recognizable, and below it everything
 * Mora found, sorted into what helps and what to weigh. The page has room, so each row carries its evidence:
 * the photo, the walking minutes the map shows, the price as bars, the question to send.
 */
export function detailReading(analysis, {home, search, places, gallery, short, say}) {
  if (!analysis?.verdict) return null;
  const candidates = analysis.verdict.candidates || analysis.verdict.facts;
  const rows = [];
  for (const fact of candidates) {
    if (fact.id === 'around' || fact.id === 'price') continue;
    const row = {...fact};
    if (fact.photo && gallery?.[fact.photo - 1]) row.photo = {index:fact.photo - 1, src:gallery[fact.photo - 1].src};
    else delete row.photo;
    if (fact.id === 'gap' && analysis.attention?.action) row.ask = analysis.attention.action;
    rows.push(row);
  }
  rows.push(...placeRows(analysis.surroundings, places, say).map(row => ({...row, polarity:'plus'})));
  const price = priceRow(home, analysis.market, analysis.peers, short, say);
  if (price) rows.push(price);
  rows.push(...fitRows(home, analysis.match, search, say).map(row => ({...row, polarity:'minus'})));
  const sorted = (polarity, order) => rows.filter(row => row.polarity === polarity)
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).slice(0, MAX_ROWS);
  return {sentence:analysis.verdict.sentence, plus:sorted('plus', PLUS_ORDER), minus:sorted('minus', MINUS_ORDER)};
}
