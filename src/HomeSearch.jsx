import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {areas, homes} from './data';
import {useLanguage, DEMO_MXN_PER_USD} from './i18n';
import {PROPERTY_TYPES, OPERATIONS, hasChosenLocation, priceDistribution, parseBudgetAmount} from './homeSearchModel.js';
import {PriceHistogram} from './PriceHistogram';
import {playMenu, playSelection} from './homeMotion.js';
import {LocationField} from './LocationField.jsx';

export const homeAsset = name => `/assets/home-evolution/${name}.svg`;
// Retain only an inert visual snapshot during exit; focus and search state move immediately.
export function HomePopover({open, animate=true, ...props}) {
  const lastOpen = useRef(null);
  const [present, setPresent] = useState(false);
  useLayoutEffect(() => {if (open) lastOpen.current = props;});
  useLayoutEffect(() => {
    if (open) {setPresent(true);return;}
    if (!animate || matchMedia('(prefers-reduced-motion:reduce)').matches) {setPresent(false);return;}
    const timer = setTimeout(() => setPresent(false), 360);
    return () => clearTimeout(timer);
  }, [open, animate]);
  if (!open && (!present || !lastOpen.current)) return null;
  const visible = open ? props : lastOpen.current;
  return <HomePopoverSurface key={visible.variant || visible.kind || 'list'} {...visible} open={open} animate={animate}/>;
}

