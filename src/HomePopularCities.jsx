import React from 'react';
import {useLanguage} from './i18n.jsx';
import {CITY_EXPLORE_LINKS, POPULAR_HOME_CITIES, cityLinkBudget} from './popularHomeCities.js';
import {RailHeading, useRailScroll} from './DiscoveryRail.jsx';

const TITLE = 'Propiedades en las ciudades populares';
const SUBTITLE = 'Diez lugares para empezar a imaginar tu vida en CDMX';

const LINK_LABELS = {
  'houses-buy': 'Casas en venta en {city}',
  'apartments-buy': 'Departamentos en venta en {city}',
  'houses-rent': 'Casas en renta en {city}',
  'apartments-rent': 'Departamentos en renta en {city}',
  'studios-rent': 'Estudios en renta en {city}',
};

export function HomePopularCities({search, onSearch, onIntroDone, onChoose}) {
  const {t} = useLanguage();
  const {rail, position, measure, move} = useRailScroll();
  const title = t(TITLE);

  function run(city, link) {
    onIntroDone?.();
    onChoose?.('template');
    const city_ = t(city.label);
    const kind = t(link.propertyType === 'house' ? 'Casa' : 'Departamento');
    const operation = t(link.mode === 'rent' ? 'en renta' : 'en venta');
    onSearch({
      ...search,
      mode: link.mode,
      propertyType: link.propertyType,
      criteria: [],
      minBudget: 0,
      budget: cityLinkBudget(link.mode),
      area: city.sampleArea,
      areas: [city.sampleArea],
      address: '',
      beds: link.beds,
      fromIdea: false,
      note: t('{kind} {operation} en {city}', {kind, operation, city: city_}),
    });
  }

  const exploreLink = {mode: search.mode === 'rent' ? 'rent' : 'buy', propertyType: 'apartment', beds: 2};

  return <section className="discovery-section home-popular-cities" aria-labelledby="home-cities-title">
    <RailHeading
      titleId="home-cities-title"
      title={title}
      subtitle={t(SUBTITLE)}
      prevLabel={t('Anterior: ') + title}
      nextLabel={t('Siguiente: ') + title}
      position={position}
      onMove={move}/>
    <div className="discovery-rail" ref={rail} onScroll={measure}>
      {POPULAR_HOME_CITIES.map(city => {
        const name = t(city.label);
        return <article className="home-city" key={city.id}>
          <button type="button" className="home-city-card" onClick={() => run(city, exploreLink)}>
            <img src={city.image} alt="" loading="lazy"/>
            <span className="home-city-shade" aria-hidden="true"/>
            <span className="home-city-copy"><span>{t('Explora')}</span><strong>{name}</strong></span>
          </button>
          <h3>{t('Inmuebles en {city}', {city: name})}</h3>
          <p>{t('Explora opciones en {city}', {city: name})}</p>
          <ul className="home-pill-list">
            {CITY_EXPLORE_LINKS.map(link => <li key={link.id}>
              <button type="button" className="home-pill home-pill--compact" onClick={() => run(city, link)}>{t(LINK_LABELS[link.id], {city: name})}</button>
            </li>)}
          </ul>
        </article>;
      })}
    </div>
  </section>;
}
