import React, {useEffect, useId, useRef, useState} from 'react';
import {AnimatePresence, motion, useIsPresent, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {propertyPhoto} from './data';
import {useLanguage} from './i18n';
import {ModalShell} from './ModalShell';
import {EASE, EASE_OUT} from './favoriteMotion';

export const AVATAR_SRC = '/assets/account/avatar.png';

function useSay() {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  return (es, br) => pt ? br : es;
}

// Left, center, right; the newest save sits in front.
const FAN = [{x:-56, rotate:-8, z:1}, {x:0, rotate:0, z:3}, {x:56, rotate:8, z:2}];

function fanOrder(homes) {
  const [newest, ...rest] = homes;
  if (!newest) return [];
  return rest.length > 1 ? [rest[0], newest, rest[1]] : rest.length ? [rest[0], newest] : [newest];
}

/** The third-save fan: up to three photos, the newest in front. */
export function NudgeFan({homes}) {
  const reduce = useReducedMotion();
  const order = fanOrder(homes);
  const slots = order.length === 3 ? FAN : order.length === 2 ? [{x:-32, rotate:-6, z:1}, {x:32, rotate:6, z:2}] : [FAN[1]];
  return <div className="nudge-fan" aria-hidden="true">
    {order.map((home, index) => {
      const slot = slots[index];
      return <motion.img key={home.id} className="nudge-photo" src={propertyPhoto(home)} alt="" style={{zIndex:slot.z}}
        initial={reduce ? {opacity:0} : {opacity:0, transform:'translateX(0px) rotate(0deg) scale(0.9)'}}
        animate={{opacity:1, transform:`translateX(${slot.x}px) rotate(${slot.rotate}deg) scale(1)`}}
        transition={reduce ? {duration:0.2, ease:EASE_OUT} : {
          transform:{type:'spring', duration:0.5, bounce:0.2, delay:0.12 + index * 0.06},
          opacity:{duration:0.2, ease:EASE_OUT, delay:0.12},
        }}/>;
    })}
  </div>;
}

export function LoginNudge({titleId, homes, onLogin, onDismiss}) {
  const say = useSay();
  const present = useIsPresent();

  return <div className="account-nudge">
    <button type="button" className="folder-icon-button account-close" onClick={() => present && onDismiss()} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
    <NudgeFan homes={homes}/>
    <h2 id={titleId}>{say('No pierdas tus favoritos', 'Não perca seus favoritos')}</h2>
    <p>{say('Inicia sesión para mantener tus listas guardadas y verlas desde cualquier dispositivo.', 'Entre na sua conta para manter suas listas salvas e encontrá-las em qualquer dispositivo.')}</p>
    <button type="button" className="folder-primary is-wide account-cta" onClick={() => present && onLogin()} autoFocus data-autofocus>{say('Iniciar sesión', 'Fazer login')}</button>
    <button type="button" className="folder-text-button account-skip" onClick={() => present && onDismiss()}>{say('Ignorar', 'Ignorar')}</button>
  </div>;
}

const GoogleMark = () => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z"/>
  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"/>
  <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z"/>
  <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"/>
</svg>;

const AppleMark = () => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#000" d="M16.37 12.73c-.03-2.6 2.12-3.85 2.22-3.91a4.78 4.78 0 0 0-3.76-2.03c-1.6-.16-3.12.94-3.93.94-.82 0-2.06-.92-3.39-.9a5.02 5.02 0 0 0-4.25 2.58c-1.81 3.14-.46 7.79 1.3 10.34.87 1.25 1.9 2.65 3.24 2.6 1.3-.05 1.8-.84 3.37-.84 1.57 0 2.02.84 3.4.81 1.4-.02 2.29-1.27 3.14-2.53a11.1 11.1 0 0 0 1.43-2.93 4.52 4.52 0 0 1-2.77-4.13ZM13.8 5.1A4.5 4.5 0 0 0 14.86 1.8a4.6 4.6 0 0 0-3 1.55 4.3 4.3 0 0 0-1.08 3.16 3.8 3.8 0 0 0 3.02-1.41Z"/>
</svg>;

export const WhatsAppMark = ({size = 22}) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  <path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Z"/>
  <path fill="#fff" d="M16.9 14.4c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z"/>
</svg>;

/**
 * Sign-in inside another dialog, dressed as the third-save invite. Google, Apple or a WhatsApp code all sign in;
 * nothing typed is kept or sent.
 */
export function InlineLogin({titleId, homes = [], title, text, cancelLabel, onSignIn, onCancel}) {
  const say = useSay();
  const present = useIsPresent();
  const [code, setCode] = useState(null);
  const signIn = () => {if (present) onSignIn();};
  return <div className="account-nudge account-inline">
    {homes.length > 0 && <NudgeFan homes={homes}/>}
    <h2 id={titleId}>{title}</h2>
    {text && <p>{text}</p>}
    {code === null ? <div className="account-inline-actions">
      <button type="button" className="account-inline-provider" onClick={signIn} autoFocus data-autofocus><GoogleMark/>{say('Continuar con Google', 'Continuar com Google')}</button>
      <button type="button" className="account-inline-provider" onClick={signIn}><AppleMark/>{say('Continuar con Apple', 'Continuar com Apple')}</button>
      <button type="button" className="account-inline-provider" onClick={() => setCode('')}><WhatsAppMark/>{say('Recibir código por WhatsApp', 'Receber código pelo WhatsApp')}</button>
    </div> : <form className="account-inline-code" onSubmit={event => {event.preventDefault(); if (code.length === 4) signIn();}}>
      <label htmlFor={`${titleId}-code`}>{say('Escribe el código de 4 dígitos que te enviamos por WhatsApp', 'Digite o código de 4 dígitos que enviamos pelo WhatsApp')}</label>
      <input id={`${titleId}-code`} inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={code} placeholder="0000" autoFocus
        onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}/>
      <button type="submit" className="folder-primary is-wide" disabled={code.length !== 4}>{say('Entrar', 'Entrar')}</button>
      <button type="button" className="folder-text-button account-skip" onClick={() => setCode(null)}>{say('Usar otra opción', 'Usar outra opção')}</button>
    </form>}
    <p className="account-note">{say('Inicio de sesión simulado: no se envía ningún dato ni código.', 'Login simulado: nenhum dado ou código é enviado.')}</p>
    <button type="button" className="folder-text-button account-skip" onClick={() => present && onCancel()}>{cancelLabel || say('Ahora no', 'Agora não')}</button>
  </div>;
}

