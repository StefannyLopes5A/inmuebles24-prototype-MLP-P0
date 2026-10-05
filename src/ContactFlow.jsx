import React, {useEffect, useId, useRef, useState} from 'react';
import {Icon} from './App';
import {listingPrice, propertyPhoto} from './data';
import {useLanguage} from './i18n';
import agencies from '../AGENCY-SOURCES.json';
import {contactIntent, contactMessage, contactRecipient, contactValidation, createContactReceipt, normalizeContactProfile, lockContactScroll} from './contactFlow.js';

// A fresh component instance owns each property's draft; only reusable identity is shared.
export function ContactFlow(props) {
  return <ContactDialog key={props.home.id} {...props}/>;
}

function ContactDialog({home, search, type, question, profile, onProfile, onClose, onDone, onReceipt, existingReceipt}) {
  const {language, money, currency} = useLanguage();
  const pt = language === 'pt-BR';
  const copy = (es, br) => pt ? br : es;
  const recipient = contactRecipient(home, agencies.logos, language);
  const previousReceipt = existingReceipt?.propertyId === home.id ? existingReceipt : null;
  const [step, setStep] = useState(previousReceipt ? 'receipt' : 'compose');
  const [receipt, setReceipt] = useState(previousReceipt);
  const [intent, setIntent] = useState(contactIntent(type));
  const [channel, setChannel] = useState(profile?.email ? 'email' : profile?.phone ? 'whatsapp' : 'email');
  const [data, setData] = useState(() => normalizeContactProfile(profile));
  const [message, setMessage] = useState(() => contactMessage({home, search, type, question, language}));
  const [edited, setEdited] = useState(false);
  const [errors, setErrors] = useState({});
  const [sendError, setSendError] = useState(false);
  const sent = useRef(false);
  const dialog = useRef(null);
  const heading = useRef(null);
  const titleId = useId();
  const inputPrefix = useId();
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    const releaseScroll = lockContactScroll(document);
    node.showModal();
    heading.current?.focus();
    return () => {node.close(); releaseScroll(); previous?.focus({preventScroll:true});};
  }, []);
  useEffect(() => {
    if (!edited) setMessage(contactMessage({home, search, type:intent, question, language}));
  }, [language, intent, edited, home, search, question]);
  useEffect(() => {
    dialog.current.scrollTop = 0;
    heading.current?.focus({preventScroll:true});
  }, [step]);
  const channelLabel = value => value === 'whatsapp' ? 'WhatsApp' : copy('Correo electrónico', 'E-mail');
  const intentLabel = value => value === 'visit' ? copy('Solicitar visita', 'Solicitar visita') : copy('Enviar mensaje', 'Enviar mensagem');
  const title = step === 'receipt' ? copy('Contacto simulado registrado', 'Contato simulado registrado') : step === 'review' ? copy('Revisa tu contacto', 'Revise seu contato') : copy('Habla con el anunciante', 'Fale com o anunciante');
  const errorLabel = field => ({
    name: copy('Escribe un nombre de 2 a 80 caracteres.', 'Informe um nome com 2 a 80 caracteres.'),
    email: copy('Escribe un correo válido, como nombre@correo.com.', 'Informe um e-mail válido, como nome@email.com.'),
    phone: copy('Incluye +, código de país y de 10 a 15 dígitos.', 'Inclua +, código do país e de 10 a 15 dígitos.'),
    message: copy('Escribe entre 10 y 1.400 caracteres.', 'Escreva de 10 a 1.400 caracteres.'),
  })[field];
  function review(event) {
    event.preventDefault();
    const next = contactValidation({profile:data, channel, message});
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`${inputPrefix}-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    setStep('review');
  }
  function send() {
    if (sent.current) return;
    sent.current = true;
    setSendError(false);
    try {
      const next = createContactReceipt({home, broker:recipient.name, intent, channel, message, profile:data});
      onReceipt(next);
      onProfile(normalizeContactProfile(data));
      setReceipt(next);
      setStep('receipt');
    } catch {
      sent.current = false;
      setSendError(true);
    }
  }
  function startAnother() {
    sent.current = false;
    setMessage(contactMessage({home, search, type, question, language}));
    setIntent(contactIntent(type));
    setEdited(false);
    setErrors({});
    setStep('compose');
  }
  function update(field, value) {
    setData(current => ({...current, [field]:value}));
    setErrors(current => ({...current, [field]:undefined}));
  }
  function field(name, label, options = {}) {
    return <label className="contact-flow-field" htmlFor={`${inputPrefix}-${name}`}><span>{label}</span><input
      id={`${inputPrefix}-${name}`} value={data[name]} onChange={e=>update(name,e.target.value)}
      aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${inputPrefix}-${name}-error` : undefined}
      required {...options}/>{errors[name]&&<small className="contact-flow-error" id={`${inputPrefix}-${name}-error`}>{errorLabel(name)}</small>}</label>;
  }
  const summary = current => <dl className="contact-flow-summary">
    <div><dt>{copy('Destinatario', 'Destinatário')}</dt><dd>{current.broker}</dd></div>
    <div><dt>{copy('Intención', 'Intenção')}</dt><dd>{intentLabel(current.intent)}</dd></div>
    <div><dt>{copy('Canal de respuesta', 'Canal de resposta')}</dt><dd>{channelLabel(current.channel)} · {current.channel === 'email' ? current.profile.email : current.profile.phone}</dd></div>
    <div><dt>{copy('Nombre', 'Nome')}</dt><dd>{current.profile.name}</dd></div>
  </dl>;
  return <dialog ref={dialog} className="contact-flow-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="contact-flow-header">
      <div><h2 ref={heading} tabIndex={-1} id={titleId}>{title}</h2></div>
      <button type="button" className="contact-flow-close" onClick={onClose} aria-label={copy('Volver al inmueble', 'Voltar ao imóvel')}><Icon name="close"/></button>
    </header>
    <div className="contact-flow-body">
      <div className="contact-flow-property"><img src={propertyPhoto(home)} alt=""/><div><strong>{home.street}</strong><span>{home.area} · {copy('Anuncio', 'Anúncio')} {home.listingId}</span><b>{money(listingPrice(home))} {currency}</b></div></div>
      {step === 'compose' ? <form noValidate onSubmit={review}>
        <div className="contact-flow-recipient">{recipient.logo&&<img src={recipient.logo} alt=""/>}<div><span>{copy('Destinatario', 'Destinatário')}</span><strong>{recipient.name}</strong></div></div>
        {!recipient.verified&&<p className="contact-flow-muted">{copy('Esta ficha no confirma el nombre del anunciante. El logo del card es ilustrativo.', 'Esta ficha não confirma o nome do anunciante. A logo do card é ilustrativa.')}</p>}
        <fieldset className="contact-flow-options"><legend>{copy('¿Qué te gustaría hacer?', 'O que você gostaria de fazer?')}</legend>{['message','visit'].map(value=><label key={value}><input type="radio" name={`${inputPrefix}-intent`} checked={intent===value} onChange={()=>setIntent(value)}/><span>{intentLabel(value)}</span></label>)}</fieldset>
        <fieldset className="contact-flow-options"><legend>{copy('¿Por dónde prefieres recibir respuesta?', 'Por onde prefere receber uma resposta?')}</legend>{['email','whatsapp'].map(value=><label key={value}><input type="radio" name={`${inputPrefix}-channel`} checked={channel===value} onChange={()=>setChannel(value)}/><span>{channelLabel(value)}</span></label>)}</fieldset>
        <label className="contact-flow-field" htmlFor={`${inputPrefix}-message`}><span>{copy('Tu mensaje', 'Sua mensagem')}</span><textarea id={`${inputPrefix}-message`} rows={6} value={message} onChange={e=>{setMessage(e.target.value);setEdited(true);setErrors(current=>({...current,message:undefined}));}} maxLength={1400} aria-invalid={!!errors.message} aria-describedby={errors.message?`${inputPrefix}-message-error`:undefined}/>{errors.message&&<small id={`${inputPrefix}-message-error`} className="contact-flow-error">{errorLabel('message')}</small>}</label>
        <div className="contact-flow-data-title"><h3>{copy('Tus datos de contacto', 'Seus dados de contato')}</h3><p>{profile?.name ? copy('Reutilizamos los datos de esta sesión. Puedes editarlos.', 'Reutilizamos os dados desta sessão. Você pode editá-los.') : copy('Podrás reutilizarlos si eliges otro inmueble.', 'Você poderá reutilizá-los ao escolher outro imóvel.')}</p></div>
        <div className="contact-flow-fields">
          {field('name',copy('Nombre','Nome'),{autoComplete:'name',maxLength:80})}
          {channel==='email' ? field('email',copy('Correo electrónico','E-mail'),{type:'email',inputMode:'email',autoComplete:'email',placeholder:'nombre@correo.com',maxLength:120}) : field('phone',copy('WhatsApp con código de país','WhatsApp com código do país'),{type:'tel',inputMode:'tel',autoComplete:'tel',placeholder:'+52 55 1234 5678',maxLength:24})}
        </div>
        <p className="contact-flow-notice"><Icon name="info" size={18}/>{copy('Demostración: no enviaremos mensajes ni comprobaremos tu identidad. Tus datos se guardan solo en esta sesión del navegador.', 'Demonstração: não enviaremos mensagens nem verificaremos sua identidade. Seus dados ficam apenas nesta sessão do navegador.')}</p>
        <div className="contact-flow-actions"><button type="button" className="contact-flow-secondary" onClick={onClose}>{copy('Volver al inmueble','Voltar ao imóvel')}</button><button type="submit" className="flow-primary">{copy('Revisar contacto','Revisar contato')}<Icon name="arrow" size={20}/></button></div>
      </form> : step === 'review' ? <section>
        <p className="contact-flow-intro">{copy('Confirma el inmueble, el destinatario, el mensaje y tus datos antes de continuar.', 'Confira o imóvel, o destinatário, a mensagem e seus dados antes de continuar.')}</p>
        {summary({broker:recipient.name,intent,channel,profile:data})}
        <div className="contact-flow-message"><h3>{copy('Mensaje para el anunciante','Mensagem para o anunciante')}</h3><p>{message}</p></div>
        {intent==='visit'&&<p className="contact-flow-muted">{copy('Estás solicitando una visita; todavía no hay fecha ni horario acordados.', 'Você está solicitando uma visita; ainda não há data nem horário combinados.')}</p>}
        <p className="contact-flow-notice"><Icon name="info" size={18}/>{copy('Al confirmar, solo registraremos esta simulación. No se enviará ningún mensaje real.', 'Ao confirmar, registraremos apenas esta simulação. Nenhuma mensagem real será enviada.')}</p>
        {sendError&&<p role="alert" className="contact-flow-error">{copy('No pudimos registrar la simulación. Tus datos siguen aquí; puedes intentarlo de nuevo.', 'Não foi possível registrar a simulação. Seus dados continuam aqui; tente novamente.')}</p>}
        <div className="contact-flow-actions"><button className="contact-flow-secondary" onClick={()=>setStep('compose')}>{copy('Editar','Editar')}</button><button className="flow-primary" onClick={send}>{copy('Confirmar envío simulado','Confirmar envio simulado')}<Icon name="send" size={18}/></button></div>
      </section> : <section className="contact-flow-receipt">
        <div className="contact-flow-success"><Icon name="check" size={22}/><p>{copy('Tu solicitud quedó registrada en este prototipo.', 'Sua solicitação foi registrada neste protótipo.')}</p></div>
        {summary(receipt)}
        <details className="contact-flow-message"><summary>{copy('Ver mensaje registrado','Ver mensagem registrada')}</summary><p>{receipt.message}</p></details>
        <div className="contact-flow-next"><h3>{copy('¿Qué pasaría después?', 'O que aconteceria depois?')}</h3><p>{receipt.intent==='visit' ? copy('En un envío real, el anunciante tendría que confirmar la disponibilidad y acordar un horario contigo. Esta visita no está agendada.', 'Em um envio real, o anunciante precisaria confirmar a disponibilidade e combinar um horário com você. Esta visita não está agendada.') : copy('En un envío real, el anunciante recibiría tu consulta y podría responder por el canal elegido. Aquí no hay entrega ni respuesta de la inmobiliaria.', 'Em um envio real, o anunciante receberia sua consulta e poderia responder pelo canal escolhido. Aqui não há envio nem resposta da imobiliária.')}</p></div>
        <p className="contact-flow-muted">{copy('Vuelve a tu selección. Si otro inmueble te interesa, podrás contactarlo sin volver a completar tus datos.', 'Volte à sua seleção. Se outro imóvel interessar, você poderá contatá-lo sem preencher seus dados novamente.')}</p>
        <div className="contact-flow-actions"><button className="contact-flow-secondary" onClick={onClose}>{copy('Ver este inmueble','Ver este imóvel')}</button><button className="flow-primary" onClick={onDone}>{copy('Volver a mi selección','Voltar à minha seleção')}<Icon name="arrow" size={20}/></button></div>
        <button className="contact-flow-again" onClick={startAnother}>{copy('Preparar otro mensaje para este inmueble','Preparar outra mensagem para este imóvel')}</button>
      </section>}
    </div>
  </dialog>;
}
