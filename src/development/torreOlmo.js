// Torre Olmo is a fictional development: units, prices and the developer are prototype data.
// The building is the Sketchfab GLB (CC-BY-4.0); floors and sides come from buildingConfig.js.
import {BUILDING, SIDES, residentialFloors, unitId, unitIndex} from './buildingConfig.js';

const ASSETS = '/assets/developments/torre-olmo';

export const DEVELOPER = {
  id:'grupo-alameda',
  name:'Grupo Alameda Desarrollos',
  logo:`${ASSETS}/grupo-alameda.svg`,
  since:2009,
  otherProjects:34,
};

export const TYPOLOGIES = [
  {id:'A', beds:1, suites:0, baths:1, parking:0, size:64, base:7350000, plan:`${ASSETS}/plans/tipo-a.png`},
  {id:'B', beds:2, suites:1, baths:2, parking:1, size:96, base:10900000, plan:`${ASSETS}/plans/tipo-b.png`},
  {id:'C', beds:3, suites:1, baths:2, parking:1, size:128, base:14600000, plan:`${ASSETS}/plans/tipo-c.png`, planAlt:`${ASSETS}/plans/tipo-c-alt.png`},
];
const typology = id => TYPOLOGIES.find(item => item.id === id);

// Two homes per facade. North units look at Parque América; the low ones are studios, from the 6th floor up
// three bedrooms. South units are two bedrooms on every floor, facing Parque Lincoln.
const layout = (floor, side) => (side === 1 ? 'B' : floor <= 5 ? 'A' : 'C');

// Rail order on each floor, left to right: 01, 02, 03, 04. Orange on the mapped rail is available.
// Gray stays unavailable; the three that were already apartadas keep that state.
const STATUS = {
  available:[
    '201', '202', '204',
    '301', '302', '303',
    '402', '404',
    '501', '503', '504',
    '603', '604',
    '701',
    '801', '802', '804',
    '901', '903', '904',
    '1002', '1004',
    '1101',
    '1201', '1202', '1204',
  ],
  reserved:['401', '803', '1102'],
};
const statusOf = id => (STATUS.available.includes(id) ? 'available' : STATUS.reserved.includes(id) ? 'reserved' : 'sold');

// PRD rule: each floor above the 2nd adds 1.2% to the typology's base price.
export const unitPrice = (base, floor) => Math.round(base * (1 + 0.012 * (floor - BUILDING.firstResidentialFloor)) / 10000) * 10000;

export const UNITS = residentialFloors.flatMap(floor => [0, 1].flatMap(side => [0, 1].map(bay => {
  const id = unitId(floor, side, bay);
  const type = typology(layout(floor, side));
  const price = unitPrice(type.base, floor);
  return {
    id, floor, side, bay, index:unitIndex({floor, side, bay}),
    typology:type.id, beds:type.beds, suites:type.suites, baths:type.baths, parking:type.parking, size:type.size,
    orientation:SIDES[side], plan:side === 1 || !type.planAlt || floor % 2 ? type.plan : type.planAlt,
    price, perMeter:Math.round(price / type.size), status:statusOf(id),
  };
})));

export const unitById = id => UNITS.find(unit => unit.id === String(id)) || null;
export const available = UNITS.filter(unit => unit.status === 'available');

const span = values => [Math.min(...values), Math.max(...values)];
// What the card reads: what can still be bought.
export const RANGES = {
  price:span(available.map(unit => unit.price)),
  size:span(available.map(unit => unit.size)),
  beds:span(available.map(unit => unit.beds)),
  parking:span(available.map(unit => unit.parking)),
};

// Anchors in floors (1 = amenities level, 0 = lobby, 'roof' = rooftop).
export const AMENITIES = [
  {id:'rooftop', icon:'pool', name:['Rooftop com piscina', 'Rooftop con alberca'], anchor:'roof'},
  {id:'gym', icon:'gym', name:['Academia', 'Gimnasio'], anchor:1},
  {id:'events', icon:'events', name:['Salão de festas', 'Salón de eventos'], anchor:1},
  {id:'lobby', icon:'lobby', name:['Lobby com recepção', 'Lobby con recepción'], anchor:0},
  {id:'security', icon:'security', name:['Segurança 24 h', 'Seguridad 24 h']},
  {id:'bikes', icon:'bike', name:['Bicicletário', 'Bicicletero']},
  {id:'pets', icon:'pet', name:['Aceita pets', 'Pet friendly']},
  {id:'laundry', icon:'laundry', name:['Lavanderia', 'Cuarto de lavado']},
];

