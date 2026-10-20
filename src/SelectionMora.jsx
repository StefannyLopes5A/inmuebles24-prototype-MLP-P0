import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {homes} from './data.js';
import {useLanguage} from './i18n.jsx';
import {MORA_MARK, MoraSignature, MoraThinking, MoraWords, useMoraReveal, wordCount} from './MoraVoice.jsx';
import {MORA_THINK_MS} from './moraChat.jsx';
import {SOFT_MOTION} from './homeIntro.js';
import {selectableText, selectionAnswer} from './selectionAsk.js';

const GAP = 8;
const EDGE = 16;
const WIDTH = 344;
/** Above the selection only when the answer has room to grow upward; otherwise it opens below. */
const ROOM = 240;
const PILL = 56;
const SKIP = 'input, textarea, select, button, [contenteditable=""], [contenteditable="true"], .maplibregl-map, [data-feedback-toolbar], .selection-mora';
const HIGHLIGHT = 'mora-selection';
const canHighlight = () => typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';

function elementOf(node) {
  return node?.nodeType === 1 ? node : node?.parentElement || null;
}

function readSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const text = selectableText(selection.toString());
  if (!text) return null;
  const range = selection.getRangeAt(0);
  const element = elementOf(range.commonAncestorContainer);
  if (!element || [range.startContainer, range.endContainer].some(node => elementOf(node)?.closest(SKIP))) return null;
  if (!range.getClientRects().length) return null;
  return {text, range:range.cloneRange(), element};
}

/** Fixed placement from the first line of the selection; `side` stays the same while it is open, so it never flips. */
function placeFor(range, side) {
  const rects = [...range.getClientRects()].filter(rect => rect.width || rect.height);
  const first = rects[0];
  if (!first) return null;
  const box = range.getBoundingClientRect();
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  if (box.bottom < 0 || box.top > vh) return null;
  const width = Math.min(WIDTH, vw - EDGE * 2);
  const anchor = first.left + first.width / 2;
  const left = Math.min(Math.max(anchor - width / 2, EDGE), vw - EDGE - width);
  const above = first.top - GAP - EDGE, below = vh - box.bottom - GAP - EDGE;
  const coarse = matchMedia('(pointer: coarse)').matches;
  // Touch keeps the space above the selection for the system's copy menu.
  const pick = side || (coarse
    ? below >= PILL || below >= above ? 'below' : 'above'
    : above >= PILL && (above >= ROOM || above >= below) ? 'above' : 'below');
  const origin = `${Math.round(Math.min(Math.max(anchor - left, 24), width - 24))}px ${pick === 'above' ? '100%' : '0%'}`;
  return pick === 'above'
    ? {side:pick, left, width, bottom:vh - first.top + GAP, max:Math.max(PILL, above), origin}
    : {side:pick, left, width, top:box.bottom + GAP, max:Math.max(PILL, below), origin};
}

function homeFor(element, contextHome) {
  const id = element.closest('[data-home-id]')?.dataset.homeId;
  if (id) return homes.find(home => home.id === id) || null;
  return element.closest('.lp-shell, .listing-route') ? contextHome || null : null;
}

function SendGlyph() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>;
}

function Answer({snap, turn, say, onAsk}) {
  const {ready, animate} = useMoraReveal(`selection:${turn.id}`, MORA_THINK_MS);
  const {answer} = turn;
  const settle = animate ? (wordCount(answer.text) - 1) * SOFT_MOTION.wordStep + SOFT_MOTION.fade * 0.6 : 0;
  return <div className="selection-mora-answer">
    <MoraSignature context={say('sobre este texto', 'sobre este texto')} working={!ready}/>
    <p className="selection-mora-quote" title={snap.text}>«{snap.text}»</p>
    <p className="selection-mora-question">{turn.question}</p>
    <div className="selection-mora-reply" aria-live="polite">
      {ready
        ? <MoraWords key={turn.id} text={answer.text} animate={animate} className="selection-mora-words"/>
        : <MoraThinking text={say('Revisando este texto…', 'Revisando este texto…')}/>}
    </div>
    {ready && <div className="selection-mora-after" style={{'--settle':`${settle}ms`}}>
      {answer.note && <p className="selection-mora-note">{answer.note}</p>}
      <div className="selection-mora-chips">
        {answer.chips.map(chip => <button key={chip} type="button" onClick={() => onAsk(chip)}>{chip}</button>)}
      </div>
    </div>}
  </div>;
}

