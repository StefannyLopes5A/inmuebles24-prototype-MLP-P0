import React, {useId, useLayoutEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useIsPresent, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {LoginNudge} from './Account';
import {FavoriteHeart} from './FavoriteHeart';
import {ModalShell} from './ModalShell';
import {homes, propertyPhoto} from './data';
import {UNIT_HOMES} from './development/torreOlmo.js';
import {useLanguage} from './i18n';
import {FOLDER_NAME_MAX, RECENT_ID, savedCountLabel, viewedLabel} from './favoriteLists';
import {activeMembers, isCollaborative} from './collaborativeLists';
import {AvatarStack} from './Collaboration';
import {EASE, EASE_OUT, riseIn} from './favoriteMotion';
import {IconButton} from './IconButton.jsx';

const homesById = new Map([...homes, ...UNIT_HOMES].map(home => [home.id, home]));
const homesFor = ids => ids.map(id => homesById.get(id)).filter(Boolean);

function useSay() {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  return {language, say:(es, br) => pt ? br : es};
}

export function FolderCover({ids}) {
  const list = homesFor(ids);
  if (list.length > 1) {
    return <span className="folder-cover is-collage">
      {[0, 1, 2, 3].map(index => list[index]
        ? <img key={list[index].id} src={propertyPhoto(list[index])} alt="" loading="lazy"/>
        : <span key={`empty-${index}`} className="folder-cover-cell"/>)}
    </span>;
  }
  if (list[0]) return <span className="folder-cover"><img src={propertyPhoto(list[0])} alt="" loading="lazy"/></span>;
  return <span className="folder-cover is-empty"><FavoriteHeart/></span>;
}

const stepVariants = reduce => ({
  enter:direction => reduce ? {opacity:0} : {opacity:0, transform:`translateX(${direction * 24}px)`},
  center:{opacity:1, transform:'translateX(0px)'},
  exit:direction => reduce ? {opacity:0} : {opacity:0, transform:`translateX(${direction * -24}px)`},
});

/**
 * The folder grid shared by the heart and by "Decidir juntos". `pressed` marks a card; `badge` adds a corner mark
 * (the members' faces on a shared folder).
 */
export function FolderCardList({folders, pressed, onChoose, labelFor, badge}) {
  const {language, say} = useSay();
  const present = useIsPresent();
  const reduce = useReducedMotion();
  return <ul className="folder-picker-grid">
    {folders.map((folder, index) => {
      const on = pressed(folder);
      return <motion.li key={folder.id} {...riseIn(reduce, index)}>
        <button type="button" className="folder-card" aria-pressed={!!on} onClick={() => present && onChoose(folder.id)} aria-label={labelFor(folder, on)}>
          <span className="folder-card-media">
            <FolderCover ids={folder.homeIds}/>
            {on.label && <span className="folder-card-current"><Icon name="check" size={13}/>{on.label}</span>}
            {badge?.(folder)}
          </span>
          <span className="folder-card-name">{folder.name}</span>
          <span className="folder-card-meta">{savedCountLabel(folder.homeIds.length, language)}</span>
        </button>
      </motion.li>;
    })}
  </ul>;
}

/** Name a new list: header, field with the 50-character count, Cancel and Create. */
export function CreateFolderForm({titleId, suggestion, onCreate, onBack, onClose}) {
  const {say} = useSay();
  const present = useIsPresent();
  const [name, setName] = useState(suggestion);
  const trimmed = name.trim();
  return <form className="folder-create" onSubmit={event => {event.preventDefault(); if (trimmed && present) onCreate(trimmed);}}>
    <header className="folder-panel-header">
      {onBack
        ? <button type="button" className="folder-icon-button" onClick={onBack} aria-label={say('Volver a tus listas', 'Voltar para suas listas')}><Icon name="back" size={18}/></button>
        : <span aria-hidden="true"/>}
      <h2 id={titleId}>{say('Crear lista de favoritos', 'Criar lista de favoritos')}</h2>
      {onBack
        ? <span aria-hidden="true"/>
        : <button type="button" className="folder-icon-button" onClick={onClose} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>}
    </header>
    <div className="folder-create-body">
      <div className="folder-name-field">
        <label htmlFor={`${titleId}-name`}>{say('Nombre', 'Nome')}</label>
        <input id={`${titleId}-name`} value={name} maxLength={FOLDER_NAME_MAX} autoComplete="off" spellCheck={false}
          onChange={event => setName(event.target.value.slice(0, FOLDER_NAME_MAX))}
          onFocus={event => {const end = event.target.value.length; event.target.setSelectionRange(end, end);}}
          aria-describedby={`${titleId}-count`} autoFocus data-autofocus/>
        {name && <button type="button" className="folder-clear" onClick={event => {setName(''); event.currentTarget.parentElement.querySelector('input')?.focus();}} aria-label={say('Borrar nombre', 'Limpar nome')}><Icon name="close" size={12}/></button>}
      </div>
      <p id={`${titleId}-count`} className="folder-count">{say(`${name.length}/${FOLDER_NAME_MAX} caracteres`, `${name.length}/${FOLDER_NAME_MAX} caracteres`)}</p>
    </div>
    <footer className="folder-panel-footer is-split">
      <button type="button" className="folder-text-button" onClick={onBack || onClose}>{say('Cancelar', 'Cancelar')}</button>
      <button type="submit" className="folder-primary" disabled={!trimmed}>{say('Crear', 'Criar')}</button>
    </footer>
  </form>;
}

export const stepMotion = (reduce, direction) => ({custom:direction, variants:stepVariants(reduce), initial:'enter', animate:'center', exit:'exit', transition:{duration:0.18, ease:EASE_OUT}});

/** Folder choice; on the third save the same dialog shrinks into the sign-in invite. */
export function FolderPicker({home, folders, suggestion, nudge, onSelect, onCreate, onClose, onLogin, onDismissNudge}) {
  const {say} = useSay();
  const titleId = useId();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(folders.length ? 'select' : 'create');
  const [direction, setDirection] = useState(1);
  const [returned, setReturned] = useState(false);

  const go = next => {setDirection(next === 'create' ? 1 : -1); setReturned(next === 'select'); setStep(next);};

  if (nudge) return <ModalShell key="shell" labelledBy={`${titleId}-nudge`} panelKey="nudge" panelClassName="account-panel is-nudge" onClose={onDismissNudge}>
    <LoginNudge titleId={`${titleId}-nudge`} homes={nudge.homes} onLogin={onLogin} onDismiss={onDismissNudge}/>
  </ModalShell>;

  return <ModalShell key="shell" labelledBy={titleId} panelKey="picker" onClose={onClose}>{close =>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div key={step} className="folder-step" {...stepMotion(reduce, direction)}>
          {step === 'select' ? <>
            <header className="folder-panel-header">
              <span aria-hidden="true"/>
              <h2 id={titleId}>{say('Guardar en favoritos', 'Salve nos favoritos')}</h2>
              <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
            </header>
            <div className="folder-panel-body">
              <FolderCardList folders={folders} onChoose={onSelect}
                pressed={folder => folder.homeIds.includes(home.id) ? {label:say('Guardado aquí', 'Salvo aqui')} : false}
                labelFor={(folder, on) => on ? `${say('Quitar de', 'Remover de')} ${folder.name}` : `${say('Guardar en', 'Salvar em')} ${folder.name}`}/>
            </div>
            <footer className="folder-panel-footer">
              <button type="button" className="folder-primary is-wide" onClick={() => go('create')} autoFocus={returned} data-autofocus={returned || undefined}>
                {say('Crear nueva lista de favoritos', 'Criar nova lista de favoritos')}
              </button>
            </footer>
          </> : <CreateFolderForm titleId={titleId} suggestion={suggestion} onCreate={onCreate} onBack={folders.length ? () => go('select') : null} onClose={close}/>}
        </motion.div>
      </AnimatePresence>}
  </ModalShell>;
}

/** Same key across consecutive saves so the card retargets instead of replaying its entrance. */
export function FolderToast({home, folder, removed = false, onChange, onView, onUndo, onHold, onRelease}) {
  const {say} = useSay();
  const reduce = useReducedMotion();
  const hidden = reduce ? {opacity:0} : {opacity:0, transform:'translateY(calc(100% + 24px))'};
  return <div className="folder-toast-layer">
    <motion.div className="folder-toast" role="status" initial={hidden} animate={{opacity:1, transform:'translateY(0px)'}} exit={hidden}
      transition={{duration:reduce ? 0.2 : 0.4, ease:EASE}}
      onPointerEnter={onHold} onPointerLeave={onRelease} onFocus={onHold} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) onRelease();}}>
      <img className="folder-toast-photo" src={propertyPhoto(home)} alt=""/>
      <p className="folder-toast-text">{removed ? say('Se quitó de', 'Removido de') : say('Guardado en', 'Salvo em')} <b>{folder.name}</b></p>
      <div className="folder-toast-actions">
        {removed
          ? <button type="button" className="folder-toast-change" onClick={onUndo}>{say('Deshacer', 'Desfazer')}</button>
          : <>
            <button type="button" className="folder-toast-link" onClick={onView}>{say('Ver carpeta', 'Ver pasta')}</button>
            <button type="button" className="folder-toast-change" onClick={onChange}>{say('Cambiar', 'Alterar')}</button>
          </>}
      </div>
    </motion.div>
  </div>;
}

