import React,{useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {panelContent,spoilerFor} from './mapWidgets';

const EASE = [0.23, 1, 0.32, 1];
const MORA = '/assets/mini-listing/mora.svg';
const seenPanels = new Set();

function LockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

const AMENITY_PATHS = {
  transport: 'M6 10h12v8H6zM8 6h8l2 4H6zM8 20v1m8-1v1',
  green: 'M12 22V10M7 12c3-6 7-6 10 0',
  education: 'M3 10 12 5l9 5-9 5-9-5zm3 3v5l6 3 6-3v-5',
  food: 'M8 3v8m0 0H5m3 0h3M16 3c0 4-2 5-2 8v5h6v-5c0-3-2-4-2-8',
  health: 'M12 6v12M6 12h12',
};

export function AmenityIcon({kind}) {
  const path = AMENITY_PATHS[kind];
  if (!path) return null;
  return <svg className="map-widget-bar-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path}/></svg>;
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
      ? `${spoiler.pct > 0 ? '+' : ''}${spoiler.pct}% · ${language === 'pt-BR' ? 'previsão' : 'pronóstico'} ${spoiler.forecast3}%`
      : `${spoiler.fairPerM2 ? `$${new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX').format(spoiler.fairPerM2)}` : ''} MXN/m²`;
    return <p className="map-widget-lock is-open">{label}</p>;
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
    const icon = AMENITY_PATHS[row.kind] ? row.kind : null;
    const Tag = interactive ? 'button' : 'div';
    return <Tag key={row.id || row.kind || row.name || row.label} type={interactive ? 'button' : undefined} className="map-widget-bar"
      data-icon={icon || undefined}
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
        <AmenityIcon kind={tile.kind}/>
        <strong>{tile.metric}</strong>
        <span>{tile.label}</span>
      </button>)}
  </div>;
}

function CardVisual({widget, poiOn, onTogglePoi, onPickColonia}) {
  if (widget.kind === 'matching' && widget.items) {
    return <>
      <BarList rows={widget.items.map(item => ({name: item.name, label: item.name, detail: item.count, value: item.share}))} onPick={onPickColonia}/>
      {widget.hint && <p className="map-widget-hint">{widget.hint}</p>}
    </>;
  }
  if (widget.bars) {
    return <BarList rows={widget.bars} poiOn={poiOn} onTogglePoi={onTogglePoi}/>;
  }
  if (widget.compare) {
    const max = Math.max(...widget.compare.map(row => row.value), 1);
    return <BarList rows={widget.compare.map(row => ({
      label: row.label, detail: `$${row.value.toLocaleString('es-MX')}`, value: Math.round((row.value / max) * 100),
    }))}/>;
  }
  if (widget.spark) return <Spark values={widget.spark} compare={widget.citySpark} direction={widget.direction}/>;
  if (widget.track) return <Track track={widget.track}/>;
  return null;
}

