import React, {useId, useMemo, useState} from 'react';
import {useLanguage} from './i18n';
import {normalizeSearch} from './journey';
import {poiLabel} from './pois.js';
import {PLACE_CATEGORIES, placesNear} from './nearbyPlaces.js';

const asset = name => `/assets/nearby-places/${name}`;
const KIND = {
  metro: {es: 'Metro', pt: 'Metrô'},
  escola: {es: 'Escuela', pt: 'Escola'},
  supermercado: {es: 'Súper', pt: 'Mercado'},
  comercio: {es: 'Comercio', pt: 'Comércio'},
  parque: {es: 'Parque', pt: 'Parque'},
  hospital: {es: 'Hospital', pt: 'Hospital'},
  cafe: {es: 'Café', pt: 'Café'},
  bar_restaurante: {es: 'Restaurante', pt: 'Restaurante'},
};
const ICON = {bar_restaurante: 'restaurant'};

/** Results section from Figma 12883:42934: catalog points of interest around the searched colonia, filtered by category. */
export function NearbyPlaces({search, onMap, onCostOfLiving}) {
  const {language} = useLanguage();
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const current = normalizeSearch(search);
  const key = JSON.stringify([current.mode, current.areas]);
  const [active, setActive] = useState(() => new Set(PLACE_CATEGORIES));
  const activeKey = [...active].sort().join();
  const all = useMemo(() => placesNear(search), [key]);
  const places = useMemo(() => placesNear(search, {categories:[...active]}), [key, activeKey]);
  const id = useId();
  if (!all?.items.length) return null;

  const {area} = all;
  const shown = PLACE_CATEGORIES.filter(category => all.counts[category] > 0);
  const toggle = category => setActive(previous => {
    const next = new Set(previous);
    if (next.has(category)) next.delete(category); else next.add(category);
    return next;
  });

  return <section className="nearby-places" aria-labelledby={`${id}-title`}>
    <div className="nearby-places-head">
      <div className="nearby-places-heading">
        <h2 id={`${id}-title`}>{say(`Pontos de interesse perto de ${area}`, `Puntos de interés cerca de ${area}`)}</h2>
        <p>{say(`Tempos aproximados a pé e de carro desde o centro de ${area}`, `Tiempos aproximados a pie y en auto desde el centro de ${area}`)}</p>
      </div>
      <button type="button" className="nearby-places-cta" onClick={onCostOfLiving}>
        {say('Explorar custo de vida na região', 'Explorar costo de vida en la zona')}
        <img src="/assets/price-insights/arrow-forward.svg" width="16" height="16" alt=""/>
      </button>
    </div>
    <div className="nearby-places-filters" role="group" aria-label={say('Tipos de lugar', 'Tipos de lugar')}>
      {shown.map(category => <button key={category} type="button" className="nearby-places-chip" aria-pressed={active.has(category)} onClick={() => toggle(category)}>
        <img src={asset('check.svg')} width="16" height="16" alt=""/>
        {poiLabel(category, language)}
      </button>)}
    </div>
    {places.items.length
      ? <ul className="nearby-places-list">
        {places.items.map(place => <li key={place.id} className="nearby-place">
          <img className="nearby-place-icon" src={asset(`${ICON[place.categoria] || place.categoria}.svg`)} width="20" height="20" alt=""/>
          <div className="nearby-place-text">
            <button type="button" className="nearby-place-name" title={place.name} onClick={onMap}
              aria-label={say(`${place.name}, ver no mapa`, `${place.name}, ver en el mapa`)}>{place.name}</button>
            <span className="nearby-place-kind">{KIND[place.categoria][pt ? 'pt' : 'es']}</span>
          </div>
          <p className="nearby-place-times">
            <span><img src={asset('walking.svg')} width="16" height="16" alt=""/>{place.walk} min<span className="sr-only">{say(' a pé', ' a pie')}</span></span>
            <span><img src={asset('car.svg')} width="16" height="16" alt=""/>{place.drive} min<span className="sr-only">{say(' de carro', ' en auto')}</span></span>
          </p>
        </li>)}
      </ul>
      : <p className="nearby-places-empty">{say('Escolha um tipo de lugar para ver o que há por perto.', 'Elige un tipo de lugar para ver qué hay cerca.')}</p>}
  </section>;
}