export function FavoritesIndex({folders, recent, shared = {}, meId = null, suggestion = '', onOpenFolder, onCreate, onBack}) {
  const {language, say} = useSay();
  const reduce = useReducedMotion();
  const title = useRef(null);
  const titleId = useId();
  const [creating, setCreating] = useState(false);
  useLayoutEffect(() => {title.current?.focus({preventScroll:true});}, []);
  const latest = recent[0]?.viewedAt;
  // Faces only on a folder shared with someone else: they are the sign that the folder is collaborative.
  const facesOf = folder => folder.collab && meId && isCollaborative(shared[folder.id]) ? activeMembers(shared[folder.id]) : null;
  const cards = [
    ...(recent.length ? [{id:RECENT_ID, name:say('Vistos recientemente', 'Vistos recentemente'), ids:recent.map(entry => entry.id), meta:viewedLabel(latest, Date.now(), language)}] : []),
    ...folders.map(folder => ({id:folder.id, name:folder.name, ids:folder.homeIds, meta:savedCountLabel(folder.homeIds.length, language), faces:facesOf(folder)})),
  ];
  return <article className="favorites-page">
    <header className="favorites-header">
      <IconButton icon="back" className="compare-back" onClick={onBack} label={say('Volver a la búsqueda', 'Voltar à busca')}/>
      <div className="favorites-heading">
        <motion.h1 ref={title} tabIndex={-1} {...riseIn(reduce, 0, 6)}>{say('Favoritos', 'Favoritos')}</motion.h1>
        <motion.button type="button" className="folder-chip favorites-new" onClick={() => setCreating(true)} {...riseIn(reduce, 1, 6)}>
          <span aria-hidden="true">+</span>{say('Nueva lista', 'Nova lista')}
        </motion.button>
      </div>
    </header>
    {cards.length ? <ul className="favorites-grid">
      {cards.map((card, index) => <motion.li key={card.id} {...riseIn(reduce, index + 1)}>
        <button type="button" className="favorites-card" onClick={() => onOpenFolder(card.id)}>
          <span className="favorites-card-media"><FolderCover ids={card.ids}/>
            {card.faces && <span className="folder-card-faces"><AvatarStack members={card.faces} size={30} label={`${say('Compartida con', 'Compartilhada com')} ${card.faces.map(member => member.name).join(', ')}`}/></span>}
          </span>
          <span className="folder-card-name">{card.name}</span>
          <span className="folder-card-meta">{card.meta}</span>
        </button>
      </motion.li>)}
    </ul> : <motion.div className="favorites-empty" {...riseIn(reduce, 1)}>
      <h2>{say('Crea tu primera lista', 'Crie sua primeira lista')}</h2>
      <p>{say('Toca el corazón de un inmueble para guardarlo en una lista, o crea una lista vacía con Nueva lista. Lo que abras aparece en Vistos recientemente.', 'Toque no coração de um imóvel para salvá-lo em uma lista, ou crie uma lista vazia com Nova lista. O que você abrir aparece em Vistos recentemente.')}</p>
    </motion.div>}
    <AnimatePresence>
      {creating && <ModalShell key="new-list" labelledBy={titleId} onClose={() => setCreating(false)}>{close =>
        <CreateFolderForm titleId={titleId} suggestion={suggestion} onCreate={name => {onCreate?.(name); close();}} onClose={close}/>
      }</ModalShell>}
    </AnimatePresence>
  </article>;
}
