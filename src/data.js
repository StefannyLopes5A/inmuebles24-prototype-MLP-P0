import listings from './real-listings.json' with {type:'json'};
import {advertiserFor} from './listingAdvertiser.js';
import {TORRE_OLMO_HOME} from './development/torreOlmo.js';

export const homes = [...listings, TORRE_OLMO_HOME].map(h=>({...h, imageAlt:`${h.title} · ${h.area}`, reason:h.size>=20?h.reason:`${h.beds} recámaras · Superficie por confirmar`}));
export const isDevelopment = h => h?.development === true;
export const areaLabel = h => h.size >= 20 ? `${h.size} m²` : 'Superficie por confirmar';
export const money = n => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0}).format(n);
export const listingPrice = h => h.mode === 'rent' ? h.rent : h.price;
export const propertyPhoto = h => h.image;
const agencyLogoPool = [...new Set(listings.map(h => h.brokerLogo).filter(Boolean))];
export const cardAgencyLogo = h => h.brokerLogo || advertiserFor(h).logo || agencyLogoPool[Number(h.listingId) % agencyLogoPool.length];
export const isSeparate = h => h.beds >= 3;
export const isExtra = h => h.beds >= 3;
export const defaults = {mode:'buy', area:'Ambas zonas', address:'', budget:4500000, beds:2, note:'', fromIdea:false};
export const areas = ['Ambas zonas', ...new Set(homes.map(h => h.area))].sort((a,b) => a==='Ambas zonas'?-1:b==='Ambas zonas'?1:a.localeCompare(b,'es'));
export const budgets = mode => mode==='buy' ? [3500000,4000000,4500000,5000000,7500000,10000000,20000000,40000000] : [18000,22000,25000,28000,32000,45000,65000,100000,150000];

export const NEIGHBORHOOD_CITIES = [
  'Ciudad de México',
  'Edo. de México',
  'Nuevo León',
  'Jalisco',
  'Querétaro',
  'Puebla',
  'Quintana Roo',
  'Yucatán',
  'Morelos',
  'Veracruz',
];

export const DEMO_CITY_AREAS = {
  'Edo. de México': ['Interlomas', 'Satélite', 'Naucalpan', 'Toluca Centro', 'Huixquilucan', 'Metepec', 'Lomas Verdes', 'Coacalco'],
  'Nuevo León': ['San Pedro Garza García', 'Centro Monterrey', 'Cumbres', 'Valle Oriente', 'Santa Catarina', 'San Nicolás', 'Carretera Nacional', 'Mitras'],
  'Jalisco': ['Providencia', 'Zapopan Centro', 'Puerta de Hierro', 'Tlaquepaque', 'Chapalita', 'Andares', 'Colinas de San Javier', 'Oblatos'],
  'Querétaro': ['Juriquilla', 'Centro Histórico', 'El Refugio', 'Zibatá', 'Milán', 'Alamos', 'Cumbres del Lago', 'Santa Fe'],
  'Puebla': ['Angelópolis', 'La Paz', 'Centro Histórico', 'Lomas de Angelópolis', 'La Vista', 'Momoxpan', 'San Manuel', 'Zavaleta'],
  'Quintana Roo': ['Centro Cancún', 'Puerto Juárez', 'Supermanzana 15', 'Playacar', 'Tulum Centro', 'Colegio', 'Zona Hotelera', 'Aldea Zama'],
  'Yucatán': ['Centro Mérida', 'Montebello', 'García Ginerés', 'Temozón Norte', 'Cholul', 'Montes de Amé', 'Itzimná', 'Francisco de Montejo'],
  'Morelos': ['Centro Cuernavaca', 'Lomas de Cortés', 'Burgos', 'Palmira', 'Vista Hermosa', 'Tlaltenango', 'Ahuatepec', 'Jiutepec'],
  'Veracruz': ['Boca del Río', 'Centro Veracruz', 'Costa de Oro', 'Mocambo', 'Ricardo Flores Magón', 'Costa Verde', 'Formando Hogar', 'Floresta'],
};

function neighborhoodSeed(area, mode, city = 'Ciudad de México') {
  let hash = 0;
  const key = `${city}:${mode}:${area}`;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return hash;
}

function demoNeighborhoodCards(areas, mode, city) {
  const rental = mode === 'rent';
  return areas.map(area => {
    const seed = neighborhoodSeed(area, mode, city);
    return {
      area,
      count: 8 + (seed % 40),
      averagePrice: rental
        ? 12_000 + (seed % 151) * 500
        : 1_800_000 + (seed % 180) * 100_000,
      searchable: false,
    };
  }).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area, 'es'));
}

