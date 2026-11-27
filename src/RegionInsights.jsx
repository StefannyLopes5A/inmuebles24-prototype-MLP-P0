import React, {Suspense, lazy, useEffect, useId, useMemo, useRef, useState} from 'react';
import {useLanguage} from './i18n';
import {listingPrice} from './data';
import {normalizeSearch} from './journey';
import {pricePerM2} from './compareReading.js';
import {coloniaVision, textOf} from './mapWidgetContent.js';
import {regionLandmark} from './regionLandmark.js';
import {insightMode, regionPhotos, regionSnapshot} from './priceInsights.js';
import {PropertyPreview, previewPhotoProps, usePropertyPreview} from './ideaPreview.jsx';

const RegionMap = lazy(() => import('./RegionMap.jsx'));
const asset = name => `/assets/price-insights/${name}`;
const FAN_SIZES = [114, 100, 114, 114];

/** Results section from Figma 12900:13949 ("about the region"): the colonia's reading and its median, highest and lowest prices. */
export function RegionInsights({search, onChange, onOpen, saved = [], onLike}) {
  const {language, money} = useLanguage();
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const current = normalizeSearch(search);
  const key = JSON.stringify([current.mode, current.areas, current.beds]);
  const snapshot = useMemo(() => regionSnapshot(search), [key]);
  const photos = useMemo(() => regionPhotos(search), [key]);
  const id = useId();
  const [guideNote, setGuideNote] = useState(false);
  const previewApi = usePropertyPreview('region-property-preview');
  // The map loads once the card is near the screen.
  const mapSlot = useRef(null);
  const [mapNear, setMapNear] = useState(false);
  useEffect(() => {
    const slot = mapSlot.current;
    if (!slot || mapNear) return;
    if (typeof IntersectionObserver === 'undefined') { setMapNear(true); return; }
    const watch = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setMapNear(true); watch.disconnect(); } }, {rootMargin: '300px'});
    watch.observe(slot);
    return () => watch.disconnect();
  }, [mapNear, snapshot]);
  if (!snapshot) return null;

  const {area, beds, median, medianPerM2, highest, lowest} = snapshot;
  const vision = coloniaVision(area);
  const reading = vision?.copy.closed.map(part => textOf(part.text, language)).join('');
  const landmark = regionLandmark(area, language);
  const house = ['house', 'condominium'].includes(current.propertyType);
  const noun = house ? 'casas' : say('apartamentos', 'departamentos');
  const scope = beds ? say(`${noun} de ${beds}+ quartos em ${area}`, `${noun} de ${beds}+ recámaras en ${area}`) : say(`${noun} em ${area}`, `${noun} en ${area}`);
  const operation = insightMode(search) === 'rent' ? say('para alugar', 'en renta') : say('à venda', 'en venta');
  const perM2 = value => value ? `${money(value)} por m²` : say('Área a confirmar', 'Superficie por confirmar');

  function applySearch(changes) {
    onChange({...search, ...changes});
    window.scrollTo({top:0, behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'});
  }

  const actionNoun = noun.charAt(0).toUpperCase() + noun.slice(1);
  const action = `${actionNoun} ${operation} ${say('até', 'hasta')} ${money(median)} ${say('em', 'en')} ${area}`;
  const statAction = home => `${actionNoun} ${operation} ${say('até', 'hasta')} ${money(listingPrice(home))}`;
  const stat = (home, label, labelId) => <article className="region-card region-stat" aria-labelledby={labelId}>
    <h3 className="region-stat-price">{money(listingPrice(home))}</h3>
    <div className="region-copy">
      <p id={labelId}>{label}</p>
      <p className="region-muted">{perM2(pricePerM2(home))}</p>
    </div>
    <button type="button" className="region-link" onClick={() => applySearch({budget:listingPrice(home), minBudget:0})}>
      {statAction(home)}
      <img src={asset('chevron-down.svg')} width="16" height="16" alt=""/>
    </button>
  </article>;

  return <section className="region-insights" aria-label={`Sobre ${area}`}><PropertyPreview api={previewApi} saved={saved} onLike={onLike} onOpen={onOpen}/><div className="region-layout">
    <article className="region-card region-about" aria-labelledby={`${id}-about`}>
      <div className="region-about-body">
        <div className="region-fan">
          {photos.map((home, index) => <button type="button" key={home.id} className="region-fan-photo" data-index={index} style={{'--size':FAN_SIZES[index]}}
            aria-label={say(`Prévia de ${home.title}`, `Vista previa de ${home.title}`)} {...previewPhotoProps(home, previewApi)}>
            <img src={home.image} alt="" loading="lazy"/>
          </button>)}
        </div>
        <div className="region-copy">
          <h2 id={`${id}-about`}>{say(`Conheça tudo sobre como é viver em ${area}`, `Conoce todo sobre cómo es vivir en ${area}`)}</h2>
          {reading && <p>{reading}</p>}
        </div>
      </div>
      <div className="region-guide">
        <button type="button" className="btn-secondary" onClick={() => setGuideNote(true)}>{say('Mostrar guia do bairro', 'Mostrar guía del barrio')}</button>
        <p className="region-guide-note" role="status">{guideNote ? say('Disponível fora deste protótipo.', 'Disponible fuera de este prototipo.') : ''}</p>
      </div>
    </article>
    <div className="region-prices">
      <article className="region-card region-featured" aria-labelledby={`${id}-median`}>
        <div className="region-featured-body">
          <div className="region-price-lead">
            <h3 className="region-featured-price">{money(median)}</h3>
            <div className="region-copy">
              <p id={`${id}-median`}>{say(`preço médio de ${scope}`, `precio medio de ${scope}`)}</p>
              <p className="region-muted">{perM2(medianPerM2)}</p>
            </div>
          </div>
          <button type="button" className="region-link" onClick={() => applySearch({budget:median, minBudget:0})}>
            {action}
            <img src={asset('chevron-down.svg')} width="16" height="16" alt=""/>
          </button>
        </div>
        <button ref={mapSlot} type="button" className="region-featured-photo is-map" aria-label={action} onClick={() => applySearch({budget:median, minBudget:0})}>
          {mapNear && <Suspense fallback={null}><RegionMap area={area} language={language}/></Suspense>}
          <span className="region-quality">{landmark}</span>
        </button>
      </article>
      <div className="region-stats">
        {stat(highest, say(`Maior preço para ${scope}`, `Mayor precio para ${scope}`), `${id}-highest`)}
        {highest.id !== lowest.id && stat(lowest, say(`Menor preço para ${scope}`, `Menor precio para ${scope}`), `${id}-lowest`)}
      </div>
    </div>
  </div></section>;
}
