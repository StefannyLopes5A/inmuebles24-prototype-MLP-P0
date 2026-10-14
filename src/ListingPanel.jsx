import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AgencyServiceSeal, ListingTagList} from './ListingCardChrome';
import {listingCardTags} from './listingCardTags';
import {createPortal} from 'react-dom';
import {AnimatePresence, animate, motion, useMotionValue, usePresence, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {homes, listingPrice, propertyPhoto} from './data';
import {DEMO_MXN_PER_USD, useLanguage} from './i18n';
import agencies from '../AGENCY-SOURCES.json';
import {listingDetails} from './listingPresentation';
import {contactValidation, createContactReceipt, normalizeContactProfile} from './contactFlow';
import {advertiserFor, advertiserReviews} from './listingAdvertiser';
import {shortMoney} from './moraAnalysis';
import {MoraInsight} from './MoraInsight';
import {GridIcon, TourControls, useTour} from './ListingGallery';
import {MoraThinking, MoraWords, wordCount} from './MoraVoice';
import {SOFT_MOTION} from './homeIntro.js';
import {developmentFacts, developmentKind} from './development/listingFacts';
import {UNITS, available} from './development/torreOlmo';
import {
  CARD_RADIUS, CONTENT_DELAY, CONTENT_OUT, DISMISS_VELOCITY, EASE_FADE, FOCUS_DELAY, SHEET_DETENTS, SPRING_MORPH, SPRING_SHEET, SPRING_SIZE,
  cornerCss, insetWithin, lerpCorners, lerpRect, panelPlacement, readCorners, relativeRect, safeTop, scrollDelta,
} from './listingPanelMotion';

const asset = name => `/assets/mini-listing/${name}.svg`;
const DELIVERY = ['dez. 2027', 'dic. 2027'];
const FULL_CORNERS = [20, 20, 20, 20];
const SCOPE = '.flow-listings, .discovery-rail';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
const MEDIA_STYLE = ['left', 'top', 'width', 'height', 'right', 'bottom', 'borderRadius'];
const CHROME = '.lp-body, .lp-controls, .lp-photo-chrome, .lp-photo-count, .lp-thumbs';
const MOSAIC_MIN = 5;
const PANEL_SCROLL = '.lp-scroll, .lp-ask-suggest-row, .lp-ask-field textarea';
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']);

/** The page stays put under the panel. Sticky header and filters keep their place; only a scroller inside the panel can move, and only while it still has room. Call `commit` once the opening scroll has landed. */
function lockPageScroll(shell) {
  let released = false, frozen = false, x = 0, y = 0;
  const inside = node => node instanceof Element && shell.current?.contains(node);
  const canScroll = event => {
    const node = event.target instanceof Element ? event.target.closest(PANEL_SCROLL) : null;
    if (!inside(node)) return false;
    if (Math.abs(event.deltaX || 0) > Math.abs(event.deltaY || 0)) return node.scrollWidth > node.clientWidth + 1;
    if ((event.deltaY || 0) < 0) return node.scrollTop > 0;
    if ((event.deltaY || 0) > 0) return node.scrollTop + node.clientHeight < node.scrollHeight - 1;
    return false;
  };
  const blockPointer = event => {
    if (event.type === 'touchmove' && event.target instanceof Element && event.target.closest(PANEL_SCROLL) && inside(event.target)) return;
    if (event.type === 'wheel' && canScroll(event)) return;
    event.preventDefault();
  };
  const blockKeys = event => {
    if (!SCROLL_KEYS.has(event.key) || typing(event.target) || inside(event.target)) return;
    event.preventDefault();
  };
  const hold = () => { if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y); };
  const release = () => {
    if (released) return;
    released = true;
    removeEventListener('scroll', hold);
    document.removeEventListener('wheel', blockPointer, {capture:true});
    document.removeEventListener('touchmove', blockPointer, {capture:true});
    document.removeEventListener('keydown', blockKeys, true);
  };
  release.commit = () => {
    if (released || frozen) return;
    frozen = true;
    x = window.scrollX;
    y = window.scrollY;
    addEventListener('scroll', hold);
  };
  document.addEventListener('wheel', blockPointer, {capture:true, passive:false});
  document.addEventListener('touchmove', blockPointer, {capture:true, passive:false});
  document.addEventListener('keydown', blockKeys, true);
  return release;
}
const typing = target => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const rise = (reduce, delay, still) => reduce ? {} : still
  ? {initial:{opacity:0}, animate:{opacity:1}, transition:{duration:0.2, ease:EASE_FADE, delay}}
  : {initial:{opacity:0, transform:'translateY(8px)'}, animate:{opacity:1, transform:'translateY(0px)'}, transition:{duration:0.2, ease:EASE_FADE, delay}};
// Swapping listings fades only the reading; the footer and every position stay put.
const swapOut = {duration:CONTENT_OUT / 1000, ease:'easeOut'};
const swap = reduce => ({initial:reduce ? {opacity:0} : {opacity:0, transform:'translateY(8px)'}, animate:{opacity:1, transform:'translateY(0px)'}, exit:{opacity:0, transition:{duration:CONTENT_OUT / 1000, ease:'easeOut'}}, transition:{duration:0.2, ease:EASE_FADE}});

const MORA_THINK_MS = 900, FLIGHT_MS = 280, SEND_MS = 420;
// The chat's glide to its end eases out with this time constant: about 95% of the way in 3 × 80 ms, close to the bubble's flight.
const GLIDE_TAU = 80;
const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
const EASE_IN_OUT_CURVE = [0.77, 0, 0.175, 1];
const BUBBLE_PAD = {x:14, y:10};
const crossfade = {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.2, ease:EASE_FADE}};
const CHIPS = [
  {id:'weekend', es:['Visita este fin de semana', '¿Puede ser este fin de semana?'], br:['Visita neste fim de semana', 'Pode ser neste fim de semana?']},
  {id:'negotiable', es:['¿Es negociable?', '¿El precio es negociable?'], br:['É negociável?', 'O preço é negociável?']},
];

const PERIODS = [
  {id:'morning', es:['Mañana', 'por la mañana'], br:['Manhã', 'de manhã']},
  {id:'afternoon', es:['Tarde', 'por la tarde'], br:['Tarde', 'à tarde']},
  {id:'evening', es:['Noche', 'por la noche'], br:['Noite', 'à noite']},
];
const VISIT_WINDOW = 4;
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
const placeOf = home => home.street.toLowerCase().includes(home.area.toLowerCase()) ? home.street : `${home.street}, ${home.area}`;
/** Today and the next three days. A visit is an intention: a day and a period, never a time. */
function visitDays(language) {
  const today = new Date();
  return Array.from({length:VISIT_WINDOW}, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return {index:i, date, weekday:capital(date.toLocaleDateString(language, {weekday:'short'}).replace('.', '')), day:String(date.getDate())};
  });
}
const periodPhrase = (periodId, say) => {
  const item = PERIODS.find(entry => entry.id === periodId);
  return item ? say(item.br[1], item.es[1]) : '';
};
const dayName = (slot, language, say, long) => slot.index === 0
  ? say('Hoje', 'Hoy')
  : capital(slot.date.toLocaleDateString(language, long ? {weekday:'long', day:'numeric', month:'long'} : {weekday:'long'}));
export const intentionLong = (slot, language, say) => `${dayName(slot, language, say, true)} ${periodPhrase(slot.period, say)}`;
const intentionTitle = (slot, language, say) => `${dayName(slot, language, say, false)} ${periodPhrase(slot.period, say)}`;

/**
 * What Mora says to each turn and the widget that follows it. Availability is the one question she answers herself;
 * a visit becomes an intention; anything else waits for the person to confirm before it reaches the agency.
 */
function moraReply(turn, say, advertiser) {
  if (turn.kind === 'visit' || (turn.kind === 'ask' && /visit/i.test(turn.text))) return {widget:'picker', text:say('Quando você quer visitar? Escolha um dia e um período; a imobiliária propõe o horário.', '¿Cuándo te gustaría visitarlo? Elige un día y un periodo; la inmobiliaria propone el horario.')};
  if (turn.kind === 'intention') return {widget:'slot', text:say('Perfeito. Confira sua intenção de visita:', 'Perfecto. Revisa tu intención de visita:')};
  if (turn.kind === 'confirm') return {widget:null, text:say(`Enviei sua intenção para ${advertiser.name}. Eles vão propor um horário com você.`, `Envié tu intención a ${advertiser.name}. Te propondrán un horario.`)};
  if (turn.kind === 'agency-sent') return {widget:null, text:agencySentLine(advertiser, say)};
  if (turn.kind === 'agency-later') return {widget:null, text:say(
    'Tudo bem. Se mudar de ideia, posso enviar essa dúvida para a imobiliária. Posso te ajudar com outra coisa?',
    'Está bien. Si cambias de idea, puedo enviarle esta pregunta a la inmobiliaria. ¿Te ayudo con algo más?')};
  return /disponib|disponív/i.test(turn.text)
    ? {widget:'action', text:say(
      'Sim, continua disponível. As informações do anúncio foram atualizadas recentemente, a imobiliária segue anunciando o imóvel e ele recebeu visitas nos últimos 7 dias.',
      'Sí, sigue disponible. La información del anuncio se actualizó hace poco, la inmobiliaria lo sigue anunciando e incluso recibió visitas en los últimos 7 días.')}
    : {widget:'card', text:say(
      'Revisei o anúncio, as fotos e a descrição, e não encontrei essa resposta. Quer que eu envie sua dúvida para a imobiliária?',
      'Revisé el anuncio, las fotos y la descripción, y no encontré esa respuesta. ¿Quieres que le envíe tu pregunta a la inmobiliaria?')};
}

/** After sending, Mora sets the expectation from how fast this agency usually answers. */
function agencySentLine(advertiser, say) {
  const {name, domi, replyHours:hours} = advertiser;
  if (domi) return say(
    `Pronto, passei sua dúvida para ${name}. Eles costumam responder em minutos pelo WhatsApp, então a resposta deve chegar rápido.`,
    `Listo, le pasé tu pregunta a ${name}. Suelen responder en minutos por WhatsApp, así que la respuesta debería llegar pronto.`);
  if (hours <= 2) return say(
    `Pronto, passei sua dúvida para ${name}. Eles costumam responder em cerca de ${hours} h, então não deve demorar.`,
    `Listo, le pasé tu pregunta a ${name}. Suelen responder en unas ${hours} h, así que no debería tardar.`);
  return say(
    `Pronto, passei sua dúvida para ${name}. Eles costumam levar cerca de ${hours} h para responder, então pode demorar um pouco.`,
    `Listo, le pasé tu pregunta a ${name}. Suelen tardar unas ${hours} h en responder, así que puede demorar un poco.`);
}

