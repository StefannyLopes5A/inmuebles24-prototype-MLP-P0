import React, {useId, useState} from 'react';

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

// The arc of the Figma gauge: a half circle in a 241 × 135 box, 19.28 wide with round ends; separators cross it by 7 px each side.
const CX = 120.5, CY = 120.5, R = 108.45, STROKE = 19.28, CROSS = STROKE / 2 + 7;
const ARC = `M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const onArc = (share, radius) => {
  const angle = Math.PI * (1 - share);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
};

function Gauge({bounds}) {
  const gradient = useId();
  return <svg className="pp-offer-gauge" viewBox="0 0 241 135" width="241" height="135" aria-hidden="true">
    <defs>
      <linearGradient id={gradient} x1={CX - R} y1="0" x2={CX + R} y2="0" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0A2374"/><stop offset=".5" stopColor="#9B8CD8"/><stop offset="1" stopColor="#FF6A13"/>
      </linearGradient>
    </defs>
    <path d={ARC} fill="none" stroke={`url(#${gradient})`} strokeWidth={STROKE} strokeLinecap="round"/>
    {bounds.map(share => {
      const [x1, y1] = onArc(share / 100, R - CROSS), [x2, y2] = onArc(share / 100, R + CROSS);
      return <line key={share} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f5f5f5" strokeWidth="4.82"/>;
    })}
  </svg>;
}

function Fact({title, label, note}) {
  return <li className="pp-offer-card">
    <div className="pp-offer-card-head"><h3>{title}</h3><p>{label}</p></div>
    <p className="pp-offer-note">{note}</p>
  </li>;
}

/** Ideas para ofertar: the chosen strength sets the amount, the chance of closing and what to expect back. */
export function ListingOffers({ideas, money, language, say, onAsk}) {
  const [level, setLevel] = useState('strong');
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

  return <div className="pp-offers">
    <div className="pp-offers-top">
      <div className="pp-offers-title">
        <h2 id="pp-offers-title" className="pp-section-title">{say('Ideias para fazer uma oferta', 'Ideas para ofertar')}</h2>
        <button type="button" className="pp-mora-pill" onClick={event => onAsk?.({section:'offer', question, source:event.currentTarget})}><img src={MORA_MARK} alt="" width="16" height="16"/><span>{question}</span></button>
      </div>
      <div className="pp-offer-levels" role="group" aria-label={say('Força da oferta', 'Fuerza de la oferta')}>
        {ideas.levels.map(item => <button key={item.id} type="button" className="pp-offer-level" aria-pressed={item.id === level} onClick={() => setLevel(item.id)}>{pick(COPY[item.id].chip)}</button>)}
      </div>
    </div>

    <ul className="pp-offer-grid">
      <li className="pp-offer-main">
        <p className="pp-offer-amount">{amount}</p>
        <div className="pp-offer-chance">
          <div className="pp-offer-dial">
            <Gauge bounds={bounds}/>
            <strong>{current.chance}%</strong>
          </div>
          <p>{say('mais de chance de fechar', 'más de probabilidad de cerrar')}</p>
        </div>
        <p className="pp-offer-note">{under}</p>
      </li>
      <Fact title={say(`${ideas.days} dias`, `${ideas.days} días`)} label={say('Dias no ar', 'Días publicado')}
        note={say(`Na região, um imóvel leva ${ideas.zoneDays} dias para vender, em média.`, `En la zona, un inmueble tarda ${ideas.zoneDays} días en venderse en promedio.`)}/>
      <Fact title={pick([copy.time[0], copy.time[1]])} label={say('Tempo de resposta', 'Tiempo de respuesta')} note={pick([copy.time[2], copy.time[3]])}/>
      <Fact title={pick([copy.reply[0], copy.reply[1]])} label={say('Resposta esperada', 'Respuesta esperada')} note={pick([copy.reply[2], copy.reply[3]])}/>
      <Fact title={pick([copy.when[0], copy.when[1]])} label={say('Quando convém', 'Cuándo conviene')} note={pick([copy.when[2], copy.when[3]])}/>
    </ul>
  </div>;
}
