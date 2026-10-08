import React, {useId, useState} from 'react';
import {AnimatePresence, motion, useIsPresent, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {LoginNudge} from './Account';
import {FavoriteHeart} from './FavoriteHeart';
import {ModalShell} from './ModalShell';
import {homes, propertyPhoto} from './data';
import {useLanguage} from './i18n';
import {FOLDER_NAME_MAX, RECENT_ID, savedCountLabel, viewedLabel} from './favoriteLists';
import {EASE, EASE_OUT, riseIn} from './favoriteMotion';

const homesById = new Map(homes.map(home => [home.id, home]));
const homesFor = ids => ids.map(id => homesById.get(id)).filter(Boolean);

function useSay() {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  return {language, say:(es, br) => pt ? br : es};
}

export function FolderCover({ids, collage = false}) {
  const list = homesFor(ids);
  if (collage && list.length > 1) {
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

/** Folder choice; on the third save the same dialog shrinks into the sign-in invite. */
export function FolderPicker({home, folders, suggestion, nudge, onSelect, onCreate, onClose, onLogin, onDismissNudge}) {
  const {language, say} = useSay();
  const titleId = useId();
  const present = useIsPresent();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(folders.length ? 'select' : 'create');
  const [direction, setDirection] = useState(1);
  const [returned, setReturned] = useState(false);
  const [name, setName] = useState(suggestion);

  const go = next => {setDirection(next === 'create' ? 1 : -1); setReturned(next === 'select'); setStep(next);};
  const trimmed = name.trim();
  const variants = stepVariants(reduce);

  if (nudge) return <ModalShell key="shell" labelledBy={`${titleId}-nudge`} panelKey="nudge" panelClassName="account-panel is-nudge" onClose={onDismissNudge}>
    <LoginNudge titleId={`${titleId}-nudge`} homes={nudge.homes} onLogin={onLogin} onDismiss={onDismissNudge}/>
  </ModalShell>;

  return <ModalShell key="shell" labelledBy={titleId} panelKey="picker" onClose={onClose}>{close =>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div key={step} className="folder-step" custom={direction} variants={variants}
          initial="enter" animate="center" exit="exit" transition={{duration:0.18, ease:EASE_OUT}}>
          {step === 'select' ? <>
            <header className="folder-panel-header">
              <span aria-hidden="true"/>
              <h2 id={titleId}>{say('Guardar en favoritos', 'Salve nos favoritos')}</h2>
              <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
            </header>
            <div className="folder-panel-body">
              <ul className="folder-picker-grid">
                {folders.map((folder, index) => {
                  const current = folder.homeIds.includes(home.id);
                  return <motion.li key={folder.id} {...riseIn(reduce, index)}>
                    <button type="button" className="folder-card" aria-pressed={current} onClick={() => present && onSelect(folder.id)}
                      aria-label={current ? `${say('Quitar de', 'Remover de')} ${folder.name}` : `${say('Guardar en', 'Salvar em')} ${folder.name}`}>
                      <span className="folder-card-media">
                        <FolderCover ids={folder.homeIds}/>
                        {current && <span className="folder-card-current"><Icon name="check" size={13}/>{say('Guardado aquí', 'Salvo aqui')}</span>}
                      </span>
                      <span className="folder-card-name">{folder.name}</span>
                      <span className="folder-card-meta">{savedCountLabel(folder.homeIds.length, language)}</span>
                    </button>
                  </motion.li>;
                })}
              </ul>
            </div>
            <footer className="folder-panel-footer">
              <button type="button" className="folder-primary is-wide" onClick={() => go('create')} autoFocus={returned} data-autofocus={returned || undefined}>
                {say('Crear nueva lista de favoritos', 'Criar nova lista de favoritos')}
              </button>
            </footer>
          </> : <form className="folder-create" onSubmit={event => {event.preventDefault(); if (trimmed && present) onCreate(trimmed);}}>
            <header className="folder-panel-header">
              {folders.length
                ? <button type="button" className="folder-icon-button" onClick={() => go('select')} aria-label={say('Volver a tus listas', 'Voltar para suas listas')}><Icon name="back" size={18}/></button>
                : <span aria-hidden="true"/>}
              <h2 id={titleId}>{say('Crear lista de favoritos', 'Criar lista de favoritos')}</h2>
              {folders.length
                ? <span aria-hidden="true"/>
                : <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>}
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
              <button type="button" className="folder-text-button" onClick={folders.length ? () => go('select') : close}>{say('Cancelar', 'Cancelar')}</button>
              <button type="submit" className="folder-primary" disabled={!trimmed}>{say('Crear', 'Criar')}</button>
            </footer>
          </form>}
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

export function FavoritesIndex({folders, recent, onOpenFolder, onBack}) {
  const {language, say} = useSay();
  const reduce = useReducedMotion();
  const title = useRef(null);
  useLayoutEffect(() => {title.current?.focus({preventScroll:true});}, []);
  const latest = recent[0]?.viewedAt;
  const cards = [
    ...(recent.length ? [{id:RECENT_ID, name:say('Vistos recientemente', 'Vistos recentemente'), ids:recent.map(entry => entry.id), collage:true, meta:viewedLabel(latest, Date.now(), language)}] : []),
    ...folders.map(folder => ({id:folder.id, name:folder.name, ids:folder.homeIds, collage:false, meta:savedCountLabel(folder.homeIds.length, language)})),
  ];
  return <article className="favorites-page">
    <header className="favorites-header">
      <button className="compare-back" type="button" onClick={onBack} aria-label={say('Volver a la búsqueda', 'Voltar à busca')}><Icon name="back" size={20}/></button>
      <motion.h1 ref={title} tabIndex={-1} {...riseIn(reduce, 0, 6)}>{say('Favoritos', 'Favoritos')}</motion.h1>
    </header>
    {cards.length ? <ul className="favorites-grid">
      {cards.map((card, index) => <motion.li key={card.id} {...riseIn(reduce, index + 1)}>
        <button type="button" className="favorites-card" onClick={() => onOpenFolder(card.id)}>
          <span className="favorites-card-media"><FolderCover ids={card.ids} collage={card.collage}/></span>
          <span className="folder-card-name">{card.name}</span>
          <span className="folder-card-meta">{card.meta}</span>
        </button>
      </motion.li>)}
    </ul> : <motion.div className="favorites-empty" {...riseIn(reduce, 1)}>
      <h2>{say('Crea tu primera lista', 'Crie sua primeira lista')}</h2>
      <p>{say('Toca el corazón de un inmueble para guardarlo en una lista. Lo que abras aparece en Vistos recientemente.', 'Toque no coração de um imóvel para salvá-lo em uma lista. O que você abrir aparece em Vistos recentemente.')}</p>
    </motion.div>}
  </article>;
}
