import React, {useLayoutEffect, useRef, useState} from 'react';
import {playCards} from './homeMotion.js';
import {useLanguage} from './i18n.jsx';
import {CITY_EXPLORE_LINKS, POPULAR_HOME_CITIES, cityLinkBudget, cityLinkImage} from './popularHomeCities.js';
import {RailHeading} from './DiscoveryRail.jsx';

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
  const tabs = useRef(null), list = useRef(null), first = useRef(true);
  const [cityId, setCityId] = useState(POPULAR_HOME_CITIES[0].id);
  const current = POPULAR_HOME_CITIES.find(city => city.id === cityId) || POPULAR_HOME_CITIES[0];
  const title = t(TITLE);
  const at = POPULAR_HOME_CITIES.indexOf(current);

  // A new tab brings its links in with the same entrance as the house cards; the first render keeps the section's own reveal.
  useLayoutEffect(() => {
    if (first.current) {first.current = false; return;}
    playCards(list.current?.children);
  }, [cityId]);

  /** The arrows step through the city pills, like the internal links; the chosen pill scrolls into view on a narrow page. */
  function step(direction) {
    const next = POPULAR_HOME_CITIES[Math.max(0, Math.min(POPULAR_HOME_CITIES.length - 1, at + direction))];
    setCityId(next.id);
    const pill = tabs.current?.children[POPULAR_HOME_CITIES.indexOf(next)];
    pill?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }

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
      position={{start: at <= 0, end: at >= POPULAR_HOME_CITIES.length - 1}}
      onMove={step}/>
    <div className="home-city-tabs" ref={tabs} role="group" aria-label={t('Ciudades')}>
      {POPULAR_HOME_CITIES.map(city => <button key={city.id} type="button" className="home-pill home-city-tab"
        aria-pressed={city.id === current.id} onClick={() => setCityId(city.id)}>{t(city.label)}</button>)}
    </div>
    <ul className="home-city-links" ref={list} key={current.id}>
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
