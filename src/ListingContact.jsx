import React, {useEffect, useId, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {contactMessage, contactValidation, createContactReceipt, normalizeContactProfile} from './contactFlow.js';
import {ContactStage, ContactWho, Toggle} from './ListingPanel';
import {markVisit} from './seekerSignals.js';
import {IconButton} from './IconButton.jsx';

const MORPH = {type:'spring', duration:0.45, bounce:0.1};
const EASE = [0.2, 0.8, 0.2, 1];
export const QUESTION_MAX = 200;

const QUESTIONS = [
  ['Ainda está disponível?', '¿Sigue disponible?'],
  ['Aceita animais?', '¿Acepta mascotas?'],
  ['Quando posso visitar?', '¿Cuándo puedo visitarlo?'],
  ['O preço é negociável?', '¿El precio es negociable?'],
];
const MESSAGE_TOGGLES = [
  [['Ainda está disponível?', 'Ainda está disponível?'], ['¿Sigue disponible?', '¿Sigue disponible?']],
  [['É negociável?', 'O preço é negociável?'], ['¿Es negociable?', '¿El precio es negociable?']],
];
const VISIT_TOGGLES = [
  [['Esta semana', 'Posso visitar esta semana?'], ['Esta semana', '¿Puedo visitarlo esta semana?']],
  [['No fim de semana', 'Pode ser no fim de semana?'], ['El fin de semana', '¿Puede ser el fin de semana?']],
  [['O quanto antes', 'Gostaria de visitar o quanto antes.'], ['Lo antes posible', 'Me gustaría visitarlo lo antes posible.']],
];

function validPhone(profile) {
  const errors = contactValidation({profile, channel:'whatsapp', message:'x'.repeat(10)});
  return !errors.name && !errors.phone;
}

/** Form and confirmation share the mini-listing's contact stage and fields, so the photo, agency and trust facts grow in place when it sends. */
function Contact({home, advertiser, search, language, intent, question, profile, sent, onIntent, onSent, onClose, onReviews, reduce, say}) {
  const id = useId();
  const root = useRef(null);
  const [data, setData] = useState(() => normalizeContactProfile(profile));
  const [editing, setEditing] = useState(() => !validPhone(profile));
  const [message, setMessage] = useState(() => contactMessage({home, search, type:intent, question, language}));
  const [edited, setEdited] = useState(false);
  const [errors, setErrors] = useState({});
  useEffect(() => { root.current?.querySelector('.lp-stage-title')?.focus({preventScroll:true}); }, []);
  useEffect(() => {
    if (!edited) setMessage(contactMessage({home, search, type:intent, question, language}));
  }, [intent, language, edited, home, search, question]);

  const fieldError = name => name === 'name'
    ? say('Digite seu nome, com pelo menos 2 letras.', 'Escribe tu nombre, con al menos 2 letras.')
    : say('Inclua + e o código do país, como +52 55 1234 5678.', 'Incluye + y el código del país, como +52 55 1234 5678.');
  const toggles = (intent === 'visit' ? VISIT_TOGGLES : MESSAGE_TOGGLES).map(([br, es]) => ({label:say(br[0], es[0]), line:say(br[1], es[1])}));
  function toggle(line) {
    setErrors(current => ({...current, message:undefined}));
    setMessage(current => current.includes(line) ? current.replace(`\n${line}`, '').replace(line, '').trim() : `${current.trim()}\n${line}`);
  }
  function edit() {
    setEditing(true);
    setTimeout(() => root.current?.querySelector('.lp-fieldset input')?.focus({preventScroll:true}), 220);
  }
  function submit(event) {
    event.preventDefault();
    const body = message.trim().slice(0, 1400);
    const next = contactValidation({profile:data, channel:'whatsapp', message:body});
    setErrors(next);
    if (Object.keys(next).length) {
      if (next.name || next.phone) setEditing(true);
      requestAnimationFrame(() => root.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    onSent(createContactReceipt({home, broker:advertiser.name, intent, channel:'whatsapp', message:body, profile:data}), data);
  }
  const field = (name, label, type, autoComplete) => <label className={`lp-float${errors[name] ? ' is-invalid' : ''}`} htmlFor={`${id}-${name}`}>
    <input id={`${id}-${name}`} name={name} type={type} inputMode={type === 'tel' ? 'tel' : 'text'} autoComplete={autoComplete} value={data[name]} placeholder=" " maxLength={name === 'name' ? 80 : 120}
      aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
      onChange={event => { const value = event.target.value; setData(current => ({...current, [name]:value})); setErrors(current => ({...current, [name]:undefined})); }}/>
    <span>{label}</span>
  </label>;
  const fade = {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.18, ease:EASE}};
  const fieldErrors = ['name', 'phone'].filter(name => errors[name]);

  return <div ref={root} className="pp-contact" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="pp-contact-top"><IconButton icon="close" className="compare-back pp-contact-close" onClick={onClose} label={say('Fechar contato', 'Cerrar contacto')}/></div>
    <ContactStage home={home} advertiser={advertiser} copy={{say, language}} reduce={reduce} sent={!!sent} visit={intent === 'visit'} reviews={false}>
      <form className="pp-contact-form" noValidate onSubmit={submit}>
        <div className="pp-contact-intents" role="group" aria-label={say('O que você quer fazer', 'Qué quieres hacer')}>
          {['message', 'visit'].map(value => <button key={value} type="button" aria-pressed={intent === value} onClick={() => onIntent(value)}>
            {intent === value && <motion.span layoutId={`${id}-intent`} className="pp-contact-intent-pill" transition={reduce ? {duration:0} : {type:'spring', duration:0.35, bounce:0.15}}/>}
            <span>{value === 'visit' ? say('Visita', 'Visita') : say('Mensagem', 'Mensaje')}</span>
          </button>)}
        </div>
        <div className="lp-entry">
          <div className={`lp-message${errors.message ? ' is-invalid' : ''}`}>
            <label className="lp-message-label" htmlFor={`${id}-message`}>{say('Sua mensagem', 'Tu mensaje')}</label>
            <textarea id={`${id}-message`} className="lp-message-text" value={message} rows={3} maxLength={1400}
              aria-invalid={!!errors.message} aria-describedby={errors.message ? `${id}-message-error` : undefined}
              onChange={event => { setMessage(event.target.value); setEdited(true); setErrors(current => ({...current, message:undefined})); }}/>
            <div className="lp-toggles" role="group" aria-label={say('Adicionar à mensagem', 'Agregar al mensaje')}>
              {toggles.map(item => <Toggle key={item.label} pressed={message.includes(item.line)} label={item.label} reduce={reduce} onClick={() => toggle(item.line)}/>)}
            </div>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {editing
              ? <motion.div key="fields" {...fade}>
                <div className="lp-fieldset">
                  {field('name', say('Seu nome', 'Tu nombre'), 'text', 'name')}
                  {field('phone', 'WhatsApp', 'tel', 'tel')}
                </div>
              </motion.div>
              : <ContactWho key="reuse" name={data.name} phone={data.phone} onEdit={edit} say={say} fade={fade}/>}
          </AnimatePresence>
        </div>
        {(errors.message || fieldErrors.length > 0) && <div>
          {errors.message && <span className="lp-field-error" id={`${id}-message-error`}>{say('Escreva uma mensagem de pelo menos 10 caracteres.', 'Escribe un mensaje de al menos 10 caracteres.')}</span>}
          {fieldErrors.map(name => <span key={name} className="lp-field-error" id={`${id}-${name}-error`}>{fieldError(name)}</span>)}
        </div>}
        <div className="pp-contact-foot">
          <button type="submit" className="mini-primary">{intent === 'visit' ? say('Solicitar visita', 'Solicitar visita') : say('Enviar mensagem', 'Enviar mensaje')}</button>
          <p className="lp-compose-share">{say('Ao enviar, você concorda em compartilhar seus dados com 1 imobiliária.', 'Al enviar, aceptas compartir tus datos con 1 inmobiliaria.')}</p>
        </div>
      </form>
    </ContactStage>
    <AnimatePresence initial={false}>{sent && <motion.button key="done" type="button" className="mini-secondary pp-contact-done" onClick={onReviews}
      initial={reduce ? {opacity:0} : {opacity:0, y:8}} animate={{opacity:1, y:0}} transition={reduce ? {duration:0.15} : {duration:0.3, ease:EASE, delay:0.4}}>
      {say('Ver avaliações', 'Ver reseñas')}
    </motion.button>}</AnimatePresence>
  </div>;
}

/** The price card on the full listing. Contact grows inside it instead of opening the mini-listing panel. */
export function ListingContactCard({home, advertiser, search, language, contact, onContact, onClose, onReviews, profile, onProfile, onReceipt, receipt, stuck, price, fee, say}) {
  const reduce = useReducedMotion();
  const [sent, setSent] = useState(null);
  const card = useRef(null);
  const lastIntent = useRef('message');
  if (contact) lastIntent.current = contact.intent;
  const mode = contact || sent ? 'contact' : 'summary';
  const wasOpen = useRef(false);
  useEffect(() => {
    if (mode === 'summary' && wasOpen.current) card.current?.querySelector(`.pp-card-actions button:nth-child(${lastIntent.current === 'visit' ? 2 : 1})`)?.focus({preventScroll:true});
    wasOpen.current = mode !== 'summary';
  }, [mode]);
  const close = () => { setSent(null); onClose(); };
  const fade = reduce ? {duration:0} : {duration:0.2, ease:EASE, delay:0.08};
  return <motion.div ref={card} className={`pp-card${stuck ? ' is-stuck' : ''}${mode !== 'summary' ? ' is-open' : ''}`} layout layoutDependency={mode} transition={{layout:reduce ? {duration:0} : MORPH}} style={{borderRadius:12}}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={mode} layout="position" layoutDependency={mode} initial={{opacity:0}} animate={{opacity:1, transition:fade}} exit={{opacity:0, transition:{duration:reduce ? 0 : 0.1}}}>
        {mode === 'summary' ? <>
          {price}
          {fee}
          <div className="pp-card-actions">
            <button className="mini-primary" onClick={() => onContact('message')}>{say('Falar com imobiliária', 'Hablar con inmobiliaria')}</button>
            <button className="mini-secondary" onClick={() => onContact('visit')}>{say('Solicitar visita', 'Solicitar visita')}</button>
          </div>
          {receipt && <p className="pp-card-receipt"><Icon name="check" size={16}/>{say('Contato simulado registrado', 'Contacto simulado registrado')}</p>}
        </> : <Contact home={home} advertiser={advertiser} search={search} language={language} intent={contact?.intent || lastIntent.current} question={contact?.question || ''}
          profile={profile} sent={sent} reduce={reduce} say={say} onClose={close} onReviews={onReviews}
          onIntent={intent => onContact(intent, contact?.question || '')}
          onSent={(next, data) => { if (next.intent === 'visit') markVisit(next.propertyId); onReceipt(next); onProfile(normalizeContactProfile(data)); setSent(next); }}/>}
      </motion.div>
    </AnimatePresence>
  </motion.div>;
}

/** Suggested questions under the price card: chips fill the box, sending hands the text to the card's contact form. */
export function ListingQuestions({onSend, say}) {
  const id = useId();
  const [text, setText] = useState('');
  const toggle = question => setText(current => {
    if (current.includes(question)) return current.replace(question, '').replace(/\s{2,}/g, ' ').trim();
    return `${current.trim()} ${question}`.trim().slice(0, QUESTION_MAX);
  });
  return <form className="pp-ask" onSubmit={event => { event.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }}>
    <h2 id="pp-ask-title">{say('Perguntas para a imobiliária', 'Preguntas para la inmobiliaria')}</h2>
    <p>{say('Escolha uma ou mais perguntas, ou escreva a sua.', 'Selecciona una o más preguntas, o escribe tu consulta.')}</p>
    <div className="pp-chips" role="group" aria-labelledby="pp-ask-title">
      {QUESTIONS.map(item => { const question = say(...item); return <button key={item[1]} type="button" className="pp-chip" aria-pressed={text.includes(question)} onClick={() => toggle(question)}>{question}</button>; })}
    </div>
    <label className="sr-only" htmlFor={`${id}-text`}>{say('Sua pergunta', 'Tu pregunta')}</label>
    <textarea id={`${id}-text`} className="pp-ask-input" rows={2} maxLength={QUESTION_MAX} value={text} placeholder={say('Escreva aqui', 'Escríbela aquí')} onChange={event => setText(event.target.value)}/>
    <div className="pp-ask-foot">
      <small aria-live="polite">{text.length}/{QUESTION_MAX}</small>
      <button type="submit" className="pp-ask-send" disabled={!text.trim()}>{say('Enviar pergunta', 'Enviar pregunta')}<img src="/assets/reviews/arrow-forward.svg" alt="" width="16" height="16"/></button>
    </div>
  </form>;
}
