/** Stages of a favorites folder board. A home with no saved stage starts in the first column. */

export const BOARD_STAGES = Object.freeze([
  {id:'interest', es:'Favoritadas', br:'Me interessam'},
  {id:'contacted', es:'Contactadas', br:'Contactadas'},
  {id:'visit', es:'Visita solicitada', br:'Visita solicitada'},
  {id:'visited', es:'Visitadas', br:'Visitadas'},
  {id:'offer', es:'Oferta enviada', br:'Proposta enviada'},
]);

const STAGE_IDS = new Set(BOARD_STAGES.map(stage => stage.id));
const LATER = new Set(['visit', 'visited', 'offer']);
const LABEL_MAX = 28;
const EMAIL_MAX = 80;
const GUEST_MAX = 12;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTE_MAX = 140;
export const SELF = 'me';
const VOTES = new Set(['up', 'down']);

const cleanNote = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX).trim();

export const cleanStageLabel = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX);

export const cleanGuestEmail = value => {
  const email = String(value ?? '').trim().toLowerCase().slice(0, EMAIL_MAX);
  return EMAIL.test(email) ? email : '';
};

/** Session data is untrusted: unknown stages, labels and emails are dropped. */
export function normalizeBoard(raw, homeIds = []) {
  const allowed = new Set(homeIds);
  const stages = {};
  if (raw?.stages && typeof raw.stages === 'object') {
    for (const [id, stage] of Object.entries(raw.stages)) {
      if (allowed.has(id) && STAGE_IDS.has(stage)) stages[id] = stage;
    }
  }
  const labels = {};
  if (raw?.labels && typeof raw.labels === 'object') {
    for (const stage of BOARD_STAGES) {
      const label = cleanStageLabel(raw.labels[stage.id]);
      if (label) labels[stage.id] = label;
    }
  }
  const seen = new Set();
  const guests = [];
  if (Array.isArray(raw?.guests)) {
    for (const guest of raw.guests) {
      const email = cleanGuestEmail(guest?.email);
      if (!email || seen.has(email)) continue;
      seen.add(email);
      guests.push({email});
      if (guests.length >= GUEST_MAX) break;
    }
  }
  const actors = new Set([SELF, ...guests.map(guest => guest.email)]);
  const feedback = {};
  if (raw?.feedback && typeof raw.feedback === 'object') {
    for (const [id, entry] of Object.entries(raw.feedback)) {
      if (!allowed.has(id) || !entry || typeof entry !== 'object') continue;
      const votes = {}, notes = {};
      for (const [actor, kind] of Object.entries(entry.votes || {})) if (actors.has(actor) && VOTES.has(kind)) votes[actor] = kind;
      for (const [actor, note] of Object.entries(entry.notes || {})) {
        const text = cleanNote(note?.text);
        if (actors.has(actor) && text) notes[actor] = {text, at:Number.isFinite(note.at) ? note.at : 0};
      }
      if (Object.keys(votes).length || Object.keys(notes).length) feedback[id] = {votes, notes};
    }
  }
  if (!Object.keys(stages).length && !Object.keys(labels).length && !guests.length && !Object.keys(feedback).length) return undefined;
  return {
    ...(Object.keys(stages).length ? {stages} : {}),
    ...(Object.keys(labels).length ? {labels} : {}),
    ...(guests.length ? {guests} : {}),
    ...(Object.keys(feedback).length ? {feedback} : {}),
  };
}

export function readBoard(folder) {
  const board = normalizeBoard(folder?.board, folder?.homeIds || []) || {};
  return {stages:board.stages || {}, labels:board.labels || {}, guests:board.guests || [], feedback:board.feedback || {}};
}

export function writeBoard(folder, board) {
  const next = normalizeBoard(board, folder.homeIds || []);
  const copy = {...folder};
  if (next) copy.board = next;
  else delete copy.board;
  return copy;
}

/** Saved stage wins. Without one, a contacted home sits in Contactadas and every other home in Favoritadas. */
export function stageFor(homeId, board, contacted = false) {
  const explicit = board?.stages?.[homeId];
  if (STAGE_IDS.has(explicit)) return explicit;
  return contacted ? 'contacted' : 'interest';
}

/**
 * Places a home. A contact does not pull a card back from Visita solicitada, Visitadas or Oferta enviada.
 * Any other column, including the first, moves to Contactadas when `keepLater` is set.
 */
export function withStage(folder, homeId, stage, {keepLater = false} = {}) {
  if (!STAGE_IDS.has(stage) || !folder?.homeIds?.includes(homeId)) return folder;
  const board = readBoard(folder);
  const current = board.stages[homeId];
  if (keepLater && LATER.has(current)) return folder;
  if (current === stage) return folder;
  return writeBoard(folder, {...board, stages:{...board.stages, [homeId]:stage}});
}

