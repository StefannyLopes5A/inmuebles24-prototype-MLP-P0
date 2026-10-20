import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {useLanguage} from '../i18n';
import {Glyph} from '../MoraInsight.jsx';
import {MORA_THINK_MS} from '../moraChat.jsx';
import {GalleryIndex} from '../ListingGallery.jsx';
import {canMorph, listingCoverSrc, morphGallery, visible, whenHeroSettled} from '../heroMorph';
import {DevelopmentScene} from './scene.js';
import {RIcon, RecorridoPanel, StatusPill, formatMoney, statusLabel} from './RecorridoPanel.jsx';
import {DEVELOPMENT, UNITS, available, developmentGallery, unitAsHome, unitById, unitHomeId} from './torreOlmo.js';
import {residentialFloors} from './buildingConfig.js';
import {KIND_CATEGORY, POI_CATEGORY, poiIconUrl} from '../poiCategories.js';
import {DEFAULT_FILTERS, filtersActive, moraAnswer, moraIntent, unitMatches} from './units.js';

const DESKTOP = '(min-width:1280px)';
const LABEL_KINDS = new Set(['transport', 'green', 'education', 'health']);
const ease = [0.23, 1, 0.32, 1];
const COVER_HOLD_MS = 160;

function useMedia(query) {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query), update = () => setMatch(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return match;
}

