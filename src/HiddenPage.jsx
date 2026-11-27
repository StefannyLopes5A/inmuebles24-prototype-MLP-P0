import React, {useLayoutEffect, useRef} from 'react';
import {useLanguage} from './i18n';
import {IconButton} from './IconButton.jsx';
import {HouseCard} from './Home';

/** Descartados: the listings hidden from the search in this session. Each card can come back to the search. */
export function HiddenPage({hidden = [], homeFor, saved = [], receipts = [], search, onLike, onOpen, onRestore, onBack}) {
  const {language} = useLanguage();
  const say = (es, br) => language === 'pt-BR' ? br : es;
  const title = useRef(null);
  useLayoutEffect(() => { title.current?.focus({preventScroll:true}); }, []);
  const homes = hidden.map(homeFor).filter(Boolean);
  const total = homes.length;
  const count = language === 'pt-BR' ? (total === 1 ? '1 imóvel descartado' : `${total} imóveis descartados`) : (total === 1 ? '1 inmueble descartado' : `${total} inmuebles descartados`);
  return <article className="favorites-page hidden-page">
    <header className="favorites-header">
      <IconButton icon="back" className="compare-back" onClick={onBack} label={say('Volver a la búsqueda', 'Voltar à busca')}/>
      <div className="favorites-heading">
        <h1 ref={title} tabIndex={-1}>{say('Descartados', 'Descartados')}</h1>
        {total > 0 && <p className="favorites-count">{count}</p>}
      </div>
    </header>
    {total === 0 && <div className="favorites-empty">
      <h2>{say('Aún no has descartado inmuebles', 'Você ainda não descartou imóveis')}</h2>
      <p>{say('Los inmuebles que ocultes de la búsqueda aparecerán aquí.', 'Os imóveis que você ocultar da busca aparecem aqui.')}</p>
    </div>}
    {total > 0 && <section aria-label={say('Inmuebles descartados', 'Imóveis descartados')}>
      <ul className="favorites-list">
        {homes.map(home => <li key={home.id}>
          <HouseCard home={home} search={search} saved={saved.includes(home.id)} onLike={onLike} onOpen={onOpen} contacted={receipts.some(receipt => receipt.propertyId === home.id)}/>
          <button type="button" className="hidden-restore" onClick={() => onRestore(home)}>{say('Volver a la búsqueda', 'Voltar à busca')}</button>
        </li>)}
      </ul>
    </section>}
  </article>;
}