export const GALLERY = [
  {src:`${ASSETS}/render-fachada.jpg`, category:'general', alt:['Render da fachada da Torre Olmo', 'Render de la fachada de Torre Olmo'], render:true},
  {src:`${ASSETS}/piscina.webp`, category:'outdoor', alt:['Piscina do rooftop', 'Alberca del rooftop'], render:true},
  {src:`${ASSETS}/academia.jpg`, category:'amenities', alt:['Academia do condomínio', 'Gimnasio del condominio'], render:true},
  {src:`${ASSETS}/salao.webp`, category:'amenities', alt:['Salão de festas', 'Salón de eventos'], render:true},
  {src:`${ASSETS}/rooftop.webp`, category:'outdoor', alt:['Terraço do rooftop com churrasqueira', 'Terraza del rooftop con asador'], render:true},
  {src:`${ASSETS}/piscina-2.webp`, category:'outdoor', alt:['Piscina do rooftop, vista longa', 'Alberca del rooftop, vista larga'], render:true},
  {src:`${ASSETS}/salao-2.webp`, category:'amenities', alt:['Estar do salão de festas', 'Estar del salón de eventos'], render:true},
  {src:`${ASSETS}/lobby.webp`, category:'amenities', alt:['Lobby com jardim interno', 'Lobby con jardín interior'], render:true},
  {src:`${ASSETS}/salao-3.webp`, category:'amenities', alt:['Sala de jantar do salão', 'Comedor del salón'], render:true},
  {src:`${ASSETS}/estar.webp`, category:'amenities', alt:['Estar e jantar com vista da cidade', 'Estar y comedor con vista a la ciudad'], render:true},
  {src:`${ASSETS}/estar-2.webp`, category:'amenities', alt:['Lounge com cozinha aberta e vista', 'Lounge con cocina abierta y vista'], render:true},
  {src:`${ASSETS}/rooftop-2.webp`, category:'outdoor', alt:['Área externa do rooftop', 'Área exterior del rooftop'], render:true},
  {src:`${ASSETS}/aerial.jpg`, category:'general', alt:['Vista aérea da torre e do entorno', 'Vista aérea de la torre y su entorno'], render:true},
  {src:`${ASSETS}/street.jpg`, category:'general', alt:['Acesso pela rua, com o lobby envidraçado', 'Acceso por la calle, con el lobby de vidrio'], render:true},
];

const PHOTO_ROOMS = [
  {id:'general', es:'Visión general', pt:'Visão geral'},
  {id:'outdoor', es:'Exteriores', pt:'Áreas externas'},
  {id:'amenities', es:'Amenidades', pt:'Comodidades'},
];

/** Same shape as the listing gallery: rooms, then the dark viewer. The card film is the tour section. */
export function developmentGallery(home = TORRE_OLMO_HOME) {
  const photos = GALLERY.map((photo, index) => ({src:photo.src, index, category:photo.category, borrowed:false}));
  const categories = PHOTO_ROOMS
    .map(room => ({...room, photos:photos.filter(photo => photo.category === room.id)}))
    .filter(room => room.photos.length);
  return {photos, categories, video:home?.video || null};
}

export const DEVELOPMENT = {
  id:'torre-olmo',
  name:'Torre Olmo',
  street:'Calle Arquímedes',
  area:'Polanco V Sección',
  borough:'Miguel Hidalgo',
  delivery:'2027-12',
  maintenanceFrom:6400,
  verified:true,
  floors:BUILDING.levels + 1,
  credit:{author:'saeedakbari', license:'CC-BY-4.0', url:'https://sketchfab.com/3d-models/residential-complex-modern-apartment-building-d1e54b379c664a349cd4a288527317c8'},
  description:[
    'Torre residencial de 13 níveis em Polanco V Sección, a uma quadra do Parque Lincoln. Quatro unidades por andar, duas voltadas para o norte e duas para o sul, todas com varanda. Térreo com lobby de pé-direito duplo, amenidades no primeiro andar e rooftop com piscina. Entrega prevista para dezembro de 2027.',
    'Torre residencial de 13 niveles en Polanco V Sección, a una cuadra del Parque Lincoln. Cuatro unidades por piso, dos hacia el norte y dos hacia el sur, todas con balcón. Planta baja con lobby de doble altura, amenidades en el primer piso y rooftop con alberca. Entrega estimada en diciembre de 2027.',
  ],
};

