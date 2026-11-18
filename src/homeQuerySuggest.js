import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';

const SUGGESTIONS = {
  es: [
    'Departamento en Roma Norte',
    'Casa con jardín en Narvarte',
    '3 recámaras en Polanco',
  ],
  'pt-BR': [
    'Apartamento em Roma Norte',
    'Casa com jardim em Narvarte',
    '3 quartos em Polanco',
  ],
};

export function homeQuerySuggestions(language) {
  const list = SUGGESTIONS[language] || SUGGESTIONS.es;
  return list.slice(0, 3);
}

/** Cycles three short examples, simulating typing until the field is engaged. */
export function useTypingSuggest(examples, active, {charMs = 34, holdMs = 1400, startMs = 500} = {}) {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const reduced = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion:reduce)').matches, []);
  const example = examples[index] || '';
  const timers = useRef([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const queue = (fn, delay) => {
    timers.current.push(setTimeout(fn, delay));
  };
  useEffect(() => {
    clearTimers();
    if (!active || !example) {
      setCount(0);
      return clearTimers;
    }
    if (reduced) {
      setCount(example.length);
      let cancelled = false;
      queue(() => {
        if (!cancelled) setIndex(current => (current + 1) % examples.length);
      }, holdMs);
      return () => {
        cancelled = true;
        clearTimers();
      };
    }
    setCount(0);
    let cancelled = false;
    let at = 0;
    const typeNext = () => {
      if (cancelled) return;
      at += 1;
      setCount(at);
      if (at < example.length) queue(typeNext, charMs);
      else queue(() => {
        if (cancelled) return;
        setIndex(current => (current + 1) % examples.length);
      }, holdMs);
    };
    queue(typeNext, startMs);
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [active, reduced, index, example, examples.length, charMs, holdMs, startMs]);
  useLayoutEffect(() => {
    if (!active) setCount(0);
  }, [active]);
  const text = reduced ? example : example.slice(0, count);
  return {text, typing: count < example.length && active && !reduced};
}
