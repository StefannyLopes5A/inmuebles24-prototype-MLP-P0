import React, {useId} from 'react';
import {useIsPresent} from 'motion/react';
import {Icon} from './App';
import {InlineLogin} from './Account';
import {MemberAvatar, reactionLabel, useSay} from './Collaboration';
import {ModalShell} from './ModalShell';
import {REACTIONS} from './collaborativeLists';
import {homes, listingPrice, propertyPhoto} from './data';
import {unitHomeById} from './development/torreOlmo.js';
import {useLanguage} from './i18n';
import {prototypeResults} from './journey';

const lookup = id => homes.find(home => home.id === id) || unitHomeById(id);
const homesOf = record => (record?.homeIds || []).map(lookup).filter(Boolean);
const departments = (count, say) => count === 1 ? say('1 departamento', '1 apartamento') : say(`${count} departamentos`, `${count} apartamentos`);

/** Reactions take one tap and no account; the latest one counts. */
export function ReactionButtons({value, onReact, label}) {
  const {say} = useSay();
  return <div className="invite-reactions" role="group" aria-label={label}>
    {REACTIONS.map(kind => <button key={kind} type="button" className="reaction-chip" data-kind={kind} aria-pressed={value === kind} onClick={() => onReact(kind)}>
      {value === kind && <Icon name="check" size={14}/>}{reactionLabel(kind, say)}
    </button>)}
  </div>;
}

/** The sender's context on top of the listing: name and avatar only, never an email or a phone. */
export function InviteBanner({record, sender, reaction, joined, onReact, onJoin, onOpenList}) {
  const {say} = useSay();
  if (!record) return <section className="invite-banner is-expired" aria-label={say('Invitación', 'Convite')}>
    <p className="invite-banner-title">{say('Esta invitación ya no está activa. Puedes ver el inmueble igual.', 'Este convite não está mais ativo. Você pode ver o imóvel mesmo assim.')}</p>
  </section>;
  const name = sender?.name || say('Alguien', 'Alguém');
  return <section className="invite-banner" aria-label={say('Invitación', 'Convite')}>
    <div className="invite-banner-who">
      <MemberAvatar name={sender?.name} size={44}/>
      <div className="invite-banner-copy">
        <p className="invite-banner-title">{say(`${name} quiere tu opinión sobre este depa`, `${name} quer sua opinião sobre este apê`)}</p>
        <button type="button" className="invite-banner-list" onClick={onOpenList}>
          {say(`Lista de ${name}`, `Lista de ${name}`)} · {departments(record.homeIds.length, say)}<Icon name="chevron" size={14}/>
        </button>
      </div>
      {!joined && <button type="button" className="folder-text-button invite-banner-join" onClick={onJoin}>{say('Unirme a la lista', 'Entrar na lista')}</button>}
    </div>
    <div className="invite-reaction-dock">
      <p className="invite-reaction-label">{reaction ? say(`Le contaste a ${name}: ${reactionLabel(reaction, say)}`, `Você contou para ${name}: ${reactionLabel(reaction, say)}`) : say('¿Qué te parece?', 'O que você acha?')}</p>
      <ReactionButtons value={reaction} onReact={onReact} label={say('Tu reacción', 'Sua reação')}/>
    </div>
  </section>;
}

/** A withdrawn listing keeps the sender's banner and offers close alternatives. */
export function InviteUnavailable({search, onOpen}) {
  const {say} = useSay();
  const {money, currency} = useLanguage();
  const similar = prototypeResults(search).slice(0, 3);
  return <article className="invite-unavailable">
    <h1>{say('Este inmueble ya no está disponible', 'Este imóvel não está mais disponível')}</h1>
    <p>{say('El anunciante lo retiró. Estos se le parecen:', 'O anunciante o retirou. Estes se parecem:')}</p>
    <ul className="invite-similar">
      {similar.map(home => <li key={home.id}>
        <button type="button" onClick={() => onOpen(home)}>
          <img src={propertyPhoto(home)} alt=""/>
          <span className="folder-card-name">{home.street}, {home.area}</span>
          <span className="folder-card-meta">{money(listingPrice(home))} {currency}</span>
        </button>
      </li>)}
    </ul>
  </article>;
}

/** Sign-in after a guest's first reaction, or to become a member from a folder invite. */
export function JoinDialog({reason, record, sender, onSignIn, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  const name = sender?.name || say('Quien te invitó', 'Quem te convidou');
  const react = reason === 'react';
  return <ModalShell labelledBy={titleId} panelKey="join" panelClassName="account-panel is-nudge" onClose={onClose}>
    <InlineLogin titleId={titleId} homes={homesOf(record).slice(0, 3)}
      title={react ? say('Entra para ver toda la lista y agregar tus propias opciones.', 'Entre para ver a lista toda e adicionar suas próprias opções.') : say(`Unirme a "${record.name}"`, `Entrar em "${record.name}"`)}
      text={react ? say(`Tu reacción ya le llegó a ${name}.`, `Sua reação já chegou para ${name}.`) : say(`${name} te invitó. Entra para reaccionar, anotar y agregar inmuebles.`, `${name} te convidou. Entre para reagir, anotar e adicionar imóveis.`)}
      cancelLabel={react ? say('Seguir viendo', 'Continuar vendo') : say('Ahora no', 'Agora não')}
      onSignIn={onSignIn} onCancel={onClose}/>
  </ModalShell>;
}

export function ConfirmDialog({title, text, action, onConfirm, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  const present = useIsPresent();
  return <ModalShell labelledBy={titleId} panelClassName="confirm-panel" onClose={onClose}>{close => <>
    <div className="confirm-body">
      <h2 id={titleId}>{title}</h2>
      <p>{text}</p>
    </div>
    <footer className="folder-panel-footer is-split">
      <button type="button" className="folder-text-button" onClick={close} autoFocus data-autofocus>{say('Cancelar', 'Cancelar')}</button>
      <button type="button" className="folder-primary is-danger" onClick={() => present && onConfirm()}>{action}</button>
    </footer>
  </>}</ModalShell>;
}
