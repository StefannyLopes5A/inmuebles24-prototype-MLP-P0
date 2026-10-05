export const SOFT_MOTION = {fade:620, wordStep:110, sweep:760, chevronDelay:520, chevron:240};

// One reading cadence crosses the entire sentence. Conversion never advances
// this clock: each filter's light pass runs independently of the next words.
export function createHomeIntro(parts) {
  const speed=1, cadence=1;
  const beats = [0];
  const step = SOFT_MOTION.wordStep * cadence;
  let cursor = 200;
  const words = parts.map(part => {
    const chunks = part.text.match(/\S+\s*/g) || [];
    const start = cursor;
    const typedAt = start + Math.max(0, chunks.length - 1) * step + SOFT_MOTION.fade;
    const morphAt = typedAt;
    const settledAt = part.key ? morphAt + SOFT_MOTION.sweep : typedAt;
    cursor += chunks.length * step;
    beats.push(start, typedAt, morphAt, settledAt);
    return {letters:Array.from(part.text), chunks, revealStep:step, start:start/speed, typedAt:typedAt/speed,
      morphAt:morphAt/speed, settledAt:settledAt/speed, typed:[start/speed],
      interactive:!!part.key, reveal:'phrase'};
  });
  const readyAt = Math.max(...words.map(word => word.settledAt)) + 100/speed;
  // Continue the same gesture below the sentence while the CTA is resolving.
  const headingAt = readyAt + 60/speed;
  const cardsAt = readyAt + 180/speed;
  const discoveryAt = readyAt + 400/speed;
  const doneAt = discoveryAt + 850/speed;
  return {kind:'soft', words, readyAt, headingAt, cardsAt, discoveryAt, doneAt,
    beats:[...new Set([...beats.map(t=>t/speed),readyAt,headingAt,cardsAt,discoveryAt,doneAt])].sort((a,b)=>a-b)};
}

export function homeIntroFrame(timeline, elapsed) {
  const ready = elapsed >= timeline.readyAt;
  let activeWord = 0;
  const words = timeline.words.map((word, index) => {
    if (elapsed >= word.start) activeWord = index;
    const next = word.typed.findIndex(time => time > elapsed);
    return {
      count:word.reveal === 'phrase' ? elapsed >= word.start ? word.letters.length : 0 : next === -1 ? word.letters.length : next,
      visible:elapsed >= word.start || index === 0 && timeline.kind !== 'soft',
      control:word.interactive && elapsed >= word.morphAt,
      morphing:word.interactive && elapsed >= word.morphAt && elapsed < word.settledAt,
      typing:word.reveal !== 'phrase' && elapsed >= word.start && elapsed < word.typedAt,
    };
  });
  const stage = elapsed < timeline.headingAt ? 0 : elapsed < timeline.cardsAt ? 1 : elapsed < timeline.discoveryAt ? 2 : 3;
  return {words, activeWord, ready, stage, done:elapsed >= timeline.doneAt};
}
