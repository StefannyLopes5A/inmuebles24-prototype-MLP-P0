import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {panelContent,spoilerFor} from './mapWidgets';
import {KIND_CATEGORY,POI_CATEGORY,poiIconUrl} from './poiCategories';

const EASE = [0.23, 1, 0.32, 1];
const MORA = '/assets/mini-listing/mora.svg';
const READ_MS = 480;
/** First read of a new scope waits for the map edge to start fading (`map-mora-edge`, 1440 ms). */
const EDGE_READ_MS = 1080;
const seenScopes = new Set();
const seenEdges = new Set();
const seenReadings = new Set();

function LockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

export function PoiGlyph({category, className = 'poi-glyph'}) {
  return <span className={className} style={{'--poi-icon': `url("${poiIconUrl(category)}")`}} aria-hidden="true"/>;
}

export function AmenityIcon({kind}) {
  const category = KIND_CATEGORY[kind];
  if (!category) return null;
  return <PoiGlyph category={category} className="map-widget-bar-icon poi-glyph"/>;
}

/** Same colored pin as the map: category fill, white ring, Maki glyph. */
function PoiDot({kind}) {
  const category = POI_CATEGORY[KIND_CATEGORY[kind] || kind];
  if (!category) return null;
  return <span className="poi-dot" style={{'--poi-color': category.color, '--poi-ink': category.ink}}><PoiGlyph category={category.id}/></span>;
}

function Spark({values, compare, direction}) {
  if (!values?.length) return null;
  const all = compare?.length ? values.concat(compare) : values;
  const rawMax = Math.max(...all), rawMin = Math.min(...all);
  const span = Math.max(rawMax - rawMin, 1);
  const min = rawMin - span * 0.12;
  const max = rawMax + span * 0.12;
  const toPoints = list => list.map((value, index) => {
    const x = (index / Math.max(1, list.length - 1)) * 100;
    const y = 3 + (1 - (value - min) / (max - min)) * 34;
    return `${x},${y}`;
  }).join(' ');
  const color = direction === 'down' ? '#b12b1e' : direction === 'flat' ? '#8a8aa0' : '#2e7d32';
  return <svg className="map-widget-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
    {compare?.length ? <polyline fill="none" stroke="#d0d0d0" strokeWidth="1.2" strokeDasharray="2.5 2.5" strokeLinecap="round" points={toPoints(compare)}/> : null}
    <polyline fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={toPoints(values)}/>
  </svg>;
}

