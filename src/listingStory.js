import details from './listing-details.json' with {type:'json'};
import reading from './data/listing-reading.json' with {type:'json'};
import {homes, listingPrice} from './data.js';
import {seed} from './listingAdvertiser.js';
import {homeCoordinates, NEIGHBORHOOD_CENTROIDS} from './mapLocations.js';
import {coloniaVision, textOf} from './mapWidgetContent.js';
import {POI_CATEGORIES} from './poiCategories.js';
import {nearbyCounts, placesAround} from './pois.js';

// Only the full listing page reads this module. What the catalog lacks is invented here, stable per `home.id`;
// the mini-listing keeps showing those same gaps as "a confirmar".

export const GALLERY_CATEGORIES = [
  {id:'general', es:'Visión general', pt:'Visão geral'},
  {id:'living', es:'Estancia', pt:'Sala de estar'},
  {id:'bedrooms', es:'Recámaras', pt:'Quartos'},
  {id:'kitchen', es:'Cocina', pt:'Cozinha'},
  {id:'bath', es:'Baños', pt:'Banheiros'},
  {id:'outdoor', es:'Exteriores', pt:'Áreas externas'},
  {id:'amenities', es:'Amenidades', pt:'Comodidades'},
];

const SPACE_CATEGORY = {
  'recámara':'bedrooms', estudio:'bedrooms', cocina:'kitchen', 'baño':'bath',
  terraza:'outdoor', 'balcón':'outdoor', 'jardín':'outdoor', roof:'outdoor',
  alberca:'amenities', gimnasio:'amenities', estacionamiento:'amenities',
};

const SET_HOMES = new Map(homes.filter(home => home.photoSetId).map(home => [home.photoSetId, home]));
const DONOR_SETS = Object.keys(reading).filter(id => SET_HOMES.has(id) && new Set((reading[id].spaces || []).map(space => SPACE_CATEGORY[space.kind])).size >= 3);

const pick = (list, n) => list[n % list.length];

