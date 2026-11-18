import React, {useMemo} from 'react';
import {Icon} from './App.jsx';
import {homes, propertyPhoto} from './data.js';
import {useLanguage} from './i18n.jsx';
import {homeAsset} from './HomeSearch.jsx';
import {PropertyPreview, previewPhotoProps, usePropertyPreview} from './ideaPreview.jsx';

const FAN_IDS = ['buy-150907005', 'buy-150135691', 'buy-150851727', 'buy-150159787'];
const HERO_ID = 'buy-150922505';
const byId = id => homes.find(home => home.id === id);

const PERKS = [
  ['heart', 'Guarda y comparte favoritos'],
  ['bookmark', 'Recibe alertas de precios y ofertas'],
  ['bell', 'Descubre propiedades recién publicadas'],
  ['spark', 'Explora recomendaciones exclusivas'],
];

export function HomeGuestPromo({onLogin, saved = [], onLike, onOpen}) {
  const {t} = useLanguage();
  const fan = useMemo(() => FAN_IDS.map(byId).filter(Boolean), []);
  const hero = useMemo(() => byId(HERO_ID) || fan[0], [fan]);
  const previewApi = usePropertyPreview('guest-property-preview');
  if (!hero) return null;

  return <section className="home-guest-promo" aria-labelledby="home-guest-promo-title">
    <div className="home-guest-promo-join">
      <div className="home-guest-promo-fan photo-stack">
        {fan.map(home => <button type="button" className="idea-photo" key={home.id} aria-label={t('Vista previa de ') + home.street} {...previewPhotoProps(home, previewApi)}>
          <img src={propertyPhoto(home)} alt="" loading="lazy"/>
        </button>)}
      </div>
      <h2 id="home-guest-promo-title">{t('Tu próximo hogar comienza con una cuenta')}</h2>
      <p>{t('Inicia sesión o crea tu cuenta para organizar tu búsqueda y seguir los inmuebles que te gustan.')}</p>
      <button type="button" className="home-start home-guest-promo-cta" onClick={() => onLogin?.()}>
        {t('Iniciar sesión o crear cuenta')}<img src={homeAsset('arrow')} alt=""/>
      </button>
    </div>
    <div className="home-guest-promo-card">
      <div className="home-guest-promo-copy">
        <h2>{t('Tu experiencia personalizada')}</h2>
        <p>{t('Descubre opciones alineadas con lo que buscas para tu próximo hogar.')}</p>
        <ul className="home-pill-list">
          {PERKS.map(([icon, label]) => <li key={icon}><span className="home-pill"><span className="home-pill-icon"><Icon name={icon} size={16}/></span>{t(label)}</span></li>)}
        </ul>
      </div>
      <div className="home-guest-promo-visual">
        <img src={propertyPhoto(hero)} alt={hero.imageAlt} loading="lazy"/>
        <div className="home-guest-promo-overlay">
          <span className="home-guest-promo-badge">{t('¡Acaba de llegar!')}</span>
          <button type="button" className="home-start home-guest-promo-enter" onClick={() => onLogin?.()}>{t('Entrar')}</button>
        </div>
      </div>
    </div>
    <PropertyPreview api={previewApi} saved={saved} onLike={onLike} onOpen={onOpen}/>
  </section>;
}
