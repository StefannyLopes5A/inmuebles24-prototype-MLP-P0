import React, {useState} from 'react';

const Phone = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>;
const WHATSAPP = "M22 11.7427C22 17.1231 17.6044 21.4848 12.181 21.4848C10.4599 21.4848 8.84319 21.0446 7.43581 20.2737L2 22L3.77194 16.7716C2.87847 15.3042 2.36391 13.5812 2.36391 11.7421C2.36456 6.36169 6.75886 2 12.1823 2C17.605 2.0013 22 6.36234 22 11.7427ZM12.1803 3.5535C7.62885 3.5535 3.9265 7.22781 3.9265 11.7447C3.9265 13.5369 4.51084 15.196 5.49887 16.546L4.46845 19.587L7.63928 18.5794C8.94362 19.4351 10.5043 19.9333 12.1803 19.9333C16.7318 19.9333 20.4355 16.2597 20.4355 11.7428C20.4368 7.22781 16.7324 3.5535 12.1803 3.5535ZM16.8125 13.7742C16.9781 13.854 17.0905 13.9081 17.1395 13.9868C17.2001 14.0866 17.2001 14.566 16.9993 15.1255C16.7997 15.6825 15.8175 16.2192 15.3754 16.2597C15.2999 16.2666 15.2374 16.2816 15.1733 16.2971C14.8629 16.3719 14.5158 16.4556 12.4869 15.6636C10.2341 14.7831 8.74622 12.6012 8.43023 12.1378C8.40309 12.098 8.38459 12.0709 8.375 12.0584L8.37434 12.0575C8.25125 11.8952 7.39284 10.763 7.39284 9.58864C7.39284 8.49145 7.93514 7.91553 8.18599 7.64913C8.20383 7.63019 8.22019 7.61281 8.23479 7.59692C8.45457 7.35757 8.71543 7.29953 8.87586 7.29953C8.95878 7.29953 9.0417 7.30476 9.12182 7.30981C9.19673 7.31453 9.2692 7.3191 9.33695 7.3191C9.35371 7.3191 9.37132 7.31798 9.38966 7.31681C9.52547 7.30819 9.70186 7.29699 9.87825 7.71757C9.95177 7.89199 10.0625 8.15906 10.1763 8.43377C10.3745 8.91195 10.5823 9.41329 10.6204 9.48951C10.6798 9.61016 10.7195 9.74907 10.6406 9.90885C10.6291 9.9318 10.6184 9.95348 10.6082 9.97421C10.5473 10.0978 10.5033 10.1871 10.4 10.306C10.3602 10.3523 10.319 10.4019 10.2779 10.4516C10.1943 10.5524 10.1108 10.6532 10.0387 10.7254C9.91933 10.8441 9.79216 10.9732 9.93368 11.2119C10.0732 11.4512 10.5565 12.2319 11.2719 12.8658C12.0356 13.5412 12.7003 13.8284 13.0416 13.9758C13.1112 14.0059 13.1674 14.0302 13.2082 14.0508C13.4489 14.1688 13.5891 14.1486 13.7293 13.9888C13.8708 13.8284 14.3325 13.291 14.491 13.0516C14.6515 12.8123 14.8119 12.8527 15.0336 12.9329C15.2534 13.0112 16.4384 13.5884 16.6777 13.7084C16.7259 13.7325 16.7709 13.7541 16.8125 13.7742Z";
const WhatsApp = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d={WHATSAPP}/></svg>;

/** "Keep talking to Mora" entry points. The app and WhatsApp are simulated shortcuts: nothing opens and nothing is sent. */
export function MoraChannels({say, className = ''}) {
  const [shortcut, setShortcut] = useState('');
  return <div className={`mora-channels ${className}`.trim()}>
    <div className="mora-channels-foot">
      <p>{say('Quer saber mais? Continue a conversa com a Mora.', '¿Quieres saber más? Sigue la conversación con Mora.')}</p>
      <div className="mora-channels-links">
        <button type="button" onClick={() => setShortcut('app')}><Phone/>{say('No app', 'En la app')}</button>
        <button type="button" onClick={() => setShortcut('whatsapp')}><WhatsApp/>{say('No WhatsApp', 'En WhatsApp')}</button>
      </div>
    </div>
    {shortcut && <p className="mora-channels-note" role="status">{say(`Atalho simulado: no protótipo a conversa não abre ${shortcut === 'app' ? 'o app' : 'o WhatsApp'} e nada é enviado.`, `Atajo simulado: en el prototipo la conversación no abre ${shortcut === 'app' ? 'la app' : 'WhatsApp'} y no se envía nada.`)}</p>}
  </div>;
}