/** `fit` opens the panel with the same width and left edge as its field (the filter deck's location fields). */
function HomePopoverSurface({open, animate, anchor, label, kind='list', variant=kind, onClose, container, fit=false, children}) {
  const panel = useRef(null);
  const closing = useRef(false);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    closing.current = false;
    const place = () => {
      if (!anchor || !panel.current) return;
      const box = anchor.getBoundingClientRect();
      const el = panel.current;
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      const offset = viewport?.offsetTop || 0;
      const top = Math.max(offset + 12, Math.min(box.bottom + 10, offset + height - Math.min(el.scrollHeight, 260) - 12));
      el.style.maxWidth = `${width - 24}px`;
      const designHeight = variant === 'propertyType' ? 644 : kind === 'area' ? 592 : Infinity;
      el.style.maxHeight = `${Math.max(120, Math.min(designHeight, height + offset - top - 12))}px`;
      if (fit) {el.style.width = `${Math.min(box.width, width - 24)}px`; el.style.minWidth = '0';}
      const left = fit ? Math.max(12, Math.min(box.left, width - el.offsetWidth - 12)) : Math.max(12, Math.min(box.left - 26, width - el.offsetWidth - 12));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.transformOrigin = `${Math.max(24, Math.min(box.left + box.width / 2 - left, el.offsetWidth - 24))}px ${Math.max(0, Math.min(box.bottom - top, el.offsetHeight))}px`;
    };
    place();
    const trackingStart = performance.now();
    let trackingFrame;
    const followAnchor = () => {place();if (performance.now() - trackingStart < 600) trackingFrame = requestAnimationFrame(followAnchor);};
    if (anchor?.closest('.mora-bar')) trackingFrame = requestAnimationFrame(followAnchor);
    panel.current.querySelectorAll('[data-picked]').forEach(el => delete el.dataset.picked);
    const focus = panel.current.querySelector('[data-initial-focus], [aria-selected="true"], button:not(:disabled)');
    if (focus?.tagName !== 'INPUT' || matchMedia('(pointer:fine)').matches) focus?.focus({preventScroll:true});
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {cancelAnimationFrame(trackingFrame);window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place);};
  }, [open, anchor, kind, variant, fit]);
  useLayoutEffect(() => playMenu(panel.current, open, animate, anchor), [open, animate, anchor]);
  useLayoutEffect(() => {
    if (!open) return;
    const dismiss = event => {
      if (!closing.current && panel.current && !panel.current.contains(event.target) && !anchor?.contains(event.target)) {
        closing.current = true;
        onClose(false, event.type === 'pointerdown');
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {document.removeEventListener('pointerdown', dismiss); document.removeEventListener('focusin', dismiss);};
  }, [open, anchor, onClose]);
  function keydown(event) {
    if (event.key === 'Escape') {event.preventDefault(); onClose(true, false); return;}
    const items = [...panel.current.querySelectorAll('[role="option"]')];
    if (items.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !(event.target.tagName === 'INPUT' && ['Home', 'End'].includes(event.key))) {
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0 ? (event.key === 'ArrowUp' ? items.length - 1 : 0) : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      items[next]?.focus({preventScroll:true}); items[next]?.scrollIntoView({block:'nearest'});
    }
    if (event.key === 'Tab') {
      const inner = [...panel.current.querySelectorAll('button:not(:disabled),input')];
      const index = inner.indexOf(document.activeElement);
      if (kind === 'list' || event.shiftKey && index <= 0 || !event.shiftKey && index === inner.length - 1) {
        event.preventDefault();
        const controls = [...document.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[contenteditable="true"]')].filter(el => !panel.current.contains(el) && el.getClientRects().length && !el.closest('[inert]'));
        const next = controls[controls.indexOf(anchor) + (event.shiftKey ? -1 : 1)];
        onClose(false, false); next?.focus();
      }
    }
  }
  return createPortal(<div ref={panel} id={id} className={`home-popover home-popover-${kind} home-popover-variant-${variant}`} data-open={open} data-mora-popover={anchor?.closest('.mora-bar') ? true : undefined} data-motion={animate} inert={!open} aria-hidden={!open || undefined} role={kind === 'list' ? 'listbox' : 'dialog'} aria-label={label} onKeyDown={keydown} onClickCapture={event => {
    const option = event.target.closest('[role="option"]');
    if (option && event.detail > 0) playSelection(option, anchor);
    if (option) {closing.current = true;if (event.detail > 0) option.dataset.picked = 'true';}
  }}>{children}</div>, container || document.body);
}

export function HomeChevron({reveal=false}) {
  return <span className={`home-chevron${reveal ? ' home-soft-word' : ''}`} aria-hidden="true"><svg width="32" height="40" viewBox="0 0 32 40" fill="none" stroke="#f50" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path className="home-chevron-left" d="M12 15.7 20 23.7"/><path className="home-chevron-right" d="M20 23.7 28 15.7"/></svg></span>;
}

function StepButton({plus, disabled, label, onClick}) {
  return <button type="button" className="home-step" disabled={disabled} aria-label={label} onClick={onClick}><img src={homeAsset(plus ? 'plus' : 'minus')} alt=""/></button>;
}

function placeSummary(places, view, t) {
  if (places.length > 1) return 'Multilocation';
  if (places.length === 1) return places[0].label;
  if (view.address && !view.areas?.length) return view.address;
  if (view.areas?.length > 1) return 'Multilocation';
  if (!view.areas?.length || view.area === 'Ambas zonas') return t('Ciudad de México');
  return view.area;
}

export function LocationSearch({value, onChange, label, placeholder, clearLabel}) {
  const input = useRef(null), measure = useRef(null);
  const [selection, setSelection] = useState(null);
  const [caret, setCaret] = useState(null);
  function update() {
    const el = input.current;
    setSelection(document.activeElement === el && el.selectionStart === el.selectionEnd ? {index:el.selectionStart, scroll:el.scrollLeft} : null);
  }
  useLayoutEffect(() => {
    const el = input.current;
    if (selection === null) {setCaret(null);return;}
    const style = getComputedStyle(el);
    const left = parseFloat(style.paddingLeft) + measure.current.getBoundingClientRect().width - selection.scroll;
    setCaret(left >= 0 && left < el.clientWidth ? {left, height:parseFloat(style.fontSize) * 1.2} : null);
  }, [selection, value]);
  return <div className="home-location-search">
    <input ref={input} data-initial-focus className="home-location-input" type="text" autoComplete="off" aria-label={label} placeholder={placeholder} value={value} onChange={e => {onChange(e.target.value);update();}} onSelect={update} onScroll={update} onFocus={update} onBlur={() => setSelection(null)}/>
    <span ref={measure} className="home-location-measure" aria-hidden="true">{value.slice(0, selection?.index ?? 0)}</span>
    {caret && <span className="home-location-caret" style={caret} aria-hidden="true"/>}
    {value && <button type="button" className="home-location-clear" aria-label={clearLabel} onMouseDown={event => event.preventDefault()} onClick={() => onChange('')}><img src={homeAsset('clear-query')} alt=""/></button>}
  </div>;
}

// Illustrative bar heights from Figma 356:66718, not inventory counts.
export const BUDGET_BAR_HEIGHTS = [6,6.84,7.98,9.12,11.4,14.82,18.24,22.8,28.5,35.34,44.46,54.72,68.4,84.36,100.32,109.44,114,111.72,104.88,95.76,87.78,80.94,74.1,66.12,59.28,53.58,49.02,45.6,43.32,41.04,37.62,31.92];

export function BudgetPicker({search, onChange, say}) {
  const {money, currency} = useLanguage();
  const {bins, ceiling, step} = useMemo(() => priceDistribution(homes.filter(home => (!search.areas?.length || search.areas.includes(home.area)) && home.beds >= search.beds && (!search.propertyType || ['apartment','any'].includes(search.propertyType))), search.mode, BUDGET_BAR_HEIGHTS.length), [search.mode, search.areas?.join('|'), search.beds, search.propertyType]);
  const factor = currency === 'USD' ? DEMO_MXN_PER_USD : 1;
  const [draft, setDraft] = useState({min:search.minBudget ? money(search.minBudget) : '', max:money(search.budget)});
  const [error, setError] = useState('');
  useEffect(() => {setDraft({min:search.minBudget ? money(search.minBudget) : '', max:money(search.budget)});}, [search.budget, search.minBudget, factor]);
  function commit(which) {
    const amount = parseBudgetAmount(draft[which], factor);
    if (!Number.isFinite(amount)) {setError(say('Digite um preço válido.', 'Escribe un precio válido.'));return;}
    const min = which === 'min' ? amount : search.minBudget || 0;
    const max = which === 'max' ? amount : search.budget;
    if (max <= 0 || min > max || max > 1e9) {setError(say('O mínimo precisa ser menor ou igual ao máximo.', 'El mínimo debe ser menor o igual al máximo.')); return;}
    setError(''); onChange({minBudget:min, budget:max});
  }
  return <div className="home-budget">
    <div className="home-budget-chart">
      <StepButton label={say('Diminuir orçamento', 'Reducir presupuesto')} disabled={search.budget <= Math.max(step, search.minBudget || 0)} onClick={() => onChange({budget:Math.max(step, search.minBudget || 0, search.budget - step)})}/>
      <PriceHistogram bins={bins} heights={BUDGET_BAR_HEIGHTS} min={search.minBudget || 0} max={search.budget} money={money} say={say} onChange={values => {setError('');onChange(values);}}/>
      <StepButton plus label={say('Aumentar orçamento', 'Aumentar presupuesto')} disabled={search.budget >= ceiling} onClick={() => onChange({budget:Math.min(ceiling, search.budget + step)})}/>
    </div>
    <div className="home-price-fields">{['min', 'max'].map(which => <label key={which}>{which === 'min' ? say('Mínimo', 'Mínimo') : say('Máximo', 'Máximo')}<input inputMode="numeric" aria-label={`${which === 'min' ? 'Mínimo' : 'Máximo'} (${currency})`} aria-invalid={!!error} placeholder="—" value={draft[which]} onChange={e => {setDraft({...draft, [which]:e.target.value});setError('');}} onBlur={() => commit(which)} onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault();commit(which);}}}/></label>)}</div>
    {error && <p className="home-field-error" role="alert">{error}</p>}
  </div>;
}


