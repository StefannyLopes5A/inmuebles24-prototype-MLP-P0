import listings from './real-listings.json' with {type:'json'};

export const homes = listings.map(h=>({...h, imageAlt:`${h.title} · ${h.area}`, reason:h.size>=20?h.reason:`${h.beds} recámaras · Superficie por confirmar`}));
export const areaLabel = h => h.size >= 20 ? `${h.size} m²` : 'Superficie por confirmar';
export const money = n => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0}).format(n);
export const listingPrice = h => h.mode === 'rent' ? h.rent : h.price;
export const propertyPhoto = h => h.image;
const agencyLogoPool = [...new Set(listings.map(h => h.brokerLogo).filter(Boolean))];
export const cardAgencyLogo = h => h.brokerLogo || agencyLogoPool[Number(h.listingId) % agencyLogoPool.length];
export const isSeparate = h => h.beds >= 3;
export const isExtra = h => h.beds >= 3;
export const defaults = {mode:'buy', area:'Ambas zonas', address:'', budget:4500000, beds:2, note:'', fromIdea:false};
export const areas = ['Ambas zonas', ...new Set(homes.map(h => h.area))].sort((a,b) => a==='Ambas zonas'?-1:b==='Ambas zonas'?1:a.localeCompare(b,'es'));
export const budgets = mode => mode==='buy' ? [3500000,4000000,4500000,5000000,7500000,10000000,20000000,40000000] : [18000,22000,25000,28000,32000,45000,65000,100000,150000];
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
    {id:'routine',title:'Tu espacio, a tu manera',queryLead:suggestions[2][0],area:suggestions[2][1],subtitle:'Diferentes distribuciones para una nueva rutina.',note:'Busco un espacio que se adapte a mi rutina',beds:2,budget:budget(10000000,65000),items:take((a,b)=>a.beds-b.beds)},
    {id:'city',title:'Un nuevo capítulo en la ciudad',queryLead:suggestions[3][0],area:suggestions[3][1],subtitle:'Otras direcciones para descubrir cómo te gustaría vivir.',note:'Quiero conocer otros barrios de la ciudad',beds:2,budget:budget(20000000,65000),items:take((a,b)=>a.area.localeCompare(b.area,'es'))},
    {id:'possibilities',title:'Todavía hay más por descubrir',queryLead:suggestions[4][0],area:suggestions[4][1],subtitle:'Sigue explorando. Tu próximo lugar puede sorprenderte.',note:'Quiero seguir descubriendo qué me gusta',beds:mode==='buy'?3:1,budget:budget(10000000,45000),items:take((a,b)=>listingPrice(a)-listingPrice(b))},
  ].map(idea=>({...idea,previewItems:homes.filter(h=>h.mode===mode&&h.area===idea.area).slice(0,3)}));
}
