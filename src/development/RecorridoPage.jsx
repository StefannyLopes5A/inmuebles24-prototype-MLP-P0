import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {useLanguage} from '../i18n';
import {Glyph} from '../MoraInsight.jsx';
import {VisitPicker, intentionLong} from '../ListingPanel.jsx';
import {contactValidation, createContactReceipt, normalizeContactProfile} from '../contactFlow.js';
import {DevelopmentScene} from './scene.js';
import {RecorridoBar} from './RecorridoShell.jsx';
import {RIcon, RecorridoPanel, StatusPill, formatMoney, statusLabel} from './RecorridoPanel.jsx';
import {DEVELOPER, DEVELOPMENT, GALLERY, UNITS, unitById} from './torreOlmo.js';
import {residentialFloors} from './buildingConfig.js';
import {DEFAULT_FILTERS, filtersActive, moraAnswer, moraIntent, unitMatches} from './units.js';

const DESKTOP = '(min-width:1280px)';
const PANEL = 420, GAP = 16, SPINE = 64;
const LABEL_KINDS = new Set(['transport', 'green', 'education', 'health']);
const ease = [0.23, 1, 0.32, 1];

function useMedia(query) {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query), update = () => setMatch(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return match;
}

const startHour = () => {
  const now = new Date();
  return Math.min(21, Math.max(6, now.getHours() + Math.round(now.getMinutes() / 15) / 4));
};
const clock = hour => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
const poiName = (poi, say) => poi.kind === 'transport' && !/metro|metr[oô]/i.test(poi.name) ? say(`Metrô ${poi.name}`, `Metro ${poi.name}`) : poi.name;
const meters = poi => Math.hypot(poi.x, poi.z);
const distance = value => value < 1000 ? `${Math.round(value / 10) * 10} m` : `${(value / 1000).toFixed(1)} km`;

