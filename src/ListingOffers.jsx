import React, {useEffect, useId, useRef, useState} from 'react';
import {animate} from 'motion/react';

const MORA_MARK = '/assets/mini-listing/mora.svg';

const COPY = {
  strong:{
    chip:['Forte', 'Fuerte'],
    reply:['Aceitação', 'Aceptación', 'É provável que quem vende aceite sem pedir mudanças.', 'Es probable que quien vende acepte sin pedir cambios.'],
    time:['1 a 3 dias', '1 a 3 días', 'Ofertas perto do preço anunciado recebem resposta rápida.', 'Las ofertas cercanas al precio publicado reciben respuesta rápido.'],
    when:['Com pressa', 'Con prisa', 'Aumenta suas chances de ficar com o imóvel.', 'Aumenta tus posibilidades de quedarte con el inmueble.'],
  },
  competitive:{
    chip:['Competitiva', 'Competitiva'],
    reply:['Contraproposta', 'Contraoferta', 'O mais provável é uma contraproposta perto do seu valor.', 'Lo más probable es una contraoferta cercana a tu número.'],
    time:['3 a 5 dias', '3 a 5 días', 'Quem vende costuma levar alguns dias para responder com outro valor.', 'Quien vende suele tomarse unos días para contestar con otro número.'],
    when:['Equilíbrio', 'Equilibrio', 'Bom equilíbrio entre economia e chance de fechar.', 'Buen balance entre ahorro y posibilidad de cerrar.'],
  },
  moderate:{
    chip:['Moderada', 'Moderada'],
    reply:['Negociação', 'Negociación', 'Espere algumas rodadas antes de chegar a um acordo.', 'Espera un par de rondas antes de llegar a un acuerdo.'],
    time:['1 a 2 semanas', '1 a 2 semanas', 'Ofertas mais baixas demoram mais para ter resposta.', 'Las ofertas más bajas tardan más en recibir respuesta.'],
    when:['Sem pressa', 'Sin prisa', 'Se você pode esperar e não se importa que outra pessoa faça uma oferta.', 'Si puedes esperar y no te preocupa que alguien más oferte.'],
  },
  weak:{
    chip:['Fraca', 'Débil'],
    reply:['Recusa', 'Rechazo', 'É provável que quem vende recuse ou não responda.', 'Es probable que quien vende la rechace o no conteste.'],
    time:['Sem prazo', 'Sin plazo', 'Pode não haver resposta, sobretudo se o anúncio é recente.', 'Puede que no haya respuesta, sobre todo si el anuncio es reciente.'],
    when:['Com opções', 'Con opciones', 'Só se você tem outras opções e este não é o seu favorito.', 'Solo si tienes otras opciones y este no es tu favorito.'],
  },
};

// The arc of the Figma gauge: a half circle in a 241 × 135 box, 19.28 wide with round ends, cut into four bands by 4.82 gaps.
const CX = 120.5, CY = 120.5, R = 108.45, STROKE = 19.28, GAP = 4.82;
const ARC = `M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const onArc = (share, radius) => {
  const angle = Math.PI * (1 - share);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
};
const arcBetween = (from, to) => {
  const [x1, y1] = onArc(from, R), [x2, y2] = onArc(to, R);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};
/** A wedge from the centre of the dial: the arc shows through it, so each band can fade on its own and keep the round ends. */
const wedge = (from, to) => {
  const [x1, y1] = onArc(from, 400), [x2, y2] = onArc(to, 400);
  return `${CX},${CY} ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
};

/**
 * The chance of closing as four bands, weak on the left to strong on the right. The band of the chosen strength is lit and a marker
 * rides the arc to the chance itself. Each band is a button: choosing one is the same as choosing the pill above.
 */