/** Seeded Fisher–Yates: the same listing always draws the same order. */
export function seededShuffle(list, key) {
  const items = [...list];
  let state = seed(key) || 1;
  for (let i = items.length - 1; i > 0; i -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = Math.imul(state ^ (state >>> 13), 3266489909) >>> 0;
    const j = state % (i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Each photo gets a room from the curated anchors of its set; the photo after an anchor usually shows the same room. */
export function categorizePhotos(count, spaces = []) {
  const assigned = Array(count).fill(null);
  if (count) assigned[0] = 'general';
  const anchors = spaces.map(space => ({index:space.photo - 1, category:SPACE_CATEGORY[space.kind]})).filter(anchor => anchor.category && anchor.index > 0 && anchor.index < count);
  for (const anchor of anchors) if (!assigned[anchor.index]) assigned[anchor.index] = anchor.category;
  const anchored = new Set(anchors.map(anchor => anchor.index));
  for (const anchor of anchors) {
    const next = anchor.index + 1;
    if (next < count && !assigned[next] && !anchored.has(next)) assigned[next] = anchor.category;
  }
  let living = 0;
  for (let i = 1; i < Math.min(count, 7) && living < 3; i += 1) if (!assigned[i]) { assigned[i] = 'living'; living += 1; }
  return assigned.map(category => category || 'general');
}

/** Photos grouped by room. Listings with a single published photo borrow a stable set from the catalog after their own. */
export function listingGallery(home) {
  const own = details[home.id]?.gallery?.length ? details[home.id].gallery : [home.image];
  let photos, spaces;
  if (own.length > 1) {
    photos = own.map(src => ({src, borrowed:false}));
    spaces = reading[home.photoSetId]?.spaces || [];
  } else {
    const donorSet = DONOR_SETS.length ? pick(DONOR_SETS, seed(`${home.id}:photos`)) : null;
    const donor = donorSet ? details[SET_HOMES.get(donorSet).id]?.gallery || [] : [];
    photos = [{src:own[0], borrowed:false}, ...donor.slice(1).map(src => ({src, borrowed:true}))];
    spaces = donorSet ? reading[donorSet].spaces || [] : [];
  }
  const assigned = categorizePhotos(photos.length, spaces);
  const all = photos.map((photo, index) => ({...photo, index, category:assigned[index]}));
  const categories = GALLERY_CATEGORIES
    .map(category => ({...category, photos:all.filter(photo => photo.category === category.id)}))
    .filter(category => category.photos.length);
  return {photos:all, categories, video:home.video || null};
}

/** Facts for the spec row and the contact card: the catalog wins, invented values fill the rest. */
export function listingFacts(home) {
  const extra = details[home.id] || {};
  const n = seed(`${home.id}:facts`);
  const beds = home.beds ?? 1 + n % 3;
  const baths = home.baths ?? Math.max(1, beds - 1);
  const size = home.size >= 20 ? home.size : 42 + beds * 22 + n % 15;
  const parking = extra.parking ?? 1 + (n >>> 3) % 2;
  const floor = extra.floor ?? 2 + (n >>> 6) % 12;
  const pets = extra.pets ?? (n >>> 9) % 3 !== 0;
  const fee = home.fee ?? Math.round((size * (home.mode === 'rent' ? 24 : 38) + (n >>> 11) % 900) / 100) * 100;
  const years = 3 + (n >>> 14) % 22;
  return {beds, baths, size, parking, floor, pets, fee, years};
}

const PLACE_KIND = {
  metro:['Metrô', 'Metro'], escola:['Escola', 'Escuela'], parque:['Parque', 'Parque'], hospital:['Hospital', 'Hospital'],
  supermercado:['Mercado', 'Súper'], cafe:['Café', 'Café'], bar_restaurante:['Restaurante', 'Restaurante'], comercio:['Comércio', 'Comercio'],
};
// Twelve fills the three place columns four by four, matching the four neighborhood bars beside them.
const PLACE_COUNT = 12;
// Generic neighborhood spots for when the map has fewer real points. No metro: a made-up station would mislead.
const INVENTED_PLACES = {
  cafe:['Café de la Esquina', 'Cafetería Lumbre', 'Tostadores del Barrio'],
  bar_restaurante:['Fonda Doña Mary', 'Taquería El Paisa', 'Cantina La Unión'],
  comercio:['Farmacia del Parque', 'Papelería Central', 'Tlapalería Juárez'],
  supermercado:['Mercado sobre ruedas', 'Súper Express', 'Frutería La Huerta'],
  parque:['Jardín vecinal', 'Parque de bolsillo'],
  escola:['Kínder Arcoíris', 'Primaria vecinal'],
  hospital:['Consultorio médico', 'Clínica de barrio'],
};

/** Points around the approximate position: real ones first (closest of every category, then the next closest), invented ones only to reach twelve. */
export function listingPlaces(home) {
  const center = homeCoordinates(home);
  const around = placesAround(center, POI_CATEGORIES.map(category => category.id), {limit:3, reach:3000}) || {};
  const entry = (categoria, place) => ({categoria, kind:PLACE_KIND[categoria], name:place.name, minutes:place.minutes});
  const byTime = (a, b) => a.minutes - b.minutes;
  const ranks = [[], [], []];
  for (const {id} of POI_CATEGORIES) {
    const items = around[id]?.items?.length ? around[id].items : around[id]?.closest ? [around[id].closest] : [];
    items.slice(0, 3).forEach((item, rank) => ranks[rank].push(entry(id, item)));
  }
  const places = ranks.flatMap(rank => rank.sort(byTime)).slice(0, PLACE_COUNT);
  const taken = new Set(places.map(place => place.name));
  const pool = seededShuffle(Object.entries(INVENTED_PLACES).flatMap(([categoria, names]) => names.map(name => ({categoria, name}))), `${home.id}:places`)
    .filter(item => !taken.has(item.name));
  for (const [i, item] of pool.slice(0, PLACE_COUNT - places.length).entries()) {
    places.push({...entry(item.categoria, {name:item.name, minutes:3 + seed(`${home.id}:place:${i}`) % 10}), invented:true});
  }
  return {center, places:places.sort(byTime), counts:nearbyCounts(center)};
}

function nearestColonia([lng, lat]) {
  let best = null, gap = Infinity;
  for (const [name, [x, y]] of Object.entries(NEIGHBORHOOD_CENTROIDS)) {
    const next = Math.hypot((x - lng) * Math.cos(lat * Math.PI / 180), y - lat);
    if (next < gap) { best = name; gap = next; }
  }
  return best;
}

/** What the map widgets know about the colonia (neighbors, perception, price, trend, commute), read for this listing. */
export function listingNeighborhood(home, center = homeCoordinates(home)) {
  const vision = coloniaVision(home.area) || coloniaVision(nearestColonia(center));
  if (!vision) return null;
  const {neighbors} = vision;
  return language => {
    const p = language === 'pt-BR';
    const t = value => textOf(value, language);
    const lower = value => { const text = t(value); return text.charAt(0).toLowerCase() + text.slice(1); };
    const upper = value => { const text = t(value); return text.charAt(0).toUpperCase() + text.slice(1); };
    const level = vision.feelSafe >= 70 ? (p ? 'acima' : 'por encima') : vision.feelSafe >= 48 ? (p ? 'perto' : 'cerca') : (p ? 'abaixo' : 'por debajo');
    return {
      name:vision.name,
      reading:p
        ? `Os vizinhos valorizam ${lower(neighbors.plus[0])} e apontam ${lower(neighbors.minus[0])}. Em ${vision.alcaldia}, a percepção de segurança fica ${level} da média da CDMX. Boa para ${neighbors.ideal.map(t).join(' e ')}.`
        : `Los vecinos valoran ${lower(neighbors.plus[0])} y señalan ${lower(neighbors.minus[0])}. En ${vision.alcaldia}, la percepción de seguridad queda ${level} del promedio de CDMX. Ideal para ${neighbors.ideal.map(t).join(' y ')}.`,
      reviews:neighbors.reviews,
      plus:neighbors.plus.map(upper),
      minus:neighbors.minus.map(upper),
      bars:[
        {id:'walk', label:p ? 'Dá para fazer tudo a pé' : 'Se puede hacer todo a pie', value:neighbors.walkable},
        {id:'pet', label:'Pet-friendly', value:neighbors.pet},
        {id:'quiet', label:p ? 'Tranquilo à noite' : 'Tranquilo de noche', value:neighbors.quiet},
        {id:'safe', label:p ? 'Percebido como seguro' : 'Se percibe seguro', value:vision.feelSafe},
      ],
      medianPerM2:vision.medianPerM2,
      trend:vision.trend,
      commute:{minutes:vision.commute.minutes, destination:t(vision.commute.destination)},
      soilRisk:vision.soilRisk,
    };
  };
}

const INTERIOR = [
  {id:'kitchen', es:'Cocina integral', pt:'Cozinha planejada'},
  {id:'closet', es:'Clósets en recámaras', pt:'Armários nos quartos'},
  {id:'washer', es:'Área de lavado', pt:'Área de serviço'},
  {id:'ac', es:'Aire acondicionado', pt:'Ar-condicionado'},
  {id:'heater', es:'Calentador de paso', pt:'Aquecedor de passagem'},
  {id:'storage', es:'Bodega', pt:'Depósito'},
  {id:'light', es:'Ventanales de piso a techo', pt:'Janelas do piso ao teto'},
  {id:'wood', es:'Piso de madera', pt:'Piso de madeira'},
];
const BUILDING = [
  {id:'elevator', es:'Elevador', pt:'Elevador'},
  {id:'security', es:'Vigilancia 24 h', pt:'Portaria 24 h'},
  {id:'lobby', es:'Lobby con recepción', pt:'Lobby com recepção'},
  {id:'cowork', es:'Área de coworking', pt:'Espaço de coworking'},
  {id:'roof', es:'Roof garden', pt:'Rooftop'},
  {id:'bike', es:'Bicicletero', pt:'Bicicletário'},
];

/** A closed vocabulary for the unit and the building, drawn per listing. Never room sizes, floor plans or the surroundings. */
export function listingAmenities(home, facts = listingFacts(home)) {
  const kinds = new Set((reading[home.photoSetId]?.spaces || []).map(space => space.kind));
  const furnished = reading[home.photoSetId]?.furnished ?? seed(`${home.id}:furnished`) % 3 === 0;
  const interior = seededShuffle(INTERIOR, `${home.id}:interior`).slice(0, 4 + seed(`${home.id}:ni`) % 3);
  if (furnished) interior.unshift({id:'sofa', es:'Amueblado', pt:'Mobiliado'});
  if (kinds.has('balcón') || kinds.has('terraza')) interior.push({id:'balcony', es:kinds.has('terraza') ? 'Terraza privada' : 'Balcón', pt:kinds.has('terraza') ? 'Terraço privativo' : 'Varanda'});
  const building = seededShuffle(BUILDING, `${home.id}:building`).slice(0, 3 + seed(`${home.id}:nb`) % 3);
  if (kinds.has('gimnasio')) building.push({id:'gym', es:'Gimnasio', pt:'Academia'});
  if (kinds.has('alberca')) building.push({id:'pool', es:'Alberca', pt:'Piscina'});
  if (facts.parking) building.push({id:'car', es:`${facts.parking} ${facts.parking === 1 ? 'estacionamiento' : 'estacionamientos'}`, pt:`${facts.parking} ${facts.parking === 1 ? 'vaga' : 'vagas'}`});
  building.push(facts.pets ? {id:'pets', es:'Acepta mascotas', pt:'Aceita pets'} : {id:'nopets', es:'No acepta mascotas', pt:'Não aceita pets'});
  return [
    ...interior.map(item => ({...item, group:'interior'})),
    ...building.map(item => ({...item, group:'building'})),
  ];
}

const OPENINGS = [
  ['La luz entra por la mañana y se queda en la estancia buena parte del día.', 'A luz entra pela manhã e fica na sala boa parte do dia.'],
  ['La distribución separa bien la zona social de las recámaras.', 'A distribuição separa bem a área social dos quartos.'],
  ['Es un departamento tranquilo, lejos del ruido de la avenida.', 'É um apartamento tranquilo, longe do barulho da avenida.'],
];
const INTERIOR_LINES = [
  ['La cocina abre hacia el comedor, así que cocinar no te aísla de la mesa.', 'A cozinha abre para a sala de jantar, então cozinhar não te isola da mesa.'],
  ['La recámara principal tiene baño propio y espacio para un escritorio pequeño.', 'O quarto principal tem banheiro próprio e espaço para uma escrivaninha pequena.'],
  ['Los acabados se renovaron hace poco: pisos, baños y la cocina completa.', 'Os acabamentos foram renovados há pouco: pisos, banheiros e a cozinha inteira.'],
];
const TERMS = {
  rent:['El contrato mínimo es de 12 meses. Piden un mes de depósito y aval o póliza jurídica.', 'O contrato mínimo é de 12 meses. Pedem um mês de depósito e fiador ou seguro-fiança.'],
  buy:['Se acepta crédito hipotecario bancario. La escritura está lista para firmar ante notario.', 'Aceita financiamento bancário. A escritura está pronta para assinar no cartório.'],
};

/** Prose in both languages, built from the facts above so the page never contradicts itself. */
export function listingDescription(home, facts = listingFacts(home), places = listingPlaces(home).places) {
  const n = seed(`${home.id}:story`);
  const pt = language => language === 'pt-BR';
  const metro = places.find(place => place.categoria === 'metro');
  const park = places.find(place => place.categoria === 'parque' && !place.invented);
  return language => {
    const p = pt(language), i = p ? 1 : 0;
    const kind = home.mode === 'rent' ? (p ? 'Apartamento para alugar' : 'Departamento en renta') : (p ? 'Apartamento à venda' : 'Departamento en venta');
    const rooms = p ? `${facts.beds} ${facts.beds === 1 ? 'quarto' : 'quartos'} e ${facts.baths} ${facts.baths === 1 ? 'banheiro' : 'banheiros'}` : `${facts.beds} ${facts.beds === 1 ? 'recámara' : 'recámaras'} y ${facts.baths} ${facts.baths === 1 ? 'baño' : 'baños'}`;
    const first = p
      ? `${kind} com ${facts.size} m² no ${facts.floor}º andar de ${home.street}, em ${home.area}. São ${rooms}. ${pick(OPENINGS, n)[i]}`
      : `${kind} de ${facts.size} m² en el piso ${facts.floor} de ${home.street}, en ${home.area}. Tiene ${rooms}. ${pick(OPENINGS, n)[i]}`;
    const second = `${pick(INTERIOR_LINES, n >>> 4)[i]} ${p ? `O prédio tem ${facts.years} anos e manutenção em dia.` : `El edificio tiene ${facts.years} años y el mantenimiento al día.`}`;
    const nearby = [metro && (p ? `a estação ${metro.name} fica a ${metro.minutes} min a pé` : `la estación ${metro.name} queda a ${metro.minutes} min a pie`), park && (p ? `${park.name} a ${park.minutes} min` : `${park.name} a ${park.minutes} min`)].filter(Boolean);
    const third = nearby.length
      ? (p ? `Na região, ${nearby.join(' e ')}.` : `En la zona, ${nearby.join(' y ')}.`)
      : (p ? `${home.area} tem comércio de bairro e transporte por perto.` : `${home.area} tiene comercio de barrio y transporte cerca.`);
    return [first, second, `${third} ${TERMS[home.mode === 'rent' ? 'rent' : 'buy'][i]}`];
  };
}

/** Up to `limit` listings of the same operation, closest first, drawn in a stable order per listing. */
export function similarListings(home, pool = homes, limit = 10) {
  const price = listingPrice(home) || 1;
  const score = item => (item.area === home.area ? 0 : 1) + Math.abs(listingPrice(item) - price) / price + Math.abs((item.beds ?? 0) - (home.beds ?? 0)) * 0.25;
  const near = pool.filter(item => item.mode === home.mode && item.id !== home.id)
    .sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))
    .slice(0, limit * 2);
  return seededShuffle(near, `${home.id}:similar`).slice(0, limit);
}

export function listingStory(home) {
  const facts = listingFacts(home);
  const location = listingPlaces(home);
  return {
    facts,
    location,
    neighborhood:listingNeighborhood(home, location.center),
    gallery:listingGallery(home),
    amenities:listingAmenities(home, facts),
    description:listingDescription(home, facts, location.places),
  };
}
