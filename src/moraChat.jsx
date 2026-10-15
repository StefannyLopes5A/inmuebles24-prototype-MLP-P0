import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, animate, motion} from 'motion/react';
import {Icon} from './App';
import {propertyPhoto} from './data';
import {MoraThinking, MoraWords, wordCount} from './MoraVoice';
import {SOFT_MOTION} from './homeIntro.js';
import {EASE_FADE, SPRING_SIZE} from './listingPanelMotion';

/** The chat with Mora about one listing: the mini-listing's `question` phase, shared with the 3D tour's panel. */

export const MORA_THINK_MS = 900;
const FLIGHT_MS = 280;
// The chat's glide to its end eases out with this time constant: about 95% of the way in 3 × 80 ms, close to the bubble's flight.
const GLIDE_TAU = 80;
export const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
const EASE_IN_OUT_CURVE = [0.77, 0, 0.175, 1];
const BUBBLE_PAD = {x:14, y:10};
export const crossfade = {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.2, ease:EASE_FADE}};
/** Who answers what Mora can't: the noun after "a" / "la". Both nouns in use are feminine, so the sentences stay the same. */
export const AGENCY = ['imobiliária', 'inmobiliaria'];

export const typing = target => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const PERIODS = [
  {id:'morning', es:['Mañana', 'por la mañana'], br:['Manhã', 'de manhã']},
  {id:'afternoon', es:['Tarde', 'por la tarde'], br:['Tarde', 'à tarde']},
  {id:'evening', es:['Noche', 'por la noche'], br:['Noite', 'à noite']},
];
const VISIT_WINDOW = 4;
const capital = text => text.charAt(0).toUpperCase() + text.slice(1);
export const placeOf = home => home.street.toLowerCase().includes(home.area.toLowerCase()) ? home.street : `${home.street}, ${home.area}`;
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

export function replyLine(advertiser, say) {
  return advertiser.domi ? say('Responde em minutos pelo WhatsApp', 'Responde en minutos por WhatsApp') : say(`Costuma responder em ${advertiser.replyHours} h`, `Suele responder en ${advertiser.replyHours} h`);
}

/**
 * What Mora says to each turn and the widget that follows it. Availability is the one question she answers herself;
 * a visit becomes an intention; anything else waits for the person to confirm before it reaches the agency.
 * A turn that brings its own `reply` was answered by the page that asked (the tour's inventory and camera).
 */
