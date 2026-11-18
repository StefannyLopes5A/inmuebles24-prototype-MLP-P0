import React, {useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {areas, homes} from './data';
import {useLanguage, DEMO_MXN_PER_USD} from './i18n';
import {PROPERTY_TYPES, OPERATIONS, canStartSearch, canStartHomeSearch, hasChosenLocation, priceDistribution, parseBudgetAmount} from './homeSearchModel.js';
import {SearchDetails} from './SearchDetails';
import {PriceHistogram} from './PriceHistogram';
import {createHomeIntro, homeIntroFrame} from './homeIntro.js';
import {playMenu, playSelection} from './homeMotion.js';
import {CRITERIA, composeHomeDraft, criterionLabel, describeHomeQuery, homePhraseItems, homePhraseSegments, homeTypedArticle, releaseHomeTokenBefore, replaceHomePhraseItem, spliceHomeQuery, updateSearchNote} from './searchCriteria.js';
import {patchHomeQueryForChip, patchHomeQueryForCriterion, patchHomeQueryForPlace, tidyBudgetCurrency} from './homeQuerySync.js';
import {addressFromPlaces, areasFromPlaces, combinePlaces, searchLocations, suggestedLocations, visiblePlaces} from './locationSearch.js';
import {LocationMenu} from './LocationMenu.jsx';
import {HOME_COMPOSER_DEPART_MS} from './searchFlowMotion.js';
import {homeQuerySuggestions, useTypingSuggest} from './homeQuerySuggest.js';

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

function HomePopoverSurface({open, animate, anchor, label, kind='list', variant=kind, onClose, container, children}) {
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
  }}>{children}</div>, container || document.body);
}

export function HomeChevron({reveal=false}) {
  return <span className={`home-chevron${reveal ? ' home-soft-word' : ''}`} aria-hidden="true"><svg width="32" height="40" viewBox="0 0 32 40" fill="none" stroke="#f50" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path className="home-chevron-left" d="M12 15.7 20 23.7"/><path className="home-chevron-right" d="M20 23.7 28 15.7"/></svg></span>;
}

function StepButton({plus, disabled, label, onClick}) {
  return <button type="button" className="home-step" disabled={disabled} aria-label={label} onClick={onClick}><img src={homeAsset(plus ? 'plus' : 'minus')} alt=""/></button>;
}

function placeSummary(places, view, t) {
  if (places.length > 1) return `${places[0].label} +${places.length - 1}`;
  if (places.length === 1) return places[0].label;
  if (view.address && !view.areas?.length) return view.address;
  if (view.areas?.length > 1) return `${view.area} +${view.areas.length - 1}`;
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

function useSentenceIntro(parts, skip, onDone, sentenceOnly=false) {
  const speed = sentenceOnly ? 3 : 1;
  const [elapsed, setElapsed] = useState(() => skip || matchMedia('(prefers-reduced-motion:reduce)').matches ? Infinity : 0);
  const [replayToken, setReplayToken] = useState(0);
  const buildTimeline = useCallback(source => {
    const home = createHomeIntro(source);
    if (!sentenceOnly) return home;
    return {...home, readyAt:Infinity, doneAt:Infinity,
      words:home.words.map(word => ({...word, morphAt:word.start, settledAt:word.start})),
      beats:home.words.map(word => word.start)};
  }, [sentenceOnly]);
  const [timeline, setTimeline] = useState(() => buildTimeline(parts));
  const notified = useRef(false);
  const skipped = elapsed === Infinity;
  const wording = parts.map(part => part.text).join('|');
  const initialWording = useRef(wording);
  const skipWas = useRef(skip);
  const seenReplay = useRef(0);
  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
    if (skip || reduce) {skipWas.current = skip; setElapsed(Infinity); return;}
    // Opening the original sentence, or clearing it, starts the entrance on the sentence now showing.
    if (skipWas.current || replayToken !== seenReplay.current) {
      seenReplay.current = replayToken;
      initialWording.current = wording;
      skipWas.current = false;
      setTimeline(buildTimeline(parts));
      setElapsed(0);
      return;
    }
    skipWas.current = false;
    if (wording !== initialWording.current) setElapsed(Infinity);
  }, [skip, wording, replayToken, buildTimeline]);
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
  const replay = useCallback(() => setReplayToken(token => token + 1), []);
  return {...frame, elapsed, timeline, skipped, speed, finish, replay};
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

