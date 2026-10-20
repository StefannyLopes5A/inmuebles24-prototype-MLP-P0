import React, {useId, useState} from 'react';
import {AnimatePresence, motion, useIsPresent, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {InlineLogin, WhatsAppMark} from './Account';
import {AvatarStack, useSay} from './Collaboration';
import {CreateFolderForm, FolderCardList, stepMotion} from './FavoriteFolders';
import {ModalShell} from './ModalShell';
import {activeMembers, isCollaborative} from './collaborativeLists';
import {listingPrice, propertyPhoto} from './data';
import {useLanguage} from './i18n';

const PeopleIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 19.5V21M13.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M20 21v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.15a3.5 3.5 0 0 1 0 6.7"/>
</svg>;
const LinkIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>
</svg>;
const MoreIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
</svg>;

const canShareNatively = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
const withLink = (text, url) => text.includes(url) ? text : `${text.trim()} ${url}`;
/** Opens WhatsApp with the text typed here; the person still chooses who gets it and presses send there. */
export const openWhatsApp = text => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async text => {
    try {await navigator.clipboard.writeText(text); setCopied(true);} catch {setCopied(false);}
  };
  return [copied, copy];
}

/** Two-column grid of share buttons; the link is always one tap away. */
function ShareChannels({text, url, onSent, autoFocus = false}) {
  const {say} = useSay();
  const [copied, copy] = useCopy();
  return <div className="share-grid">
    <button type="button" className="share-channel" onClick={() => copy(url)} autoFocus={autoFocus} data-autofocus={autoFocus || undefined}>
      <LinkIcon/>{copied ? say('Enlace copiado', 'Link copiado') : say('Copiar enlace', 'Copiar link')}
    </button>
    <button type="button" className="share-channel" onClick={() => {openWhatsApp(text); onSent?.('whatsapp');}}><WhatsAppMark size={22}/>WhatsApp</button>
    {canShareNatively() && <button type="button" className="share-channel" onClick={() => navigator.share({text, url}).then(() => onSent?.('native'), () => {})}><MoreIcon/>{say('Más opciones', 'Mais opções')}</button>}
    <span className="sr-only" role="status">{copied ? say('Enlace copiado', 'Link copiado') : ''}</span>
  </div>;
}

/**
 * Invite to a list: what is being shared (photo, name, count), the channels, and who can see it.
 * Shared by "Decidir juntos" and the folder's members chip.
 */
export function InviteStep({titleId, title, cover, summary, note, message, url, onSent, onDone, onClose, onBack}) {
  const {say} = useSay();
  return <div className="invite-modal">
    <header className="invite-modal-head">
      {onBack && <button type="button" className="folder-icon-button" onClick={onBack} aria-label={say('Volver', 'Voltar')}><Icon name="back" size={18}/></button>}
      <button type="button" className="folder-icon-button invite-modal-close" onClick={onClose} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
      <h2 id={titleId}>{title}</h2>
    </header>
    <div className="invite-modal-body">
      {note}
      <div className="invite-summary">
        {cover ? <img src={propertyPhoto(cover)} alt=""/> : <span className="invite-summary-empty" aria-hidden="true"/>}
        <p>{summary}</p>
      </div>
      <ShareChannels text={withLink(message, url)} url={url} onSent={onSent} autoFocus/>
      <p className="invite-footnote">{say('Quien reciba este enlace podrá ver la lista y unirse con su cuenta. Puedes desactivarlo cuando quieras.', 'Quem receber este link pode ver a lista e entrar com a própria conta. Você pode desativá-lo quando quiser.')}</p>
    </div>
    {onDone && <footer className="folder-panel-footer">
      <button type="button" className="folder-primary is-wide" onClick={onDone}>{say('Listo', 'Pronto')}</button>
    </footer>}
  </div>;
}

const savedLabel = (count, say) => count === 1 ? say('1 inmueble guardado', '1 imóvel salvo') : say(`${count} inmuebles guardados`, `${count} imóveis salvos`);

/** "Invitar a otras personas" from the members chip: an invite to be a member of the list. */
export function InviteDialog({folderName, cover, count, url, onSent, onClose}) {
  const {say} = useSay();
  const titleId = useId();
  return <ModalShell labelledBy={titleId} panelClassName="invite-panel" onClose={onClose}>{close =>
    <InviteStep titleId={titleId} title={say('Invita a otras personas a decidir contigo', 'Convide outras pessoas para decidir com você')} url={url} onSent={onSent} onClose={close}
      cover={cover} summary={say(`Únete a mi lista de favoritos: ${folderName} · ${savedLabel(count, say)}`, `Entre na minha lista de favoritos: ${folderName} · ${savedLabel(count, say)}`)}
      message={say(`Te invito a mi lista "${folderName}" en Inmuebles24 para que veamos opciones juntos.`, `Te convido para a minha lista "${folderName}" no Inmuebles24 para vermos opções juntos.`)}/>}
  </ModalShell>;
}

/**
 * Share sheet: the simple link stays one tap away without an account; "Decidir juntos" asks for sign-in inline,
 * then the folder (same grid as the heart), then the invite. The dialog never closes between steps.
 */