/** Simulated sign-in: every action signs in and nothing typed is kept or sent. */
export function LoginDialog({onSignIn, onClose}) {
  const say = useSay();
  const titleId = useId();
  const present = useIsPresent();
  const signIn = () => {if (present) onSignIn();};

  return <ModalShell labelledBy={titleId} panelClassName="account-panel" onClose={onClose}>{close =>
    <form className="account-login" onSubmit={event => {event.preventDefault(); signIn();}}>
      <button type="button" className="folder-icon-button account-close" onClick={close} aria-label={say('Cerrar', 'Fechar')}><Icon name="close" size={16}/></button>
      <img className="account-logo" src="/assets/figma-home/d0d59.svg" alt="Inmuebles24"/>
      <h2 id={titleId}>{say('Inicia sesión o regístrate', 'Entrar ou cadastrar-se')}</h2>
      <label className="account-field">
        <span className="sr-only">{say('Teléfono o correo electrónico', 'Telefone ou e-mail')}</span>
        <input type="text" inputMode="email" autoComplete="off" spellCheck={false} placeholder={say('Teléfono o correo electrónico', 'Telefone ou e-mail')} autoFocus data-autofocus/>
      </label>
      <button type="submit" className="account-continue">{say('Continuar', 'Continuar')}</button>
      <div className="account-divider" role="separator"><span>{say('o', 'ou')}</span></div>
      <div className="account-providers">
        <button type="button" className="account-provider" onClick={signIn} aria-label={say('Continuar con Google', 'Continuar com Google')}><GoogleMark/></button>
        <button type="button" className="account-provider" onClick={signIn} aria-label={say('Continuar con Apple', 'Continuar com Apple')}><AppleMark/></button>
      </div>
      <p className="account-note">{say('Inicio de sesión simulado: no se envía ningún dato.', 'Login simulado: nenhum dado é enviado.')}</p>
    </form>}
  </ModalShell>;
}

