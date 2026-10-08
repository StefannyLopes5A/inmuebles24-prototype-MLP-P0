import details from './listing-details.json' with {type:'json'};
import {listingPrice} from './data.js';
import {matchingHomes} from './journey.js';
import {criterionLabel, matchesCriteria} from './searchCriteria.js';

export function listingDetails(home) {
  return details[home.id] || {gallery:[home.image], parking:null, pets:null, floor:null};
}

/** Match copy describes the dated catalog and explicit criteria, never inferred room layouts. */
export function listingSummary(home, search, pref, language = 'es-MX') {
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const matches = [], considerations = [];
  const price = listingPrice(home);
  if (price <= search.budget && price >= (search.minBudget || 0)) matches.push(say('Dentro do seu orçamento', 'Dentro de tu presupuesto'));
  else considerations.push(price > search.budget ? say('O valor está acima do seu orçamento.', 'El precio está por encima de tu presupuesto.') : say('O valor é menor que o mínimo da sua busca.', 'El precio es menor al mínimo de tu búsqueda.'));
  if (!search.areas.length || search.areas.includes(home.area)) matches.push(say('Região alinhada com sua busca', 'Zona alineada con tu búsqueda'));
  else considerations.push(say(`${home.area} fica fora dos bairros selecionados.`, `${home.area} está fuera de las zonas seleccionadas.`));
  if (home.beds == null) considerations.push(say('O número de quartos precisa ser confirmado.', 'El número de recámaras necesita confirmación.'));
  else if (home.beds >= search.beds) matches.push(pref === 'extra' && home.beds >= 3 ? say('3 ou mais quartos, como você prefere', '3 o más recámaras, como prefieres') : say(`${home.beds} quartos para a sua rotina`, `${home.beds} recámaras para tu rutina`));
  else considerations.push(say(`Tem ${home.beds} quartos; você busca ${search.beds} ou mais.`, `Tiene ${home.beds} recámaras; buscas ${search.beds} o más.`));
  if (!matches.length) matches.push(say(`${home.size >= 20 ? `${home.size} m² · ` : ''}${home.area}`, `${home.size >= 20 ? `${home.size} m² · ` : ''}${home.area}`));
  if (considerations.length < 2) considerations.push(pref === 'open' || pref === 'extra'
    ? say('Confirme se a planta permite o espaço de trabalho.', 'Confirma si la distribución permite el espacio de trabajo.')
    : say('Confirme a distribuição e a disponibilidade.', 'Confirma la distribución y la disponibilidad.'));
  if (considerations.length < 2) considerations.push(home.fee
    ? say('Há condomínio informado; confirme o que está incluído.', 'Hay mantenimiento publicado; confirma qué incluye.')
    : say('O valor do condomínio precisa ser confirmado.', 'El costo de mantenimiento necesita confirmación.'));
  return {matches, considerations, hasMatch:matchingHomes(search).some(item => item.id === home.id)};
}

/** Preference and criteria stay user intent; never claim office, window or floor-plan facts. */
export function profileFitReason(home, search, pref, language = 'es-MX') {
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  if (pref === 'extra') {
    return home.beds >= 3
      ? say(`Você pediu 3 ou mais quartos; este tem ${home.beds}.`, `Pediste 3 o más recámaras; este tiene ${home.beds}.`)
      : say(`Você priorizou 3 ou mais quartos; este tem ${home.beds}.`, `Priorizaste 3 o más recámaras; este tiene ${home.beds}.`);
  }
  if (pref === 'open') {
    return say('Você pediu espaço de trabalho na sala; confirme a distribuição com o anunciante.', 'Pediste espacio de trabajo en la sala; confirma la distribución con el anunciante.');
  }
  const criterion = (search.criteria || [])[0];
  if (criterion) {
    const label = criterionLabel(criterion, language);
    return matchesCriteria(home, [criterion])
      ? say(`Sua busca inclui ${label}; o anúncio menciona esse detalhe.`, `Tu búsqueda incluye ${label}; el anuncio menciona ese detalle.`)
      : say(`Sua busca inclui ${label}; confirme com o anunciante.`, `Tu búsqueda incluye ${label}; confirma con el anunciante.`);
  }
  if (search.note) {
    return say('Sua nota de busca fica como contexto; confirme os detalhes com o anunciante.', 'Tu nota de búsqueda queda como contexto; confirma los detalles con el anunciante.');
  }
  return null;
}

