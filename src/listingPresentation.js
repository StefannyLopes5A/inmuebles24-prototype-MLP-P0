import details from './listing-details.json' with {type:'json'};
import {listingPrice} from './data.js';
import {matchingHomes} from './journey.js';

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
  if (home.beds >= search.beds) matches.push(pref === 'extra' && home.beds >= 3 ? say('3 ou mais quartos, como você prefere', '3 o más recámaras, como prefieres') : say(`${home.beds} quartos para a sua rotina`, `${home.beds} recámaras para tu rutina`));
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

export function answerListingQuestion(home, question, language = 'es-MX') {
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const text = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const extra = listingDetails(home);
  if (/mascota|pet|animal/.test(text) && extra.pets !== null) return extra.pets
    ? say('O anúncio informa que aceita pets. Confirme as condições com a imobiliária.', 'El anuncio indica que acepta mascotas. Confirma las condiciones con la inmobiliaria.')
    : say('O anúncio informa que não aceita pets.', 'El anuncio indica que no acepta mascotas.');
  if (/metr|area|superfic|tamanho/.test(text) && home.size >= 20) return say(`O anúncio informa ${home.size} m². As medidas de cada ambiente precisam ser confirmadas.`, `El anuncio publica ${home.size} m². Las medidas de cada ambiente necesitan confirmación.`);
  if (/quarto|recamara|habitac/.test(text) && !/janela|ventana|cabe|escritor|home.?office/.test(text)) return say(`São ${home.beds} quartos e ${home.baths} banheiros no anúncio.`, `El anuncio tiene ${home.beds} recámaras y ${home.baths} baños.`);
  return say('Essa informação ainda precisa ser confirmada. Posso levar sua pergunta à imobiliária junto com o contato.', 'Ese detalle aún necesita confirmación. Puedo incluir tu pregunta al contactar a la inmobiliaria.');
}
