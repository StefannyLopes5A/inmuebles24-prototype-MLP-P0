import {marketFacts, searchFit} from './moraAnalysis.js';
import {seed} from './listingAdvertiser.js';
import {listingText} from './listingText.js';
import {photoReading} from './moraInsights.js';

export const LISTING_TAG_LIMIT = 2;
const NEW_LISTING_DAYS = 14;

export function agencyTopService(rating) {
  return rating >= 4.7;
}

export function agencyServiceTooltip(say) {
  return say(
    'Esta imobiliária tem um serviço com nota 4,7 ou mais.',
    'Esta inmobiliaria tiene un servicio con calificación de 4,7 o más.',
  );
}

function styleTagForNewListing(home, say) {
  const reading = photoReading(home);
  const attrs = listingText(home).attributes;
  if (reading?.condition === 'remodelado' || attrs.some(item => item.id === 'remodeled')) {
    return say('Recém-reformado', 'Recién remodelado');
  }
  if (attrs.some(item => item.id === 'loft' || item.id === 'penthouse')) {
    return say('Moderno', 'Moderno');
  }
  const variant = seed(`style|${home.id}`) % 3;
  if (variant === 0) return say('Reformado', 'Remodelado');
  if (variant === 1) return say('Moderno', 'Moderno');
  return null;
}

function isPerfectMatch(home, search, pref, language) {
  if (!search) return false;
  const fit = searchFit(home, search, pref, {language});
  if (!fit?.criteria?.length) return false;
  const decided = fit.criteria.filter(item => item.status !== 'unknown');
  return decided.length > 0 && decided.every(item => item.status === 'met');
}

/** Up to two tags for discovery cards and photo chrome; contacted reserves one slot when shown separately. */
export function listingCardTags(home, {search, pref = 'none', language = 'es-MX', contacted = false, max = LISTING_TAG_LIMIT} = {}) {
  const say = (br, es) => (language === 'pt-BR' ? br : es);
  const limit = Math.max(0, contacted ? max - 1 : max);
  const candidates = [];

  if (isPerfectMatch(home, search, pref, language)) {
    candidates.push({id:'match', priority:100, label:say('Match perfeito', 'Match perfecto')});
  }

  const market = marketFacts(home);
  if (market.drop) {
    candidates.push({id:'drop', priority:90, label:say('Baixou de preço', 'Bajó de precio')});
  }

  const isNew = market.days <= NEW_LISTING_DAYS;
  if (isNew) {
    const style = styleTagForNewListing(home, say);
    if (style) candidates.push({id:'style', priority:78, label:style});
    candidates.push({id:'new', priority:72, label:say('Anúncio novo', 'Anuncio nuevo')});
  }

  if (home.video && !home.development) {
    candidates.push({id:'tour', priority:50, label:say('Tour virtual', 'Tour virtual')});
  }

  const ranked = candidates.sort((a, b) => b.priority - a.priority);
  // A development's 3D tour always takes the first slot; the second follows the usual order.
  if (home.development) return [{id:'tour3d', label:'Tour 3D', shimmer:true}, ...ranked].slice(0, Math.max(1, limit));
  return ranked.slice(0, limit);
}