const MORA_MARK = '/assets/mini-listing/mora.svg';

/** A word of the sentence that opens a short list: "comprar", "casa". It stays pale until it is chosen. */
function SentencePicker({value, options, label, chosen, onPick, say}) {
  const anchor = useRef(null);
  const [open, setOpen] = useState(false);
  const [animate, setAnimate] = useState(true);
  const current = options.find(([key]) => key === value) || options[0];
  const locale = say('pt', 'es') === 'pt' ? 1 : 2;
  const close = restore => {setOpen(false); if (restore) requestAnimationFrame(() => anchor.current?.focus({preventScroll:true}));};
  return <span className="home-word interactive">
    <button ref={anchor} type="button" className={`home-word-control ${chosen ? 'is-chosen' : ''}`} aria-label={`${label}: ${current[locale]}`} aria-haspopup="listbox" aria-expanded={open}
      onClick={event => {setAnimate(event.detail > 0); setOpen(state => !state);}}
      onKeyDown={event => {if (event.key === 'ArrowDown') {event.preventDefault(); setAnimate(false); setOpen(true);}}}>
      <span className="home-choice-label">{current[locale].toLowerCase()}</span><HomeChevron/>
    </button>
    <HomePopover open={open} animate={animate} anchor={anchor.current} label={label} kind="list" variant="list" onClose={close}>
      {options.map(option => <button type="button" className="home-option" role="option" key={option[0]} aria-selected={chosen && option[0] === current[0]}
        onClick={() => {onPick(option[0]); close(true);}}>{option[locale]}</button>)}
    </HomePopover>
  </span>;
}