function QueryField({value, onChange, placeholder, label, areaRef, suggest, onSuggestDismiss, onFocusChange}) {
  const local = useRef(null);
  const area = areaRef || local;
  const field = useRef(null);
  const anchor = useRef(null);
  const suggestAnchor = useRef(null);
  const [caretIndex, setCaretIndex] = useState(0);
  const [caretBox, setCaretBox] = useState(null);
  const [demoCaret, setDemoCaret] = useState(null);
  const showSuggest = suggest?.active && !value.trim();
  const syncCaret = useCallback(() => {
    const el = area.current;
    if (!el || document.activeElement !== el || el.selectionStart !== el.selectionEnd) {
      setCaretBox(null);
      return;
    }
    setCaretIndex(el.selectionStart);
    requestAnimationFrame(() => {
      const root = field.current;
      const tip = anchor.current;
      const mirror = root?.querySelector('.home-query-mirror');
      const input = area.current;
      if (!root || !tip || !input || !mirror || document.activeElement !== input) return;
      mirror.style.marginTop = `${-input.scrollTop}px`;
      const style = getComputedStyle(input);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.15;
      const rootBox = root.getBoundingClientRect();
      const tipBox = tip.getBoundingClientRect();
      setCaretBox({left:tipBox.left - rootBox.left, top:tipBox.top - rootBox.top, height:line});
    });
  }, [area]);
  const fitHeight = useCallback(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
    syncCaret();
  }, [area, syncCaret]);
  useLayoutEffect(fitHeight, [value, fitHeight]);
  useLayoutEffect(() => {
    const root = field.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    let width = root.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const next = root.getBoundingClientRect().width;
      if (next === width) return;
      width = next;
      fitHeight();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [fitHeight]);
  useLayoutEffect(syncCaret, [value, caretIndex, syncCaret]);
  useLayoutEffect(() => {
    const root = field.current;
    const tip = suggestAnchor.current;
    const input = area.current;
    if (!showSuggest || !root || !tip || !input) {
      setDemoCaret(null);
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const tipBox = tip.getBoundingClientRect();
    const style = getComputedStyle(input);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.15;
    setDemoCaret({left:tipBox.left - rootBox.left, top:tipBox.top - rootBox.top, height:line});
  }, [showSuggest, suggest?.text, area]);
  return <div ref={field} className="home-query-field" data-suggest={showSuggest || undefined}>
    {showSuggest && <>
      <div className="home-query-suggest" aria-hidden="true"><span className="home-query-suggest-text">{suggest.text}</span></div>
      <div className="home-query-mirror home-query-mirror-suggest" aria-hidden="true">{suggest.text}{'\u2060'}<span ref={suggestAnchor} className="home-query-caret-anchor"/></div>
    </>}
    <div className="home-query-mirror" aria-hidden="true">{value.slice(0, caretIndex)}{'\u2060'}<span ref={anchor} className="home-query-caret-anchor"/></div>
    <textarea ref={area} className="home-query-input" rows={1} autoComplete="off" enterKeyHint="search" spellCheck={false} aria-label={label} placeholder={showSuggest ? '' : placeholder} value={value}
      onChange={event => {onSuggestDismiss?.('input'); onChange(event.target.value); setCaretIndex(event.target.selectionStart);}}
      onInput={fitHeight} onSelect={syncCaret} onKeyUp={syncCaret} onClick={() => {onSuggestDismiss?.('click'); syncCaret();}}
      onPointerDown={() => onSuggestDismiss?.('pointer')} onScroll={syncCaret}
      onFocus={() => {onFocusChange?.(true); onSuggestDismiss?.('focus'); syncCaret();}} onBlur={event => {if (!event.relatedTarget?.closest?.('.home-query-actions')) onFocusChange?.(false); setCaretBox(null); onSuggestDismiss?.('blur');}}/>
    {caretBox && !showSuggest && <span className="home-query-caret" style={{left:caretBox.left, top:caretBox.top, height:caretBox.height}} aria-hidden="true"/>}
    {demoCaret && showSuggest && <span className="home-query-caret home-query-caret-demo" style={{left:demoCaret.left, top:demoCaret.top, height:demoCaret.height}} aria-hidden="true"/>}
  </div>;
}

function PhraseSlice({inputRef, value, label, grow=false, tone='text', tabIndex, onChange, onKeyDown, onFocus, onBlur}) {
  const wrap = useRef(null);
  const tip = useRef(null);
  const localRef = useRef(null);
  const [caretAt, setCaretAt] = useState(0);
  const [caretBox, setCaretBox] = useState(null);
  const read = useCallback(() => localRef.current, []);
  const place = useCallback(() => {
    const input = read();
    const root = wrap.current;
    const mark = tip.current;
    if (!input || !root || !mark || document.activeElement !== input || input.selectionStart !== input.selectionEnd) {
      setCaretBox(null);
      return;
    }
    const at = input.selectionStart ?? 0;
    setCaretAt(current => current === at ? current : at);
    const rootBox = root.getBoundingClientRect();
    const markBox = mark.getBoundingClientRect();
    const style = getComputedStyle(input);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.15;
    setCaretBox({left:markBox.left - rootBox.left, top:markBox.top - rootBox.top, height:line});
  }, [read]);
  const fit = useCallback(() => {
    const input = read();
    if (!input || !grow) return;
    input.style.height = '0px';
    input.style.height = `${input.scrollHeight}px`;
  }, [grow, read]);
  useLayoutEffect(() => {
    fit();
    const frame = requestAnimationFrame(place);
    return () => cancelAnimationFrame(frame);
  }, [value, caretAt, fit, place]);
  const assign = node => {
    localRef.current = node;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef) inputRef.current = node;
  };
  const report = event => {
    const caret = event.target.selectionStart ?? event.target.value.length;
    setCaretAt(caret);
    onChange(event.target.value, caret);
  };
  const mirror = <>{value.slice(0, caretAt)}<span ref={tip} className="home-query-caret-anchor"/>{value.slice(caretAt)}</>;
  return <span ref={wrap} className={grow ? 'home-phrase-tail-wrap' : 'home-phrase-slice'} data-tone={tone} data-empty={!value.trim() ? '' : undefined}>
    <span className={grow ? 'home-phrase-tail-mirror' : 'home-phrase-slice-sizer'} aria-hidden="true">{mirror}</span>
    <textarea ref={assign} className={grow ? 'home-phrase-tail' : 'home-phrase-slice-input'} rows={1} cols={grow ? undefined : 1} value={value} tabIndex={tabIndex} aria-label={label} autoComplete="off" spellCheck={false}
      onChange={report}
      onSelect={event => {setCaretAt(event.currentTarget.selectionStart ?? 0); place();}}
      onKeyUp={place} onClick={place} onFocus={onFocus} onBlur={onBlur}
      onKeyDown={onKeyDown}/>
    {caretBox && <span className="home-query-caret" style={{left:caretBox.left, top:caretBox.top, height:caretBox.height}} aria-hidden="true"/>}
  </span>;
}

/* Pairs with the sweep delay and duration in home-evolution.css. */
const FILTER_SWEEP_HOLD_MS = 1700;