/** Demo neighborhood rail: CDMX buy/rent use catalog areas; other cities/ops are illustrative. */
export function neighborhoodRecommendations(mode = 'buy', city = 'Ciudad de México') {
  const operation = ['rent', 'buy', 'development', 'auction'].includes(mode) ? mode : 'buy';
  if (city !== 'Ciudad de México') {
    return demoNeighborhoodCards(DEMO_CITY_AREAS[city] || DEMO_CITY_AREAS['Edo. de México'], operation, city);
  }
  if (operation === 'buy' || operation === 'rent') {
    const counts = new Map();
    for (const home of homes) {
      if (home.mode !== operation) continue;
      counts.set(home.area, (counts.get(home.area) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([area, count]) => {
        const seed = neighborhoodSeed(area, operation, city);
        const averagePrice = operation === 'buy'
          ? 2_500_000 + (seed % 156) * 100_000
          : 15_000 + (seed % 131) * 500;
        return {area, count, averagePrice, searchable: true};
      })
      .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area, 'es'));
  }
  const catalogAreas = [...new Set(homes.map(home => home.area))];
  return demoNeighborhoodCards(catalogAreas.slice(0, 12), operation, city);
}
export function baseList(search, expanded) {
  const address=(search.address||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return homes.filter(h => h.mode===search.mode && (!search.area||search.area==='Ambas zonas'||h.area===search.area||(expanded&&h.area==='Santa María la Ribera')) && (!address||`${h.street} ${h.area} ${h.location}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(address)) && listingPrice(h)<=search.budget && h.beds>=search.beds);
}

// Five disjoint selections of ten published listings per operation.
export function inspirationCollections(mode) {
  let remaining=homes.filter(h=>h.mode===mode);
  function take(compare){const items=[...remaining].sort(compare).slice(0,10);const ids=new Set(items.map(h=>h.id));remaining=remaining.filter(h=>!ids.has(h.id));return items;}
  const budget=(buy,rent)=>mode==='buy'?buy:rent;
  const suggestions=mode==='buy' ? [
    ['Departamento de 1 recámara en Roma Norte, CDMX','Roma Norte'],
    ['Departamento de 3 recámaras en Narvarte Poniente','Narvarte Poniente'],
    ['Departamento de 2 recámaras en Del Valle Centro','Del Valle Centro'],
    ['Departamento de 2 recámaras en Juárez, CDMX','Juárez'],
    ['Departamento de 3 recámaras en Del Valle Norte','Del Valle Norte'],
  ] : [
    ['Departamento de 1 recámara en Nápoles, CDMX','Nápoles'],
    ['Departamento de 3 recámaras en Polanco, CDMX','Polanco'],
    ['Departamento de 2 recámaras en Ampliación Granada','Ampliación Granada'],
    ['Departamento de 2 recámaras en Granada, CDMX','Granada'],
    ['Departamento de 1 recámara en Colonia Centro','Colonia Centro'],
  ];
  return [
    {id:'discover',title:'Tu próximo hogar podría estar aquí',queryLead:suggestions[0][0],area:suggestions[0][1],subtitle:'Diez lugares para empezar a imaginar tu vida en CDMX.',note:'Quiero descubrir un lugar para mi próxima etapa',beds:1,budget:budget(4500000,28000),items:take((a,b)=>listingPrice(a)-listingPrice(b))},
    {id:'space',title:'Más espacio para lo que viene',queryLead:suggestions[1][0],area:suggestions[1][1],subtitle:'Explora los espacios más amplios de esta selección.',note:'Me importa tener más espacio para mi rutina',beds:3,budget:budget(40000000,100000),items:take((a,b)=>b.size-a.size)},
    {id:'routine',title:'Tu espacio, a tu manera',queryLead:suggestions[2][0],area:suggestions[2][1],subtitle:'Diferentes distribuciones para una nueva rutina.',note:'Busco un espacio que se adapte a mi rutina',beds:2,budget:budget(10000000,65000),items:take((a,b)=>(a.beds??0)-(b.beds??0))},
    {id:'city',title:'Un nuevo capítulo en la ciudad',queryLead:suggestions[3][0],area:suggestions[3][1],subtitle:'Otras direcciones para descubrir cómo te gustaría vivir.',note:'Quiero conocer otros barrios de la ciudad',beds:2,budget:budget(20000000,65000),items:take((a,b)=>a.area.localeCompare(b.area,'es'))},
    {id:'possibilities',title:'Todavía hay más por descubrir',queryLead:suggestions[4][0],area:suggestions[4][1],subtitle:'Sigue explorando. Tu próximo lugar puede sorprenderte.',note:'Quiero seguir descubriendo qué me gusta',beds:mode==='buy'?3:1,budget:budget(10000000,45000),items:take((a,b)=>listingPrice(a)-listingPrice(b))},
  ].map(idea=>({...idea,previewItems:homes.filter(h=>h.mode===mode&&h.area===idea.area).slice(0,3)}));
}