export default function RecorridoPage({home, saved, onLike, onClose, onHome, profile, onProfile, onReceipt}) {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const reduce = useReducedMotion();
  const desktop = useMedia(DESKTOP);
  const viewportRef = useRef(null), coverRef = useRef(null), sceneRef = useRef(null), tooltipRef = useRef(null), compassRef = useRef(null);
  const [phase, setPhase] = useState('loading');
  const [slow, setSlow] = useState(false);
  const [city, setCity] = useState(null);
  const [view, setView] = useState('summary');
  const [unitId, setUnitId] = useState(null);
  const [mode, setMode] = useState('tower');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState('floor');
  const [hoverId, setHoverId] = useState(null);
  const [hoverFloor, setHoverFloor] = useState(null);
  const [tooltipId, setTooltipId] = useState(null);
  const [floorPick, setFloorPick] = useState(null);
  const [hour, setHour] = useState(startHour);
  const [timeOpen, setTimeOpen] = useState(false);
  const [planOnSlab, setPlanOnSlab] = useState(true);
  const [windowId, setWindowId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [contact, setContact] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [mora, setMora] = useState(null);
  const [pin, setPin] = useState(null);
  const [copied, setCopied] = useState(false);
  const unit = unitId ? unitById(unitId) : null;
  const live = desktop && phase !== 'failed';
  const ready = live && phase === 'ready';
  const handlers = useRef({});

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('is-recorrido', desktop);
    return () => document.documentElement.classList.remove('is-recorrido');
  }, [desktop]);

  // ----- Scene lifecycle --------------------------------------------------------------------------------
  useEffect(() => {
    if (!desktop || !viewportRef.current) return undefined;
    let model = false, town = false;
    const settle = () => { if (model && town) setPhase(current => current === 'failed' ? current : 'ready'); };
    setPhase('loading');
    const scene = new DevelopmentScene(viewportRef.current, {
      reducedMotion:matchMedia('(prefers-reduced-motion:reduce)').matches,
      onReady:() => { model = true; settle(); },
      onModelError:() => setPhase('failed'),
      onCityReady:data => { setCity(data); town = true; settle(); },
      onCityError:() => { town = true; settle(); },
      onHover:(hit, pointer) => handlers.current.hover?.(hit, pointer),
      onPick:hit => handlers.current.pick?.(hit),
      onCamera:({azimuth}) => { if (compassRef.current) compassRef.current.style.transform = `rotate(${azimuth}rad)`; },
    });
    sceneRef.current = scene;
    scene.setUnitStates(UNITS, null);
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => { clearTimeout(timer); scene.dispose(); sceneRef.current = null; };
  }, [desktop]);

  const offset = collapsed ? GAP + SPINE + GAP : GAP + PANEL + GAP;
  useEffect(() => {
    if (!ready) return undefined;
    const scene = sceneRef.current;
    scene.setPanelOffset(offset, false);
    const timer = setTimeout(() => scene.arrive(), reduce ? 0 : 240);
    return () => clearTimeout(timer);
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const offsetSeen = useRef(offset);
  useEffect(() => {
    if (!ready || offsetSeen.current === offset) return;
    offsetSeen.current = offset;
    sceneRef.current?.setPanelOffset(offset, true);
  }, [offset, ready]);

  useEffect(() => { sceneRef.current?.setTime(hour); }, [hour, phase]);
  useEffect(() => { sceneRef.current?.setPlanVisible(planOnSlab); }, [planOnSlab]);
  useEffect(() => { sceneRef.current?.setHover(hoverId ? unitById(hoverId) : null); }, [hoverId]);
  useEffect(() => { sceneRef.current?.setHoverFloor(hoverFloor); }, [hoverFloor]);
  useEffect(() => { sceneRef.current?.setSelected(unit); }, [unit]);
  const highlight = mora?.units || null;
  useEffect(() => {
    const matches = highlight ? new Set(highlight) : filtersActive(filters) ? unitMatches(filters) : null;
    sceneRef.current?.setUnitStates(UNITS, matches);
  }, [filters, highlight, phase]);

  const labels = useMemo(() => {
    if (!city || windowId) return [];
    const items = [];
    if (mode === 'city') for (const poi of city.pois) {
      if (!LABEL_KINDS.has(poi.kind) || meters(poi) > 900) continue;
      items.push({id:`poi-${poi.name}-${poi.x}`, text:`${poiName(poi, say)} · ${distance(meters(poi))}`, position:[poi.x, 14, poi.z], kind:poi.kind, highlighted:mora?.poi === poi.name});
    }
    if (pin) items.push(pin);
    return items;
  }, [city, mode, windowId, pin, mora, pt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!windowId) sceneRef.current?.setLabels(labels); }, [labels, windowId]);

  const windowLabels = target => (city?.pois || []).filter(poi => LABEL_KINDS.has(poi.kind) && meters(poi) < 1300 && (target.side === 0 ? poi.z < -40 : poi.z > 40))
    .map(poi => ({id:`win-${poi.name}-${poi.x}`, text:`${poiName(poi, say)} · ${distance(meters(poi))}`, position:[poi.x, 10, poi.z], kind:poi.kind}));

  // ----- Actions ----------------------------------------------------------------------------------------
  function selectUnit(id, {fly = true} = {}) {
    const next = unitById(id);
    if (!next) return;
    setPin(null);
    setUnitId(id);
    setView('unit');
    setFloorPick(null);
    if (!live || !fly) return;
    if (windowId) leaveWindow(false);
    if (mode === 'city') { setMode('tower'); sceneRef.current?.setMode('tower', next); }
    sceneRef.current?.focusUnit(next);
  }

  function changeMode(next) {
    if (next === 'plan' && !unit) return;
    if (windowId) setWindowId(null);
    setPin(null);
    setMode(next);
    sceneRef.current?.setMode(next, unit);
  }

  function changeView(next) {
    setView(next);
    if (next !== 'unit') {
      setUnitId(null);
      if (mode === 'plan') changeMode('tower');
    }
    if (next === 'summary') setFloorPick(null);
  }

  function openWindow(target) {
    if (!live || !target) return;
    setPin(null);
    setTimeOpen(false);
    setWindowId(target.id);
    sceneRef.current?.enterWindowView(target, windowLabels(target));
  }

  function leaveWindow(flyBack = true) {
    setWindowId(null);
    setMode('tower');
    if (flyBack) sceneRef.current?.setMode('tower', unit);
    else sceneRef.current?.exitWindowView(false);
  }

  function showAmenity(item) {
    if (!live) return;
    if (windowId) leaveWindow(false);
    if (mode !== 'tower') setMode('tower');
    const position = sceneRef.current?.flyToAnchor(item.anchor);
    if (position) setPin({id:`amenity-${item.id}`, text:say(item.name[0], item.name[1]), position, kind:'amenity', highlighted:true});
  }

  function ask(text) {
    const answer = moraAnswer(moraIntent(text), say, formatMoney);
    setMora(answer);
    if (!live) return;
    if (answer.intent === 'view' && mode === 'city') changeMode('tower');
    if (answer.intent === 'cheapest') selectUnit(answer.unit);
    if (answer.intent === 'kids') {
      const poi = city?.pois.find(item => item.name === answer.poi);
      if (windowId) setWindowId(null);
      setMode('city');
      if (poi) sceneRef.current?.showPoint([poi.x, poi.z]);
      else sceneRef.current?.setMode('city');
    }
  }

  function goBack() {
    const cover = coverRef.current;
    if (cover) cover.classList.add('is-returning');
    onClose();
  }

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); } catch { return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  handlers.current.hover = (hit, pointer) => {
    const id = hit?.id || null;
    if (id !== tooltipId) setTooltipId(id);
    if (id !== hoverId) setHoverId(id);
    const tip = tooltipRef.current;
    if (tip && pointer && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      tip.style.transform = `translate(${pointer.clientX - rect.left + 14}px, ${pointer.clientY - rect.top + 14}px)`;
    }
  };
  handlers.current.pick = hit => { if (hit) selectUnit(hit.id); };

  // Escape climbs one level: window view, Mora answer, Planta, the unit, then nothing.
  const escape = useRef();
  escape.current = event => {
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (lightbox !== null) { setLightbox(null); }
    else if (timeOpen) setTimeOpen(false);
    else if (windowId) leaveWindow();
    else if (mora) setMora(null);
    else if (mode === 'plan') changeMode('tower');
    else if (view === 'unit') changeView('units');
    else if (floorPick) setFloorPick(null);
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  useEffect(() => {
    const listener = event => escape.current(event);
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, []);

  const tooltipUnit = tooltipId && !windowId ? unitById(tooltipId) : null;
  const windowUnit = windowId ? unitById(windowId) : null;
  const panel = <RecorridoPanel say={say} reduce={reduce} view={view} onView={changeView} unitId={unitId} onUnit={id => selectUnit(id)} onBack={goBack}
    saved={saved} onLike={() => onLike(home)} onShare={share} onVisit={() => setContact('visit')} onMessage={() => setContact('message')}
    collapsed={live && collapsed} onCollapse={() => setCollapsed(value => !value)} collapsible={live} modelFailed={!live}
    filters={filters} onFilters={next => { setFilters(next); setMora(null); }} sort={sort} onSort={setSort}
    hoverId={hoverId} onHoverUnit={setHoverId} floorPick={floorPick} onFloorPick={setFloorPick}
    onAmenity={showAmenity} onCityMode={() => changeMode('city')} onWindow={openWindow}
    planOnSlab={planOnSlab} onPlanOnSlab={setPlanOnSlab} onPhoto={setLightbox}/>;

  return <div className="recorrido-page" data-phase={phase} data-live={live || undefined} data-collapsed={live && collapsed || undefined} data-window={windowId ? true : undefined}>
    <RecorridoBar onHome={onHome}>
      <AnimatePresence>{copied && <motion.span className="recorrido-copied" role="status" initial={{opacity:0, y:-4}} animate={{opacity:1, y:0}} exit={{opacity:0}} transition={{duration:0.16, ease}}>{say('Link copiado', 'Enlace copiado')}</motion.span>}</AnimatePresence>
    </RecorridoBar>
    <div className="recorrido-stage">
      {desktop && <div className="recorrido-viewport" ref={viewportRef} aria-label={say('Modelo 3D da Torre Olmo e do bairro', 'Modelo 3D de Torre Olmo y su colonia')} role="img"/>}
      <img ref={coverRef} className="recorrido-cover" src={home.image} alt={say('Render da fachada da Torre Olmo', 'Render de la fachada de Torre Olmo')}/>
      {desktop && phase === 'loading' && slow && <p className="recorrido-loading" role="status">{say('Carregando a cidade…', 'Cargando la ciudad…')}</p>}
      {!desktop && <p className="recorrido-notice">{say('O tour 3D está disponível no computador', 'El recorrido 3D está disponible en escritorio')}</p>}
      {desktop && phase === 'failed' && <p className="recorrido-notice">{say('Não conseguimos carregar o modelo 3D. Mostramos as imagens do empreendimento.', 'No pudimos cargar el modelo 3D. Te mostramos las imágenes del desarrollo.')}</p>}

      {ready && <>
        <div className="recorrido-chrome">
          <div className="recorrido-modes" role="radiogroup" aria-label={say('Modo de visualização', 'Modo de vista')}>
            {[['city', say('Cidade', 'Ciudad')], ['tower', say('Torre', 'Torre')], ['plan', say('Planta', 'Planta')]].map(([id, label]) => {
              const disabled = id === 'plan' && !unit;
              return <button key={id} type="button" role="radio" aria-checked={mode === id && !windowId} aria-disabled={disabled || undefined}
                title={disabled ? say('Escolha uma unidade para ver a planta', 'Elige una unidad para ver su planta') : undefined}
                onClick={() => !disabled && changeMode(id)}>{mode === id && !windowId && <motion.span layoutId="recorrido-mode" className="recorrido-mode-thumb" transition={reduce ? {duration:0} : {type:'spring', duration:0.3, bounce:0}}/>}<span>{label}</span></button>;
            })}
          </div>
          <TimeControl hour={hour} setHour={setHour} open={timeOpen} setOpen={setTimeOpen} say={say} reduce={reduce}/>
          <button type="button" className="recorrido-round" onClick={() => sceneRef.current?.resetView()} aria-label={say('Recentralizar câmera', 'Recentrar cámara')} title={say('Recentralizar', 'Recentrar')}>
            <svg ref={compassRef} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l3 9h-6z" fill="#ff5500"/><path d="M12 21l-3-9h6z" fill="#b0b0b0"/></svg>
          </button>
        </div>
        {!windowId && <FloorRail say={say} hoverFloor={hoverFloor} onHover={setHoverFloor} selected={unit?.floor}
          onPick={floor => { setFloorPick(floor); setUnitId(null); setView('units'); if (mode === 'plan') changeMode('tower'); }}/>}
        {!windowId && <div className="recorrido-bottom">
          <ul className="recorrido-legend" aria-label={say('Legenda', 'Leyenda')}>
            {['available', 'reserved', 'sold'].map(status => <li key={status} className={`is-${status}`}><i aria-hidden="true"/>{statusLabel(status, say)}</li>)}
          </ul>
          <MoraField say={say} reduce={reduce} answer={mora} onAsk={ask} onClear={() => setMora(null)} onWindow={() => openWindow(unitById(mora?.view))}/>
        </div>}
        <div className="recorrido-tooltip" ref={tooltipRef} hidden={!tooltipUnit} aria-hidden="true">
          {tooltipUnit && <>
            <b>{say(`Unidade ${tooltipUnit.id}`, `Unidad ${tooltipUnit.id}`)}</b>
            <span>{say(`${tooltipUnit.beds} qto.`, `${tooltipUnit.beds} rec.`)} · {tooltipUnit.size} m²{tooltipUnit.status !== 'sold' ? ` · ${formatMoney(tooltipUnit.price)}` : ''}</span>
            <StatusPill status={tooltipUnit.status} say={say}/>
          </>}
        </div>
        <AnimatePresence>{windowUnit && <motion.div className="recorrido-window" initial={{opacity:0, y:reduce ? 0 : -6}} animate={{opacity:1, y:0}} exit={{opacity:0}} transition={{duration:0.2, ease, delay:reduce ? 0 : 0.8}}>
          <span>{say(`Vista do andar ${windowUnit.floor} · orientação ${windowUnit.side === 0 ? 'norte' : 'sul'}`, `Vista desde el piso ${windowUnit.floor} · orientación ${windowUnit.side === 0 ? 'norte' : 'sur'}`)}</span>
          <small>{say('Arraste para olhar ao redor', 'Arrastra para mirar alrededor')}</small>
          <button type="button" className="rp-secondary" onClick={() => leaveWindow()}>{say('Sair da vista', 'Salir de la vista')}</button>
        </motion.div>}</AnimatePresence>
      </>}
      {live && <p className="recorrido-credits">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        {' · '}{say('Modelo', 'Modelo')}: <a href={DEVELOPMENT.credit.url} target="_blank" rel="noreferrer">{DEVELOPMENT.credit.author}</a> (CC BY 4.0)
      </p>}
    </div>
    {panel}
    {lightbox !== null && <Lightbox item={lightbox} say={say} onChange={setLightbox} onClose={() => setLightbox(null)}/>}
    {contact && <ContactDialog kind={contact} unit={unit} home={home} profile={profile} onProfile={onProfile} onReceipt={onReceipt} say={say} language={language} reduce={reduce} onClose={() => setContact(null)}/>}
  </div>;
}

function TimeControl({hour, setHour, open, setOpen, say, reduce}) {
  const night = hour >= 19.5 || hour < 6.5;
  const shortcuts = [[9, say('Manhã', 'Mañana')], [13, say('Meio-dia', 'Mediodía')], [18.5, say('Pôr do sol', 'Atardecer')], [20.5, say('Noite', 'Noche')]];
  return <div className="recorrido-time">
    <button type="button" className="recorrido-pill" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={say(`Hora do dia: ${clock(hour)}`, `Hora del día: ${clock(hour)}`)}>
      {night ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg> : <Glyph name="outdoor"/>}
      <span>{clock(hour)}</span>
    </button>
    <AnimatePresence>{open && <motion.div className="recorrido-popover" initial={{opacity:0, scale:reduce ? 1 : 0.96, y:reduce ? 0 : -4}} animate={{opacity:1, scale:1, y:0}} exit={{opacity:0, scale:reduce ? 1 : 0.98}} transition={{duration:0.16, ease}} style={{transformOrigin:'top right'}}>
      <label className="recorrido-slider"><span>{say('Hora do dia', 'Hora del día')}</span>
        <input type="range" min="6" max="21" step="0.25" value={hour} onChange={event => setHour(Number(event.target.value))} aria-valuetext={clock(hour)}/>
        <span className="recorrido-slider-scale" aria-hidden="true"><span>06:00</span><span>21:00</span></span>
      </label>
      <div className="recorrido-shortcuts">{shortcuts.map(([value, label]) => <button key={value} type="button" className="rp-chip" aria-pressed={hour === value} onClick={() => setHour(value)}>{label}</button>)}</div>
      <p className="rp-muted">{say('Sol calculado para a Cidade do México, na data de hoje.', 'Sol calculado para la Ciudad de México, en la fecha de hoy.')}</p>
    </motion.div>}</AnimatePresence>
  </div>;
}

function FloorRail({say, hoverFloor, onHover, onPick, selected}) {
  const floors = [...residentialFloors].reverse();
  const scrubbing = useRef(false);
  const floorAt = event => Number(document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-floor]')?.dataset.floor) || null;
  const move = event => {
    const next = floorAt(event);
    if (next || !scrubbing.current) onHover(next);
  };
  const keys = event => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))]?.focus();
  };
  return <nav className="recorrido-rail" aria-label={say('Andares', 'Pisos')} onKeyDown={keys}
    onPointerDown={event => { scrubbing.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); }}
    onPointerMove={move}
    onPointerUp={event => { const floor = scrubbing.current ? floorAt(event) : null; scrubbing.current = false; if (floor) onPick(floor); }}
    onPointerLeave={() => { if (!scrubbing.current) onHover(null); }}>
    <ul>
      <li className="recorrido-rail-roof" aria-hidden="true">R</li>
      {floors.map(floor => {
        const units = UNITS.filter(item => item.floor === floor);
        return <li key={floor}><button type="button" data-floor={floor} data-hovered={hoverFloor === floor || undefined} aria-current={selected === floor || undefined}
          onFocus={() => onHover(floor)} onBlur={() => onHover(null)} onClick={event => { if (event.detail === 0) onPick(floor); }}
          aria-label={say(`Andar ${floor}: ${units.map(item => `${item.id} ${statusLabel(item.status, say)}`).join(', ')}`, `Piso ${floor}: ${units.map(item => `${item.id} ${statusLabel(item.status, say)}`).join(', ')}`)}>
          <span>{floor}</span><span className="recorrido-rail-dots" aria-hidden="true">{units.map(item => <i key={item.id} className={`is-${item.status}`}/>)}</span>
        </button></li>;
      })}
      <li className="recorrido-rail-roof" aria-hidden="true">1</li>
    </ul>
  </nav>;
}

