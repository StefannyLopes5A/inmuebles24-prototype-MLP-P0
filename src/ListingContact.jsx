import React, {useEffect, useId, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {contactMessage, contactValidation, createContactReceipt, maskPhone, normalizeContactProfile, phoneCodeLength, phonePrefix} from './contactFlow.js';
import {ContactStage, ContactWho, Toggle} from './ContactStage';
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
  const set = (name, value) => { setData(current => ({...current, [name]:value})); setErrors(current => ({...current, [name]:undefined})); };
  const field = (name, label, type, autoComplete) => <label className={`lp-float${errors[name] ? ' is-invalid' : ''}`} htmlFor={`${id}-${name}`}>
    <input id={`${id}-${name}`} name={name} type={type} inputMode={type === 'tel' ? 'tel' : 'text'} autoComplete={autoComplete} value={data[name]} placeholder=" " maxLength={name === 'name' ? 80 : 120}
      aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
      {...(name === 'phone' ? {
        // Focusing the empty field shows the country code; leaving it untouched, or deleting down to the code, empties it again.
        onFocus: () => { if (!data.phone) set('phone', phonePrefix(language)); },
        onBlur: () => { if (!maskPhone(data.phone, language)) set('phone', ''); },
        onChange: event => { const raw = event.target.value, next = maskPhone(raw, language); set('phone', !next || (raw.length < data.phone.length && next.replace(/\D/g, '').length <= phoneCodeLength(language)) ? '' : next); },
      } : {onChange: event => set(name, event.target.value)})}/>
    <span>{label}</span>
  </label>;
  const fade = {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.18, ease:EASE}};
  const fieldErrors = ['name', 'phone'].filter(name => errors[name]);

  return <div ref={root} className="pp-contact" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="pp-contact-top"><IconButton icon="close" className="compare-back pp-contact-close" onClick={onClose} label={say('Fechar contato', 'Cerrar contacto')}/></div>
    <ContactStage home={home} advertiser={advertiser} copy={{say, language}} reduce={reduce} sent={!!sent} visit reviews={false}>
      <form className="pp-contact-form" noValidate onSubmit={submit}>
        <div className="lp-entry">
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
          <div className={`lp-message${errors.message ? ' is-invalid' : ''}`}>
            <textarea id={`${id}-message`} className="lp-message-text" aria-label={say('Sua mensagem', 'Tu mensaje')} value={message} rows={3} maxLength={1400}
              aria-invalid={!!errors.message} aria-describedby={errors.message ? `${id}-message-error` : undefined}
              onChange={event => { setMessage(event.target.value); setEdited(true); setErrors(current => ({...current, message:undefined})); }}/>
            <div className="lp-toggles" role="group" aria-label={say('Adicionar à mensagem', 'Agregar al mensaje')}>
              {toggles.map(item => <Toggle key={item.label} pressed={message.includes(item.line)} label={item.label} reduce={reduce} onClick={() => toggle(item.line)}/>)}
            </div>
          </div>
        </div>
        {(errors.message || fieldErrors.length > 0) && <div>
          {errors.message && <span className="lp-field-error" id={`${id}-message-error`}>{say('Escreva uma mensagem de pelo menos 10 caracteres.', 'Escribe un mensaje de al menos 10 caracteres.')}</span>}
          {fieldErrors.map(name => <span key={name} className="lp-field-error" id={`${id}-${name}-error`}>{fieldError(name)}</span>)}
        </div>}
        <div className="pp-contact-foot">
          <button type="submit" className="mini-primary">{say('Solicitar visita', 'Solicitar visita')}</button>
          <p className="lp-compose-share">{say('Ao enviar, você aceita os Termos e condições de uso e as Políticas de privacidade.', 'Al enviar, aceptas los Términos y condiciones de uso y las Políticas de privacidad.')}</p>
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
  return <motion.div ref={card} className={`pp-card${stuck ? ' is-stuck' : ''}${mode !== 'summary' ? ' is-open' : ''}`} layout layoutDependency={mode} transition={{layout:reduce ? {duration:0} : MORPH}} style={{borderRadius:24}}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div key={mode} layout="position" layoutDependency={mode} initial={{opacity:0}} animate={{opacity:1, transition:fade}} exit={{opacity:0, transition:{duration:reduce ? 0 : 0.1}}}>
        {mode === 'summary' ? <>
          {price}
          {fee}
          <div className="pp-card-actions">
            <button className="mini-primary" onClick={() => onContact('visit')}>{say('Solicitar visita', 'Solicitar visita')}</button>
            <button className="mini-secondary pp-card-whatsapp" onClick={() => onContact('message')}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10.0333 1.66797C5.48329 1.66797 1.79163 5.33464 1.79163 9.85964C1.79163 11.3096 2.17496 12.7263 2.90829 13.9763L1.66663 18.3346L6.15829 17.1596C7.35104 17.797 8.68097 18.1345 10.0333 18.143H10.0416C14.5916 18.143 18.2833 14.4763 18.2833 9.9513C18.2833 5.33464 14.5833 1.66797 10.0333 1.66797ZM10.0333 16.6263H10.025C8.7989 16.6251 7.59574 16.2941 6.54163 15.668L6.29163 15.518L3.62496 16.218L4.33329 13.6263L4.16663 13.3596C3.48949 12.2811 3.13125 11.0331 3.13329 9.75963C3.13329 6.00964 6.19996 2.95964 9.96663 2.95964C11.7916 2.95964 13.5083 3.66797 14.8 4.9513C15.4351 5.5804 15.939 6.3294 16.2823 7.15483C16.6257 7.98025 16.8016 8.86566 16.8 9.75963C16.8 13.5096 13.7333 16.5596 10.0333 16.5596V16.6263ZM13.7833 11.5346C13.575 11.4346 12.5666 10.9346 12.3833 10.868C12.1916 10.8013 12.0583 10.768 11.9166 10.968C11.7833 11.1763 11.3833 11.6346 11.2583 11.7763C11.1416 11.9096 11.0166 11.9346 10.8083 11.8263C10.6 11.7263 9.93329 11.5013 9.14163 10.8013C8.52496 10.2513 8.10829 9.5763 7.99163 9.36797C7.86663 9.15964 7.97496 9.0513 8.07496 8.9513C8.16663 8.85963 8.28329 8.70964 8.38329 8.58464C8.48329 8.46797 8.51663 8.3763 8.59163 8.24297C8.65829 8.1013 8.62496 7.98463 8.57496 7.8763C8.52496 7.7763 8.10829 6.75964 7.94163 6.34297C7.77496 5.94297 7.59996 5.99297 7.47496 5.99297H7.07496C6.94163 5.99297 6.70829 6.04297 6.51663 6.2513C6.32496 6.45964 5.78329 6.96797 5.78329 8.0013C5.78329 9.0263 6.53329 10.018 6.63329 10.1596C6.74163 10.3013 8.09996 12.4013 10.1916 13.3013C10.6916 13.518 11.075 13.643 11.375 13.7346C11.875 13.893 12.325 13.868 12.6833 13.818C13.0833 13.7596 13.9 13.318 14.075 12.8346C14.2416 12.3513 14.2416 11.943 14.1916 11.8513C14.1416 11.768 14 11.718 13.7916 11.618L13.7833 11.5346Z" fill="#222222"/></svg>
              {say('Falar com a imobiliária', 'Hablar con inmobiliaria')}
            </button>
          </div>
          <p className="pp-card-terms">{say('Ao enviar, você aceita os Termos e condições de uso e as Políticas de privacidade.', 'Al enviar, aceptas los Términos y condiciones de uso y las Políticas de privacidad.')}</p>
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