function Gauge({bounds, level, levels, label, names, onPick, onDrag, onRelease, share}) {
  const id = useId();
  const refs = useRef([]);
  const svg = useRef(null);
  const grabbing = useRef(false);
  // Where along the arc the pointer is, 0 (weak end) to 1 (strong end); below the baseline it sticks to the nearest end.
  const shareAt = event => {
    const box = svg.current.getBoundingClientRect(), scale = box.width / 241;
    const dx = event.clientX - (box.left + CX * scale), dy = (box.top + CY * scale) - event.clientY;
    if (dy < 0) return dx < 0 ? 0 : 1;
    return Math.min(1, Math.max(0, 1 - Math.atan2(dy, dx) / Math.PI));
  };
  const down = event => {
    if (event.button > 0 || !event.target.closest('.pp-offer-hit, .pp-offer-marker-hit')) return;
    grabbing.current = true;
    try { svg.current.setPointerCapture(event.pointerId); } catch { /* the pointer already left; moves still arrive over the dial */ }
    onDrag(shareAt(event));
  };
  const move = event => { if (grabbing.current) onDrag(shareAt(event)); };
  const up = event => {
    if (!grabbing.current) return;
    grabbing.current = false;
    try { svg.current.releasePointerCapture?.(event.pointerId); } catch { /* nothing was captured */ }
    onRelease();
  };
  const edges = [0, ...bounds.map(value => value / 100), 1];
  const order = [...levels].reverse();
  const active = order.findIndex(item => item.id === level);
  const [mx, my] = onArc(share / 100, R);
  const keys = event => {
    const move = {ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1}[event.key];
    if (!move) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(order.length - 1, active + move));
    onPick(order[next].id);
    refs.current[next]?.focus();
  };
  return <svg ref={svg} className="pp-offer-gauge" viewBox="0 0 241 135" width="241" height="135"
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
    <defs>
      <linearGradient id={`${id}-fill`} x1={CX - R} y1="0" x2={CX + R} y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0A2374"/><stop offset=".5" stopColor="#9B8CD8"/><stop offset="1" stopColor="#FF6A13"/>
      </linearGradient>
      <mask id={`${id}-gaps`} maskUnits="userSpaceOnUse" x="-20" y="-20" width="281" height="175">
        <rect x="-20" y="-20" width="281" height="175" fill="#fff"/>
        {bounds.map(value => {
          const [x1, y1] = onArc(value / 100, R - STROKE / 2 - 2), [x2, y2] = onArc(value / 100, R + STROKE / 2 + 2);
          return <line key={value} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth={GAP}/>;
        })}
      </mask>
      {order.map((item, index) => <clipPath key={item.id} id={`${id}-band-${index}`}>
        <polygon points={wedge(index === 0 ? -0.2 : edges[index], index === order.length - 1 ? 1.2 : edges[index + 1])}/>
      </clipPath>)}
    </defs>
    <g mask={`url(#${id}-gaps)`} aria-hidden="true">
      {order.map((item, index) => <g key={item.id} clipPath={`url(#${id}-band-${index})`} className={`pp-offer-band${index === active ? ' is-active' : ''}`}>
        <path d={ARC} fill="none" stroke={`url(#${id}-fill)`} strokeWidth={STROKE} strokeLinecap="round"/>
      </g>)}
    </g>
    <circle className="pp-offer-marker" cx={mx} cy={my} r="7.5" fill="#fff" stroke="#111" strokeWidth="2.5" aria-hidden="true"/>
    <circle className="pp-offer-marker-hit" cx={mx} cy={my} r="18" fill="transparent" aria-hidden="true"/>
    <g role="radiogroup" aria-label={label} onKeyDown={keys}>
      {order.map((item, index) => <path key={item.id} ref={node => { refs.current[index] = node; }} className="pp-offer-hit"
        d={arcBetween(index === 0 ? 0 : edges[index], index === order.length - 1 ? 1 : edges[index + 1])}
        role="radio" aria-checked={index === active} aria-label={names[item.id]} tabIndex={index === active ? 0 : -1}
        fill="none" stroke="transparent" strokeWidth={STROKE + 14}
        onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onPick(item.id); } }}/>)}
    </g>
  </svg>;
}

function Fact({title, label, note}) {
  return <li className="pp-offer-card">
    <div className="pp-offer-card-head"><h3>{title}</h3><p>{label}</p></div>
    <p className="pp-offer-note">{note}</p>
  </li>;
}