function MoraField({say, reduce, answer, onAsk, onClear, onWindow}) {
  const [text, setText] = useState(''), [focused, setFocused] = useState(false);
  const seen = useRef(false);
  const suggestions = [say('Qual unidade tem a melhor vista?', '¿Qué unidad tiene mejor vista?'), say('Qual é a mais barata por m²?', '¿Cuál es la más barata por m²?'), say('O que há perto para crianças?', '¿Qué hay cerca para niños?')];
  const showChips = focused && !answer;
  const stagger = !seen.current && !reduce;
  useEffect(() => { if (showChips) { const timer = setTimeout(() => { seen.current = true; }, 400); return () => clearTimeout(timer); } return undefined; }, [showChips]);
  const submit = value => { const question = value.trim(); if (!question) return; onAsk(question); setText(''); };
  return <div className="recorrido-mora" onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <AnimatePresence mode="popLayout">
      {answer && <motion.div key={answer.text} className="recorrido-mora-answer" role="status" initial={{opacity:0, y:reduce ? 0 : 6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:reduce ? 0 : 4}} transition={{duration:0.2, ease}}>
        <img src="/assets/mini-listing/mora.svg" alt="" width="20" height="20" className="recorrido-mora-mark"/>
        <p>{answer.text}</p>
        <div className="recorrido-mora-actions">
          {answer.view && <button type="button" className="rp-secondary" onClick={onWindow}><Glyph name="view"/>{say(`Ver a vista da ${answer.view}`, `Ver la vista desde la ${answer.view}`)}</button>}
          <button type="button" className="rp-icon is-small" aria-label={say('Fechar resposta', 'Cerrar respuesta')} onClick={onClear}><RIcon name="close" size={14}/></button>
        </div>
      </motion.div>}
      {showChips && <motion.ul key="chips" className="recorrido-mora-chips" initial="hidden" animate="shown" exit={{opacity:0, transition:{duration:0.12}}}
        variants={{hidden:{}, shown:{transition:{staggerChildren:stagger ? 0.05 : 0}}}}>
        {suggestions.map(item => <motion.li key={item} variants={{hidden:{opacity:0, y:stagger ? 4 : 0}, shown:{opacity:1, y:0, transition:{duration:0.18, ease}}}}>
          <button type="button" className="rp-chip" onClick={() => submit(item)}>{item}</button>
        </motion.li>)}
      </motion.ul>}
    </AnimatePresence>
    <form className="recorrido-mora-field" onSubmit={event => { event.preventDefault(); submit(text); }}>
      <img src="/assets/mini-listing/mora.svg" alt="" width="18" height="18" className="recorrido-mora-mark"/>
      <input value={text} onChange={event => setText(event.target.value)} placeholder={say('Pergunte à Mora sobre este empreendimento', 'Pregúntale a Mora sobre este desarrollo')} aria-label={say('Pergunte à Mora sobre este empreendimento', 'Pregúntale a Mora sobre este desarrollo')}/>
      <button type="submit" className="recorrido-mora-send" aria-label={say('Enviar', 'Enviar')} disabled={!text.trim()}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>
    </form>
  </div>;
}

