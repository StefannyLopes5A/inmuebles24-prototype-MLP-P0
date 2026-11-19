import React, {useState} from 'react';
import {useLanguage} from './i18n.jsx';
import {CITY_EXPLORE_LINKS, POPULAR_HOME_CITIES, cityLinkBudget, cityLinkImage} from './popularHomeCities.js';
import {RailHeading, useRailScroll} from './DiscoveryRail.jsx';

const TITLE = 'Propiedades en las ciudades populares';
const SUBTITLE = 'Diez lugares para empezar a imaginar tu vida en CDMX';

const LINK_LABELS = {
  'houses-buy': 'Casas en venta',
  'apartments-buy': 'Departamentos en venta',
  'houses-rent': 'Casas en renta',
  'apartments-rent': 'Departamentos en renta',
  'studios-rent': 'Estudios en renta',
  'family-buy': 'Departamentos de 3 recámaras en venta',
  'premium-buy': 'Penthouses y lofts en venta',
  'budget-rent': 'Departamentos económicos en renta',
};

export function HomePopularCities({search, onSearch, onIntroDone, onChoose}) {
  const {t} = useLanguage();
  const {rail, position, measure, move} = useRailScroll();
  const [cityId, setCityId] = useState(POPULAR_HOME_CITIES[0].id);
  const current = POPULAR_HOME_CITIES.find(city => city.id === cityId) || POPULAR_HOME_CITIES[0];
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
      budget: link.budget ?? cityLinkBudget(link.mode),
      area: city.sampleArea,
      areas: [city.sampleArea],
      address: '',
      beds: link.beds,
      fromIdea: false,
      note: t('{kind} {operation} en {city}', {kind, operation, city: city_}),
    });
  }

  return <section className="discovery-section home-popular-cities" aria-labelledby="home-cities-title">
    <RailHeading
      titleId="home-cities-title"
      title={title}
      subtitle={t(SUBTITLE)}
      prevLabel={t('Anterior: ') + title}
      nextLabel={t('Siguiente: ') + title}
      position={position}
      onMove={move}/>
    <div className="home-city-tabs" ref={rail} onScroll={measure} role="group" aria-label={t('Ciudades')}>
      {POPULAR_HOME_CITIES.map(city => <button key={city.id} type="button" className="home-pill home-city-tab"
        aria-pressed={city.id === current.id} onClick={() => setCityId(city.id)}>{t(city.label)}</button>)}
    </div>
    <ul className="home-city-links" key={current.id}>
      {CITY_EXPLORE_LINKS.map(link => {
        const name = t(current.label);
        return <li key={link.id}>
          <button type="button" className="home-city-link" onClick={() => run(current, link)}>
            <span className="home-city-media"><img src={cityLinkImage(current, link)} alt="" loading="lazy"/></span>
            <span className="home-city-copy"><strong>{t(LINK_LABELS[link.id])}</strong><span>{t('en {city}', {city: name})}</span></span>
          </button>
        </li>;
      })}
    </ul>
  </section>;
}
