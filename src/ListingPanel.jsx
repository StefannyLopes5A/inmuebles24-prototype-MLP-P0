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
import {CHECK_PATH, ChatTurn, MoraComposer, crossfade, placeOf, replyLine, typing, useMoraThread} from './moraChat';
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
const rise = (reduce, delay, still) => reduce ? {} : still
  ? {initial:{opacity:0}, animate:{opacity:1}, transition:{duration:0.2, ease:EASE_FADE, delay}}
  : {initial:{opacity:0, transform:'translateY(8px)'}, animate:{opacity:1, transform:'translateY(0px)'}, transition:{duration:0.2, ease:EASE_FADE, delay}};
// Swapping listings fades only the reading; the footer and every position stay put.
const swapOut = {duration:CONTENT_OUT / 1000, ease:'easeOut'};
const swap = reduce => ({initial:reduce ? {opacity:0} : {opacity:0, transform:'translateY(8px)'}, animate:{opacity:1, transform:'translateY(0px)'}, exit:{opacity:0, transition:{duration:CONTENT_OUT / 1000, ease:'easeOut'}}, transition:{duration:0.2, ease:EASE_FADE}});

const SEND_MS = 420;
const CHIPS = [
  {id:'weekend', es:['Visita este fin de semana', '¿Puede ser este fin de semana?'], br:['Visita neste fim de semana', 'Pode ser neste fim de semana?']},
  {id:'negotiable', es:['¿Es negociable?', '¿El precio es negociable?'], br:['É negociável?', 'O preço é negociável?']},
];

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

function HostLogo({advertiser, say}) {
  return <span className="lp-host-logo-wrap">
    {advertiser.logo
      ? <img className="lp-host-logo" src={advertiser.logo} alt=""/>
      : <span className="lp-host-logo is-monogram" aria-hidden="true">{advertiser.initials}</span>}
    {say && <AgencyServiceSeal advertiser={advertiser} say={say}/>}
  </span>;
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
  const [draft, setDraft] = useState(''), [gap, setGap] = useState(null), [verdict, setVerdict] = useState(null);
  const [data, setData] = useState(() => normalizeContactProfile(profile));
  const known = useMemo(() => {
    const found = contactValidation({profile, channel:'whatsapp', message:'Contacto de prueba'});
    return {name:!found.name, phone:!found.phone};
    // Decided once per listing, so the fields don't vanish while the person types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({}), [sending, setSending] = useState(false), [sendError, setSendError] = useState('');
  const prefix = useId(), formId = `${prefix}-contact`, askId = `${prefix}-ask`, root = useRef(null), askField = useRef(null), threadRef = useRef(null), timer = useRef(null), pending = useRef(false), lastPhase = useRef(phase);
  const {turns, push, agencyAction} = useMoraThread({on:phase === 'question', threadRef, scroller:() => root.current?.querySelector('.lp-scroll'), reduce});
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
  function ask(value, source, kind = 'ask', slot = null) {
    if (push(value, source, kind, slot)) setDraft('');
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
