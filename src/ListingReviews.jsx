import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform} from 'motion/react';
import {advertiserReviews, seed} from './listingAdvertiser';
import {EASE_FADE} from './listingPanelMotion';
import {Expandable, MoreButton} from './ListingSections';
import {MORA_MARK, MoraWords} from './MoraVoice';

const PREVIEW = 6, TOTAL = 12;
/** What reviewers keep saying the agency does well; people rate the agency as a whole, so these are mentions, not scores. */
const TAGS = [
  {id:'care', label:['Atendimento atencioso', 'Atención cercana'], phrase:['atendem de perto', 'atienden de cerca'], d:'M4 5h16v11H8l-4 4zM8 10h8M8 13h5'},
  {id:'speed', label:['Responde rápido', 'Responde rápido'], phrase:['respondem rápido', 'responden rápido'], d:'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2.5M10 2h4'},
  {id:'clear', label:['Transparente com os custos', 'Claros con los costos'], phrase:['são claros com os custos', 'son claros con los costos'], d:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'},
  {id:'visits', label:['Pontuais nas visitas', 'Puntuales en las visitas'], phrase:['chegam no horário às visitas', 'llegan puntuales a las visitas'], d:'M3 10.5 12 3l9 7.5V21H3zM9 21v-6h6v6'},
  {id:'papers', label:['Ajudam com a documentação', 'Ayudan con los trámites'], phrase:['ajudam com a documentação', 'ayudan con los trámites'], d:'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h5'},
  {id:'zone', label:['Conhecem bem o bairro', 'Conocen bien la colonia'], phrase:['conhecem bem o bairro', 'conocen bien la colonia'], d:'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12ZM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'},
  {id:'calm', label:['Sem pressão', 'Sin presión'], phrase:['não pressionam', 'no presionan'], d:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01'},
  {id:'budget', label:['Respeitam o orçamento', 'Respetan tu presupuesto'], phrase:['respeitam o orçamento', 'respetan el presupuesto'], d:'M3 7h18v12H3zM3 11h18M7 15h3'},
];
const SHARE = [[0.75, 'três de cada quatro', 'tres de cada cuatro'], [0.64, 'dois de cada três', 'dos de cada tres'], [0.5, 'mais da metade', 'más de la mitad'],
  [0.4, 'quase metade', 'casi la mitad'], [0.3, 'um de cada três', 'uno de cada tres'], [0.2, 'um de cada cinco', 'uno de cada cinco'], [0, 'alguns', 'algunos']];
const share = (part, total, say) => { const [, br, es] = SHARE.find(([floor]) => part / total >= floor); return say(br, es); };
const initials = name => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
const STAR = filled => `/assets/reviews/star${filled ? '' : '-empty'}.svg`;
const decimal = value => value.toFixed(1).replace('.', ',');

const LAUREL_SPRING = {type:'spring', duration:0.7, bounce:0.25};
const RISE_EASE = [0.22, 1, 0.36, 1];

/** One laurel branch; it opens outward from behind the score. */
function Laurel({flip, shown, reduce}) {
  const side = flip ? 1 : -1;
  return <motion.img className="pp-laurel" src={`/assets/reviews/laurel-${flip ? 'right' : 'left'}.png`} width="120" height="183" alt=""
    initial={reduce ? {opacity:0} : {opacity:0, x:-side * 24, rotate:-side * 18, scale:0.85}}
    animate={shown ? {opacity:1, x:0, rotate:0, scale:1} : undefined}
    transition={reduce ? {duration:0.2} : {...LAUREL_SPRING, delay:0.12}}/>;
}

/** The score counts up once, the first time the reviews come into view. */
function Score({value, shown, reduce}) {
  const count = useMotionValue(reduce ? value : Math.max(0, value - 1.4));
  const text = useTransform(count, current => decimal(current));
  useEffect(() => {
    if (!shown || reduce) return undefined;
    const controls = animate(count, value, {duration:0.9, ease:RISE_EASE});
    return () => controls.stop();
  }, [shown, reduce, value, count]);
  return <>
    <motion.span aria-hidden="true" initial={reduce ? {opacity:0} : {opacity:0, scale:0.9}} animate={shown ? {opacity:1, scale:1} : undefined}
      transition={reduce ? {duration:0.2} : {duration:0.5, ease:RISE_EASE}}>{text}</motion.span>
    <span className="sr-only">{decimal(value)}</span>
  </>;
}

const COUNT_MS = 1500, SORT_MS = 1200, START_MS = 400;
const digested = new Set();

/**
 * Mora reads every review, then says what keeps coming back. The count runs while she reads, one more line while she
 * sorts, then the summary inks in. Seen once per agency and language; reduced motion lands on the summary.
 */
function MoraDigest({id, total, summary, shown, say}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(() => reduce || digested.has(id) ? 'done' : 'idle');
  const count = useMotionValue(0);
  const read = useTransform(count, value => String(Math.round(value)));
  const waiting = phase === 'idle';
  useEffect(() => {
    if (!waiting || !shown) return undefined;
    const timers = [setTimeout(() => {
      setPhase('reading');
      animate(count, total, {duration:COUNT_MS / 1000, ease:RISE_EASE});
    }, START_MS)];
    timers.push(setTimeout(() => setPhase('sorting'), START_MS + COUNT_MS));
    timers.push(setTimeout(() => { digested.add(id); setPhase('ink'); }, START_MS + COUNT_MS + SORT_MS));
    return () => timers.forEach(clearTimeout);
    // Started once: leaving `idle` must not cancel the steps already scheduled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, id]);
  const working = phase === 'reading' || phase === 'sorting';
  const landed = phase === 'ink' || phase === 'done';
  return <div className="pp-rating-mora" aria-live="polite">
    <div className="pp-rating-digest">
      <MoraWords text={summary} animate={phase === 'ink'} className="pp-rating-sub" aria-hidden={landed ? undefined : true} data-hidden={landed ? undefined : ''}/>
      {working && <p className="mora-thinking pp-rating-working" aria-hidden="true"><span>
        {phase === 'reading'
          ? <>{say('Lendo ', 'Leyendo ')}<motion.span className="pp-rating-count">{read}</motion.span>{say(` de ${total} avaliações…`, ` de ${total} reseñas…`)}</>
          : say('Vendo o que mais se repete…', 'Viendo lo que más se repite…')}
      </span></p>}
    </div>
    <p className="mora-signature pp-rating-by">
      <img className={working ? 'is-working' : undefined} src={MORA_MARK} alt=""/>
      <strong>Mora</strong>
      {landed && <span>{say(`leu as ${total} avaliações`, `leyó las ${total} reseñas`)}</span>}
    </p>
  </div>;
}

function Stars({count, say}) {
  return <span className="pp-review-stars" role="img" aria-label={say(`${count} de 5 estrelas`, `${count} de 5 estrellas`)}>
    {Array.from({length:5}, (_, i) => <img key={i} src={STAR(i < count)} alt="" width="10" height="10"/>)}
  </span>;
}

function Review({review, language, say, clip = false}) {
  const [open, setOpen] = useState(false);
  const pt = language === 'pt-BR';
  const text = pt ? review.text[0] : review.text[1];
  return <article className="pp-review">
    <header>
      <span className="pp-review-avatar" style={{background:review.color}} aria-hidden="true">{initials(review.name)}</span>
      <div><strong>{review.name}</strong><small>{review.source === 'mora' ? say('Visitou com a Mora', 'Visitó con Mora') : 'Google'} · {pt ? review.age[0] : review.age[1]}</small></div>
    </header>
    <Stars count={review.stars} say={say}/>
    {clip
      ? <Expandable open={open} collapsed={96} className="pp-review-text" toggle={overflows => (overflows || open) && <MoreButton open={open} onClick={() => setOpen(!open)} more={say('Mostrar mais', 'Mostrar más')} less={say('Mostrar menos', 'Mostrar menos')}/>}><p>{text}</p></Expandable>
      : <p className="pp-review-text">{text}</p>}
  </article>;
}

/** The advertiser's reputation, told like a stay's: Google reviews mixed with visits booked through Mora. */
export function ListingReviews({home, advertiser, language, say, compact = false}) {
  const [all, setAll] = useState(false);
  const [details, setDetails] = useState(false);
  const reduce = useReducedMotion();
  const hero = useRef(null);
  const inView = useInView(hero, {once:true, amount:compact ? 0 : 0.6}) || compact;
  const n = seed(`${advertiser.name.toLowerCase()}:aspects`);
  const visits = 12 + n % 48;
  const reviews = useMemo(() => advertiserReviews(advertiser, home.mode, TOTAL).map((review, i) => ({...review, source:(i + n) % 3 === 1 ? 'mora' : 'google'})), [advertiser, home.mode, n]);
  const tags = useMemo(() => {
    const total = advertiser.reviews + visits;
    const pool = compact ? TAGS : TAGS.slice();
    return pool.map(tag => ({...tag, rank:seed(`${advertiser.name.toLowerCase()}:${tag.id}`)}))
      .sort((a, b) => a.rank - b.rank)
      .map((tag, i) => ({...tag, mentions:Math.max(3, Math.round(total * (0.58 - i * 0.09 - (tag.rank % 5) / 100)))}))
      .sort((a, b) => b.mentions - a.mentions)
      .map(tag => ({...tag, share:total ? Math.round(tag.mentions / total * 100) : 0}));
  }, [advertiser.name, advertiser.reviews, visits, compact]);
  const spread = useMemo(() => {
    const five = Math.round(100 * Math.min(0.94, 0.62 + (advertiser.rating - 4.6) * 0.9));
    const four = Math.round((100 - five) * 0.72), three = Math.round((100 - five - four) * 0.6);
    const two = Math.round((100 - five - four - three) * 0.5);
    return [five, four, three, two, Math.max(0, 100 - five - four - three - two)];
  }, [advertiser.rating]);
  const top = advertiser.rating >= 4.8;
  const developer = advertiser.service === 'developer';
  const total = advertiser.reviews + visits;
  const [a, b] = tags;
  const pick = tag => say(...tag.phrase);
  const summary = say(
    `De ${total} avaliações, ${share(a.mentions, total, say)} diz que ${pick(a)}, e ${share(b.mentions, total, say)}, que ${pick(b)}. Está entre as mais bem avaliadas de ${home.area}; ${visits} dessas avaliações são de quem chegou pela Mora.`,
    `De ${total} reseñas, ${share(a.mentions, total, say)} dice que ${pick(a)}, y ${share(b.mentions, total, say)}, que ${pick(b)}. Está entre las mejor calificadas de ${home.area}; ${visits} de esas reseñas son de personas que llegaron por Mora.`,
  );
  const shown = compact || all ? reviews : reviews.slice(0, PREVIEW);
  const cloud = <div className="pp-rating-cloud">
    <h3>{say('O que mais destacam', 'Lo que más destacan')}</h3>
    <ul>{tags.map(tag => <li key={tag.id}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={tag.d}/></svg>
      <span>{language === 'pt-BR' ? tag.label[0] : tag.label[1]}</span>
    </li>)}</ul>
  </div>;
  const reviewList = <Expandable>
    <div className="pp-reviews" id="pp-review-list">
      <AnimatePresence initial={false}>
        {shown.map((review, i) => <motion.div key={review.name + i} className="pp-review-cell"
          initial={reduce ? {opacity:0} : {opacity:0, y:8}} animate={{opacity:1, y:0}} exit={{opacity:0, transition:{duration:0.12}}}
          transition={reduce ? {duration:0.15} : {duration:0.2, ease:EASE_FADE, delay:(i - PREVIEW) * 0.05}}>
          <Review review={review} language={language} say={say} clip={compact}/>
        </motion.div>)}
      </AnimatePresence>
    </div>
  </Expandable>;
  return <div className={compact ? 'pp-reviews-compact' : undefined}>
    <div className="pp-rating-hero" ref={hero}>
      <p className="pp-rating-score"><Laurel shown={inView} reduce={reduce}/><Score value={advertiser.rating} shown={inView} reduce={reduce}/><Laurel flip shown={inView} reduce={reduce}/></p>
      <motion.div initial={reduce ? {opacity:0} : {opacity:0, y:8}} animate={inView ? {opacity:1, y:0} : undefined}
        transition={reduce ? {duration:0.2} : {duration:0.3, ease:RISE_EASE, delay:0.35}}>
      <h2 className="pp-rating-title">{developer
        ? (top ? say('Incorporadora destaque', 'Desarrolladora destacada') : say('Incorporadora recomendada', 'Desarrolladora recomendada'))
        : (top ? say('Imobiliária destaque', 'Inmobiliaria destacada') : say('Imobiliária recomendada', 'Inmobiliaria recomendada'))}</h2>
      <MoraDigest key={`${advertiser.name}|${language}`} id={`${advertiser.name}|${language}`} total={total} summary={summary} shown={inView} say={say}/>
      </motion.div>
    </div>
    {compact
      ? <>
          <button type="button" className="pp-reviews-reveal" aria-expanded={details} aria-controls="rp-review-more" onClick={() => setDetails(value => !value)}>
            {details ? say('Ocultar avaliações', 'Ocultar reseñas') : say('Ver avaliações', 'Ver reseñas')}
          </button>
          {details && <div id="rp-review-more">{cloud}{reviewList}</div>}
        </>
      : <>
          <div className="pp-rating-row">
            <div className="pp-rating-overall">
              <div className="pp-hood-card-head">
                <p className="pp-hood-mora"><img src="/assets/hood/mora.svg" alt="" width="20" height="20"/>Mora</p>
                <h3>{say('Avaliação geral', 'Calificación general')}</h3>
              </div>
              <ol aria-label={say('Distribuição das notas', 'Distribución de calificaciones')}>{spread.map((share, i) => <li key={i}>
                <small>{5 - i}</small>
                <i aria-hidden="true"><b style={{width:`${share}%`}}/></i>
                <strong>{share}%</strong>
              </li>)}</ol>
            </div>
            <div className="pp-rating-tags">
              <h3>{say('O que mais destacam', 'Lo que más destacan')}</h3>
              <ul>{tags.map(tag => <li key={tag.id}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={tag.d}/></svg>
                <span>{language === 'pt-BR' ? tag.label[0] : tag.label[1]}</span>
                <small>{say(`${tag.mentions} menções`, `${tag.mentions} menciones`)}</small>
              </li>)}</ul>
            </div>
          </div>
          {reviewList}
          <button type="button" className="pp-pill pp-reviews-more" aria-expanded={all} aria-controls="pp-review-list" onClick={() => setAll(!all)}>
            {all ? say('Mostrar menos avaliações', 'Mostrar menos reseñas') : say(`Mostrar as ${reviews.length - PREVIEW} avaliações`, `Mostrar las ${reviews.length - PREVIEW} reseñas`)}
          </button>
        </>}
  </div>;
}
