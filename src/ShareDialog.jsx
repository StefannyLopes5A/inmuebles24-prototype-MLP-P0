import React, {useId, useState} from 'react';
import {Icon} from './App';
import {WhatsAppMark} from './Account';
import {propertyPhoto} from './data';
import {ModalShell} from './ModalShell';

const LinkIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>;
const MoreIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>;

const canShareNatively = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Share only the listing link: copy, WhatsApp and the system sheet when the browser has one. */
export function ShareDialog({home, url, title, price, say, onClose}) {
  const titleId = useId();
  const [copied, setCopied] = useState(false);
  const text = say(`Olha este imóvel! ${url}`, `¡Mira este inmueble! ${url}`);
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
  return <ModalShell labelledBy={titleId} panelClassName="share-panel" onClose={onClose}>{close => <>
    <header className="folder-panel-header">
      <span aria-hidden="true"/>
      <h2 id={titleId}>{say('Compartilhar', 'Compartir')}</h2>
      <button type="button" className="folder-icon-button" onClick={close} aria-label={say('Fechar', 'Cerrar')}><Icon name="close" size={16}/></button>
    </header>
    <div className="folder-panel-body share-menu">
      <div className="share-head">
        <img src={propertyPhoto(home)} alt=""/>
        <div><p className="share-head-title">{title}</p><p className="share-head-price">{price}</p></div>
      </div>
      <div className="share-grid">
        <button type="button" className="share-channel" onClick={copy} data-autofocus><LinkIcon/>{copied ? say('Link copiado', 'Enlace copiado') : say('Copiar link', 'Copiar enlace')}</button>
        <button type="button" className="share-channel" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')}><WhatsAppMark size={22}/>WhatsApp</button>
        {canShareNatively() && <button type="button" className="share-channel" onClick={() => navigator.share({text, url}).catch(() => {})}><MoreIcon/>{say('Mais opções', 'Más opciones')}</button>}
      </div>
      <span className="sr-only" role="status">{copied ? say('Link copiado', 'Enlace copiado') : ''}</span>
    </div>
  </>}</ModalShell>;
}
