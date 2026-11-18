import React from 'react';
import {PlaceOptionBody} from './PlaceKind.jsx';

/** The location suggestion list shared by the home search and the results bar. */
export function LocationMenu({id, label, places, selectedKeys = [], activeIndex = -1, onActive, onChoose, onRemove, empty, say, floating = false}) {
  const selected = new Set(selectedKeys);
  return <div className={`location-menu${floating ? ' location-menu-floating' : ''}`} id={id} role="listbox" aria-label={label}>
    {places.map((place, index) => {
      const applied = selected.has(place.key);
      return <div className={`location-menu-item${applied ? ' is-selected' : ''}`} key={place.key}>
        <button type="button" className="location-menu-option" role="option" id={id ? `${id}-${index}` : undefined} aria-selected={index === activeIndex} onMouseDown={event => event.preventDefault()} onMouseEnter={() => onActive?.(index)} onClick={event => onChoose(place, event)}><PlaceOptionBody place={place} say={say}/></button>
        {applied && onRemove ? <button type="button" className="location-menu-remove" aria-label={`${say('Remover', 'Quitar')} ${place.label}`} onMouseDown={event => event.preventDefault()} onClick={() => onRemove(place)}><img src="/assets/home-evolution/phrase-close.svg" alt="" aria-hidden="true"/></button> : null}
      </div>;
    })}
    {!places.length && empty ? <p className="location-menu-empty" role="status">{empty}</p> : null}
  </div>;
}
