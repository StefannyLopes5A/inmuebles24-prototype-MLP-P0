import React, {useLayoutEffect, useRef} from 'react';
import {useLanguage} from './i18n';
import {IconButton} from './IconButton.jsx';
import {HouseCard} from './Home';
import {savedCountLabel} from './favorites.js';

/** A flat list of saved listings. No folders, comparison or sharing. */
export function FavoritesPage({homes, onLike, onOpen, receipts = [], search, onBack}) {
  const {language} = useLanguage();
  const say = (es, br) => language === 'pt-BR' ? br : es;
  const title = useRef(null);
  useLayoutEffect(() => {title.current?.focus({preventScroll:true});}, []);
  return <article className="favorites-page">
    <header className="favorites-header">
      <IconButton icon="back" className="compare-back" onClick={onBack} label={say('Volver a la búsqueda', 'Voltar à busca')}/>
      <div className="favorites-heading">
        <h1 ref={title} tabIndex={-1}>{say('Favoritos', 'Favoritos')}</h1>
        {homes.length > 0 && <p className="favorites-count">{savedCountLabel(homes.length, language)}</p>}
      </div>
    </header>
    {homes.length ? <ul className="favorites-list">
      {homes.map(home => <li key={home.id}>
        <HouseCard home={home} search={search} saved onLike={onLike} onOpen={onOpen} contacted={receipts.some(receipt => receipt.propertyId === home.id)}/>
      </li>)}
    </ul> : <div className="favorites-empty">
      <h2>{say('Aún no tienes favoritos', 'Você ainda não tem favoritos')}</h2>
      <p>{say('Toca el corazón de un inmueble para guardarlo aquí.', 'Toque no coração de um imóvel para salvá-lo aqui.')}</p>
    </div>}
  </article>;
}
