import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {useLanguage} from './i18n';
import {normalizeSearch} from './journey';
import {searchFaq} from './searchFaq.js';

/** Wide screens fit a fifth card. */
const WIDE = '(min-width:1920px)';

const FAN = {
  '0': {x: 0, rot: 0, s: 1, z: 5},
  '-1': {x: -46, rot: -10, s: 0.94, z: 4},
  '1': {x: 50, rot: 11, s: 0.94, z: 3},
  '-2': {x: -16, rot: -16, s: 0.88, z: 2},
  '2': {x: 18, rot: 17, s: 0.88, z: 1},
};

function fanOffset(index, active, count) {
  let delta = index - active;
  if (delta > count / 2) delta -= count;
  if (delta < -count / 2) delta += count;
  return FAN[delta] || FAN[Math.sign(delta) * 2];
}

/** Results FAQ from Figma 12908:21304. A card grows on hover and flips to its answer; on a narrow page the cards fan out and swipe. */
export function SearchFaq({search}) {
  const {language, money} = useLanguage();
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const current = normalizeSearch(search);
  const key = JSON.stringify([current.mode, current.areas, current.budget, language]);
  const faq = useMemo(() => searchFaq(search, language), [key]);
  const [flipped, setFlipped] = useState(() => new Set());
  const [active, setActive] = useState(0);
  const [deck, setDeck] = useState(false);
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(WIDE).matches);
  const root = useRef(null), gesture = useRef(null), swiped = useRef(false);
  const titleId = useId();
  useEffect(() => {setFlipped(new Set()); setActive(0);}, [key]);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const query = matchMedia(WIDE), update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const node = root.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setDeck(entry.contentRect.width < 700));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  if (!faq) return null;

  const {area, mode, items} = faq;
  const buying = mode !== 'rent';
  const cards = items.map(item => item.id === 'maintenance' ? maintenanceCard(item, area, money, say) : item);
  if (wide && faq.living) cards.push(livingCard(faq.living, area, money, say));

  function toggle(id) {
    setFlipped(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function onCardClick(id, index) {
    if (swiped.current) {swiped.current = false; return;}
    if (deck && index !== active) {setActive(index); return;}
    toggle(id);
  }
  function onPointerDown(event) {
    if (!deck || event.button) return;
    gesture.current = {x: event.clientX, y: event.clientY};
  }
  function onPointerUp(event) {
    if (!gesture.current) return;
    const dx = event.clientX - gesture.current.x, dy = event.clientY - gesture.current.y;
    gesture.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    setFlipped(new Set());
    setActive(index => (index + (dx < 0 ? 1 : -1) + cards.length) % cards.length);
  }
  function onKeyDown(event) {
    if (!deck || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
    event.preventDefault();
    setFlipped(new Set());
    setActive(index => (index + (event.key === 'ArrowRight' ? 1 : -1) + cards.length) % cards.length);
  }

  return <section ref={root} className={`search-faq${deck ? ' is-deck' : ''}`} aria-labelledby={titleId} onKeyDown={onKeyDown}>
    <div className="search-faq-head">
      <div className="search-faq-heading">
        <h2 id={titleId}>{buying
          ? say(`Perguntas frequentes sobre comprar em ${area}`, `Preguntas frecuentes sobre cómo es comprar en ${area}`)
          : say(`Perguntas frequentes sobre alugar em ${area}`, `Preguntas frecuentes sobre cómo es rentar en ${area}`)}</h2>
        <p>{say('Toque uma carta para ver a resposta completa. Os valores são referência e não mudam sua busca.', 'Toca una carta para ver la respuesta completa. Las cifras son referencia y no cambian tu búsqueda.')}</p>
      </div>
      <button type="button" className="search-faq-cta" onClick={() => {const next = (active + 1) % cards.length; setActive(next); setFlipped(deck ? new Set() : new Set([cards[next].id]));}}>
        {say('Todas as perguntas', 'Todas las preguntas')}
        <img src="/assets/price-insights/arrow-forward.svg" width="16" height="16" alt=""/>
      </button>
    </div>
    <div className="search-faq-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => {gesture.current = null;}}>
      {cards.map((card, index) => {
        const fan = fanOffset(index, active, cards.length);
        const open = flipped.has(card.id);
        return <div key={card.id} className="search-faq-slot" data-front={deck && index === active ? '' : undefined}
          style={deck ? {'--x': `${fan.x}px`, '--rot': `${fan.rot}deg`, '--s': fan.s, '--z': fan.z} : undefined}>
          <button type="button" className={`search-faq-card${open ? ' is-flipped' : ''}`} aria-expanded={open}
            aria-label={open ? say(`Voltar: ${card.question}`, `Volver: ${card.question}`) : card.question}
            onClick={() => onCardClick(card.id, index)}>
            <span className="search-faq-inner">
              <span className="search-faq-face" aria-hidden={open || undefined}>
                <span className="search-faq-copy">
                  <span className="search-faq-question">{card.question}</span>
                  <span className="search-faq-teaser">{card.teaser}</span>
                </span>
                <span className="search-faq-actions">
                  <span className="search-faq-link">{say('Explorar detalhes', 'Explorar detalles')}<img src="/assets/price-insights/chevron-down.svg" width="16" height="16" alt=""/></span>
                  <span className="search-faq-go"><img src="/assets/price-insights/arrow-up.svg" width="20" height="20" alt=""/></span>
                </span>
              </span>
              <span className="search-faq-face search-faq-back" aria-hidden={!open || undefined}>
                <span className="search-faq-copy">
                  <span className="search-faq-question">{card.question}</span>
                  <span className="search-faq-answer">{card.answer}</span>
                  {card.note && <span className="search-faq-note">{card.note}</span>}
                </span>
                <span className="search-faq-actions">
                  <span className="search-faq-link">{say('Voltar', 'Volver')}<img src="/assets/price-insights/chevron-down.svg" width="16" height="16" alt=""/></span>
                  <span className="search-faq-go is-back"><img src="/assets/price-insights/arrow-up.svg" width="20" height="20" alt=""/></span>
                </span>
              </span>
            </span>
          </button>
        </div>;
      })}
    </div>
    {deck && <p className="search-faq-count" aria-live="polite">{say(`Pergunta ${active + 1} de ${cards.length}. Deslize para trocar.`, `Pregunta ${active + 1} de ${cards.length}. Desliza para cambiar.`)}</p>}
  </section>;
}

function maintenanceCard(item, area, money, say) {
  const question = say('Quanto é o condomínio?', '¿Cuánto es el mantenimiento?');
  if (item.amount == null) return {
    id: item.id, question,
    teaser: say(`Nenhum anúncio de ${area} informa o condomínio.`, `Ningún anuncio de ${area} publica el mantenimiento.`),
    answer: say('Sem esse número, o custo mensal não se compara bem. Confirme com a imobiliária antes de contar com ele.', 'Sin ese número, el costo mensual no se compara bien. Confírmalo con la inmobiliaria antes de contar con él.'),
    note: say('O catálogo não publica esse valor.', 'El catálogo no publica ese monto.'),
  };
  const amount = money(item.amount);
  const teaser = item.count > 1
    ? say(`Nos anúncios de ${area}, a mediana publicada é ${amount} por mês.`, `En los anuncios de ${area}, la mediana publicada es ${amount} al mes.`)
    : say(`Um anúncio de ${area} publica ${amount} por mês.`, `Un anuncio de ${area} publica ${amount} al mes.`);
  return {
    id: item.id, question, teaser,
    answer: say(`${teaser} O condomínio muda de prédio para prédio e o anúncio diz o que está incluído.`, `${teaser} El mantenimiento cambia de edificio a edificio y el anuncio dice qué incluye.`),
    note: say('Sai dos anúncios do catálogo, não de uma tabela da colônia.', 'Sale de los anuncios del catálogo, no de una tabla de la colonia.'),
  };
}

function livingCard({total, people, withFee}, area, money, say) {
  const amount = money(total);
  const household = say(`${people} ${people > 1 ? 'pessoas' : 'pessoa'}`, `${people} ${people > 1 ? 'personas' : 'persona'}`);
  return {
    id: 'living',
    question: say(`Quanto custa viver em ${area}?`, `¿Cuánto cuesta vivir en ${area}?`),
    teaser: say(`Uns ${amount} por mês em contas e gastos da casa.`, `Unos ${amount} al mes en cuentas y gastos del hogar.`),
    answer: say(
      `Para ${household}: mercado, luz, gás, transporte, água, internet e seguro somam uns ${amount} por mês.${withFee ? ' Inclui o condomínio publicado nos anúncios.' : ' O condomínio fica de fora: nenhum anúncio publica o valor.'}`,
      `Para ${household}: súper, luz, gas, transporte, agua, internet y seguro suman unos ${amount} al mes.${withFee ? ' Incluye el mantenimiento publicado en los anuncios.' : ' El mantenimiento queda fuera: ningún anuncio publica el monto.'}`),
    note: say('Estimativa ilustrativa, não uma medição.', 'Estimación ilustrativa, no una medición.'),
  };
}