function Lightbox({item, say, onChange, onClose}) {
  const ref = useRef(null);
  const index = typeof item === 'number' ? item : null;
  const photo = index !== null ? {src:GALLERY[index].src, alt:say(GALLERY[index].alt[0], GALLERY[index].alt[1])} : item;
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal?.();
    return () => dialog?.close?.();
  }, []);
  const step = delta => onChange((index + delta + GALLERY.length) % GALLERY.length);
  return <dialog ref={ref} className="recorrido-lightbox" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => { if (index === null) return; if (event.key === 'ArrowRight') step(1); if (event.key === 'ArrowLeft') step(-1); }} aria-label={photo.alt}>
    <img src={photo.src} alt={photo.alt}/>
    <button type="button" className="recorrido-round recorrido-lightbox-close" onClick={onClose} aria-label={say('Fechar', 'Cerrar')} autoFocus><RIcon name="close"/></button>
    {index !== null && <>
      <button type="button" className="recorrido-round is-prev" onClick={() => step(-1)} aria-label={say('Imagem anterior', 'Imagen anterior')}><RIcon name="back"/></button>
      <button type="button" className="recorrido-round is-next" onClick={() => step(1)} aria-label={say('Próxima imagem', 'Imagen siguiente')}><RIcon name="back"/></button>
      <p className="recorrido-lightbox-count">{index + 1} / {GALLERY.length} · {say('Render', 'Render')}</p>
    </>}
  </dialog>;
}