function HostLogo({advertiser, say}) {
  return <span className="lp-host-logo-wrap">
    {advertiser.logo
      ? <img className="lp-host-logo" src={advertiser.logo} alt=""/>
      : <span className="lp-host-logo is-monogram" aria-hidden="true">{advertiser.initials}</span>}
    {say && <AgencyServiceSeal advertiser={advertiser} say={say}/>}
  </span>;
}

/**
 * The asked text leaves its field and lands as the bubble. A fixed clone flies the gap so the scroll clip never cuts it.
 * It chases the bubble's live position, so it lands exactly where the bubble is while the chat glides to its end.
 */
function Bubble({turn, reduce}) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current, from = turn.from;
    if (!el || !from || reduce || Date.now() - turn.at > 400) return undefined;
    const clone = el.cloneNode(true);
    clone.classList.add('is-flying');
    const place = progress => {
      const to = el.getBoundingClientRect();
      clone.style.width = `${to.width}px`;
      clone.style.transform = `translate(${from.x + (to.left - from.x) * progress}px, ${from.y + (to.top - from.y) * progress}px)`;
      clone.style.backgroundColor = `rgba(255,241,233,${progress})`;
    };
    Object.assign(clone.style, {left:'0px', top:'0px'});
    place(0);
    document.body.append(clone);
    el.style.opacity = '0';
    const land = () => { clone.remove(); el.style.opacity = ''; };
    const run = animate(0, 1, {duration:FLIGHT_MS / 1000, ease:EASE_IN_OUT_CURVE, onUpdate:place, onComplete:land});
    return () => { run.stop(); land(); };
    // Plays once, when the turn is created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p ref={ref} className="lp-bubble">{turn.text}</p>;
}

/** The line above a card's title: it crossfades to the sent label while the check pops in. */
function ProofStatus({sent, reduce, label}) {
  const check = reduce ? {duration:0.15} : {type:'spring', duration:0.45, bounce:0.35};
  return <p className="lp-proof-eyebrow" role={sent ? 'status' : undefined}>
    <AnimatePresence initial={false}>
      {sent && <motion.span key="check" className="lp-proof-check" aria-hidden="true" initial={reduce ? {opacity:0} : {opacity:0, scale:0.4}} animate={{opacity:1, scale:1}} transition={check}>
        <svg width="12" height="12" viewBox="0 0 24 24"><path d={CHECK_PATH} fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </motion.span>}
    </AnimatePresence>
    <span className="lp-swap"><AnimatePresence initial={false}><motion.span key={label} {...crossfade}>{label}</motion.span></AnimatePresence></span>
  </p>;
}

/**
 * Nothing reaches the agency until the person confirms. Either answer updates this same card in place;
 * the answer itself goes into the chat as the person's message, and Mora replies to it.
 */
function AgencyQuestionCard({home, question, advertiser, agencyState, reduce, say, onSend, onDismiss}) {
  const sent = agencyState === 'sent', dismissed = agencyState === 'dismissed', open = !sent && !dismissed;
  const acted = useRef(false);
  const once = run => event => { if (!open || acted.current) return; acted.current = true; run(event.currentTarget); };
  const title = sent ? say(`Enviada para ${advertiser.name}`, `Enviada a ${advertiser.name}`)
    : dismissed ? say('Não enviada', 'No enviada')
    : say(`Para ${advertiser.name}`, `Para ${advertiser.name}`);
  const meta = sent ? say('A resposta chega pela imobiliária.', 'La respuesta llega por la inmobiliaria.')
    : dismissed ? say('A Mora pode enviar quando você quiser.', 'Mora puede enviarla cuando quieras.')
    : replyLine(advertiser, say);
  return <motion.div className="lp-ask-slot" initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}}
    transition={{height:reduce ? {duration:0.15} : SPRING_SIZE, opacity:{duration:reduce ? 0.15 : 0.2, ease:EASE_FADE}}}>
    <div className="lp-proof-card">
      <div className="lp-proof-head">
        <img src={propertyPhoto(home)} alt=""/>
        <div>
          <ProofStatus sent={sent} reduce={reduce} label={title}/>
          <p className="lp-proof-title">{question}</p>
          <p className="lp-proof-meta lp-swap"><AnimatePresence initial={false}><motion.span key={meta} {...crossfade}>{meta}</motion.span></AnimatePresence></p>
        </div>
      </div>
      <AnimatePresence initial={false}>{open && <Collapse key="actions" reduce={reduce}>
        <div className="lp-proof-actions">
          <button type="button" className="lp-proof-primary" onClick={once(onSend)}>{say('Enviar pergunta', 'Enviar pregunta')}</button>
          <button type="button" className="lp-proof-ghost" onClick={once(onDismiss)}>{say('Agora não', 'Ahora no')}</button>
        </div>
      </Collapse>}</AnimatePresence>
    </div>
  </motion.div>;
}

/**
 * One exchange: the bubble, Mora's fixed reply and the card. Every stage is derived from when the turn was created,
 * so leaving the chat and coming back shows the turn where it is instead of replaying it.
 */
function ChatTurn({turn, home, advertiser, active, reduce, copy, onAsk, onAgencyAction}) {
  const {say, language} = copy;
  const {text:reply, widget} = moraReply(turn, say, advertiser);
  const card = widget === 'card';
  const agencyState = turn.agencyState || 'pending';
  const done = MORA_THINK_MS + (wordCount(reply) - 1) * SOFT_MOTION.wordStep + SOFT_MOTION.fade;
  const marks = [MORA_THINK_MS, done];
  const stageAt = elapsed => reduce ? 2 : marks.filter(mark => elapsed >= mark).length;
  const [stage, setStage] = useState(() => stageAt(Date.now() - turn.at));
  const ink = useRef(stage < 1).current;
  useEffect(() => {
    const elapsed = Date.now() - turn.at;
    const timers = marks.filter(mark => mark > elapsed).map(mark => setTimeout(() => setStage(stageAt(Date.now() - turn.at)), mark - elapsed));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.at, reduce]);
  const think = turn.kind === 'visit' || turn.kind === 'intention' || turn.kind === 'confirm'
    ? say('Revisando a agenda…', 'Revisando la agenda…')
    : turn.kind === 'agency-sent' ? say('Enviando para a imobiliária…', 'Enviando a la inmobiliaria…')
    : turn.kind === 'agency-later' ? say('Pensando…', 'Pensando…')
    : say('Revisando o anúncio…', 'Revisando el anuncio…');
  return <motion.li className="lp-turn" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:reduce ? 0.15 : 0.2, ease:EASE_FADE}}>
    <Bubble turn={turn} reduce={reduce}/>
    <div className="lp-turn-mora">
      {stage === 0 ? <MoraThinking text={think}/> : <MoraWords text={reply} animate={ink}/>}
      {card && stage >= 2 && <AgencyQuestionCard home={home} question={turn.text} advertiser={advertiser} agencyState={agencyState} reduce={reduce} say={say}
        onSend={source => { onAgencyAction(turn.id, 'sent'); onAsk(say('Enviar pergunta', 'Enviar pregunta'), source, 'agency-sent'); }}
        onDismiss={source => { onAgencyAction(turn.id, 'dismissed'); onAsk(say('Agora não', 'Ahora no'), source, 'agency-later'); }}/>}
      {widget && !card && stage >= 2 && <Grow reduce={reduce}>
        {widget === 'action' && <AnimatePresence initial={false}>{active && <Collapse key="action" reduce={reduce}>
          <button type="button" className="lp-chat-action" onClick={event => onAsk(say('Quero visitar o imóvel', 'Quiero visitar el inmueble'), event.currentTarget, 'visit')}><Calendar/>{say('Quero visitar o imóvel', 'Quiero visitar el inmueble')}</button>
        </Collapse>}</AnimatePresence>}
        {widget === 'picker' && <VisitPicker active={active} reduce={reduce} copy={copy} onPick={(slot, source) => onAsk(intentionLong(slot, language, say), source, 'intention', slot)}/>}
        {widget === 'slot' && <IntentionCard home={home} slot={turn.slot} sent={turn.agencyState === 'sent'} active={active} reduce={reduce} copy={copy}
          onConfirm={source => { onAgencyAction(turn.id, 'sent'); onAsk(say('Enviar intenção', 'Enviar intención'), source, 'confirm', turn.slot); }}
          onChange={source => onAsk(say('Quero outro momento', 'Quiero otro momento'), source, 'visit')}/>}
      </Grow>}
    </div>
  </motion.li>;
}

function Calendar() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/></svg>;
}

/** A widget lands by opening its height; the thread keeps it in view while it grows. */
function Grow({reduce, children}) {
  return <motion.div className="lp-ask-slot" initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}}
    transition={{height:reduce ? {duration:0.15} : SPRING_SIZE, opacity:{duration:reduce ? 0.15 : 0.2, ease:EASE_FADE}}}>{children}</motion.div>;
}

function Collapse({reduce, children}) {
  return <motion.div className="lp-collapse" initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}}
    transition={{height:reduce ? {duration:0.15} : SPRING_SIZE, opacity:{duration:0.16, ease:EASE_FADE}}}>{children}</motion.div>;
}

/** Visit intention: four days and a period; the agency proposes the time. */
export function VisitPicker({active, reduce, copy, onPick}) {
  const {say, language} = copy;
  const days = useMemo(() => visitDays(language), [language]);
  const [day, setDay] = useState(0), [period, setPeriod] = useState(null), picked = useRef(false);
  return <AnimatePresence initial={false} mode="popLayout">
    {active ? <Collapse key="open" reduce={reduce}>
      <div className="lp-proof-card lp-pick-card">
        <p className="lp-pick-label">{say('Escolha um dia', 'Elige un día')}</p>
        <div className="lp-pick-days" role="group" aria-label={say('Dia da visita', 'Día de la visita')}>{days.map(item => <button key={item.index} type="button" className="lp-pick-day" aria-pressed={day === item.index} onClick={() => setDay(item.index)}
          aria-label={dayName(item, language, say, true)}>
          <span aria-hidden="true">{item.index === 0 ? say('Hoje', 'Hoy') : item.weekday}</span><strong aria-hidden="true">{item.day}</strong>
        </button>)}</div>
        <p className="lp-pick-label">{say('Escolha um período', 'Elige un periodo')}</p>
        <div className="lp-period-rail" role="group" aria-label={say('Período do dia', 'Periodo del día')}>
          {PERIODS.map(item => <button key={item.id} type="button" className="lp-period-seg" aria-pressed={period === item.id}
            onClick={() => setPeriod(item.id)}>{say(item.br[0], item.es[0])}</button>)}
        </div>
        <p className="lp-pick-note">{say('O horário fica com a imobiliária.', 'El horario lo define la inmobiliaria.')}</p>
        <button type="button" className="lp-proof-primary lp-pick-submit" aria-disabled={!period || undefined}
          onClick={event => { if (!period || !active || picked.current) return; picked.current = true; onPick({...days[day], period}, event.currentTarget); }}>{say('Pedir visita', 'Pedir visita')}</button>
      </div>
    </Collapse> : <Collapse key="folded" reduce={reduce}>
      <span className="lp-chat-action is-done"><Calendar/>{say('Intenção de visita', 'Intención de visita')}</span>
    </Collapse>}
  </AnimatePresence>;
}

