import React from 'react';
import {Icon} from './App';
import {useLanguage} from './i18n';
import {RailHeading, useRailScroll} from './DiscoveryRail.jsx';

/**
 * Average price per city for the "Precio medio" rail (Figma reference).
 * Demo values for the prototype, not catalog statistics. Only CDMX maps to catalog areas, so only it is searchable.
 */
export const CITY_PRICE_CARDS = [
  {id: 'cdmx', label: 'Ciudad de México', count: 6, averagePrice: 15_000_000, area: 'Roma Norte'},
  {id: 'gdl', label: 'Guadalajara', count: 3, averagePrice: 15_000_000},
  {id: 'mty', label: 'Monterrey', count: 3, averagePrice: 14_600_000},
  {id: 'pue', label: 'Puebla', count: 2, averagePrice: 7_800_000},
  {id: 'mid', label: 'Mérida', count: 2, averagePrice: 13_200_000},
  {id: 'qro', label: 'Querétaro', count: 4, averagePrice: 9_400_000},
];

const TITLE = 'Precio medio de los inmuebles en las principales ciudades de México';
const COUNT_COPY = '{count} departamentos para comprar';

const countLabel = (count, language) => new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX').format(count);

export function NeighborhoodRail({onSelect}) {
  const {t, language, money} = useLanguage();
  const {rail, position, measure, move} = useRailScroll();
  const title = t(TITLE);

  return <section className="discovery-section neighborhood-section compact-rail" aria-labelledby="neighborhood-title">
    <RailHeading
      titleId="neighborhood-title"
      title={title}
      prevLabel={t('Anterior: ') + title}
      nextLabel={t('Siguiente: ') + title}
      position={position}
      onMove={move}
      nextDisabled={CITY_PRICE_CARDS.length < 2}/>
    <div className="discovery-rail neighborhood-rail" ref={rail} onScroll={measure}>
      {CITY_PRICE_CARDS.map(city => <article className="neighborhood-item" key={city.id}>
        <button
          type="button"
          className="neighborhood-card"
          aria-disabled={city.area ? undefined : true}
          onClick={() => city.area && onSelect?.(city.area, 'buy')}>
          <span className="neighborhood-card-top">
            <span className="neighborhood-card-heading">
              <b>{t(city.label)}</b>
              <Icon name="arrow" size={16}/>
            </span>
            <span className="neighborhood-card-count">{t(COUNT_COPY, {count: countLabel(city.count, language)})}</span>
          </span>
          <span className="neighborhood-card-price">
            <span>{t('Valor promedio')}</span>
            <strong>{money(city.averagePrice)}</strong>
          </span>
        </button>
      </article>)}
    </div>
  </section>;
}