/** Simulated hand-off: a visit intention or a message, kept as a local receipt. Nothing leaves the browser. */
function ContactDialog({kind, unit, home, profile, onProfile, onReceipt, say, language, reduce, onClose}) {
  const ref = useRef(null);
  const subject = unit ? say(`a unidade ${unit.id} da ${DEVELOPMENT.name}`, `la unidad ${unit.id} de ${DEVELOPMENT.name}`) : DEVELOPMENT.name;
  const [step, setStep] = useState(kind === 'visit' ? 'pick' : 'message');
  const [slot, setSlot] = useState(null);
  const [message, setMessage] = useState(() => say(`Olá, tenho interesse em ${subject}, em ${DEVELOPMENT.area}. Podem me enviar o calendário de pagamentos e a disponibilidade?`, `Hola, me interesa ${subject}, en ${DEVELOPMENT.area}. ¿Me pueden compartir el calendario de pagos y la disponibilidad?`));
  const [draft, setDraft] = useState(() => normalizeContactProfile(profile));
  const [errors, setErrors] = useState({});
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal?.();
    return () => dialog?.close?.();
  }, []);
  const known = !Object.keys(contactValidation({profile:draft, channel:'whatsapp', message:'xxxxxxxxxxxx'})).length;
  const visitText = target => say(`Olá, quero visitar ${subject} ${intentionLong(target, language, say)}. O horário fica com vocês.`, `Hola, quiero visitar ${subject} ${intentionLong(target, language, say)}. El horario lo definen ustedes.`);
  function send(text, data = draft) {
    const found = contactValidation({profile:data, channel:'whatsapp', message:text});
    if (Object.keys(found).length) { setErrors(found); setStep('who'); return; }
    const receipt = createContactReceipt({home, broker:{name:DEVELOPER.name, verified:true, logo:DEVELOPER.logo}, intent:kind, channel:'whatsapp', message:text, profile:data});
    onProfile?.({...normalizeContactProfile(profile), name:data.name, phone:data.phone});
    onReceipt?.(receipt);
    setStep('sent');
  }
  const body = () => {
    if (step === 'pick') return <VisitPicker active reduce={reduce} copy={{say, language}} onPick={picked => { setSlot(picked); if (known) send(visitText(picked)); else setStep('who'); }}/>;
    if (step === 'message') return <form className="rp-form" onSubmit={event => { event.preventDefault(); if (known) send(message); else setStep('who'); }}>
      <label><span>{say('Mensagem', 'Mensaje')}</span><textarea rows="5" value={message} onChange={event => setMessage(event.target.value)}/></label>
      <button type="submit" className="rp-primary">{say('Continuar', 'Continuar')}</button>
    </form>;
    if (step === 'who') return <form className="rp-form" onSubmit={event => { event.preventDefault(); send(kind === 'visit' ? visitText(slot) : message); }}>
      <label><span>{say('Seu nome', 'Tu nombre')}</span><input value={draft.name} autoComplete="name" aria-invalid={errors.name ? true : undefined} onChange={event => setDraft({...draft, name:event.target.value})}/></label>
      <label><span>WhatsApp</span><input value={draft.phone} inputMode="tel" autoComplete="tel" placeholder="+52 55 0000 0000" aria-invalid={errors.phone ? true : undefined} onChange={event => setDraft({...draft, phone:event.target.value})}/></label>
      {(errors.name || errors.phone) && <p className="rp-error" role="alert">{errors.name ? say('Escreva seu nome.', 'Escribe tu nombre.') : say('Use o formato internacional, começando com +.', 'Usa el formato internacional, empezando con +.')}</p>}
      <button type="submit" className="rp-primary">{kind === 'visit' ? say('Pedir visita', 'Pedir visita') : say('Enviar mensagem', 'Enviar mensaje')}</button>
    </form>;
    return <div className="rp-sent" role="status">
      <span className="rp-sent-mark"><RIcon name="check" size={22}/></span>
      <p><b>{kind === 'visit' ? say('Pedido de visita registrado', 'Solicitud de visita registrada') : say('Mensagem registrada', 'Mensaje registrado')}</b></p>
      <p>{kind === 'visit' && slot ? say(`${DEVELOPER.name} propõe o horário para ${intentionLong(slot, language, say)} pelo WhatsApp.`, `${DEVELOPER.name} te propone el horario para ${intentionLong(slot, language, say)} por WhatsApp.`) : say(`${DEVELOPER.name} responde pelo WhatsApp.`, `${DEVELOPER.name} te responde por WhatsApp.`)}</p>
      <p className="rp-muted">{say('Contato simulado: nada foi enviado.', 'Contacto simulado: no se envió nada.')}</p>
      <button type="button" className="rp-primary" onClick={onClose}>{say('Fechar', 'Cerrar')}</button>
    </div>;
  };
  return <dialog ref={ref} className="recorrido-dialog" onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="recorrido-dialog-title">
    <header>
      <h2 id="recorrido-dialog-title">{kind === 'visit' ? (unit ? say(`Agendar visita à ${unit.id}`, `Agendar visita a la ${unit.id}`) : say('Agendar visita', 'Agendar visita')) : say('Falar com a incorporadora', 'Hablar con la desarrolladora')}</h2>
      <button type="button" className="rp-icon is-small" onClick={onClose} aria-label={say('Fechar', 'Cerrar')}><RIcon name="close" size={16}/></button>
    </header>
    <p className="rp-muted">{DEVELOPER.name} · {DEVELOPMENT.name}, {DEVELOPMENT.area}</p>
    <div className="recorrido-dialog-body">{body()}</div>
  </dialog>;
}
