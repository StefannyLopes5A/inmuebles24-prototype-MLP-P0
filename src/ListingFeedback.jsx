import React, {useId, useState} from 'react';
import {AnimatePresence} from 'motion/react';
import {Icon} from './App';
import {ModalShell} from './ModalShell';
import {MemberAvatar, useSay} from './Collaboration';
import {SELF, feedbackFor, guestName} from './boardModel';

const NOTE_LIMIT = 140;

const Thumb = ({down = false, size = 18}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
  style={down ? {transform:'scaleY(-1)'} : undefined}><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v3h5.2a2 2 0 0 1 2 2.3l-1.2 7a2 2 0 0 1-2 1.7H7"/></svg>;

function ago(at, say) {
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60000));
  if (minutes < 60) return say(`Há ${minutes} min`, `Hace ${minutes} min`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return say(`Há ${hours} h`, `Hace ${hours} h`);
  const days = Math.round(hours / 24);
  return say(`Há ${days} d`, `Hace ${days} d`);
}

function NoteDialog({street, mine, onSave, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  const [value, setValue] = useState(mine || '');
  const clean = value.replace(/\s+/g, ' ').trim();
  return <ModalShell labelledBy={titleId} onClose={onClose}>{close =>
    <form className="folder-create" onSubmit={event => {event.preventDefault(); if (clean) {onSave(clean); close();}}}>
      <header className="folder-panel-header">
        <span aria-hidden="true"/>
        <h2 id={titleId}>{mine ? say('Editar nota', 'Editar nota') : say('Agregar nota', 'Adicionar nota')}</h2>
        <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
      </header>
      <div className="folder-create-body">
        <div className="folder-name-field">
          <label htmlFor={`${titleId}-note`}>{street}</label>
          <textarea id={`${titleId}-note`} rows={4} value={value} maxLength={NOTE_LIMIT} placeholder={say('Ej. Me encanta la luz', 'Ex. Adoro a luz')}
            onChange={event => setValue(event.target.value)} autoFocus data-autofocus/>
        </div>
        <p className="folder-count">{value.length}/{NOTE_LIMIT} {say('caracteres', 'caracteres')}</p>
      </div>
      <footer className="folder-panel-footer is-split">
        {mine
          ? <button type="button" className="folder-text-button" onClick={() => {onSave(''); close();}}>{say('Quitar nota', 'Remover nota')}</button>
          : <button type="button" className="folder-text-button" onClick={close}>{say('Cancelar', 'Cancelar')}</button>}
        <button type="submit" className="folder-primary" disabled={!clean}>{say('Guardar', 'Salvar')}</button>
      </footer>
    </form>}
  </ModalShell>;
}

/** "Agregar nota" under a card: it opens a dialog instead of growing the card. */
export function NoteTrigger({street, mine, onSave}) {
  const {say} = useSay();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="folder-note-add" onClick={() => setOpen(true)}>
      {mine ? say('Editar mi nota', 'Editar minha nota') : say('Agregar nota', 'Adicionar nota')}
    </button>
    <AnimatePresence>{open && <NoteDialog key="note" street={street} mine={mine} onSave={onSave} onClose={() => setOpen(false)}/>}</AnimatePresence>
  </>;
}

/**
 * Under each card of the list view: a vote and one note per person. Everything stays in the folder on this device;
 * a person added to the list answers with a simulated vote and note (see `withGuest`), nothing is sent.
 */
export function ListingFeedback({home, board, me, onVote, onComment}) {
  const {say} = useSay();
  const feedback = feedbackFor(board, home.id);
  const count = feedback.notes.length;
  const nameOf = actor => actor === SELF ? say('Tú', 'Você') : guestName(actor);
  const mine = feedback.notes.find(note => note.actor === SELF)?.text;
  const vote = (kind, label, active) => <button type="button" className="folder-vote" aria-pressed={feedback.mine === kind} aria-label={`${label}: ${active}`} onClick={() => onVote(home.id, kind)}>
    <Thumb down={kind === 'down'}/><span>{active}</span>
  </button>;
  return <div className="folder-feedback">
    <div className="folder-feedback-head">
      <span className="folder-feedback-count" aria-live="polite">{count ? say(`${count} ${count === 1 ? 'nota' : 'notas'}`, `${count} ${count === 1 ? 'nota' : 'notas'}`) : say('Sem notas', 'Sin notas')}</span>
      <div className="folder-votes" role="group" aria-label={`${say('Tu voto para', 'Seu voto para')} ${home.street}`}>
        {vote('up', say('Me gusta', 'Gostei'), feedback.up)}
        {vote('down', say('No me convence', 'Não me convence'), feedback.down)}
      </div>
    </div>
    {count > 0 && <ul className="folder-feedback-notes" aria-label={say('Notas', 'Notas')}>
      {feedback.notes.map(note => <li key={note.actor}>
        <span className="folder-feedback-face">
          <MemberAvatar name={note.actor === SELF ? (me?.name || 'Tú') : nameOf(note.actor)} self={note.actor === SELF} size={36}/>
          {feedback.votes[note.actor] && <span className="folder-feedback-vote" aria-hidden="true"><Thumb down={feedback.votes[note.actor] === 'down'} size={10}/></span>}
        </span>
        <div><p><b>{nameOf(note.actor)}</b>{note.at > 0 && <small> · {ago(note.at, say)}</small>}</p><p>{note.text}</p></div>
      </li>)}
    </ul>}
    <NoteTrigger street={home.street} mine={mine} onSave={text => onComment(home.id, text)}/>
  </div>;
}
