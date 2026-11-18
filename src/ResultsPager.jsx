import React from 'react';
import {pagerWindow} from './resultsPager.js';

const back = '/assets/search-flow/chevron-back.svg';
const forward = '/assets/search-flow/chevron-forward.svg';

/** Results pagination, Figma 12900:16548. */
export function ResultsPager({page, pages, slots = 5, onPage, say}) {
  const numbers = pagerWindow(page, pages, slots);
  if (pages < 2 || !numbers.length) return null;
  return <nav className="results-pager" aria-label={say('Páginas dos resultados', 'Páginas de resultados')}>
    <div className="results-pager-row">
      <button type="button" className="results-pager-arrow" disabled={page <= 1} aria-label={say('Página anterior', 'Página anterior')} onClick={() => onPage(page - 1)}>
        <img src={back} width="24" height="24" alt=""/>
      </button>
      <div className="results-pager-pages">
        {numbers.map(number => <button type="button" className="results-pager-page" key={number} aria-current={number === page ? 'page' : undefined} aria-label={say(`Página ${number}`, `Página ${number}`)} onClick={() => onPage(number)}>{number}</button>)}
      </div>
      <button type="button" className="results-pager-arrow" disabled={page >= pages} aria-label={say('Próxima página', 'Página siguiente')} onClick={() => onPage(page + 1)}>
        <img src={forward} width="24" height="24" alt=""/>
      </button>
    </div>
  </nav>;
}