/** The intention card is also its own receipt: sending turns it into "sent" in place instead of adding a second card. */
function IntentionCard({home, slot, sent, active, reduce, copy, onConfirm, onChange}) {
  const {say, language} = copy;
  const acted = useRef(false);
  const once = run => event => { if (!active || sent || acted.current) return; acted.current = true; run(event.currentTarget); };
  return <div className="lp-proof-card">
    <div className="lp-proof-head">
      <img src={propertyPhoto(home)} alt=""/>
      <div>
        <ProofStatus sent={sent} reduce={reduce} label={sent ? say('Intenção enviada', 'Intención enviada') : say('Intenção de visita', 'Intención de visita')}/>
        <p className="lp-proof-title">{intentionTitle(slot, language, say)}</p>
        <p className="lp-proof-meta">{sent ? say('Vão propor um horário com você.', 'Te propondrán un horario.') : say('A imobiliária propõe o horário.', 'La inmobiliaria propone el horario.')}</p>
        <p className="lp-proof-meta">{placeOf(home)}</p>
      </div>
    </div>
    <AnimatePresence initial={false}>{active && !sent && <Collapse key="actions" reduce={reduce}>
      <div className="lp-proof-actions">
        <button type="button" className="lp-proof-primary" onClick={once(onConfirm)}>{say('Enviar intenção', 'Enviar intención')}</button>
        <button type="button" className="lp-proof-ghost" onClick={once(onChange)}>{say('Escolher outro momento', 'Elegir otro momento')}</button>
      </div>
    </Collapse>}</AnimatePresence>
  </div>;
}

const HINT_MS = 3200, ASK_MAX_HEIGHT = 128;
function SendGlyph() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 21.7a.5.5 0 0 0 .94-.02l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.02.94l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>
  </svg>;
}
/** Ideas for the open field. They differ from the suggestions, which are already one tap away. */
function askHints(home, say) {
  return [
    say('Pergunte o que quiser sobre este imóvel…', 'Pregúntale lo que quieras sobre este inmueble…'),
    say('Aceitam animais de estimação?', '¿Aceptan mascotas?'),
    say('Quanto é o condomínio?', '¿Cuánto es el mantenimiento?'),
    home.mode === 'rent' ? say('Pedem fiador ou seguro?', '¿Piden aval o póliza?') : say('O preço é negociável?', '¿El precio es negociable?'),
    say('Posso visitar esta semana?', '¿Puedo visitarlo esta semana?'),
  ];
}

/**
 * The open sentence from the search, at the foot of the chat: no box, large type, an orange caret and a placeholder
 * that keeps suggesting what to ask. The suggestions sit on one horizontal row above it until the first question.
 */
