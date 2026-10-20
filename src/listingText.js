/** Attributes and inconsistencies Mora can read from the listing title. Confidence stays at the announcement, never a confirmed fact. */

export const ATTRIBUTES = [
  {id:'roof', es:'roof garden', pt:'roof garden', pattern:/roof\s*(?:top|garden)|azotea/i},
  {id:'penthouse', es:'penthouse', pt:'penthouse', pattern:/pent\s*-?\s*house|\bpenthouse\b/i},
  {id:'levels', es:'dos niveles', pt:'dois andares', pattern:/2\s*pisos|dos\s+(?:pisos|niveles)|tres\s+niveles/i},
  {id:'garden', es:'jardín', pt:'jardim', pattern:/jard[ií]n/i},
  {id:'pool', es:'alberca', pt:'piscina', pattern:/alberca|piscina/i},
  {id:'furnished', es:'amueblado', pt:'mobiliado', pattern:/amueblad/i},
  {id:'unfurnished', es:'sin muebles', pt:'sem móveis', pattern:/sin muebles|sem m[oó]veis/i},
  {id:'remodeled', es:'remodelado', pt:'reformado', pattern:/remodelad/i},
  {id:'to-remodel', es:'para remodelar', pt:'para reformar', pattern:/para remodelar|para reformar/i},
  {id:'view', es:'vista', pt:'vista', pattern:/vista/i},
  {id:'loft', es:'loft', pt:'loft', pattern:/loft/i},
  {id:'balcony', es:'balcón', pt:'varanda', pattern:/balc[oó]n|varanda/i},
  {id:'terrace', es:'terraza', pt:'terraço', pattern:/terraza|terra[cç]o/i},
];

const BUILDING = [
  {id:'loft', pattern:/loft/i},
  {id:'penthouse', pattern:/pent\s*-?\s*house|\bpenthouse\b/i},
  {id:'tower', pattern:/torre|edificio/i},
];

const fold = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** What the title claims, and where it disagrees with itself or with a structured field. */
export function listingText(home) {
  const title = home?.title || '';
  const attributes = ATTRIBUTES.filter(item => item.pattern.test(title)).map(({id, es, pt}) => ({id, es, pt}));
  const building = BUILDING.find(item => item.pattern.test(title))?.id || null;
  const inconsistencies = [];
  const ids = new Set(attributes.map(item => item.id));
  if (ids.has('furnished') && ids.has('unfurnished')) inconsistencies.push('furnished');
  if (ids.has('remodeled') && ids.has('to-remodel')) inconsistencies.push('condition');
  const rooms = fold(title).match(/(\d+)\s*recamaras?/);
  if (rooms && home?.beds != null && Number(rooms[1]) !== home.beds) inconsistencies.push('beds');
  return {attributes, inconsistencies, building};
}
