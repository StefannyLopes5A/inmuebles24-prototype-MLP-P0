import React, {useId, useLayoutEffect, useRef, useState} from 'react';
import {motion, useReducedMotion} from 'motion/react';

const MORA_MARK = '/assets/mini-listing/mora.svg';
const CHEVRON = '/assets/price-insights/chevron-down.svg';

// Frame 12942:14173 at 851px wide: peak 12px from the top, trough at 232, baseline at 266, labels 24px under it.
const PLOT = 266 / 851;
const PEAK = 12 / 266, TROUGH = 232 / 266;
const GRID = [61.17, 129.41, 197.65].map(y => y / 266);

function useWidth(ref, fallback) {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setWidth(node.clientWidth || fallback);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, fallback]);
  return width;
}

function Chart({months, listing, selected, onSelect, label, monthName, valueText, say, reduce}) {
  const box = useRef(null);
  const width = useWidth(box, 851);
  const height = Math.max(168, Math.round(width * PLOT));
  const gradient = useId();
  const [hover, setHover] = useState(null);
  const [series, setSeries] = useState('region');
  const [keyboard, setKeyboard] = useState(false);
  const left = Math.max(14, width * 0.033), right = Math.max(14, width * 0.061);
  const sparse = width < 560;
  const values = [...months.map(month => month.value), ...listing.filter(Boolean).map(item => item.value)];
  const min = Math.min(...values), max = Math.max(...values);
  const x = index => left + (width - left - right) * index / (months.length - 1);
  const y = value => max === min ? height * (PEAK + TROUGH) / 2 : height * (TROUGH - (TROUGH - PEAK) * (value - min) / (max - min));
  const points = months.map((month, index) => [x(index), y(month.value)]);
  const own = listing.map((item, index) => item ? [x(index), y(item.value)] : null);
  const ownPoints = own.filter(Boolean);
  const gap = (width - left - right) / (months.length - 1);
  const hit = Math.max(8, Math.min(16, gap / 2 - 1));
  const path = list => list.map(([px, py], index) => `${index ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('');
  const line = path(points), ownLine = path(ownPoints);
  const area = ownPoints.length > 1 ? `${ownLine}L${ownPoints.at(-1)[0].toFixed(1)} ${height}L${ownPoints[0][0].toFixed(1)} ${height}Z` : null;
  const shown = hover ?? (keyboard ? selected : null);
  const marked = shown ?? months.length - 1;
  const current = shown == null ? null : months[shown];
  const currentOwn = shown == null ? null : listing[shown];
  const announced = months[selected];
  const announcedOwn = listing[selected];

  const keys = event => {
    const move = {ArrowLeft:index => index - 1, ArrowDown:index => index - 1, ArrowRight:index => index + 1, ArrowUp:index => index + 1, Home:() => 0, End:() => months.length - 1}[event.key];
    if (!move) return;
    event.preventDefault();
    setKeyboard(true);
    onSelect(index => Math.max(0, Math.min(months.length - 1, move(index))));
  };
  const point = shown == null ? null : (series === 'own' && own[shown]) || points[shown];
  const inset = Math.min(112, width / 2);
  const tipLeft = point ? Math.min(Math.max(point[0], inset), width - inset) : 0;

  return <div className="pp-history-chart">
    <div ref={box} className="pp-history-plot" style={{height:height + 42}} tabIndex={0} role="slider"
      aria-label={label} aria-valuemin={0} aria-valuemax={months.length - 1} aria-valuenow={selected}
      aria-valuetext={`${monthName(announced.date, true)}: ${announcedOwn ? `${say('este anúncio', 'este anuncio')} ${valueText(announcedOwn.value)}, ` : ''}${say('média da região', 'promedio de la región')} ${valueText(announced.value)}`}
      onBlur={() => setKeyboard(false)}
      onKeyDown={keys} onPointerDown={event => { setKeyboard(false); if (!event.target.closest('[data-dot]')) setHover(null); }}>
      {current && <div className="pp-history-tip" style={{left:tipLeft, top:point[1]}} aria-hidden="true">
        <strong className="pp-history-tip-month">{monthName(current.date, true)}</strong>
        {currentOwn && <p className="pp-history-tip-row is-own"><i/><span>{say('Este anúncio', 'Este anuncio')}</span><b>{valueText(currentOwn.value)}</b></p>}
        <p className="pp-history-tip-row is-region"><i/><span>{say('Média da região', 'Promedio de la región')}</span><b>{valueText(current.value)}</b></p>
      </div>}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1={height * PEAK} x2="0" y2={height} gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF553B" stopOpacity=".22"/><stop offset="1" stopColor="#FF553B" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {GRID.map(share => <line key={share} x1="0" x2={width} y1={height * share} y2={height * share} stroke="#E6E8EC" strokeWidth="2"/>)}
        <line x1="0" x2={width} y1={height - 1.5} y2={height - 1.5} stroke="#E6E8EC" strokeWidth="3"/>
        {area && <motion.path d={area} fill={`url(#${gradient})`} initial={reduce ? false : {opacity:0}} whileInView={{opacity:1}} viewport={{once:true, amount:0.4}}
          transition={{duration:0.6, delay:reduce ? 0 : 0.5}}/>}
        <motion.path d={line} fill="none" stroke="#07358F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? false : {pathLength:0}} whileInView={{pathLength:1}} viewport={{once:true, amount:0.4}} transition={{duration:0.9, ease:[0.2, 0.8, 0.2, 1]}}/>
        {ownPoints.length > 1 && <motion.path d={ownLine} fill="none" stroke="#FF553B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={reduce ? false : {pathLength:0}} whileInView={{pathLength:1}} viewport={{once:true, amount:0.4}} transition={{duration:0.9, delay:reduce ? 0 : 0.2, ease:[0.2, 0.8, 0.2, 1]}}/>}
        {points.map(([px, py], index) => <g key={index}>
          {index === marked && <circle cx={px} cy={py} r="12" fill="#07358F" fillOpacity=".16"/>}
          {index === marked && own[index] && <circle cx={own[index][0]} cy={own[index][1]} r="12" fill="#FF553B" fillOpacity=".18"/>}
          <circle cx={px} cy={py} r="5" fill="#07358F"/>
          {own[index] && <circle cx={own[index][0]} cy={own[index][1]} r="5" fill="#FF553B"/>}
          {[['region', [px, py]], ['own', own[index]]].filter(([, at]) => at).map(([kind, [dx, dy]]) => <circle key={kind} data-dot="" cx={dx} cy={dy} r={hit} fill="transparent" className="pp-history-dot"
            onPointerEnter={event => { if (event.pointerType !== 'touch') { setKeyboard(false); setSeries(kind); setHover(index); onSelect(index); } }}
            onPointerLeave={event => { if (event.pointerType !== 'touch') setHover(currentIndex => currentIndex === index ? null : currentIndex); }}
            onPointerDown={event => { setSeries(kind); setHover(index); onSelect(index); event.stopPropagation(); }}/>)}
        </g>)}
      </svg>
      <ol className="pp-history-axis" aria-hidden="true">
        {months.map((month, index) => {
          const skipped = sparse && (months.length - 1 - index) % 2;
          return <li key={index} className={[index === marked && 'is-current', skipped && 'is-skipped'].filter(Boolean).join(' ') || undefined}
            style={{left:x(index), top:height + 24}}>{monthName(month.date)}</li>;
        })}
      </ol>
    </div>
    <p className="sr-only">{say('Use as setas para percorrer os meses.', 'Usa las flechas para recorrer los meses.')}</p>
  </div>;
}

/** Historial de precio: the colonia's m² month by month, and this listing's own events in the same timeline. */
export function ListingPriceHistory({history, money, currency, language, say, onAsk, expanded = false, insight = null}) {
  const [selected, setSelected] = useState(history.months.length - 1);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const listId = useId();
  const locale = language === 'pt-BR' ? 'pt-BR' : 'es-MX';
  const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
  const monthName = (date, withYear) => capital(new Intl.DateTimeFormat(locale, withYear ? {month:'long', year:'numeric'} : {month:'short'}).format(date).replace(/\.$/, '').replace(' de ', ' '));
  const day = date => new Intl.DateTimeFormat(locale, {day:'numeric', month:'short'}).format(date).replace(/\.$/, '');
  const perM2 = value => `${money(value)} ${currency}/m²`;
  const area = history.area;
  const question = say('O que se espera para o preço?', '¿Qué se espera para el precio?');

  const row = item => {
    if (item.kind === 'listed') return {title:say('Anunciado para venda no Inmuebles24', 'Publicado para venta en Inmuebles24'), sub:day(item.date), value:`${money(item.value)} ${currency}`};
    if (item.kind === 'republished') return {title:say('Republicado no Inmuebles24', 'Republicado en Inmuebles24'), sub:day(item.date), value:`${money(item.value)} ${currency}`};
    const amount = item.kind === 'change' ? item.delta : -item.drop;
    return {title:say('Mudança de preço', 'Cambio de precio'), sub:amount < 0
      ? say(`${day(item.date)} · ${money(-amount)} a menos`, `${day(item.date)} · ${money(-amount)} menos`)
      : say(`${day(item.date)} · ${money(amount)} a mais`, `${day(item.date)} · ${money(amount)} más`), value:`${money(item.value)} ${currency}`};
  };
  const years = (open ? history.rows : []).reduce((groups, item) => {
    const year = item.date.getFullYear();
    if (groups.at(-1)?.year !== year) groups.push({year, items:[]});
    groups.at(-1).items.push(item);
    return groups;
  }, []);

  return <div className="pp-block">
    <div className="pp-history-head">
      <div className="pp-history-title">
        <h2 id="pp-history-title" className="pp-section-title">{say('Histórico de preço', 'Historial de precio')}</h2>
        <button type="button" className="pp-mora-pill" aria-expanded={expanded} onClick={event => onAsk?.({section:'history', question, source:event.currentTarget})}><img src={MORA_MARK} alt="" width="16" height="16"/><span>{question}</span></button>
      </div>
    </div>
    {insight}
    <div className="pp-history">

      <ul className="pp-history-legend" aria-label={say('Legenda do gráfico', 'Leyenda del gráfico')}>
        <li><i className="is-own" aria-hidden="true"/>{say('Este anúncio', 'Este anuncio')}</li>
        <li><i className="is-region" aria-hidden="true"/>{say(`Média em ${area}`, `Promedio en ${area}`)}</li>
      </ul>

      <Chart months={history.months} listing={history.listing} selected={selected} onSelect={setSelected} reduce={reduce} say={say} monthName={monthName} valueText={perM2}
        label={say(`Preço do m² deste anúncio e média em ${area}, mês a mês`, `Precio del m² de este anuncio y promedio en ${area}, mes a mes`)}/>

      <div className="pp-history-events">
        {open && <div id={listId} className="pp-history-years">
          {years.map(group => <div key={group.year} className="pp-history-year">
            <span className="pp-history-chip">{group.year}</span>
            <ul>{group.items.map(item => {
              const {title, sub, value} = row(item);
              return <li key={`${item.kind}-${item.date.getTime()}`} className="pp-history-row">
                <div><strong>{title}</strong><span>{sub}</span></div>
                <p>{value}</p>
              </li>;
            })}</ul>
          </div>)}
        </div>}
        {history.rows.length > 0 && <button type="button" className="pp-history-more" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen(value => !value)}>
          <span>{open ? say('Mostrar menos', 'Mostrar menos') : say('Explorar o histórico completo', 'Explorar el historial completo')}</span>
          <img src={CHEVRON} alt="" width="16" height="16"/>
        </button>}
      </div>
    </div>
  </div>;
}
