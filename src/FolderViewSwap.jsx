import {AnimatePresence, motion, useIsPresent, useReducedMotion} from 'motion/react';
import {EASE_OUT} from './favoriteMotion';

/**
 * Slides the favorites board and the comparison through each other.
 * Comparar enters from the right; Tablero enters from the left.
 */
export function FolderViewSwap({mode, children}) {
  const reduce = useReducedMotion();
  const direction = mode === 'compare' ? 1 : -1;
  const shift = reduce ? 0 : 36;
  const variants = {
    enter:dir => ({opacity:0, x:dir * shift}),
    center:{opacity:1, x:0},
    exit:dir => ({opacity:0, x:dir * -shift}),
  };
  return <div className="folder-view-swap">
    <AnimatePresence initial={false} custom={direction}>
      <Pane key={mode} direction={direction} variants={variants} reduce={reduce}>{children}</Pane>
    </AnimatePresence>
  </div>;
}

function Pane({children, direction, variants, reduce}) {
  const present = useIsPresent();
  return <motion.div className="folder-view-pane" data-leaving={!present || undefined} custom={direction}
    variants={variants} initial="enter" animate="center" exit="exit"
    transition={{duration:reduce ? 0.12 : 0.36, ease:EASE_OUT}}>
    {children}
  </motion.div>;
}
