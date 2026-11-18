import React from 'react';
import {languages, useLanguage} from './i18n.jsx';

const EXPLORE = ['Guía de la ciudad', 'Guía de colonias', 'Calles y avenidas', 'Condominios', 'Puntos de interés'];

const COLUMNS = [
  {title: 'Soluciones para', links: ['Corredores', 'Inmobiliarias', 'Constructoras', 'Desarrolladoras', 'Nuestros socios', 'Compradores', 'Inquilinos']},
  {title: 'Productos', links: ['Zonaprop · Argentina', 'QuintoAndar · Brasil', 'CasaMineira · Brasil', 'Wimoveis · Brasil', 'Urbania · Peru', 'Adondevivir · Peru', 'Plusvalia · Ecuador', 'Compreoalquile · Panamá']},
  {title: 'Institucional', links: ['Blog', 'Centro de ayuda', 'Materiales gratuitos', 'Guía para comprar un inmueble', 'Guía para rentar un inmueble', 'Valuador', 'Índice de renta', 'Mapa del sitio']},
  {title: 'Anuncia tu inmueble', links: ['Anunciar para vender', 'Anunciar para rentar', 'Cómo anunciar', 'Planes de anuncios', 'Mis anuncios']},
];

const SOCIAL = [
  ['x', 'X'],
  ['linkedin', 'LinkedIn'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
];

export function CatalogFooter() {
  const {t, language, setLanguage} = useLanguage();
  return <footer className="catalog-footer">
    <div className="catalog-footer-top">
      <div className="catalog-explore">
        <strong>{t('Para explorar más')}</strong>
        <div className="catalog-pills">
          {EXPLORE.map(label => <button type="button" key={label}>{t(label)}</button>)}
        </div>
      </div>
      <div className="catalog-social">
        {SOCIAL.map(([name, label]) => <button type="button" key={name} aria-label={label}><img src={`/assets/footer/social-${name}.svg`} alt="" width="40" height="40"/></button>)}
      </div>
    </div>
    <div className="catalog-footer-grid">
      {COLUMNS.map(column => <div key={column.title}>
        <h2>{t(column.title)}</h2>
        <ul>
          {column.links.map(label => <li key={label}><button type="button">{t(label)}</button></li>)}
        </ul>
      </div>)}
      <div className="catalog-app">
        <h2>{t('Descarga la app y recibe recomendaciones de inmuebles')}</h2>
        <div className="catalog-badges">
          <button type="button" className="catalog-badge" aria-label={`${t('Consíguelo en')} App Store`}>
            <img src="/assets/footer/app-store.svg" alt="" width="106.667" height="35.556"/>
          </button>
          <button type="button" className="catalog-badge" aria-label={`${t('Disponible en')} Google Play`}>
            <img src="/assets/footer/google-play.svg" alt="" width="120" height="36.444"/>
          </button>
        </div>
      </div>
    </div>
    <p className="catalog-wordmark" aria-hidden="true"><span>imovelweb</span></p>
    <div className="catalog-legal">
      <p className="catalog-group"><img src="/assets/footer/grupo-quintoandar.svg" alt="Grupo QuintoAndar" width="151" height="40"/></p>
      <div className="catalog-legal-end">
        <p className="catalog-legal-links">
          <span>© Copyright 2026 imovelweb.com.br</span>
          <button type="button">{t('Términos y condiciones generales de contratación')}</button>
          <button type="button">{t('Aviso de privacidad')}</button>
        </p>
        <select className="footer-language" aria-label={t('Idioma')} value={language} onChange={event => setLanguage(event.target.value)}>
          {languages.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
        </select>
      </div>
    </div>
  </footer>;
}