function MoraComposer({id, field, draft, onDraft, onAsk, hints, quick, showQuick, onBack, backLabel, reduce, say}) {
  const [hint, setHint] = useState(0);
  const empty = !draft;
  useEffect(() => {
    if (reduce || !empty) return undefined;
    const timer = setInterval(() => setHint(current => (current + 1) % hints.length), HINT_MS);
    return () => clearInterval(timer);
  }, [reduce, empty, hints.length]);
  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, ASK_MAX_HEIGHT)}px`;
  }, [draft, field]);
  const send = source => {
    onAsk(draft, source);
    field.current?.focus({preventScroll:true});
  };
  // The native caret is 1 px. Like the search sentence, the field hides it and draws a heavier one where a hidden mirror
  // of the text up to the cursor ends, so it follows wrapping, new lines and the field's own scroll.
  const anchor = useRef(null);
  const [cursor, setCursor] = useState(null), [caret, setCaret] = useState(null);
  const track = () => {
    const node = field.current;
    setCursor(node && document.activeElement === node && node.selectionStart === node.selectionEnd ? node.selectionStart : null);
  };
  const place = () => {
    const node = field.current, mark = anchor.current;
    if (cursor === null || !node || !mark) { setCaret(null); return; }
    const top = mark.offsetTop - node.scrollTop;
    setCaret(top < 0 || top + mark.offsetHeight > node.offsetHeight + 1 ? null : {left:mark.offsetLeft, top, height:mark.offsetHeight});
  };
  useEffect(() => {
    document.addEventListener('selectionchange', track);
    return () => document.removeEventListener('selectionchange', track);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(place, [cursor, draft]);
  return <div className="lp-ask">
    <AnimatePresence initial={false}>{showQuick && <motion.div key="quick" className="lp-ask-suggest" role="group" aria-label={say('Sugestões de pergunta', 'Preguntas sugeridas')}
      exit={reduce ? {opacity:0} : {opacity:0, height:0}} transition={{height:SPRING_SIZE, opacity:{duration:0.15, ease:EASE_FADE}}}>
      <div className="lp-ask-suggest-row">{quick.map(line => <button key={line} type="button" onClick={event => { onAsk(line, event.currentTarget); field.current?.focus({preventScroll:true}); }}>{line}</button>)}</div>
    </motion.div>}</AnimatePresence>
    <form className="lp-ask-bar" onSubmit={event => { event.preventDefault(); send(field.current); }}>
      <button type="button" className="lp-ask-back" onClick={onBack} aria-label={backLabel} title={backLabel}><Icon name="arrow" size={16}/></button>
      <div className="lp-ask-field">
        <label className="sr-only" htmlFor={id}>{say('Pergunte à Mora sobre este imóvel', 'Pregúntale a Mora sobre este inmueble')}</label>
        {empty && <span className="lp-ask-hint" aria-hidden="true"><AnimatePresence mode="wait" initial={false}>
          <motion.span key={hint} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15, ease:EASE_FADE}}>{hints[hint]}</motion.span>
        </AnimatePresence></span>}
        <textarea ref={field} id={id} value={draft} rows={1} maxLength={500} autoComplete="off" enterKeyHint="send"
          onChange={event => { onDraft(event.target.value); track(); }} onFocus={track} onBlur={track} onSelect={track} onScroll={place}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(event.currentTarget); } }}/>
        <span className="lp-ask-mirror" aria-hidden="true">{draft.slice(0, cursor ?? 0)}<span ref={anchor} className="lp-ask-anchor"/></span>
        {caret && <span key={`${draft.length}-${cursor}`} className="lp-ask-caret" aria-hidden="true" style={{transform:`translate(${caret.left}px, ${caret.top + 3}px)`, height:caret.height - 6}}/>}
      </div>
      {/* Only there once there is something to send, so it never sits greyed out. */}
      <AnimatePresence initial={false}>{draft.trim() && <motion.button key="send" type="submit" className="lp-ask-send" aria-label={say('Enviar pergunta', 'Enviar pregunta')}
        initial={reduce ? {opacity:0} : {opacity:0, scale:0.6}} animate={{opacity:1, scale:1}} exit={reduce ? {opacity:0} : {opacity:0, scale:0.6}}
        transition={{duration:reduce ? 0.15 : 0.16, ease:[0.23, 1, 0.32, 1]}}><SendGlyph/></motion.button>}</AnimatePresence>
    </form>
  </div>;
}

function useCopy() {
  const {language, t, money, currency} = useLanguage();
  const pt = language === 'pt-BR';
  return {language, t, money, currency, pt, say:(br, es) => pt ? br : es, short:amount => shortMoney(currency === 'USD' ? amount / DEMO_MXN_PER_USD : amount)};
}

function Carousel({home, onOpen, copy, tour, tagOptions}) {
  const photos = listingDetails(home).gallery;
  const [index, setIndex] = useState(0);
  const start = useRef(null), dragged = useRef(false), video = useRef(null);
  const showTour = tour && !!home.video && index === 0;
  const playback = useTour(video, showTour ? home.video : null);
  const photoTags = useMemo(() => listingCardTags(home, tagOptions), [home, tagOptions]);
  const go = step => setIndex(current => Math.min(photos.length - 1, Math.max(0, current + step)));
  return <div className="lp-carousel" onPointerDown={event => {start.current = {x:event.clientX, y:event.clientY}; dragged.current = false;}} onPointerUp={event => {
    const from = start.current; start.current = null;
    if (!from) return;
    const dx = event.clientX - from.x, dy = event.clientY - from.y;
    dragged.current = Math.hypot(dx, dy) > 8;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }}>
    <div className="lp-track" style={{transform:`translateX(${-index * 100}%)`}}>
      {photos.map((src, i) => <img key={src} src={src} alt={i === index ? home.imageAlt : ''} draggable={false} loading={i < 2 ? 'eager' : 'lazy'} decoding="async"/>)}
    </div>
    {showTour && <video ref={video} className={`pp-tile-video${playback.playing ? ' is-playing' : ''}`} src={home.video} muted loop playsInline preload="metadata" aria-hidden="true"/>}
    <button type="button" className="lp-photo-open" onClick={() => { if (!dragged.current) onOpen(); }} aria-label={copy.say(`Ver ${home.street} completo`, `Ver ${home.street} completo`)}/>
    {photos.length > 1 && <div className="lp-photo-chrome">
      <button type="button" className="lp-photo-step is-prev" disabled={index === 0} onClick={() => go(-1)} aria-label={copy.say('Foto anterior', 'Foto anterior')}><Icon name="arrow" size={16}/></button>
      <button type="button" className="lp-photo-step is-next" disabled={index === photos.length - 1} onClick={() => go(1)} aria-label={copy.say('Próxima foto', 'Foto siguiente')}><Icon name="arrow" size={16}/></button>
    </div>}
    {showTour && <TourControls tour={playback} say={copy.say}/>}
    {photoTags.length > 0 && <span className="lp-photo-tags discovery-tags"><ListingTagList tags={photoTags}/></span>}
    {!tour && <>
      <span className="lp-photo-count">{copy.say(`${index + 1} de ${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`, `${index + 1} de ${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`)}</span>
    </>}
  </div>;
}

/** The mosaic only previews; every photo and the total lead to the full listing, where the gallery lives. */
function Thumbs({home, onOpen, copy}) {
  const photos = listingDetails(home).gallery;
  return <>
    <div className="lp-thumbs-grid">{photos.slice(1, MOSAIC_MIN).map((src, i) => <button key={src} type="button" className="lp-thumb" onClick={onOpen}
      aria-label={copy.say(`Ver foto ${i + 2} de ${photos.length} no imóvel completo`, `Ver foto ${i + 2} de ${photos.length} en el inmueble completo`)}>
      <img src={src} alt="" draggable={false} decoding="async"/>
    </button>)}</div>
    {photos.length > MOSAIC_MIN && <button type="button" className="pp-show-all" onClick={onOpen}><GridIcon/>{copy.say('Mostrar todas as fotos', 'Mostrar todas las fotos')}</button>}
  </>;
}

function Specs({home, copy}) {
  const {say} = copy, extra = listingDetails(home);
  if (home.development) {
    const [size, beds, parking] = developmentFacts(copy.language);
    const items = [['area', size], ['bed', beds], ...(parking ? [['car', parking]] : [])];
    return <ul className="lp-specs">{items.map(([name, label]) => <li key={name}><img src={asset(name)} alt=""/><span>{label}</span></li>)}
      <li className="lp-specs-units"><span>{say(`${available.length} de ${UNITS.length} disponíveis`, `${available.length} de ${UNITS.length} disponibles`)}</span></li></ul>;
  }
  const items = [];
  if (home.size >= 20) items.push(['area', `${home.size} m²`]);
  if (home.beds != null) items.push(['bed', say(`${home.beds} ${home.beds === 1 ? 'quarto' : 'quartos'}`, `${home.beds} rec.`)]);
  if (home.baths != null) items.push(['bath', say(`${home.baths} ${home.baths === 1 ? 'banheiro' : 'banheiros'}`, `${home.baths} ${home.baths === 1 ? 'baño' : 'baños'}`)]);
  if (extra.parking > 0) items.push(['car', say(`${extra.parking} ${extra.parking === 1 ? 'vaga' : 'vagas'}`, `${extra.parking} estac.`)]);
  return <ul className="lp-specs">{items.slice(0, 5).map(([name, label]) => <li key={name}><img src={asset(name)} alt=""/><span>{label}</span></li>)}</ul>;
}

function replyLine(advertiser, say) {
  return advertiser.domi ? say('Responde em minutos pelo WhatsApp', 'Responde en minutos por WhatsApp') : say(`Costuma responder em ${advertiser.replyHours} h`, `Suele responder en ${advertiser.replyHours} h`);
}

/** Who you will negotiate with comes first, like a host line promoted to the top. The whole row opens the profile. */
function Host({advertiser, copy, onOpen}) {
  const {say, language} = copy;
  const rating = advertiser.rating.toLocaleString(language, {minimumFractionDigits:1, maximumFractionDigits:1});
  return <button type="button" className="lp-host" onClick={onOpen}>
    <HostLogo advertiser={advertiser} say={say}/>
    <span className="lp-host-copy">
      <span className="lp-host-name"><span>{advertiser.name}</span>{advertiser.verified && <svg className="lp-verified" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.4 1.8 3-.1.9 2.8 2.4 1.8-.9 2.8.9 2.8-2.4 1.8-.9 2.8-3-.1L12 21.5l-2.4-1.8-3 .1-.9-2.8-2.4-1.8.9-2.8-.9-2.8 2.4-1.8.9-2.8 3 .1Z" fill="currentColor"/><path d="M8.5 12.2l2.3 2.3 4.7-4.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}{advertiser.verified && <span className="sr-only">{say(', verificada', ', verificada')}</span>}</span>
      <span className="lp-host-trust"><span className="lp-keep"><span className="lp-star" aria-hidden="true">★</span> {say(`${rating} no Google (${advertiser.reviews})`, `${rating} en Google (${advertiser.reviews})`)}</span>{!advertiser.domi && <><span aria-hidden="true"> · </span><span className="lp-keep">{replyLine(advertiser, say)}</span></>}</span>
    </span>
    <span className="sr-only">{say('. Ver perfil e outros imóveis', '. Ver perfil y otros inmuebles')}</span>
  </button>;
}

// Form and sent share one stage: the photo, the agency and its trust facts grow in place instead of a new screen.
const STAGE = {
  form:{art:[150, 100], photo:[68, 80, -18], host:[44, 22, 16], value:15, label:12, cell:[8, 14]},
  sent:{art:[180, 124], photo:[88, 104, -22], host:[56, 30, 24], value:20, label:13, cell:[12, 20]},
};

export function ContactStage({home, advertiser, copy, reduce, sent, visit = false, reviews = true, children}) {
  const {say, language} = copy;
  const rating = advertiser.rating.toLocaleString(language, {minimumFractionDigits:1, maximumFractionDigits:1});
  const s = STAGE[sent ? 'sent' : 'form'];
  const size = reduce ? {duration:0.15} : SPRING_SIZE;
  const enter = delay => reduce ? {duration:0.15} : {...SPRING_SIZE, opacity:{duration:0.2, ease:EASE_FADE, delay}, scale:{type:'spring', duration:0.5, bounce:0.2, delay}, rotate:{type:'spring', duration:0.5, bounce:0.2, delay}};
  const title = node => { if (node && sent) requestAnimationFrame(() => node.focus({preventScroll:true})); };
  return <div className={`lp-stage${sent ? ' is-sent' : ''}`}>
    <motion.div className="lp-stage-art" aria-hidden="true" initial={false} animate={{width:s.art[0], height:s.art[1]}} transition={size}>
      <motion.img className="lp-stage-photo" src={propertyPhoto(home)} alt=""
        initial={reduce ? {opacity:0, width:s.photo[0], height:s.photo[1], x:s.photo[2], rotate:-6} : {opacity:0, scale:0.9, rotate:0, width:s.photo[0], height:s.photo[1], x:s.photo[2]}}
        animate={{opacity:1, scale:1, rotate:-6, width:s.photo[0], height:s.photo[1], x:s.photo[2]}} transition={enter(0.06)}/>
      <motion.span className="lp-stage-host"
        initial={reduce ? {opacity:0, width:s.host[0], height:s.host[0], x:s.host[1], y:s.host[2]} : {opacity:0, scale:0.8, width:s.host[0], height:s.host[0], x:s.host[1], y:s.host[2]}}
        animate={{opacity:1, scale:1, width:s.host[0], height:s.host[0], x:s.host[1], y:s.host[2], fontSize:sent ? 17 : 14}} transition={enter(0.12)}>
        <HostLogo advertiser={advertiser} say={say}/>
        <AnimatePresence initial={false}>{sent && <motion.span key="check" className="lp-stage-check"
          initial={reduce ? {opacity:0} : {opacity:0, scale:0.4}} animate={{opacity:1, scale:1}} transition={reduce ? {duration:0.15} : {type:'spring', duration:0.45, bounce:0.35, delay:0.18}}>
          <svg width="14" height="14" viewBox="0 0 24 24"><path d={CHECK_PATH} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </motion.span>}</AnimatePresence>
      </motion.span>
    </motion.div>
    <AnimatePresence mode="wait" initial={false}>
      <motion.h3 key={sent ? 'sent' : 'form'} ref={title} className={`lp-state-title lp-stage-title${sent ? ' is-sent' : ''}`} tabIndex={-1} {...crossfade}>
        {sent
          ? <span>{visit ? say(`Visita solicitada a ${advertiser.name}`, `Visita solicitada a ${advertiser.name}`) : say(`Mensagem enviada para ${advertiser.name}`, `Mensaje enviado a ${advertiser.name}`)}</span>
          : visit ? say(`Solicitar visita a ${advertiser.name}`, `Solicitar visita a ${advertiser.name}`) : say(`Enviar mensagem para ${advertiser.name}`, `Enviar mensaje a ${advertiser.name}`)}
      </motion.h3>
    </AnimatePresence>
    <AnimatePresence initial={false}>{sent && <motion.p key="sent" className="lp-stage-text" role="status"
      initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} transition={{height:size, opacity:{duration:0.2, ease:EASE_FADE, delay:reduce ? 0 : 0.12}}}>
      {say('Ela vai te responder pelo WhatsApp. Enquanto isso, você pode continuar explorando.', 'Te responderá por WhatsApp. Mientras tanto, puedes seguir explorando.')}
    </motion.p>}</AnimatePresence>
    <motion.ul className="lp-stage-stats" initial={false} animate={{marginTop:sent ? 20 : 14}} transition={size}>
      {[[<><span className="lp-star" aria-hidden="true">★</span> {rating}</>, say(`${advertiser.reviews} avaliações no Google`, `${advertiser.reviews} reseñas en Google`)],
        [advertiser.domi ? say('Minutos', 'Minutos') : `${advertiser.replyHours} h`, say('Tempo de resposta', 'Tiempo de respuesta')]].map(([value, label], i) =>
        <motion.li key={i} initial={false} animate={{paddingTop:s.cell[0], paddingBottom:s.cell[0], paddingLeft:s.cell[1], paddingRight:s.cell[1]}} transition={size}>
          <motion.strong initial={false} animate={{fontSize:s.value, lineHeight:`${Math.round(s.value * 1.3)}px`}} transition={size}>{value}</motion.strong>
          <motion.span initial={false} animate={{fontSize:s.label}} transition={size}>{label}</motion.span>
        </motion.li>)}
    </motion.ul>
    <AnimatePresence initial={false}>{sent && reviews && <Reviews key="reviews" home={home} advertiser={advertiser} say={say} reduce={reduce} size={size}/>}</AnimatePresence>
    <AnimatePresence initial={false}>{!sent && <motion.div key="form" className="lp-stage-form" exit={{opacity:0, height:0}} transition={{height:size, opacity:{duration:0.16, ease:'easeOut'}}}>{children}</motion.div>}</AnimatePresence>
  </div>;
}

function Reviews({home, advertiser, say, reduce, size}) {
  const reviews = useMemo(() => advertiserReviews(advertiser, home.mode), [advertiser, home.mode]);
  return <motion.section className="lp-reviews" aria-label={say('Avaliações no Google', 'Reseñas en Google')}
    initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} transition={{height:size, opacity:{duration:0.2, ease:EASE_FADE, delay:reduce ? 0 : 0.2}}}>
    <ul>{reviews.map((review, i) => <motion.li key={review.name}
      initial={reduce ? {opacity:0} : {opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.32, ease:EASE_FADE, delay:reduce ? 0 : 0.26 + i * 0.06}}>
      <span className="lp-review-head">
        <span className="lp-review-avatar" aria-hidden="true">{review.name[0]}</span>
        <span><strong>{review.name}</strong><span className="lp-review-meta">
          <span className="lp-review-stars" role="img" aria-label={say(`${review.stars} de 5 estrelas`, `${review.stars} de 5 estrellas`)}>
            {[0, 1, 2, 3, 4].map(star => <span key={star} className={star < review.stars ? 'is-on' : undefined} aria-hidden="true">★</span>)}
          </span><span aria-hidden="true">·</span>{say(...review.age)}
        </span></span>
      </span>
      <p>{say(...review.text)}</p>
    </motion.li>)}</ul>
  </motion.section>;
}

/** The saved contact, joined under the message box; the pencil reopens the name and WhatsApp fields in its place. */
export function ContactWho({name, phone, onEdit, say, fade}) {
  return <motion.div key="reuse" className="lp-who" {...fade}>
    <span className="lp-who-copy">
      <span className="lp-who-label">{say('Vão te responder pelo WhatsApp', 'Te responderán por WhatsApp')}</span>
      <span className="lp-who-value"><strong>{name}</strong> · <span className="lp-keep">{phone}</span></span>
    </span>
    <button className="lp-who-change" type="button" onClick={onEdit} aria-label={say('Editar nome e WhatsApp', 'Editar nombre y WhatsApp')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 5.5l4 4M4 20l1-4.5L15.8 4.7a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L8.5 19Z"/></svg>
    </button>
  </motion.div>;
}

export function Toggle({pressed, label, onClick, reduce}) {
  return <motion.button type="button" className="lp-toggle" aria-pressed={pressed} onClick={onClick} whileTap={reduce ? undefined : {scale:0.96}}>
    <span className="lp-toggle-mark" aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.svg key={pressed ? 'on' : 'off'} width="14" height="14" viewBox="0 0 24 24"
          initial={reduce ? {opacity:0} : {opacity:0, scale:0.5, rotate:pressed ? -45 : 45}} animate={{opacity:1, scale:1, rotate:0}} exit={reduce ? {opacity:0} : {opacity:0, scale:0.5}} transition={{duration:0.18, ease:EASE_FADE}}>
          <path d={pressed ? CHECK_PATH : 'M12 5v14M5 12h14'} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
        </motion.svg>
      </AnimatePresence>
    </span>
    {label}
  </motion.button>;
}

function HostProfile({home, advertiser, copy, onOpen}) {
  const {say, money, currency, language} = copy;
  const others = useMemo(() => homes.filter(item => item.id !== home.id && advertiserFor(item, agencies.logos).name === advertiser.name), [home.id, advertiser.name]);
  const rating = advertiser.rating.toLocaleString(language, {minimumFractionDigits:1, maximumFractionDigits:1});
  return <div className="lp-profile">
    <h3 className="lp-state-title" tabIndex={-1}>{advertiser.name}</h3>
    <ul className="lp-profile-facts">
      <li><span className="lp-star" aria-hidden="true">★</span> {say(`${rating} no Google · ${advertiser.reviews} avaliações`, `${rating} en Google · ${advertiser.reviews} reseñas`)}</li>
      <li>{replyLine(advertiser, say)}</li>
      {advertiser.verified && <li>{advertiser.service === 'developer' ? say('Incorporadora verificada pelo Inmuebles24', 'Desarrolladora verificada por Inmuebles24') : say('Imobiliária verificada pelo Inmuebles24', 'Inmobiliaria verificada por Inmuebles24')}</li>}
    </ul>
    {others.length ? <>
      <p className="lp-profile-count">{others.length === 1 ? say('Outro imóvel publicado', 'Otro inmueble publicado') : say(`Outros ${others.length} imóveis publicados`, `Otros ${others.length} inmuebles publicados`)}</p>
      <ul className="lp-profile-list">{others.slice(0, 3).map(item => <li key={item.id}>
        <button type="button" onClick={() => onOpen(item.id)}>
          <img src={propertyPhoto(item)} alt=""/>
          <span><strong>{item.street}, {item.area}</strong><span>{money(listingPrice(item))} {currency}{item.mode === 'rent' ? say(' / mês', ' / mes') : ''}</span></span>
        </button>
      </li>)}</ul>
    </> : <p className="lp-state-context">{say('É o único imóvel publicado agora.', 'Es el único inmueble publicado por ahora.')}</p>}
  </div>;
}

/** One listing's facts, Mora's reading and every contact state. Keyed by listing, so navigation starts fresh. */
function PanelContent({home, titleId, base, navigated, compact, reading, initialAction, profile, onProfile, onReceipt, onClose, onDetails, onFavorite, copy}) {
  const reduce = useReducedMotion();
  const {say, money, currency, pt} = copy;
  const advertiser = useMemo(() => advertiserFor(home, agencies.logos), [home]);
  const talk = say('Falar com a imobiliária', 'Hablar con la inmobiliaria');
  const asking = initialAction?.type === 'ask';
  const [phase, setPhase] = useState(asking ? 'question' : initialAction ? 'contact' : 'summary');
  const chips = CHIPS.map(chip => ({id:chip.id, label:chip[pt ? 'br' : 'es'][0], line:chip[pt ? 'br' : 'es'][1]}));
  const opener = say('Olá, tenho interesse neste imóvel e gostaria de visitá-lo.', 'Hola, me interesa este inmueble y me gustaría visitarlo.');
  const draftFor = question => question?.trim() ? `${opener}\n${question.trim()}` : opener;
  const [text, setText] = useState(() => draftFor(asking ? '' : initialAction?.question));
  const [turns, setTurns] = useState([]), [draft, setDraft] = useState(''), [gap, setGap] = useState(null), [verdict, setVerdict] = useState(null);
  const [data, setData] = useState(() => normalizeContactProfile(profile));
  const known = useMemo(() => {
    const found = contactValidation({profile, channel:'whatsapp', message:'Contacto de prueba'});
    return {name:!found.name, phone:!found.phone};
    // Decided once per listing, so the fields don't vanish while the person types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({}), [sending, setSending] = useState(false), [sendError, setSendError] = useState('');
  const prefix = useId(), formId = `${prefix}-contact`, askId = `${prefix}-ask`, root = useRef(null), askField = useRef(null), threadRef = useRef(null), pinned = useRef(false), timer = useRef(null), pending = useRef(false), lastPhase = useRef(phase), turnId = useRef(0);
  const showName = editing || !known.name, showPhone = editing || !known.phone;
  const hints = askHints(home, say);
  const showFacts = phase === 'summary' || phase === 'advertiser', showHost = showFacts || phase === 'question';
  const place = placeOf(home);
  useEffect(() => () => clearTimeout(timer.current), []);
  const focusNext = useRef(false), intro = useRef(true);
  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    intro.current = false;
    // The chat hands focus to its field instead of the phase heading.
    focusNext.current = phase !== 'question';
    const scroller = root.current?.querySelector('.lp-scroll');
    if (scroller && phase !== 'question') scroller.scrollTop = 0;
  }, [phase]);
  // While the person is at the end of the chat, the end glides after every reply as it types out and every card as it opens.
  // Only the person scrolling up lets go (our own scrolling never does); reaching the end again, or asking, holds on again.
  useEffect(() => {
    const thread = threadRef.current, scroller = root.current?.querySelector('.lp-scroll');
    if (phase !== 'question' || !thread || !scroller) return undefined;
    pinned.current = false;
    let frame = 0, last = 0, touchY = null;
    const ahead = () => scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    const step = now => {
      frame = 0;
      const gap = ahead();
      if (!pinned.current || gap < 1) return;
      const dt = last ? Math.min(now - last, 48) : 16;
      last = now;
      scroller.scrollTop += reduce ? gap : Math.max(1, gap * (1 - Math.exp(-dt / GLIDE_TAU)));
      frame = requestAnimationFrame(step);
    };
    const glide = () => { if (pinned.current && !frame) { last = 0; frame = requestAnimationFrame(step); } };
    const release = () => { pinned.current = false; cancelAnimationFrame(frame); frame = 0; };
    const onWheel = event => { if (event.deltaY < 0) release(); };
    const onTouchStart = event => { touchY = event.touches[0]?.clientY ?? null; };
    const onTouchMove = event => { const y = event.touches[0]?.clientY; if (touchY != null && y - touchY > 4) release(); };
    const onKey = event => { if (/^(ArrowUp|PageUp|Home)$/.test(event.key) && !typing(event.target)) release(); };
    const onScroll = () => { if (ahead() < 8) pinned.current = true; };
    const follow = new ResizeObserver(glide);
    follow.observe(thread);
    scroller.addEventListener('wheel', onWheel, {passive:true});
    scroller.addEventListener('touchstart', onTouchStart, {passive:true});
    scroller.addEventListener('touchmove', onTouchMove, {passive:true});
    scroller.addEventListener('keydown', onKey);
    scroller.addEventListener('scroll', onScroll, {passive:true});
    return () => {
      cancelAnimationFrame(frame); follow.disconnect();
      scroller.removeEventListener('wheel', onWheel);
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('keydown', onKey);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, [phase, reduce]);
  // The field takes focus once the footer has swapped in, so the caret appears where the CTAs were.
  useEffect(() => {
    if (phase !== 'question') return undefined;
    const wait = setTimeout(() => askField.current?.focus({preventScroll:true}), reduce ? 0 : CONTENT_OUT + 220);
    return () => clearTimeout(wait);
  }, [phase, reduce]);
  // Phase headings take focus once the new phase is mounted, without opening the mobile keyboard.
  const phaseMounted = node => {
    if (!node || !focusNext.current) return;
    focusNext.current = false;
    requestAnimationFrame(() => (node.querySelector('.lp-state-title') || document.getElementById(titleId))?.focus({preventScroll:true}));
  };
  function enterContact(question) {
    setErrors({});
    if (question) setText(draftFor(question));
    setPhase('contact');
  }
  function edit() {
    setEditing(true);
    // The fields replace the profile row after its fade out.
    setTimeout(() => root.current?.querySelector('.lp-compose .lp-fieldset input')?.focus({preventScroll:true}), 220);
  }
  function toggle(line) {
    setErrors(current => ({...current, message:undefined}));
    setText(current => current.includes(line) ? current.replace(`\n${line}`, '').replace(line, '').trim() : `${current.trim()}\n${line}`);
  }
  function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const {name, phone, message} = contactValidation({profile:data, channel:'whatsapp', message:text});
    const nextErrors = Object.fromEntries(Object.entries({name, phone, message}).filter(([, value]) => value));
    setErrors(nextErrors); setSendError('');
    if (Object.keys(nextErrors).length) {
      if ((nextErrors.name && !showName) || (nextErrors.phone && !showPhone)) setEditing(true);
      requestAnimationFrame(() => root.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    pending.current = true; setSending(true);
    timer.current = setTimeout(() => {
      try {
        const next = createContactReceipt({home, broker:{name:advertiser.name, verified:advertiser.verified, logo:advertiser.logo}, intent:initialAction?.type === 'visit' ? 'visit' : 'message', channel:'whatsapp', profile:data,
          message:`${text.trim()}\n\n${home.street}, ${home.area} (${say('anúncio', 'anuncio')} ${home.listingId})`});
        onProfile({...profile, ...normalizeContactProfile(data)}); onReceipt(next); setPhase('sent');
      } catch {
        setSendError(say('Não foi possível registrar o envio. Tente novamente.', 'No se pudo registrar el envío. Inténtalo de nuevo.'));
      } finally { pending.current = false; setSending(false); }
    }, SEND_MS);
  }
  /** Every turn starts as a bubble flying from `source`: the field, a suggestion or a chat widget's button. */
  function ask(value, source, kind = 'ask', slot = null) {
    const asked = value.trim();
    if (!asked) return;
    const box = source.getBoundingClientRect(), css = getComputedStyle(source);
    const from = {x:box.left + parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft) - BUBBLE_PAD.x, y:box.top + parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop) - BUBBLE_PAD.y};
    turnId.current += 1;
    pinned.current = true;
    setTurns(current => [...current, {id:turnId.current, text:asked, at:Date.now(), from, kind, slot, agencyState:kind === 'ask' ? 'pending' : undefined}]);
    setDraft('');
  }
  function agencyAction(id, agencyState) {
    setTurns(current => current.map(turn => turn.id === id ? {...turn, agencyState} : turn));
  }
  // A question typed on the listing page arrives as the first turn, flying from the panel's own field.
  useEffect(() => {
    if (!asking || !initialAction.question) return;
    const timer = setTimeout(() => {
      if (askField.current) ask(initialAction.question, askField.current);
    }, 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fieldError = name => name === 'name'
    ? say('Digite seu nome, com pelo menos 2 letras.', 'Escribe tu nombre, con al menos 2 letras.')
    : say('Inclua + e o código do país, como +52 55 1234 5678.', 'Incluye + y el código del país, como +52 55 1234 5678.');
  // Airbnb-style floating label: the label sits in the field and shrinks above the value once there is one.
  const field = (name, label, type, autoComplete) => <label className={`lp-float${errors[name] ? ' is-invalid' : ''}`} htmlFor={`${prefix}-${name}`}>
    <input id={`${prefix}-${name}`} name={name} type={type} inputMode={type === 'tel' ? 'tel' : 'text'} autoComplete={autoComplete} value={data[name]} placeholder=" " maxLength={name === 'name' ? 80 : 120} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined} onChange={event => {const value = event.target.value; setData(current => ({...current, [name]:value}));setErrors(current => ({...current, [name]:undefined}));}}/>
    <span>{label}</span>
  </label>;
  const usual = home.mode === 'rent'
    ? [say('Ainda está disponível?', '¿Sigue disponible?'), say('Quais são os requisitos para alugar?', '¿Qué requisitos piden para rentar?'), say('Tem custos além do aluguel?', '¿Hay gastos además de la renta?')]
    : [say('Ainda está disponível?', '¿Sigue disponible?'), say('Aceitam financiamento?', '¿Aceptan crédito hipotecario?'), say('Tem custos além do preço?', '¿Hay gastos además del precio?')];
  const quick = gap ? [gap, ...usual.filter(line => line !== gap)].slice(0, 3) : usual;
  const talkToMora = () => {
    setGap(verdict?.question?.match(/^[^?]*\?/)?.[0].trim() || null);
    setPhase('question');
  };
  const operation = home.development ? say(`Empreendimento · entrega ${DELIVERY[0]}`, `Desarrollo · entrega ${DELIVERY[1]}`)
    : home.mode === 'rent' ? say('Apartamento para alugar', 'Departamento en renta') : say('Apartamento à venda', 'Departamento en venta');
  const backLabel = say('Voltar para ver o resumo', 'Volver a ver el resumen');
  // Summary and chat share one tree, so the verdict card stays mounted and only travels to the top.
  const flowKey = phase === 'sent' || phase === 'contact' ? 'contact' : phase === 'advertiser' ? 'advertiser' : 'mora';
  const verdictBlock = flowKey === 'mora' && <motion.div className="lp-verdict-slot" layout="position" transition={{layout:reduce ? {duration:0} : SPRING_MORPH}}>
    <MoraInsight home={home} options={reading.options} signature={reading.signature} short={copy.short} say={say} variant="verdict" folded={phase === 'question' && turns.length > 0} onVerdict={setVerdict}/>
  </motion.div>;
  const toSummary = () => setPhase('summary');
  const fade = {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.18, ease:EASE_FADE}};
  const fieldErrors = ['name', 'phone'].filter(name => errors[name] && (name === 'name' ? showName : showPhone));
  const contactStage = <form id={formId} className="lp-compose" noValidate onSubmit={submit} aria-busy={sending}>
    <ContactStage home={home} advertiser={advertiser} copy={copy} reduce={reduce} sent={phase === 'sent'}>
      <div className="lp-entry">
        <div className={`lp-message${errors.message ? ' is-invalid' : ''}`}>
          <label className="lp-message-label" htmlFor={`${prefix}-message`}>{say('Sua mensagem', 'Tu mensaje')}</label>
          <textarea id={`${prefix}-message`} className="lp-message-text" value={text} rows={3} maxLength={1200}
            aria-invalid={!!errors.message} aria-describedby={errors.message ? `${prefix}-message-error` : undefined}
            onChange={event => {setText(event.target.value); setErrors(current => ({...current, message:undefined}));}}/>
          <div className="lp-toggles" role="group" aria-label={say('Adicionar à mensagem', 'Agregar al mensaje')}>
            {chips.map(chip => <Toggle key={chip.id} pressed={text.includes(chip.line)} label={chip.label} reduce={reduce} onClick={() => toggle(chip.line)}/>)}
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {showName || showPhone
            ? <motion.div key="fields" {...fade}>
              <div className="lp-fieldset">
                {showName && field('name', say('Seu nome', 'Tu nombre'), 'text', 'name')}
                {showPhone && field('phone', 'WhatsApp', 'tel', 'tel')}
              </div>
            </motion.div>
            : <ContactWho key="reuse" name={data.name} phone={data.phone} onEdit={edit} say={say} fade={fade}/>}
        </AnimatePresence>
      </div>
      {(errors.message || fieldErrors.length > 0) && <div>
        {errors.message && <span className="lp-field-error" id={`${prefix}-message-error`}>{say('Escreva uma mensagem de pelo menos 10 caracteres.', 'Escribe un mensaje de al menos 10 caracteres.')}</span>}
        {fieldErrors.map(name => <span key={name} className="lp-field-error" id={`${prefix}-${name}-error`}>{fieldError(name)}</span>)}
      </div>}
      {sendError && <p role="alert" className="lp-field-error">{sendError}</p>}
      <p className="lp-compose-share">{say('Ao enviar, você concorda em compartilhar seus dados com 1 imobiliária.', 'Al enviar, aceptas compartir tus datos con 1 inmobiliaria.')}</p>
    </ContactStage>
  </form>;

  const thread = phase === 'question' && <ol ref={threadRef} className="lp-thread" role="log" aria-label={say('Conversa com a Mora', 'Conversación con Mora')}>
    {turns.map((turn, i) => <ChatTurn key={turn.id} turn={turn} home={home} advertiser={advertiser} active={i === turns.length - 1} reduce={reduce} copy={copy} onAsk={ask} onAgencyAction={agencyAction}/>)}
  </ol>;
  const body = {
    advertiser:<HostProfile home={home} advertiser={advertiser} copy={copy} onOpen={onFavorite}/>,
    contact:contactStage,
    sent:contactStage,
  }[phase];

  const back = <button type="button" className="lp-secondary" disabled={sending} onClick={toSummary}>{backLabel}</button>;
  const full = <button type="button" className="lp-secondary" onClick={onDetails}>{say('Ver imóvel completo', 'Ver inmueble completo')}</button>;
  const primary = <button type="button" className={`lp-primary${advertiser.domi ? ' has-note' : ''}`} onClick={() => enterContact()}>
    <span>{talk}</span>{advertiser.domi && <>{' '}<span className="lp-primary-note">{replyLine(advertiser, say)}</span></>}
  </button>;
  const sendLabel = sending ? say('Enviando…', 'Enviando…') : say('Enviar mensagem', 'Enviar mensaje');
  const footer = {
    summary:<div className="lp-actions is-verdict">
      <button type="button" className="lp-verdict-talk" onClick={talkToMora}><img src="/assets/mini-listing/mora-white.svg" alt=""/><span>{say('Falar deste imóvel com a Mora', 'Hablar de este inmueble con Mora')}</span></button>
      <button type="button" className="lp-verdict-more" onClick={onDetails}>{say('Ver imóvel completo', 'Ver inmueble completo')}</button>
    </div>,
    question:<MoraComposer id={askId} field={askField} draft={draft} onDraft={setDraft} onAsk={(value, source) => ask(value, source)} hints={hints}
      quick={quick} showQuick={!turns.length} onBack={toSummary} backLabel={backLabel} reduce={reduce} say={say}/>,
    advertiser:<div className="lp-actions">{primary}{back}</div>,
    contact:<div className="lp-actions">
      <button type="submit" form={formId} className="lp-primary lp-compose-send" aria-disabled={sending || undefined}>
        <span className="lp-swap"><AnimatePresence initial={false}><motion.span key={sending ? 'sending' : 'send'} {...crossfade}>{sendLabel}</motion.span></AnimatePresence></span>
      </button>
      {back}
    </div>,
    sent:<div className="lp-actions is-summary"><button type="button" className="lp-primary" onClick={onClose}>{say('Continuar explorando', 'Seguir explorando')}</button>{back}{full}</div>,
  }[phase];

  const enter = intro.current && lastPhase.current === phase;
  const hostMotion = reduce ? {} : {initial:navigated ? {opacity:0} : {opacity:0, transform:'translateY(8px)'}, animate:{opacity:1, transform:'translateY(0px)'}, exit:{opacity:0, transition:swapOut}, transition:{duration:0.2, ease:EASE_FADE, delay:enter ? base : CONTENT_OUT / 1000}};
  // On the first paint the facts rise in like the rest of the panel; coming back from the chat they only fade in.
  // Leaving, they pop out of the flow at once so the verdict can start travelling while they fade.
  const factsIn = delay => flowKey === 'mora' && !enter
    ? {initial:{opacity:0}, animate:{opacity:1}, transition:{duration:reduce ? 0.15 : 0.2, ease:EASE_FADE, delay:reduce ? 0 : 0.08}}
    : rise(reduce || !enter || navigated, base + delay);
  const factsOut = {opacity:0, transition:{duration:reduce ? 0.15 : CONTENT_OUT / 1000, ease:'easeOut'}};
  return <div ref={root} className={`lp-content lp-phase-${phase}${compact ? ' is-compact' : ''}`}>
    <motion.div className="lp-scroll" layoutScroll variants={{out:{opacity:0, transition:swapOut}}}>
      <div className="lp-flow">
        <AnimatePresence>{showHost && <motion.div key="host" className="lp-host-row" {...hostMotion}><Host advertiser={advertiser} copy={copy} onOpen={() => setPhase('advertiser')}/></motion.div>}</AnimatePresence>
        <div>
          <AnimatePresence mode="wait" initial={navigated}><motion.div key={flowKey} ref={phaseMounted} className="lp-flow lp-reading-flow" {...swap(reduce)} {...(navigated && enter ? rise(reduce, base, true) : {})}>
            <AnimatePresence mode="popLayout" initial={enter}>
              {showFacts && <motion.header key="header" className="lp-header" {...factsIn(0.04)} exit={factsOut}>
                <p className="lp-operation">{operation}</p>
                <h2 id={titleId} tabIndex={-1}>{place}</h2>
                <p className="lp-price">{home.development && <span className="lp-price-from">{developmentKind(copy.language)} </span>}{money(listingPrice(home))} {currency}{home.mode === 'rent' ? say(' / mês', ' / mes') : ''}</p>
              </motion.header>}
              {showFacts && <motion.div key="specs" {...factsIn(0.08)} exit={factsOut}><Specs home={home} copy={copy}/></motion.div>}
            </AnimatePresence>
            {!showFacts && <h2 id={titleId} className="sr-only" tabIndex={-1}>{place}</h2>}
            <motion.div className="lp-phase" {...rise(reduce || !enter || navigated, base + 0.12)}>
              {verdictBlock}
              {thread}
              {body}
            </motion.div>
          </motion.div></AnimatePresence>
        </div>
      </div>
    </motion.div>
    <motion.div className="lp-footer" {...rise(reduce || navigated, base + 0.18)}>
      <AnimatePresence mode="wait" initial={false}><motion.div key={phase} className="lp-footer-inner" {...swap(reduce)}>{footer}</motion.div></AnimatePresence>
    </motion.div>
  </div>;
}

/**
 * The mini-listing grows out of the clicked card: one spring drives the surface clip and the photo frame,
 * so opening, closing and interruptions share the same motion. Below 768 px it becomes a bottom sheet.
 */
export function ListingPanel({home, origin, search, pref, hasSearch = true, favorites = [], initialAction, profile, onProfile, onReceipt, onClose, onNavigate, onDetails}) {
  const copy = useCopy();
  const reduce = useReducedMotion();
  const [isPresent, safeToRemove] = usePresence();
  const titleId = useId();
  const shell = useRef(null), media = useRef(null), closeButton = useRef(null);
  const returnFocus = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const scope = useRef((origin?.isConnected && origin.closest(SCOPE)) || document.querySelector('.flow-listings'));
  const firstId = useRef(home.id);
  const progress = useMotionValue(0);
  const geo = useRef(null), motionRun = useRef(null), closing = useRef(false), mode = useRef('fade'), scrollLock = useRef(null), scrollRide = useRef(null), openGen = useRef(0);
  // The full listing opens at the top while the panel is still leaving, so the page hold has to let go first.
  const toDetails = (...args) => {
    scrollRide.current = null;
    scrollLock.current?.();
    scrollLock.current = null;
    onDetails?.(...args);
  };
  const findCard = id => {
    if (!id) return null;
    if (origin?.isConnected && origin.dataset.homeId === String(id) && id === firstId.current) return origin;
    const selector = `.discovery-item[data-home-id="${CSS.escape(String(id))}"]`;
    return (scope.current?.isConnected && scope.current.querySelector(selector)) || document.querySelector(selector);
  };
  const halfMap = () => document.documentElement.dataset.mapMode === 'half' ? document.querySelector('.map-shell')?.getBoundingClientRect().right : undefined;
  const placementFor = () => panelPlacement({card:findCard(firstId.current) || findCard(home.id), container:(origin?.isConnected ? origin : findCard(home.id))?.closest('.flow-grid, .discovery-rail') || (scope.current?.isConnected && scope.current.querySelector('.flow-grid')) || null, reach:halfMap()});
  const [placement, setPlacement] = useState(placementFor);
  const [contentVisible, setContentVisible] = useState(false);
  const [settled, setSettled] = useState(false);
  const [detent, setDetent] = useState(0);
  const [base, setBase] = useState(0);
  const sheet = placement.mode === 'sheet';

  const favoriteIds = favorites.map(item => item.id).join(',');
  const reading = useMemo(() => {
    const options = {search, pref, favorites:favorites.filter(item => item.id !== home.id), hasSearch, language:copy.language, money:copy.money, short:copy.short};
    return {search, pref, options, signature:JSON.stringify([search, pref, favoriteIds, hasSearch, copy.language, copy.currency])};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.id, search, pref, favoriteIds, hasSearch, copy.language, copy.currency]);
  const tagOptions = useMemo(() => ({search:hasSearch ? search : null, pref, language:copy.language}), [search, pref, hasSearch, copy.language]);

  function applyGeometry(t) {
    const g = geo.current, el = shell.current, photo = media.current;
    if (!g || !el || !photo) return;
    el.style.clipPath = insetWithin(lerpRect(g.card, g.full, t), g.full, lerpCorners(g.cardCorners, FULL_CORNERS, t));
    const frame = lerpRect(g.cardMedia, g.rest, t);
    Object.assign(photo.style, {left:`${frame.left}px`, top:`${frame.top}px`, width:`${frame.width}px`, height:`${frame.height}px`, right:'auto', bottom:'auto', borderRadius:cornerCss(lerpCorners(g.mediaCorners, g.restCorners, t))});
  }
  function clearGeometry() {
    if (shell.current) shell.current.style.clipPath = '';
    if (media.current) for (const key of MEDIA_STYLE) media.current.style[key] = '';
  }
  function measure(card, limit = safeTop()) {
    const el = shell.current, photo = media.current;
    if (!card || !el || !photo) return null;
    clearGeometry();
    const box = el.getBoundingClientRect();
    const cardBox = card.querySelector('.discovery-card') || card;
    const cardMedia = card.querySelector('.discovery-media') || cardBox;
    const rect = cardBox.getBoundingClientRect();
    if (rect.bottom < limit || rect.top > innerHeight || !rect.width) return null;
    return {
      full:{left:0, top:0, width:box.width, height:box.height},
      card:relativeRect(rect, box),
      cardMedia:relativeRect(cardMedia.getBoundingClientRect(), box),
      rest:relativeRect(photo.getBoundingClientRect(), box),
      cardCorners:[CARD_RADIUS, CARD_RADIUS, CARD_RADIUS, CARD_RADIUS],
      mediaCorners:readCorners(cardMedia).map(value => Math.max(value, CARD_RADIUS)),
      restCorners:readCorners(photo),
    };
  }
  useEffect(() => progress.on('change', applyGeometry), [progress]);

  function sheetHeight(index = detent) { return Math.round(innerHeight * SHEET_DETENTS[index]); }

  function open() {
    const gen = ++openGen.current;
    closing.current = false;
    const el = shell.current;
    motionRun.current?.stop();
    scrollRide.current = null;
    document.documentElement.dataset.listingPanel = 'open';
    const card = findCard(home.id);
    const delta = placement.mode === 'sheet' ? 0 : scrollDelta(placement);
    const ride = delta ? {x:window.scrollX, y:window.scrollY, delta} : null;
    const follow = value => {
      const current = scrollRide.current;
      if (!current || openGen.current !== gen) return;
      const t = Math.min(1, Math.max(current.seen || 0, value));
      current.seen = t;
      window.scrollTo(current.x, current.y + current.delta * t);
    };
    scrollLock.current?.();
    const lock = lockPageScroll(shell);
    scrollLock.current = lock;
    const finishRide = () => {
      if (openGen.current !== gen || closing.current) return;
      if (ride) window.scrollTo(ride.x, ride.y + ride.delta);
      scrollRide.current = null;
      lock.commit();
    };
    if (placement.mode === 'sheet') {
      mode.current = reduce ? 'fade' : 'sheet';
      if (!reduce) motionRun.current = animate(el, {transform:['translateY(100%)', 'translateY(0%)']}, {...SPRING_SHEET, onComplete:() => { if (openGen.current === gen) setSettled(true); }});
      finishRide();
    } else if (reduce) {
      if (ride) window.scrollTo(ride.x, ride.y + ride.delta);
      mode.current = 'fade';
      finishRide();
    } else {
      geo.current = measure(card);
      mode.current = geo.current ? 'morph' : 'fade';
      if (mode.current === 'morph') {
        scrollRide.current = ride;
        progress.jump(0);
        applyGeometry(0);
        motionRun.current = animate(progress, 1, {...SPRING_MORPH, onUpdate:follow, onComplete:() => {
          if (openGen.current !== gen) return;
          clearGeometry();
          finishRide();
          setSettled(true);
          setContentVisible(true);
        }});
      } else if (ride) {
        scrollRide.current = ride;
        el.style.opacity = '0';
        motionRun.current = animate(0, 1, {...SPRING_MORPH, onUpdate:value => {
          follow(value);
          if (openGen.current === gen) el.style.opacity = String(Math.min(1, Math.max(0, value)));
        }, onComplete:() => {
          if (openGen.current !== gen) return;
          el.style.opacity = '';
          finishRide();
          setSettled(true);
          setContentVisible(true);
        }});
      } else finishRide();
    }
    if (mode.current === 'fade' && !(ride && !reduce)) motionRun.current = animate(el, {opacity:[0, 1]}, {duration:0.15, ease:'easeOut', onComplete:() => { if (openGen.current === gen) setSettled(true); }});
    setBase(0);
    const reveal = setTimeout(() => { if (!(ride && !reduce)) setContentVisible(true); }, reduce ? 0 : CONTENT_DELAY);
    const focus = setTimeout(() => closeButton.current?.focus({preventScroll:true}), reduce ? 60 : FOCUS_DELAY);
    return () => {clearTimeout(reveal); clearTimeout(focus);};
  }

  async function close() {
    if (closing.current) return;
    closing.current = true;
    const el = shell.current;
    const card = findCard(home.id);
    setSettled(false);
    await animate(el.querySelectorAll(CHROME), {opacity:0}, {duration:reduce ? 0.01 : CONTENT_OUT / 1000, ease:'easeOut'});
    delete document.documentElement.dataset.listingPanel;
    motionRun.current?.stop();
    scrollRide.current = null;
    if (placement.mode === 'sheet' && !reduce) {
      await animate(el, {transform:'translateY(100%)'}, {duration:0.24, ease:[0.32, 0.72, 0, 1]});
    } else {
      geo.current = reduce || placement.mode === 'sheet' ? null : measure(card);
      if (geo.current) {
        applyGeometry(1);
        progress.jump(1);
        motionRun.current = animate(progress, 0, SPRING_MORPH);
        await motionRun.current;
      } else {
        await animate(el, {opacity:0}, {duration:0.15, ease:'easeOut'});
      }
    }
    if (card && !reduce) {
      card.classList.add('is-returning');
      const clearReturn = event => {
        if (event?.animationName && event.animationName !== 'lp-card-return') return;
        card.classList.remove('is-returning');
        card.removeEventListener('animationend', clearReturn);
      };
      card.addEventListener('animationend', clearReturn);
      setTimeout(clearReturn, 500);
    }
    card?.removeAttribute('data-panel-source');
    scrollLock.current?.();
    scrollLock.current = null;
    const target = card?.querySelector('.discovery-open') || (returnFocus.current?.isConnected ? returnFocus.current : null);
    safeToRemove();
    requestAnimationFrame(() => target?.focus({preventScroll:true}));
  }

  useLayoutEffect(() => {
    if (sheet && shell.current) shell.current.style.height = `${sheetHeight(0)}px`;
    return open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!isPresent) close();
    else if (closing.current) {
      closing.current = false;
      shell.current?.querySelectorAll(CHROME).forEach(item => { item.style.opacity = ''; });
      open();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);
  useEffect(() => () => {
    motionRun.current?.stop();
    scrollRide.current = null;
    scrollLock.current?.();
    scrollLock.current = null;
    delete document.documentElement.dataset.listingPanel;
    document.querySelectorAll('[data-panel-source]').forEach(item => item.removeAttribute('data-panel-source'));
  }, []);

  useLayoutEffect(() => {
    const card = findCard(home.id);
    card?.setAttribute('data-panel-source', '');
    return () => { if (!closing.current) card?.removeAttribute('data-panel-source'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.id]);

  const shown = useRef(home.id);
  useEffect(() => {
    if (shown.current === home.id) return;
    shown.current = home.id;
    setBase(0.08);
  }, [home.id]);

  useEffect(() => {
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = shell.current;
        if (closing.current || !el) return;
        const next = placementFor();
        setPlacement(next);
        if (next.mode === 'sheet') el.style.height = `${sheetHeight()}px`;
        else if (el.dataset.layout === 'sheet') {el.style.height = ''; el.style.transform = '';}
      });
    };
    addEventListener('resize', resize);
    return () => {cancelAnimationFrame(frame); removeEventListener('resize', resize);};
  });

  function neighbor(step) {
    const root = scope.current?.isConnected ? scope.current : document.querySelector('.flow-listings');
    const ids = [...new Set([...(root?.querySelectorAll('.discovery-item[data-home-id]') || [])].map(item => item.dataset.homeId))];
    const index = ids.indexOf(String(home.id));
    return index < 0 ? null : ids[index + step] || null;
  }
  const previous = neighbor(-1), next = neighbor(1);
  const go = id => { if (id && homes.some(item => item.id === id)) onNavigate(id); };

  useEffect(() => {
    const key = event => {
      if (closing.current) return;
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onClose(); return; }
      if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey && !event.metaKey && !event.ctrlKey && !typing(event.target) && !event.target.closest?.('.lp-carousel')) {
        const id = event.key === 'ArrowRight' ? next : previous;
        if (id) { event.preventDefault(); go(id); }
        return;
      }
      if (event.key === 'Tab') trap(event, shell.current);
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  });

  useEffect(() => {
    const press = event => {
      if (closing.current) return;
      const target = event.target;
      if (!(target instanceof Element) || shell.current?.contains(target)) return;
      if (target.closest('.discovery-item, dialog, [role="dialog"], [role="alertdialog"], [data-feedback-toolbar]')) return;
      onClose();
    };
    document.addEventListener('pointerdown', press, true);
    return () => document.removeEventListener('pointerdown', press, true);
  });

  function trap(event, container) {
    if (!container) return;
    const items = [...container.querySelectorAll(FOCUSABLE)].filter(item => item.getClientRects().length && !item.closest('[inert]'));
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!container.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const drag = useRef(null);
  function grabStart(event) {
    if (!sheet) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers have no capture target. */ }
    drag.current = {y:event.clientY, height:shell.current.offsetHeight, time:performance.now(), lastY:event.clientY, velocity:0};
  }
  function grabMove(event) {
    const state = drag.current;
    if (!state) return;
    const now = performance.now();
    state.velocity = (event.clientY - state.lastY) / Math.max(1, now - state.time);
    state.lastY = event.clientY; state.time = now;
    shell.current.style.height = `${Math.max(120, Math.min(sheetHeight(1), state.height - (event.clientY - state.y)))}px`;
  }
  function grabEnd() {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    const height = shell.current.offsetHeight;
    if (state.velocity > DISMISS_VELOCITY || height < innerHeight * 0.4) { onClose(); return; }
    const target = state.velocity < -DISMISS_VELOCITY ? 1 : Math.abs(height - sheetHeight(0)) <= Math.abs(height - sheetHeight(1)) ? 0 : 1;
    animate(shell.current, {height:sheetHeight(target)}, reduce ? {duration:0} : SPRING_SHEET).then(() => setDetent(target));
  }

  // The summary should read whole: once Mora's verdict lands cut off, the sheet rises to its tall detent, once per panel.
  const rose = useRef(false);
  useEffect(() => {
    const body = shell.current?.querySelector('.lp-body');
    if (!sheet || !settled || detent || rose.current || !body) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const scroller = body.querySelector('.lp-scroll');
      if (rose.current || !scroller?.querySelector('.lp-mora.is-verdict[aria-busy="false"]') || scroller.scrollHeight <= scroller.clientHeight + 1) return;
      rose.current = true;
      observer.disconnect();
      animate(shell.current, {height:sheetHeight(1)}, reduce ? {duration:0} : SPRING_SHEET).then(() => setDetent(1));
    };
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(check); });
    observer.observe(body, {subtree:true, childList:true, attributes:true, attributeFilter:['style']});
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, settled, detent]);

  const swipe = useRef(null);
  const swipeHandlers = {
    onPointerDown:event => { swipe.current = event.pointerType === 'touch' && !event.target.closest('.lp-carousel, input, textarea') ? {x:event.clientX, y:event.clientY} : null; },
    onPointerUp:event => {
      const from = swipe.current; swipe.current = null;
      if (!from) return;
      const dx = event.clientX - from.x, dy = event.clientY - from.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) go(dx < 0 ? next : previous);
    },
  };

  const style = sheet ? undefined : {top:placement.top, left:placement.left, width:placement.width, height:placement.height};
  const layout = sheet ? 'sheet' : placement.stacked ? 'stacked' : 'side';
  const photoCount = listingDetails(home).gallery.length;
  const mediaWidth = placement.width - Math.min(placement.width * 0.52, 624);
  const mosaic = layout !== 'side' || photoCount < MOSAIC_MIN ? 'single' : mediaWidth / placement.height >= 1.15 ? 'wide' : 'tall';
  return createPortal(<>
    <div ref={shell} className={`lp-shell${settled ? ' is-settled' : ''}`} data-layout={layout} data-mosaic={mosaic} data-ready={contentVisible ? '' : undefined}
      role="dialog" aria-modal="true" aria-labelledby={titleId} style={style}>
      <div ref={media} className="lp-media">
        <AnimatePresence initial={false}>
          <motion.div key={home.id} className="lp-media-layer" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduce ? 0 : 0.4, ease:EASE_FADE}}>
            <Carousel home={home} copy={copy} onOpen={toDetails} tour={mosaic !== 'single'} tagOptions={tagOptions}/>
          </motion.div>
        </AnimatePresence>
      </div>
      {mosaic !== 'single' && <div className="lp-thumbs">
        <AnimatePresence initial={false}>
          <motion.div key={home.id} className="lp-thumbs-layer" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduce ? 0 : 0.4, ease:EASE_FADE}}>
            <Thumbs home={home} copy={copy} onOpen={toDetails}/>
          </motion.div>
        </AnimatePresence>
      </div>}
      {sheet && <div className="lp-grab" onPointerDown={grabStart} onPointerMove={grabMove} onPointerUp={grabEnd} onPointerCancel={grabEnd} aria-hidden="true"><span/></div>}
      <div className="lp-body" {...swipeHandlers}>
        <AnimatePresence mode="wait" initial={false}>
          {contentVisible && <motion.div key={home.id} className="lp-body-inner" exit="out">
            <PanelContent home={home} titleId={titleId} base={base} navigated={base > 0} compact={placement.compact} reading={reading} initialAction={home.id === firstId.current ? initialAction : null}
              profile={profile} onProfile={onProfile} onReceipt={onReceipt} onClose={onClose} onDetails={toDetails} onFavorite={go} copy={copy}/>
          </motion.div>}
        </AnimatePresence>
      </div>
      <div className="lp-controls">
        {(previous || next) && <>
          <button type="button" className="lp-control is-prev" disabled={!previous} onClick={() => go(previous)} aria-label={copy.say('Imóvel anterior', 'Inmueble anterior')}><Icon name="arrow" size={16}/></button>
          <button type="button" className="lp-control is-next" disabled={!next} onClick={() => go(next)} aria-label={copy.say('Próximo imóvel', 'Inmueble siguiente')}><Icon name="arrow" size={16}/></button>
        </>}
        <button ref={closeButton} type="button" className="lp-control is-close" onClick={onClose} aria-label={copy.say('Fechar', 'Cerrar')}><img src={asset('close')} alt=""/></button>
      </div>
    </div>
  </>, document.body);
}