function moraReply(turn, say, advertiser, agency = AGENCY) {
  const [br, es] = agency;
  if (turn.reply) return {widget:turn.action ? 'scene' : null, text:turn.reply};
  if (turn.kind === 'visit' || (turn.kind === 'ask' && /visit/i.test(turn.text))) return {widget:'picker', text:say(`Quando você quer visitar? Escolha um dia e um período; a ${br} propõe o horário.`, `¿Cuándo te gustaría visitarlo? Elige un día y un periodo; la ${es} propone el horario.`)};
  if (turn.kind === 'intention') return {widget:'slot', text:say('Perfeito. Confira sua intenção de visita:', 'Perfecto. Revisa tu intención de visita:')};
  if (turn.kind === 'confirm') return {widget:null, text:say(`Enviei sua intenção para ${advertiser.name}. Eles vão propor um horário com você.`, `Envié tu intención a ${advertiser.name}. Te propondrán un horario.`)};
  if (turn.kind === 'agency-sent') return {widget:null, text:agencySentLine(advertiser, say)};
  if (turn.kind === 'agency-later') return {widget:null, text:say(
    `Tudo bem. Se mudar de ideia, posso enviar essa dúvida para a ${br}. Posso te ajudar com outra coisa?`,
    `Está bien. Si cambias de idea, puedo enviarle esta pregunta a la ${es}. ¿Te ayudo con algo más?`)};
  return /disponib|disponív/i.test(turn.text)
    ? {widget:'action', text:say(
      `Sim, continua disponível. As informações do anúncio foram atualizadas recentemente, a ${br} segue anunciando o imóvel e ele recebeu visitas nos últimos 7 dias.`,
      `Sí, sigue disponible. La información del anuncio se actualizó hace poco, la ${es} lo sigue anunciando e incluso recibió visitas en los últimos 7 días.`)}
    : {widget:'card', text:say(
      `Revisei o anúncio, as fotos e a descrição, e não encontrei essa resposta. Quer que eu envie sua dúvida para a ${br}?`,
      `Revisé el anuncio, las fotos y la descripción, y no encontré esa respuesta. ¿Quieres que le envíe tu pregunta a la ${es}?`)};
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
function AgencyQuestionCard({home, question, advertiser, agency, agencyState, reduce, say, onSend, onDismiss}) {
  const sent = agencyState === 'sent', dismissed = agencyState === 'dismissed', open = !sent && !dismissed;
  const acted = useRef(false);
  const once = run => event => { if (!open || acted.current) return; acted.current = true; run(event.currentTarget); };
  const title = sent ? say(`Enviada para ${advertiser.name}`, `Enviada a ${advertiser.name}`)
    : dismissed ? say('Não enviada', 'No enviada')
    : say(`Para ${advertiser.name}`, `Para ${advertiser.name}`);
  const meta = sent ? say(`A resposta chega pela ${agency[0]}.`, `La respuesta llega por la ${agency[1]}.`)
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
export function ChatTurn({turn, home, advertiser, agency = AGENCY, active, reduce, copy, onAsk, onAgencyAction}) {
  const {say, language} = copy;
  const {text:reply, widget} = moraReply(turn, say, advertiser, agency);
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
  const think = turn.think || (turn.kind === 'visit' || turn.kind === 'intention' || turn.kind === 'confirm'
    ? say('Revisando a agenda…', 'Revisando la agenda…')
    : turn.kind === 'agency-sent' ? say(`Enviando para a ${agency[0]}…`, `Enviando a la ${agency[1]}…`)
    : turn.kind === 'agency-later' ? say('Pensando…', 'Pensando…')
    : say('Revisando o anúncio…', 'Revisando el anuncio…'));
  return <motion.li className="lp-turn" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:reduce ? 0.15 : 0.2, ease:EASE_FADE}}>
    <Bubble turn={turn} reduce={reduce}/>
    <div className="lp-turn-mora">
      {stage === 0 ? <MoraThinking text={think}/> : <MoraWords text={reply} animate={ink}/>}
      {card && stage >= 2 && <AgencyQuestionCard home={home} question={turn.text} advertiser={advertiser} agency={agency} agencyState={agencyState} reduce={reduce} say={say}
        onSend={source => { onAgencyAction(turn.id, 'sent'); onAsk(say('Enviar pergunta', 'Enviar pregunta'), source, 'agency-sent'); }}
        onDismiss={source => { onAgencyAction(turn.id, 'dismissed'); onAsk(say('Agora não', 'Ahora no'), source, 'agency-later'); }}/>}
      {widget && !card && stage >= 2 && <Grow reduce={reduce}>
        {widget === 'action' && <AnimatePresence initial={false}>{active && <Collapse key="action" reduce={reduce}>
          <button type="button" className="lp-chat-action" onClick={event => onAsk(say('Quero visitar o imóvel', 'Quiero visitar el inmueble'), event.currentTarget, 'visit')}><Calendar/>{say('Quero visitar o imóvel', 'Quiero visitar el inmueble')}</button>
        </Collapse>}</AnimatePresence>}
        {widget === 'scene' && <AnimatePresence initial={false}>{active && <Collapse key="scene" reduce={reduce}>
          <button type="button" className="lp-chat-action" onClick={() => turn.action.run()}>{turn.action.icon}{turn.action.label}</button>
        </Collapse>}</AnimatePresence>}
        {widget === 'picker' && <VisitPicker active={active} reduce={reduce} copy={copy} agency={agency} onPick={(slot, source) => onAsk(intentionLong(slot, language, say), source, 'intention', slot)}/>}
        {widget === 'slot' && <IntentionCard home={home} slot={turn.slot} sent={turn.agencyState === 'sent'} active={active} reduce={reduce} copy={copy} agency={agency}
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
export function VisitPicker({active, reduce, copy, agency = AGENCY, onPick}) {
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
        <p className="lp-pick-note">{say(`O horário fica com a ${agency[0]}.`, `El horario lo define la ${agency[1]}.`)}</p>
        <button type="button" className="lp-proof-primary lp-pick-submit" aria-disabled={!period || undefined}
          onClick={event => { if (!period || !active || picked.current) return; picked.current = true; onPick({...days[day], period}, event.currentTarget); }}>{say('Pedir visita', 'Pedir visita')}</button>
      </div>
    </Collapse> : <Collapse key="folded" reduce={reduce}>
      <span className="lp-chat-action is-done"><Calendar/>{say('Intenção de visita', 'Intención de visita')}</span>
    </Collapse>}
  </AnimatePresence>;
}

/** The intention card is also its own receipt: sending turns it into "sent" in place instead of adding a second card. */
function IntentionCard({home, slot, sent, active, reduce, copy, agency, onConfirm, onChange}) {
  const {say, language} = copy;
  const acted = useRef(false);
  const once = run => event => { if (!active || sent || acted.current) return; acted.current = true; run(event.currentTarget); };
  return <div className="lp-proof-card">
    <div className="lp-proof-head">
      <img src={propertyPhoto(home)} alt=""/>
      <div>
        <ProofStatus sent={sent} reduce={reduce} label={sent ? say('Intenção enviada', 'Intención enviada') : say('Intenção de visita', 'Intención de visita')}/>
        <p className="lp-proof-title">{intentionTitle(slot, language, say)}</p>
        <p className="lp-proof-meta">{sent ? say('Vão propor um horário com você.', 'Te propondrán un horario.') : say(`A ${agency[0]} propõe o horário.`, `La ${agency[1]} propone el horario.`)}</p>
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

/**
 * The open sentence from the search, at the foot of the chat: no box, large type, an orange caret and a placeholder
 * that keeps suggesting what to ask. The suggestions sit on one horizontal row above it until the first question.
 */
export function MoraComposer({id, field, draft, onDraft, onAsk, hints, quick, showQuick, onBack, backLabel, reduce, say, label}) {
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
        <label className="sr-only" htmlFor={id}>{label || say('Pergunte à Mora sobre este imóvel', 'Pregúntale a Mora sobre este inmueble')}</label>
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

/**
 * The turns and the thread's follow. While the person is at the end of the chat, the end glides after every reply as it
 * types out and every card as it opens. Only the person scrolling up lets go (our own scrolling never does); reaching the
 * end again, or asking, holds on again. `push` returns false for an empty question.
 */
export function useMoraThread({on, threadRef, scroller, reduce}) {
  const [turns, setTurns] = useState([]);
  const pinned = useRef(false), turnId = useRef(0);
  useEffect(() => {
    const thread = threadRef.current, box = scroller();
    if (!on || !thread || !box) return undefined;
    pinned.current = false;
    let frame = 0, last = 0, touchY = null;
    const ahead = () => box.scrollHeight - box.clientHeight - box.scrollTop;
    const step = now => {
      frame = 0;
      const gap = ahead();
      if (!pinned.current || gap < 1) return;
      const dt = last ? Math.min(now - last, 48) : 16;
      last = now;
      box.scrollTop += reduce ? gap : Math.max(1, gap * (1 - Math.exp(-dt / GLIDE_TAU)));
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
    box.addEventListener('wheel', onWheel, {passive:true});
    box.addEventListener('touchstart', onTouchStart, {passive:true});
    box.addEventListener('touchmove', onTouchMove, {passive:true});
    box.addEventListener('keydown', onKey);
    box.addEventListener('scroll', onScroll, {passive:true});
    return () => {
      cancelAnimationFrame(frame); follow.disconnect();
      box.removeEventListener('wheel', onWheel);
      box.removeEventListener('touchstart', onTouchStart);
      box.removeEventListener('touchmove', onTouchMove);
      box.removeEventListener('keydown', onKey);
      box.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, reduce]);
  /** Every turn starts as a bubble flying from `source`: the field, a suggestion or a chat widget's button. */
  function push(value, source, kind = 'ask', slot = null, extra = null) {
    const asked = value.trim();
    if (!asked) return false;
    let from = null;
    if (source) {
      const box = source.getBoundingClientRect(), css = getComputedStyle(source);
      from = {x:box.left + parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft) - BUBBLE_PAD.x, y:box.top + parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop) - BUBBLE_PAD.y};
    }
    turnId.current += 1;
    pinned.current = true;
    setTurns(current => [...current, {id:turnId.current, text:asked, at:Date.now(), from, kind, slot, agencyState:kind === 'ask' ? 'pending' : undefined, ...extra}]);
    return true;
  }
  function agencyAction(id, agencyState) {
    setTurns(current => current.map(turn => turn.id === id ? {...turn, agencyState} : turn));
  }
  return {turns, push, agencyAction};
}
