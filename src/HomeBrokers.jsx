import React, {useEffect, useRef, useState} from 'react';
import {useLanguage} from './i18n.jsx';

const TITLE = 'Algunas de nuestras inmobiliarias más destacadas';
const CAPTION = 'Explora las mejores propiedades en el mercado, donde la calidad y el diseño se encuentran. Encuentra tu hogar ideal en ubicaciones privilegiadas.';
const LEVEL = 'Nivel {level} / {count} calificaciones';

/**
 * Fictional agencies. Logos come from the Figma fan (node 12942-14268); `drop` is the card's
 * offset below the centre card as a fraction of the card size and `tilt` its rotation.
 */
const BROKERS = [
  {id: 'alto', name: 'Alto', level: 5, count: 240, drop: .433, tilt: -18},
  {id: 'vertice', name: 'Vértice', level: 5, count: 186, drop: .278, tilt: -13},
  {id: 'casa-viva', name: 'Casa Viva', level: 4, count: 152, drop: .166, tilt: -8},
  {id: 'horizonte', name: 'Horizonte', level: 5, count: 210, drop: .118, tilt: -3},
  {id: 'aura', name: 'Aura', level: 5, count: 300, drop: 0, tilt: 0},
  {id: 'raiz', name: 'Raíz', level: 5, count: 168, drop: .118, tilt: 2},
  {id: 'nexo', name: 'Nexo', level: 4, count: 134, drop: .155, tilt: 5},
  {id: 'orla', name: 'Orla', level: 5, count: 121, drop: .235, tilt: 10},
  {id: 'prisma', name: 'Prisma', level: 4, count: 98, drop: .39, tilt: 15},
];

export function HomeBrokers({search, onSearch, onIntroDone, onChoose, onSelect}) {
  const {t, language} = useLanguage();
  const say = (pt, es) => language === 'pt-BR' ? pt : es;
  const section = useRef(null);
  const [dealt, setDealt] = useState(false);

  function handleSelect(broker) {
    onIntroDone?.();
    onChoose?.('template');
    if (onSelect) {
      onSelect(broker);
    } else if (onSearch) {
      onSearch(current => ({
        ...current,
        note: broker.name,
        fromIdea: false,
      }));
    }
  }

  useEffect(() => {
    const node = section.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDealt(true);
      return;
    }
    let done = false;
    const deal = () => {
      if (done) return;
      if (getComputedStyle(node).visibility === 'hidden') return;
      const rect = node.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.82 || rect.bottom < 40) return;
      done = true;
      setDealt(true);
      stop();
    };
    const io = new IntersectionObserver(deal, {threshold: [0.3, 0.5]});
    io.observe(node);
    const home = node.closest('.home-evolution');
    const mo = new MutationObserver(deal);
    if (home) mo.observe(home, {attributes: true, attributeFilter: ['data-intro-stage']});
    window.addEventListener('scroll', deal, {passive: true});
    deal();
    function stop() {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener('scroll', deal);
    }
    return stop;
  }, []);

  return <section className="home-brokers" data-dealt={dealt} ref={section} aria-labelledby="home-brokers-title">
    <h2 id="home-brokers-title">{t(TITLE)}</h2>
    <div className="home-brokers-fan">
      {BROKERS.map((broker, i) => <div
        className="home-broker"
        data-center={i === 4 || undefined}
        data-edge={i < 2 ? 'start' : i > 6 ? 'end' : undefined}
        style={{'--i': i, '--drop': broker.drop, '--tilt': `${broker.tilt}deg`, '--z': 12 - Math.abs(i - 4)}}
        key={broker.id}>
        <button
          type="button"
          className="home-broker-review"
          onClick={() => handleSelect(broker)}
          aria-label={`${broker.name}, ${broker.level} ${say('estrelas', 'estrellas')}, ${broker.count} ${say('qualificações', 'calificaciones')}`}>
          <span className="home-broker-star" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </span>
          <span className="home-broker-review-body">
            <span className="home-broker-review-name">{broker.name} {t('Inmobiliaria')}</span>
            <span className="home-broker-review-score">
              <strong>{say(`Nível ${broker.level} /`, `Nivel ${broker.level} /`)}</strong>{' '}
              <span>{say(`${broker.count} qualificações`, `${broker.count} calificaciones`)}</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          className="home-broker-face"
          onClick={() => handleSelect(broker)}
          aria-label={`${broker.name}, ${t('Inmobiliaria')}`}>
          <img src={`/assets/brokers/${broker.id}.jpg`} alt="" width="480" height="480" loading="lazy" decoding="async"/>
        </button>
      </div>)}
    </div>
    <p>{t(CAPTION)}</p>
    <button type="button" className="home-brokers-all" onClick={() => handleSelect({name: 'inmobiliaria'})}>{t('Explorar todas las inmobiliarias')}</button>
  </section>;
}