function rankKey(entry) {
  return [Number(entry.hasMatch), entry.matchCount, -entry.considerationCount];
}

function sameRank(a, b) {
  const left = rankKey(a), right = rankKey(b);
  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

/** Side-by-side reading for saved homes: shared lines leave the columns; ties get no leader. */
export function compareFavorites(homes, search, pref = 'none', language = 'es-MX') {
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const columns = (homes || []).map(home => {
    const summary = listingSummary(home, search, pref, language);
    return {
      home,
      matches: summary.matches,
      considerations: summary.considerations,
      hasMatch: summary.hasMatch,
      matchCount: summary.matches.length,
      considerationCount: summary.considerations.length,
      profile: profileFitReason(home, search, pref, language),
    };
  });

  const sharedMatches = columns.length >= 2
    ? columns[0].matches.filter(text => columns.every(column => column.matches.includes(text)))
    : [];
  const sharedConsiderations = columns.length >= 2
    ? columns[0].considerations.filter(text => columns.every(column => column.considerations.includes(text)))
    : [];

  const cards = columns.map(column => {
    const remainingMatches = column.matches.filter(text => !sharedMatches.includes(text));
    const remainingConsiderations = column.considerations.filter(text => !sharedConsiderations.includes(text));
    return {
      home: column.home,
      goodAt: remainingMatches[0] || null,
      consider: remainingConsiderations[0] || null,
      profile: column.profile,
      hasMatch: column.hasMatch,
      matchCount: column.matchCount,
      considerationCount: column.considerationCount,
    };
  });

  let leaderId = null;
  let verdict = null;
  if (cards.length >= 2) {
    const ranked = [...cards].sort((a, b) =>
      Number(b.hasMatch) - Number(a.hasMatch)
      || b.matchCount - a.matchCount
      || a.considerationCount - b.considerationCount);
    if (!sameRank(ranked[0], ranked[1])) {
      leaderId = ranked[0].home.id;
      verdict = say(
        `Entre seus salvos, ${ranked[0].home.street} está mais perto da busca.`,
        `Entre tus guardados, ${ranked[0].home.street} está más cerca de tu búsqueda.`,
      );
    } else {
      verdict = say('Dois salvos estão igualmente perto da busca.', 'Dos guardados están igual de cerca de tu búsqueda.');
    }
  }

  return {sharedMatches, sharedConsiderations, cards, leaderId, verdict};
}

export function answerListingQuestion(home, question, language = 'es-MX') {
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const text = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const extra = listingDetails(home);
  if (/mascota|pet|animal/.test(text) && extra.pets !== null) return extra.pets
    ? say('O anúncio informa que aceita pets. Confirme as condições com a imobiliária.', 'El anuncio indica que acepta mascotas. Confirma las condiciones con la inmobiliaria.')
    : say('O anúncio informa que não aceita pets.', 'El anuncio indica que no acepta mascotas.');
  if (/metr|area|superfic|tamanho/.test(text) && home.size >= 20) return say(`O anúncio informa ${home.size} m². As medidas de cada ambiente precisam ser confirmadas.`, `El anuncio publica ${home.size} m². Las medidas de cada ambiente necesitan confirmación.`);
  if (/quarto|recamara|habitac/.test(text) && !/janela|ventana|cabe|escritor|home.?office/.test(text)) {
    if (home.beds == null || home.baths == null) return say('Quartos ou banheiros desse anúncio ainda precisam ser confirmados.', 'Las recámaras o los baños de este anuncio aún necesitan confirmación.');
    return say(`São ${home.beds} quartos e ${home.baths} banheiros no anúncio.`, `El anuncio tiene ${home.beds} recámaras y ${home.baths} baños.`);
  }
  return say('Essa informação ainda precisa ser confirmada. Posso levar sua pergunta à imobiliária junto com o contato.', 'Ese detalle aún necesita confirmación. Puedo incluir tu pregunta al contactar a la inmobiliaria.');
}