function TrendArrow({direction}) {
  const path = direction === 'down' ? 'M4 4l8 8M12 6v6H6' : direction === 'flat' ? 'M2 8h11M9 4l4 4-4 4' : 'M4 12l8-8M6 4h6v6';
  return <svg className="map-widget-arrow" data-tone={direction} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function SparkLegend({legend}) {
  if (!legend) return null;
  return <p className="map-widget-spark-legend">
    <span><i data-line="solid"/>{legend.subject}</span>
    <span><i data-line="dash"/>{legend.compare}</span>
  </p>;
}

function Track({track}) {
  if (!track) return null;
  return <div className="map-widget-track">
    <span className="map-widget-track-line"><i style={{'--p': `${track.position}%`}}/></span>
    {track.median != null && <b className="map-widget-track-median" style={{'--p': `${track.median}%`}}/>}
    <em className="map-widget-track-mark" style={{'--p': `${track.position}%`}}/>
    <small className="map-widget-track-label" style={{'--p': `${track.position}%`}}>{track.label}</small>
    {track.medianLabel && <small className="map-widget-track-median-label" style={{'--p': `${track.median}%`}}>{track.medianLabel}</small>}
  </div>;
}

function Segments({segments, hover, onHover, onOpen}) {
  return <p className="map-widget-copy">{segments.filter(segment => segment.text).map((segment, index) => segment.widget
    ? <mark key={index} data-hover={hover === segment.widget || undefined}
        onPointerEnter={() => onHover?.(segment.widget, segment.poi)}
        onPointerLeave={() => onHover?.(null)}
        onClick={event => {event.stopPropagation();onOpen?.(segment.widget);}}>{segment.text}</mark>
    : <span key={index}>{segment.text}</span>)}</p>;
}

function LockRow({widget, signedIn, spoiler, onLogin, language}) {
  if (!widget.teaser) return null;
  const action = language === 'pt-BR' ? 'Ver' : 'Ver';
  if (signedIn && spoiler) {
    const label = widget.id === 'trend' || widget.kind === 'trend'
      ? `${spoiler.pct > 0 ? '+' : ''}${spoiler.pct}% ${language === 'pt-BR' ? 'em 12 meses' : 'en 12 meses'}`
      : `${spoiler.fairPerM2 ? `$${new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX').format(spoiler.fairPerM2)}` : ''} MXN/m² ${language === 'pt-BR' ? 'de referência' : 'de referencia'}`;
    return <p className="map-widget-lock is-open"><span>{label}</span></p>;
  }
  return <button type="button" className="map-widget-lock" aria-label={`${widget.teaser}. ${action}`}
    onClick={event => {event.stopPropagation();onLogin?.(widget.id);}}>
    <span className="map-widget-lock-label"><LockIcon/><span>{widget.teaser}</span></span>
    <b>{action}</b>
  </button>;
}

function BarList({rows, poiOn, onTogglePoi, onPick}) {
  if (!rows?.length) return null;
  return <div className="map-widget-bars">{rows.map(row => {
    const interactive = row.kind || row.name;
    const icon = KIND_CATEGORY[row.kind] ? row.kind : null;
    const Tag = interactive ? 'button' : 'div';
    return <Tag key={row.id || row.kind || row.name || row.label} type={interactive ? 'button' : undefined} className="map-widget-bar"
      data-icon={icon || undefined} data-current={row.current == null ? undefined : String(row.current)}
      data-on={row.kind && poiOn?.has(row.kind) || undefined}
      onClick={event => {
        if (!interactive) return;
        event.stopPropagation();
        if (row.kind) onTogglePoi?.(row.kind);
        if (row.name) onPick?.(row.name);
      }}>
      {icon && <AmenityIcon kind={icon}/>}
      <span className="map-widget-bar-main">
        <span className="map-widget-bar-row">
          <span>{row.label}</span>
          {row.detail != null && row.detail !== '' ? <span>{row.detail}</span> : null}
        </span>
        <i style={{'--p': `${row.value}%`}}/>
      </span>
    </Tag>;
  })}</div>;
}

function NearbyTiles({tiles, selected, onSelect}) {
  if (!tiles?.length) return null;
  return <div className="map-widget-tiles" role="group">
    {tiles.map(tile =>
      <button key={tile.kind} type="button" className="map-widget-tile"
        data-on={tile.kind === selected || undefined}
        aria-pressed={tile.kind === selected}
        onClick={event => {event.stopPropagation();onSelect?.(tile);}}>
        <PoiDot kind={tile.kind}/>
        <strong>{tile.metric}</strong>
        <span>{tile.label}</span>
      </button>)}
  </div>;
}

function CardVisual({widget, poiOn, onTogglePoi, onPickColonia}) {
  if (widget.kind === 'matching' && widget.items) {
    return <>
      <BarList rows={widget.items.map(item => ({name: item.name, label: item.name, detail: item.count, value: item.share}))} onPick={onPickColonia}/>
      {widget.hint && <p className="map-widget-hint"><span>{widget.hint}</span></p>}
    </>;
  }
  if (widget.bars) {
    return <BarList rows={widget.bars} poiOn={poiOn} onTogglePoi={onTogglePoi}/>;
  }
  if (widget.compare) {
    const values = widget.compare.map(row => row.value);
    const max = Math.max(...values, 1), base = Math.min(...values) * 0.8;
    return <BarList rows={widget.compare.map(row => ({
      label: row.label, detail: `$${row.value.toLocaleString('es-MX')}`, current: row.current,
      value: Math.round(((row.value - base) / Math.max(1, max - base)) * 100),
    }))}/>;
  }
  if (widget.spark) return <div className="map-widget-trend">
    <Spark values={widget.spark} compare={widget.citySpark} direction={widget.direction}/>
    {widget.citySpark && <SparkLegend legend={widget.legend}/>}
  </div>;
  if (widget.track) return <Track track={widget.track}/>;
  return null;
}

const MORPH = {duration: .24, ease: [0.23, 1, 0.32, 1]};

/** Animates its own height to whatever the content measures, and reports each change before it plays. */
function AutoHeight({className, onResize, children, morph}) {
  const reduce = useReducedMotion();
  const inner = useRef(null), last = useRef(null), report = useRef(onResize), skip = useRef(true);
  const [height, setHeight] = useState(null);
  report.current = onResize;
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const measure = () => {
      const next = node.offsetHeight;
      if (last.current != null && next !== last.current) report.current?.(next - last.current, node);
      last.current = next;
      setHeight(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (height != null) skip.current = false;
  }, [height]);
  const transition = reduce || skip.current ? {duration: 0} : MORPH;
  return <motion.div className={className} initial={morph && !reduce ? {height:0} : false} animate={height == null ? undefined : {height}} transition={transition}>
    <div ref={inner}>{children}</div>
  </motion.div>;
}

function useFreshRead(key, reduce, delay = READ_MS, immediate = false) {
  const first = !reduce && !seenReadings.has(key);
  const readyNow = !first || immediate;
  const [state, setState] = useState({key, ready: readyNow, sweep: first});
  if (state.key !== key) {
    const nextFirst = !reduce && !seenReadings.has(key);
    setState({key, ready: !nextFirst || immediate, sweep: nextFirst});
  }
  useEffect(() => {
    if (reduce || seenReadings.has(key)) {seenReadings.add(key);return;}
    if (immediate) {seenReadings.add(key);setState(current => current.key === key && current.ready ? current : {key, ready: true, sweep: true});return;}
    const timer = setTimeout(() => {seenReadings.add(key);setState({key, ready: true, sweep: true});}, delay);
    return () => clearTimeout(timer);
  }, [key, reduce, delay, immediate]);
  return state.key === key ? state : {ready: readyNow, sweep: first};
}

function NearbyReading({tile, tiles, scope, reduce, language, onResize, onSelect, immediate}) {
  const key = `${scope}:${tile?.kind || ''}`;
  const {ready, sweep} = useFreshRead(key, reduce, READ_MS, immediate);
  const mark = `${sweep && ready ? ' is-arriving' : ''}${sweep ? '' : ' is-live'}`;
  const bone = ready ? '' : ' is-bone';
  return <>
    <div className={`map-widget-lead${bone}`} aria-busy={!ready || undefined}>
      <p className={`map-widget-statement${mark}`}><span>{tile.headline}</span></p>
      {tile.support && <p className={`map-widget-support${mark}`}><span>{tile.support}</span></p>}
      {!ready && <p className="map-widget-status" role="status">{language === 'pt-BR' ? 'A Mora está trazendo estes dados.' : 'Mora está trayendo estos datos.'}</p>}
    </div>
    <NearbyTiles tiles={tiles} selected={tile?.kind} onSelect={onSelect}/>
    {tile?.items && <AutoHeight className="map-widget-places-clip" onResize={onResize}>
      {tile.items.length ? <ul key={key} className={`map-widget-places${bone}`} data-known={sweep ? undefined : 'true'}>
        {tile.items.map((item, index) => <li key={item.id} style={{'--n': sweep ? index : 0}}>
          <span>{item.name}</span>
          <span>{item.minutes} min</span>
        </li>)}
      </ul> : null}
    </AutoHeight>}
  </>;
}

function WidgetCard({widget, index, active, hover, settling, signedIn, language, hoveredHomeLabel, readScope, readDelay = READ_MS, reduce, onActivate, onHover, onOpen, onLogin, onTogglePoi, onPickColonia, onResize, poiOn}) {
  const spoiler = signedIn ? spoilerFor(widget.id, widget._vision?.name) : null;
  const read = useFreshRead(`${readScope}:${widget.id}`, reduce, readDelay + index * 140);
  const nearbySelected = widget.kind === 'nearby' && widget.tiles
    ? (widget.tiles.find(tile => poiOn?.has(tile.kind)) || widget.tiles[0])
    : null;
  const skipTile = useRef(undefined);
  if (read.ready && widget.kind === 'nearby' && skipTile.current === undefined) skipTile.current = nearbySelected?.kind || null;
  const figure = widget.headline && widget.kind !== 'summary';
  const homeNote = hoveredHomeLabel && widget.kind === 'price' ? hoveredHomeLabel : null;
  const title = <h3 className="map-widget-title"><span>{widget.title}</span>{widget.kicker && <span>{widget.kicker}</span>}</h3>;
  const reviews = widget.reviews == null ? null
    : (language === 'pt-BR' ? `${widget.reviews} avaliações de vizinhos` : `${widget.reviews} reseñas de vecinos`);
  const loading = !read.ready;
  const arrive = read.sweep && read.ready;
  return <article className={`map-widget-card${loading ? ' is-bone' : ''}${arrive ? ' is-arriving' : ''}`} data-kind={widget.kind} data-loading={loading || undefined} data-active={active || undefined} data-hover={hover || undefined}
    style={{'--i': index}} aria-busy={loading || undefined}
    onPointerEnter={() => onHover?.(widget.id)} onPointerLeave={() => onHover?.(null)}
    onClick={() => widget.layer ? onActivate?.(widget.id) : widget.kind !== 'matching' && widget.kind !== 'nearby' ? onOpen?.(widget.id) : null}>
    <div className="map-widget-body">
      {widget.kind === 'summary' ? <>
        <div className="map-widget-lead">
          <div className="map-widget-kicker">
            <span className="map-widget-brand">
              <img src={MORA} alt="" className={settling && !loading ? 'is-breathe' : undefined}/>
              <strong>Mora</strong>
            </span>
            <button type="button" className="map-widget-collapse" aria-label={language === 'pt-BR' ? 'Recolher' : 'Recoger'} onClick={event => {event.stopPropagation();onActivate?.('collapse');}}><Icon name="close" size={14}/></button>
          </div>
          <h3 className="map-widget-headline"><span>{widget.title}</span></h3>
          {widget.tags?.length ? <div className="map-widget-tags">{widget.tags.map(tag =>
            <span key={tag.id} className="map-widget-tag" data-tone={tag.tone}>{tag.label}</span>)}
          </div> : null}
        </div>
        <Segments segments={widget.segments} hover={hover ? widget.id : null} onHover={(id, poi) => onHover?.(id, poi)} onOpen={onOpen}/>
        {(reviews || widget.bars) && <div className="map-widget-themes">
          {reviews && <div className="map-widget-reviews">
            <strong>{reviews}</strong>
            <button type="button" className="map-widget-more" onClick={event => {event.stopPropagation();onOpen?.(widget.id);}}><span>{widget.more}</span></button>
          </div>}
          <CardVisual widget={widget} poiOn={poiOn} onTogglePoi={onTogglePoi} onPickColonia={onPickColonia}/>
        </div>}
      </> : widget.kind === 'nearby' ? <>
        {title}
        {nearbySelected && <NearbyReading tile={nearbySelected} tiles={widget.tiles} scope={readScope} reduce={reduce} language={language} onResize={onResize}
          immediate={nearbySelected.kind === skipTile.current && !seenReadings.has(`${readScope}:${nearbySelected.kind}`)}
          onSelect={tile => onTogglePoi?.(tile.kind, tile.poi)}/>}
      </> : <>
        <div className="map-widget-lead map-widget-open">
          {title}
          {figure && (widget.statement
            ? <p className="map-widget-statement">{widget.direction && <TrendArrow direction={widget.direction}/>}<span>{widget.headline}</span></p>
            : <p className="map-widget-metric"><span>{widget.headline}</span>{widget.unit && <span>{widget.unit}</span>}</p>)}
          {widget.support && <p className="map-widget-support"><span>{widget.support}</span></p>}
          <AnimatePresence initial={false}>
            {homeNote && <motion.p key={homeNote} className="map-widget-support is-live" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.15, ease:EASE}}><span>{homeNote}</span></motion.p>}
          </AnimatePresence>
        </div>
        <CardVisual widget={widget} poiOn={poiOn} onTogglePoi={onTogglePoi} onPickColonia={onPickColonia}/>
        {widget.note && <p className="map-widget-note"><span>{widget.note}</span></p>}
        <LockRow widget={widget} signedIn={signedIn} spoiler={spoiler} onLogin={onLogin} language={language}/>
      </>}
      {loading && <p className="map-widget-status" role="status">{language === 'pt-BR' ? 'A Mora está trazendo estes dados.' : 'Mora está trayendo estos datos.'}</p>}
    </div>
  </article>;
}

