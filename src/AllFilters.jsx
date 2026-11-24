import React,{useId,useRef,useState,useEffect} from 'react';
import {Icon} from './App';
import {BudgetPicker, HomePopover, LocationSearch} from './HomeSearch';
import {PROPERTY_TYPES,OPERATIONS} from './homeSearchModel';
import {CRITERIA,criterionLabel} from './searchCriteria';
import {areas} from './data';
import {searchLocations,suggestedLocations,visiblePlaces,resolvePlace,togglePlaceList} from './locationSearch';
import {LocationMenu} from './LocationMenu';
import {prototypeResults} from './journey';
import {useLanguage} from './i18n';
import {lockContactScroll} from './contactFlow';
const DIALOG_TYPES = ['apartment', 'house', 'condominium', 'commercial', 'any'];
const POPULAR = ['pool', 'balcony', 'elevator', 'pets', 'patio', 'roof'];
const GROUPS = [
  ['leisure', 'Área de lazer', 'Área de ocio', ['gym', 'party', 'cinema', 'padel', 'tennis', 'coworking', 'gourmet']],
  ['convenience', 'Conveniências', 'Conveniencias', ['furnished', 'unfurnished', 'aircon', 'storage', 'service']],
  ['functional', 'Funcional', 'Funcional', ['accessible', 'floors', 'terrace', 'beach', 'garden']],
  ['security', 'Segurança', 'Seguridad', ['security', 'gated']],
];
const BUILT_RANGES = [[50, 100], [100, 150], [150, 200], [200, 300], [300, 450]];
const LOT_RANGES = [[80, 150], [150, 250], [250, 400], [400, 600]];
const ICONS = {
  pool: <><path d="M3 15c1.4 0 1.4-1.7 3-1.7S7.6 15 9 15s1.4-1.7 3-1.7 1.4 1.7 3 1.7 1.4-1.7 3-1.7 1.4 1.7 3 1.7"/><path d="M3 19c1.4 0 1.4-1.7 3-1.7S7.6 19 9 19s1.4-1.7 3-1.7 1.4 1.7 3 1.7 1.4-1.7 3-1.7 1.4 1.7 3 1.7"/></>,
  balcony: <><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M4 12h16"/></>,
  elevator: <><circle cx="12" cy="12" r="9"/><path d="m8 10 4-3 4 3M8 14l4 3 4-3"/></>,
  pets: <><circle cx="8" cy="8" r="1.6"/><circle cx="12" cy="6.2" r="1.5"/><circle cx="16" cy="8" r="1.6"/><circle cx="6.4" cy="12.2" r="1.3"/><circle cx="17.6" cy="12.2" r="1.3"/><path d="M12 20.2c-2.5 0-4.2-1.5-4.2-3.3 0-1.5 1.5-2.6 4.2-2.6s4.2 1.1 4.2 2.6c0 1.8-1.7 3.3-4.2 3.3Z"/></>,
  patio: <><circle cx="12" cy="12" r="2"/><path d="M12 8.2A2.4 2.4 0 0 1 12 3a2.4 2.4 0 0 1 0 5.2M12 15.8A2.4 2.4 0 0 1 12 21a2.4 2.4 0 0 1 0-5.2M8.2 12A2.4 2.4 0 0 1 3 12a2.4 2.4 0 0 1 5.2 0M15.8 12A2.4 2.4 0 0 1 21 12a2.4 2.4 0 0 1-5.2 0"/></>,
  roof: <><circle cx="12" cy="12" r="2"/><path d="M12 8.2A2.4 2.4 0 0 1 12 3a2.4 2.4 0 0 1 0 5.2M12 15.8A2.4 2.4 0 0 1 12 21a2.4 2.4 0 0 1 0-5.2M8.2 12A2.4 2.4 0 0 1 3 12a2.4 2.4 0 0 1 5.2 0M15.8 12A2.4 2.4 0 0 1 21 12a2.4 2.4 0 0 1-5.2 0"/></>,
  gym: <path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>,
  party: <path d="M8 3h8l-1 6a3 3 0 0 1-6 0ZM12 12v7M9 20h6"/>,
  cinema: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14"/></>,
  padel: <><circle cx="14.5" cy="9.5" r="5.5"/><path d="m10.6 13.4-6.1 6.1"/></>,
  tennis: <><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6a9 9 0 0 1 0 12.8M18.4 5.6a9 9 0 0 0 0 12.8"/></>,
  coworking: <><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></>,
  gourmet: <path d="M4 11h16M6 11v2a6 4 0 0 0 12 0v-2M8 4v4M12 4v4M16 4v4M9 18l-1 3M15 18l1 3"/>,
  furnished: <><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3ZM5 17v2M19 17v2"/></>,
  unfurnished: <><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 9h16"/></>,
  aircon: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>,
  storage: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
  service: <><path d="M3 18V7M3 14h18v4M21 14v-2a2 2 0 0 0-2-2h-9v4"/><circle cx="6.5" cy="11.5" r="1.5"/></>,
  accessible: <><circle cx="11" cy="4.5" r="1.5"/><path d="M11 7v6h5l2 5M8 10a5 5 0 1 0 6.5 6.5"/></>,
  floors: <><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 12h14"/></>,
  terrace: <path d="M4 9h16L12 4ZM12 9v11M8 20h8M7 14h10"/>,
  beach: <path d="M12 21v-9M12 12C11 9 8 8 5 9c2.5 0 4.5 1 7 3Zm0 0c1-3 4-4 7-3-2.5 0-4.5 1-7 3ZM12 12c0-3-1.5-5.5-4-7M8 21h8"/>,
  garden: <path d="M5 19C5 11 10 5 19 5c0 9-6 14-14 14ZM5 19l8-8"/>,
  security: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z"/>,
  gated: <path d="M3 10 12 5l9 5M5 10v10M19 10v10M5 14h14M9 14v6M15 14v6"/>,
};

