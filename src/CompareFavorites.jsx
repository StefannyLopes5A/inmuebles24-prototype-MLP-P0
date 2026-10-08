import React, {useLayoutEffect, useRef} from 'react';
import {motion, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {HouseCard} from './Home';
import {useLanguage} from './i18n';
import {MoraName} from './MiniListing';
import {compareFavorites, listingSummary} from './listingPresentation';
import {riseIn} from './favoriteMotion';

export function CompareFavorites({title, meta, homes, isSaved, search, pref, onClose, onOpen, onUnlike, onContact, onContactAll}) {
  const {language} = useLanguage();
  const pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const heading = useRef(null);
  const reduce = useReducedMotion();
  const count = homes.length;
  const reading = compareFavorites(homes, search, pref, language);
  useLayoutEffect(() => {heading.current?.focus({preventScroll: true});}, []);

  return <article className="compare-page">
    <header className="compare-page-header">
      <div className="compare-page-heading">
        <button className="compare-back" type="button" onClick={onClose} aria-label={say('Voltar para favoritos', 'Volver a favoritos')}>
          <Icon name="back" size={20}/>
        </button>
        <motion.div {...riseIn(reduce, 0, 6)}>
          <h1 ref={heading} tabIndex={-1}>{title}</h1>
          {count > 0 && meta && <p className="compare-folder-meta">{meta}</p>}
          {count === 1 && <p className="compare-empty-copy">{say('Salve mais um nesta pasta para comparar.', 'Guarda uno más en esta carpeta para comparar.')}</p>}
          {count === 0 && <p className="compare-empty-copy">{say('Esta pasta está vazia. Toque no coração de um imóvel para salvá-lo aqui.', 'Esta carpeta está vacía. Toca el corazón de un inmueble para guardarlo aquí.')}</p>}
        </motion.div>
      </div>
      {count >= 2 && onContactAll && (
        <motion.button className="mini-secondary compare-batch" type="button" onClick={onContactAll} {...riseIn(reduce, 1, 6)}>
          {say('Falar com todas as imobiliárias', 'Hablar con todas las inmobiliarias')}
        </motion.button>
      )}
    </header>

    {count > 0 && <div className="compare-rail" role="list">
      {reading.cards.map((card, index) => {
        const home = card.home;
        const summary = listingSummary(home, search, pref, language);
        const isLeader = reading.leaderId === home.id;
        return <motion.section className={`compare-column${isLeader ? ' is-leader' : ''}`} role="listitem" key={home.id} {...riseIn(reduce, index + 1)}>
          <HouseCard home={home} saved={isSaved ? isSaved(home.id) : true} onLike={onUnlike} onOpen={onOpen}/>
          <div className="compare-mora">
            <MoraName/>
            <div className="mini-highlights">
              <div>
                <h3>{summary.hasMatch ? say('Combina com sua busca', 'Combina con tu búsqueda') : say('Sobre este imóvel', 'Sobre este inmueble')}</h3>
                <ul>{summary.matches.map(text => <li key={text}>{text}</li>)}</ul>
              </div>
              <div>
                <h3>{say('Vale considerar', 'Vale la pena considerar')}</h3>
                <ul>{summary.considerations.map(text => <li key={text}>{text}</li>)}</ul>
              </div>
            </div>
            {card.profile && <p className="compare-profile">{card.profile}</p>}
          </div>
          <button className="mini-primary compare-open" type="button" onClick={() => onContact(home)}>
            {say('Falar com imobiliária', 'Hablar con inmobiliaria')}
          </button>
        </motion.section>;
      })}
    </div>}
  </article>;
}
