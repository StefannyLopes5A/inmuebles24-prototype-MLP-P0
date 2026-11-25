import React, {useState} from 'react';

/**
 * The entry point to Mora (Bianca) from the portal, as in the Figma "Rediseño del listado 2025" card: the Mora mark, a
 * two-line title and two pill buttons, "En la app" and "En WhatsApp". There is no live question: the conversation
 * continues in the app or on WhatsApp. Both shortcuts are simulated; nothing opens and nothing is sent.
 */
/** Each word is its own span so the title can arrive word by word, as the sentence does on the home. */
function words(line, offset) {
  return line.split(/\s+/).filter(Boolean).map((word, index) => <React.Fragment key={index}>{index > 0 && ' '}<span className="me-word" style={{'--me-i': offset + index}}>{word}</span></React.Fragment>);
}

export function MoraEntry({id, title, questions = [], say, className = '', onClose}) {
  const [asked, setAsked] = useState(null);
  const [channel, setChannel] = useState('');
  const subtitle = say('Continue a conversa com a Mora.', 'Sigue la conversación con Mora.');
  const where = channel === 'app' ? say('o app', 'la app') : say('o WhatsApp', 'WhatsApp');
  return <div className={`me ${onClose ? 'is-closable ' : ''}${className}`.trim()}>
    <span className="me-mark"><img src="/assets/mora-entry/mora-logo.svg" alt="" width="40" height="40"/></span>
    <div className="me-body">
      <h2 className="me-title" id={id} style={{'--me-n': `${title} ${subtitle}`.split(/\s+/).filter(Boolean).length}}>{[title, subtitle].map((line, row, lines) => <span key={row}>{words(line, lines.slice(0, row).join(' ').split(/\s+/).filter(Boolean).length)}</span>)}</h2>
      <div className="me-actions">
        <button type="button" className="me-button me-app" onClick={() => setChannel('app')}>{say('No app', 'En la app')}</button>
        <button type="button" className="me-button me-whatsapp" onClick={() => setChannel('whatsapp')}><img src="/assets/mora-entry/whatsapp.svg" alt="" width="20" height="20"/>{say('No WhatsApp', 'En WhatsApp')}</button>
      </div>
      {questions.length > 0 && <div className="me-chips" role="group" aria-labelledby={id}>
        {questions.map(item => <button key={item[1]} type="button" className="me-chip" aria-pressed={asked === item} onClick={() => setAsked(asked === item ? null : item)}>{say(...item)}</button>)}
      </div>}
      <p className="me-note" role="status">{channel
        ? `${asked ? say(`Sua pergunta: “${say(...asked)}”. `, `Tu pregunta: “${say(...asked)}”. `) : ''}${say(`Atalho simulado: no protótipo a conversa não abre ${where} e nada é enviado.`, `Atajo simulado: en el prototipo la conversación no abre ${where} y no se envía nada.`)}`
        : ''}</p>
    </div>
    {onClose && <button type="button" className="me-close" aria-label={say('Fechar', 'Cerrar')} onClick={onClose}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>}
  </div>;
}
