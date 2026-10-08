import React, {useLayoutEffect, useRef} from 'react';
import {Icon} from './App';
import {FavoriteHeart} from './FavoriteHeart';
import {listingPrice, propertyPhoto} from './data';
import {useLanguage} from './i18n';
import {MoraName} from './MiniListing';
import {compareFavorites} from './listingPresentation';

function searchContextLine(search, pref, money, currency, language) {
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const mode = search.mode === 'rent' ? say('Alugar', 'Rentar') : say('Comprar', 'Comprar');
  const area = search.areas.length ? search.areas.join(', ') : (search.area || say('Qualquer região', 'Cualquier zona'));
  const beds = `${search.beds}+ ${say(search.beds === 1 ? 'quarto' : 'quartos', search.beds === 1 ? 'recámara' : 'recámaras')}`;
  const budget = `${say('até', 'hasta')} ${money(search.budget)} ${currency}`;
  const preference = pref === 'extra'
    ? say('Prioridade: 3+ quartos', 'Prioridad: 3+ recámaras')
    : pref === 'open'
      ? say('Preferência: espaço na sala', 'Preferencia: espacio en la sala')
      : null;
  return [mode, area, beds, budget, preference].filter(Boolean).join(' · ');
}

export function CompareFavorites({homes, search, pref, onClose, onOpen, onUnlike}) {
  const {language, t, money, currency} = useLanguage();
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const title = useRef(null);
  const reading = compareFavorites(homes, search, pref, language);
  useLayoutEffect(() => {title.current?.focus({preventScroll: true});}, []);

  return <article className="compare-page">
    <button className="property-return" onClick={onClose}><Icon name="back"/>{say('Voltar à busca', 'Volver a la búsqueda')}</button>
    <header className="compare-page-header">
      <h1 ref={title} tabIndex={-1}>{say('Comparar favoritos', 'Comparar favoritos')}</h1>
      {homes.length >= 2 && <p className="compare-search-context">{searchContextLine(search, pref, money, currency, language)}</p>}
      {homes.length >= 2 && reading.verdict && <div className="compare-verdict"><MoraName/><p>{reading.verdict}</p></div>}
      {homes.length >= 2 && !!(reading.sharedMatches.length || reading.sharedConsiderations.length) && (
        <p className="compare-shared">
          {[...reading.sharedMatches, ...reading.sharedConsiderations].join(' · ')}
        </p>
      )}
      {homes.length === 1 && <p className="compare-empty-copy">{say('Salve mais um para comparar.', 'Guarda uno más para comparar.')}</p>}
      {homes.length === 0 && <p className="compare-empty-copy">{say('Os corações da busca aparecem aqui.', 'Los corazones de la búsqueda aparecen aquí.')}</p>}
    </header>

    {homes.length > 0 && <div className="compare-rail" role="list">
      {reading.cards.map(card => {
        const home = card.home;
        const isLeader = reading.leaderId === home.id;
        return <section className={`compare-column${isLeader ? ' is-leader' : ''}`} role="listitem" key={home.id}>
          <div className="compare-column-sticky">
            <div className="compare-photo">
              <img src={propertyPhoto(home)} alt={home.imageAlt}/>
              <button
                className="compare-unlike discovery-like is-liked"
                aria-label={t('Quitar de favoritos ') + home.street}
                aria-pressed={true}
                onClick={() => onUnlike(home)}
              >
                <FavoriteHeart/>
              </button>
            </div>
            <p className="compare-kind">{say(home.mode === 'rent' ? 'Alugar · Apartamento' : 'Comprar · Apartamento', home.mode === 'rent' ? 'Rentar · Departamento' : 'Comprar · Departamento')}</p>
            <h2>{home.street}</h2>
            <p className="compare-area">{home.area}</p>
            <p className="compare-price">{money(listingPrice(home))} {currency}{home.mode === 'rent' && <small> / {say('mês', 'mes')}</small>}</p>
            {isLeader && <span className="compare-leader-badge">{say('Mais perto da busca', 'Más cerca de tu búsqueda')}</span>}
          </div>
          <dl className="compare-insights">
            {card.goodAt && <div><dt>{say('É bom em', 'Destaca en')}</dt><dd>{card.goodAt}</dd></div>}
            {card.consider && <div><dt>{say('Vale considerar', 'Vale la pena considerar')}</dt><dd>{card.consider}</dd></div>}
            {card.profile && <div><dt>{say('Por que combina com o perfil', 'Por qué combina con tu perfil')}</dt><dd>{card.profile}</dd></div>}
          </dl>
          <button className="mini-primary compare-open" onClick={() => onOpen(home)}>{say('Ver imóvel', 'Ver inmueble')}</button>
        </section>;
      })}
    </div>}
  </article>;
}
