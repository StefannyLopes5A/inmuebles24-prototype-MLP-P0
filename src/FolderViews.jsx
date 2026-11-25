import React from 'react';
import {useSay} from './Collaboration';

const VIEWS = [
  {id:'list', es:'Lista', pt:'Lista'},
  {id:'table', es:'Tabla', pt:'Tabela'},
  {id:'compare', es:'Comparación', pt:'Comparação'},
];

// Remembers the last list/table choice so returning from the comparison lands on it.
let lastView = 'list';
export const getFolderView = () => lastView;
export const rememberFolderView = view => {if (view === 'list' || view === 'table') lastView = view;};

export function FolderViews({active, onSelect}) {
  const {say} = useSay();
  return <div className="folder-views" role="group" aria-label={say('Vista de la lista', 'Visualização da lista')}>
    {VIEWS.map(view => <button key={view.id} type="button" aria-pressed={active === view.id} onClick={() => active !== view.id && onSelect(view.id)}>{say(view.es, view.pt)}</button>)}
  </div>;
}
