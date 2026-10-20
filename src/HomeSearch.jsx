import React, {useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {areas, homes} from './data';
import {useLanguage, DEMO_MXN_PER_USD} from './i18n';
import {PROPERTY_TYPES, OPERATIONS, canStartSearch, foldSearchText, priceDistribution, parseBudgetAmount} from './homeSearchModel.js';
import {SearchDetails} from './SearchDetails';
import {PriceHistogram} from './PriceHistogram';
import {createHomeIntro, homeIntroFrame} from './homeIntro.js';
import {playMenu, playSelection} from './homeMotion.js';
import {updateSearchNote} from './searchCriteria.js';

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

function HomePopoverSurface({open, animate, anchor, label, kind='list', variant=kind, onClose, children}) {
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
      const left = Math.max(12, Math.min(box.left - 26, width - el.offsetWidth - 12));
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
  }, [open, anchor, kind, variant]);
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
  }}>{children}</div>, document.body);
}

export function HomeChevron({reveal=false}) {
  return <span className={`home-chevron${reveal ? ' home-soft-word' : ''}`} aria-hidden="true"><svg width="32" height="40" viewBox="0 0 32 40" fill="none" stroke="#f50" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path className="home-chevron-left" d="M12 15.7 20 23.7"/><path className="home-chevron-right" d="M20 23.7 28 15.7"/></svg></span>;
}

function StepButton({plus, disabled, label, onClick}) {
  return <button type="button" className="home-step" disabled={disabled} aria-label={label} onClick={onClick}><img src={homeAsset(plus ? 'plus' : 'minus')} alt=""/></button>;
}

function LocationSearch({value, onChange, label, placeholder}) {
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
    <input ref={input} data-initial-focus className="home-location-input" type="search" autoComplete="off" aria-label={label} placeholder={placeholder} value={value} onChange={e => {onChange(e.target.value);update();}} onSelect={update} onScroll={update} onFocus={update} onBlur={() => setSelection(null)}/>
    <span ref={measure} className="home-location-measure" aria-hidden="true">{value.slice(0, selection?.index ?? 0)}</span>
    {caret && <span className="home-location-caret" style={caret} aria-hidden="true"/>}
  </div>;
}

// Illustrative bar heights from Figma 356:66718, not inventory counts.
const BUDGET_BAR_HEIGHTS = [6,6.84,7.98,9.12,11.4,14.82,18.24,22.8,28.5,35.34,44.46,54.72,68.4,84.36,100.32,109.44,114,111.72,104.88,95.76,87.78,80.94,74.1,66.12,59.28,53.58,49.02,45.6,43.32,41.04,37.62,31.92];

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

function useSentenceIntro(parts, skip, onDone, sentenceOnly=false) {
  const speed = sentenceOnly ? 3 : 1;
  const [elapsed, setElapsed] = useState(() => skip || matchMedia('(prefers-reduced-motion:reduce)').matches ? Infinity : 0);
  const [timeline] = useState(() => {
    const home = createHomeIntro(parts);
    if (!sentenceOnly) return home;
    // Actual word animations finish this intro; the home detail copy adds no wait.
    return {...home, readyAt:Infinity, doneAt:Infinity,
      words:home.words.map(word => ({...word, morphAt:word.start, settledAt:word.start})),
      beats:home.words.map(word => word.start)};
  });
  const notified = useRef(false);
  const skipped = elapsed === Infinity;
  const wording = parts.map(part => part.text).join('|');
  const initialWording = useRef(wording);
  useEffect(() => {if (skip) setElapsed(Infinity);}, [skip]);
  useEffect(() => {if (wording !== initialWording.current) setElapsed(Infinity);}, [wording]);
  useEffect(() => {
    if (skipped) return;
    const start = performance.now(); let timer;
    const tick = () => {
      const time = (performance.now() - start) * speed;
      setElapsed(time);
      const next = timeline.beats.find(beat => beat > time);
      if (next !== undefined) timer = setTimeout(tick, Math.max(1, (next - time) / speed));
    };
    tick();
    const media = matchMedia('(prefers-reduced-motion:reduce)');
    const reduce = () => {if (media.matches) setElapsed(Infinity);};
    media.addEventListener('change', reduce);
    return () => {clearTimeout(timer);media.removeEventListener('change', reduce);};
  }, [skipped, timeline, speed]);
  const frame = homeIntroFrame(timeline, elapsed);
  useLayoutEffect(() => {
    if (sentenceOnly && frame.done && !notified.current) {notified.current = true;onDone();}
  }, [sentenceOnly, frame.done, onDone]);
  useEffect(() => {
    if (!sentenceOnly && frame.done && !notified.current) {notified.current = true;onDone();}
  }, [sentenceOnly, frame.done, onDone]);
  const finish = useCallback(() => setElapsed(Infinity), []);
  return {...frame, elapsed, timeline, skipped, speed, finish};
}

