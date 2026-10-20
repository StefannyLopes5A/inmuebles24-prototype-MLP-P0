/**
 * What the person told Mora about their moment (moving soon or exploring, credit or cash) and which listings got a
 * visit intention in this session. It only feeds the simulated lead line; nothing is approved, scheduled or sent.
 */
export const SEEKER_KEY = 'inmuebles24-v2-seeker';
export const MOVE_MOMENTS = ['asap', 'months', 'exploring'];
export const CREDIT_STATES = ['credit', 'cash', 'open'];
/** A visit intention's broad window. Day and time only exist if the person typed them. */
export const VISIT_MOMENTS = ['asap', 'week', 'weekend', 'open'];

const storage = () => {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
};

export function normalizeSeeker(raw) {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    move:MOVE_MOMENTS.includes(value.move) ? value.move : null,
    credit:CREDIT_STATES.includes(value.credit) ? value.credit : null,
    asked:value.asked === true,
    visits:Array.isArray(value.visits) ? [...new Set(value.visits.filter(id => typeof id === 'string' && id.length <= 80))].slice(0, 40) : [],
  };
}

export function readSeeker(store = storage()) {
  try { return normalizeSeeker(JSON.parse(store?.getItem(SEEKER_KEY) || 'null')); } catch { return normalizeSeeker(null); }
}

export function writeSeeker(patch, store = storage()) {
  const next = normalizeSeeker({...readSeeker(store), ...patch});
  try { store?.setItem(SEEKER_KEY, JSON.stringify(next)); } catch { /* The lead line still works for this render. */ }
  return next;
}

export const markVisit = (homeId, store = storage()) => writeSeeker({visits:[...readSeeker(store).visits, homeId]}, store);

export function visitMomentLabel(moment, language = 'es-MX') {
  const pt = language === 'pt-BR';
  return {
    asap:pt ? 'O quanto antes' : 'Lo antes posible',
    week:pt ? 'Esta semana' : 'Esta semana',
    weekend:pt ? 'No fim de semana' : 'El fin de semana',
    open:pt ? 'Sem pressa' : 'Sin prisa',
  }[moment] || null;
}

/**
 * The line the agency would read with a visit intention, e.g. "Compra en Narvarte Poniente, se mudaría en los próximos
 * meses, crédito aún abierto. Ya señaló visita en 2 anuncios." Visits on `homeId` itself don't count.
 */
export function leadLine({search, seeker, homeId, language = 'es-MX'} = {}) {
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const state = normalizeSeeker(seeker);
  const parts = [];
  const areas = Array.isArray(search?.areas) ? search.areas : [];
  const where = areas.length === 1 ? say(` em ${areas[0]}`, ` en ${areas[0]}`) : areas.length > 1 ? say(` em ${areas[0]} e mais ${areas.length - 1}`, ` en ${areas[0]} y ${areas.length - 1} más`) : '';
  if (search?.mode) parts.push(search.mode === 'rent' ? say(`Aluguel${where}`, `Renta${where}`) : say(`Compra${where}`, `Compra${where}`));
  if (state.move) parts.push({
    asap:say('se mudaria o quanto antes', 'se mudaría lo antes posible'),
    months:say('se mudaria nos próximos meses', 'se mudaría en los próximos meses'),
    exploring:say('ainda está explorando', 'todavía está explorando'),
  }[state.move]);
  if (state.credit && search?.mode !== 'rent') parts.push({
    credit:say('já tem financiamento', 'ya tiene crédito'),
    cash:say('compra à vista', 'compra de contado'),
    open:say('financiamento ainda em aberto', 'crédito aún abierto'),
  }[state.credit]);
  const sentence = parts.length ? `${parts.join(', ')}.` : '';
  const others = state.visits.filter(id => id !== homeId).length;
  const visits = others === 1 ? say('Já sinalizou visita em 1 anúncio.', 'Ya señaló visita en 1 anuncio.')
    : others > 1 ? say(`Já sinalizou visita em ${others} anúncios.`, `Ya señaló visita en ${others} anuncios.`) : '';
  return [sentence.charAt(0).toUpperCase() + sentence.slice(1), visits].filter(Boolean).join(' ');
}
