import React from 'react';
import {fairPriceScore} from './fairPrice.js';

const BAND = {
  review:['Muito abaixo do mercado', 'Muy por debajo del mercado'],
  below:['Abaixo do mercado', 'Por debajo del mercado'],
  fair:['Preço justo', 'Precio justo'],
  above:['Acima do mercado', 'Por encima del mercado'],
};

/** The score behind the price pill: a rule from "por debajo" to "por encima" with a marker where this listing sits. */
export function FairPriceScore({home, money, currency, say}) {
  const fair = fairPriceScore(home);
  if (!fair) return null;
  const pt = say('pt', 'es') === 'pt';
  const label = BAND[fair.band][pt ? 0 : 1];
  const side = fair.delta >= 0 ? say('acima', 'arriba') : say('abaixo', 'abajo');
  const detail = fair.band === 'fair'
    ? say(`O m² está em linha com ${fair.comparables} parecidos em ${fair.area}.`, `El m² está en línea con ${fair.comparables} parecidos en ${fair.area}.`)
    : say(`O m² está ${fair.pct}% ${side} da mediana de ${fair.comparables} parecidos em ${fair.area}.`, `El m² está ${fair.pct}% ${side} de la mediana de ${fair.comparables} parecidos en ${fair.area}.`);
  const unit = value => `${money(value)} ${currency}/m²`;
  const summary = say(`Pontuação de preço justo ${fair.score} de 100: ${label}. ${detail}`, `Puntaje de precio justo ${fair.score} de 100: ${label}. ${detail}`);
  return <div className="pp-fair" data-band={fair.band}>
    <div className="pp-fair-head">
      <strong className="pp-fair-score">{fair.score}<small>/100</small></strong>
      <div className="pp-fair-copy"><b>{label}</b><span>{detail}</span></div>
    </div>
    <div className="pp-fair-rule" role="img" aria-label={summary}>
      <div className="pp-fair-track" aria-hidden="true"><i/><i/><i/></div>
      <span className="pp-fair-marker" style={{'--x':`${fair.position}%`}} aria-hidden="true"><em>{unit(fair.ppm2)}</em></span>
      <span className="pp-fair-median" aria-hidden="true"/>
    </div>
    <div className="pp-fair-scale" aria-hidden="true">
      <span>{say('Abaixo', 'Por debajo')}</span>
      <span>{say('Mediana', 'Mediana')} {unit(fair.median)}</span>
      <span>{say('Acima', 'Por encima')}</span>
    </div>
    <p className="pp-fair-note">{say('100 = em linha com a mediana dos parecidos; cai conforme o m² se afasta dela. Referência ilustrativa.', '100 = en línea con la mediana de parecidos; baja conforme el m² se aleja de ella. Referencia ilustrativa.')}</p>
  </div>;
}