const SENTENCE_LINES = [[[0,1],[2,3],[4,5]], [[6,7],[8,9]]];
const SENTENCE_MIN_FONT = 28;

/**
 * Two fixed lines: the font shrinks until the widest line fits, never below SENTENCE_MIN_FONT.
 * When even that does not fit (phones), the groups wrap freely as before.
 * Gaps and chevrons stay in px, so the width is not proportional to the font and the scale is bisected.
 */
function useTwoLineSentence(ref, textKey) {
  useLayoutEffect(() => {
    const sentence = ref.current;
    if (!sentence) return;
    let frame = 0;
    const fit = () => {
      sentence.removeAttribute('data-wrap');
      sentence.style.setProperty('--home-sentence-fit', '1');
      const lines = [...sentence.querySelectorAll(':scope > .home-sentence-line')];
      const base = parseFloat(getComputedStyle(sentence).fontSize);
      const room = sentence.clientWidth;
      if (!lines.length || !base || !room) return;
      const minFit = Math.min(1, SENTENCE_MIN_FONT / base);
      const fits = scale => {
        sentence.style.setProperty('--home-sentence-fit', String(scale));
        return Math.max(...lines.map(line => line.scrollWidth)) <= room + 0.5;
      };
      if (fits(1)) return;
      if (!fits(minFit)) {
        sentence.style.setProperty('--home-sentence-fit', '1');
        sentence.setAttribute('data-wrap', '');
        return;
      }
      let low = minFit;
      let high = 1;
      for (let pass = 0; pass < 7; pass++) {
        const mid = (low + high) / 2;
        if (fits(mid)) low = mid; else high = mid;
      }
      fits(low);
    };
    const schedule = () => {cancelAnimationFrame(frame);frame = requestAnimationFrame(fit);};
    fit();
    const observer = new ResizeObserver(schedule);
    observer.observe(sentence.parentElement);
    sentence.querySelectorAll('.home-phrase-group,.mora-extra-term').forEach(node => observer.observe(node));
    document.fonts?.ready.then(schedule);
    return () => {observer.disconnect();cancelAnimationFrame(frame);};
  }, [ref, textKey]);
}

function StreamedWord({word, count}) {
  return count ? <span className="home-soft-ink">{word.chunks.map((chunk, index) => <React.Fragment key={index}><span className="home-soft-word" data-reveal-delay={index * word.revealStep}>{chunk.trimEnd()}</span>{chunk.match(/\s+$/)?.[0]}</React.Fragment>)}</span> : null;
}

