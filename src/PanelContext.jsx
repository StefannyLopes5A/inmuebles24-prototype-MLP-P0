import React, {lazy, Suspense, useMemo} from 'react';
import {listingPrice} from './data';
import {marketFacts} from './moraAnalysis';
import {offerIdeas} from './offerIdeas';
import {purchaseCosts} from './purchaseCosts';
import {priceHistory} from './priceHistory';
import {listingNeighborhood} from './listingStory';
import {homeCoordinates} from './mapLocations';

const ListingMap = lazy(() => import('./ListingMap'));

/** The questions a listing-page pill can open the panel with, and what each one gets next to the answer instead of the photos. */
export const CONTEXT_SECTIONS = ['price', 'offer', 'costs', 'history', 'description'];

/** True when the listing has the numbers the section's picture needs; otherwise the panel keeps its photos. */
export function hasContext(section, home) {
  if (!CONTEXT_SECTIONS.includes(section) || !home || home.development) return false;
  if (section === 'description') return !!homeCoordinates(home);
  if (home.mode !== 'buy') return false;
  if (section === 'price') return marketFacts(home).ppm2 != null;
  return true;
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const signed = (share, locale) => `${share >= 0 ? '+' : '−'}${Math.abs(share * 100).toLocaleString(locale, {maximumFractionDigits:1})}%`;

function PriceContext({home, copy}) {
  const {say, money, language} = copy;
  const facts = marketFacts(home);
  const span = facts.p90 - facts.p10;
  const at = value => `${clamp((value - facts.p10) / span, 0, 1) * 100}%`;
  const locale = language === 'pt-BR' ? 'pt-BR' : 'es-MX';
  return <div className="lp-ctx-body">
    <p className="lp-ctx-eyebrow">{say(`Preço do m² em ${home.area}`, `Precio del m² en ${home.area}`)}</p>
    <p className="lp-ctx-big">{money(facts.ppm2)} <small>MXN/m²</small></p>
    <p className="lp-ctx-sub">{say(`${signed(facts.delta, locale)} frente à mediana de ${facts.comparables} parecidos`, `${signed(facts.delta, locale)} frente a la mediana de ${facts.comparables} parecidos`)}</p>
    <div className="lp-ctx-ruler" role="img" aria-label={say(`Faixa de preços do m² dos parecidos, de ${money(facts.p10)} a ${money(facts.p90)}; este anúncio em ${money(facts.ppm2)}`, `Rango de precios del m² de los parecidos, de ${money(facts.p10)} a ${money(facts.p90)}; este anuncio en ${money(facts.ppm2)}`)}>
      <span className="lp-ctx-track"/>
      <span className="lp-ctx-tick" style={{left:at(facts.median)}}><i>{say('Mediana', 'Mediana')}</i></span>
      <span className="lp-ctx-pin" style={{left:at(facts.ppm2)}}><i>{say('Este anúncio', 'Este anuncio')}</i></span>
    </div>
    <div className="lp-ctx-scale"><span>{money(facts.p10)}</span><span>{money(facts.median)}</span><span>{money(facts.p90)}</span></div>
  </div>;
}

function OfferContext({home, copy}) {
  const {say, money} = copy;
  const ideas = offerIdeas(home);
  const names = {strong:say('Forte', 'Fuerte'), competitive:say('Competitiva', 'Competitiva'), moderate:say('Moderada', 'Moderada'), weak:say('Fraca', 'Débil')};
  const range = item => item.to == null ? `${money(item.from)}+` : item.from == null ? `< ${money(item.to)}` : `${money(item.from)} – ${money(item.to)}`;
  return <div className="lp-ctx-body">
    <p className="lp-ctx-eyebrow">{say('Chance de fechar por oferta', 'Probabilidad de cerrar por oferta')}</p>
    <ul className="lp-ctx-bars">
      {ideas.levels.map(item => <li key={item.id}>
        <span className="lp-ctx-bar-head"><b>{names[item.id]}</b><em>{item.chance}%</em></span>
        <span className="lp-ctx-bar"><span style={{width:`${item.chance}%`}}/></span>
        <span className="lp-ctx-bar-note">{range(item)}</span>
      </li>)}
    </ul>
  </div>;
}

function CostsContext({home, copy}) {
  const {say, money, currency} = copy;
  const costs = purchaseCosts({offer:listingPrice(home)});
  const parts = [
    [say('Entrada', 'Enganche'), costs.enganche, 'down'],
    [say('Imposto de aquisição', 'Impuesto de adquisición'), costs.isai, 'tax'],
    [say('Cartório e avaliação', 'Notaría y avalúo'), costs.closing, 'notary'],
  ];
  return <div className="lp-ctx-body">
    <p className="lp-ctx-eyebrow">{say('Para assinar', 'Para firmar')}</p>
    <p className="lp-ctx-big">{money(costs.upfront)} <small>{currency}</small></p>
    <div className="lp-ctx-stack" role="img" aria-label={parts.map(([name, amount]) => `${name} ${money(amount)}`).join(', ')}>
      {parts.map(([name, amount, key]) => <span key={key} className={`is-${key}`} style={{flexGrow:amount}}/>)}
    </div>
    <ul className="lp-ctx-legend">
      {parts.map(([name, amount, key]) => <li key={key}><i className={`is-${key}`}/><span>{name}</span><b>{money(amount)}</b></li>)}
    </ul>
    <p className="lp-ctx-sub">{say(`Depois, ${money(costs.monthly)} por mês em 20 anos a 11% fixa`, `Luego, ${money(costs.monthly)} al mes a 20 años y 11% fija`)}</p>
  </div>;
}

function HistoryContext({home, copy}) {
  const {say, money, language} = copy;
  const history = useMemo(() => priceHistory(home, listingNeighborhood(home)(language)), [home, language]);
  if (!history) return null;
  const region = history.months.map(month => month.value), own = history.listing.map(item => item?.value ?? null);
  const all = [...region, ...own.filter(value => value != null)];
  const min = Math.min(...all), max = Math.max(...all);
  const x = index => index / (region.length - 1) * 100;
  const y = value => max === min ? 50 : 92 - (value - min) / (max - min) * 84;
  const path = series => series.map((value, index) => value == null ? '' : `${index && series[index - 1] != null ? 'L' : 'M'}${x(index).toFixed(2)} ${y(value).toFixed(2)}`).join('');
  const last = region.length - 1;
  return <div className="lp-ctx-body">
    <p className="lp-ctx-eyebrow">{say('Preço do m², mês a mês', 'Precio del m², mes a mes')}</p>
    <div className="lp-ctx-chart" role="img" aria-label={say(`Este anúncio em ${money(own[last])} por m² e média em ${history.area} em ${money(region[last])}`, `Este anuncio en ${money(own[last])} por m² y promedio en ${history.area} en ${money(region[last])}`)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={path(region)} className="is-region" vectorEffect="non-scaling-stroke"/>
        <path d={path(own)} className="is-own" vectorEffect="non-scaling-stroke"/>
      </svg>
      <span className="lp-ctx-dot is-region" style={{left:`${x(last)}%`, top:`${y(region[last])}%`}}/>
      {own[last] != null && <span className="lp-ctx-dot is-own" style={{left:`${x(last)}%`, top:`${y(own[last])}%`}}/>}
    </div>
    <ul className="lp-ctx-legend is-inline">
      <li><i className="is-own"/><span>{say('Este anúncio', 'Este anuncio')}</span><b>{money(own[last])}</b></li>
      <li><i className="is-region"/><span>{say(`Média em ${history.area}`, `Promedio en ${history.area}`)}</span><b>{money(region[last])}</b></li>
    </ul>
  </div>;
}

function MapContext({home, copy}) {
  const center = homeCoordinates(home);
  return <div className="lp-ctx-map">
    <Suspense fallback={<div className="pp-map is-loading" aria-hidden="true"/>}>
      <ListingMap center={center} language={copy.language} say={copy.say}/>
    </Suspense>
  </div>;
}

/** The left side of the panel when a listing-page pill opened it: a picture of what the question is about. */
export function PanelContext({section, home, copy}) {
  const View = {price:PriceContext, offer:OfferContext, costs:CostsContext, history:HistoryContext, description:MapContext}[section];
  return <div className={`lp-ctx lp-ctx-${section}`}>
    <View home={home} copy={copy}/>
  </div>;
}
