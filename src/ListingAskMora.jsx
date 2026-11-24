import React, {useState} from 'react';
import {selectionAnswer} from './selectionAsk.js';
import {MORA_MARK, MoraWords} from './MoraVoice.jsx';
import {MoraChannels} from './MoraChannels.jsx';

const QUESTIONS = [
  ['O preço está bom?', '¿El precio está bien?'],
  ['Quanto tempo até o metrô?', '¿Cuánto tardo al metro?'],
  ['Aceita pet?', '¿Aceptan mascotas?'],
];

/** Questions for Mora under the listing: chips answer on the spot from the listing; the app and WhatsApp are simulated shortcuts. */
export function ListingAskMora({home, language, say}) {
  const [asked, setAsked] = useState(null);
  const answer = asked ? selectionAnswer({question: say(...asked), home, language}) : null;
  return <div className="pp-ask-mora">
    <img className="pp-ask-mora-mark" src={MORA_MARK} alt="" width="40" height="40"/>
    <div className="pp-ask-mora-main">
      <h2 id="pp-ask-title">{say('Ficou com alguma dúvida?', '¿Te quedó alguna duda?')}</h2>
      <div className="pp-ask-mora-chips" role="group" aria-labelledby="pp-ask-title">
        {QUESTIONS.map(item => <button key={item[1]} type="button" className="pp-ask-mora-chip" aria-pressed={asked === item} onClick={() => setAsked(item)}>{say(...item)}</button>)}
      </div>
      <div className="pp-ask-mora-answer" aria-live="polite">{answer && <MoraWords key={asked[1]} text={answer.text}/>}</div>
      <MoraChannels say={say}/>
    </div>
  </div>;
}