// Mora's reading of the development, written from the inventory above.
export const MORA = {
  pros:[
    {icon:'green', title:['O sul olha para o Parque Lincoln', 'El sur mira al Parque Lincoln'], note:['A 270 m; do 8º andar para cima, nada alto na frente', 'A 270 m; del piso 8 hacia arriba, nada alto enfrente']},
    {icon:'transport', title:['Metrô Polanco a 10 min', 'Metro Polanco a 10 min'], note:['Linha 7, a 590 m caminhando', 'Línea 7, a 590 m caminando']},
    {icon:'levels', title:['Quatro unidades por andar', 'Cuatro unidades por piso'], note:['Duas por fachada, cada uma de frente para um parque', 'Dos por fachada, cada una de frente a un parque']},
  ],
  cons:[
    {icon:'price', title:['O m² está 12% acima de Polanco V Sección', 'El m² está 12% arriba de Polanco V Sección'], note:['Média da colônia: $102,000 por m²', 'Promedio de la colonia: $102,000 por m²']},
    {icon:'unknown', title:['Entrega em dezembro de 2027', 'Entrega en diciembre de 2027'], note:['Vale pedir o calendário de pagamentos e a garantia', 'Vale pedir el calendario de pagos y la garantía']},
  ],
};

// From the 8th floor up nothing in the extract stands in front of either facade.
const bestView = available.filter(unit => unit.floor >= 8).sort((a, b) => b.floor - a.floor || b.index - a.index).slice(0, 3);
const cheapest = [...available].sort((a, b) => a.perMeter - b.perMeter)[0];
export const MORA_ANSWERS = {
  view:{units:bestView.map(unit => unit.id), view:bestView[0]?.id},
  cheapest:{unit:cheapest.id},
  kids:{poi:'Kínder & Primaria Lafontaine'},
};

// Listing record the catalog, favourites and the mini-listing read.
export const TORRE_OLMO_HOME = {
  id:'torre-olmo',
  listingId:'torre-olmo',
  development:true,
  mode:'buy',
  currency:'MXN',
  title:'Torre Olmo · Departamentos en Polanco V Sección',
  street:'Torre Olmo',
  area:DEVELOPMENT.area,
  location:`${DEVELOPMENT.area}, ${DEVELOPMENT.borough}`,
  price:RANGES.price[0],
  rent:null,
  beds:RANGES.beds[0],
  baths:1,
  size:RANGES.size[0],
  features:`${RANGES.size[0]}–${RANGES.size[1]} m² · ${RANGES.beds[0]}–${RANGES.beds[1]} rec.`,
  fee:null,
  broker:DEVELOPER.name,
  brokerLogo:DEVELOPER.logo,
  layout:'unknown',
  window:null,
  reason:`${available.length} de ${UNITS.length} unidades disponibles`,
  caveat:'Precios y disponibilidad de preventa: confírmalos con la desarrolladora.',
  image:GALLERY[0].src,
  imageSource:GALLERY[0].src,
  video:`${ASSETS}/preview.mp4`,
  capturedAt:'2026-10-14',
};

export const unitHomeId = unitId => `${TORRE_OLMO_HOME.id}-u-${unitId}`;

/** A favorite-shaped listing for one apartment, so heart/share can target a unit without entering the search catalog. */
export function unitAsHome(unit) {
  if (!unit) return null;
  return {
    id:unitHomeId(unit.id),
    listingId:unitHomeId(unit.id),
    unitId:unit.id,
    unitOf:TORRE_OLMO_HOME.id,
    development:false,
    mode:'buy',
    currency:'MXN',
    title:`${DEVELOPMENT.name} · Unidad ${unit.id}`,
    street:`Unidad ${unit.id}`,
    area:DEVELOPMENT.area,
    location:`${DEVELOPMENT.area}, ${DEVELOPMENT.borough}`,
    price:unit.price,
    rent:null,
    beds:unit.beds,
    baths:unit.baths,
    size:unit.size,
    features:`${unit.beds} rec. · ${unit.size} m² · piso ${unit.floor}`,
    fee:null,
    broker:DEVELOPER.name,
    brokerLogo:DEVELOPER.logo,
    layout:'unknown',
    window:null,
    reason:`${unit.size} m² · piso ${unit.floor}`,
    caveat:'Precios y disponibilidad de preventa: confírmalos con la desarrolladora.',
    image:unit.plan,
    imageSource:unit.plan,
    imageAlt:`${DEVELOPMENT.name} · Unidad ${unit.id}`,
    video:null,
    capturedAt:TORRE_OLMO_HOME.capturedAt,
  };
}

export const UNIT_HOMES = UNITS.map(unitAsHome);
export const unitHomeById = id => UNIT_HOMES.find(home => home.id === id) || null;