function WidgetCard({widget, index, active, hover, settling, signedIn, language, hoveredHomeLabel, onActivate, onHover, onOpen, onLogin, onTogglePoi, onPickColonia, poiOn}) {
  const spoiler = signedIn ? spoilerFor(widget.id, widget._vision?.name) : null;
  const nearbySelected = widget.kind === 'nearby' && widget.tiles
    ? (widget.tiles.find(tile => poiOn?.has(tile.kind)) || widget.tiles[0])
    : null;
  const metric = widget.headline && widget.kind !== 'summary';
  const homeNote = hoveredHomeLabel && widget.kind === 'price' ? hoveredHomeLabel : null;
  const hasLead = metric || widget.support || homeNote;
  const titleInLead = metric && widget.kind !== 'price';
  const title = <p className="map-widget-title">{widget.title}{widget.kicker && <span>{widget.kicker}</span>}</p>;
  const reviews = widget.reviews == null ? null
    : (language === 'pt-BR' ? `${widget.reviews} avaliações de vizinhos` : `${widget.reviews} reseñas de vecinos`);
  return <article className="map-widget-card" data-kind={widget.kind} data-active={active || undefined} data-hover={hover || undefined}
    style={{'--i': index}}
    onPointerEnter={() => onHover?.(widget.id)} onPointerLeave={() => onHover?.(null)}
    onClick={() => widget.layer ? onActivate?.(widget.id) : widget.kind !== 'matching' && widget.kind !== 'nearby' ? onOpen?.(widget.id) : null}>
    <div className="map-widget-body">
      {widget.kind === 'summary' ? <>
        <div className="map-widget-lead">
          <div className="map-widget-kicker">
            <span className="map-widget-brand">
              <img src={MORA} alt="" className={settling ? 'is-breathe' : undefined}/>
              <strong>Mora</strong>
            </span>
            <button type="button" className="map-widget-collapse" aria-label={language === 'pt-BR' ? 'Recolher' : 'Recoger'} onClick={event => {event.stopPropagation();onActivate?.('collapse');}}><Icon name="close" size={14}/></button>
          </div>
          <h3 className="map-widget-headline">{widget.title}</h3>
          {widget.tags?.length ? <div className="map-widget-tags">{widget.tags.map(tag =>
            <span key={tag.id} className="map-widget-tag" data-tone={tag.tone}>{tag.label}</span>)}
          </div> : null}
        </div>
        <Segments segments={widget.segments} hover={hover ? widget.id : null} onHover={(id, poi) => onHover?.(id, poi)} onOpen={onOpen}/>
        {(reviews || widget.bars) && <div className="map-widget-themes">
          {reviews && <div className="map-widget-reviews">
            <strong>{reviews}</strong>
            <button type="button" className="map-widget-more" onClick={event => {event.stopPropagation();onOpen?.(widget.id);}}>{widget.more}</button>
          </div>}
          <CardVisual widget={widget} poiOn={poiOn} onTogglePoi={onTogglePoi} onPickColonia={onPickColonia}/>
        </div>}
      </> : widget.kind === 'nearby' ? <>
        {title}
        <div className="map-widget-lead">
          <h3 className="map-widget-headline">{nearbySelected.headline}</h3>
          {nearbySelected.support && <p className="map-widget-support">{nearbySelected.support}</p>}
        </div>
        <NearbyTiles tiles={widget.tiles} selected={nearbySelected.kind} onSelect={tile => onTogglePoi?.(tile.kind, tile.poi)}/>
      </> : <>
        {!titleInLead && title}
        {hasLead && <div className="map-widget-lead">
          {titleInLead && title}
          {metric && <p className="map-widget-metric" data-tone={widget.direction}>{widget.headline}{widget.unit && <span>{widget.unit}</span>}</p>}
          {widget.support && <p className="map-widget-support">{widget.support}</p>}
          {homeNote && <p className="map-widget-support">{homeNote}</p>}
        </div>}
        <CardVisual widget={widget} poiOn={poiOn} onTogglePoi={onTogglePoi} onPickColonia={onPickColonia}/>
        <LockRow widget={widget} signedIn={signedIn} spoiler={spoiler} onLogin={onLogin} language={language}/>
      </>}
    </div>
  </article>;
}

function Panel({widgetId, vision, search, home, language, signedIn, hover, reduce, onHover, onBack, onAsk, onLogin}) {
  const panel = panelContent({widgetId, vision, search, language, home});
  const first = !seenPanels.has(`${vision.name}:${widgetId}`);
  const [ready, setReady] = useState(!first || reduce);
  useEffect(() => {
    if (!first || reduce) {seenPanels.add(`${vision.name}:${widgetId}`);return;}
    const timer = setTimeout(() => {setReady(true);seenPanels.add(`${vision.name}:${widgetId}`);}, 700);
    return () => clearTimeout(timer);
  }, [first, reduce, vision.name, widgetId]);
  return <motion.section className="map-widget-panel" initial={reduce ? {opacity:0} : {opacity:0, transform:'translateX(-12px)'}} animate={{opacity:1, transform:'translateX(0px)'}}
    exit={reduce ? {opacity:0} : {opacity:0, transform:'translateX(-8px)'}} transition={{duration:reduce ? .15 : .28, ease:EASE}}>
    <div className="map-widget-panel-head">
      <button type="button" onClick={onBack} aria-label={language === 'pt-BR' ? 'Voltar' : 'Volver'}><Icon name="back" size={16}/></button>
      <p>{language === 'pt-BR' ? 'O que dizem os vizinhos' : 'Lo que dicen los vecinos'} · Mora</p>
    </div>
    <div className="map-widget-panel-body">
      <h2>{panel.title}</h2>
      <Segments segments={panel.segments} hover={hover} onHover={onHover} onOpen={id => onHover?.(id)}/>
      {ready && panel.components.map(block =>
        <div key={block.id} className="map-widget-block" data-hover={hover === block.binds || undefined}
          onPointerEnter={() => onHover?.(block.binds)} onPointerLeave={() => onHover?.(null)}>
          {block.type === 'bars' && <BarList rows={block.bars.map(bar => ({label: bar.label, detail: `${bar.value}%`, value: bar.value}))}/>}
          {block.type === 'chips' && <div className="map-widget-chips">
            {block.plus.map(label => <span key={label} className="map-widget-chip" data-tone="plus">+ {label}</span>)}
            {block.minus.map(label => <span key={label} className="map-widget-chip" data-tone="minus">− {label}</span>)}
          </div>}
          {block.type === 'compare' && <>
            {block.rows.map(row => <p key={row.label} className="map-widget-support">{row.label}<span style={{float:'right'}}>{row.value}</span></p>)}
            {!signedIn && <button type="button" className="map-widget-lock" aria-label={`${language === 'pt-BR' ? 'Preço de fechamento' : 'Precio de cierre'}. Ver`} onClick={() => onLogin?.(widgetId)}>
              <span className="map-widget-lock-label"><LockIcon/><span>{language === 'pt-BR' ? 'Preço de fechamento' : 'Precio de cierre'}</span></span><b>Ver</b>
            </button>}
          </>}
          {block.type === 'spark' && <Spark values={block.spark} direction={block.direction}/>}
          {block.type === 'places' && <div className="map-widget-chips">{block.places.map(place =>
            <span key={place.id} className="map-widget-chip">{place.name}{place.walk != null ? ` · ${place.walk} min` : ''}</span>)}</div>}
        </div>)}
      <p className="map-widget-sources">{language === 'pt-BR' ? 'Fontes: ' : 'Fuentes: '}{panel.sources}</p>
      <button type="button" className="map-widget-ask" onClick={() => onAsk?.(panel.ask)}>{language === 'pt-BR' ? 'Pergunte à Mora' : 'Pregúntale a Mora'}</button>
    </div>
  </motion.section>;
}

