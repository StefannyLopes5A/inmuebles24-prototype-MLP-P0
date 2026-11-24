import React from 'react';
import {PlaceOptionBody} from './PlaceKind.jsx';
import {MAX_PLACES} from './locationSearch.js';
import {IconButton} from './IconButton.jsx';

/** The location suggestion list shared by the home search and the results bar. */
export function LocationMenu({id, label, places, selectedKeys = [], activeIndex = -1, onActive, onChoose, onRemove, empty, say, floating = false}) {
  const selected = new Set(selectedKeys);
  return <div className={`location-menu${floating ? ' location-menu-floating' : ''}`} id={id} role="listbox" aria-label={label}>
    {places.map((place, index) => {
      const applied = selected.has(place.key);
      const full = !applied && selected.size >= MAX_PLACES && place.kind !== 'state';
      return <div className={`location-menu-item${applied ? ' is-selected' : ''}${full ? ' is-disabled' : ''}`} key={place.key}>
        <button type="button" className="location-menu-option" role="option" id={id ? `${id}-${index}` : undefined} aria-selected={index === activeIndex} aria-disabled={full || undefined} onMouseDown={event => event.preventDefault()} onMouseEnter={() => onActive?.(index)} onClick={event => {if (!full) onChoose(place, event);}}><PlaceOptionBody place={place} say={say}/></button>
        {applied && onRemove ? <IconButton icon="close" className="location-menu-remove" label={`${say('Remover', 'Quitar')} ${place.label}`} onMouseDown={event => event.preventDefault()} onClick={() => onRemove(place)}/> : null}
      </div>;
    })}
    {!places.length && empty ? <p className="location-menu-empty" role="status">{empty}</p> : null}
  </div>;
}
