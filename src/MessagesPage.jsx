import React, {useId, useLayoutEffect, useRef, useState} from 'react';
import {ModalShell} from './ModalShell';
import {useLanguage} from './i18n';
import {IconButton} from './IconButton.jsx';
import {FavoriteHeart} from './FavoriteHeart.jsx';
import {Icon} from './App';
import {advertiserFor} from './listingAdvertiser.js';
import {listingPrice, propertyPhoto} from './data';

const pad = value => String(value).padStart(2, '0');
const shortDate = iso => { const date = new Date(iso); return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(2)}`; };

function Answer({name, label, value, onChange, say}) {
  return <div className="msg-question" role="group" aria-label={label}>
    <p>{label}</p>
    <div className="msg-answers">
      {[[true, say('Sí', 'Sim')], [false, say('No', 'Não')]].map(([answer, text]) =>
        <button key={String(answer)} type="button" className="msg-answer" aria-pressed={value === answer} onClick={() => onChange(value === answer ? null : answer)}>{text}</button>)}
    </div>
  </div>;
}

/** Five stars as a radio group: pressing the chosen star again clears the rating. */
function StarRating({label, value, onChange, say}) {
  return <div className="msg-question" role="radiogroup" aria-label={label}>
    <p>{label}</p>
    <div className="msg-stars">
      {[1, 2, 3, 4, 5].map(star => <button key={star} type="button" role="radio" aria-checked={value === star} className={'msg-star' + (star <= (value || 0) ? ' is-on' : '')}
        aria-label={say(`${star} de 5 estrellas`, `${star} de 5 estrelas`)} onClick={() => onChange(value === star ? 0 : star)}>
        <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" strokeLinejoin="round"/></svg>
      </button>)}
    </div>
    <span className="sr-only" role="status">{value ? say(`${value} de 5 estrellas`, `${value} de 5 estrelas`) : ''}</span>
  </div>;
}

const THUMB = 'M7 10v11H3V10h4Zm0 0 4-7a2 2 0 0 1 2 2v4h6.2a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 18 21H7';
/** After the visit: dislike, like or love the property itself (two thumbs, so it never reads as a favorite heart). Pressing the chosen one again clears it. */
function PropertyReaction({label, value, onChange, say}) {
  const options = [
    ['dislike', say('No me gustó', 'Não gostei'), 1, 'rotate(180 12 12)'],
    ['like', say('Me gustó', 'Gostei'), 1, undefined],
    ['love', say('Me encantó', 'Amei'), 2, undefined],
  ];
  return <div className="msg-question" role="radiogroup" aria-label={label}>
    <p>{label}</p>
    <div className="msg-reactions">
      {options.map(([id, text, thumbs, transform]) => <button key={id} type="button" role="radio" aria-checked={value === id} className={`msg-reaction is-${id}`} onClick={() => onChange(value === id ? null : id)}>
        <svg width={thumbs > 1 ? 30 : 20} height="20" viewBox={thumbs > 1 ? '0 0 36 24' : '0 0 24 24'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {thumbs > 1 && <path d={THUMB} transform="translate(12 0)"/>}<path d={THUMB} transform={transform}/>
        </svg>{text}
      </button>)}
    </div>
  </div>;
}

function MessageCard({receipt, home, saved, onLike, onOpen, language, money, say}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [replied, setReplied] = useState(null);
  const [visited, setVisited] = useState(null);
  const [stars, setStars] = useState(0);
  const [reaction, setReaction] = useState(null);
  const advertiser = advertiserFor(home);
  const visit = receipt.intent === 'visit';
  // Confirming the agency answered turns the request into a done contact; confirming the visit turns it into a done visit.
  const stage = visited === true ? 'visited' : replied === true ? 'contacted' : 'sent';
  const pill = stage === 'visited' ? say('Visita realizada', 'Visita realizada')
    : stage === 'contacted' ? say('Contacto realizado', 'Contato realizado')
    : visit ? say('Visita solicitada', 'Visita solicitada') : say('Mensaje enviado', 'Mensagem enviada');
  const details = [home.size >= 20 ? `${home.size} m²` : null, say(`${home.beds} recámaras`, `${home.beds} quartos`), home.baths ? say(`${home.baths} baños`, `${home.baths} banheiros`) : null].filter(Boolean);
  return <article className="msg-card" data-home-id={home.id}>
    <div className="msg-photo">
      <button type="button" className="msg-open" onClick={event => onOpen(home, event)} aria-label={say('Explorar ', 'Explorar ') + home.street}>
        <img src={propertyPhoto(home)} alt="" loading="lazy"/>
        <span className="msg-value"><small>{home.mode === 'rent' ? say('Departamento en renta', 'Apartamento para alugar') : say('Departamento en venta', 'Apartamento à venda')}</small><strong>{money(listingPrice(home))}{home.mode === 'rent' ? <small> /{say('mes', 'mês')}</small> : null}</strong></span>
      </button>
      <span className="msg-contacted"><Icon name="check" size={12}/>{say(`Contactado el ${shortDate(receipt.createdAt)}`, `Contatado em ${shortDate(receipt.createdAt)}`)}</span>
      <button type="button" className={'discovery-like msg-like' + (saved ? ' is-liked' : '')} aria-pressed={saved} aria-label={say(saved ? 'Quitar de favoritos ' : 'Me gusta ', saved ? 'Remover dos favoritos ' : 'Curtir ') + home.street} onClick={() => onLike(home)}><FavoriteHeart/></button>
    </div>
    <div className="msg-info">
      <p className="msg-reason">{home.title}</p>
      <div className="msg-details">
        <div><strong>{home.street} · {home.area}</strong><span>{details.join(' · ')}</span></div>
        <span className="msg-agency" aria-hidden="true">{advertiser.logo ? <img src={advertiser.logo} alt=""/> : advertiser.initials}</span>
      </div>
      <button type="button" className={`msg-pill is-${stage}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span>{pill}</span>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
      </button>
    </div>
    {open && <ModalShell labelledBy={titleId} panelClassName="msg-panel" onClose={() => setOpen(false)}>{close => <>
      <header className="folder-panel-header">
        <span aria-hidden="true"/>
        <h2 id={titleId}>{say('¿Cómo te fue con esta inmobiliaria?', 'Como foi com esta imobiliária?')}</h2>
        <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
      </header>
      <div className="folder-panel-body msg-modal-body">
        <Answer label={say('¿La inmobiliaria te contactó?', 'A imobiliária entrou em contato?')} value={replied} say={say} onChange={value => { setReplied(value); if (value !== true) { setVisited(null); setStars(0); setReaction(null); } }}/>
        {replied === true && <StarRating label={say('¿Cómo calificas la atención de la inmobiliaria?', 'Como você avalia o atendimento da imobiliária?')} value={stars} onChange={setStars} say={say}/>}
        {replied === true && <Answer label={say('¿Ya visitaste el inmueble?', 'Você já visitou o imóvel?')} value={visited} say={say} onChange={value => { setVisited(value); if (value !== true) setReaction(null); }}/>}
        {replied === true && visited === true && <PropertyReaction label={say('¿Qué te pareció el inmueble?', 'O que você achou do imóvel?')} value={reaction} onChange={setReaction} say={say}/>}
      </div>
    </>}</ModalShell>}
  </article>;
}

