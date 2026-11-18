import React, {useEffect, useId, useMemo, useState} from 'react';
import {poiIconUrl, poiLabel} from './pois';
import {MAX_PLACES, suggestPlaces} from './placeTrips';

const ICON = name => `/assets/place-trips/${name}.svg`;
const MODES = [
  ['walk', 'a pé', 'a pie'],
  ['car', 'de carro', 'en auto'],
  ['bike', 'de bicicleta', 'en bici'],
  ['transit', 'de metrô', 'en metro'],
];

const distanceOf = meters => meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;

/** Tiempo de traslado: up to three catalog places, each with the minutes from this listing. */
export function ListingPlaces({center, language, say}) {
  const [chosen, setChosen] = useState([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId(), inputId = useId(), limitId = useId();
  const full = chosen.length >= MAX_PLACES;
  const taken = chosen.map(place => place.id).join('|');
  const point = center ? `${center[0]},${center[1]}` : '';
  const suggestions = useMemo(() => (full || !point ? [] : suggestPlaces(center, query, {exclude: taken ? taken.split('|') : []})), [full, point, center, query, taken]);
  useEffect(() => { setChosen([]); setQuery(''); setOpen(false); }, [point]);
  const current = suggestions.length ? Math.min(active, suggestions.length - 1) : 0;

  useEffect(() => {
    if (!open || !suggestions.length) return;
    document.getElementById(`${listId}-${suggestions[current].id}`)?.scrollIntoView({block:'nearest'});
  }, [open, current, suggestions, listId]);

  function add(place) {
    if (!place || full || chosen.some(item => item.id === place.id)) return;
    setChosen(items => [...items, place]);
    setQuery('');
    setActive(0);
  }
  function remove(id) {
    setChosen(items => items.filter(item => item.id !== id));
  }
  function onKey(event) {
    if (!suggestions.length && event.key !== 'Escape') return;
    if (event.key === 'ArrowDown') { event.preventDefault(); if (!open) { setOpen(true); return; } setActive(index => (Math.min(index, suggestions.length - 1) + 1) % suggestions.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (!open) { setOpen(true); setActive(suggestions.length - 1); return; } setActive(index => (Math.min(index, suggestions.length - 1) - 1 + suggestions.length) % suggestions.length); }
    else if (event.key === 'Enter' && open && suggestions[current]) { event.preventDefault(); add(suggestions[current]); }
    else if (event.key === 'Escape') setOpen(false);
  }

  return <div className="pp-trips">
    <div className="pp-trips-head">
      <h3>{say('Tempo de deslocamento', 'Tiempo de traslado')}</h3>
      <p>{say('Meus lugares', 'Mis lugares')}</p>
    </div>
    <div className="pp-trips-field">
      <label className="sr-only" htmlFor={inputId}>{say('Adicionar um lugar', 'Agregar un lugar')}</label>
      <input id={inputId} className="pp-trips-input" role="combobox" type="text" autoComplete="off" disabled={full}
        placeholder={say('Digite um lugar ou um endereço', 'Escribe un lugar o una dirección')}
        aria-expanded={open && !full} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && suggestions[current] ? `${listId}-${suggestions[current].id}` : undefined}
        aria-describedby={full ? limitId : undefined}
        value={query} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey}/>
      {open && !full && (suggestions.length > 0 ? <ul className="pp-trip-suggest" id={listId} role="listbox" aria-label={say('Lugares sugeridos', 'Lugares sugeridos')}>
        {suggestions.map((place, index) => <li key={place.id}>
          <button type="button" role="option" id={`${listId}-${place.id}`} aria-selected={index === current}
            onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => add(place)}>
            <img src={poiIconUrl(place.categoria)} alt="" width="20" height="20"/>
            <span><b>{place.name}</b><small>{poiLabel(place.categoria, language)}</small></span>
            <em>{distanceOf(place.meters)}</em>
          </button>
        </li>)}
      </ul> : query.trim() && <p className="pp-trip-empty" role="status">{say('Nenhum lugar do catálogo com esse nome.', 'Ningún lugar del catálogo con ese nombre.')}</p>)}
    </div>
    {full && <p className="pp-trips-limit" id={limitId}>{say('Você pode guardar 3 lugares neste anúncio.', 'Puedes guardar 3 lugares en este anuncio.')}</p>}
    {chosen.length > 0 && <ul className="pp-trips-list">
      {chosen.map(place => <li key={place.id} className="pp-trip">
        <div className="pp-trip-place">
          <img src={poiIconUrl(place.categoria)} alt="" width="20" height="20"/>
          <div className="pp-trip-copy">
            <strong>{place.name}</strong>
            <span>{poiLabel(place.categoria, language)}</span>
            <span className="sr-only">{distanceOf(place.meters)}</span>
          </div>
        </div>
        <div className="pp-trip-times">
          {MODES.map(([mode, pt, es]) => <span key={mode} className="pp-trip-time">
            <img src={ICON(mode === 'transit' ? 'subway' : mode)} alt="" width="16" height="16"/>
            <span>{place.minutes[mode]} min</span>
            <span className="sr-only">{say(pt, es)}</span>
          </span>)}
        </div>
        <button type="button" className="pp-trip-remove" onClick={() => remove(place.id)} aria-label={say(`Remover ${place.name}`, `Quitar ${place.name}`)}>
          <img src={ICON('delete')} alt="" width="24" height="24"/>
        </button>
      </li>)}
    </ul>}
  </div>;
}