function useEnteringFilters(keys) {
  const stamp = keys.join('\u0000');
  const previous = useRef(null);
  const timers = useRef(new Map());
  const [entering, setEntering] = useState(() => new Set());
  useLayoutEffect(() => {
    const prev = previous.current;
    previous.current = stamp ? stamp.split('\u0000').filter(Boolean) : [];
    if (!prev) return;
    const added = previous.current.filter(key => !prev.includes(key));
    if (!added.length) return;
    setEntering(current => {
      const next = new Set(current);
      added.forEach(key => next.add(key));
      return next;
    });
    added.forEach(key => {
      clearTimeout(timers.current.get(key));
      timers.current.set(key, setTimeout(() => {
        timers.current.delete(key);
        setEntering(current => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }, FILTER_SWEEP_HOLD_MS));
    });
  }, [stamp]);
  useEffect(() => () => {timers.current.forEach(clearTimeout);}, []);
  return entering;
}

function StreamedWord({word, count}) {
  return count ? <span className="home-soft-ink">{word.chunks.map((chunk, index) => <React.Fragment key={index}><span className="home-soft-word" data-reveal-delay={index * word.revealStep}>{chunk.trimEnd()}</span>{chunk.match(/\s+$/)?.[0]}</React.Fragment>)}</span> : null;
}

export function HomeSearch({search, setSearch, choices, onChoose, skipIntro, onIntroDone, onStage, onSubmit, variant='home', detailContent, extraContent, openRequest, layout='inline'}) {
  const {language, t, money, currency} = useLanguage();
  const say = (pt, es) => language === 'pt-BR' ? pt : es;
  const [open, setOpen] = useState(null);
  const [preserveIntroLayout] = useState(() => variant === 'results' && !skipIntro);
  const [menuMotion, setMenuMotion] = useState(true);
  const [selection, setSelection] = useState({key:null, version:0, animate:false});
  const [locationTerm, setLocationTerm] = useState('');
  const [query, setQuery] = useState(variant === 'home' ? (search.note || '') : '');
  useEffect(() => {
    if (variant !== 'home') return;
    setQuery(current => {
      const next = tidyBudgetCurrency(current);
      return next === current ? current : next;
    });
  }, [query, variant]);
  const [queryFocused, setQueryFocused] = useState(false);
  const [editSpan, setEditSpan] = useState(null);
  const [suggestPaused, setSuggestPaused] = useState(() => variant === 'home' && !!(search.note || '').trim());
  const [homeDeparting, setHomeDeparting] = useState(false);
  const [startTipOpen, setStartTipOpen] = useState(false);
  const homeDepartTimer = useRef(0);
  const startTipTimer = useRef(0);
  const [overrides, setOverrides] = useState({});
  const [extraCriteria, setExtraCriteria] = useState([]);
  const [hiddenCriteria, setHiddenCriteria] = useState([]);
  const [extraPlaces, setExtraPlaces] = useState([]);
  const [hiddenPlaceKeys, setHiddenPlaceKeys] = useState([]);
  const refs = useRef({});
  const menuAnchor = useRef(null);
  const queryAreaRef = useRef(null);
  const tailRef = useRef(null);
  const sliceRefs = useRef(new Map());
  const caretIntent = useRef(null);
  const typingRef = useRef(false);
  const phraseWas = useRef(false);
  const holdFocus = useRef(false);
  function onQueryFocus(focused) {
    if (!focused && holdFocus.current) return;
    setQueryFocused(focused);
  }
  const form = useRef(null);
  const sentenceRef = useRef(null);
  const origin = useRef(search);
  const dirty = useRef(false);
  const published = useRef('');
  const detected = useMemo(() => describeHomeQuery(query, areas, currency, DEMO_MXN_PER_USD), [query, currency]);
  const placeList = useMemo(() => combinePlaces(detected.places, extraPlaces, hiddenPlaceKeys), [detected, extraPlaces, hiddenPlaceKeys]);
  const draft = useMemo(() => composeHomeDraft(origin.current, detected, overrides, query, extraCriteria, hiddenCriteria, extraPlaces, hiddenPlaceKeys), [detected, overrides, query, extraCriteria, hiddenCriteria, extraPlaces, hiddenPlaceKeys]);
  const [originalDraft, setOriginalDraft] = useState(() => ({...search, mode:'buy', propertyType:'house', beds:2, budget:7_500_000, minBudget:0, areas:[], area:'Ambas zonas', address:'', places:[], note:'', criteria:[], fromIdea:false}));
  const [originalChosen, setOriginalChosen] = useState({});
  const [originalSweep, setOriginalSweep] = useState(() => new Set());
  const [originalTake, setOriginalTake] = useState(0);
  const originalFitted = useRef({});
  const originalSweepTimers = useRef(new Map());
  useEffect(() => () => {originalSweepTimers.current.forEach(clearTimeout);}, []);
  const composer = variant === 'home' && layout !== 'original';
  const view = layout === 'original' ? originalDraft : composer ? draft : search;
  const type = view.propertyType || 'apartment';
  const localeIndex = language === 'pt-BR' ? 1 : 2;
  const typeLabel = PROPERTY_TYPES.find(([key]) => key === type)?.[localeIndex] || PROPERTY_TYPES[0][localeIndex];
  const operationLabel = OPERATIONS.find(([key]) => key === view.mode)?.[localeIndex] || 'Comprar';
  const parts = [
    {text:say('Quero', 'Quiero')}, {key:'mode', label:t('Quiero comprar o rentar'), text:operationLabel.toLowerCase()},
    {text:type === 'house' || type === 'condominium' ? say('uma', 'una') : say('um', 'un'), soft:true},
    {key:'propertyType', label:t('Tipo de inmueble'), text:typeLabel.toLowerCase()}, {text:t('con')},
    {key:'beds', label:t('Número de recámaras'), text:`${view.beds}+ ${say(view.beds === 1 ? 'quarto' : 'quartos', view.beds === 1 ? 'recámara' : 'recámaras')}`},
    {text:t('en')}, {key:'area', label:t('Zona para vivir'), text:placeSummary(layout === 'original' ? visiblePlaces(view) : variant === 'home' ? placeList : visiblePlaces(view), view, t)},
    {text:t('hasta')}, {key:'budget', label:t('Presupuesto máximo'), text:`${money(view.budget)} ${currency}`},
    {text:t('Agrega aquí más detalles'), details:true},
  ];
  const intro = useSentenceIntro(parts, variant === 'home' ? layout !== 'original' : skipIntro, onIntroDone, variant === 'results');
  useTwoLineSentence(sentenceRef, `${language}|${parts.map(part => part.text).join('|')}|${(view.criteria || []).join('|')}`);
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
  const canSubmit = layout === 'original'
    ? hasChosenLocation(originalDraft)
    : composer
    ? canStartHomeSearch(query, detected, {...overrides, places:placeList})
    : ready && canStartSearch(choices);
  const sentenceOnlyIntro = useRef(false);
  useEffect(() => {
    // Clearing the original sentence replays its own entrance and leaves the rest of the page where it is.
    if (sentenceOnlyIntro.current) {
      if (intro.done) sentenceOnlyIntro.current = false;
      return;
    }
    onStage?.({stage:intro.stage, animate:!intro.done});
  }, [intro.stage, intro.done, onStage]);
  const detectedStamp = [detected.mode, detected.propertyType, detected.beds, detected.baths, detected.parking, detected.area, detected.budget].join('\u0000');
  const previousDetected = useRef(detectedStamp);
  useEffect(() => {
    const previous = previousDetected.current;
    if (previous === detectedStamp) return;
    previousDetected.current = detectedStamp;
    if (variant !== 'home') return;
    const before = previous.split('\u0000');
    const after = detectedStamp.split('\u0000');
    const fields = ['mode', 'propertyType', 'beds', 'baths', 'parking', 'area', 'budget'];
    setOverrides(current => {
      let changed = false;
      const next = {...current};
      fields.forEach((field, index) => {
        if (after[index] && after[index] !== before[index] && Object.prototype.hasOwnProperty.call(next, field)) {
          delete next[field];
          if (field === 'budget') delete next.minBudget;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [detectedStamp, variant]);
  const criteriaStamp = detected.criteria.join('|');
  useEffect(() => {
    setHiddenCriteria(list => {
      const next = list.filter(id => detected.criteria.includes(id));
      return next.length === list.length ? list : next;
    });
  }, [criteriaStamp]);
  const placeStamp = (detected.places || []).map(place => place.key).join('|');
  useEffect(() => {
    const keys = new Set(placeStamp ? placeStamp.split('|') : []);
    setHiddenPlaceKeys(list => {
      const next = list.filter(key => keys.has(key));
      return next.length === list.length ? list : next;
    });
  }, [placeStamp]);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (!composer || !dirty.current || published.current === draftKey) return;
    published.current = draftKey;
    setSearch(draft);
    if ((detected.mode || overrides.mode) && !choices.mode) onChoose('mode');
    if ((detected.propertyType || overrides.propertyType) && !choices.propertyType) onChoose('propertyType');
  }, [composer, draftKey]);
  function syncQueryFromChip(key, value, budgetLabel) {
    setQuery(current => patchHomeQueryForChip(current, key, value, {language, areas, budgetLabel}));
  }
  function markOriginalSweep(key) {
    setOriginalSweep(current => new Set(current).add(key));
    clearTimeout(originalSweepTimers.current.get(key));
    originalSweepTimers.current.set(key, setTimeout(() => {
      originalSweepTimers.current.delete(key);
      setOriginalSweep(current => {
        if (!current.has(key)) return current;
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }, FILTER_SWEEP_HOLD_MS));
  }
  function typeOriginal(note) {
    const found = describeHomeQuery(note, areas, currency, DEMO_MXN_PER_USD);
    const base = {mode:'buy', propertyType:'house', beds:2, baths:1, budget:7_500_000, minBudget:0, areas:[], area:'Ambas zonas', address:'', places:[], criteria:[], fromIdea:false, note:''};
    const composed = composeHomeDraft(base, found, {}, note);
    setOriginalDraft(composed);
    const nextFit = {
      ...(found.mode ? {mode:found.mode} : {}),
      ...(found.propertyType ? {propertyType:found.propertyType} : {}),
      ...(found.beds != null ? {beds:found.beds} : {}),
      ...(found.area != null || found.places?.length ? {area:found.places?.[0]?.key || found.area} : {}),
      ...(found.budget != null ? {budget:found.budget} : {}),
    };
    const previous = originalFitted.current;
    originalFitted.current = nextFit;
    for (const key of Object.keys(nextFit)) if (previous[key] !== nextFit[key]) markOriginalSweep(key);
    const located = hasChosenLocation(composed);
    setOriginalChosen(current => {
      const next = {...current, ...Object.fromEntries(Object.keys(nextFit).map(key => [key, true]))};
      if (located) next.area = true;
      else delete next.area;
      return next;
    });
    if (!Object.keys(nextFit).length) return;
    for (const key of Object.keys(nextFit)) onChoose(key);
  }
  function clearOriginal() {
    originalSweepTimers.current.forEach(clearTimeout);
    originalSweepTimers.current.clear();
    setOriginalSweep(new Set());
    originalFitted.current = {};
    setOriginalChosen({});
    setOriginalDraft({mode:'buy', propertyType:'house', beds:2, baths:1, budget:7_500_000, minBudget:0, areas:[], area:'Ambas zonas', address:'', places:[], criteria:[], fromIdea:false, note:''});
    setOriginalTake(take => take + 1);
    if (intro.done) sentenceOnlyIntro.current = true;
    intro.replay();
  }
  function change(key, value, animate = false) {
    if (layout === 'original') {
      setOriginalDraft(current => {
        const next = {...current, [key]:value};
        if (key === 'area') {next.areas = value === 'Ambas zonas' ? [] : [value]; next.address = ''; next.places = [];}
        if (key === 'mode' && value !== current.mode) {next.budget = value === 'rent' ? 28000 : 7500000; next.minBudget = 0;}
        return next;
      });
      onChoose(key);
      setOriginalChosen(current => ({...current, [key]:true}));
      setSelection(previous => ({key, version:previous.version + 1, animate}));
      return;
    }
    if (composer) {
      dirty.current = true;
      setOverrides(current => ({...current, [key]:value}));
      syncQueryFromChip(key, value);
      onChoose(key);
      setSelection(previous => ({key, version:previous.version + 1, animate}));
      return;
    }
    const next = {...search, [key]:value};
    if (key === 'area') {next.areas = value === 'Ambas zonas' ? [] : [value];next.address = '';}
    if (key === 'mode' && value !== search.mode) {next.budget = value === 'rent' ? 28000 : 7500000;next.minBudget = 0;}
    setSearch(next); onChoose(key);
    setSelection(previous => ({key, version:previous.version + 1, animate}));
  }
  function editQuery(text) {dirty.current = true; typingRef.current = true; setQuery(text);}
  function clearQuery() {
    dirty.current = true;
    published.current = '';
    setQuery('');
    setOverrides({});
    setExtraCriteria([]);
    setHiddenCriteria([]);
    setExtraPlaces([]);
    setHiddenPlaceKeys([]);
    setOpen(null);
    setSuggestPaused(false);
    requestAnimationFrame(() => queryAreaRef.current?.focus({preventScroll: true}));
  }
  function toggleCriterion(id) {
    const editing = menuAnchor.current?.dataset.searchKey || '';
    if (composer && editing.startsWith('criterion:') && editing !== `criterion:${id}`) {
      const previousId = editing.slice('criterion:'.length);
      const already = homePhraseItems(query).some(item => item.key === `criterion:${id}`);
      dirty.current = true;
      setHiddenCriteria(list => [...new Set([...list.filter(item => item !== id), previousId])]);
      setExtraCriteria(list => {
        const without = list.filter(item => item !== previousId && item !== id);
        return already ? without : [...new Set([...without, id])];
      });
      setQuery(current => replaceHomePhraseItem(current, editing, already ? '' : criterionLabel(id, language).toLowerCase()));
      return;
    }
    const active = (view.criteria || []).includes(id);
    dirty.current = true;
    if (active) {
      setHiddenCriteria(list => [...new Set([...list, id])]);
      setExtraCriteria(list => list.filter(item => item !== id));
    } else {
      setHiddenCriteria(list => list.filter(item => item !== id));
      setExtraCriteria(list => [...new Set([...list, id])]);
    }
    setQuery(current => patchHomeQueryForCriterion(current, id, !active, language));
  }
  function togglePlace(place) {
    if (layout === 'original') {
      const places = visiblePlaces(originalDraft);
      const active = places.some(item => item.key === place.key);
      const next = active
        ? places.filter(item => item.key !== place.key)
        : place.kind === 'city' || place.kind === 'state'
          ? [place]
          : [...places.filter(item => item.kind !== 'city' && item.kind !== 'state'), place];
      const nextAreas = areasFromPlaces(next);
      setOriginalDraft({...originalDraft, places:next, areas:nextAreas, area:nextAreas[0] || 'Ambas zonas', address:addressFromPlaces(next)});
      setOriginalChosen(current => {
        if (next.length) return {...current, area:true};
        if (!current.area) return current;
        const rest = {...current};
        delete rest.area;
        return rest;
      });
      onChoose('area');
      return;
    }
    const current = variant === 'home' ? placeList : visiblePlaces(search);
    const active = current.some(item => item.key === place.key);
    const editing = menuAnchor.current?.dataset.searchKey || '';
    if (composer && editing.startsWith('place:') && editing !== `place:${place.key}`) {
      const previousKey = editing.slice('place:'.length);
      const already = homePhraseItems(query).some(item => item.key === `place:${place.key}`);
      dirty.current = true;
      setHiddenPlaceKeys(list => [...new Set([...list.filter(key => key !== place.key), previousKey])]);
      setExtraPlaces(list => [...list.filter(item => item.key !== previousKey && item.key !== place.key), ...(already ? [] : [place])]);
      setQuery(currentQuery => replaceHomePhraseItem(currentQuery, editing, already ? '' : place.label));
      onChoose('area');
      return;
    }
    if (composer) {
      dirty.current = true;
      if (active) {
        setHiddenPlaceKeys(list => [...new Set([...list, place.key])]);
        setExtraPlaces(list => list.filter(item => item.key !== place.key));
      } else if (place.kind === 'city' || place.kind === 'state') {
        setHiddenPlaceKeys(list => [...new Set([...list, ...current.map(item => item.key)])]);
        setExtraPlaces([place]);
      } else {
        const broad = current.filter(item => item.kind === 'city' || item.kind === 'state').map(item => item.key);
        setHiddenPlaceKeys(list => [...new Set([...list.filter(key => key !== place.key), ...broad])]);
        setExtraPlaces(list => [...list.filter(item => item.kind !== 'city' && item.kind !== 'state' && item.key !== place.key), place]);
      }
      setQuery(currentQuery => patchHomeQueryForPlace(currentQuery, place, !active, language));
      onChoose('area');
      return;
    }
    const next = active
      ? current.filter(item => item.key !== place.key)
      : place.kind === 'city' || place.kind === 'state'
        ? [place]
        : [...current.filter(item => item.kind !== 'city' && item.kind !== 'state'), place];
    setSearch({...search, places:next});
    onChoose('area');
  }
  function close(restore = false, animate = true) {const anchor = refs.current[open];setMenuMotion(animate);setOpen(null); if (restore) anchor?.focus({preventScroll:true});}
  function activate(key, animate, anchor) {
    menuAnchor.current = anchor || refs.current[key] || null;
    intro.finish();
    setMenuMotion(animate);
    setLocationTerm('');
    setOpen(current => current === key ? null : key);
  }
  useLayoutEffect(() => {if (openRequest?.key && refs.current[openRequest.key]) {setLocationTerm('');setMenuMotion(openRequest.animate !== false);setOpen(openRequest.key);}}, [openRequest]);
  function skipAnimation() {intro.finish();requestAnimationFrame(() => refs.current.mode?.focus({preventScroll:true}));}
  const list = open === 'mode' ? OPERATIONS : open === 'propertyType' ? PROPERTY_TYPES : [];
  const bedLabel = `${view.beds}+ ${say(view.beds === 1 ? 'quarto' : 'quartos', view.beds === 1 ? 'recámara' : 'recámaras')}`;
  const bathCount = view.baths || 1;
  const bathLabel = `${bathCount}+ ${say(bathCount === 1 ? 'banheiro' : 'banheiros', bathCount === 1 ? 'baño' : 'baños')}`;
  const parkingCount = view.parking || 1;
  const parkingLabel = `${parkingCount}+ ${say(parkingCount === 1 ? 'vaga' : 'vagas', parkingCount === 1 ? 'estacionamiento' : 'estacionamientos')}`;
  const activePlaces = layout === 'original' ? visiblePlaces(view) : variant === 'home' ? placeList : visiblePlaces(view);
  const locationChoices = locationTerm.trim().length >= 2 ? searchLocations(locationTerm, 8) : activePlaces.length ? activePlaces : suggestedLocations(8);
  const amenityIds = (view.criteria || []).filter(id => CRITERIA.some(item => item.id === id));
  const phraseItems = useMemo(() => variant === 'home' ? homePhraseItems(query) : [], [query, variant]);
  const filterKeys = useMemo(() => phraseItems.map(item => item.key), [phraseItems]);
  const canClearQuery = query.trim().length > 0 || filterKeys.length > 0;
  const phraseReady = filterKeys.length > 0;
  const inlinePhrase = composer && layout !== 'hybrid' && phraseReady;
  const phraseSegments = useMemo(() => variant === 'home' && inlinePhrase ? homePhraseSegments(query, editSpan) : [], [query, editSpan, inlinePhrase, variant]);
  const focusAt = (node, at) => {
    if (!node) return;
    node.focus({preventScroll:true});
    const caret = Math.max(0, Math.min(node.value.length, at));
    node.setSelectionRange(caret, caret);
  };
  useLayoutEffect(() => {
    if (variant !== 'home') return;
    const entered = inlinePhrase && !phraseWas.current;
    const left = !inlinePhrase && phraseWas.current;
    phraseWas.current = inlinePhrase;
    if (entered && typingRef.current && !caretIntent.current) {
      holdFocus.current = true;
      setQueryFocused(true);
      focusAt(tailRef.current, tailRef.current?.value.length ?? 0);
    }
    if (left && typingRef.current) {
      const offset = caretIntent.current?.offset;
      caretIntent.current = null;
      focusAt(queryAreaRef.current, offset == null ? (queryAreaRef.current?.value.length ?? 0) : offset);
    }
  }, [inlinePhrase, variant]);
  useLayoutEffect(() => {
    if (variant !== 'home' || !inlinePhrase) return;
    const intent = caretIntent.current;
    if (!intent) return;
    const texts = phraseSegments.filter(segment => segment.kind === 'text');
    const hits = texts.filter(segment => intent.offset >= segment.start && intent.offset <= segment.end);
    const segment = (intent.bias === 'before' ? hits[0] : hits[hits.length - 1]) || texts.at(-1);
    const node = segment && sliceRefs.current.get(segment.key);
    if (!node) return;
    caretIntent.current = null;
    const local = Math.max(0, Math.min(segment.value.length, intent.offset - segment.start));
    focusAt(node, local);
    node.dispatchEvent(new Event('select', {bubbles:true}));
    holdFocus.current = true;
    setQueryFocused(true);
  }, [phraseSegments, inlinePhrase, variant]);
  useEffect(() => {
    if (editSpan && !phraseItems.some(item => item.key === editSpan)) setEditSpan(null);
  }, [editSpan, phraseItems]);
  const enteringFilters = useEnteringFilters(filterKeys);
  const filterDelay = useMemo(() => Object.fromEntries(filterKeys.map((key, index) => [key, index])), [filterKeys.join('\u0000')]);
  const filterSummary = phraseItems.map(item => item.kind === 'type' ? typeLabel : item.kind === 'beds' ? bedLabel : item.kind === 'baths' ? bathLabel : item.kind === 'parking' ? parkingLabel : item.kind === 'criterion' ? criterionLabel(item.id, language) : item.kind === 'place' ? item.place.label : item.kind === 'budget' ? `${money(view.budget)} ${currency}` : '').filter(Boolean).join(', ');
  const suggestExamples = useMemo(() => homeQuerySuggestions(language), [language]);
  const suggestActive = variant === 'home' && !query.trim() && !suggestPaused;
  const typingSuggest = useTypingSuggest(suggestExamples, suggestActive);
  const dismissSuggest = useCallback((reason) => {
    if (reason === 'blur' && !query.trim()) setSuggestPaused(false);
    else setSuggestPaused(true);
  }, [query]);
  useEffect(() => () => {
    clearTimeout(homeDepartTimer.current);
    clearTimeout(startTipTimer.current);
  }, []);
  const needsLocationTip = (composer || layout === 'original') && !canSubmit && !homeDeparting;
  const locationTipCopy = layout === 'original'
    ? say(<>Escolha pelo menos uma <b>localização</b> para ver resultados.</>, <>Elige al menos una <b>ubicación</b> para ver resultados.</>)
    : say(<>Adicione uma <b>localização</b> na descrição para ver resultados.</>, <>Agrega una <b>ubicación</b> en la descripción para ver resultados.</>);
  const MORA_MARK = '/assets/mini-listing/mora.svg';
  function pokeStartTip(event) {
    if (!needsLocationTip) return;
    event.preventDefault();
    setStartTipOpen(true);
    clearTimeout(startTipTimer.current);
    startTipTimer.current = window.setTimeout(() => {
      startTipTimer.current = 0;
      setStartTipOpen(false);
    }, 3200);
  }
  function beginSearch() {
    if (!canSubmit || homeDeparting) return;
    if (composer) {
      setSuggestPaused(true);
      setHomeDeparting(true);
      form.current?.querySelector('.home-composer')?.classList.add('home-composer-departing');
      const wait = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : HOME_COMPOSER_DEPART_MS;
      clearTimeout(homeDepartTimer.current);
      homeDepartTimer.current = window.setTimeout(() => {
        homeDepartTimer.current = 0;
        setHomeDeparting(false);
        onSubmit();
      }, wait);
      return;
    }
    onSubmit(layout === 'original' ? originalDraft : undefined);
  }
  function openArea(event) {
    const same = open === 'area' && refs.current.area === event.currentTarget;
    refs.current.area = event.currentTarget;
    setMenuMotion(event.detail > 0);
    setLocationTerm('');
    setOpen(same ? null : 'area');
  }
  function openAmenity(event) {
    const same = open === 'amenity' && refs.current.amenity === event.currentTarget;
    refs.current.amenity = event.currentTarget;
    setMenuMotion(event.detail > 0);
    setOpen(same ? null : 'amenity');
  }
  function rememberCaret(offset, bias = 'after') {caretIntent.current = {offset, bias};}
  function bindSlice(segment) {
    return node => {
      if (node) sliceRefs.current.set(segment.key, node);
      else sliceRefs.current.delete(segment.key);
      if (segment.grow) tailRef.current = node;
    };
  }
  function moveCaret(segment, direction) {
    const stops = phraseSegments.filter(item => item.kind === 'text' || item.kind === 'chip');
    const index = stops.findIndex(item => item.key === segment.key);
    const next = stops[index + direction];
    if (!next) return false;
    if (next.kind === 'chip') {
      setEditSpan(next.item.key);
      rememberCaret(direction < 0 ? next.end : next.start, direction < 0 ? 'before' : 'after');
    } else {
      setEditSpan(current => current ? null : current);
      rememberCaret(direction < 0 ? next.end : next.start, direction < 0 ? 'before' : 'after');
    }
    return true;
  }
  function onSliceKeyDown(segment, event) {
    if (event.nativeEvent.isComposing) return;
    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    if (event.key === 'Enter') {
      event.preventDefault();
      const at = segment.start + start;
      rememberCaret(at + 1, 'after');
      editQuery(spliceHomeQuery(query, at, segment.start + end, '\n'));
      return;
    }
    if (event.key === 'Backspace' && start === 0 && end === 0) {
      event.preventDefault();
      rememberCaret(Math.max(0, segment.start - 1), 'before');
      editQuery(releaseHomeTokenBefore(query, segment.start));
      return;
    }
    if (event.key === 'Delete' && start === input.value.length && end === start) {
      event.preventDefault();
      rememberCaret(segment.end, 'after');
      editQuery(spliceHomeQuery(query, segment.end, segment.end + 1, ''));
      return;
    }
    if (event.key === 'ArrowLeft' && start === 0 && end === 0 && moveCaret(segment, -1)) event.preventDefault();
    if (event.key === 'ArrowRight' && start === input.value.length && end === start && moveCaret(segment, 1)) event.preventDefault();
  }
  function onSliceFocus() {holdFocus.current = true; setQueryFocused(true);}
  function onSliceBlur(event) {
    if (event.relatedTarget?.closest?.('.home-query-actions, .home-phrase, .home-popover')) return;
    holdFocus.current = false;
    setQueryFocused(false);
    setEditSpan(null);
  }
  function beginEdit(item, event) {
    event.preventDefault();
    event.stopPropagation();
    const raw = query.slice(item.start, item.end);
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = box.width > 0 ? (event.clientX - box.left) / box.width : 1;
    const local = Math.max(0, Math.min(raw.length, Math.round(ratio * raw.length)));
    setEditSpan(item.key);
    rememberCaret(item.start + local, 'after');
  }
  const sliceLabel = t('Describe el hogar que imaginas');
  function renderSlice(segment) {
    return <PhraseSlice key={segment.key} inputRef={bindSlice(segment)} value={segment.value} label={sliceLabel} grow={segment.grow} tone={segment.tone} tabIndex={!segment.value && !segment.grow ? -1 : undefined} onChange={(next, caret) => {rememberCaret(segment.start + caret, 'after'); editQuery(spliceHomeQuery(query, segment.start, segment.end, next));}} onKeyDown={event => onSliceKeyDown(segment, event)} onFocus={onSliceFocus} onBlur={onSliceBlur}/>;
  }
  function renderChip(item, text, searchKey, popup, expanded, label, assign, onOpen, {editable = true, lead = ''} = {}) {
    const entering = enteringFilters.has(item.key) ? ' home-filter-enter' : '';
    const style = {'--home-filter-delay':`${(filterDelay[item.key] || 0) * 70}ms`};
    const editing = editable && editSpan === item.key;
    const segment = phraseSegments.find(entry => entry.key === `edit:${item.key}`);
    const openKey = event => {if (event.key === 'ArrowDown') {event.preventDefault(); onOpen(event);}};
    return <span className={`home-filter${entering}`} key={item.key} style={style}>
      {lead && <span className="home-filter-lead">{lead}</span>}
      {editing && segment ? renderSlice(segment) : editable
        ? <span className="home-filter-value" onMouseDown={event => beginEdit(item, event)}>{text}</span>
        : <button type="button" className="home-filter-value" ref={assign} data-search-key={searchKey} aria-label={label} aria-haspopup={popup} aria-expanded={expanded} onClick={onOpen} onKeyDown={openKey}><span className="home-filter-label">{text}</span><HomeChevron/></button>}
      {editable && <button type="button" className="home-filter-chevron" ref={assign} data-search-key={searchKey} aria-label={label} aria-haspopup={popup} aria-expanded={expanded} onMouseDown={event => event.stopPropagation()} onClick={onOpen} onKeyDown={openKey}><HomeChevron/></button>}
    </span>;
  }
  function renderFilter(item, editable) {
    const article = item.kind === 'type' ? homeTypedArticle(query) : '';
    const connector = item.lead === 'y' || item.lead === 'e' ? say('com', 'con') : item.lead;
    const lead = article && item.lead === article ? '' : (editable ? '' : connector || '');
    const titled = value => value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
    if (item.kind === 'type') return renderChip(item, editable ? typeLabel.toLowerCase() : [article && titled(article), typeLabel].filter(Boolean).join(' '), 'propertyType', 'listbox', open === 'propertyType', `${t('Tipo de inmueble')}: ${typeLabel}`, el => {refs.current.propertyType = el;}, event => activate('propertyType', event.detail > 0, event.currentTarget), {editable, lead});
    if (item.kind === 'beds') return renderChip(item, bedLabel, 'beds', 'dialog', open === 'beds', `${t('Número de recámaras')}: ${bedLabel}`, el => {refs.current.beds = el;}, event => activate('beds', event.detail > 0, event.currentTarget), {editable, lead});
    if (item.kind === 'baths') return renderChip(item, bathLabel, 'baths', 'dialog', open === 'baths', `${say('Número de banheiros', 'Número de baños')}: ${bathLabel}`, el => {refs.current.baths = el;}, event => activate('baths', event.detail > 0, event.currentTarget), {editable, lead});
    if (item.kind === 'parking') return renderChip(item, parkingLabel, 'parking', 'dialog', open === 'parking', `${say('Número de vagas', 'Número de estacionamientos')}: ${parkingLabel}`, el => {refs.current.parking = el;}, event => activate('parking', event.detail > 0, event.currentTarget), {editable, lead});
    if (item.kind === 'criterion') return renderChip(item, editable ? criterionLabel(item.id, language) : titled(criterionLabel(item.id, language)), item.key, 'listbox', open === 'amenity', `${say('Comodidade', 'Comodidad')}: ${criterionLabel(item.id, language)}`, null, event => {menuAnchor.current = event.currentTarget; openAmenity(event);}, {editable, lead});
    if (item.kind === 'place') return renderChip(item, item.place.label, item.key, 'dialog', open === 'area', `${t('Zona para vivir')}: ${item.place.label}`, null, event => {menuAnchor.current = event.currentTarget; openArea(event);}, {editable, lead});
    if (item.kind === 'budget') return renderChip(item, `${money(view.budget)} ${currency}`, 'budget', 'dialog', open === 'budget', `${t('Presupuesto máximo')}: ${money(view.budget)} ${currency}`, el => {refs.current.budget = el;}, event => activate('budget', event.detail > 0, event.currentTarget), {editable, lead});
    return null;
  }
  return <section className="home-search" data-layout={layout === 'original' ? 'original' : undefined} data-streamed-results={preserveIntroLayout || undefined} data-intro-speed={preserveIntroLayout ? intro.speed : undefined} aria-label={t('Describe tu hogar')}>
    <form ref={form} onSubmit={e => {e.preventDefault(); beginSearch();}} onKeyDownCapture={e => {if (variant === 'home' && e.key === 'Escape' && suggestActive) {e.preventDefault();setSuggestPaused(true);} else if (variant === 'home' && e.key === 'Escape' && !intro.done) {e.preventDefault();skipAnimation();}}}>
      {composer ? <div className="home-composer">
        {suggestActive && <button type="button" className="home-skip-intro" aria-label={say('Pular sugestões', 'Saltar animación')} onClick={() => setSuggestPaused(true)}>{say('Pular', 'Saltar')}<span aria-hidden="true">↗</span></button>}
        <div className="home-composer-stack">
          <div className="home-intent">
            <span>{say('Quero', 'Quiero')}</span>
            <button type="button" ref={el => {refs.current.mode = el;}} data-search-key="mode" className="home-intent-control" aria-label={`${t('Quiero comprar o rentar')}: ${operationLabel}`} aria-haspopup="listbox" aria-expanded={open === 'mode'} onClick={event => activate('mode', event.detail > 0, event.currentTarget)} onKeyDown={event => {if (event.key === 'ArrowDown') {event.preventDefault();activate('mode', false);}}}>{operationLabel.toLowerCase()}<HomeChevron/></button>
          </div>
          <div className="home-query-row">
            <div className="home-query-main">
            {inlinePhrase ? <div className="home-phrase" data-typing={queryFocused || undefined} role="group" aria-label={say('Filtros reconhecidos', 'Filtros reconocidos')} onMouseDown={event => {if (event.target.closest('button, textarea, input, a, .home-phrase-slice, .home-filter-value')) return; event.preventDefault(); focusAt(tailRef.current, tailRef.current?.value.length ?? 0);}}>
              {phraseSegments.map(segment => {
                if (segment.kind === 'break') return <span className="home-phrase-break" key={segment.key}/>;
                if (segment.kind === 'text' && segment.tone !== 'filter') return renderSlice(segment);
                return segment.item ? renderFilter(segment.item, true) : null;
              })}
            </div> : <QueryField areaRef={queryAreaRef} value={query} onChange={editQuery} placeholder={t('Describe el hogar que imaginas')} label={t('Describe el hogar que imaginas')} suggest={{active:suggestActive, ...typingSuggest}} onSuggestDismiss={dismissSuggest} onFocusChange={onQueryFocus}/>}
            {layout === 'hybrid' && phraseItems.length > 0 && <div className="home-filter-sentence" role="group" aria-label={say('Filtros reconhecidos', 'Filtros reconocidos')}>{phraseItems.map(item => renderFilter(item, false))}</div>}
            </div>
            <div className="home-query-actions">
              {canClearQuery && <button type="button" className="home-query-clear" aria-label={say('Limpar descrição', 'Borrar búsqueda')} onClick={clearQuery}><img src="/assets/home-evolution/phrase-close.svg" alt="" aria-hidden="true"/></button>}
              <span
                className="home-start-slot"
                data-visible="true"
                data-needs-location={needsLocationTip || undefined}
                data-tip-open={startTipOpen || undefined}
                tabIndex={needsLocationTip ? 0 : undefined}
                onPointerDown={needsLocationTip ? pokeStartTip : undefined}
                onMouseEnter={needsLocationTip ? () => setStartTipOpen(true) : undefined}
                onMouseLeave={needsLocationTip ? () => {clearTimeout(startTipTimer.current); setStartTipOpen(false);} : undefined}
                onFocus={needsLocationTip ? () => setStartTipOpen(true) : undefined}
                onBlur={needsLocationTip ? () => setStartTipOpen(false) : undefined}
                onKeyDown={needsLocationTip ? event => {if (event.key === 'Enter' || event.key === ' ') pokeStartTip(event);} : undefined}>
                <button className="home-start" type="submit" disabled={!canSubmit || homeDeparting} aria-busy={homeDeparting || undefined} aria-describedby={needsLocationTip ? 'home-start-tip home-search-help' : undefined} tabIndex={needsLocationTip ? -1 : undefined}>{t('Comenzar a buscar')}<img src={homeAsset(canSubmit && !homeDeparting ? 'arrow' : 'arrow-disabled')} alt=""/></button>
                {needsLocationTip && <span id="home-start-tip" className="home-start-tip" role="tooltip">
                  <img className="home-start-tip-mark" src={MORA_MARK} alt="" width="20" height="20" decoding="async" aria-hidden="true"/>
                  <span className="home-start-tip-copy">{locationTipCopy}</span>
                </span>}
              </span>
            </div>
          </div>
        </div>
        <p className="sr-only" role="status" aria-live="polite">{suggestActive ? `${say('Sugestão', 'Sugerencia')}: ${typingSuggest.text}` : ''}{canSubmit ? say('Sua busca está pronta para começar.', 'Tu búsqueda está lista para empezar.') : say('Mencione onde você quer morar para começar.', 'Menciona dónde quieres vivir para empezar.')}{filterSummary ? ` ${filterSummary}` : ''}</p>
        <span id="home-search-help" className="sr-only">{say('Escreva um bairro, uma rua ou um lugar do catálogo na descrição para ativar a busca. Vários lugares podem ser combinados.', 'Escribe un barrio, una calle o un lugar del catálogo en la descripción para activar la búsqueda. Puedes combinar varios lugares.')}</span>
      </div> : <>
      <h1>{layout === 'original' ? t('Describe el hogar que imaginas') : say('Refine a sua busca', 'Refina tu búsqueda')}</h1>
      {layout === 'original' && originalDraft.note.trim() && <button type="button" className="home-query-clear" aria-label={say('Limpar descrição', 'Borrar búsqueda')} onClick={clearOriginal}><img src="/assets/home-evolution/phrase-close.svg" alt="" aria-hidden="true"/></button>}
      {!intro.done && <button type="button" className="home-skip-intro" style={{right:64}} aria-label={say('Pular animação', 'Saltar animación')} onClick={skipAnimation}>{say('Pular', 'Saltar')}<span aria-hidden="true">↗</span></button>}
      <div ref={sentenceRef} className="home-sentence" aria-busy={!ready}>
        {SENTENCE_LINES.map((groups, line) => <span className="home-sentence-line" key={line}>{groups.map(indices => <span className="home-phrase-group" key={indices[0]}>{indices.map(index => {
          const part = parts[index];
          const word = intro.words[index];
          const tip = !ready && intro.activeWord === index;
          const picked = layout === 'original' ? originalChosen[part.key] : choices[part.key];
          const sweeping = layout === 'original' && originalSweep.has(part.key);
          return <span className={`home-word ${part.key ? 'interactive' : ''}`} key={part.key || index} style={{visibility:word.visible ? 'visible' : 'hidden'}}>
            {preserveIntroLayout && part.key && <span className="home-word-measure home-word-control" aria-hidden="true"><span>{part.text}</span><HomeChevron/></span>}
            {word.control ? <><button type="button" ref={el => {refs.current[part.key] = el;}} data-search-key={part.key} className={`home-word-control ${picked ? 'is-chosen' : ''} ${sweeping ? 'home-filter-enter' : ''} ${word.morphing ? 'just-morphed' : ''}`} style={sweeping ? {'--home-filter-delay':`${['mode','propertyType','beds','area','budget'].indexOf(part.key) * 70}ms`} : undefined} data-motion={menuMotion} aria-label={`${part.label}: ${part.text}`} aria-haspopup={['mode', 'propertyType'].includes(part.key) ? 'listbox' : 'dialog'} aria-expanded={open === part.key} onClick={event => activate(part.key, event.detail > 0)} onKeyDown={e => {if (e.key === 'ArrowDown') {e.preventDefault();activate(part.key, false);}}}><span key={selection.key === part.key ? selection.version : 0} className={`home-choice-label ${selection.key === part.key && selection.animate ? 'just-selected' : ''}`}>{variant === 'results' && !intro.done ? <StreamedWord word={intro.timeline.words[index]} count={word.count}/> : part.text}</span><HomeChevron reveal={variant === 'results' && !intro.done}/></button>{word.morphing && <span className="home-word-echo" aria-hidden="true">{part.text}</span>}{tip && <span className="home-control-tip" data-writing-tip aria-hidden="true"/>}</>
              : intro.done ? <span className={part.soft ? 'home-word-soft' : undefined}>{part.text}</span> : <>{(!preserveIntroLayout || !part.key) && <span className="home-word-measure" aria-hidden="true">{part.text}</span>}<span className="home-word-stream" aria-hidden="true"><StreamedWord word={intro.timeline.words[index]} count={word.count}/>{tip && <span data-writing-tip/>}</span></>}
          </span>;
        })}</span>)}
        {line === SENTENCE_LINES.length - 1 && (revealExtras ? React.Children.map(extraContent, child => React.cloneElement(child, {className:`${child.props.className}${extrasVisible ? ' home-soft-word' : ''}`, style:{...child.props.style,visibility:extrasVisible ? 'visible' : 'hidden'}})) : extraContent)}
        </span>)}
      </div>
      <div className="home-detail-row">
        {detailContent || (ready ? <SearchDetails value={layout === 'original' ? originalDraft.note : search.note} onChange={note => layout === 'original' ? typeOriginal(note) : setSearch(updateSearchNote(search, note))} language={language}/>
          : <div className="home-detail-stream" aria-hidden="true"><StreamedWord word={intro.timeline.words.at(-1)} count={intro.words.at(-1).count}/>{intro.activeWord === parts.length - 1 && <span data-writing-tip/>}</div>)}
        {layout === 'original' && <span
          key={originalTake}
          className="home-start-slot"
          data-visible="true"
          data-needs-location={needsLocationTip || undefined}
          data-tip-open={startTipOpen || undefined}
          tabIndex={needsLocationTip ? 0 : undefined}
          onPointerDown={needsLocationTip ? pokeStartTip : undefined}
          onMouseEnter={needsLocationTip ? () => setStartTipOpen(true) : undefined}
          onMouseLeave={needsLocationTip ? () => {clearTimeout(startTipTimer.current); setStartTipOpen(false);} : undefined}
          onFocus={needsLocationTip ? () => setStartTipOpen(true) : undefined}
          onBlur={needsLocationTip ? () => setStartTipOpen(false) : undefined}
          onKeyDown={needsLocationTip ? event => {if (event.key === 'Enter' || event.key === ' ') pokeStartTip(event);} : undefined}>
          <button className="home-start" type="submit" disabled={!canSubmit} aria-describedby={needsLocationTip ? 'home-start-tip home-search-help' : undefined} tabIndex={needsLocationTip ? -1 : undefined}>{t('Comenzar a buscar')}<img src={homeAsset(canSubmit ? 'arrow' : 'arrow-disabled')} alt=""/></button>
          {needsLocationTip && <span id="home-start-tip" className="home-start-tip" role="tooltip">
            <img className="home-start-tip-mark" src={MORA_MARK} alt="" width="20" height="20" decoding="async" aria-hidden="true"/>
            <span className="home-start-tip-copy">{locationTipCopy}</span>
          </span>}
        </span>}
        {layout === 'original' && <span id="home-search-help" className="sr-only">{say('Escolha um bairro, uma rua ou um lugar do catálogo para ativar a busca. Vários lugares podem ser combinados.', 'Elige un barrio, una calle o un lugar del catálogo para activar la búsqueda. Puedes combinar varios lugares.')}</span>}
      </div>
      </>}
    </form>
    <HomePopover open={!!open} animate={menuMotion} anchor={menuAnchor.current || refs.current[open]} label={open === 'amenity' ? say('Comodidades', 'Comodidades') : open === 'baths' ? say('Número de banheiros', 'Número de baños') : open === 'parking' ? say('Número de vagas', 'Número de estacionamientos') : parts.find(part => part.key === open)?.label} kind={list.length || open === 'amenity' ? 'list' : open} variant={open} onClose={close}>
      {list.map(([key, pt, es]) => <button type="button" className="home-option" role="option" aria-selected={key === (open === 'mode' ? view.mode : type) && (variant === 'home' || !!choices[open])} key={key} onClick={event => {change(open, key, event.detail > 0);close(true, event.detail > 0);}}>{say(pt, es)}</button>)}
      {open === 'amenity' && CRITERIA.map(item => <button type="button" className="home-option" role="option" aria-selected={amenityIds.includes(item.id)} key={item.id} onClick={event => {toggleCriterion(item.id);close(true, event.detail > 0);}}>{criterionLabel(item.id, language)}</button>)}
      {open === 'beds' && <div className="home-bed-stepper"><StepButton label={say('Diminuir quartos', 'Reducir recámaras')} disabled={view.beds <= 1} onClick={() => change('beds', view.beds - 1)}/><output aria-live="polite" key={view.beds}>{view.beds}+</output><StepButton plus label={say('Aumentar quartos', 'Aumentar recámaras')} disabled={view.beds >= 10} onClick={() => change('beds', view.beds + 1)}/></div>}
      {open === 'baths' && <div className="home-bed-stepper"><StepButton label={say('Diminuir banheiros', 'Reducir baños')} disabled={bathCount <= 1} onClick={() => change('baths', bathCount - 1)}/><output aria-live="polite" key={bathCount}>{bathCount}+</output><StepButton plus label={say('Aumentar banheiros', 'Aumentar baños')} disabled={bathCount >= 10} onClick={() => change('baths', bathCount + 1)}/></div>}
      {open === 'parking' && <div className="home-bed-stepper"><StepButton label={say('Diminuir vagas', 'Reducir estacionamientos')} disabled={parkingCount <= 1} onClick={() => change('parking', parkingCount - 1)}/><output aria-live="polite" key={parkingCount}>{parkingCount}+</output><StepButton plus label={say('Aumentar vagas', 'Aumentar estacionamientos')} disabled={parkingCount >= 6} onClick={() => change('parking', parkingCount + 1)}/></div>}
      {open === 'area' && <><LocationSearch label={say('Buscar localização', 'Buscar ubicación')} placeholder={say('Bairro, rua, metrô, escola…', 'Colonia, calle, metro, escuela…')} clearLabel={say('Limpar localização', 'Borrar ubicación')} value={locationTerm} onChange={setLocationTerm}/><LocationMenu label={t('Zona para vivir')} places={locationChoices} selectedKeys={activePlaces.map(place => place.key)} say={say} onChoose={(place, event) => {togglePlace(place);close(true, event.detail > 0);}} onRemove={togglePlace} empty={locationTerm.trim().length >= 2 && !locationChoices.length ? say('Nenhum lugar encontrado. Tente outro nome.', 'No encontramos ese lugar. Prueba otro nombre.') : null}/></>}
      {open === 'budget' && <BudgetPicker search={view} say={say} onChange={values => {if (layout === 'original') {setOriginalDraft(current => ({...current, ...values}));onChoose('budget');return;}if (variant === 'home') {dirty.current = true;setOverrides(current => ({...current, budget:values.budget, ...(values.minBudget != null ? {minBudget:values.minBudget} : {})}));syncQueryFromChip('budget', values.budget, `${money(values.budget)} ${currency}`);onChoose('budget');return;}setSearch({...search, ...values});onChoose('budget');}}/>}
    </HomePopover>
  </section>;
}
