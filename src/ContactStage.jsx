import React, {useMemo} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {AgencyServiceSeal} from './ListingCardChrome';
import {propertyPhoto} from './data';
import {advertiserReviews} from './listingAdvertiser';
import {EASE_FADE, SPRING_SIZE} from './listingPanelMotion';

const CHECK_PATH = 'M5 12.5l4.5 4.5L19 7.5';
const crossfade = {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.2, ease:EASE_FADE}};

export function HostLogo({advertiser, say}) {
  return <span className="lp-host-logo-wrap">
    {advertiser.logo
      ? <img className="lp-host-logo" src={advertiser.logo} alt=""/>
      : <span className="lp-host-logo is-monogram" aria-hidden="true">{advertiser.initials}</span>}
    {say && <AgencyServiceSeal advertiser={advertiser} say={say}/>}
  </span>;
}

// Form and sent share one stage: the photo, the agency and its trust facts grow in place instead of a new screen.
const STAGE = {
  form:{art:[150, 100], photo:[80, 80, -18], host:[44, 22, 16], value:15, label:12, cell:[8, 14]},
  sent:{art:[180, 124], photo:[104, 104, -22], host:[56, 30, 24], value:20, label:13, cell:[12, 20]},
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
