import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {Icon} from './App';
import {areaLabel, listingPrice} from './data';
import {useLanguage, roomCount, bathCount} from './i18n';
import agencies from '../AGENCY-SOURCES.json';
import {answerListingQuestion, listingDetails, listingSummary} from './listingPresentation';
import {contactMessage, contactRecipient, contactValidation, createContactReceipt, normalizeContactProfile} from './contactFlow';
import {measureBar, animateBar} from './searchFlowMotion';

const asset = name => `/assets/mini-listing/${name}.svg`;

export function MoraName() {
  return <div className="mini-mora-name"><img src={asset('mora')} alt=""/>Mora</div>;
}

export function ListingAttributes({home}) {
  const {language, t} = useLanguage();
  const pt = language === 'pt-BR', extra = listingDetails(home);
  const say = (br, es) => pt ? br : es;
  const items = [
    ['area', t(areaLabel(home))], ['bed', roomCount(home.beds, language)], ['bath', bathCount(home.baths, language)],
    ['car', extra.parking === null ? say('Vagas a confirmar', 'Estacionamiento a confirmar') : `${extra.parking} ${say(extra.parking === 1 ? 'vaga' : 'vagas', extra.parking === 1 ? 'estacionamiento' : 'estacionamientos')}`],
    ['pets', extra.pets === null ? say('Pets a confirmar', 'Mascotas a confirmar') : extra.pets ? say('Aceita pets', 'Acepta mascotas') : say('Não aceita pets', 'No acepta mascotas')],
    ['floor', extra.floor === null ? say('Andar a confirmar', 'Piso a confirmar') : say(`${extra.floor}º andar`, `Piso ${extra.floor}`)],
  ];
  return <ul className="mini-attributes">{items.map(([name, label]) => <li key={name}><img src={asset(name)} alt=""/><span>{label}</span></li>)}</ul>;
}

export function ListingBroker({home}) {
  const {language} = useLanguage();
  const recipient = contactRecipient(home, agencies.logos, language);
  return <div className="mini-broker">
    {recipient.logo ? <img className="mini-broker-logo" src={recipient.logo} alt=""/> : <span className="mini-broker-placeholder" aria-hidden="true"><Icon name="home" size={24}/></span>}
    <div><strong>{recipient.verified ? recipient.name : language === 'pt-BR' ? 'Anunciante do imóvel' : 'Anunciante del inmueble'}</strong><p>{home.street}, {home.area}</p></div>
  </div>;
}

export function ListingOverview({home, onDetails}) {
  const {language, t, money, currency} = useLanguage();
  const pt = language === 'pt-BR', photos = listingDetails(home).gallery;
  return <div className="mini-property-presentation">
    <div className="mini-overview">
      <button className={`mini-gallery ${photos.length === 1 ? 'has-one-photo' : ''}`} onClick={onDetails} aria-label={pt ? `Ver detalhes de ${home.street}` : `Ver detalles de ${home.street}`}>
        {photos.length === 1 ? <span className="mini-gallery-photo single-photo"><img src={photos[0]} alt={home.imageAlt}/><span className="mini-photo-tag">{pt ? 'Foto do imóvel' : 'Foto del inmueble'}</span></span> : [photos[0], photos[1], photos[2] || photos[1]].map((src, i) => <span className="mini-gallery-photo" key={i}><img src={src} alt={i ? '' : home.imageAlt}/><span className="mini-photo-tag">{pt ? 'Foto' : 'Foto'} {Math.min(i + 1, photos.length)}</span></span>)}
        <span className="mini-gallery-more">{pt ? 'Ver imóvel' : 'Ver inmueble'}</span>
      </button>
      <div className="mini-facts">
        <div className="mini-property-info"><p className="mini-operation">{t(home.mode === 'rent' ? 'Rentar' : 'Comprar')}<span>·</span>{t('Departamento')}</p><h2 tabIndex={-1}>{home.street}, {home.area}</h2><p className="mini-price">{money(listingPrice(home))} {currency}</p></div>
        <ListingAttributes home={home}/>
      </div>
    </div>
    <ListingBroker home={home}/>
  </div>;
}

