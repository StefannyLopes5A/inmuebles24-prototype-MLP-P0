import React from 'react';
import {Icon} from './App.jsx';
import {useLanguage} from './i18n.jsx';

/** Editorial block from the logged-out home. Photos come from the Figma redesign; the prototype has no blog destination. */
const IMAGES = '/assets/home-evolution/blog/';
const FEATURE = {
  image: `${IMAGES}feature.jpg`,
  kicker: 'Blog',
  title: 'Todo lo que debes de saber antes de poner en renta un departament',
  date: 'Agosto, 2026',
};

const STORIES = [
  {id: 'taxes', image: `${IMAGES}taxes.jpg`, title: '¿Qué impuestos debo pagar al comprar o vender una casa?'},
  {id: 'guadalajara', image: `${IMAGES}guadalajara.jpg`, title: '¿Cuánto cuesta vivir en el centro de Guadalajara?'},
  {id: 'decor-desk', image: `${IMAGES}decor-desk.jpg`, title: 'Consejos para decorar con color negro tu casa'},
  // Three stories per column: wide screens add a second column (two columns of three); the Figma set has four stories, so two repeat.
  {id: 'decor-wall', image: `${IMAGES}decor-wall.jpg`, title: 'Consejos para decorar con color negro tu casa', wide: true},
  {id: 'taxes-2', image: `${IMAGES}taxes.jpg`, title: '¿Qué impuestos debo pagar al comprar o vender una casa?', wide: true},
  {id: 'guadalajara-2', image: `${IMAGES}guadalajara.jpg`, title: '¿Cuánto cuesta vivir en el centro de Guadalajara?', wide: true},
];

const META = 'Agosto de 2026 · 10min leitura';

export function HomeBlog() {
  const {t} = useLanguage();
  return <section className="home-blog" aria-labelledby="home-blog-title">
    <article className="home-blog-feature">
      <img src={FEATURE.image} alt="" loading="lazy"/>
      <div className="home-blog-feature-copy">
        <span>{t(FEATURE.kicker)}</span>
        <h3>{t(FEATURE.title)}</h3>
        <time>{t(FEATURE.date)}</time>
      </div>
    </article>
    <div className="home-blog-side">
      <div className="home-blog-head">
        <h2 id="home-blog-title">{t('Últimas noticias de real estate')}</h2>
        <button type="button" className="home-blog-more">{t('Explorar más noticias')}<Icon name="arrow" size={16}/></button>
      </div>
      <ul className="home-blog-list">
        {STORIES.map(story => <li key={story.id} className={story.wide ? 'is-wide-only' : undefined}>
          <article className="home-blog-item">
            <span className="home-blog-thumb"><img src={story.image} alt="" loading="lazy"/></span>
            <div>
              <h3>{t(story.title)}</h3>
              <p>{t(META)}</p>
            </div>
          </article>
        </li>)}
      </ul>
    </div>
  </section>;
}
