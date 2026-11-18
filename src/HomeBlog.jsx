import React from 'react';
import {Icon} from './App.jsx';
import {useLanguage} from './i18n.jsx';

/** Editorial block from the logged-out home. Photos are catalog covers; the prototype has no lifestyle set and no blog destination. */
const FEATURE = {
  image: '/assets/listings/sets/148353811/01.jpg',
  kicker: 'Blog',
  title: 'Todo lo que debes de saber antes de poner en renta un departamento',
  date: 'Agosto, 2026',
};

const STORIES = [
  {id: 'taxes', image: '/assets/listings/sets/149919919/01.jpg', title: '¿Qué impuestos debo pagar al comprar o vender una casa?'},
  {id: 'guadalajara', image: '/assets/listings/sets/150280233/01.jpg', title: '¿Cuánto cuesta vivir en el centro de Guadalajara?'},
  {id: 'black-1', image: '/assets/listings/sets/150073890/01.jpg', title: 'Consejos para decorar con color negro tu casa'},
  {id: 'black-2', image: '/assets/listings/sets/150073890/01.jpg', title: 'Consejos para decorar con color negro tu casa'},
];

const META = 'Agosto de 2026 · 10 min de lectura';

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
        {STORIES.map(story => <li key={story.id}>
          <article className="home-blog-item">
            <img src={story.image} alt="" loading="lazy"/>
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