export function withLabels(folder, labels) {
  const board = readBoard(folder);
  const next = {};
  for (const stage of BOARD_STAGES) {
    const label = cleanStageLabel(labels?.[stage.id]);
    if (label) next[stage.id] = label;
  }
  return writeBoard(folder, {...board, labels:next});
}

const hash = text => {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0;
};

const GUEST_NOTES = {
  'es-MX':['Me gustó bastante. ¿Podemos visitarlo el sábado?', 'La ubicación me convence. ¿Qué incluye el mantenimiento?', 'Se ve muy bien. ¿Será negociable el precio?'],
  'pt-BR':['Gostei bastante. Dá para visitar no sábado?', 'A localização me convence. O que o condomínio inclui?', 'Parece ótimo. O preço é negociável?'],
};

/** "steh.lopes@…" reads "Steh": the first word of the part before the @. */
export function guestName(email) {
  const word = String(email || '').split('@')[0].split(/[._\-+]/)[0];
  return word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : '';
}

/** Adds the first feedback of a vote or a note; each person keeps one of each per listing. */
export function withVote(folder, homeId, actor, kind) {
  if (!folder?.homeIds?.includes(homeId) || !VOTES.has(kind)) return folder;
  const board = readBoard(folder);
  const entry = board.feedback[homeId] || {votes:{}, notes:{}};
  const votes = {...entry.votes};
  if (votes[actor] === kind) delete votes[actor];
  else votes[actor] = kind;
  return writeBoard(folder, {...board, feedback:{...board.feedback, [homeId]:{...entry, votes}}});
}

export function withComment(folder, homeId, actor, text, at = Date.now()) {
  if (!folder?.homeIds?.includes(homeId)) return folder;
  const board = readBoard(folder);
  const entry = board.feedback[homeId] || {votes:{}, notes:{}};
  const notes = {...entry.notes};
  const clean = cleanNote(text);
  if (clean) notes[actor] = {text:clean, at};
  else delete notes[actor];
  return writeBoard(folder, {...board, feedback:{...board.feedback, [homeId]:{...entry, notes}}});
}

/** What one listing carries: vote counts, what the person voted, and the notes newest first. */
export function feedbackFor(board, homeId) {
  const entry = board?.feedback?.[homeId] || {votes:{}, notes:{}};
  const kinds = Object.values(entry.votes);
  return {
    up:kinds.filter(kind => kind === 'up').length,
    down:kinds.filter(kind => kind === 'down').length,
    mine:entry.votes[SELF] || null,
    votes:entry.votes,
    notes:Object.entries(entry.notes).map(([actor, note]) => ({actor, ...note})).sort((a, b) => b.at - a.at),
  };
}

/**
 * Adding someone to the list simulates them answering: one listing, a thumbs up and a short note from a few hours ago.
 * The note is a fixed line, never anything the person typed, and nothing is sent to anyone.
 */
export function withGuest(folder, email, {language = 'es-MX', now = Date.now()} = {}) {
  const clean = cleanGuestEmail(email);
  const board = readBoard(folder);
  if (!clean || board.guests.some(guest => guest.email === clean)) return {folder, added:false};
  let next = writeBoard(folder, {...board, guests:[...board.guests, {email:clean}]});
  const ids = folder.homeIds || [];
  if (ids.length) {
    const seed = hash(clean);
    const homeId = ids[seed % ids.length];
    const pool = GUEST_NOTES[language] || GUEST_NOTES['es-MX'];
    next = withVote(next, homeId, clean, 'up');
    next = withComment(next, homeId, clean, pool[(seed >>> 4) % pool.length], now - (1 + (seed >>> 8) % 5) * 3600000);
  }
  return {folder:next, added:true};
}

export function withoutGuest(folder, email) {
  const board = readBoard(folder);
  const feedback = {};
  for (const [id, entry] of Object.entries(board.feedback)) {
    const {[email]:_vote, ...votes} = entry.votes;
    const {[email]:_note, ...notes} = entry.notes;
    feedback[id] = {votes, notes};
  }
  return writeBoard(folder, {...board, guests:board.guests.filter(guest => guest.email !== email), feedback});
}

export function stageName(stage, labels, say) {
  return labels?.[stage.id] || say(stage.es, stage.br);
}

/** Next column in either direction. The last column wraps back to the first. */
export function adjacentStage(stageId, direction) {
  const index = BOARD_STAGES.findIndex(stage => stage.id === stageId);
  if (index < 0) return '';
  const step = direction < 0 ? -1 : 1;
  return BOARD_STAGES[(index + step + BOARD_STAGES.length) % BOARD_STAGES.length].id;
}
