import React, {useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence, motion} from 'motion/react';
import {Icon} from './App';
import {EASE_FADE} from './listingPanelMotion';

/** Dark full-screen photo viewer shared by the mini-listing and the listing page. Keyboard handling stays with the caller. */
export function PhotoLightbox({gallery, onIndex, onClose, copy, crossfade = false, morph = false, className = ''}) {
  const close = useRef(null);
  const {photos, index, alt} = gallery;
  useEffect(() => { close.current?.focus({preventScroll:true}); }, []);
  return createPortal(<motion.div className={`lp-gallery${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={copy.say('Fotos do imóvel', 'Fotos del inmueble')}
    initial={morph ? false : {opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2, ease:EASE_FADE}}>
    {crossfade
      ? <AnimatePresence initial={false}><motion.img key={photos[index]} className="lp-gallery-photo" src={photos[index]} alt={index === 0 ? alt : ''}
        initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2, ease:EASE_FADE}}/></AnimatePresence>
      : <img src={photos[index]} alt={index === 0 ? alt : ''}/>}
    <p className="lp-gallery-count">{index + 1} / {photos.length}</p>
    <button ref={close} type="button" className="lp-gallery-close" onClick={onClose} aria-label={copy.say('Fechar fotos', 'Cerrar fotos')}><img src="/assets/mini-listing/close.svg" alt=""/></button>
    {photos.length > 1 && <>
      <button type="button" className="lp-gallery-step is-prev" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label={copy.say('Foto anterior', 'Foto anterior')}><Icon name="arrow" size={20}/></button>
      <button type="button" className="lp-gallery-step is-next" disabled={index === photos.length - 1} onClick={() => onIndex(index + 1)} aria-label={copy.say('Próxima foto', 'Foto siguiente')}><Icon name="arrow" size={20}/></button>
    </>}
  </motion.div>, document.body);
}