export function ShareSheet({home, signedIn, folders, shared, lastFolderId, suggestion, publicUrl, onSignIn, onSave, onSent, onClose}) {
  const {say} = useSay();
  const {money, currency} = useLanguage();
  const titleId = useId();
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const [step, setStep] = useState('menu');
  const [direction, setDirection] = useState(1);
  const [chosen, setChosen] = useState(() => folders.find(folder => folder.id === lastFolderId)?.id || folders[0]?.id || null);
  const [saved, setSaved] = useState(null);
  const go = (next, back = false) => {setDirection(back ? -1 : 1); setStep(next);};
  const toFolders = () => go(folders.length ? 'folder' : 'create');
  const save = request => {if (!present) return; const result = onSave(request); if (result) {setSaved(result); go('invite');}};
  const price = listingPrice(home);
  const title = `${home.street}, ${home.area}`;
  const facesFor = folder => {
    const record = shared[folder.id];
    return isCollaborative(record) ? activeMembers(record) : null;
  };

  if (step === 'login') return <ModalShell key="shell" labelledBy={`${titleId}-login`} panelKey="login" panelClassName="account-panel is-nudge" onClose={onClose}>
    <InlineLogin titleId={`${titleId}-login`} homes={[home]} title={say('Entra para crear tu lista compartida', 'Entre para criar sua lista compartilhada')}
      text={say('Te avisaremos cuando reaccionen y si baja el precio.', 'Avisamos quando reagirem e se o preço baixar.')}
      onSignIn={() => {onSignIn(); toFolders();}} onCancel={() => go('menu', true)}/>
  </ModalShell>;

  return <ModalShell key="shell" labelledBy={titleId} panelKey="sheet" panelClassName="share-panel" onClose={onClose}>{close =>
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div key={step} className="folder-step" {...stepMotion(reduce, direction)}>
        {step === 'menu' && <>
          <header className="folder-panel-header">
            <span aria-hidden="true"/>
            <h2 id={titleId}>{say('Compartir', 'Compartilhar')}</h2>
            <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
          </header>
          <div className="folder-panel-body share-menu">
            <div className="share-head">
              <img src={propertyPhoto(home)} alt=""/>
              <div><p className="share-head-title">{title}</p><p className="share-head-price">{money(price)} {currency}{home.mode === 'rent' ? say(' / mes', ' / mês') : ''}</p></div>
            </div>
            <button type="button" className="share-together" onClick={() => signedIn ? toFolders() : go('login')} autoFocus data-autofocus>
              <span className="share-together-icon"><PeopleIcon/></span>
              <span className="share-together-text">
                <b>{say('Decidir juntos', 'Decidir juntos')}</b>
                <span>{say('Guarda este depa en una lista compartida. Vean, reaccionen y comparen opciones en un solo lugar.', 'Salve este apê numa lista compartilhada. Vejam, reajam e comparem opções num só lugar.')}</span>
              </span>
              <Icon name="chevron" size={18}/>
            </button>
            <p className="share-or">{say('O comparte solo el enlace', 'Ou compartilhe só o link')}</p>
            <ShareChannels text={say(`¡Mira este depa! ${publicUrl}`, `Olha este apê! ${publicUrl}`)} url={publicUrl}/>
          </div>
        </>}
        {step === 'folder' && <>
          <header className="folder-panel-header">
            <button type="button" className="folder-icon-button" onClick={() => go('menu', true)} aria-label={say('Volver', 'Voltar')}><Icon name="back" size={18}/></button>
            <h2 id={titleId}>{say('¿En qué lista lo guardas?', 'Em qual lista salvar?')}</h2>
            <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
          </header>
          <div className="folder-panel-body">
            <FolderCardList folders={folders} onChoose={setChosen}
              pressed={folder => folder.id === chosen ? {label:folder.homeIds.includes(home.id) ? say('Ya está aquí', 'Já está aqui') : say('Elegida', 'Escolhida')} : false}
              labelFor={folder => `${say('Elegir', 'Escolher')} ${folder.name}${facesFor(folder) ? `, ${say('compartida con', 'compartilhada com')} ${facesFor(folder).map(member => member.name).join(', ')}` : ''}`}
              badge={folder => facesFor(folder) && <span className="folder-card-faces"><AvatarStack members={facesFor(folder)} size={26}/></span>}/>
          </div>
          <footer className="folder-panel-footer is-split">
            <button type="button" className="folder-text-button" onClick={() => go('create')}>{say('Nueva lista', 'Nova lista')}</button>
            <button type="button" className="folder-primary" disabled={!chosen} onClick={() => save({folderId:chosen})}>{say('Continuar', 'Continuar')}</button>
          </footer>
        </>}
        {step === 'create' && <CreateFolderForm titleId={titleId} suggestion={suggestion} onCreate={name => save({name})}
          onBack={() => go(folders.length ? 'folder' : 'menu', true)} onClose={close}/>}
        {step === 'invite' && saved && <InviteStep titleId={titleId} url={saved.url} onClose={close}
          title={saved.others.length ? say('Ya está en la lista', 'Já está na lista') : say('Invita a otras personas a decidir contigo', 'Convide outras pessoas para decidir com você')}
          cover={home} summary={say(`¿Qué te parece este depa? Está en mi lista ${saved.folder.name} · ${savedLabel(saved.folder.homeIds.length, say)}`, `O que você acha deste apê? Está na minha lista ${saved.folder.name} · ${savedLabel(saved.folder.homeIds.length, say)}`)}
          message={say('¡Mira este depa! ¿Qué te parece?', 'Olha este apê! O que você acha?')}
          note={<p className="share-saved">{saved.others.length
            ? say(`Guardado en ${saved.folder.name}. ${saved.others.join(', ')} ya lo ven y les avisamos. Invitar a alguien más es opcional.`, `Salvo em ${saved.folder.name}. ${saved.others.join(', ')} já veem e avisamos. Convidar mais alguém é opcional.`)
            : say(`Guardado en ${saved.folder.name}. Envía la invitación para que opinen.`, `Salvo em ${saved.folder.name}. Envie o convite para que opinem.`)}</p>}
          onSent={channel => onSent(saved, channel)} onDone={() => onSent(saved, null)}/>}
      </motion.div>
    </AnimatePresence>}
  </ModalShell>;
}
