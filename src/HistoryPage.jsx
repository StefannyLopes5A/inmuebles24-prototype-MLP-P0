import React, {useLayoutEffect, useRef} from 'react';
import {useLanguage} from './i18n';
import {IconButton} from './IconButton.jsx';
import {HouseCard} from './Home';

/** Historial: the listings opened in this session, most recent first. Kept in the browser session only. */
export function HistoryPage({recent = [], homeFor, saved = [], receipts = [], search, onLike, onOpen, onBack}) {
  const {language} = useLanguage();
  const say = (es, br) => language === 'pt-BR' ? br : es;
  const title = useRef(null);
  useLayoutEffect(() => { title.current?.focus({preventScroll:true}); }, []);
  const seen = recent.map(entry => homeFor(entry.id || entry)).filter(Boolean);
  const total = seen.length;
  const count = language === 'pt-BR' ? (total === 1 ? '1 imóvel visto' : `${total} imóveis vistos`) : (total === 1 ? '1 inmueble visto' : `${total} inmuebles vistos`);
  return <article className="favorites-page history-page">
    <header className="favorites-header">
      <IconButton icon="back" className="compare-back" onClick={onBack} label={say('Volver a la búsqueda', 'Voltar à busca')}/>
      <div className="favorites-heading">
        <h1 ref={title} tabIndex={-1}>{say('Historial', 'Histórico')}</h1>
        {total > 0 && <p className="favorites-count">{count}</p>}
      </div>
    </header>
    {total === 0 && <div className="favorites-empty">
      <h2>{say('Aún no has visto inmuebles', 'Você ainda não viu imóveis')}</h2>
      <p>{say('Los inmuebles que abras aparecerán aquí.', 'Os imóveis que você abrir aparecem aqui.')}</p>
    </div>}
    {seen.length > 0 && <section aria-label={say('Vistos recientemente', 'Vistos recentemente')}>
      <ul className="favorites-list">
        {seen.map(home => <li key={home.id}>
          <HouseCard home={home} search={search} saved={saved.includes(home.id)} onLike={onLike} onOpen={onOpen} contacted={receipts.some(receipt => receipt.propertyId === home.id)}/>
        </li>)}
      </ul>
    </section>}
  </article>;
}
