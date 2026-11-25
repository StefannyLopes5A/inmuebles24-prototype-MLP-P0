import gold from './data/mora-gold.json' with {type:'json'};

const MORA_PERSONA = gold.userContext;

const KIND = {opportunity:'opportunity', fair:'fair', negotiable:'negotiate', above_market:'above', review_before_visit:'review'};

/**
 * A fixture was written for one person and in one language. It only replaces the reading when the active search is that
 * person's, so a fixture never speaks about zones or requests the visitor did not make.
 */
export function fixtureApplies(fixture, {search, hasSearch = true, language = 'es-MX'} = {}, persona = MORA_PERSONA) {
  if (!fixture?.output?.synthesis || !hasSearch) return false;
  if ((fixture.meta?.language || 'es-MX') !== language) return false;
  const areas = search?.areas || [];
  return persona.search.zones.every(zone => areas.includes(zone)) && (!search?.budget || search.budget === persona.search.maxPrice);
}

/** Only the price widget reads the fixture. The written summary is not used: it names metro and neighborhood facts Mora no longer answers. */
export function withFixture(analysis, fixture, options = {}) {
  if (!analysis || !fixtureApplies(fixture, options)) return analysis;
  const {output, factSheet:sheet} = fixture;
  const money = options.money || (amount => `$${amount.toLocaleString('es-MX')}`);
  const market = output.insights?.find(item => item.dimension === 'market');
  const ruler = output.marketRuler;
  const drop = sheet.market.priceHistory?.[0];
  const badge = ruler?.badge?.match(/^(\S+)\s+(.+)$/);
  const metric = drop
    ? {value:`Bajó ${money(Math.abs(drop.change))}`, unit:`hace ${drop.daysAgo} ${drop.daysAgo === 1 ? 'día' : 'días'}`}
    : badge ? {value:badge[1], unit:badge[2]} : null;
  const span = ruler ? ruler.p90 - ruler.p10 : 0;
  const modules = analysis.modules.map(module => {
    if (module.kind !== 'opportunity' || !ruler) return module;
    return {
      ...module,
      priceClass:KIND[sheet.market.classification] || module.priceClass,
      label:ruler.label || module.label,
      support:market?.text || module.support,
      metric:metric || module.metric,
      ruler:{
        ...module.ruler,
        p10:ruler.p10, p90:ruler.p90, median:ruler.median, value:ruler.value,
        position:span > 0 ? Math.min(1, Math.max(0, (ruler.value - ruler.p10) / span)) : 0.5,
        range:ruler.value < ruler.p10 ? 'below' : ruler.value > ruler.p90 ? 'above' : null,
      },
    };
  });
  return {...analysis, modules, fixture:fixture.meta?.listingId};
}
