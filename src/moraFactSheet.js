import gold from './data/mora-gold.json' with {type:'json'};
import agencies from '../AGENCY-SOURCES.json' with {type:'json'};
import {homes as catalog, listingPrice} from './data.js';
import {pricePerM2, travelMinutes} from './compareReading.js';
import {listingDetails} from './listingPresentation.js';
import {homeCoordinates} from './mapLocations.js';
import {ALCALDIA_BY_COLONIA} from './mapWidgetContent.js';
import {nearbyPois, poisFor} from './pois.js';
import {matchesCriteria} from './searchCriteria.js';
import {prototypeResults} from './journey.js';
import {advertiserFor} from './listingAdvertiser.js';
import {listingText} from './listingText.js';
import {photoReading} from './moraInsights.js';
import {ZONE_MEDIAN_DAYS, declaredMinutes, marketFacts, placeName, priceClass} from './moraAnalysis.js';

/**
 * The fact sheet Mora's text is written from. Every number is computed here, once; nothing in it is a sentence.
 * The person is the frozen `userContext` of the golden examples, so fixtures stay comparable with them.
 */
export const MORA_PERSONA = gold.userContext;

const CLASS = {review:'review_before_visit', opportunity:'opportunity', negotiate:'negotiable', above:'above_market', fair:'fair'};
const SPACE_FEATURE = {balcón:'balcony', terraza:'terrace', roof:'roof_garden', jardín:'garden', alberca:'pool', cocina:'kitchen', baño:'bathroom', recámara:'bedroom', estudio:'studio', gimnasio:'gym', estacionamiento:'parking'};
const MISSING_FEATURE = {baños:'bathrooms', cocina:'kitchen', recámara:'bedroom'};
const ACCENTS = {ticoman:'Ticomán', ticomán:'Ticomán', cuauhtemoc:'Cuauhtémoc', juarez:'Juárez', alvaro:'Álvaro', obregon:'Obregón', benito:'Benito', coyoacan:'Coyoacán', tlalpan:'Tlalpan', napoles:'Nápoles', seccion:'Sección'};
const LOWER = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'en']);
const ABBREVIATION = {av:'Av.', col:'Col.', blvd:'Blvd.', calz:'Calz.'};
const MAX_WALK = 30;

const fold = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const pct = (value, base) => Math.round((value / base - 1) * 100);