const clock = hour => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`;
const periodOf = (hour, say) => (hour < 12 ? say('Manhã', 'Mañana') : hour < 18.5 ? say('Tarde', 'Tarde') : say('Noite', 'Noche'));
const poiName = (poi, say) => poi.kind === 'transport' && !/metro|metr[oô]/i.test(poi.name) ? say(`Metrô ${poi.name}`, `Metro ${poi.name}`) : poi.name;
const meters = poi => Math.hypot(poi.x, poi.z);
const distance = value => value < 1000 ? `${Math.round(value / 10) * 10} m` : `${(value / 1000).toFixed(1)} km`;
// Same Maki glyph and colour as the search map's pins: icon, then the name, then the distance.
const poiTag = (poi, say) => {
  const category = POI_CATEGORY[KIND_CATEGORY[poi.kind]];
  return {text:poiName(poi, say), meta:distance(meters(poi)), ...(category && {icon:poiIconUrl(category.id), color:category.color, ink:category.ink})};
};

const unitFromUrl = () => {
  try { return unitById(new URLSearchParams(window.location.search).get('unit'))?.id || null; } catch { return null; }
};

export default function RecorridoPage({home, savedIds = [], initialUnitId, onLike, onShare, onClose}) {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const reduce = useReducedMotion();
  const desktop = useMedia(DESKTOP);
  const viewportRef = useRef(null), coverRef = useRef(null), sceneRef = useRef(null), tooltipRef = useRef(null), compassRef = useRef(null);
  const [coverSrc] = useState(() => listingCoverSrc() || home.image);
  const [landed, setLanded] = useState(() => !listingCoverSrc());
  const [phase, setPhase] = useState('loading');
  const [reveal, setReveal] = useState(false);
  const [presented, setPresented] = useState(false);
  const [slow, setSlow] = useState(false);
  const [city, setCity] = useState(null);
  const [view, setView] = useState(() => (unitById(initialUnitId)?.id || unitFromUrl()) ? 'units' : 'summary');
  const [unitId, setUnitId] = useState(() => unitById(initialUnitId)?.id || unitFromUrl());
  const [unitOrigin, setUnitOrigin] = useState(null);
  const [morphId, setMorphId] = useState(null);
  const [mode, setMode] = useState('tower');
  const [cityPins, setCityPins] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState('floor');
  const [hoverId, setHoverId] = useState(null);
  const [hoverFloor, setHoverFloor] = useState(null);
  const [tooltipId, setTooltipId] = useState(null);
  const [hour, setHour] = useState(12);
  const [windowId, setWindowId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [chat, setChat] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [photos, setPhotos] = useState(null);
  const photoTrigger = useRef(null);
  const gallery = useMemo(() => developmentGallery(home), [home]);
  const [spotlight, setSpotlight] = useState(null);
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
    let cancel = false;
    whenHeroSettled().then(() => { if (!cancel) setLanded(true); });
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!desktop || !landed || !viewportRef.current) return undefined;
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
      onCamera:({azimuth, cityPins:pins}) => {
        if (compassRef.current) compassRef.current.style.transform = `rotate(${azimuth}rad)`;
        if (pins != null) handlers.current.cityPins?.(pins);
      },
    });
    sceneRef.current = scene;
    scene.setUnitStates(UNITS, null);
    const timer = setTimeout(() => setSlow(true), 2500);
    return () => { clearTimeout(timer); scene.dispose(); sceneRef.current = null; };
  }, [desktop, landed]);

  // The photo stays until the morph has landed and held. The city mounts only after that.
  // The dissolve and the approach start together; the panels come in over the frame where the tower lands.
  useEffect(() => {
    if (!ready) return undefined;
    let cancel = false;
    let timer = 0;
    whenHeroSettled().then(() => {
      if (cancel) return;
      timer = setTimeout(() => {
        if (cancel) return;
        setReveal(true);
        const scene = sceneRef.current;
        if (!scene) { setPresented(true); return; }
        scene.arrive(() => { if (!cancel) setPresented(true); });
      }, reduce ? 0 : COVER_HOLD_MS);
    });
    return () => { cancel = true; clearTimeout(timer); };
  }, [ready, reduce]);

  useEffect(() => { sceneRef.current?.setTime(hour); }, [hour, phase]);
  useEffect(() => { sceneRef.current?.setHover(hoverId ? unitById(hoverId) : null); }, [hoverId]);
  useEffect(() => { sceneRef.current?.setHoverFloor(hoverFloor); }, [hoverFloor]);
  useEffect(() => { sceneRef.current?.setSelected(unit); }, [unit]);
  const highlight = spotlight?.units || null;
  useEffect(() => {
    const matches = highlight ? new Set(highlight) : filtersActive(filters) ? unitMatches(filters) : null;
    sceneRef.current?.setUnitStates(UNITS, matches);
  }, [filters, highlight, phase]);

  const labels = useMemo(() => {
    if (!city || windowId) return [];
    const items = [];
    if (mode === 'city' || (mode === 'tower' && cityPins)) for (const poi of city.pois) {
      if (!LABEL_KINDS.has(poi.kind) || meters(poi) > 900) continue;
      items.push({id:`poi-${poi.name}-${poi.x}`, ...poiTag(poi, say), position:[poi.x, 14, poi.z], kind:poi.kind, highlighted:spotlight?.poi === poi.name});
    }
    if (pin) items.push(pin);
    return items;
  }, [city, mode, cityPins, windowId, pin, spotlight, pt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!windowId) sceneRef.current?.setLabels(labels); }, [labels, windowId]);
  handlers.current.cityPins = pins => { if (pins !== cityPins) setCityPins(pins); };

  const windowLabels = target => (city?.pois || []).filter(poi => LABEL_KINDS.has(poi.kind) && meters(poi) < 1300 && (target.side === 0 ? poi.z < -40 : poi.z > 40))
    .map(poi => ({id:`win-${poi.name}-${poi.x}`, ...poiTag(poi, say), position:[poi.x, 10, poi.z], kind:poi.kind}));

  // ----- Actions ----------------------------------------------------------------------------------------
  function selectUnit(id, {fly = true, origin = null} = {}) {
    const next = unitById(id);
    if (!next) return;
    setPin(null);
    if (origin) {
      setUnitOrigin(origin);
      setMorphId(id);
    } else if (!unitId) {
      setUnitOrigin(null);
      setMorphId(null);
    }
    setUnitId(id);
    setView(current => current === 'summary' ? 'units' : current);
    setCollapsed(false);
    if (!live || !fly) return;
    if (windowId) leaveWindow(false);
    if (mode === 'city') { setMode('tower'); sceneRef.current?.setMode('tower', next); }
    sceneRef.current?.focusUnit(next);
  }

  function closeUnit() {
    const returnHome = mode !== 'city' && (unitId || windowId || mode === 'plan');
    setUnitId(null);
    setPin(null);
    if (windowId) setWindowId(null);
    if (mode === 'plan') setMode('tower');
    if (!returnHome) return;
    if (filters.floor) sceneRef.current?.focusFloor(filters.floor);
    else sceneRef.current?.goTowerHome();
  }

  /** Rail and the floor filter share one camera: the chosen floor opens, null gives the whole tower back. */
  function chooseFloor(floor, base = filters) {
    setFilters({...base, floor});
    setView('units');
    setUnitId(null);
    setPin(null);
    if (windowId) setWindowId(null);
    if (mode !== 'tower') setMode('tower');
    if (!live) return;
    if (floor) sceneRef.current?.focusFloor(floor);
    else sceneRef.current?.goTowerHome();
  }

  function changeMode(next) {
    if (next === 'plan' && !unit) return;
    if (windowId) setWindowId(null);
    setPin(null);
    setMode(next);
    sceneRef.current?.setMode(next, unit);
  }

  function changeView(next) {
    setView(next === 'unit' ? 'units' : next);
    if (next === 'summary') closeUnit();
  }

  function openWindow(target) {
    if (!live || !target) return;
    setPin(null);
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

  // ----- Chat ---------------------------------------------------------------------------------------------
  function openChat(options = {}) {
    setCollapsed(false);
    setChat({at:Date.now(), unitId:unit?.id || null, ...options});
  }

  function closeChat() {
    setChat(null);
    setSpotlight(null);
  }

  /**
   * The tour's own questions: answered from the inventory, and the scene moves when Mora's reply lands. Anything else
   * returns null and goes the mini-listing's way (visit, or the card that sends the question to the developer).
   */
  function answerTour(text) {
    const intent = moraIntent(text);
    if (intent === 'free') return null;
    const answer = moraAnswer(intent, say, formatMoney);
    setTimeout(() => handlers.current.tour?.(answer), reduce ? 0 : MORA_THINK_MS);
    const target = live && answer.view ? unitById(answer.view) : null;
    const action = intent === 'view' && target
      ? {label:say(`Ver a vista da ${target.id}`, `Ver la vista desde la ${target.id}`), icon:<Glyph name="view"/>, run:() => handlers.current.window?.(target)}
      : intent === 'cheapest' && answer.unit
        ? {label:say(`Abrir a unidade ${answer.unit}`, `Abrir la unidad ${answer.unit}`), icon:<RIcon name="cube" size={16}/>, run:() => handlers.current.closeChat?.()}
        : null;
    return {reply:answer.text, think:say('Lendo o inventário…', 'Leyendo el inventario…'), ...(action && {action})};
  }
  handlers.current.tour = answer => {
    setSpotlight(answer);
    if (answer.intent === 'cheapest') selectUnit(answer.unit);
    if (!live) return;
    if (answer.intent === 'view' && mode === 'city') changeMode('tower');
    if (answer.intent === 'kids') {
      const poi = city?.pois.find(item => item.name === answer.poi);
      if (windowId) setWindowId(null);
      setMode('city');
      if (poi) sceneRef.current?.showPoint([poi.x, poi.z]);
      else sceneRef.current?.setMode('city');
    }
  };
  handlers.current.window = target => openWindow(target);
  handlers.current.closeChat = closeChat;

  function goBack() {
    const cover = coverRef.current;
    if (cover) cover.classList.add('is-returning');
    onClose();
  }

  async function share() {
    if (onShare) { onShare(unit ? unitAsHome(unit) : home); return; }
    const url = new URL(window.location.href);
    if (unitId) url.searchParams.set('unit', unitId);
    else url.searchParams.delete('unit');
    try { await navigator.clipboard.writeText(url.toString()); } catch { return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (unitId) url.searchParams.set('unit', unitId);
    else url.searchParams.delete('unit');
    if (url.href !== window.location.href) history.replaceState(history.state, '', url);
  }, [unitId]);

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
  handlers.current.pick = hit => { if (!hit) return; if (chat) closeChat(); selectUnit(hit.id); };

  function showPhotos(index, element) {
    photoTrigger.current = element || document.activeElement;
    const from = index ?? 0;
    const morph = canMorph() && visible(element);
    const update = () => flushSync(() => setPhotos({focus:index, from, morph}));
    if (!morph) { update(); return; }
    morphGallery(element, update, () => document.querySelector(`.pp-index [data-photo="${from}"]`), 'forward');
  }
  function hidePhotos() {
    const refocus = () => requestAnimationFrame(() => photoTrigger.current?.focus({preventScroll:true}));
    const source = photos && document.querySelector(`.pp-index [data-photo="${photos.from}"]`);
    if (!canMorph() || !visible(source)) { setPhotos(current => current && {...current, closing:true}); return; }
    morphGallery(source, () => { flushSync(() => setPhotos(null)); refocus(); },
      () => [...document.querySelectorAll(`[data-photo-index="${photos.from}"]`)].find(visible), 'back');
  }
  function openPhoto(photo, element) {
    if (photo && typeof photo === 'object') setLightbox(photo);
    else showPhotos(photo, element);
  }

  // Escape climbs one level. The photo index consumes its own (viewer, then the grid). Then the plan lightbox, window view, the chat, Planta, the unit.
  const escape = useRef();
  escape.current = event => {
    if (event.key !== 'Escape' || photos || document.querySelector('dialog[open]')) return;
    if (lightbox !== null) { setLightbox(null); }
    else if (windowId) leaveWindow();
    else if (chat) closeChat();
    else if (mode === 'plan') changeMode('tower');
    else if (unitId) closeUnit();
    else if (filters.floor) chooseFloor(null);
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
  const listingSaved = savedIds.includes(home.id);
  const unitSaved = unit ? savedIds.includes(unitHomeId(unit.id)) : false;
  const panel = <RecorridoPanel home={home} say={say} reduce={reduce} held={live && !presented} view={view} onView={changeView} unitId={unitId} origin={unitOrigin} morphId={morphId}
    onUnit={(id, origin) => selectUnit(id, {origin})} onBack={goBack} onCloseUnit={closeUnit}
    saved={unit ? unitSaved : listingSaved} onLike={() => onLike(unit ? unitAsHome(unit) : home)} onShare={share}
    chat={chat} onOpenChat={openChat} onCloseChat={closeChat} onTourAsk={answerTour}
    collapsed={live && collapsed} onCollapse={() => setCollapsed(value => !value)} collapsible={live} modelFailed={!live}
    filters={filters} onFilters={next => { if (next.floor !== filters.floor) chooseFloor(next.floor, next); else setFilters(next); setSpotlight(null); }} sort={sort} onSort={setSort}
    hoverId={hoverId} onHoverUnit={setHoverId}
    onAmenity={showAmenity} onCityMode={() => changeMode('city')} onWindow={openWindow} onLeaveWindow={() => leaveWindow()} windowId={windowId}
    mode={mode} onPlanMode={on => changeMode(on ? 'plan' : 'tower')} onPhoto={openPhoto}/>;

  return <div className="recorrido-page" data-phase={phase} data-live={live || undefined} data-reveal={reveal || undefined} data-presented={presented || undefined} data-collapsed={live && collapsed || undefined} data-window={windowId ? true : undefined}>
    <AnimatePresence>{copied && <motion.span className="recorrido-copied" role="status" initial={{opacity:0, y:-4}} animate={{opacity:1, y:0}} exit={{opacity:0}} transition={{duration:0.16, ease}}>{say('Link copiado', 'Enlace copiado')}</motion.span>}</AnimatePresence>
    <div className="recorrido-stage">
      {desktop && landed && <div className="recorrido-viewport" ref={viewportRef} aria-label={say('Modelo 3D da Torre Olmo e do bairro', 'Modelo 3D de Torre Olmo y su colonia')} role="img"/>}
      <img ref={coverRef} className="recorrido-cover" src={coverSrc} alt={say('Render da fachada da Torre Olmo', 'Render de la fachada de Torre Olmo')}/>
      {desktop && phase === 'loading' && slow && <p className="recorrido-loading" role="status">{say('Carregando a cidade…', 'Cargando la ciudad…')}</p>}
      {!desktop && <p className="recorrido-notice">{say('O tour 3D está disponível no computador', 'El recorrido 3D está disponible en escritorio')}</p>}
      {desktop && phase === 'failed' && <p className="recorrido-notice">{say('Não conseguimos carregar o modelo 3D. Mostramos as imagens do empreendimento.', 'No pudimos cargar el modelo 3D. Te mostramos las imágenes del desarrollo.')}</p>}

      {presented && <>
        <div className="recorrido-controls">
          <div className="recorrido-enter">
            <TimeControl hour={hour} setHour={setHour} say={say} compassRef={compassRef} onReset={() => sceneRef.current?.resetView()}/>
          </div>
          <div className="recorrido-enter">
            <div className="recorrido-modes" role="radiogroup" aria-label={say('Modo de visualização', 'Modo de vista')}>
              {[['city', say('Cidade', 'Ciudad')], ['tower', say('Torre', 'Torre')], ['plan', say('Planta', 'Planta')]].map(([id, label]) => {
                const disabled = id === 'plan' && !unit;
                return <button key={id} type="button" role="radio" aria-checked={mode === id && !windowId} aria-disabled={disabled || undefined}
                  title={disabled ? say('Escolha uma unidade para ver a planta', 'Elige una unidad para ver su planta') : undefined}
                  onClick={() => !disabled && changeMode(id)}><span>{label}</span></button>;
              })}
            </div>
          </div>
          <div className="recorrido-enter" hidden={!!windowId}>
            <FloorRail say={say} hoverFloor={hoverFloor} onHover={setHoverFloor} selected={unit?.floor || filters.floor}
              onPick={floor => chooseFloor(filters.floor === floor ? null : floor)}/>
          </div>
        </div>
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
        </motion.div>}</AnimatePresence>
      </>}
      {presented && <p className="recorrido-credits">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        {' · '}{say('Modelo', 'Modelo')}: <a href={DEVELOPMENT.credit.url} target="_blank" rel="noreferrer">{DEVELOPMENT.credit.author}</a> (CC BY 4.0)
      </p>}
    </div>
    {panel}
    {lightbox !== null && <Lightbox item={lightbox} say={say} onClose={() => setLightbox(null)}/>}
    {photos && <GalleryIndex home={home} gallery={gallery} focus={photos.focus} morph={photos.morph} closing={photos.closing} onClose={hidePhotos}
      onClosed={() => { setPhotos(null); requestAnimationFrame(() => photoTrigger.current?.focus({preventScroll:true})); }} say={say} language={language}/>}
  </div>;
}

function TimeControl({hour, setHour, say, compassRef, onReset}) {
  const period = periodOf(hour, say);
  const at = (hour - 6) / 15;
  return <div className="recorrido-time">
    <div className="recorrido-time-head">
      <span className="recorrido-clock">{clock(hour)}</span>
      <span className="recorrido-period">{period}</span>
      <button type="button" className="recorrido-compass" onClick={onReset} aria-label={say('Recentralizar câmera', 'Recentrar cámara')} title={say('Recentralizar', 'Recentrar')}>
        <svg ref={compassRef} width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l3 9h-6z" fill="#ff5500"/><path d="M12 21l-3-9h6z" fill="#b0b0b0"/></svg>
      </button>
    </div>
    <label className="recorrido-sun" style={{'--p':at}}>
      <span className="recorrido-sun-track" aria-hidden="true"/>
      <input type="range" min="6" max="21" step="0.25" value={hour}
        aria-label={say(`Hora do dia: ${clock(hour)}, ${period}`, `Hora del día: ${clock(hour)}, ${period}`)}
        aria-valuetext={clock(hour)} aria-describedby="recorrido-sun-note"
        onChange={event => setHour(Number(event.target.value))}/>
      <span className="recorrido-sun-knob" aria-hidden="true"/>
    </label>
    <p id="recorrido-sun-note" className="sr-only">{say('Sol calculado para a Cidade do México, na data de hoje.', 'Sol calculado para la Ciudad de México, en la fecha de hoy.')}</p>
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
    <div className="recorrido-rail-head">
      <p>{say('Andares', 'Pisos')}</p>
      <p className="recorrido-rail-key"><i aria-hidden="true"/>{say(`${available.length} disponíveis`, `${available.length} disponibles`)}</p>
    </div>
    <ul>
      {floors.map(floor => {
        const units = UNITS.filter(item => item.floor === floor).sort((a, b) => a.index - b.index);
        const open = units.some(item => item.status === 'available');
        return <li key={floor}><button type="button" data-floor={floor} data-empty={!open || undefined} data-hovered={hoverFloor === floor || undefined} aria-current={selected === floor || undefined}
          onFocus={() => onHover(floor)} onBlur={() => onHover(null)} onClick={event => { if (event.detail === 0) onPick(floor); }}
          aria-label={say(`Andar ${floor}: ${units.map(item => `${item.id} ${statusLabel(item.status, say)}`).join(', ')}`, `Piso ${floor}: ${units.map(item => `${item.id} ${statusLabel(item.status, say)}`).join(', ')}`)}>
          <b>{floor}</b>
          <span className="recorrido-rail-bars" aria-hidden="true">{units.map(item => <i key={item.id} className={item.status === 'available' ? 'is-available' : undefined}/>)}</span>
        </button></li>;
      })}
    </ul>
  </nav>;
}

function Lightbox({item, say, onClose}) {
  const ref = useRef(null);
  const plan = typeof item?.src === 'string' && item.src.includes('/plans/');
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal?.();
    return () => dialog?.close?.();
  }, []);
  return <dialog ref={ref} className={`recorrido-lightbox${plan ? ' is-plan' : ''}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-label={item.alt}>
    <img src={item.src} alt={item.alt}/>
    <button type="button" className="recorrido-round recorrido-lightbox-close" onClick={onClose} aria-label={say('Fechar', 'Cerrar')} autoFocus><RIcon name="close"/></button>
  </dialog>;
}
