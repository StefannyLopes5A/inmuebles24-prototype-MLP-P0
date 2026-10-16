import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {homes, propertyPhoto} from './data';
import {moraAnalysis} from './moraAnalysis';
import {withFixture} from './moraFixture.js';
import {developmentAnalysis, unitAnalysis} from './development/moraDevelopment.js';
import {EASE_FADE, MORA_LINE_SWAP, MORA_WORK, SPRING_SETTLE, SPRING_SIZE} from './listingPanelMotion';
import {SOFT_MOTION} from './homeIntro.js';

const GLYPHS = {
  price:'M12 3v18M16.5 7.2C15.6 5.9 14 5 12 5c-2.5 0-4.5 1.4-4.5 3.4 0 4.6 9 2.4 9 7 0 2-2 3.6-4.5 3.6-2.2 0-4-1-4.8-2.5',
  favorites:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  transport:'M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM4 10h16M8 21l2-4m6 4-2-4M8.5 13.5h.01m7 0h.01',
  green:'M12 21v-5m0-13a6 6 0 0 1 6 6 4.5 4.5 0 0 1-2 8.5H8A4.5 4.5 0 0 1 6 9a6 6 0 0 1 6-6Z',
  food:'M4 9h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6V9Zm13 1h1a3 3 0 0 1 0 6h-1.3M8 3v3m4-3v3',
  education:'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5',
  health:'M12 5v14M5 12h14',
  grocery:'M3 4h2l2.4 11h10.2L20 8H6.2M9 20h.01M17 20h.01',
  restaurant:'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-1.7 0-3 2-3 5s1.3 4 3 4v9',
  shop:'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5',
  work:'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  met:'M5 12.5l4.5 4.5L19 7.5',
  unmet:'M7 7l10 10M17 7 7 17',
  unknown:'M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4.2M12 18h.01',
  remodel:'M14.5 4.5l5 5M4 20l1.2-4.6L15.7 4.9a1.8 1.8 0 0 1 2.5 0l.9.9a1.8 1.8 0 0 1 0 2.5L8.6 18.8 4 20Z',
  outdoor:'M12 4V2.5M12 21.5V20M4 12H2.5M21.5 12H20M6.3 6.3 5.2 5.2M18.8 18.8l-1.1-1.1M6.3 17.7l-1.1 1.1M18.8 5.2l-1.1 1.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  camera:'M4 8h3l1.5-2.5h7L17 8h3v11H4V8ZM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z',
  view:'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM14.8 12a2.8 2.8 0 1 1-5.6 0 2.8 2.8 0 0 1 5.6 0Z',
  light:'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z',
  levels:'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5',
  furnished:'M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5ZM5 18v2M19 18v2',
};

export function Glyph({name, size = 16}) {
  return <svg className="lp-glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={GLYPHS[name] || GLYPHS.price}/></svg>;
}

const FIXTURES = Object.fromEntries(Object.values(import.meta.glob('./data/mora-fixtures/*.json', {eager:true, import:'default'})).map(fixture => [fixture.meta.listingId, fixture]));

const shown = new Map();