/** The whole journey stays in the search surface; there are no dialog portals. */
export function MiniListing({home, search, pref, profile, onProfile, onReceipt, onClose, onDetails, initialAction}) {
  const {language} = useLanguage(), pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const [phase, setPhase] = useState(initialAction ? 'contact' : 'summary');
  const [question, setQuestion] = useState(initialAction?.question || ''), [answer, setAnswer] = useState('');
  const [data, setData] = useState(() => normalizeContactProfile(profile));
  const [channel, setChannel] = useState(!contactValidation({profile,channel:'email',message:'Contato de teste'}).email ? 'email' : profile.phone ? 'whatsapp' : 'email');
  const [editing, setEditing] = useState(!profile.name || !profile.email && !profile.phone);
  const [errors, setErrors] = useState({}), [sending, setSending] = useState(false), [sendError, setSendError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const prefix = useId(), root = useRef(null), timer = useRef(null), pending = useRef(false);
  const phaseSize = useRef(null), phaseAnimation = useRef(() => {});
  const recipient = contactRecipient(home, agencies.logos, language);
  const summary = listingSummary(home, search, pref, language);
  const message = contactMessage({home, search:{...search, pref}, type:initialAction?.type || 'message', question, language});
  useEffect(() => () => {clearTimeout(timer.current); phaseAnimation.current();}, []);
  function changePhase(next) {
    phaseSize.current = measureBar(root.current?.closest('.mora-bar'));
    phaseAnimation.current();
    setPhase(next);
  }
  useLayoutEffect(() => {
    // A heading receives focus without opening a mobile keyboard or trapping navigation.
    root.current?.querySelector(phase === 'summary' ? '.mini-property-info h2' : '.mini-state-title')?.focus({preventScroll:true});
    // Scroll only this surface. The underlying results keep their browsing position.
    const scroller = root.current?.querySelector('.mini-listing-scroll');
    if (scroller) scroller.scrollTop = 0;
    phaseAnimation.current = animateBar(root.current?.closest('.mora-bar'), phaseSize.current, true, undefined, false);
    phaseSize.current = null;
  }, [phase]);
  function enterContact() { setErrors({}); changePhase('contact'); }
  function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const nextErrors = contactValidation({profile:data, channel, message});
    setErrors(nextErrors); setSendError('');
    if (Object.keys(nextErrors).length) {
      setEditing(true);
      requestAnimationFrame(() => root.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    pending.current = true; setSending(true);
    timer.current = setTimeout(() => {
      try {
        const next = createContactReceipt({home, broker:recipient, intent:initialAction?.type || 'message', channel, message, profile:data});
        onProfile(normalizeContactProfile(data)); onReceipt(next); setReceipt(next); changePhase('sent');
      } catch {
        setSendError(say('Não foi possível registrar o contato. Tente novamente.', 'No se pudo registrar el contacto. Inténtalo de nuevo.'));
      } finally { pending.current = false; setSending(false); }
    }, 420);
  }
  function ask(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setAnswer(answerListingQuestion(home, question, language));
  }
  const field = (name, label, type, placeholder, autoComplete) => <label className="mini-field" htmlFor={`${prefix}-${name}`}><span>{label}</span><input id={`${prefix}-${name}`} name={name} aria-label={label} type={type} inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : 'text'} autoComplete={autoComplete} value={data[name]} placeholder={placeholder} maxLength={name === 'name' ? 80 : 120} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined} onChange={event => {setData(current => ({...current, [name]:event.target.value}));setErrors(current => ({...current, [name]:undefined}));}}/>{errors[name] && <span className="mini-field-error" id={`${prefix}-${name}-error`}>{name === 'name' ? say('Digite seu nome, com pelo menos 2 letras.', 'Escribe tu nombre, con al menos 2 letras.') : name === 'email' ? say('Digite um e-mail válido, como nome@exemplo.com.', 'Escribe un correo válido, como nombre@ejemplo.com.') : say('Inclua + e o código do país, como +52 55 1234 5678.', 'Incluye + y el código del país, como +52 55 1234 5678.')}</span>}</label>;
  return <div ref={root} className={`mora-expanded mini-listing mini-phase-${phase}`}>
    <button className="mora-close mini-close" onClick={onClose} aria-label={say('Fechar resumo do imóvel', 'Cerrar resumen del inmueble')}><img src={asset('close')} alt=""/></button>
    <div className="mini-listing-scroll">
    <ListingOverview home={home} onDetails={onDetails}/>
    <section className="mini-assistant" aria-label={say('Assistência da Mora', 'Asistencia de Mora')}>
      <MoraName/>
      {phase === 'summary' && <div className="mini-assistant-content"><div className="mini-highlights"><div><h3>{summary.hasMatch ? say('Combina com sua busca', 'Combina con tu búsqueda') : say('Sobre este imóvel', 'Sobre este inmueble')}</h3><ul>{summary.matches.map(text => <li key={text}>{text}</li>)}</ul></div><div><h3>{say('Vale considerar', 'Vale la pena considerar')}</h3><ul>{summary.considerations.map(text => <li key={text}>{text}</li>)}</ul></div></div><div className="mini-actions"><button className="mini-primary" onClick={enterContact}>{say('Falar com imobiliária', 'Hablar con inmobiliaria')}</button><button className="mini-secondary" onClick={() => changePhase('question')}>{say('Tirar uma dúvida', 'Resolver una duda')}</button></div></div>}
      {phase === 'question' && <div className="mini-assistant-content"><div className="mini-question"><h3 className="mini-state-title" tabIndex={-1}>{say('O que você quer saber?', '¿Qué te gustaría saber?')}</h3><form onSubmit={ask}><label className="sr-only" htmlFor={`${prefix}-question`}>{say('Pergunta sobre o imóvel', 'Pregunta sobre el inmueble')}</label><textarea id={`${prefix}-question`} value={question} onChange={event => {setQuestion(event.target.value);setAnswer('');}} placeholder={say('O espaço para trabalhar tem janela?', '¿El espacio para trabajar tiene ventana?')} maxLength={500} rows={3}/><button className="mini-question-send" disabled={!question.trim()} aria-label={say('Consultar imóvel', 'Consultar inmueble')}><Icon name="arrow"/></button></form>{answer ? <p className="mini-answer" role="status">{answer}</p> : <button className="mini-text-action" onClick={() => {const text = say('Quais são as medidas?', '¿Cuáles son las medidas?');setQuestion(text);setAnswer(answerListingQuestion(home, text, language));}}>{say('Quais são as medidas?', '¿Cuáles son las medidas?')}</button>}</div><div className="mini-actions"><button className="mini-primary" onClick={enterContact}>{say('Falar com imobiliária', 'Hablar con inmobiliaria')}</button><button className="mini-secondary" onClick={() => changePhase('summary')}>{say('Voltar ao resumo', 'Volver al resumen')}</button></div></div>}
      {phase === 'contact' && <form className="mini-contact-form mini-assistant-content" noValidate onSubmit={submit} aria-busy={sending}><div><h3 className="mini-state-title" tabIndex={-1}>{editing ? say('Como podem falar com você?', '¿Cómo pueden contactarte?') : say(`Vamos usar seus dados, ${data.name.split(' ')[0]}.`, `Usaremos tus datos, ${data.name.split(' ')[0]}.`)}</h3>{editing ? <><div className="mini-contact-channels" role="group" aria-label={say('Canal de contato', 'Canal de contacto')}><button type="button" aria-pressed={channel === 'email'} onClick={() => {setChannel('email');setErrors({});}}>E-mail</button><button type="button" aria-pressed={channel === 'whatsapp'} onClick={() => {setChannel('whatsapp');setErrors({});}}>WhatsApp</button></div><div className="mini-fields">{field('name', say('Seu nome', 'Tu nombre'), 'text', say('Nome e sobrenome', 'Nombre y apellido'), 'name')}{channel === 'email' ? field('email', 'E-mail', 'email', say('nome@exemplo.com', 'nombre@ejemplo.com'), 'email') : field('phone', 'WhatsApp', 'tel', '+52 55 1234 5678', 'tel')}</div></> : <div className="mini-reuse"><strong>{data.name}</strong><span>{channel === 'email' ? data.email : data.phone}</span><button className="mini-text-action" type="button" onClick={() => setEditing(true)}>{say('Alterar meus dados', 'Cambiar mis datos')}</button></div>}<p className="mini-contact-context">{question ? say('Sua pergunta vai junto com o contato.', 'Tu pregunta se incluye en el contacto.') : say('A imobiliária recebe seu interesse neste imóvel.', 'La inmobiliaria recibe tu interés en este inmueble.')}</p>{sendError && <p role="alert" className="mini-field-error">{sendError}</p>}</div><div><div className="mini-actions"><button className="mini-primary" disabled={sending}>{sending ? say('Registrando…', 'Registrando…') : say('Enviar contato', 'Enviar contacto')}</button><button className="mini-secondary" type="button" disabled={sending} onClick={() => changePhase('summary')}>{say('Voltar ao resumo', 'Volver al resumen')}</button></div><p className="mini-simulation-note">{say('Contato simulado. Seus dados ficam neste navegador.', 'Contacto simulado. Tus datos permanecen en este navegador.')}</p></div></form>}
      {phase === 'sent' && <div className="mini-assistant-content"><div className="mini-confirmation" role="status"><span className="mini-confirmation-icon"><Icon name="check" size={24}/></span><h3 className="mini-state-title" tabIndex={-1}>{say('Tudo pronto para o próximo contato.', 'Todo listo para el siguiente contacto.')}</h3><p>{say('Contato simulado registrado para este imóvel. Você pode continuar explorando sem preencher seus dados outra vez.', 'Contacto simulado registrado para este inmueble. Puedes seguir explorando sin volver a escribir tus datos.')}</p><div className="mini-receipt"><strong>{receipt?.profile.name}</strong><span>{receipt?.profile.email || receipt?.profile.phone}</span></div></div><div className="mini-actions"><button className="mini-primary" onClick={onClose}>{say('Continuar explorando', 'Seguir explorando')}</button><button className="mini-secondary" onClick={onDetails}>{say('Ver imóvel', 'Ver inmueble')}</button></div></div>}
    </section>
    </div>
  </div>;
}