const ARTICLE = {apartment:['un', 'um'], house:['una', 'uma'], condominium:['una', 'uma'], office:['una', 'uma'], commercial:['un', 'um'], warehouse:['una', 'uma'], land:['un', 'um'], industrial:['una', 'uma'], any:['', '']};

/**
 * The free home search: "Describe el hogar que imaginas", then one sentence ("Quiero comprar una casa") whose operation
 * and property type are filters, and a location input in place of the free text. The location input only takes places;
 * the search starts once at least one place is chosen.
 */
export function HomeSearch({search, setSearch, onSubmit}) {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  // The default search area is only a suggestion: the home starts without a chosen place.
  const places = Array.isArray(search.places) ? search.places : [];
  const ready = places.length > 0;
  const [chosen, setChosen] = useState({mode:false, type:false});
  const [tipOpen, setTipOpen] = useState(false);
  const type = search.propertyType || 'apartment';
  const article = (ARTICLE[type] || ARTICLE.apartment)[pt ? 1 : 0];
  const update = change => setSearch(current => {
    const next = {...current, ...change};
    if (change.mode && change.mode !== current.mode) {next.budget = change.mode === 'rent' ? 28000 : 7500000; next.minBudget = 0;}
    return next;
  });
  function submit(event) {
    event?.preventDefault();
    if (!ready) {setTipOpen(true); return;}
    onSubmit();
  }
  const needsTip = !ready;
  const tipCopy = say('Escolha pelo menos um lugar para começar.', 'Elige al menos un lugar para empezar.');
  return <section className="home-search" data-layout="original" aria-label={say('Descreva seu lar', 'Describe tu hogar')}>
    <form onSubmit={submit}>
      <h1>{say('Descreva o lar que você imagina', 'Describe el hogar que imaginas')}</h1>
      <div className="home-sentence">
        <span className="home-sentence-line">
          <span className="home-phrase-group">
            <span className="home-word">{say('Quero', 'Quiero')}</span>
            <SentencePicker value={search.mode} options={OPERATIONS} label={say('Operação', 'Operación')} say={say} chosen={chosen.mode} onPick={mode => {setChosen(state => ({...state, mode:true})); update({mode});}}/>
          </span>
          <span className="home-phrase-group">
            {article && <span className="home-word"><span className="home-word-soft">{article}</span></span>}
            <SentencePicker value={type} options={PROPERTY_TYPES} label={say('Tipo de imóvel', 'Tipo de inmueble')} say={say} chosen={chosen.type} onPick={propertyType => {setChosen(state => ({...state, type:true})); update({propertyType});}}/>
          </span>
        </span>
      </div>
      <div className="home-detail-row" data-located={ready || undefined}>
        {ready
          ? <div className="home-sentence home-located"><span className="home-sentence-line"><span className="home-phrase-group">
            <span className="home-word">{say('em', 'en')}</span>
            <LocationField variant="sentence" places={places} onChange={next => {update({places:next}); setTipOpen(false);}} say={say} label={say('Zona para morar', 'Zona para vivir')}/>
          </span></span></div>
          : <LocationField variant="home" places={places} onChange={next => {update({places:next}); setTipOpen(false);}} say={say}
          label={say('Onde você quer morar', 'Dónde quieres vivir')} placeholder={say('Bairro, rua, metrô, escola', 'Colonia, calle, metro, escuela')}/>}
        <span className="home-start-slot" data-visible="true" data-needs-location={needsTip || undefined} data-tip-open={(needsTip && tipOpen) || undefined}
          tabIndex={needsTip ? 0 : undefined} onPointerDown={needsTip ? () => setTipOpen(true) : undefined}
          onMouseEnter={needsTip ? () => setTipOpen(true) : undefined} onMouseLeave={needsTip ? () => setTipOpen(false) : undefined}
          onFocus={needsTip ? () => setTipOpen(true) : undefined} onBlur={needsTip ? () => setTipOpen(false) : undefined}>
          <button className="home-start" type="submit" disabled={!ready} aria-describedby={needsTip ? 'home-start-tip' : undefined} tabIndex={needsTip ? -1 : undefined}>{say('Começar a buscar', 'Comenzar a buscar')}<img src={homeAsset(ready ? 'arrow' : 'arrow-disabled')} alt=""/></button>
          {needsTip && <span id="home-start-tip" className="home-start-tip" role="tooltip">
            <img className="home-start-tip-mark" src={MORA_MARK} alt="" width="20" height="20" decoding="async" aria-hidden="true"/>
            <span className="home-start-tip-copy">{tipCopy}</span>
          </span>}
        </span>
      </div>
    </form>
  </section>;
}