export function MapWidgets({
  stack, settling, collapsed, expandedId, activeLayer, poiOn, hoverWidget, signedIn, language, outOfSearch, hoveredHome,
  legend, onToggleCollapse, onExpand, onBack, onActivate, onHover, onTogglePoi, onLogin, onAsk, onPickColonia, onReturnSearch, onPointerInside,
}) {
  const reduce = useReducedMotion();
  const root = useRef(null);
  const scroller = useRef(null);
  const widgets = stack?.widgets || [];
  const vision = stack?.vision;
  const readingKey = stack ? `${stack.level}:${stack.colonia}:${stack.homeId || ''}:${widgets.map(widget => widget.id).join(',')}` : '';
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

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    let offset = 0;
    const maxOffset = () => {
      const shell = node.closest('.map-shell');
      if (!shell) return 0;
      return Math.max(0, node.offsetHeight - (shell.clientHeight - 24));
    };
    const onWheel = event => {
      event.preventDefault();
      event.stopPropagation();
      offset = Math.min(maxOffset(), Math.max(0, offset + event.deltaY));
      node.style.transform = offset ? `translateY(${-offset}px)` : '';
    };
    node.addEventListener('wheel', onWheel, {passive:false});
    return () => node.removeEventListener('wheel', onWheel);
  }, [readingKey, expandedId]);

  if (!stack) return null;
  if (collapsed) {
    return <button type="button" className="map-widget-pill" onClick={onToggleCollapse} aria-expanded="false">
      <img src={MORA} alt=""/>Mora
    </button>;
  }

  return <>
    <div ref={root}>
      <AnimatePresence>
        {expandedId && vision && <Panel key="panel" widgetId={expandedId} vision={vision} search={stack.search} home={stack.home}
          language={language} signedIn={signedIn} hover={hoverWidget} reduce={reduce}
          onHover={onHover} onBack={onBack} onAsk={onAsk} onLogin={onLogin}/>}
      </AnimatePresence>
      {!expandedId && <div ref={scroller} key={readingKey} className="map-widget-stack" data-play={reduce ? undefined : 'true'} aria-label={language === 'pt-BR' ? 'Leitura da Mora' : 'Lectura de Mora'}>
        {widgets.map((widget, index) =>
          <WidgetCard key={widget.id} widget={{...widget, _vision: vision}} index={index}
            active={activeLayer && widget.layer === activeLayer} hover={hoverWidget === widget.id}
            settling={settling && !reduce} signedIn={signedIn} language={language} hoveredHomeLabel={widget.kind === 'price' ? positionLabel : null}
            poiOn={poiOn}
            onActivate={id => {
              if (id === 'collapse') onToggleCollapse();
              else onActivate?.(id);
            }}
            onPickColonia={onPickColonia}
            onHover={onHover} onOpen={onExpand} onLogin={onLogin} onTogglePoi={onTogglePoi}/>)}
      </div>}
    </div>
    {outOfSearch && !expandedId && !collapsed && <button type="button" className="map-widget-return" onClick={onReturnSearch}>
      {language === 'pt-BR' ? 'Voltar à sua busca' : 'Volver a tu búsqueda'}
    </button>}
    {legend && <div className="map-widget-legend"><strong>{legend.title}</strong>{legend.items.map(item =>
      <span key={item.label}><i style={{background:item.color}}/>{item.label}</span>)}
    </div>}
  </>;
}