function CriterionIcon({id}) {
  if (!ICONS[id]) return null;
  return <svg className="criterion-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[id]}</svg>;
}

function Stepper({label, value, min, max, decrease, increase, onChange}) {
  return <div className="room-stepper">
    <span className="room-stepper-label">{label}</span>
    <div className="room-stepper-controls">
      <button type="button" className="room-step" disabled={value <= min} aria-label={decrease} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}+</output>
      <button type="button" className="room-step" disabled={value >= max} aria-label={increase} onClick={() => onChange(value + 1)}>+</button>
    </div>
  </div>;
}

function AreaRange({title, note, min, max, ranges, least, most, minName, maxName, onChange}) {
  const amount = raw => {
    const digits = String(raw).replace(/[^\d]/g, '').slice(0, 6);
    return digits ? Number(digits) : 0;
  };
  return <div className="area-range">
    <h3>{title}</h3>
    {note ? <p>{note}</p> : null}
    <div className="area-range-fields">
      <label className="area-range-field"><span>{least}</span><span className="area-range-box"><input inputMode="numeric" autoComplete="off" placeholder="—" aria-label={minName} value={min || ''} onChange={event => onChange({min:amount(event.target.value), max})}/><span aria-hidden="true">m²</span></span></label>
      <label className="area-range-field"><span>{most}</span><span className="area-range-box"><input inputMode="numeric" autoComplete="off" placeholder="—" aria-label={maxName} value={max || ''} onChange={event => onChange({min, max:amount(event.target.value)})}/><span aria-hidden="true">m²</span></span></label>
    </div>
    <div className="all-filter-options">{ranges.map(([lo, hi]) => <button type="button" key={lo} aria-pressed={min === lo && max === hi} onClick={() => onChange(min === lo && max === hi ? {min:0, max:0} : {min:lo, max:hi})}>{lo} a {hi} m²</button>)}</div>
  </div>;
}

