import React from 'react';
import {Icon} from './App.jsx';
import {useLanguage} from './i18n.jsx';
import {CITY_GUIDE} from './cityGuide.js';

const TITLE = 'Cómo es vivir en las principales ciudades y colonias';
const SUBTITLE = 'Explora los espacios más amplios de esta selección.';

export function HomeCityGuide({search, onSearch, onIntroDone, onChoose}) {
  const {t} = useLanguage();
  const title = t(TITLE);

  function open(city) {
    if (!city.sampleArea) return;
    onIntroDone?.();
    onChoose?.('template');
    onSearch?.({
      ...search,
      mode: search.mode === 'rent' ? 'rent' : 'buy',
      propertyType: 'apartment',
      criteria: [],
      minBudget: 0,
      budget: search.mode === 'rent' ? 28000 : 7500000,
      area: city.sampleArea,
      areas: [city.sampleArea],
      address: '',
      beds: 2,
      fromIdea: false,
    });
  }

  return <section className="discovery-section home-city-guide" aria-labelledby="home-city-guide-title">
    <div className="discovery-heading">
      <div>
        <h2 id="home-city-guide-title">{title}</h2>
        <p>{t(SUBTITLE)}</p>
      </div>
      <button type="button" className="home-blog-more">{t('Explorar todas las ciudades')}<Icon name="arrow" size={16}/></button>
    </div>
    <div className="home-city-guide-grid">
      {CITY_GUIDE.map(city => <article className="discovery-item" key={city.id}>
        <div className="discovery-card">
          <button type="button" className="discovery-open" aria-disabled={!city.sampleArea || undefined} onClick={() => open(city)} aria-label={t(city.label)}>
            <span className="discovery-media">
              <img src={city.image} alt="" style={{objectPosition: city.focus}} loading="lazy"/>
              <span className="discovery-copy"><strong>{t(city.label)}</strong></span>
            </span>
          </button>
        </div>
      </article>)}
    </div>
  </section>;
}