/** Shares the folder toast's card, motion and timing. */
export function AccountToast({text, onHold, onRelease}) {
  const reduce = useReducedMotion();
  const hidden = reduce ? {opacity:0} : {opacity:0, transform:'translateY(calc(100% + 24px))'};
  return <div className="folder-toast-layer">
    <motion.div className="folder-toast is-account" role="status" initial={hidden} animate={{opacity:1, transform:'translateY(0px)'}} exit={hidden}
      transition={{duration:reduce ? 0.2 : 0.4, ease:EASE}} onPointerEnter={onHold} onPointerLeave={onRelease}>
      <img className="folder-toast-photo account-toast-avatar" src={AVATAR_SRC} alt=""/>
      <p className="folder-toast-text">{text}</p>
    </motion.div>
  </div>;
}

const MENU = [
  [{id:'favorites', icon:'heart', es:'Favoritos', br:'Favoritos'}, {id:'messages', icon:'message', es:'Mensajes', br:'Mensagens'}, {id:'profile', icon:'user', es:'Perfil', br:'Perfil'}, {id:'notifications', icon:'bell', es:'Notificaciones', br:'Notificações'}],
  [{id:'settings', icon:'settings', es:'Configuración de la cuenta', br:'Configurações da conta'}, {id:'help', icon:'help', es:'Centro de ayuda', br:'Central de ajuda'}],
  [{id:'logout', icon:'logout', es:'Cerrar sesión', br:'Sair da conta'}],
];

export function AccountMenu({onSelect}) {
  const say = useSay();
  const reduce = useReducedMotion();
  const menuId = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const [open, setOpen] = useState(false);

  const items = () => [...(menu.current?.querySelectorAll('[role="menuitem"]') || [])];
  const dismiss = (refocus = true) => {setOpen(false); if (refocus) trigger.current?.focus();};

  useEffect(() => {
    if (!open) return undefined;
    items()[0]?.focus();
    const outside = event => {if (!root.current?.contains(event.target)) setOpen(false);};
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const onKeyDown = event => {
    const list = items();
    const index = list.indexOf(document.activeElement);
    const move = next => {event.preventDefault(); list[(next + list.length) % list.length]?.focus();};
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); dismiss();}
    else if (event.key === 'Tab') setOpen(false);
  };

  const hidden = reduce ? {opacity:0} : {opacity:0, transform:'scale(0.95)'};

  return <div className="account-menu-root" ref={root}>
    <button ref={trigger} type="button" className="account-avatar" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      aria-label={say('Menú de la cuenta', 'Menu da conta')} onClick={() => setOpen(value => !value)}
      onKeyDown={event => {if (event.key === 'ArrowDown' && !open) {event.preventDefault(); setOpen(true);}}}>
      <img src={AVATAR_SRC} alt=""/>
    </button>
    <AnimatePresence>
      {open && <motion.div ref={menu} id={menuId} role="menu" aria-label={say('Cuenta', 'Conta')} className="account-menu" onKeyDown={onKeyDown}
        initial={hidden} animate={{opacity:1, transform:'scale(1)'}} exit={hidden} transition={{duration:reduce ? 0.15 : 0.18, ease:EASE_OUT}}>
        {MENU.map((group, groupIndex) => <React.Fragment key={groupIndex}>
          {groupIndex > 0 && <div className="account-menu-divider" role="separator"/>}
          {group.map(item => <button key={item.id} type="button" role="menuitem" tabIndex={-1} className="account-menu-item"
            onClick={() => {dismiss(item.id !== 'favorites'); onSelect(item.id);}}>
            <Icon name={item.icon} size={20}/>{say(item.es, item.br)}
          </button>)}
        </React.Fragment>)}
      </motion.div>}
    </AnimatePresence>
  </div>;
}
