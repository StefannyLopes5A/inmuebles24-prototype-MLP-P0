import React, {useEffect, useRef, useState} from 'react';
import {NEIGHBORHOOD_CITIES, neighborhoodRecommendations} from './data';
import {OPERATIONS} from './homeSearchModel';
import {HomeChevron, HomePopover} from './HomeSearch.jsx';
import {Icon} from './App';
import {useLanguage} from './i18n';

const countLabel = (count, language) => new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX').format(count);

const COUNT_COPY = {
  buy: '{count} departamentos para comprar',
  rent: '{count} departamentos para rentar',
  development: '{count} departamentos en desarrollos',
  auction: '{count} departamentos en remate',
};

function modeBudget(mode) {
  return mode === 'rent' ? 28_000 : 7_500_000;
}

export function NeighborhoodRail({mode: modeProp = 'buy', onSelect, onModeChange}) {
  const {t, language, money} = useLanguage();
  const rail = useRef(null);
  const refs = useRef({});
  const [position, setPosition] = useState({start: true, end: false});
  const [open, setOpen] = useState(null);
  const [menuMotion, setMenuMotion] = useState(true);
  const [mode, setMode] = useState(['rent', 'buy', 'development', 'auction'].includes(modeProp) ? modeProp : 'buy');
  const [city, setCity] = useState('Ciudad de México');
  const items = neighborhoodRecommendations(mode, city);
  const locale = language === 'pt-BR' ? 1 : 2;
  const operationLabel = OPERATIONS.find(([key]) => key === mode)?.[locale] || OPERATIONS[1][locale];
  const cityLabel = city === 'Ciudad de México' ? t('Ciudad de México') : city;
  const title = `${t('Barrios recomendados para')} ${operationLabel.toLowerCase()} ${t('departamentos en')} ${cityLabel}`;
  const list = open === 'mode'
    ? OPERATIONS.map(([key, br, es]) => [key, language === 'pt-BR' ? br : es])
    : open === 'city'
      ? NEIGHBORHOOD_CITIES.map(name => [name, name === 'Ciudad de México' ? t('Ciudad de México') : name])
      : [];

  useEffect(() => {
    if (['rent', 'buy', 'development', 'auction'].includes(modeProp)) setMode(modeProp);
  }, [modeProp]);

  useEffect(() => {
    if (!rail.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(rail.current);
    measure();
    return () => observer.disconnect();
  }, [items.length, mode, city]);

  function move(direction) {
    const el = rail.current;
    el.scrollBy({
      left: direction * (el.clientWidth * 0.8),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  function measure() {
    const el = rail.current;
    if (el) setPosition({start: el.scrollLeft < 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2});
  }

  function activate(key, animate) {
    setMenuMotion(animate);
    setOpen(current => current === key ? null : key);
  }

  function close(restoreFocus = false, animate = true) {
    setMenuMotion(animate);
    const key = open;
    setOpen(null);
    if (restoreFocus) refs.current[key]?.focus({preventScroll: true});
  }

  function choose(key, value, animate) {
    if (key === 'mode') {
      setMode(value);
      onModeChange?.(value, modeBudget(value));
    } else {
      setCity(value);
    }
    close(true, animate);
  }

  if (!items.length) return null;

  return (
    <section className="discovery-section neighborhood-section compact-rail" aria-label={title}>
      <div className="discovery-heading">
        <div>
          <h2 className="neighborhood-title">
            <span>{t('Barrios recomendados para')}</span>{' '}
            <button
              type="button"
              ref={el => { refs.current.mode = el; }}
              className="home-word-control is-chosen"
              data-motion={menuMotion}
              aria-label={`${t('Operación')}: ${operationLabel}`}
              aria-haspopup="listbox"
              aria-expanded={open === 'mode'}
              onClick={event => activate('mode', event.detail > 0)}
              onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); activate('mode', false); } }}
            >
              <span className="home-choice-label">{operationLabel.toLowerCase()}</span>
              <HomeChevron />
            </button>{' '}
            <span>{t('departamentos en')}</span>{' '}
            <button
              type="button"
              ref={el => { refs.current.city = el; }}
              className="home-word-control is-chosen"
              data-motion={menuMotion}
              aria-label={`${t('Ciudad')}: ${cityLabel}`}
              aria-haspopup="listbox"
              aria-expanded={open === 'city'}
              onClick={event => activate('city', event.detail > 0)}
              onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); activate('city', false); } }}
            >
              <span className="home-choice-label">{cityLabel}</span>
              <HomeChevron />
            </button>
          </h2>
        </div>
        <div className="rail-controls">
          <button className="icon-button" aria-label={t('Anterior: ') + title} disabled={position.start} onClick={() => move(-1)}>
            <Icon name="back" />
          </button>
          <button className="icon-button" aria-label={t('Siguiente: ') + title} disabled={position.end || items.length < 2} onClick={() => move(1)}>
            <Icon name="arrow" />
          </button>
        </div>
      </div>
      <HomePopover
        open={!!open}
        animate={menuMotion}
        anchor={refs.current[open]}
        label={open === 'mode' ? t('Operación') : t('Ciudad')}
        kind="list"
        variant={open === 'mode' ? 'neighborhoodMode' : 'neighborhoodCity'}
        onClose={close}
      >
        {list.map(([key, label]) => (
          <button
            type="button"
            className="home-option"
            role="option"
            aria-selected={key === (open === 'mode' ? mode : city)}
            key={key}
            onClick={event => choose(open, key, event.detail > 0)}
          >
            {label}
          </button>
        ))}
      </HomePopover>
      <div className="discovery-rail neighborhood-rail" ref={rail} onScroll={measure}>
        {items.map(item => (
          <article className="neighborhood-item" key={`${city}:${mode}:${item.area}`}>
            <button
              type="button"
              className="neighborhood-card"
              onClick={() => item.searchable && onSelect?.(item.area, mode)}
              aria-label={t('Explorar barrios en ') + item.area}
            >
              <span className="neighborhood-card-top">
                <span className="neighborhood-card-heading">
                  <b>{item.area}</b>
                  <Icon name="arrow" size={16} />
                </span>
                <span className="neighborhood-card-count">
                  {t(COUNT_COPY[mode] || COUNT_COPY.buy, {count: countLabel(item.count, language)})}
                </span>
              </span>
              <span className="neighborhood-card-price">
                <span>{t('Valor promedio')}</span>
                <strong>{money(item.averagePrice)}</strong>
              </span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
