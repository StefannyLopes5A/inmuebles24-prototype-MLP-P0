import React, {useEffect, useRef, useState} from 'react';
import {HomeChevron, HomePopover, LocationSearch} from './HomeSearch.jsx';
import {LocationMenu} from './LocationMenu.jsx';
import {locationMenuChoices, togglePlaceList} from './locationSearch.js';
import {Icon} from './App';
import {playSelection} from './homeMotion.js';

/**
 * The location input of the home and the results bar. It only takes places (cities, colonias, streets and points of
 * interest from the catalog). The field shows the chosen places as chips; opening it shows the location panel: a search
 * input on top and the suggestions below it. Before anyone types the panel offers the suggested places, as the rest of
 * the product does; a pick becomes a removable chip, and up to three places fit in one search.
 */
export function LocationField({places, onChange, say, variant = 'bar', placeholder, label}) {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(-1);
  const choices = locationMenuChoices(places, term);
  const choicesRef = useRef(choices);
  choicesRef.current = choices;

  function show(motion) { setAnimate(motion); setOpen(true); }
  function close(restore = false) {
    setOpen(false); setTerm(''); setActive(-1);
    if (restore) requestAnimationFrame(() => anchor.current?.focus({preventScroll:true}));
  }
  function choose(place) {
    const next = togglePlaceList(places, place);
    if (next === places) return;
    onChange(next);
    close(true);
  }
  function remove(place) { onChange(places.filter(item => item.key !== place.key)); }
  useEffect(() => { setActive(-1); }, [term]);
  // Arrow keys and Enter work from the panel's search input.
  useEffect(() => {
    if (!open) return;
    const key = event => {
      const list = choicesRef.current;
      if (!document.activeElement?.closest?.('.home-popover')) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive(current => event.key === 'ArrowDown' ? (current >= list.length - 1 ? 0 : current + 1) : (current <= 0 ? list.length - 1 : current - 1));
      } else if (event.key === 'Enter') {
        const pick = list[active >= 0 ? active : (term.trim().length >= 2 ? 0 : -1)];
        if (pick) { event.preventDefault(); choose(pick); }
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  // choose() reads the latest props through its closure on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, term, places]);

  const empty = term.trim().length >= 2 && !choices.length ? say('Nenhum lugar encontrado. Tente outro nome.', 'No encontramos ese lugar. Prueba otro nombre.') : null;
  const summary = places.length > 1 ? 'Multilocation' : places[0]?.label || '';
  // A chosen place sweeps the same light pass across its word as the operation and property type do on the home.
  useEffect(() => { if (variant === 'sentence' && summary) playSelection(null, anchor.current); }, [variant, summary]);
  const panel = <HomePopover open={open} animate={animate} anchor={anchor.current} label={say('Localização', 'Ubicación')} kind="area" variant="area" onClose={close}>
    <LocationSearch label={say('Buscar localização', 'Buscar ubicación')} placeholder={say('Bairro, rua, metrô, escola…', 'Colonia, calle, metro, escuela…')} clearLabel={say('Limpar localização', 'Borrar ubicación')} value={term} onChange={setTerm}/>
    <LocationMenu label={say('Localização', 'Ubicación')} places={choices} selectedKeys={places.map(place => place.key)} activeIndex={active} say={say}
      onChoose={choose} onRemove={remove} empty={empty}/>
  </HomePopover>;
  // A chosen place reads as a word of the home sentence, in the same style as the other filters.
  if (variant === 'sentence') return <span className="home-word interactive">
    <button ref={anchor} type="button" className="home-word-control is-chosen" aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${summary}`}
      onClick={event => show(event.detail > 0)} onKeyDown={event => {if (event.key === 'ArrowDown') {event.preventDefault(); show(false);}}}>
      <span className="home-choice-label">{summary}</span><HomeChevron/>
    </button>
    {panel}
  </span>;
  return <div className={`lf lf-${variant}${open ? ' is-open' : ''}`}>
    <div ref={anchor} className="lf-box" role="button" tabIndex={0} aria-haspopup="dialog" aria-expanded={open} aria-label={label}
      onClick={event => show(event.detail > 0)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') { event.preventDefault(); show(false); }
        else if (event.key === 'Backspace' && places.length) remove(places[places.length - 1]);
      }}>
      <span className="lf-icon" aria-hidden="true"><Icon name="pin" size={20}/></span>
      {places.map(place => <span className="lf-chip" key={place.key}>
        <span>{place.label}</span>
        <button type="button" className="lf-chip-remove" aria-label={`${say('Remover', 'Quitar')} ${place.label}`} onClick={event => { event.stopPropagation(); remove(place); }}><Icon name="close" size={14}/></button>
      </span>)}
      {!places.length && <span className="lf-placeholder">{placeholder}</span>}
    </div>
    {panel}
  </div>;
}