/** Ideas para ofertar: the chosen strength sets the amount, the chance of closing and what to expect back. */
export function ListingOffers({ideas, money, language, say, onAsk, expanded = false, insight = null}) {
  const [level, setLevel] = useState('strong');
  const [shown, setShown] = useState(null);
  const shownNow = useRef(null), glideRun = useRef(null), dragging = useRef(false);
  const pt = language === 'pt-BR';
  const pick = pair => pt ? pair[0] : pair[1];
  const percent = share => (share * 100).toLocaleString(pt ? 'pt-BR' : 'es-MX', {maximumFractionDigits:1});
  const current = ideas.levels.find(item => item.id === level);
  const copy = COPY[level];
  const chances = ideas.levels.map(item => item.chance).reverse();
  const bounds = chances.slice(1).map((chance, index) => (chance + chances[index]) / 2);
  // One line: the figure and its qualifier stay together, with no forced break between them.
  const amount = current.to == null ? `${money(current.from)}\u00a0${say('ou mais', 'o más')}`
    : current.from == null ? `${say('Menos de', 'Menos de')}\u00a0${money(current.to)}`
    : `${money(current.from)}\u00a0${say(`a ${money(current.to)}`, `a ${money(current.to)}`)}`;
  const [low, high] = current.cut;
  const under = low === 0 ? say(`${percent(high)}% ou menos abaixo do preço anunciado`, `${percent(high)}% o menos bajo el precio publicado`)
    : high == null ? say(`Mais de ${percent(low)}% abaixo do preço anunciado`, `Más de ${percent(low)}% bajo el precio publicado`)
    : say(`Entre ${percent(low)}% e ${percent(high)}% abaixo do preço anunciado`, `Entre ${percent(low)}% y ${percent(high)}% bajo el precio publicado`);
  const question = say('Comparar ofertas', 'Comparar ofertas');
  const names = Object.fromEntries(ideas.levels.map(item => [item.id, pick(COPY[item.id].chip)]));

  // The chance counts to its new value and the marker rides the arc with it. Reduced motion jumps straight there.
  const glide = target => {
    glideRun.current?.stop();
    const from = shownNow.current ?? target;
    if (from === target || matchMedia('(prefers-reduced-motion:reduce)').matches) { shownNow.current = target; setShown(target); return; }
    glideRun.current = animate(from, target, {duration:0.7, ease:[0.22, 1, 0.36, 1], onUpdate:value => { shownNow.current = value; setShown(value); }});
  };
  useEffect(() => {
    if (!dragging.current) glide(current.chance);
    return () => glideRun.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.chance]);
  // Dragging the marker: it follows the pointer, the offer follows the band it is in, and on release it settles on that offer's chance.
  const order = [...ideas.levels].reverse();
  const drag = share => {
    dragging.current = true;
    glideRun.current?.stop();
    shownNow.current = share * 100;
    setShown(share * 100);
    const index = bounds.filter(bound => share * 100 >= bound).length;
    if (order[index] && order[index].id !== level) setLevel(order[index].id);
  };
  const release = () => { dragging.current = false; glide(current.chance); };
  const live = shown ?? current.chance;

  return <div className="pp-offers">
    <div className="pp-offers-top">
      <div className="pp-offers-title">
        <h2 id="pp-offers-title" className="pp-section-title">{say('Ideias para fazer uma oferta', 'Ideas para ofertar')}</h2>
        <button type="button" className="pp-mora-pill" aria-expanded={expanded} onClick={event => onAsk?.({section:'offer', question, source:event.currentTarget})}><img src={MORA_MARK} alt="" width="16" height="16"/><span>{question}</span></button>
      </div>
      <div className="pp-offer-levels" role="group" aria-label={say('Força da oferta', 'Fuerza de la oferta')}>
        {ideas.levels.map(item => <button key={item.id} type="button" className="pp-offer-level" aria-pressed={item.id === level} onClick={() => setLevel(item.id)}>{pick(COPY[item.id].chip)}</button>)}
      </div>
    </div>
    {insight}

    <ul className="pp-offer-grid">
      <li className="pp-offer-main">
        <p key={level} className="pp-offer-amount pp-offer-swap">{amount}</p>
        <div className="pp-offer-chance">
          <div className="pp-offer-dial">
            <Gauge bounds={bounds} level={level} levels={ideas.levels} share={live} names={names} onPick={setLevel} onDrag={drag} onRelease={release}
              label={say('Força da oferta', 'Fuerza de la oferta')}/>
            <strong>{Math.round(live)}%</strong>
          </div>
          <p>{say('mais de chance de fechar', 'más de probabilidad de cerrar')}</p>
        </div>
        <p key={`${level}-under`} className="pp-offer-note pp-offer-swap">{under}</p>
      </li>
      <li className="pp-offer-facts">
        <ul>
          <Fact title={say(`${ideas.days} dias`, `${ideas.days} días`)} label={say('Dias no ar', 'Días publicado')}
            note={say(`Na região, um imóvel leva ${ideas.zoneDays} dias para vender, em média.`, `En la zona, un inmueble tarda ${ideas.zoneDays} días en venderse en promedio.`)}/>
          <Fact title={pick([copy.time[0], copy.time[1]])} label={say('Tempo de resposta', 'Tiempo de respuesta')} note={pick([copy.time[2], copy.time[3]])}/>
          <Fact title={pick([copy.reply[0], copy.reply[1]])} label={say('Resposta esperada', 'Respuesta esperada')} note={pick([copy.reply[2], copy.reply[3]])}/>
          <Fact title={pick([copy.when[0], copy.when[1]])} label={say('Quando convém', 'Cuándo conviene')} note={pick([copy.when[2], copy.when[3]])}/>
        </ul>
      </li>
    </ul>
  </div>;
}
