import React from 'react';
import {useLanguage} from './i18n.jsx';
import {homeAsset} from './HomeSearch.jsx';


const PERKS = [
  ['Explora recomendaciones exclusivas', 'Inicia sesión o crea tu cuenta para organizar', 'explore'],
  ['Descubre propiedades recién publicadas', 'Inicia sesión o crea tu cuenta para organizar', 'discover'],
  ['Guarda y comparte favoritos', 'Inicia sesión o crea tu cuenta para organizar', 'favorites'],
  ['Recibe alertas de precios y ofertas', 'Inicia sesión o crea tu cuenta para organizar', 'alerts'],
  // Shown only on wide screens, where the grid has room for a third column.
  ['Opciones a tu medida', 'Según tu presupuesto y zona', 'matches', true],
  ['Tu experiencia personalizada', 'Retoma tu búsqueda siempre', 'personal', true],
];

export function HomeGuestPromo({onLogin}) {
  const {t} = useLanguage();

  return <section className="home-guest-promo" aria-labelledby="home-guest-promo-title">
    <div className="home-guest-promo-join">
      <div className="home-guest-promo-text">
        <h2 id="home-guest-promo-title">{t('Tu próximo hogar comienza con una cuenta')}</h2>
        <p>{t('Inicia sesión o crea tu cuenta para organizar tu búsqueda y seguir los inmuebles que te gustan.')}</p>
      </div>
      <button type="button" className="home-start home-guest-promo-cta" onClick={() => onLogin?.()}>
        {t('Iniciar sesión o crear cuenta')}<img src={homeAsset('arrow')} alt=""/>
      </button>
    </div>
    <ul className="home-guest-features">
      {PERKS.map(([title, text, photo, wide], index) => <li key={photo} className={`home-guest-feature${index % 2 ? ' is-tilt-right' : ''}${wide ? ' is-wide-only' : ''}`} onClick={() => onLogin?.()}>
        <div className="home-guest-feature-media">
          <div className="home-guest-feature-photo"><img src={`/assets/home-evolution/guest-promo/${photo}.jpg`} alt="" loading="lazy"/></div>
        </div>
        <div className="home-guest-feature-copy">
          <h3>{t(title)}</h3>
          <p>{t(text)}</p>
        </div>
        <button type="button" className="home-guest-feature-pill">{t('¡Crea tu cuenta!')}</button>
      </li>)}
    </ul>
  </section>;
}