/** Simulated Mensajes: every contact sent from a listing in this session, in the card grid of the design. Nothing is delivered. */
export function MessagesPage({receipts = [], homeFor, saved = [], onLike, onOpen, onBack}) {
  const {language, money} = useLanguage();
  const say = (es, br) => language === 'pt-BR' ? br : es;
  const title = useRef(null);
  useLayoutEffect(() => { title.current?.focus({preventScroll:true}); }, []);
  const items = receipts.map(receipt => ({receipt, home:homeFor(receipt.propertyId)})).filter(item => item.home);
  const count = language === 'pt-BR' ? (items.length === 1 ? '1 mensagem' : `${items.length} mensagens`) : (items.length === 1 ? '1 mensaje' : `${items.length} mensajes`);
  return <article className="favorites-page messages-page">
    <header className="favorites-header">
      <IconButton icon="back" className="compare-back" onClick={onBack} label={say('Volver a la búsqueda', 'Voltar à busca')}/>
      <div className="favorites-heading">
        <h1 ref={title} tabIndex={-1}>{say('Mensajes', 'Mensagens')}</h1>
        {items.length > 0 && <p className="favorites-count">{count}</p>}
      </div>
    </header>
    {items.length ? <ul className="messages-grid">
      {items.map(({receipt, home}) => <li key={receipt.id}><MessageCard receipt={receipt} home={home} saved={saved.includes(home.id)} onLike={onLike} onOpen={onOpen} language={language} money={money} say={say}/></li>)}
    </ul> : <div className="messages-empty">
      <h2>{say('Aún no has enviado mensajes', 'Você ainda não enviou mensagens')}</h2>
      <p>{say('Cuando contactes a una inmobiliaria desde un inmueble, aparecerá aquí.', 'Quando você falar com uma imobiliária a partir de um imóvel, o contato aparece aqui.')}</p>
    </div>}
  </article>;
}