export function AllFilters({search, onChange, onClose, onSmartInput}) {
  const {language} = useLanguage(), pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const dialog = useRef(null), previous = useRef(document.activeElement), locationAnchor = useRef(null);
  const labelId = useId();
  const [query, setQuery] = useState('');
  const [locationOpen, setLocationOpen] = useState(false);
  const [more, setMore] = useState(() => (search.criteria || []).some(id => !POPULAR.includes(id) && !id.startsWith('text:')));
  const selected = visiblePlaces(search);
  const locationChoices = query.trim().length >= 2 ? searchLocations(query, 8) : suggestedLocations(8);
  useEffect(() => {const node = dialog.current; node.showModal(); const unlock = lockContactScroll(document); return () => {node.close(); unlock(); previous.current?.focus({preventScroll:true});};}, []);
  const apply = values => onChange({...search, ...values, ideaLabel:null});
  function toggleCriterion(id) {
    const current = search.criteria || [];
    const criteria = current.includes(id) ? current.filter(value => value !== id) : [...current.filter(value => !(id === 'furnished' && value === 'unfurnished') && !(id === 'unfurnished' && value === 'furnished')), id];
    apply({criteria});
  }
  function addPlace(place) {
    if (!place || selected.some(item => item.key === place.key)) {setQuery('');return;}
    apply({places:togglePlaceList(selected, place)});
    setQuery('');
  }
  function chooseLocation(place) {
    if (selected.some(item => item.key === place.key)) removePlace(place);
    else addPlace(place);
    setQuery('');
    setLocationOpen(false);
  }
  function removePlace(place) {
    apply({places:selected.filter(item => item.key !== place.key)});
  }
  function toggleArea(area) {
    const place = resolvePlace('colonia', area);
    if (!place) return;
    if (selected.some(item => item.key === place.key)) removePlace(place);
    else addPlace(place);
  }
  function openLocation(event) {
    locationAnchor.current = event.currentTarget;
    setQuery('');
    setLocationOpen(open => !open);
  }
  function clearFilters() {
    apply({
      places:[], areas:[], area:'Ambas zonas', address:'', propertyType:'any', beds:1, baths:1, parking:0,
      minSize:0, maxSize:0, minLot:0, maxLot:0, criteria:[], tour3d:false, minBudget:0, note:'',
      budget:search.mode === 'rent' ? 28000 : 7500000,
    });
    setQuery('');
  }
  const count = prototypeResults(search).length;
  const chipLabel = id => id === 'pool' && !pt ? 'Alberca' : criterionLabel(id, language);
  const grouped = new Set([...POPULAR, ...GROUPS.flatMap(group => group[3])]);
  const leftover = CRITERIA.filter(item => !grouped.has(item.id)).map(item => item.id);
  const groups = [['popular', 'Populares', 'Populares', POPULAR], ...(more ? [...GROUPS, ...(leftover.length ? [['other', 'Outros', 'Otros', leftover]] : [])] : [])]
    .map(([id, br, es, ids]) => [id, say(br, es), ids.filter(value => CRITERIA.some(item => item.id === value))]);
  const criterionChip = id => <button type="button" key={id} aria-pressed={search.criteria?.includes(id) || false} onClick={() => toggleCriterion(id)}><CriterionIcon id={id}/>{chipLabel(id)}</button>;
  const locationSummary = selected.length ? selected.map(place => place.label).join(', ') : say('Buscar cidade, bairro ou rua', 'Buscar ciudad, colonia o calle');
  return <dialog className="all-filters-dialog" ref={dialog} aria-labelledby="all-filters-title" onCancel={event => {event.preventDefault(); if (locationOpen) {setLocationOpen(false);return;} onClose();}} onClick={event => {if (event.target === dialog.current) {const box = dialog.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();}}}>
    <header><div><h2 id="all-filters-title">{say('Todos os filtros', 'Todos los filtros')}</h2><p>{say('Sua busca se atualiza a cada alteração.', 'Tu búsqueda se actualiza con cada cambio.')}</p></div><button className="icon-button" onClick={onClose} aria-label={say('Fechar filtros', 'Cerrar filtros')}><Icon name="close"/></button></header>
    <div className="all-filters-body">
      <fieldset><legend>{say('Operação', 'Operación')}</legend><div className="all-filter-options">{OPERATIONS.map(([id, br, es]) => <button key={id} type="button" aria-pressed={search.mode === id} onClick={() => apply({mode:id, ...(id !== search.mode ? {minBudget:0, budget:id === 'buy' ? 7500000 : 28000} : {})})}>{say(br, es)}</button>)}</div></fieldset>
      <div className="location-filter all-filter-address">
        <span className="location-filter-label" id={labelId}>{say('Localização', 'Ubicación')}</span>
        <div className="location-filter-field">
          <button type="button" className="location-filter-control" ref={locationAnchor} aria-haspopup="dialog" aria-expanded={locationOpen} aria-labelledby={labelId} onClick={openLocation}>
            <Icon name="pin" size={18}/>
            <span className={selected.length ? '' : 'is-empty'}>{locationSummary}</span>
          </button>
        </div>
        <HomePopover open={locationOpen} anchor={locationAnchor.current} container={dialog.current} label={say('Localização', 'Ubicación')} kind="area" variant="area" onClose={() => setLocationOpen(false)}>
          <LocationSearch label={say('Buscar localização', 'Buscar ubicación')} placeholder={say('Bairro, rua, metrô, escola…', 'Colonia, calle, metro, escuela…')} clearLabel={say('Limpar localização', 'Borrar ubicación')} value={query} onChange={setQuery}/>
          <LocationMenu label={say('Localização', 'Ubicación')} places={locationChoices} selectedKeys={selected.map(place => place.key)} say={say} onChoose={chooseLocation} onRemove={removePlace} empty={query.trim().length >= 2 && !locationChoices.length ? say('Nenhum lugar encontrado. Tente outro nome.', 'No encontramos ese lugar. Prueba otro nombre.') : null}/>
        </HomePopover>
        {selected.length > 0 && <ul className="location-pills">{selected.map(place => <li className="location-pill" key={place.key}><span>{place.label}</span><button type="button" className="location-pill-remove" aria-label={`${say('Remover', 'Quitar')} ${place.label}`} onClick={() => removePlace(place)}><span aria-hidden="true">×</span></button></li>)}</ul>}
      </div>
      <fieldset><legend>{say('Tipo de imóvel', 'Tipo de inmueble')}</legend><div className="all-filter-options">{PROPERTY_TYPES.filter(([id]) => DIALOG_TYPES.includes(id)).map(([id, br, es]) => <button key={id} type="button" aria-pressed={(search.propertyType || 'apartment') === id} onClick={() => apply({propertyType:id})}>{say(br, es)}</button>)}</div></fieldset>
      <fieldset className="room-filters"><legend>{say('Cômodos e vaga', 'Espacios y estacionamiento')}</legend>
        <Stepper label={say('Quartos', 'Recámaras')} value={search.beds || 1} min={1} max={10} decrease={say('Reduzir quartos', 'Reducir recámaras')} increase={say('Aumentar quartos', 'Aumentar recámaras')} onChange={beds => apply({beds})}/>
        <Stepper label={say('Banheiros', 'Baños')} value={search.baths || 1} min={1} max={10} decrease={say('Reduzir banheiros', 'Reducir baños')} increase={say('Aumentar banheiros', 'Aumentar baños')} onChange={baths => apply({baths})}/>
        <Stepper label={say('Vagas', 'Estacionamientos')} value={search.parking || 0} min={0} max={6} decrease={say('Reduzir vagas', 'Reducir estacionamientos')} increase={say('Aumentar vagas', 'Aumentar estacionamientos')} onChange={parking => apply({parking})}/>
      </fieldset>
      <fieldset className="area-filters"><legend>{say('Área', 'Área')}</legend>
        <AreaRange title={say('Área construída', 'Área construida')} least={say('Mínima', 'Mínima')} most={say('Máxima', 'Máxima')} min={search.minSize || 0} max={search.maxSize || 0} ranges={BUILT_RANGES} minName={say('Área construída, mínima', 'Área construida, mínima')} maxName={say('Área construída, máxima', 'Área construida, máxima')} onChange={({min, max}) => apply({minSize:min, maxSize:max})}/>
        <AreaRange title={say('Área total', 'Área total')} note={say('Só filtra anúncios que publicam a área total.', 'Solo filtra anuncios que publican el área total.')} least={say('Mínima', 'Mínima')} most={say('Máxima', 'Máxima')} min={search.minLot || 0} max={search.maxLot || 0} ranges={LOT_RANGES} minName={say('Área total, mínima', 'Área total, mínima')} maxName={say('Área total, máxima', 'Área total, máxima')} onChange={({min, max}) => apply({minLot:min, maxLot:max})}/>
      </fieldset>
      <fieldset><legend>{say('Faixa de preço', 'Rango de precio')}</legend><BudgetPicker search={search} onChange={apply} say={say}/></fieldset>
      <label className="all-filter-switch"><span><strong>{say('Só com tour 3D', 'Solo con tour 3D')}</strong><small>{say('Empreendimentos que você percorre em 3D, unidade por unidade.', 'Desarrollos que recorres en 3D, unidad por unidad.')}</small></span><input type="checkbox" role="switch" checked={search.tour3d === true} onChange={event => apply({tour3d:event.target.checked})}/></label>
      <fieldset className="characteristic-filters"><legend>{say('Características', 'Características')}</legend>
        {groups.map(([id, title, ids]) => <div className="characteristic-group" key={id}><h3>{title}</h3><div className="all-filter-options">{ids.map(criterionChip)}</div></div>)}
        <button type="button" className="characteristic-more" aria-expanded={more} onClick={() => setMore(open => !open)}>{more ? say('Ver menos', 'Ver menos') : say('Ver mais', 'Ver más')}</button>
      </fieldset>
      <fieldset className="neighborhood-filters"><legend>{say('Bairros', 'Barrios')}</legend><p>{say('Sem seleção: toda a Cidade do México.', 'Sin selección: toda Ciudad de México.')}</p><div className="all-filter-options">{areas.filter(area => area !== 'Ambas zonas').map(area => <button key={area} type="button" aria-pressed={selected.some(place => place.kind === 'colonia' && place.id === area)} onClick={() => toggleArea(area)}>{area}</button>)}</div></fieldset>
      <button className="all-filter-natural" onClick={() => {onClose(); onSmartInput();}}><img src="/assets/mini-listing/mora.svg" alt=""/>{say('Não encontrou um filtro? Descreva o que procura.', '¿No encuentras un filtro? Describe lo que buscas.')}<Icon name="arrow"/></button>
    </div>
    <footer>
      <button type="button" className="all-filters-clear" onClick={clearFilters}>{say('Limpar filtros', 'Limpiar filtros')}</button>
      <button type="button" className="all-filters-see" onClick={onClose}>{say(`Ver ${count} imóveis`, `Ver ${count} inmuebles`)}</button>
    </footer>
  </dialog>;
}
