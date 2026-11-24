import React, {useLayoutEffect, useRef} from 'react';
import {matchingHomes, normalizeSearch} from './journey.js';
import {propertyPhoto} from './data';
import {useLanguage} from './i18n';
import {savedSearchChips, savedSearchMeta, savedSearchTitle} from './savedSearches.js';
import {IconButton} from './IconButton.jsx';

export function SavedSearches({entries, onOpen, onRemove, onBack}) {
  const {language, money, currency} = useLanguage();
  const spanish = language !== 'pt-BR';
  const say = (es, br) => spanish ? es : br;
  const title = useRef(null);
  useLayoutEffect(() => {title.current?.focus({preventScroll:true});}, []);
  const cards = entries.map(entry => {
    const search = normalizeSearch(entry.search);
    const matches = matchingHomes(search);
    return {
      key:entry.key,
      search,
      title:savedSearchTitle(search, language),
      meta:savedSearchMeta(matches.length, entry.savedAt, language),
      chips:savedSearchChips(search, {language, money, currency}),
      photo:matches[0] ? propertyPhoto(matches[0]) : '',
    };
  });
  return <article className="saved-searches">
    <header className="saved-searches-header">
      <IconButton icon="back" className="compare-back" onClick={onBack} label={say('Volver', 'Voltar')}/>
      <h1 ref={title} tabIndex={-1}>{say('Búsquedas guardadas', 'Buscas salvas')}</h1>
    </header>
    {cards.length ? <ul className="saved-searches-grid">
      {cards.map(card => <li key={card.key}>
        <article className="saved-search-card">
          {card.photo ? <img className="saved-search-photo" src={card.photo} alt=""/> : <div className="saved-search-photo saved-search-photo-empty" aria-hidden="true"/>}
          <div className="saved-search-body">
            <div>
              <h2>{card.title}</h2>
              <p>{card.meta}</p>
            </div>
            <ul className="saved-search-chips">{card.chips.map((chip, index) => <li key={`${index}-${chip}`}>{chip}</li>)}</ul>
            <button type="button" className="saved-search-open" onClick={() => onOpen(card.search)}>{say('Ver resultados', 'Ver resultados')}</button>
          </div>
          <button type="button" className="saved-search-remove" aria-label={say(`Quitar búsqueda: ${card.title}`, `Remover busca: ${card.title}`)} onClick={() => onRemove(card.key)}><img src="/assets/saved-searches/trash.svg" alt=""/></button>
        </article>
      </li>)}
    </ul> : <div className="saved-searches-empty">
      <h2>{say('Todavía no guardas búsquedas', 'Você ainda não salvou buscas')}</h2>
      <p>{say('En los resultados, Guardar búsqueda deja esa búsqueda aquí.', 'Nos resultados, Salvar busca deixa essa busca aqui.')}</p>
    </div>}
  </article>;
}
