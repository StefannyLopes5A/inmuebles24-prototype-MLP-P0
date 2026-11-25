import React, {useEffect, useState} from 'react';
import {sectionReading} from './selectionAsk.js';
import {SOFT_MOTION} from './homeIntro.js';

const WORKING = {
  price:['Comparando com a região…', 'Comparando con la zona…'],
  description:['Lendo o anúncio…', 'Leyendo el anuncio…'],
  offer:['Calculando as chances…', 'Calculando las probabilidades…'],
  costs:['Fazendo as contas…', 'Haciendo las cuentas…'],
  history:['Revendo o histórico…', 'Revisando el historial…'],
};
const WORKING_MS = 1100;

// Figures carry the answer, so they read heavier than the sentence around them: prices, shares and spans of time.
const KEY = /[+−-]?\$\s?\d(?:[\d.,]*\d)?(?:\s?[MK]\b)?(?:\s?MXN)?|[+−-]?\d(?:[\d.,]*\d)?\s?%|\d+(?:[.,]\d+)?\s(?:dias?|días?|anos?|años?|meses|mes|m²|min)/giu;

/** The sentence as words, each flagged when it falls inside a figure. */
function wordsOf(text, marks = []) {
  const spans = [...text.matchAll(KEY)].map(match => [match.index, match.index + match[0].length]);
  // Phrases a reading marks itself (the pros and cons) read heavy like the figures.
  for (const mark of marks) {
    const at = text.indexOf(mark);
    if (at >= 0) spans.push([at, at + mark.length]);
  }
  const words = [];
  for (const match of text.matchAll(/\S+/g)) {
    const start = match.index, end = start + match[0].length;
    words.push({text:match[0], key:spans.some(([from, to]) => start < to && end > from)});
  }
  return words;
}

/**
 * What Mora read in one section of the listing page, opened by that section's pill and shown right under its title.
 * It thinks first (the same sweep as the page's own reading), then inks the sentence in. It wears the page verdict's
 * voice (`lp-mora-lead`) and stays on the page: no panel, no chat.
 */
export function SectionInsight({section, home, language, id, reading:given = null}) {
  const reading = given || sectionReading(section, home, language);
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches;
  const [ready, setReady] = useState(reduce);
  const [streaming, setStreaming] = useState(!reduce);
  const words = reading ? wordsOf(reading.text, reading.marks) : [];
  useEffect(() => {
    if (ready || !reading) return undefined;
    const timer = setTimeout(() => setReady(true), WORKING_MS);
    return () => clearTimeout(timer);
  }, [ready, reading]);
  useEffect(() => {
    if (!ready || !streaming) return undefined;
    const timer = setTimeout(() => setStreaming(false), (words.length - 1) * SOFT_MOTION.wordStep + SOFT_MOTION.fade);
    return () => clearTimeout(timer);
  }, [ready, streaming, words.length]);
  if (!reading) return null;
  const working = (WORKING[section] || WORKING.price)[language === 'pt-BR' ? 0 : 1];
  return <div className="pp-insight lp-mora is-page" id={id}>
    <div className="lp-mora-card">
      <div className="lp-mora-body">
        <p className="lp-mora-status"><img className={`lp-mora-mark${ready ? '' : ' is-working'}`} src="/assets/mini-listing/mora.svg" alt=""/><strong>Mora</strong></p>
        <div className="lp-mora-lead">
          <div className="lp-mora-voice" role="status" aria-live="polite" aria-atomic="true">
            {ready
              ? <p className="lp-mora-synthesis" data-streaming={streaming || undefined}>{words.map((word, i) => <React.Fragment key={i}>
                {i > 0 && ' '}
                <span className={word.key ? 'lp-word is-key' : 'lp-word'} style={streaming ? {animationDelay:`${i * SOFT_MOTION.wordStep}ms`, animationDuration:`${SOFT_MOTION.fade}ms`} : undefined}>{word.text}</span>
              </React.Fragment>)}</p>
              : <p className="lp-mora-working" aria-hidden="true"><span>{working}</span></p>}
          </div>
          {ready && reading.note && <p className="lp-mora-note">{reading.note}</p>}
        </div>
      </div>
    </div>
  </div>;
}
