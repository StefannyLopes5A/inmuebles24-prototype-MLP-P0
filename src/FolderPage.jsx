import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {InlineLogin} from './Account';
import {MemberAvatar, MembersChip, reactionLabel, useSay} from './Collaboration';
import {HouseCard} from './Home';
import {FolderBoard} from './FolderBoard.jsx';
import {ModalShell} from './ModalShell';
import {ReactionButtons} from './InviteLayer';
import {FOLDER_NAME_MAX, cleanFolderName, savedCountLabel} from './favoriteLists';
import {BOARD_STAGES, cleanGuestEmail, stageName} from './boardModel';
import {NOTE_MAX, activeMembers, can, isCollaborative, notesFor, reactionsFor} from './collaborativeLists';
import {EASE_OUT, riseIn} from './favoriteMotion';

const MoreIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>;
const ShareIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>;

/** Menu button with arrow keys and Escape, the account menu's behavior. */
function FolderMenu({items, menuClass = ''}) {
  const {say} = useSay();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null), menu = useRef(null);
  const menuId = useId();
  const list = () => [...(menu.current?.querySelectorAll('[role="menuitem"]') || [])];
  const dismiss = (refocus = true) => {setOpen(false); if (refocus) trigger.current?.focus();};
  useEffect(() => {
    if (!open) return undefined;
    list()[0]?.focus();
    const outside = event => {if (!root.current?.contains(event.target)) setOpen(false);};
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const onKeyDown = event => {
    const all = list(), index = all.indexOf(document.activeElement);
    const move = next => {event.preventDefault(); all[(next + all.length) % all.length]?.focus();};
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); dismiss();}
    else if (event.key === 'Tab') setOpen(false);
  };
  if (!items.length) return null;
  const hidden = reduce ? {opacity:0} : {opacity:0, transform:'scale(0.95)'};
  return <div className="folder-menu-root" ref={root}>
    <button ref={trigger} type="button" className="compare-back folder-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-label={say('Opciones de la lista', 'Opções da lista')} onClick={() => setOpen(value => !value)}><MoreIcon/></button>
    <AnimatePresence>
      {open && <motion.div ref={menu} id={menuId} role="menu" className={`account-menu folder-menu${menuClass ? ` ${menuClass}` : ''}`} onKeyDown={onKeyDown}
        initial={hidden} animate={{opacity:1, transform:'scale(1)'}} exit={hidden} transition={{duration:reduce ? 0.15 : 0.18, ease:EASE_OUT}}>
        {items.map(item => <button key={item.id} type="button" role="menuitem" tabIndex={-1} className="account-menu-item" data-danger={item.danger || undefined}
          onClick={() => {dismiss(false); item.run();}}>{item.label}</button>)}
      </motion.div>}
    </AnimatePresence>
  </div>;
}

