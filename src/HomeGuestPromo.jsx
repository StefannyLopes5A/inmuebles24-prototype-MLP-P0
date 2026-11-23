import React, {useMemo} from 'react';
import {homes, propertyPhoto} from './data.js';
import {useLanguage} from './i18n.jsx';
import {homeAsset} from './HomeSearch.jsx';
import {PropertyPreview, previewPhotoProps, usePropertyPreview} from './ideaPreview.jsx';

const FAN_IDS = ['buy-150907005', 'buy-150135691', 'buy-150851727', 'buy-150159787'];
const byId = id => homes.find(home => home.id === id);

const PERKS = [
  ['Explora recomendaciones exclusivas', 'Inicia sesión o crea tu cuenta para organizar', 'explore'],
  ['Descubre propiedades recién publicadas', 'Inicia sesión o crea tu cuenta para organizar', 'discover'],
  ['Guarda y comparte favoritos', 'Inicia sesión o crea tu cuenta para organizar', 'favorites'],
  ['Recibe alertas de precios y ofertas', 'Inicia sesión o crea tu cuenta para organizar', 'alerts'],
  // Shown only on wide screens, where the grid has room for a third column.
  ['Descubre opciones alineadas con lo que buscas', 'Recibe sugerencias según tu presupuesto, tu zona y tu estilo de vida.', 'matches', true],
  ['Tu experiencia personalizada', 'Guarda tus preferencias y retoma tu búsqueda en cualquier momento.', 'personal', true],
];

export function HomeGuestPromo({onLogin, saved = [], onLike, onOpen}) {
  const {t} = useLanguage();
  const fan = useMemo(() => FAN_IDS.map(byId).filter(Boolean), []);
  const previewApi = usePropertyPreview('guest-property-preview');
  if (!fan.length) return null;

  return <section className="home-guest-promo" aria-labelledby="home-guest-promo-title">
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
    <div className="home-guest-promo-join">
      <div className="home-guest-promo-text">
        <div className="home-guest-promo-fan photo-stack">
          {fan.map(home => <button type="button" className="idea-photo" key={home.id} aria-label={t('Vista previa de ') + home.street} {...previewPhotoProps(home, previewApi)}>
            <img src={propertyPhoto(home)} alt="" loading="lazy"/>
          </button>)}
        </div>
        <h2 id="home-guest-promo-title">{t('Tu próximo hogar comienza con una cuenta')}</h2>
        <p>{t('Inicia sesión o crea tu cuenta para organizar tu búsqueda y seguir los inmuebles que te gustan.')}</p>
      </div>
      <button type="button" className="home-start home-guest-promo-cta" onClick={() => onLogin?.()}>
        {t('Iniciar sesión o crear cuenta')}<img src={homeAsset('arrow')} alt=""/>
      </button>
    </div>
    <PropertyPreview api={previewApi} saved={saved} onLike={onLike} onOpen={onOpen}/>
  </section>;
}
