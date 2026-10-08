import React, {useLayoutEffect, useRef} from 'react';
import {AnimatePresence, motion, useIsPresent, useReducedMotion} from 'motion/react';
import {EASE_DRAWER, EASE_OUT, useMediaQuery} from './favoriteMotion';

function frameMotion(reduce, sheet) {
  if (reduce) return {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.2, ease:EASE_OUT}};
  if (sheet) return {
    initial:{transform:'translateY(100%)'}, animate:{transform:'translateY(0%)', transition:{duration:0.45, ease:EASE_DRAWER}},
    exit:{transform:'translateY(100%)', transition:{duration:0.3, ease:EASE_DRAWER}},
  };
  return {
    initial:{opacity:0, transform:'scale(0.96)'}, animate:{opacity:1, transform:'scale(1)'},
    exit:{opacity:0, transform:'scale(0.96)'}, transition:{duration:0.25, ease:EASE_OUT},
  };
}

// The frame opens and closes the dialog; panels inside it only swap.
const swapMotion = reduce => reduce
  ? {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.2, ease:EASE_OUT}}
  : {
    initial:{opacity:0, transform:'scale(0.96)'}, animate:{opacity:1, transform:'scale(1)', transition:{duration:0.25, ease:EASE_OUT}},
    exit:{opacity:0, transform:'scale(0.92)', transition:{duration:0.2, ease:EASE_OUT}},
  };

/** Native modal dialog for focus trapping and Escape; changing `panelKey` shrinks the current panel and opens the next one. */
export function ModalShell({labelledBy, onClose, panelKey = 'main', panelClassName = '', children}) {
  const dialog = useRef(null);
  const present = useIsPresent();
  const reduce = useReducedMotion();
  const sheet = useMediaQuery('(max-width: 700px)');
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el.open) el.showModal();
    el.querySelector('[data-autofocus]')?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {root.style.overflow = overflow; if (el.open) el.close();};
  }, []);

  const close = () => {if (present) onClose();};

  return <dialog ref={dialog} className="folder-dialog" aria-labelledby={labelledBy} onCancel={event => {event.preventDefault(); close();}} data-closing={!present || undefined}>
    <motion.div className="folder-dialog-backdrop" aria-hidden="true" onClick={close}
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25, ease:EASE_OUT}}/>
    <motion.div className={`folder-frame${sheet ? ' is-sheet' : ''}`} {...frameMotion(reduce, sheet)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={panelKey} className={`folder-panel${panelClassName ? ` ${panelClassName}` : ''}${sheet ? ' is-sheet' : ''}`} {...swapMotion(reduce)}>
          {typeof children === 'function' ? children(close) : children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  </dialog>;
}