function RenameDialog({name, onSave, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  const [value, setValue] = useState(name);
  const clean = cleanFolderName(value);
  return <ModalShell labelledBy={titleId} onClose={onClose}>{close =>
    <form className="folder-create" onSubmit={event => {event.preventDefault(); if (clean) {onSave(clean); close();}}}>
      <header className="folder-panel-header">
        <span aria-hidden="true"/>
        <h2 id={titleId}>{say('Renombrar lista', 'Renomear lista')}</h2>
        <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
      </header>
      <div className="folder-create-body">
        <div className="folder-name-field">
          <label htmlFor={`${titleId}-name`}>{say('Nombre', 'Nome')}</label>
          <input id={`${titleId}-name`} value={value} maxLength={FOLDER_NAME_MAX} autoComplete="off" onChange={event => setValue(event.target.value)} autoFocus data-autofocus/>
        </div>
        <p className="folder-count">{value.length}/{FOLDER_NAME_MAX} {say('caracteres', 'caracteres')}</p>
      </div>
      <footer className="folder-panel-footer is-split">
        <button type="button" className="folder-text-button" onClick={close}>{say('Cancelar', 'Cancelar')}</button>
        <button type="submit" className="folder-primary" disabled={!clean}>{say('Guardar', 'Salvar')}</button>
      </footer>
    </form>}
  </ModalShell>;
}

/** Who is in the list, with the invite one tap below; the owner can take someone out. */
function MembersDialog({name, members, meId, canRemove, onRemove, onInvite, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  return <ModalShell labelledBy={titleId} panelClassName="members-panel" onClose={onClose}>{close => <>
    <header className="folder-panel-header members-panel-head">
      <span aria-hidden="true"/>
      <h2 id={titleId}>{name}</h2>
      <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
    </header>
    <ul className="folder-members-list">
      {members.map(member => <li key={member.id}>
        <MemberAvatar name={member.name} self={member.self} size={48}/>
        <span><b>{member.id === meId ? say('Tú', 'Você') : member.name}</b><small>{member.role === 'owner' ? say('Dueño de la lista', 'Dono da lista') : say('Miembro', 'Membro')}</small></span>
        {member.id !== meId && canRemove && <button type="button" className="folder-text-button" onClick={() => onRemove(member.id)}>{say('Quitar', 'Remover')}</button>}
      </li>)}
    </ul>
    <div className="members-panel-actions">
      <button type="button" className="folder-primary is-wide" onClick={() => {close(); onInvite();}} autoFocus data-autofocus>{say('Invitar a otras personas', 'Convidar outras pessoas')}</button>
    </div>
  </>}</ModalShell>;
}

function NoteField({homeId, mine, onSave}) {
  const {say} = useSay();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mine || '');
  const fieldId = useId();
  if (!editing) return <button type="button" className="folder-note-add" onClick={() => {setValue(mine || ''); setEditing(true);}}>
    {mine ? say('Editar mi nota', 'Editar minha nota') : say('Agregar nota', 'Adicionar nota')}
  </button>;
  return <form className="folder-note-form" onSubmit={event => {event.preventDefault(); onSave(homeId, value); setEditing(false);}}>
    <label htmlFor={fieldId} className="sr-only">{say('Tu nota', 'Sua nota')}</label>
    <input id={fieldId} value={value} maxLength={NOTE_MAX} placeholder={say('Ej. Me encanta la luz', 'Ex. Adoro a luz')} autoFocus
      onChange={event => setValue(event.target.value)} onKeyDown={event => {if (event.key === 'Escape') {event.stopPropagation(); setEditing(false);}}}/>
    <button type="submit" className="folder-primary">{say('Guardar', 'Salvar')}</button>
  </form>;
}

const SHARE_HINT_KEY = 'inmuebles24-v2-share-hint-seen';
const readHintSeen = () => {try {return sessionStorage.getItem(SHARE_HINT_KEY) === '1';} catch {return false;}};

/** Without an account the people chip becomes the invitation to share, with a balloon saying what it is for. */
function ShareFavorites({onClick}) {
  const {say} = useSay();
  const reduce = useReducedMotion();
  const hintId = useId();
  const [hidden, setHidden] = useState(readHintSeen);
  const hide = () => {setHidden(true); try {sessionStorage.setItem(SHARE_HINT_KEY, '1');} catch {}};
  return <span className="share-favorites">
    <button type="button" className="folder-chip share-favorites-chip" onClick={() => {hide(); onClick();}} aria-describedby={hidden ? undefined : hintId}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      {say('Compartir favoritos', 'Compartilhar favoritos')}
    </button>
    <AnimatePresence>
      {!hidden && <motion.span key="hint" id={hintId} role="note" className="share-favorites-hint"
        initial={reduce ? {opacity:0} : {opacity:0, transform:'translateY(-4px)'}} animate={reduce ? {opacity:1} : {opacity:1, transform:'translateY(0px)'}}
        exit={{opacity:0, transition:{duration:0.12}}} transition={{duration:0.22, ease:EASE_OUT, delay:reduce ? 0 : 0.35}}>
        <span>{say('Comparte tus favoritos con otras personas para que te ayuden a decidir juntos tu próximo inmueble.', 'Compartilhe os seus favoritos com outras pessoas para te ajudar a decidir junto o seu próximo imóvel.')}</span>
        <button type="button" className="share-favorites-hint-close" onClick={hide} aria-label={say('Cerrar sugerencia', 'Fechar dica')}><Icon name="close" size={12}/></button>
      </motion.span>}
    </AnimatePresence>
  </span>;
}

/** Reactions and notes under the card, only in a list shared with someone. */
function CollabStrip({home, record, meId, onReact, onNote}) {
  const {say} = useSay();
  const reactions = reactionsFor(record, home.id);
  const notes = notesFor(record, home.id);
  const mine = reactions.find(item => item.actor === meId)?.kind || null;
  return <div className="folder-collab">
    <ReactionButtons value={mine} onReact={kind => onReact(home.id, kind)} label={`${say('Tu reacción a', 'Sua reação a')} ${home.street}`}/>
    {reactions.length > 0 && <ul className="folder-reactions" aria-label={say('Reacciones', 'Reações')}>
      {reactions.map(item => <li key={item.actor}>
        <MemberAvatar name={item.name} left={item.left} self={item.actor === meId} size={22} title={item.name || say('Invitado', 'Convidado')}/>
        <span>{item.actor === meId ? say('Tú', 'Você') : item.name || say('Invitado', 'Convidado')}: {reactionLabel(item.kind, say)}</span>
      </li>)}
    </ul>}
    {notes.length > 0 && <ul className="folder-notes" aria-label={say('Notas', 'Notas')}>
      {notes.map(note => <li key={note.member}><MemberAvatar name={note.name} left={note.left} self={note.member === meId} size={22}/><span><b>{note.member === meId ? say('Tú', 'Você') : note.name}</b> {note.text}</span></li>)}
    </ul>}
    <NoteField homeId={home.id} mine={notes.find(note => note.member === meId)?.text} onSave={onNote}/>
  </div>;
}

/**
 * A favorites folder: the members chip (faces in a pill that grows, invite one tap away), the comparison and
 * the list menu under the title, and the listings with the same card as the results. In a shared list each card
 * carries reactions and one note per member. The invite preview shows the listings behind "Unirme a la lista".
 */
function BoardMembersDialog({name, guests, onAdd, onRemove, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const clean = cleanGuestEmail(email);
  function submit(event) {
    event.preventDefault();
    if (!clean) return;
    const added = onAdd(clean);
    if (!added) {setError(say('Esa persona ya está en la lista.', 'Essa pessoa já está na lista.')); return;}
    setEmail('');
    setError('');
  }
  return <ModalShell labelledBy={titleId} onClose={onClose}>{close =>
    <form onSubmit={submit}>
      <header className="folder-panel-header">
        <span aria-hidden="true"/>
        <h2 id={titleId}>{name}</h2>
        <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
      </header>
      <div className="board-members">
        <div className="board-member">
          <MemberAvatar name="Tú" self size={48}/>
          <span><b>{say('Tú', 'Você')}</b><small>{say('Propietario de la lista', 'Proprietário da lista')}</small></span>
        </div>
        {guests.map(guest => <div className="board-member" key={guest.email}>
          <MemberAvatar name={guest.email.split('@')[0]} size={48}/>
          <span><b>{guest.email}</b><small>{say('Invitado', 'Convidado')}</small></span>
          <button type="button" className="folder-text-button" onClick={() => onRemove(guest.email)}>{say('Quitar', 'Remover')}</button>
        </div>)}
        <label className="board-email">
          <span>{say('Correo electrónico', 'E-mail')}</span>
          <input type="email" inputMode="email" autoComplete="off" maxLength={80} placeholder="correo@ejemplo.com" value={email}
            onChange={event => {setEmail(event.target.value); setError('');}} autoFocus data-autofocus/>
        </label>
        <p className="board-note">{error || say('Solo en esta sesión. No se envía ninguna invitación.', 'Só nesta sessão. Nenhum convite é enviado.')}</p>
      </div>
      <footer className="folder-panel-footer is-split">
        <button type="button" className="folder-text-button" onClick={close}>{say('Cerrar', 'Fechar')}</button>
        <button type="submit" className="folder-primary board-add" disabled={!clean}>{say('Agregar', 'Adicionar')}</button>
      </footer>
    </form>}
  </ModalShell>;
}

function StagesDialog({labels, onSave, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  const [values, setValues] = useState(() => Object.fromEntries(BOARD_STAGES.map(stage => [stage.id, labels[stage.id] || say(stage.es, stage.br)])));
  const ready = BOARD_STAGES.every(stage => values[stage.id].trim());
  return <ModalShell labelledBy={titleId} onClose={onClose}>{close =>
    <form onSubmit={event => {event.preventDefault(); if (ready) {onSave(values); close();}}}>
      <header className="folder-panel-header">
        <span aria-hidden="true"/>
        <h2 id={titleId}>{say('Editar etapas', 'Editar etapas')}</h2>
        <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
      </header>
      <div className="folder-create-body board-stages">
        {BOARD_STAGES.map(stage => <label key={stage.id}>{stageName(stage, {}, say)}
          <input value={values[stage.id]} maxLength={28} onChange={event => setValues(current => ({...current, [stage.id]:event.target.value}))}/>
        </label>)}
      </div>
      <footer className="folder-panel-footer is-split">
        <button type="button" className="folder-text-button" onClick={close}>{say('Cancelar', 'Cancelar')}</button>
        <button type="submit" className="folder-primary" disabled={!ready}>{say('Guardar', 'Salvar')}</button>
      </footer>
    </form>}
  </ModalShell>;
}

export function FolderPage({mode, name, homes, board = {stages:{}, labels:{}, guests:[]}, record, meId, me, sender, search, saved = [], receipts = [], onLike, onBack, onOpen, onCompare, onExplore, onInvite, onReact, onNote,
  onRename, onLeave, onRemoveMember, onRevoke, onDelete, onCopy, onDismiss, onJoin, onLogin, onMove, onStages, onAddGuest, onRemoveGuest, onShare, onDuplicate}) {
  const {language, say} = useSay();
  const reduce = useReducedMotion();
  const heading = useRef(null);
  const [dialog, setDialog] = useState(null);
  useLayoutEffect(() => {heading.current?.focus({preventScroll:true});}, []);
  const shared = isCollaborative(record);
  const owner = !record || can(record, meId, 'rename');
  const members = (record ? activeMembers(record) : me ? [{id:me.id, name:me.name, role:'owner'}] : []).map(member => ({...member, self:member.id === meId}));
  const inviter = sender?.name || say('Alguien', 'Alguém');
  const chipLabel = members.length > 1
    ? `${say('Personas en la lista', 'Pessoas na lista')}: ${members.map(member => member.id === meId ? say('tú', 'você') : member.name).join(', ')}`
    : say('Invitar a esta lista', 'Convidar para esta lista');

  const items = mode !== 'member' ? [] : [
    {id:'people', label:say('Ver miembros', 'Ver membros'), run:() => setDialog('members')},
    ...(owner ? [
      {id:'stages', label:say('Editar etapas', 'Editar etapas'), run:() => setDialog('stages')},
      {id:'rename', label:say('Editar nombre', 'Editar nome'), run:() => setDialog('rename')},
      {id:'duplicate', label:say('Duplicar lista', 'Duplicar lista'), run:onDuplicate},
    ] : []),
    ...(record?.inviteToken && owner ? [{id:'revoke', label:say('Desactivar enlace de invitación', 'Desativar link de convite'), run:onRevoke}] : []),
    ...(record && can(record, meId, 'leave') ? [{id:'leave', label:say('Salir de la lista', 'Sair da lista'), run:onLeave, danger:true}] : []),
    ...(owner ? [{id:'delete', label:say('Eliminar lista', 'Excluir lista'), run:onDelete, danger:true}] : []),
  ];
  const guestCount = board.guests.length;
  const peopleLabel = guestCount
    ? say(`Ver miembros, ${guestCount} ${guestCount === 1 ? 'invitado' : 'invitados'}`, `Ver membros, ${guestCount} ${guestCount === 1 ? 'convidado' : 'convidados'}`)
    : say('Agregar o ver miembros', 'Adicionar ou ver membros');

  const header = mode === 'member'
    ? <header className="favorites-header folder-page-header board-header">
      <button className="compare-back" type="button" onClick={onBack} aria-label={say('Volver a favoritos', 'Voltar para favoritos')}><Icon name="back" size={20}/></button>
      <div className="board-title-row">
        <motion.h1 ref={heading} tabIndex={-1} {...riseIn(reduce, 0, 6)}>{name || say('Lista de favoritos', 'Lista de favoritos')}</motion.h1>
        <div className="board-views" role="group" aria-label={say('Vista de la lista', 'Visualização da lista')}>
          <button type="button" aria-pressed="true">{say('Tablero', 'Quadro')}</button>
          <button type="button" aria-pressed="false" onClick={onCompare}>{say('Comparar', 'Comparar')}</button>
        </div>
      </div>
      <div className="board-tools">
        <button type="button" className="board-people" onClick={() => setDialog('members')} aria-label={peopleLabel}>
          <MemberAvatar name={me?.name || 'Tú'} self size={36}/>
          {board.guests.slice(0, 2).map(guest => <MemberAvatar key={guest.email} name={guest.email.split('@')[0]} size={36}/>)}
          <span className="board-people-plus" aria-hidden="true">+</span>
        </button>
        <button type="button" className="board-icon compare-back" onClick={onShare} aria-label={say('Compartir enlace de la vista', 'Compartilhar link da visualização')}><ShareIcon/></button>
        <FolderMenu items={items} menuClass="board-menu"/>
      </div>
    </header>
    : <header className="favorites-header folder-page-header">
    <div className="folder-page-top">
      <button className="compare-back" type="button" onClick={onBack} aria-label={say('Volver a favoritos', 'Voltar para favoritos')}><Icon name="back" size={20}/></button>
      {mode === 'member' && <FolderMenu items={items}/>}
    </div>
    <motion.div {...riseIn(reduce, 0, 6)}>
      {mode === 'preview' && <p className="folder-page-eyebrow"><MemberAvatar name={sender?.name} size={24}/>{say(`${inviter} te invitó a su lista`, `${inviter} te convidou para a lista`)}</p>}
      <h1 ref={heading} tabIndex={-1}>{name || say('Lista de favoritos', 'Lista de favoritos')}</h1>
      {mode !== 'missing' && <p className="compare-folder-meta">{savedCountLabel(homes.length, language)}</p>}
    </motion.div>
    {mode === 'member' && <motion.div className="folder-toolbar" {...riseIn(reduce, 1, 6)}>
      {me ? <MembersChip members={members} label={chipLabel} onClick={() => setDialog('members')}/> : <ShareFavorites onClick={onInvite}/>}
      {homes.length > 0 && <button type="button" className="folder-chip" onClick={onCompare}>{say('Comparar favoritos', 'Comparar favoritos')}</button>}
    </motion.div>}
  </header>;

  let body;
  if (mode === 'gate') body = <div className="folder-gate">
    <InlineLogin titleId="folder-gate-title" homes={homes.slice(0, 3)} title={say('Entra para ver la lista compartida', 'Entre para ver a lista compartilhada')}
      text={say('Las reacciones y notas de la lista se ven con tu cuenta.', 'As reações e notas da lista aparecem com sua conta.')} cancelLabel={say('Volver', 'Voltar')} onSignIn={onLogin} onCancel={onBack}/>
  </div>;
  else if (mode === 'missing') body = <div className="favorites-empty folder-page-notice">
    <h2>{say('Esta invitación ya no está activa', 'Este convite não está mais ativo')}</h2>
    <p>{say('Quien te invitó desactivó el enlace o eliminó la lista. Pídele uno nuevo.', 'Quem te convidou desativou o link ou excluiu a lista. Peça um novo.')}</p>
  </div>;
  else if (mode === 'member') body = <FolderBoard homes={homes} board={board} receipts={receipts} search={search} saved={saved} onLike={onLike} onOpen={onOpen} onMove={onMove}/>;
  else if (mode === 'deleted') body = <div className="favorites-empty folder-page-notice">
    <h2>{say('Esta lista fue eliminada', 'Esta lista foi excluída')}</h2>
    <p>{say('Su dueño la eliminó. Puedes guardar una copia con los inmuebles para seguir viéndolos.', 'O dono a excluiu. Você pode guardar uma cópia com os imóveis para continuar vendo.')}</p>
    <div className="folder-page-notice-actions">
      <button type="button" className="folder-primary" onClick={onCopy}>{say('Hacer una copia', 'Fazer uma cópia')}</button>
      <button type="button" className="folder-text-button" onClick={onDismiss}>{say('Quitar de mis favoritos', 'Remover dos meus favoritos')}</button>
    </div>
  </div>;
  else if (!homes.length) body = <motion.div className="favorites-empty" {...riseIn(reduce, 1)}>
    <h2>{say('Aún no hay inmuebles', 'Ainda não há imóveis')}</h2>
    <p>{say('Guarda inmuebles con el corazón y aparecerán aquí.', 'Salve imóveis com o coração e eles aparecem aqui.')}</p>
    {mode === 'member' && <button type="button" className="folder-chip folder-explore" onClick={onExplore}>{say('Explorar inmuebles', 'Explorar imóveis')}</button>}
  </motion.div>;
  else body = <div className="folder-grid">
    {homes.map((home, index) => <motion.div key={home.id} className="folder-grid-item" {...riseIn(reduce, Math.min(index + 1, 8))}>
      <HouseCard home={home} search={search} saved={saved.includes(home.id)} contacted={receipts.some(receipt => receipt.propertyId === home.id)} onLike={onLike} onOpen={onOpen}/>
      {shared && mode === 'member' && can(record, meId, 'react') && <CollabStrip home={home} record={record} meId={meId} onReact={onReact} onNote={onNote}/>}
    </motion.div>)}
  </div>;

  return <article className="favorites-page folder-page" data-mode={mode}>
    {header}
    {body}
    {mode === 'preview' && <div className="folder-join-bar">
      <p>{say(`Únete para reaccionar, anotar y agregar inmuebles con ${inviter}.`, `Entre para reagir, anotar e adicionar imóveis com ${inviter}.`)}</p>
      <button type="button" className="folder-primary" onClick={onJoin}>{say('Unirme a la lista', 'Entrar na lista')}</button>
    </div>}
    <AnimatePresence>
      {dialog === 'rename' && <RenameDialog key="rename" name={name} onSave={onRename} onClose={() => setDialog(null)}/>}
      {dialog === 'stages' && <StagesDialog key="stages" labels={board.labels} onSave={onStages} onClose={() => setDialog(null)}/>}
      {dialog === 'members' && mode === 'member' && <BoardMembersDialog key="board-members" name={name} guests={board.guests} onAdd={onAddGuest} onRemove={onRemoveGuest} onClose={() => setDialog(null)}/>}
      {dialog === 'members' && mode !== 'member' && <MembersDialog key="members" name={name} members={members} meId={meId} canRemove={!!record && can(record, meId, 'removeMember')}
        onRemove={onRemoveMember} onInvite={onInvite} onClose={() => setDialog(null)}/>}
    </AnimatePresence>
  </article>;
}