function Panel({widgetId, scope, vision, search, home, language, signedIn, hover, reduce, onHover, onBack, onAsk, onLogin}) {
  const panel = panelContent({widgetId, vision, search, language, home});
  const read = useFreshRead(`${scope}:panel:${widgetId}`, reduce);
  const loading = !read.ready;
  return <motion.section className={`map-widget-panel${loading ? ' is-bone' : ''}`} initial={reduce ? {opacity:0} : {opacity:0, transform:'translateX(-12px)'}} animate={{opacity:1, transform:'translateX(0px)'}}
    exit={reduce ? {opacity:0, transition:{duration:.12}} : {opacity:0, transform:'translateX(-8px)', transition:{duration:.12, ease:EASE}}} transition={{duration:reduce ? .15 : .28, ease:EASE}}>
    <div className="map-widget-panel-head">
      <button type="button" onClick={onBack} aria-label={language === 'pt-BR' ? 'Voltar' : 'Volver'}><Icon name="back" size={16}/></button>
      <span className="map-widget-brand"><img src={MORA} alt=""/><strong>Mora</strong></span>
    </div>
    <div className="map-widget-panel-body" aria-busy={loading || undefined}>
      <h2 className={`map-widget-headline${read.sweep && !loading ? ' is-arriving' : ''}`}><span>{panel.title}</span></h2>
      <Segments segments={panel.segments} hover={hover} onHover={onHover} onOpen={id => onHover?.(id)}/>
      <button type="button" className="map-widget-ask" onClick={() => onAsk?.(panel.ask)}>
        <img src={MORA} alt=""/><span>{language === 'pt-BR' ? 'Pergunte à Mora' : 'Pregúntale a Mora'}</span>
      </button>
      <div className="map-widget-panel-more">
        <div className="map-widget-panel-rest">
          {panel.components.map(block =>
            <div key={block.id} className="map-widget-block" data-hover={hover === block.binds || undefined}
              onPointerEnter={() => onHover?.(block.binds)} onPointerLeave={() => onHover?.(null)}>
              {block.type === 'bars' && <BarList rows={block.bars.map(bar => ({label: bar.label, detail: `${bar.value}%`, value: bar.value}))}/>}
              {block.type === 'chips' && <div className="map-widget-chips">
                {block.plus.map(label => <span key={label} className="map-widget-chip" data-tone="plus">+ {label}</span>)}
                {block.minus.map(label => <span key={label} className="map-widget-chip" data-tone="minus">− {label}</span>)}
              </div>}
              {block.type === 'compare' && <>
                {block.rows.map(row => <p key={row.label} className="map-widget-support"><span>{row.label}</span><span style={{float:'right'}}>{row.value}</span></p>)}
                {!signedIn && <button type="button" className="map-widget-lock" aria-label={`${language === 'pt-BR' ? 'Referência para negociar' : 'Referencia para negociar'}. Ver`} onClick={() => onLogin?.(widgetId)}>
                  <span className="map-widget-lock-label"><LockIcon/><span>{language === 'pt-BR' ? 'Referência para negociar' : 'Referencia para negociar'}</span></span><b>Ver</b>
                </button>}
              </>}
              {block.type === 'spark' && <Spark values={block.spark} direction={block.direction}/>}
              {block.type === 'places' && <div className="map-widget-chips">{block.places.map(place =>
                <span key={place.id} className="map-widget-chip">{place.name}{place.walk != null ? ` · ${place.walk} min` : ''}</span>)}</div>}
            </div>)}
          <p className="map-widget-sources"><span>{language === 'pt-BR' ? 'Fontes: ' : 'Fuentes: '}{panel.sources}</span></p>
        </div>
      </div>
      {loading && <p className="map-widget-status" role="status">{language === 'pt-BR' ? 'A Mora está trazendo estes dados.' : 'Mora está trayendo estos datos.'}</p>}
    </div>
  </motion.section>;
}

