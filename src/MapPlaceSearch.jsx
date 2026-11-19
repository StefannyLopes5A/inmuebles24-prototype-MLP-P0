import React, {useEffect, useId, useMemo, useState} from 'react';
import {POI_CATEGORIES, poiIconUrl, poiLabel} from './pois';
import {suggestPlaces} from './placeTrips';

export const TRIP_MODES = [
  ['walk', 'walk', 'A pé', 'A pie'],
  ['car', 'car', 'De carro', 'En auto'],
  ['bike', 'bike', 'De bicicleta', 'En bici'],
  ['transit', 'subway', 'De metrô', 'En metro'],
];
export const modeIcon = icon => `/assets/place-trips/${icon}.svg`;
export const distanceOf = meters => meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;

const SearchIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2"/><path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;

/**
 * Search over the map: a catalog place (or a kind of place) and the time from this listing to it.
 * The selected place and the travel mode live in the map, which draws the route; this holds the field,
 * the suggestions and the card with the minutes by mode. Nothing is geocoded or saved.
 */
export function MapPlaceSearch({center, language, say, place, mode, resetKey = 0, onPlace, onMode, onClose}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId(), inputId = useId();
  const point = center ? `${center[0]},${center[1]}` : '';
  const typed = query.trim();
  const suggestions = useMemo(() => (typed && point ? suggestPlaces(center, typed, {limit: 8}) : []),
    [typed, point, center]);
  const current = suggestions.length ? Math.min(active, suggestions.length - 1) : 0;
  const showKinds = open && !typed && !place;
  const showResults = open && typed.length > 0;

  useEffect(() => { setQuery(''); setOpen(false); setActive(0); }, [point, resetKey]);
  useEffect(() => {
    if (!showResults || !suggestions.length) return;
    document.getElementById(`${listId}-${suggestions[current].id}`)?.scrollIntoView({block: 'nearest'});
  }, [showResults, current, suggestions, listId]);

  function choose(next) {
    if (!next) return;
    onPlace(next);
    setQuery('');
    setOpen(false);
    setActive(0);
  }
  function clear() {
    onPlace(null);
    setQuery('');
    setActive(0);
  }
  function onKey(event) {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => (Math.min(index, suggestions.length - 1) + 1) % suggestions.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => (Math.min(index, suggestions.length - 1) - 1 + suggestions.length) % suggestions.length); }
    else if (event.key === 'Enter' && open && suggestions[current]) { event.preventDefault(); choose(suggestions[current]); }
  }

  const label = place ? place.name : query;
  return <>
    <div className="pp-map-search">
      <div className="pp-map-search-field">
        <span className="pp-map-search-icon"><SearchIcon/></span>
        <label className="sr-only" htmlFor={inputId}>{say('Buscar um lugar e ver o tempo de deslocamento', 'Buscar un lugar y ver el tiempo de traslado')}</label>
        <input id={inputId} className="pp-map-search-input" role="combobox" type="text" autoComplete="off"
          placeholder={say('Busque lugares e veja o deslocamento', 'Busca lugares y mira el traslado')}
          aria-expanded={showKinds || showResults} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={showResults && suggestions[current] ? `${listId}-${suggestions[current].id}` : undefined}
          value={label}
          onChange={event => { if (place) onPlace(null); setQuery(event.target.value); setActive(0); setOpen(true); }}
          onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey}/>
        {(place || query) && <button type="button" className="pp-map-search-clear" aria-label={say('Limpar busca', 'Limpiar búsqueda')}
          onMouseDown={event => event.preventDefault()} onClick={clear}><CloseIcon/></button>}
      </div>
      {showKinds && <ul className="pp-map-suggest" id={listId} role="listbox" aria-label={say('Tipos de lugar', 'Tipos de lugar')}>
        {POI_CATEGORIES.map(category => <li key={category.id}>
          <button type="button" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()}
            onClick={() => { setQuery(poiLabel(category.id, language)); setActive(0); setOpen(true); }}>
            <span className="pp-map-kind" style={{background: category.color}}><img src={poiIconUrl(category.id)} alt="" width="18" height="18"/></span>
            <span><b>{poiLabel(category.id, language)}</b></span>
          </button>
        </li>)}
      </ul>}
      {showResults && (suggestions.length > 0
        ? <ul className="pp-map-suggest" id={listId} role="listbox" aria-label={say('Lugares sugeridos', 'Lugares sugeridos')}>
          {suggestions.map((item, index) => <li key={item.id}>
            <button type="button" role="option" id={`${listId}-${item.id}`} aria-selected={index === current}
              onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)}>
              <img src={poiIconUrl(item.categoria)} alt="" width="20" height="20"/>
              <span><b>{item.name}</b><small>{poiLabel(item.categoria, language)}</small></span>
              <em>{distanceOf(item.meters)}</em>
            </button>
          </li>)}
        </ul>
        : <p className="pp-map-suggest-empty" role="status">{say('Nenhum lugar do catálogo com esse nome.', 'Ningún lugar del catálogo con ese nombre.')}</p>)}
    </div>
    {place && <div className="pp-map-trip" role="group" aria-label={say(`Deslocamento até ${place.name}`, `Traslado a ${place.name}`)}>
      <div className="pp-map-trip-head">
        <img src={poiIconUrl(place.categoria)} alt="" width="20" height="20"/>
        <div>
          <strong>{place.name}</strong>
          <span>{poiLabel(place.categoria, language)} · {distanceOf(place.meters)}</span>
        </div>
        <button type="button" className="pp-map-trip-close" aria-label={say('Fechar e mostrar todos os lugares', 'Cerrar y mostrar todos los lugares')} onClick={() => (onClose ? onClose() : onPlace(null))}><CloseIcon/></button>
      </div>
      <div className="pp-map-trip-modes">
        {TRIP_MODES.map(([id, icon, pt, es]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => onMode(id)}>
          <img src={modeIcon(icon)} alt="" width="16" height="16"/>
          <span>{place.minutes[id]} min</span>
          <span className="sr-only">{say(pt, es)}</span>
        </button>)}
      </div>
    </div>}
  </>;
}