function properCase(text) {
  return String(text || '').trim().split(/\s+/).map((word, i) => {
    const bare = word.replace(/\.$/, '');
    const key = fold(bare);
    if (Object.hasOwn(ABBREVIATION, key)) return ABBREVIATION[key];
    if (Object.hasOwn(ACCENTS, key)) return ACCENTS[key];
    if (i > 0 && LOWER.has(key)) return key;
    if (/^[IVX]+$/.test(bare) || /\d/.test(bare)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

/** Capitalized, accented, without the colonia or alcaldía repeated inside the street, and with the full alcaldía name. */
export function normalizeAddress(home) {
  const colonia = properCase(String(home.area || '').replace(/^barrio\s+/i, ''));
  const tail = String(home.location || '').split(',').map(part => part.trim()).filter(Boolean).pop();
  const alcaldia = ALCALDIA_BY_COLONIA[home.area] || ALCALDIA_BY_COLONIA[colonia]
    || (tail && fold(tail) !== fold(home.area) && !/^polanco|^narvarte/i.test(tail) ? properCase(tail) : null);
  const known = [colonia, alcaldia].filter(Boolean).map(fold);
  const parts = String(home.street || '').split(',').map(part => part.trim()).filter(Boolean);
  const street = properCase(parts[0] || '');
  const extra = parts.slice(1).map(properCase).filter(part => !known.some(name => name.startsWith(fold(part)) || fold(part).startsWith(name)));
  const address = [street, ...extra, colonia, alcaldia].filter(Boolean).filter((part, i, all) => all.findIndex(other => fold(other) === fold(part)) === i).join(', ');
  return {address, street, colonia, alcaldia};
}

/** The person's search as the app stores it, so ranking and fit use the same rules as the results grid. */
export function personaSearch(persona = MORA_PERSONA) {
  const {search} = persona;
  return {
    mode:'buy', area:search.zones[0], areas:[...search.zones], budget:search.maxPrice, minBudget:0, beds:search.minBedrooms,
    criteria:search.furnished ? ['furnished'] : [], note:'',
  };
}

const nearest = (home, category) => {
  const poi = nearbyPois(homeCoordinates(home), poisFor(null, [category]), {radius:4000, limit:1})[0];
  if (!poi) return null;
  return {name:placeName(category, poi.properties.name), minutes:travelMinutes(Math.round(poi.properties.meters * 1.3), 'walk'), mode:'a pie'};
};

/** Declared places first, then search criteria, then the nearest park. Chain shops, cafés and clinics are not facts about the home. */
function pointsOfInterest(home, persona) {
  const items = [];
  for (const item of persona.declaredInConversation || []) {
    if (item.key !== 'office' || !item.place) continue;
    const place = item.place.replace(/^Paseo de la\s+/i, '');
    items.push({name:`Tu oficina en ${place}`, category:'office', minutes:declaredMinutes(home, place), mode:'en auto', reason:'declared:office'});
  }
  const metro = persona.search.nearMetroMaxWalkMin ? nearest(home, 'metro') : null;
  if (metro && metro.minutes <= MAX_WALK) items.push({...metro, category:'metro', reason:'search:nearMetro'});
  const park = nearest(home, 'parque');
  if (park && park.minutes <= MAX_WALK) items.push({...park, category:'park', reason:'nearest:park'});
  return items;
}

function similarity({priceDiffPct, m2DiffPct, bedroomsDiff, sameZone}) {
  const close = Math.abs(priceDiffPct) <= 10 && (m2DiffPct == null || Math.abs(m2DiffPct) <= 15) && Math.abs(bedroomsDiff ?? 0) <= 1;
  if (close) return 'high';
  if (sameZone || (Math.abs(priceDiffPct) <= 25 && (m2DiffPct == null || Math.abs(m2DiffPct) <= 25))) return 'medium';
  return 'low';
}

/** Favorites in the persona that exist in the catalog; the rest stay listed as unresolved, never invented. */
export function resolveFavorites(persona = MORA_PERSONA, inventory = catalog) {
  const resolved = [], unresolved = [];
  for (const favorite of persona.favorites || []) {
    const home = inventory.find(item => item.mode === 'buy' && fold(item.street).startsWith(fold(favorite.label)));
    if (home) resolved.push({id:favorite.id, label:favorite.label, home});
    else unresolved.push(favorite.id);
  }
  return {resolved, unresolved};
}

function fitFacts(home, persona, metroMinutes) {
  const {search} = persona;
  const price = listingPrice(home);
  const reading = photoReading(home);
  const spaces = new Set((reading?.spaces || []).map(item => item.kind));
  const facts = [
    {key:'zone', source:'search', status:search.zones.includes(home.area) ? 'met' : 'unmet', value:home.area},
    {key:'budget', source:'search', status:price <= search.maxPrice ? 'met' : 'unmet', limit:search.maxPrice, ...(price > search.maxPrice ? {overBy:price - search.maxPrice} : {})},
    {key:'bedrooms', source:'search', status:home.beds == null ? 'unknown' : home.beds >= search.minBedrooms ? 'met' : 'unmet', min:search.minBedrooms, value:home.beds},
  ];
  if (search.nearMetroMaxWalkMin) facts.push({key:'nearMetro', source:'search', status:metroMinutes == null ? 'unknown' : metroMinutes <= search.nearMetroMaxWalkMin ? 'met' : 'unmet', max:search.nearMetroMaxWalkMin, value:metroMinutes});
  if (search.furnished) facts.push(matchesCriteria(home, ['furnished'])
    ? {key:'furnished', source:'search', status:'met', basis:'listing'}
    : reading?.furnished === true ? {key:'furnished', source:'search', status:'seen', basis:'photo_inference'} : {key:'furnished', source:'search', status:'unknown'});
  for (const item of persona.declaredInConversation || []) {
    if (item.key !== 'balcony') continue;
    facts.push(matchesCriteria(home, ['balcony'])
      ? {key:'balcony', source:'conversation', status:'met', basis:'listing'}
      : spaces.has('balcón') ? {key:'balcony', source:'conversation', status:'seen', basis:'photo_inference', feature:'balcony'}
        : spaces.has('terraza') ? {key:'balcony', source:'conversation', status:'seen', basis:'photo_inference', feature:'terrace'}
          : {key:'balcony', source:'conversation', status:'unknown'});
  }
  return facts;
}

function photoFacts(home) {
  const reading = photoReading(home);
  const count = (listingDetails(home).gallery || []).length;
  if (!reading) return {count, detected:[], missing:[]};
  const detected = [
    {feature:'condition', value:reading.condition, confidence:'medium'},
    {feature:'light', value:reading.light, confidence:'medium'},
    {feature:'view', value:reading.view, confidence:'medium'},
    ...(reading.furnished != null ? [{feature:'furnished', value:reading.furnished, confidence:'medium'}] : []),
    ...(reading.render ? [{feature:'render', value:true, confidence:'medium'}] : []),
    ...(reading.spaces || []).map(space => ({feature:SPACE_FEATURE[space.kind] || space.kind, confidence:'medium', photoIndex:space.photo})),
  ];
  return {count, detected, missing:(reading.missing || []).map(item => MISSING_FEATURE[item] || item), note:reading.notes?.es || null};
}

export function factSheet(home, persona = MORA_PERSONA, inventory = catalog) {
  const facts = marketFacts(home);
  const kind = priceClass(facts);
  const search = personaSearch(persona);
  const results = prototypeResults(search);
  const ranked = results.filter(item => pricePerM2(item)).sort((a, b) => pricePerM2(a) - pricePerM2(b) || a.id.localeCompare(b.id));
  const rank = ranked.findIndex(item => item.id === home.id);
  const advertiser = advertiserFor(home, agencies.logos);
  const pois = pointsOfInterest(home, persona);
  const metroMinutes = pois.find(item => item.category === 'metro')?.minutes ?? null;
  const officeMinutes = pois.find(item => item.category === 'office')?.minutes ?? null;
  const {resolved, unresolved} = resolveFavorites(persona, inventory);
  const park = pois.find(item => item.category === 'park');
  const text = listingText(home);
  const price = listingPrice(home);
  return {
    listing:{
      id:home.id,
      ...normalizeAddress(home),
      addressRaw:[home.street, home.location].filter(Boolean).join(', '),
      zone:home.area,
      type:'departamento',
      operation:home.mode === 'rent' ? 'renta' : 'venta',
      price,
      m2:home.size >= 20 ? home.size : null,
      bedrooms:home.beds ?? null,
      bathrooms:home.baths ?? null,
      parking:listingDetails(home).parking ?? null,
      agency:{name:advertiser.name, verified:advertiser.verified, rating:advertiser.rating, reviews:advertiser.reviews, replyMinutes:advertiser.domi, replyHours:advertiser.domi ? null : advertiser.replyHours},
    },
    market:{
      pricePerM2:facts.ppm2,
      comparablesCount:facts.comparables,
      comparablesMedianPerM2:facts.median,
      comparablesP10PerM2:facts.p10,
      comparablesP90PerM2:facts.p90,
      diffVsMedianPct:facts.delta == null ? null : Math.round(facts.delta * 100),
      ...(facts.ppm2 && facts.ppm2 > facts.p90 ? {aboveRange:true} : {}),
      ...(facts.ppm2 && facts.ppm2 < facts.p10 ? {belowRange:true} : {}),
      classification:CLASS[kind] || null,
      daysListed:facts.days,
      zoneMedianDaysToSell:ZONE_MEDIAN_DAYS,
      daysListedRatio:Number((facts.days / ZONE_MEDIAN_DAYS).toFixed(1)),
      priceHistory:facts.drop ? [{daysAgo:facts.dropDays, change:-facts.drop}] : [],
      ...(rank >= 0 ? {rankInSearchByPricePerM2:rank + 1} : {}),
      searchResultsCount:results.length,
    },
    photos:photoFacts(home),
    listingText:{extractedAttributes:text.attributes.map(item => item.id), inconsistencies:text.inconsistencies},
    neighborhood:{
      poisRanked:pois,
      nearestPark:park ? {name:park.name, minutes:park.minutes, mode:park.mode} : null,
    },
    fit:fitFacts(home, persona, metroMinutes),
    comparisonWithFavorites:resolved.filter(item => item.home.id !== home.id).map(({id, label, home:favorite}) => {
      const favoritePois = pointsOfInterest(favorite, persona);
      const entry = {
        favoriteId:id,
        favoriteLabel:label,
        favoriteListingId:favorite.id,
        priceDiffPct:pct(price, listingPrice(favorite)),
        m2DiffPct:home.size >= 20 && favorite.size >= 20 ? pct(home.size, favorite.size) : null,
        bedroomsDiff:home.beds != null && favorite.beds != null ? home.beds - favorite.beds : null,
        sameZone:favorite.area === home.area,
        metroMinutesThis:metroMinutes,
        metroMinutesFavorite:favoritePois.find(item => item.category === 'metro')?.minutes ?? null,
        officeMinutesThis:officeMinutes,
        officeMinutesFavorite:favoritePois.find(item => item.category === 'office')?.minutes ?? null,
      };
      return {...entry, similarity:similarity(entry)};
    }),
    favoritesUnresolved:unresolved,
  };
}