export const MoraPill = React.forwardRef(function MoraPill({language, onOpen, ...motionProps}, ref) {
  return <motion.button ref={ref} type="button" className="map-widget-pill" onClick={onOpen} aria-expanded="false" {...motionProps}>
    <img src={MORA} alt=""/>{language === 'pt-BR' ? 'Saiba mais com a Mora' : 'Descubre más con Mora'}
  </motion.button>;
});

export function MapWidgets({
  stack, settling, collapsed, expandedId, activeLayer, poiOn, hoverWidget, signedIn, language, hoveredHome,
  legend, onToggleCollapse, onExpand, onBack, onActivate, onHover, onTogglePoi, onLogin, onAsk, onPickColonia, onPointerInside,
}) {
  const reduce = useReducedMotion();
  const root = useRef(null);
  const scroller = useRef(null);
  const widgets = stack?.widgets || [];
  const vision = stack?.vision;
  const scopeKey = stack ? (stack.homeId ? `home:${stack.homeId}` : `${stack.level}:${stack.colonia}`) : '';
  const readingKey = stack ? `${scopeKey}:${widgets.map(widget => widget.id).join(',')}` : '';
  const lastExpanded = useRef(expandedId);
  const returning = useRef(false);
  if (lastExpanded.current !== expandedId) {
    returning.current = !!lastExpanded.current && !expandedId;
    lastExpanded.current = expandedId;
  }
  const playLatch = useRef(null);
  if (scopeKey && playLatch.current?.key !== scopeKey) playLatch.current = {key: scopeKey, play: !reduce && !seenScopes.has(scopeKey)};
  const play = !!playLatch.current?.play;
  useEffect(() => {
    if (!scopeKey || reduce) return;
    const timer = setTimeout(() => seenScopes.add(scopeKey), 0);
    return () => clearTimeout(timer);
  }, [scopeKey, reduce]);
  const positionLabel = hoveredHome && vision
    ? (language === 'pt-BR'
      ? (hoveredHome === 'below' ? 'Este anúncio está abaixo da mediana' : hoveredHome === 'above' ? 'Este anúncio está acima da mediana' : 'Este anúncio está na mediana')
      : (hoveredHome === 'below' ? 'Este anuncio está abajo de la mediana' : hoveredHome === 'above' ? 'Este anuncio está arriba de la mediana' : 'Este anuncio está en la mediana'))
    : null;

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const enter = () => onPointerInside?.(true);
    const leave = () => onPointerInside?.(false);
    const wheel = event => event.stopPropagation();
    node.addEventListener('pointerenter', enter);
    node.addEventListener('pointerleave', leave);
    node.addEventListener('wheel', wheel, {passive:true});
    return () => {
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerleave', leave);
      node.removeEventListener('wheel', wheel);
    };
  }, [onPointerInside, collapsed, expandedId]);

  const offset = useRef(0);
  const scrollTo = (value, animate) => {
    const node = scroller.current;
    if (!node) return;
    offset.current = value;
    node.style.transition = animate && !reduce ? `transform ${MORPH.duration * 1000}ms cubic-bezier(${MORPH.ease.join(',')})` : 'none';
    node.style.transform = value ? `translateY(${-value}px)` : '';
  };
  const maxOffset = (node, grow = 0) => {
    const shell = node.closest('.map-shell');
    return shell ? Math.max(0, node.offsetHeight + grow - (shell.clientHeight - 24)) : 0;
  };

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    offset.current = 0;
    const onWheel = event => {
      event.preventDefault();
      event.stopPropagation();
      scrollTo(Math.min(maxOffset(node), Math.max(0, offset.current + event.deltaY)), false);
    };
    node.addEventListener('wheel', onWheel, {passive:false});
    return () => node.removeEventListener('wheel', onWheel);
  }, [readingKey, expandedId, collapsed]);

  /** A card that grows scrolls the stack so its new bottom fits; one that shrinks gives back the empty space. */
  const fitCard = (delta, inner) => {
    const node = scroller.current, card = inner.closest('.map-widget-card'), shell = node?.closest('.map-shell');
    if (!node || !card || !shell) return;
    const max = maxOffset(node, delta);
    let target = Math.min(offset.current, max);
    if (delta > 0) {
      const view = shell.getBoundingClientRect(), box = card.getBoundingClientRect();
      const overflow = box.bottom + delta - (view.bottom - 24);
      const headroom = box.top - (view.top + 24);
      if (overflow > 0) target = offset.current + Math.min(overflow, Math.max(0, headroom));
    }
    target = Math.max(0, Math.min(max, target));
    if (target !== offset.current) scrollTo(target, true);
  };

  if (!stack || collapsed) return null;

  return <>
    <div className="map-widget-veil" aria-hidden="true"/>
    {play && !seenEdges.has(scopeKey) && <div key={scopeKey} className="map-mora-edge" aria-hidden="true"
      onAnimationEnd={event => event.target === event.currentTarget && seenEdges.add(scopeKey)}><span/><span/></div>}
    <div ref={root}>
      <AnimatePresence>
        {expandedId && vision && <Panel key="panel" widgetId={expandedId} scope={scopeKey} vision={vision} search={stack.search} home={stack.home}
          language={language} signedIn={signedIn} hover={hoverWidget} reduce={reduce}
          onHover={onHover} onBack={onBack} onAsk={onAsk} onLogin={onLogin}/>}
      </AnimatePresence>
      {!expandedId && <div ref={scroller} key={readingKey} className="map-widget-stack" data-play={play ? 'true' : undefined} data-return={returning.current || undefined} aria-label={language === 'pt-BR' ? 'Leitura da Mora' : 'Lectura de Mora'}>
        {widgets.map((widget, index) =>
          <WidgetCard key={widget.id} widget={{...widget, _vision: vision}} index={index}
            active={activeLayer && widget.layer === activeLayer} hover={hoverWidget === widget.id}
            settling={settling && !reduce} signedIn={signedIn} language={language} hoveredHomeLabel={widget.kind === 'price' ? positionLabel : null}
            readScope={scopeKey} readDelay={play ? EDGE_READ_MS : READ_MS} reduce={reduce} poiOn={poiOn}
            onActivate={id => {
              if (id === 'collapse') onToggleCollapse();
              else onActivate?.(id);
            }}
            onPickColonia={onPickColonia} onResize={fitCard}
            onHover={onHover} onOpen={onExpand} onLogin={onLogin} onTogglePoi={onTogglePoi}/>)}
      </div>}
    </div>
    {legend && <div className="map-widget-legend"><strong>{legend.title}</strong>{legend.items.map(item =>
      <span key={item.label}><i style={{background:item.color}}/>{item.label}</span>)}
    </div>}
  </>;
}