export function HomeSearch({search, setSearch, choices, onChoose, skipIntro, onIntroDone, onStage, onSubmit, variant='home', detailContent, extraContent, openRequest}) {
  const {language, t, money, currency} = useLanguage();
  const say = (pt, es) => language === 'pt-BR' ? pt : es;
  const type = search.propertyType || 'apartment';
  const [open, setOpen] = useState(null);
  const [preserveIntroLayout] = useState(() => variant === 'results' && !skipIntro);
  const [menuMotion, setMenuMotion] = useState(true);
  const [selection, setSelection] = useState({key:null, version:0, animate:false});
  const [locationTerm, setLocationTerm] = useState('');
  const refs = useRef({});
  const form = useRef(null);
  const sentenceRef = useRef(null);
  const localeIndex = language === 'pt-BR' ? 1 : 2;
  const typeLabel = PROPERTY_TYPES.find(([key]) => key === type)?.[localeIndex] || PROPERTY_TYPES[0][localeIndex];
  const operationLabel = OPERATIONS.find(([key]) => key === search.mode)?.[localeIndex] || 'Comprar';
  const parts = [
    {text:say('Quero', 'Quiero')}, {key:'mode', label:t('Quiero comprar o rentar'), text:operationLabel.toLowerCase()},
    {text:type === 'house' || type === 'condominium' ? say('uma', 'una') : say('um', 'un')},
    {key:'propertyType', label:t('Tipo de inmueble'), text:typeLabel.toLowerCase()}, {text:t('con')},
    {key:'beds', label:t('Número de recámaras'), text:`${search.beds}+ ${say(search.beds === 1 ? 'quarto' : 'quartos', search.beds === 1 ? 'recámara' : 'recámaras')}`},
    {text:t('en')}, {key:'area', label:t('Zona para vivir'), text:search.address && !search.areas?.length ? search.address : search.areas?.length > 1 ? `${search.area} +${search.areas.length - 1}` : search.area === 'Ambas zonas' ? t('Ciudad de México') : search.area},
    {text:t('hasta')}, {key:'budget', label:t('Presupuesto máximo'), text:`${money(search.budget)} ${currency}`},
    {text:t('Agrega aquí más detalles'), details:true},
  ];
  const intro = useSentenceIntro(parts, skipIntro, onIntroDone, variant === 'results');
  useTwoLineSentence(sentenceRef, `${language}|${parts.map(part => part.text).join('|')}|${(search.criteria || []).join('|')}`);
  const ready = intro.ready;
  const revealExtras = variant === 'results' && !intro.done;
  const extrasVisible = intro.words.at(-1).visible;
  useEffect(() => {
    if (variant !== 'results' || !extrasVisible || intro.done) return;
    let cancelled = false;
    // Let the motion observer start the final words before collecting their fades.
    const frame = requestAnimationFrame(() => {
      const animations = [...form.current.querySelectorAll('.home-soft-word')].flatMap(el => el.getAnimations());
      Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        if (!cancelled) intro.finish();
      });
    });
    return () => {cancelled = true;cancelAnimationFrame(frame);};
  }, [variant, extrasVisible, intro.done, intro.finish]);
  useLayoutEffect(() => {
    if (variant === 'results' && intro.done) form.current?.querySelectorAll('.mora-extra-term,.home-chevron').forEach(el => el.getAnimations().forEach(animation => animation.cancel()));
  }, [variant, intro.done]);
  const canSubmit = ready && canStartSearch(choices);
  useEffect(() => {onStage?.({stage:intro.stage, animate:!intro.done});}, [intro.stage, intro.done, onStage]);
  function change(key, value, animate = false) {
    const next = {...search, [key]:value};
    if (key === 'area') {next.areas = value === 'Ambas zonas' ? [] : [value];next.address = '';}
    if (key === 'mode' && value !== search.mode) {next.budget = value === 'rent' ? 28000 : 7500000;next.minBudget = 0;}
    setSearch(next); onChoose(key);
    setSelection(previous => ({key, version:previous.version + 1, animate}));
  }
  function close(restore = false, animate = true) {const anchor = refs.current[open];setMenuMotion(animate);setOpen(null); if (restore) anchor?.focus({preventScroll:true});}
  function activate(key, animate) {intro.finish();setMenuMotion(animate);setLocationTerm('');setOpen(current => current === key ? null : key);}
  useLayoutEffect(() => {if (openRequest?.key && refs.current[openRequest.key]) {setLocationTerm('');setMenuMotion(openRequest.animate !== false);setOpen(openRequest.key);}}, [openRequest]);
  function skipAnimation() {intro.finish();requestAnimationFrame(() => refs.current.mode?.focus({preventScroll:true}));}
  const locations = areas.filter(area => foldSearchText(area === 'Ambas zonas' ? t('Ciudad de México') : area).includes(foldSearchText(locationTerm)));
  const list = open === 'mode' ? OPERATIONS : open === 'propertyType' ? PROPERTY_TYPES : [];
  return <section className="home-search" data-streamed-results={preserveIntroLayout || undefined} data-intro-speed={preserveIntroLayout ? intro.speed : undefined} aria-label={t('Describe tu hogar')}>
    <form ref={form} onSubmit={e => {e.preventDefault(); if (canSubmit) onSubmit();}} onKeyDownCapture={e => {if (variant === 'home' && e.key === 'Escape' && !intro.done) {e.preventDefault();skipAnimation();}}}>
      <h1>{variant === 'results' ? say('Refine a sua busca', 'Refina tu búsqueda') : t('Describe el hogar que imaginas')}</h1>
      {!intro.done && <button type="button" className="home-skip-intro" style={variant === 'results' ? {right:64} : undefined} aria-label={say('Pular animação', 'Saltar animación')} onClick={skipAnimation}>{variant === 'results' ? say('Pular', 'Saltar') : say('Pular animação', 'Saltar animación')}<span aria-hidden="true">↗</span></button>}
      {variant === 'home' && <p className="sr-only" role="status">{ready ? canSubmit ? say('Sua busca está pronta para começar.', 'Tu búsqueda está lista para empezar.') : say('Escolha a operação e o tipo de imóvel para começar.', 'Elige la operación y el tipo de inmueble para empezar.') : say('Preparando uma sugestão de busca.', 'Preparando una sugerencia de búsqueda.')}</p>}
      <div ref={sentenceRef} className="home-sentence" aria-busy={!ready}>
        {SENTENCE_LINES.map((groups, line) => <span className="home-sentence-line" key={line}>{groups.map(indices => <span className="home-phrase-group" key={indices[0]}>{indices.map(index => {
          const part = parts[index];
          const word = intro.words[index];
          const tip = !ready && intro.activeWord === index;
          return <span className={`home-word ${part.key ? 'interactive' : ''}`} key={part.key || index} style={{visibility:word.visible ? 'visible' : 'hidden'}}>
            {preserveIntroLayout && part.key && <span className="home-word-measure home-word-control" aria-hidden="true"><span>{part.text}</span><HomeChevron/></span>}
            {word.control ? <><button type="button" ref={el => {refs.current[part.key] = el;}} data-search-key={part.key} className={`home-word-control ${choices[part.key] ? 'is-chosen' : ''} ${word.morphing ? 'just-morphed' : ''}`} data-motion={menuMotion} aria-label={`${part.label}: ${part.text}`} aria-haspopup={['mode', 'propertyType'].includes(part.key) ? 'listbox' : 'dialog'} aria-expanded={open === part.key} onClick={event => activate(part.key, event.detail > 0)} onKeyDown={e => {if (e.key === 'ArrowDown') {e.preventDefault();activate(part.key, false);}}}><span key={selection.key === part.key ? selection.version : 0} className={`home-choice-label ${selection.key === part.key && selection.animate ? 'just-selected' : ''}`}>{variant === 'results' && !intro.done ? <StreamedWord word={intro.timeline.words[index]} count={word.count}/> : part.text}</span><HomeChevron reveal={variant === 'results' && !intro.done}/></button>{word.morphing && <span className="home-word-echo" aria-hidden="true">{part.text}</span>}{tip && <span className="home-control-tip" data-writing-tip aria-hidden="true"/>}</>
              : intro.done ? <span>{part.text}</span> : <>{(!preserveIntroLayout || !part.key) && <span className="home-word-measure" aria-hidden="true">{part.text}</span>}<span className="home-word-stream" aria-hidden="true"><StreamedWord word={intro.timeline.words[index]} count={word.count}/>{tip && <span data-writing-tip/>}</span></>}
          </span>;
        })}</span>)}
        {line === SENTENCE_LINES.length - 1 && (revealExtras ? React.Children.map(extraContent, child => React.cloneElement(child, {className:`${child.props.className}${extrasVisible ? ' home-soft-word' : ''}`, style:{...child.props.style,visibility:extrasVisible ? 'visible' : 'hidden'}})) : extraContent)}
        </span>)}
      </div>
      <div className="home-detail-row">
        {detailContent || (ready ? <SearchDetails value={search.note} onChange={note => setSearch(updateSearchNote(search, note))} language={language}/>
          : <div className="home-detail-stream" aria-hidden="true"><StreamedWord word={intro.timeline.words.at(-1)} count={intro.words.at(-1).count}/>{intro.activeWord === parts.length - 1 && <span data-writing-tip/>}</div>)}
        {variant === 'home' && <span className="home-start-slot" data-visible={ready} style={{visibility:ready ? 'visible' : 'hidden'}}><button className="home-start" type="submit" disabled={!canSubmit} aria-describedby={!canSubmit ? 'home-search-help' : undefined}>{t('Comenzar a buscar')}<img src={homeAsset(canSubmit ? 'arrow' : 'arrow-disabled')} alt=""/></button></span>}
      </div>
      {variant === 'home' && <span id="home-search-help" className="sr-only">{say('Selecione comprar ou alugar e um tipo de imóvel. Os valores em cinza são sugestões.', 'Selecciona la operación y un tipo de inmueble. Los valores grises son sugerencias.')}</span>}
    </form>
    <HomePopover open={!!open} animate={menuMotion} anchor={refs.current[open]} label={parts.find(part => part.key === open)?.label} kind={list.length ? 'list' : open} variant={open} onClose={close}>
      {list.map(([key, pt, es]) => <button type="button" className="home-option" role="option" aria-selected={!!choices[open] && key === (open === 'mode' ? search.mode : type)} key={key} onClick={event => {change(open, key, event.detail > 0);close(true, event.detail > 0);}}>{say(pt, es)}</button>)}
      {open === 'beds' && <div className="home-bed-stepper"><StepButton label={say('Diminuir quartos', 'Reducir recámaras')} disabled={search.beds <= 1} onClick={() => change('beds', search.beds - 1)}/><output aria-live="polite" key={search.beds}>{search.beds}+</output><StepButton plus label={say('Aumentar quartos', 'Aumentar recámaras')} disabled={search.beds >= 10} onClick={() => change('beds', search.beds + 1)}/></div>}
      {open === 'area' && <><LocationSearch label={say('Buscar localização', 'Buscar ubicación')} placeholder={say('Digite uma localização', 'Escribe una ubicación')} value={locationTerm} onChange={setLocationTerm}/><div className="home-locations" role="listbox" aria-label={t('Zona para vivir')}>{locations.map(area => <button type="button" role="option" className="home-option" aria-selected={!!choices.area && search.area === area} key={area} onClick={event => {change('area', area, event.detail > 0);close(true, event.detail > 0);}}>{area === 'Ambas zonas' ? t('Ciudad de México') : area}</button>)}</div>{!locations.length && <p className="home-no-location" role="status">{say('Nenhum bairro encontrado. Tente outro nome.', 'No encontramos ese barrio. Prueba otro nombre.')}</p>}</>}
      {open === 'budget' && <BudgetPicker search={search} say={say} onChange={values => {setSearch({...search, ...values});onChoose('budget');}}/>}
    </HomePopover>
  </section>;
}
