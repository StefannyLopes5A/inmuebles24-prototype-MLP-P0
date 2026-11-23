import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {useLanguage, DEMO_MXN_PER_USD} from './i18n';
import {normalizeSearch} from './journey';
import {parseBudgetAmount, priceDistribution} from './homeSearchModel.js';
import {PriceHistogram} from './PriceHistogram';
import {BUDGET_BAR_HEIGHTS} from './HomeSearch.jsx';
import {countInRange, insightListings, insightMode, nearbyAreaPrices} from './priceInsights.js';

const asset = name => `/assets/price-insights/${name}`;

/** Spanish and Portuguese nouns for the searched property type; houses are feminine for "ninguna/nenhuma". */
function propertyNoun(search, pt) {
  const house = ['house', 'condominium'].includes(search.propertyType);
  if (house) return {one:'casa', many:'casas', feminine:true};
  return pt ? {one:'apartamento', many:'apartamentos'} : {one:'departamento', many:'departamentos'};
}

function placeLabel(areas, say) {
  if (!areas.length) return say('Cidade do México', 'Ciudad de México');
  return areas.length === 1 ? areas[0] : `${areas[0]} +${areas.length - 1}`;
}

/** Results section from Figma 12899:44837: a price range explorer and median prices of nearby colonias. */
export function PriceInsights({search, onChange}) {
  const {language, money, currency} = useLanguage();
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const current = normalizeSearch(search);
  const mode = insightMode(search);
  const areasKey = current.areas.join('|');
  const listings = useMemo(() => insightListings(search), [mode, areasKey]);
  const {bins} = useMemo(() => priceDistribution(listings, mode, BUDGET_BAR_HEIGHTS.length), [listings, mode]);
  const [range, setRange] = useState({min:current.minBudget || 0, max:current.budget});
  useEffect(() => setRange({min:current.minBudget || 0, max:current.budget}), [current.minBudget, current.budget, mode, areasKey]);

  const factor = currency === 'USD' ? DEMO_MXN_PER_USD : 1;
  const [draft, setDraft] = useState({min:'', max:''});
  const [error, setError] = useState('');
  useEffect(() => setDraft({min:range.min ? money(range.min) : '', max:money(range.max)}), [range.min, range.max, factor]);
  function commit(which) {
    const amount = parseBudgetAmount(draft[which], factor);
    if (!Number.isFinite(amount)) {setError(say('Digite um preço válido.', 'Escribe un precio válido.'));return;}
    const next = {...range, [which]:amount};
    if (next.max <= 0 || next.min > next.max || next.max > 1e9) {setError(say('O mínimo precisa ser menor ou igual ao máximo.', 'El mínimo debe ser menor o igual al máximo.'));return;}
    setError(''); setRange(next);
  }

  const [metric, setMetric] = useState('total');
  const rows = useMemo(() => nearbyAreaPrices(search, {metric}), [mode, areasKey, metric]);
  const top = Math.max(1, ...rows.map(row => row.value));

  const list = useRef(null), [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = list.current;
    if (!el || revealed) return;
    if (typeof IntersectionObserver === 'undefined') {setRevealed(true);return;}
    const observer = new IntersectionObserver(entries => {if (entries.some(entry => entry.isIntersecting)) setRevealed(true);}, {threshold:0.3});
    observer.observe(el);
    return () => observer.disconnect();
  }, [revealed]);

  const titleId = useId(), nearbyId = useId(), errorId = useId();
  const noun = propertyNoun(current, pt);
  const place = placeLabel(current.areas, say);
  const count = countInRange(listings, range.min, range.max);
  const operation = mode === 'rent' ? say('para alugar', 'en renta') : say('à venda', 'en venta');
  const formatValue = value => metric === 'm2' ? `${money(value)}/m²` : money(value);
  function applySearch(changes) {
    onChange({...search, ...changes});
    window.scrollTo({top:0, behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'});
  }

  const digits = value => money(value).replace(/^[^\d]+/, '');
  const shown = value => <span className="price-insights-amount"><em>{digits(value)}</em> {currency}</span>;
  const many = count !== 1;
  const lead = count === 0
    ? `${noun.feminine ? say('Nenhuma', 'Ninguna') : say('Nenhum', 'Ningún')} ${noun.one}`
    : <>{many && <>{say('Mais de', 'Más de')} </>}<em>{new Intl.NumberFormat(language).format(count)}</em> {many ? noun.many : noun.one}</>;
  const bounds = range.min
    ? <>entre {shown(range.min)} {say('e', 'y')} {shown(range.max)}</>
    : <>{say('até', 'hasta')} {shown(range.max)}</>;
  const summary = <>{lead} {bounds} {say('em', 'en')} {place}</>;
  const actionNoun = noun.many.charAt(0).toUpperCase() + noun.many.slice(1);
  const action = `${actionNoun} ${operation} ${say('até', 'hasta')} ${digits(range.max)}\u00A0${currency} ${say('em', 'en')} ${place}`;

  return <section className="price-insights" tabIndex={-1} aria-label={say('Preços da sua busca', 'Precios de tu búsqueda')}><div className="price-insights-layout">
    <article className="price-insights-range" aria-labelledby={titleId}>
      <header className="price-insights-lead">
        <h2 id={titleId} className="price-insights-summary" aria-live="polite">{summary}</h2>
        <p>{say('Ajuste o gráfico para ver outras faixas de preço', 'Ajusta el gráfico para ver otros rangos de precios')}</p>
      </header>
      <div className="price-insights-chart">
        {bins.length > 0 && <PriceHistogram bins={bins} heights={BUDGET_BAR_HEIGHTS} min={range.min} max={range.max} money={money} say={say}
          onChange={({minBudget, budget}) => {setError('');setRange({min:minBudget, max:budget});}}/>}
        <div className="price-insights-fields">
          {['min', 'max'].map(which => <label key={which}>
            <span>{which === 'min' ? say('Mínimo', 'Mínimo') : say('Máximo', 'Máximo')}</span>
            <input inputMode="numeric" aria-label={`${which === 'min' ? say('Mínimo', 'Mínimo') : say('Máximo', 'Máximo')} (${currency})`} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} placeholder="—" value={draft[which]}
              onChange={event => {setDraft({...draft, [which]:event.target.value});setError('');}} onBlur={() => commit(which)} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault();commit(which);}}}/>
          </label>)}
        </div>
        {error && <p className="price-insights-error" id={errorId} role="alert">{error}</p>}
      </div>
      <button type="button" className="price-insights-apply" onClick={() => applySearch({minBudget:range.min, budget:range.max})}>
        <span>{action}</span>
        <img src={asset('arrow-forward.svg')} width="16" height="16" alt=""/>
      </button>
    </article>
    <article className="price-insights-nearby" aria-labelledby={nearbyId}>
      <header className="price-insights-nearby-top">
        <h2 id={nearbyId}>{current.areas.length ? say('Preços médios em bairros próximos', 'Precios medios en barrios cercanos') : say('Preços médios por bairro', 'Precios medios por barrio')}</h2>
        <button type="button" className="btn-secondary price-insights-metric" aria-label={metric === 'total' ? say('Mostrando preço total. Mudar para preço por m²', 'Mostrando precio total. Cambiar a precio por m²') : say('Mostrando preço por m². Mudar para preço total', 'Mostrando precio por m². Cambiar a precio total')} onClick={() => setMetric(value => value === 'total' ? 'm2' : 'total')}>
          <img src={asset('sort.svg')} width="16" height="16" alt=""/>
          <span>{metric === 'total' ? say('Preço por /m²', 'Precio por /m²') : say('Preço total', 'Precio total')}</span>
        </button>
      </header>
      <ul ref={list} className="price-insights-areas" data-revealed={revealed || undefined}>
        {rows.map(row => <li key={row.area} className="price-insights-area" style={{'--fill':row.value / top}}>
          {row.current
            ? <span className="price-insights-area-name" aria-current="true">{row.area}</span>
            : <button type="button" className="price-insights-area-name" aria-label={say(`Buscar em ${row.area}`, `Buscar en ${row.area}`)} onClick={() => applySearch({area:row.area, areas:[row.area], address:''})}>{row.area}</button>}
          <span className="price-insights-bar" aria-hidden="true"><span/></span>
          <span className="price-insights-area-price">{formatValue(row.value)}</span>
        </li>)}
      </ul>
    </article>
  </div></section>;
}