/** Mora on any text the person selects: a pill born from the selection that grows into her answer, in place. */
export function SelectionMora({contextHome = null, routeKey = ''}) {
  const {language} = useLanguage();
  const say = (br, es) => language === 'pt-BR' ? br : es;
  const [snap, setSnap] = useState(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const [turn, setTurn] = useState(null);
  const [draft, setDraft] = useState('');
  const root = useRef(null), body = useRef(null), input = useRef(null);
  const live = useRef({snap:null, open:false, place:null, contextHome});
  const suppress = useRef(false);
  live.current = {snap, open, place, contextHome};

  function close() {
    if (!live.current.open) return;
    setOpen(false);
    if (canHighlight()) CSS.highlights.delete(HIGHLIGHT);
  }

  function show(next) {
    const current = live.current.snap;
    const same = live.current.open && current?.text === next.text && current.range.compareBoundaryPoints(Range.START_TO_START, next.range) === 0;
    const placement = placeFor(next.range, same ? live.current.place?.side : null);
    if (!placement) { close(); return; }
    setPlace(placement);
    if (same) return;
    setSnap({id:Date.now(), text:next.text, range:next.range, home:homeFor(next.element, live.current.contextHome),
      zone:next.element.closest('#pp-reviews, .pp-reviews, .pp-reviews-compact') ? 'review' : null,
      around:(next.element.closest('li, p, dd, tr') || next.element).textContent.replace(/\s+/g, ' ').trim().slice(0, 200)});
    setTurn(null);
    setDraft('');
    setOpen(true);
    if (canHighlight()) CSS.highlights.set(HIGHLIGHT, new Highlight(next.range));
  }

  useEffect(() => {
    let timer, pressing = false;
    const evaluate = () => {
      if (suppress.current) { suppress.current = false; return; }
      // Typing in the widget moves the document selection into its field; the snapshot stays.
      if (root.current?.contains(document.activeElement)) return;
      const next = readSelection();
      if (next) show(next); else close();
    };
    const changed = () => { clearTimeout(timer); if (!pressing) timer = setTimeout(evaluate, 200); };
    const down = event => {
      if (root.current?.contains(event.target)) return;
      pressing = true;
      clearTimeout(timer);
      close();
    };
    const up = () => {
      if (!pressing) return;
      pressing = false;
      clearTimeout(timer);
      timer = setTimeout(evaluate, 10);
    };
    const key = event => {
      if (event.key !== 'Escape' || !live.current.open) return;
      event.preventDefault();
      event.stopPropagation();
      const range = live.current.snap?.range;
      const inside = root.current?.contains(document.activeElement);
      close();
      if (inside) {
        document.activeElement.blur();
        if (range && !range.collapsed) {
          suppress.current = true;
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    };
    document.addEventListener('selectionchange', changed);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    window.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', changed);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      window.removeEventListener('keydown', key, true);
      if (canHighlight()) CSS.highlights.delete(HIGHLIGHT);
    };
    // `show` and `close` read the latest state through `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { close(); }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the selection while it scrolls; once it leaves the screen, the widget goes with it.
  useEffect(() => {
    if (!open || !snap) return undefined;
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = placeFor(snap.range, place?.side);
        if (next) setPlace(next); else close();
      });
    };
    window.addEventListener('scroll', follow, {capture:true, passive:true});
    window.addEventListener('resize', follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', follow, {capture:true});
      window.removeEventListener('resize', follow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, snap, place?.side]);

  // The box follows its content's height: set at once for a new selection, transitioned for an answer.
  useLayoutEffect(() => {
    const outer = root.current, inner = body.current;
    if (!outer || !inner) return undefined;
    outer.style.transitionProperty = 'opacity, transform, visibility';
    outer.style.height = `${inner.offsetHeight}px`;
    void outer.offsetHeight;
    outer.style.transitionProperty = '';
    const observer = new ResizeObserver(() => { outer.style.height = `${inner.offsetHeight}px`; });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [snap?.id]);

  function ask(question) {
    if (!snap) return;
    const text = question.trim() || say('O que você me diz disto?', '¿Qué me dices de esto?');
    setTurn({id:Date.now(), question:text, answer:selectionAnswer({text:snap.text, question:text, home:snap.home, zone:snap.zone, around:snap.around, language})});
    setDraft('');
  }

  const style = place ? {left:place.left, width:place.width, top:place.top, bottom:place.bottom, maxHeight:place.max, '--origin':place.origin} : undefined;
  return createPortal(<div ref={root} className="selection-mora" role="dialog" aria-label={say('Perguntar à Mora sobre o texto selecionado', 'Preguntar a Mora sobre el texto seleccionado')}
    data-open={open && !!place} data-side={place?.side} inert={!open || undefined} style={style}>
    <div ref={body} className="selection-mora-body">
      {snap && turn && <Answer key={turn.id} snap={snap} turn={turn} say={say} onAsk={ask}/>}
      <form className="selection-mora-ask" onSubmit={event => { event.preventDefault(); ask(draft); }}>
        <img src={MORA_MARK} alt="" width="20" height="20"/>
        <input ref={input} value={draft} onChange={event => setDraft(event.target.value)} enterKeyHint="send" autoComplete="off"
          onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); ask(draft); } }}
          placeholder={turn ? say('Pergunte outra coisa', 'Pregunta otra cosa') : say('Pergunte o que quiser', 'Pregunta lo que quieras')}
          aria-label={say('Sua pergunta para a Mora', 'Tu pregunta para Mora')}/>
        <button type="submit" className="selection-mora-send" aria-label={say('Perguntar à Mora', 'Preguntar a Mora')}><SendGlyph/></button>
      </form>
    </div>
  </div>, document.body);
}
