import React, {useEffect, useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {SOFT_MOTION} from './homeIntro.js';

export const MORA_MARK = '/assets/mini-listing/mora.svg';
/** One full pass of the thinking gradient, so the line is read before the sentence replaces it. */
export const MORA_THINK = 1800;

const seen = new Set();

/** Mora's signature: the original mark and her name, never recolored. */
export function MoraSignature({context, working = false, className = ''}) {
  return <p className={`mora-signature ${className}`.trim()}>
    <img className={working ? 'is-working' : undefined} src={MORA_MARK} alt=""/>
    <strong>Mora</strong>
    {context && <span>{context}</span>}
  </p>;
}

/** The thinking line: the orange→blue gradient passes through the text until the sentence lands. */
export function MoraThinking({text, className = ''}) {
  return <p className={`mora-thinking ${className}`.trim()} aria-hidden="true"><span>{text}</span></p>;
}

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/** The sentence inks in word by word with the home cadence; `offset` continues a previous sentence's count. */
export function MoraWords({text, animate = true, offset = 0, as: Tag = 'p', className = '', ...rest}) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  return <Tag className={`mora-words ${className}`.trim()} data-streaming={animate || undefined} {...rest}>
    {words.map((word, i) => <React.Fragment key={i}>
      {i > 0 && ' '}
      <span className="mora-word" style={animate ? {animationDelay:`${(offset + i) * SOFT_MOTION.wordStep}ms`, animationDuration:`${SOFT_MOTION.fade}ms`} : undefined}>{word}</span>
    </React.Fragment>)}
  </Tag>;
}

/**
 * Thinking, then the sentence, once per reading. A reading already seen, or reduced motion, lands at once.
 * Returns `{ready, animate}`: show `MoraThinking` until ready, then `MoraWords` with `animate`.
 */
export function useMoraReveal(key, think = MORA_THINK) {
  const reduce = useReducedMotion();
  const fresh = () => ({key, ready:!key || reduce || seen.has(key), animate:!!key && !reduce && !seen.has(key)});
  const [state, setState] = useState(fresh);
  useEffect(() => {
    if (!key) return undefined;
    const next = fresh();
    setState(next);
    if (next.ready) { seen.add(key); return undefined; }
    const timer = setTimeout(() => {
      seen.add(key);
      setState(current => current.key === key ? {...current, ready:true} : current);
    }, think);
    return () => clearTimeout(timer);
    // `fresh` reads only the key and the motion preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce]);
  return state.key === key ? state : fresh();
}