function useMoraCycle(home, options, signature) {
  const key = `${home.id}|${signature}`;
  const [state, setState] = useState(() => shown.has(key) ? {status:'ready', analysis:shown.get(key), cached:true} : {status:'working', line:0, lines:[]});
  useEffect(() => {
    if (shown.has(key)) { setState(current => current.cached && current.analysis === shown.get(key) ? current : {status:'ready', analysis:shown.get(key), cached:true}); return; }
    let alive = true;
    const timers = [];
    let analysis = null;
    try {
      analysis = options?.unit
        ? unitAnalysis(options.unit, options)
        : home.development ? developmentAnalysis(options) : withFixture(moraAnalysis(home, options), FIXTURES[home.id], options);
    } catch { analysis = null; }
    const lines = analysis?.workingLines || [];
    // The tiles take their final shape right away, as skeletons, so the panel never sits half empty while Mora works.
    const shape = (analysis?.modules || []).map(module => ({kind:module.kind, rows:module.items?.length || 0, avatars:module.favoriteIds?.length || 0}));
    setState({status:'working', line:0, lines, shape});
    // Mora already knows the search, so thinking is only the comparison and the surroundings, split over a fixed budget.
    const step = MORA_WORK / Math.max(1, lines.length);
    for (let line = 1; line < lines.length; line += 1) timers.push(setTimeout(() => alive && setState(current => current.status === 'working' ? {...current, line} : current), line * step));
    timers.push(setTimeout(() => {
      if (!alive) return;
      if (analysis) shown.set(key, analysis);
      setState(analysis ? {status:'ready', analysis} : {status:'error'});
    }, MORA_WORK));
    return () => {alive = false; timers.forEach(clearTimeout);};
    // The key covers every option that changes the reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Border-box height of the inner content, so the outer box can spring to it instead of jumping. */
function useContentHeight(fallback) {
  const ref = useRef(null);
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    setHeight(node.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, height];
}

function Ruler({ruler, delay, reduce, short, say}) {
  const span = ruler.p90 - ruler.p10;
  const median = Math.min(1, Math.max(0, (ruler.median - ruler.p10) / span));
  const target = `${(ruler.position * 100).toFixed(2)}%`;
  const range = ruler.range === 'below' ? say('abaixo da faixa', 'abajo del rango') : ruler.range === 'above' ? say('acima da faixa', 'arriba del rango') : null;
  return <div className="lp-ruler">
    <div className="lp-ruler-track" aria-hidden="true">
      <span className="lp-ruler-median" style={{left:`${median * 100}%`}}/>
      <motion.span className="lp-ruler-rail" initial={{x:reduce ? target : '0%'}} animate={{x:target}} transition={reduce ? {duration:0} : {...SPRING_SETTLE, delay}}>
        <span className="lp-ruler-value" style={{transform:`translateX(${(-ruler.position * 100).toFixed(2)}%)`}}>{say('Este', 'Este')} {short(ruler.value)}/m²</span>
        <span className="lp-ruler-marker"/>
      </motion.span>
    </div>
    <div className="lp-ruler-scale" aria-hidden="true">
      <span>{short(ruler.p10)}/m²</span>
      <span className="lp-ruler-note"><span className="lp-ruler-tick"/>{say(`Mediana ${short(ruler.median)}/m²`, `Mediana ${short(ruler.median)}/m²`)}{range ? ` · ${range}` : ''}</span>
      <span>{short(ruler.p90)}/m²</span>
    </div>
    <p className="sr-only">{say(`Este imóvel: ${short(ruler.value)}/m². Faixa da região de ${short(ruler.p10)} a ${short(ruler.p90)} por m², mediana ${short(ruler.median)}.`, `Este inmueble: ${short(ruler.value)}/m². Rango de la zona de ${short(ruler.p10)} a ${short(ruler.p90)} por m², mediana ${short(ruler.median)}.`)}</p>
  </div>;
}

/** Every Mora tile springs to its content height, so whatever sits below slides instead of jumping. */
function Tile({kind, index, reduce, children}) {
  const [ref, height] = useContentHeight(0);
  const delay = index * 0.06;
  return <motion.li className="lp-module-slot" initial={reduce ? false : {height:0, opacity:0}} animate={{height, opacity:1}}
    transition={reduce ? {duration:0} : {height:{...SPRING_SIZE, delay}, opacity:{duration:0.24, ease:EASE_FADE, delay}}}>
    <motion.div ref={ref} className="lp-module-gap" initial={reduce ? false : {y:12}} animate={{y:0}} transition={reduce ? {duration:0} : {...SPRING_SIZE, delay}}>
      <div className="lp-module" data-kind={kind}>{children}</div>
    </motion.div>
  </motion.li>;
}

const Bar = ({width, height}) => <i className="lp-skel" style={{width, height}}/>;

/** Placeholder with the final layout of each kind, so the swap to real content barely moves. */
function Skeleton({shape}) {
  if (shape.kind === 'opportunity') return <>
    <div className="lp-tile-head">
      <div className="lp-tile-copy lp-skel-copy">
        <p className="lp-tile-title"><Bar width="58%" height={12}/></p>
        <p><Bar width="82%"/></p>
      </div>
      <p className="lp-tile-metric"><Bar width={64} height={20}/><span><Bar width={72}/></span></p>
    </div>
    <div className="lp-ruler">
      <i className="lp-skel lp-skel-track"/>
      <div className="lp-ruler-scale"><Bar width={52}/><Bar width={110}/><Bar width={52}/></div>
    </div>
  </>;
  if (shape.kind === 'favorites') return <div className="lp-favorites">
    <span className="lp-avatars">{Array.from({length:Math.max(1, shape.avatars)}, (_, i) => <i key={i} className="lp-skel lp-avatar"/>)}</span>
    <p className="lp-tile-title lp-skel-copy"><Bar width="90%" height={12}/></p>
    <Bar width={92} height={36}/>
  </div>;
  if (shape.kind === 'photos') return <div className="lp-photos">
    <i className="lp-skel lp-photo-proof"/>
    <div className="lp-tile-copy lp-skel-copy"><p className="lp-tile-title"><Bar width="86%" height={12}/></p><p><Bar width="64%"/></p></div>
  </div>;
  if (shape.kind === 'neighborhood') return <>
    <p className="lp-tile-title lp-skel-copy"><Bar width="78%" height={12}/></p>
    <p className="lp-hood-chips"><Bar width={88} height={24}/><Bar width={96} height={24}/></p>
    {shape.rows > 0 && <ul className="lp-places">{Array.from({length:shape.rows}, (_, i) => <li key={i} className="lp-skel-row">
      <Bar width={16} height={16}/><b><Bar width={`${48 + (i * 17) % 30}%`}/></b><Bar width={64}/>
    </li>)}</ul>}
  </>;
  if (shape.kind === 'attention') return <div className="lp-attention">
    <Bar width={16} height={16}/>
    <div className="lp-tile-copy lp-skel-copy">
      <p className="lp-tile-title"><Bar width="86%" height={12}/></p>
      <p className="lp-tile-action"><Bar width={150}/></p>
    </div>
  </div>;
  return <ul className="lp-places">{Array.from({length:Math.max(1, shape.rows)}, (_, i) => <li key={i} className="lp-skel-row">
    <Bar width={16} height={16}/><b><Bar width={`${48 + (i * 17) % 30}%`}/></b><Bar width={64}/>
  </li>)}</ul>;
}

function Body({delay, reduce, children}) {
  return <motion.div className="lp-module-body" initial={reduce ? false : {opacity:0, y:4}} animate={{opacity:1, y:0}} transition={{duration:reduce ? 0 : 0.28, ease:EASE_FADE, delay:reduce ? 0 : delay}}>{children}</motion.div>;
}

function Module({home, module, delay, reduce, short, say, onFavorite, onCompare, onAsk, onPhoto}) {
  if (module.kind === 'opportunity') return <Body delay={delay} reduce={reduce}>
    <div className="lp-tile-head">
      <div className="lp-tile-copy">
        <p className="lp-tile-title">{module.label}</p>
        <p>{module.support}</p>
      </div>
      {module.metric && <p className="lp-tile-metric">{module.metric.value}<span>{module.metric.unit}</span></p>}
    </div>
    {module.ruler && <Ruler ruler={module.ruler} delay={delay + 0.16} reduce={reduce} short={short} say={say}/>}
  </Body>;
  if (module.kind === 'favorites') {
    const saved = module.favoriteIds.map(id => homes.find(home => home.id === id)).filter(Boolean);
    return <Body delay={delay} reduce={reduce}>
      <div className="lp-favorites">
        <span className="lp-avatars">{saved.map((item, i) => <motion.button type="button" key={item.id} className="lp-avatar" onClick={() => onFavorite(item.id)} aria-label={say(`Abrir favorito ${item.street}`, `Abrir favorito ${item.street}`)}
          initial={reduce ? false : {opacity:0, transform:'translateX(-6px)'}} animate={{opacity:1, transform:'translateX(0px)'}} transition={{duration:0.2, ease:EASE_FADE, delay:reduce ? 0 : delay + 0.1 + i * 0.05}}>
          <img src={propertyPhoto(item)} alt=""/>
        </motion.button>)}</span>
        <p className="lp-tile-title">{module.text}</p>
        {onCompare && saved.length > 0 && <button type="button" className="lp-favorites-compare" onClick={() => onCompare([home.id, ...saved.map(item => item.id)])}
          aria-label={saved.length === 1 ? say(`Comparar com ${saved[0].street}`, `Comparar con ${saved[0].street}`) : say(`Comparar com ${saved.length} favoritos`, `Comparar con ${saved.length} favoritos`)}>
          {say('Comparar', 'Comparar')}
        </button>}
      </div>
    </Body>;
  }
  if (module.kind === 'photos') return <Body delay={delay} reduce={reduce}>
    <button type="button" className="lp-photos" onClick={() => onPhoto?.(module.index ?? Math.max(0, (module.photo || 1) - 1))}>
      <img src={module.image} alt=""/>
      <span className="lp-tile-title">{module.text}</span>
    </button>
  </Body>;
  if (module.kind === 'neighborhood') return <Body delay={delay} reduce={reduce}>
    <p className="lp-tile-title">{module.text}</p>
    {(module.plus?.length || module.minus?.length) ? <p className="lp-hood-chips">
      {(module.plus || []).map(label => <span className="lp-hood-chip" key={label}>{label}</span>)}
      {(module.minus || []).map(label => <span className="lp-hood-chip is-minus" key={label}>{label}</span>)}
    </p> : null}
    {module.items?.length ? <Places items={module.items}/> : null}
  </Body>;
  if (module.kind === 'text' || module.kind === 'results') return <Body delay={delay} reduce={reduce}>
    <p className="lp-tile-title">{module.text}</p>
  </Body>;
  if (module.kind === 'attention') return <Body delay={delay} reduce={reduce}>
    <div className="lp-attention">
      <Glyph name="unknown"/>
      <div className="lp-tile-copy">
        <p className="lp-tile-title">{module.text}</p>
        {onAsk && <button type="button" className="lp-tile-action" onClick={() => onAsk(module.action.question)}>{module.action.label}</button>}
      </div>
    </div>
  </Body>;
  if (!module.items) return null;
  return <Body delay={delay} reduce={reduce}>
    {module.text && <p className="lp-tile-title">{module.text}</p>}
    <Places items={module.items}/>
  </Body>;
}

function Places({items}) {
  return <ul className="lp-places">{items.map(item => <li key={item.text}><Glyph name={item.icon}/><span>{item.place}</span><span>{item.time}</span></li>)}</ul>;
}

function Words({text, instant, ref}) {
  const words = text.split(/\s+/);
  const [streaming, setStreaming] = useState(!instant);
  useEffect(() => {
    if (!streaming) return undefined;
    const timer = setTimeout(() => setStreaming(false), (words.length - 1) * SOFT_MOTION.wordStep + SOFT_MOTION.fade);
    return () => clearTimeout(timer);
  }, [streaming, words.length]);
  // The brand shine clips to the sentence's text, which the inked words (their own layers while animating) would escape, so it starts once they land.
  return <p ref={ref} key="synthesis" className="lp-mora-synthesis" data-streaming={streaming || undefined} data-shine={streaming ? undefined : true}>{words.map((word, i) => <React.Fragment key={i}>
    {i > 0 && ' '}
    <span className="lp-word" style={streaming ? {animationDelay:`${i * SOFT_MOTION.wordStep}ms`, animationDuration:`${SOFT_MOTION.fade}ms`} : undefined}>{word}</span>
  </React.Fragment>)}</p>;
}

/** The facts Mora brought back from the listing, read like a row of amenities: what it is, then where she saw it. */
function VerdictFacts({facts, delay, reduce}) {
  if (!facts.length) return null;
  return <ul className="lp-verdict-facts">{facts.map((fact, i) => <motion.li key={fact.id} initial={reduce ? false : {opacity:0, y:6}} animate={{opacity:1, y:0}}
    transition={reduce ? {duration:0} : {duration:0.32, ease:EASE_FADE, delay:delay + i * 0.08}}>
    <Glyph name={fact.icon} size={24}/>
    <span><strong>{fact.title}</strong><span>{fact.note}</span></span>
  </motion.li>)}</ul>;
}

/** This listing's m² next to what similar ones ask, as two bars on one scale. */
function PriceBars({bars, delay, reduce, short}) {
  const top = Math.max(...bars.map(bar => bar.value));
  return <div className="lp-bars" role="img" aria-label={bars.map(bar => `${bar.label}: ${short(bar.value)}/m²`).join(', ')}>
    {bars.map((bar, i) => <div key={bar.label} className={`lp-bar${bar.self ? ' is-self' : ''}`} aria-hidden="true">
      <span>{bar.label}</span>
      <i><motion.b style={{width:`${(bar.value / top * 100).toFixed(1)}%`}} initial={reduce ? false : {scaleX:0}} animate={{scaleX:1}}
        transition={reduce ? {duration:0} : {...SPRING_SETTLE, delay:delay + i * 0.08}}/></i>
      <strong>{short(bar.value)}/m²</strong>
    </div>)}
  </div>;
}

/** The page's reading under the sentence: what helps and what to weigh, each row with the evidence the page can afford. */
function PageReading({reading, delay, reduce, short, say, onAsk, onPhoto}) {
  const groups = [['plus', say('A favor', 'A favor')], ['minus', say('Para pesar', 'A considerar')]].filter(([kind]) => reading[kind].length);
  if (!groups.length) return null;
  return <div className="lp-read">{groups.map(([kind, title], g) => <section key={kind} className="lp-read-group" aria-label={title}>
    <h3>{title}</h3>
    <ul>{reading[kind].map((row, i) => <motion.li key={row.id} initial={reduce ? false : {opacity:0, y:6}} animate={{opacity:1, y:0}}
      transition={reduce ? {duration:0} : {duration:0.32, ease:EASE_FADE, delay:delay + (g * 3 + i) * 0.06}}>
      <Glyph name={row.icon} size={24}/>
      <div className="lp-read-copy">
        <strong>{row.title}</strong>
        {row.bars && <PriceBars bars={row.bars} delay={delay + 0.2} reduce={reduce} short={short}/>}
        {(row.note || (row.ask && onAsk)) && <span>
          {row.note}
          {row.ask && onAsk && <>{row.note && '. '}<button type="button" className="lp-tile-action" onClick={() => onAsk(row.ask.question)}>{row.ask.label}</button></>}
        </span>}
      </div>
      {row.photo && onPhoto && <button type="button" className="lp-read-photo" onClick={event => onPhoto(row.photo.index, event.currentTarget)}
        aria-label={say(`Ver foto: ${row.title}`, `Ver foto: ${row.title}`)}><img src={row.photo.src} alt=""/></button>}
    </motion.li>)}</ul>
  </section>)}</div>;
}

/**
 * Mora's card at the top of a full reading (listing page, development, unit): the mini-listing's sentence, so the
 * reading is recognizable, then everything she found, with the evidence the panel had no room for.
 */
export function MoraOpening({reading, ...props}) {
  return <MoraInsight {...props} options={reading.options} signature={reading.signature} variant="page"/>;
}

export function MoraInsight({home, options, signature, short, say, onFavorite, onCompare, onAsk, onPhoto, exclude, label, note, variant, onVerdict, detail, folded = false}) {
  const reduce = useReducedMotion();
  const state = useMoraCycle(home, options, signature);
  const ready = state.status === 'ready';
  const analysis = state.analysis;
  const instant = reduce || !!state.cached;
  const page = variant === 'page';
  const facts = variant === 'verdict';
  const verdict = facts || page;
  const slots = verdict ? [] : (ready ? analysis.modules : state.shape || []).filter(slot => !exclude?.includes(slot.kind));
  const reading = page && ready ? detail?.(analysis) : null;
  const [voice, voiceHeight] = useContentHeight('auto');
  const swap = reduce ? {duration:0} : MORA_LINE_SWAP;
  useEffect(() => { if (verdict && ready) onVerdict?.(analysis.verdict); }, [verdict, ready, analysis, onVerdict]);
  return <AnimatePresence initial={false}>
    {state.status !== 'error' && <motion.section key="mora" className={`lp-mora${verdict ? ' is-verdict' : ''}${page ? ' is-page' : ''}${folded ? ' is-folded' : ''}`} aria-label={say('Análise da Mora', 'Análisis de Mora')} aria-busy={!ready}
      exit={{opacity:0, transition:{duration:0.2, ease:EASE_FADE}}}>
      <motion.div className="lp-mora-card" initial={false} animate={{height:voiceHeight}} transition={instant ? {duration:0} : SPRING_SIZE}>
        <div ref={voice} className="lp-mora-body">
          <p className="lp-mora-status">
            <img className={`lp-mora-mark${ready || reduce ? '' : ' is-working'}`} src="/assets/mini-listing/mora.svg" alt=""/>
            <strong>Mora</strong>
            {label && <span className="lp-mora-label">{label}</span>}
          </p>
          <div className="lp-mora-lead">
            <div className="lp-mora-voice" aria-live="polite" aria-atomic="true">
              <AnimatePresence mode={verdict ? 'popLayout' : 'wait'} initial={false}>
                {!ready
                  ? <motion.p key={`line-${state.line}`} className="lp-mora-working" aria-hidden="true"
                    initial={reduce ? {opacity:0} : {opacity:0, y:6}} animate={{opacity:1, y:0}} exit={reduce ? {opacity:0} : {opacity:0, y:-6}} transition={swap}>
                    <span>{state.lines[state.line] || state.lines[0] || say('Analisando…', 'Analizando…')}</span>
                  </motion.p>
                  : <Words key="synthesis" text={verdict ? analysis.verdict.sentence : analysis.synthesis} instant={instant}/>}
              </AnimatePresence>
            </div>
            {note && <p className="lp-mora-note">{note}</p>}
          </div>
          {/* Folded, the verdict keeps only its sentence; the card's height spring closes and reopens the space. */}
          <AnimatePresence initial={false}>{facts && ready && !folded && <motion.div key="facts" initial={{opacity:0}} animate={{opacity:1}}
            exit={{opacity:0, transition:{duration:reduce ? 0.15 : 0.12, ease:'easeOut'}}} transition={{duration:reduce ? 0.15 : 0.2, ease:EASE_FADE}}>
            <VerdictFacts facts={analysis.verdict.facts} delay={MORA_LINE_SWAP.duration * 0.6} reduce={instant}/>
          </motion.div>}</AnimatePresence>
          {reading && <PageReading reading={reading} delay={MORA_LINE_SWAP.duration * 0.6} reduce={instant} short={short} say={say} onAsk={onAsk} onPhoto={onPhoto}/>}
        </div>
      </motion.div>
      {slots.length > 0 && <ul className="lp-modules" aria-hidden={ready ? undefined : true}>
        {slots.map((slot, i) => <Tile key={`${slot.kind}-${i}`} index={i} kind={ready ? slot.priceClass : undefined} reduce={instant}>
          {ready
            ? <Module key="ready" home={home} module={slot} delay={MORA_LINE_SWAP.duration + i * 0.08} reduce={instant} short={short} say={say} onFavorite={onFavorite} onCompare={onCompare} onAsk={onAsk} onPhoto={onPhoto}/>
            : <Skeleton key="skeleton" shape={slot}/>}
        </Tile>)}
      </ul>}
    </motion.section>}
  </AnimatePresence>;
}
