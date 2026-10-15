import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Glyph, MoraInsight} from '../MoraInsight.jsx';
import {ListingReviews} from '../ListingReviews.jsx';
import {advertiserFor} from '../listingAdvertiser.js';
import {useLanguage} from '../i18n';
import {SIDES} from './buildingConfig.js';
import {AMENITIES, DEVELOPMENT, DEVELOPER, GALLERY, RANGES, TYPOLOGIES, UNITS, available, unitAsHome, unitById} from './torreOlmo.js';
import {CONTENT_DELAY, CONTENT_OUT, EASE_FADE, SPRING_MORPH} from '../listingPanelMotion.js';
import {ChatTurn, MoraComposer, useMoraThread} from '../moraChat.jsx';
import {developmentFacts, developmentKind} from './listingFacts.js';
import {DEFAULT_FILTERS, PRICE_BOUNDS, SORTS, filtersActive, groupByTypology, listedUnits, priceActive, priceHistogram, similarUnits} from './units.js';
import '../property-page.css';
import '../recorrido.css';

const MOSAIC_SLOTS = 5;
const mosaicTiles = () => GALLERY.slice(0, MOSAIC_SLOTS).map((photo, slot) => ({...photo, slot, index:slot}));
const mosaicMore = Math.max(0, GALLERY.length - MOSAIC_SLOTS);

const ICONS = {
  back:'M15 18l-6-6 6-6',
  panel:'M4.5 6.25h15a1.25 1.25 0 0 1 1.25 1.25v9a1.25 1.25 0 0 1-1.25 1.25h-15A1.25 1.25 0 0 1 3.25 16.5v-9A1.25 1.25 0 0 1 4.5 6.25ZM9 6.25v11.5',
  close:'M6 6l12 12M18 6 6 18',
  chevron:'M6 9l6 6 6-6',
  pin:'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  share:'M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  whatsapp:'M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20ZM9 8.8c0 3.3 2.9 6.2 6.2 6.2l1.3-1.4-1.9-1-1 .8a4.5 4.5 0 0 1-2.4-2.4l.8-1-1-1.9L9 8.8Z',
  cube:'M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8ZM4.3 7.6 12 12l7.7-4.4M12 12v9',
  check:'M5 12.5l4.5 4.5L19 7.5',
  zoom:'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.8-4.8M10.5 8v5M8 10.5h5',
  pool:'M3 17c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M8 14V5a2 2 0 0 1 4 0M16 14V5a2 2 0 0 0-4 0M8 9h8',
  gym:'M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12',
  events:'M5 21V9l7-5 7 5v12M9 21v-6h6v6',
  lobby:'M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M10 21v-4h4v4M9 7h.01M15 7h.01M9 11h.01M15 11h.01',
  security:'M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6l-7-3Z',
  bike:'M6 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM6 14.5 9.5 8h5L18 14.5M12 14.5 9.5 8M14 5h2',
  pet:'M8.5 9a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM15.5 9a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM5 13a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 5 13ZM19 13a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM12 12c-2.5 0-5 3.4-5 5.6 0 1.6 1.3 2.4 2.8 2.4 1 0 1.5-.5 2.2-.5s1.2.5 2.2.5c1.5 0 2.8-.8 2.8-2.4 0-2.2-2.5-5.6-5-5.6Z',
  laundry:'M5 3h14v18H5zM5 7h14M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM8 5h.01',
  sort:'M8 7l4-4 4 4M12 3v10M16 17l-4 4-4-4M12 21V11',
  sliders:'M4 6h16M7 12h10M10 18h4',
};
const specAsset = name => `/assets/mini-listing/${name}.svg`;
const ease = [0.23, 1, 0.32, 1];
const SCROLL_PAD = 68; // .rp-scroll padding-top — title rests under the toolbar
const ROW_PAD = 10; // .rp-row padding-block — title starts on the label, not the row edge
const ROW_RADIUS = 12;
const TITLE_FROM = 16 / 28; // row label 16px grows into the 28px unit title

const originFrom = event => {
  const row = event.currentTarget.getBoundingClientRect();
  const stage = event.currentTarget.closest('.rp-stage')?.getBoundingClientRect();
  if (!stage) return null;
  return {
    top:row.top - stage.top,
    right:stage.right - row.right,
    bottom:stage.bottom - row.bottom,
    left:row.left - stage.left,
  };
};
const clipOf = origin => {
  const edge = value => Math.max(0, value).toFixed(1);
  return `inset(${edge(origin.top)}px ${edge(origin.right)}px ${edge(origin.bottom)}px ${edge(origin.left)}px round ${ROW_RADIUS}px)`;
};
// The sheet grows from the clicked row. Without a row (3D, deep link) it fades in place.
const layerMorph = (reduce, origin) => {
  if (reduce) return {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:0.12}};
  if (!origin) return {
    initial:{opacity:0, transform:'scale(0.98)'},
    animate:{opacity:1, transform:'scale(1)'},
    exit:{opacity:0, transform:'scale(0.98)'},
    style:{transformOrigin:'center center'},
    transition:{duration:0.2, ease},
  };
  const shut = clipOf(origin);
  return {
    initial:{clipPath:shut},
    animate:{clipPath:'inset(0px 0px 0px 0px round 0px)'},
    exit:{clipPath:shut},
    transition:SPRING_MORPH,
  };
};
const rise = reduce => reduce ? {
  hidden:{opacity:1, transform:'translateY(0px)'},
  show:{opacity:1, transform:'translateY(0px)'},
} : {
  hidden:{opacity:0, transform:'translateY(8px)', pointerEvents:'none'},
  show:{opacity:1, transform:'translateY(0px)', pointerEvents:'auto', transition:{duration:0.2, ease}},
};
const titleMotion = (reduce, travel) => {
  if (reduce || !travel) return rise(reduce);
  return {
    hidden:{opacity:1, transform:`scale(${TITLE_FROM})`, transformOrigin:'0 0'},
    show:{opacity:1, transform:'scale(1)', transformOrigin:'0 0', transition:SPRING_MORPH},
  };
};

export function RIcon({name, size = 18}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]}/></svg>;
}

export const formatMoney = value => `$${Math.round(value).toLocaleString('en-US')}`;
const short = value => `$${(value / 1e6).toFixed(value % 1e6 ? 1 : 0)} M`;
const pick = (pair, say) => say(pair[0], pair[1]);
const orientationLabel = (unit, say) => SIDES[unit.side] === 'norte' ? say('Norte', 'Norte') : say('Sul', 'Sur');

export function statusLabel(status, say) {
  return {available:say('Disponível', 'Disponible'), reserved:say('Reservada', 'Apartado'), sold:say('Vendida', 'Vendido')}[status];
}

export function StatusPill({status, say}) {
  return <span className={`rp-status is-${status}`}><i aria-hidden="true"/>{statusLabel(status, say)}</span>;
}

const swap = reduce => ({initial:{opacity:0, y:reduce ? 0 : 4}, animate:{opacity:1, y:0}, exit:{opacity:0, y:reduce ? 0 : -4}, transition:{duration:reduce ? 0.12 : 0.15, ease}});

function Chrome({say, onBack, backLabel, saved, onLike, onShare}) {
  return <div className="rp-chrome">
    <button type="button" className="compare-back" onClick={onBack} aria-label={backLabel}><RIcon name="back"/></button>
    {(onLike || onShare) && <div className="rp-toolbar-actions">
      {onLike && <button type="button" className="compare-back" aria-pressed={saved} aria-label={saved ? say('Remover dos favoritos', 'Quitar de favoritos') : say('Salvar nos favoritos', 'Guardar en favoritos')} onClick={onLike}><RIcon name="heart"/></button>}
      {onShare && <button type="button" className="compare-back" aria-label={say('Compartilhar', 'Compartir')} onClick={onShare}><RIcon name="share"/></button>}
    </div>}
  </div>;
}

// The mini-listing's footer swap: the old row fades out, the new one rises in.
const footerSwap = reduce => ({initial:reduce ? {opacity:0} : {opacity:0, transform:'translateY(8px)'}, animate:{opacity:1, transform:'translateY(0px)'}, exit:{opacity:0, transition:{duration:CONTENT_OUT / 1000, ease:'easeOut'}}, transition:{duration:0.2, ease:EASE_FADE}});
const DEVELOPER_NOUN = ['incorporadora', 'desarrolladora'];
const FIELD_DELAY = CONTENT_OUT + 220;

/** Ideas for the open field; the three tour questions are already one tap away in the row above it. */
const tourHints = (unit, say) => [
  unit ? say(`Pergunte o que quiser sobre a ${unit.id}…`, `Pregúntale lo que quieras sobre la ${unit.id}…`) : say('Pergunte o que quiser sobre este empreendimento…', 'Pregúntale lo que quieras sobre este desarrollo…'),
  say('Aceitam animais de estimação?', '¿Aceptan mascotas?'),
  say('Quanto é o condomínio?', '¿Cuánto es el mantenimiento?'),
  say('Tem calendário de pagamentos?', '¿Hay calendario de pagos?'),
  say('Posso visitar esta semana?', '¿Puedo visitarlo esta semana?'),
];
/** What Mora reads in the tour, in the `{options, signature}` shape the mini-listing and the listing page pass her. */
const tourReading = (home, language, unit) => ({
  options:{language, stage:'deciding', ...(unit && {unit})},
  signature:unit ? `recorrido|${home.id}|${unit.id}|${language}` : `recorrido|${home.id}|${language}`,
});
const moraNote = say => say('A Mora lê o inventário, a zona e a sua busca. Confirme os detalhes com a incorporadora.', 'Mora lee el inventario, la zona y tu búsqueda. Confirma los detalles con la desarrolladora.');

const tourQuick = say => [say('Qual unidade tem a melhor vista?', '¿Qué unidad tiene mejor vista?'), say('Qual é a mais barata por m²?', '¿Cuál es la más barata por m²?'), say('O que há perto para crianças?', '¿Qué hay cerca para niños?')];

export function RecorridoPanel(props) {
  const {home, say, view, onView, unitId, onBack, onCloseUnit, saved, onLike, onShare, collapsed, onCollapse, collapsible, modelFailed, reduce, held, chat, onOpenChat, onCloseChat, onTourAsk} = props;
  const {language} = useLanguage();
  const unit = unitId ? unitById(unitId) : null;
  const tab = view === 'summary' ? 'summary' : 'units';
  const unitOpen = !!(unit && !collapsed);
  const chatOpen = !!chat && !collapsed;
  const chatUnit = chat?.unitId ? unitById(chat.unitId) : null;
  const subject = useMemo(() => chatUnit ? {...unitAsHome(chatUnit), image:home.image} : home, [chatUnit, home]);
  const advertiser = useMemo(() => advertiserFor(home), [home]);
  const threadRef = useRef(null), chatScroll = useRef(null), askField = useRef(null);
  const askId = useId();
  const [draft, setDraft] = useState('');
  const {turns, push, agencyAction} = useMoraThread({on:chatOpen, threadRef, scroller:() => chatScroll.current, reduce});
  /** A free question goes the mini-listing's way; the tour's own questions come back answered from the inventory and the scene. */
  function ask(value, source, kind = 'ask', slot = null) {
    const answer = kind === 'ask' ? onTourAsk(value) : null;
    if (push(value, source, answer ? 'answer' : kind, slot, {...answer, subject})) setDraft('');
  }
  const backToPanel = chatUnit || unitOpen ? say('Voltar para a unidade', 'Volver a la unidad')
    : tab === 'units' ? say('Voltar às unidades', 'Volver a unidades') : say('Voltar para ver o resumo', 'Volver a ver el resumen');
  // The field takes focus once the footer has swapped in; a visit or a question from the reading arrives as the first turn, flying from it.
  useEffect(() => {
    if (!chat) return undefined;
    const timer = setTimeout(() => {
      const field = askField.current;
      field?.focus({preventScroll:true});
      if (chat.visit) ask(chatUnit ? say(`Quero visitar a ${chatUnit.id}`, `Quiero visitar la ${chatUnit.id}`) : say('Quero visitar o empreendimento', 'Quiero visitar el desarrollo'), field, 'visit');
      else if (chat.question) ask(chat.question, field);
    }, reduce ? 0 : FIELD_DELAY);
    return () => clearTimeout(timer);
    // Once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.at]);
  // Leaving the chat hands focus back to the button that opened it.
  const opener = useRef(null);
  useEffect(() => {
    if (chat) { opener.current = chat.from; return undefined; }
    const from = opener.current;
    opener.current = null;
    if (from !== 'message' && from !== 'visit') return undefined;
    const timer = setTimeout(() => document.querySelector(`#recorrido-panel .rp-cta .${from === 'visit' ? 'mini-secondary' : 'mini-primary'}`)?.focus({preventScroll:true}), reduce ? 0 : FIELD_DELAY);
    return () => clearTimeout(timer);
  }, [chat, reduce]);
  const visitLabel = unitOpen ? say(`Solicitar visita à ${unit.id}`, `Solicitar visita a la ${unit.id}`) : say('Solicitar visita', 'Solicitar visita');
  return <div className="rp-dock" inert={held || undefined} data-collapsed={collapsed || undefined} data-unit={unitOpen ? unit.id : undefined}>
    <div className="rp-slide">
    <aside id="recorrido-panel" className="rp-panel" aria-hidden={collapsed || undefined} aria-label={chatOpen ? say('Conversa com a Mora', 'Conversación con Mora') : unitOpen ? say(`Unidade ${unit.id}`, `Unidad ${unit.id}`) : say('Painel do empreendimento', 'Panel del desarrollo')} onClick={collapsed ? onCollapse : undefined}>
      <div className="rp-body" inert={collapsed || undefined}>
        <Chrome say={say} onBack={chatOpen ? onCloseChat : unitOpen ? onCloseUnit : onBack}
          backLabel={chatOpen ? backToPanel : unitOpen ? say('Voltar às unidades', 'Volver a unidades') : say('Voltar aos resultados', 'Volver a resultados')}
          saved={saved} onLike={onLike} onShare={onShare}/>
        <div className="rp-stage">
          <div className="rp-scroll" inert={unitOpen || chatOpen || undefined} aria-hidden={unitOpen || chatOpen || undefined}>
            <header className="rp-identity">
              <h1>{DEVELOPMENT.name}</h1>
              <p className="rp-area">{DEVELOPMENT.area}, {DEVELOPMENT.borough}</p>
              <ul className="rp-badges">
                {!modelFailed && <li className="is-tour"><RIcon name="cube" size={14}/>{say('Tour 3D', 'Tour 3D')}</li>}
                <li>{say('Entrega dez. 2027', 'Entrega dic. 2027')}</li>
              </ul>
              <div className="rp-tabs" role="tablist" aria-label={say('Seções', 'Secciones')}>
                <button type="button" role="tab" aria-selected={tab === 'summary'} onClick={() => onView('summary')}>{say('Resumo', 'Resumen')}</button>
                <button type="button" role="tab" aria-selected={tab === 'units'} onClick={() => onView('units')}>{say('Unidades', 'Unidades')}</button>
              </div>
            </header>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} className="rp-content" role="tabpanel" {...swap(reduce)}>
                {tab === 'summary' ? <SummaryView {...props}/> : <UnitsView {...props} selectedId={unit?.id}/>}
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence>{unitOpen && <UnitLayer key="unit-layer" unit={unit} {...props} inert={chatOpen}/>}</AnimatePresence>
          <AnimatePresence initial={false}>{chatOpen && <motion.div key="chat" className="rp-chat" {...footerSwap(reduce)}>
            <div ref={chatScroll} className="rp-scroll rp-chat-scroll">
              <div className="lp-phase">
                <div className="lp-verdict-slot">
                  <MoraInsight home={home} {...tourReading(home, language, chatUnit)}
                    short={value => formatMoney(value)} say={say} variant="verdict" folded={turns.length > 0} label={chatUnit ? say(`Sobre a ${chatUnit.id}`, `Sobre la ${chatUnit.id}`) : undefined}/>
                </div>
                <ol ref={threadRef} className="lp-thread" role="log" aria-label={say('Conversa com a Mora', 'Conversación con Mora')}>
                  {turns.map((turn, i) => <ChatTurn key={turn.id} turn={turn} home={turn.subject || subject} advertiser={advertiser} agency={DEVELOPER_NOUN} active={i === turns.length - 1}
                    reduce={reduce} copy={{say, language}} onAsk={ask} onAgencyAction={agencyAction}/>)}
                </ol>
              </div>
            </div>
          </motion.div>}</AnimatePresence>
        </div>
        <footer className={`rp-cta${chatOpen ? ' is-chat' : ''}`}>
          <AnimatePresence mode="wait" initial={false}><motion.div key={chatOpen ? 'chat' : 'actions'} className="rp-cta-inner" {...footerSwap(reduce)}>
            {chatOpen
              ? <MoraComposer id={askId} field={askField} draft={draft} onDraft={setDraft} onAsk={(value, source) => ask(value, source)} hints={tourHints(chatUnit, say)}
                quick={tourQuick(say)} showQuick={!turns.length} onBack={onCloseChat} backLabel={backToPanel} reduce={reduce} say={say}
                label={chatUnit ? say(`Pergunte à Mora sobre a unidade ${chatUnit.id}`, `Pregúntale a Mora sobre la unidad ${chatUnit.id}`) : say('Pergunte à Mora sobre este empreendimento', 'Pregúntale a Mora sobre este desarrollo')}/>
              : <div className="pp-card-actions">
                <button type="button" className="mini-primary" onClick={() => onOpenChat({from:'message'})}>{say('Falar com a incorporadora', 'Hablar con la desarrolladora')}</button>
                <button type="button" className="mini-secondary" onClick={() => onOpenChat({from:'visit', visit:true})}>{visitLabel}</button>
              </div>}
          </motion.div></AnimatePresence>
        </footer>
      </div>
    </aside>
    {collapsible && <button type="button" className="rp-collapse" aria-expanded={!collapsed} aria-controls="recorrido-panel" onClick={event => { event.stopPropagation(); onCollapse(); }}
      aria-label={collapsed ? say('Mostrar painel', 'Mostrar panel') : say('Recolher painel', 'Contraer panel')}><span className="rp-collapse-glyph"><RIcon name="panel" size={18}/></span></button>}
    </div>
  </div>;
}

function SummaryView({home, say, onAmenity, onCityMode, onPhoto, onOpenChat, modelFailed}) {
  const {language} = useLanguage();
  const [more, setMore] = useState(false), [verified, setVerified] = useState(false);
  const description = pick(DEVELOPMENT.description, say);
  const advertiser = useMemo(() => advertiserFor(home), [home]);
  const tiles = mosaicTiles();
  const [size, beds, parking] = developmentFacts(language);
  const specs = [['area', size], ['bed', beds], ...(parking ? [['car', parking]] : [])];
  return <>
    <section className="rp-block rp-price">
      <div className="rp-price-lead">
        <p className="lp-price"><span className="lp-price-from">{developmentKind(language)}</span>{formatMoney(RANGES.price[0])} MXN</p>
        <ul className="lp-specs">
          {specs.map(([name, label]) => <li key={name}><img src={specAsset(name)} alt=""/><span>{label}</span></li>)}
          <li className="lp-specs-units"><span>{say(`${available.length} de ${UNITS.length} disponíveis`, `${available.length} de ${UNITS.length} disponibles`)}</span></li>
        </ul>
      </div>
      <p className="rp-muted">{say(`Condomínio estimado a partir de ${formatMoney(DEVELOPMENT.maintenanceFrom)} MXN por mês`, `Mantenimiento estimado desde ${formatMoney(DEVELOPMENT.maintenanceFrom)} MXN al mes`)}</p>
    </section>
    <section className="rp-block rp-mora" aria-label="Mora">
      <MoraInsight home={home} {...tourReading(home, language)} short={formatMoney} say={say} variant="verdict"/>
      <p className="pp-mora-note">{moraNote(say)}</p>
    </section>
    <section className="rp-block rp-amenities-block">
      <h2>{say('Amenidades', 'Amenidades')}</h2>
      <ul className="rp-amenities">{AMENITIES.map(item => {
        const pinned = item.anchor !== undefined && !modelFailed;
        const body = <>
          <RIcon name={item.icon} size={24}/>
          <span><strong>{pick(item.name, say)}{pinned && <span className="rp-amenity-pin"><RIcon name="pin" size={14}/></span>}</strong></span>
        </>;
        return <li key={item.id}>{pinned
          ? <button type="button" onClick={() => onAmenity(item)} title={say('Ver no prédio', 'Ver en el edificio')}>{body}</button>
          : <span>{body}</span>}</li>;
      })}</ul>
    </section>
    <section className="rp-block rp-photos">
      <h2>{say('Fotos', 'Fotos')}</h2>
      <div className="rp-mosaic">
        {tiles.map((item, index) => {
          const last = index === tiles.length - 1;
          return <button key={`${item.src}-${item.slot}`} type="button" className={index === 0 ? 'is-hero' : undefined} data-photo-index={item.index} onClick={event => onPhoto(item.index, event.currentTarget)}
            aria-label={last && mosaicMore ? say(`Ver mais ${mosaicMore} fotos`, `Ver ${mosaicMore} fotos más`) : say(`Abrir imagem ${item.index + 1}`, `Abrir imagen ${item.index + 1}`)}>
            <img src={item.src} alt={index === 0 ? pick(item.alt, say) : ''} loading={index ? 'lazy' : 'eager'}/>
            {last && mosaicMore > 0 && <span className="rp-mosaic-more">+{mosaicMore}</span>}
          </button>;
        })}
      </div>
    </section>
    <section className="rp-block">
      <h2>{say('Sobre o empreendimento', 'Acerca del desarrollo')}</h2>
      <p className={`rp-copy${more ? ' is-open' : ''}`}>{description}</p>
      <button type="button" className="rp-link" aria-expanded={more} onClick={() => setMore(value => !value)}>{more ? say('Mostrar menos', 'Mostrar menos') : say('Mostrar mais', 'Mostrar más')}</button>
    </section>
    <section className="rp-block rp-near-block">
      <h2>{say('Onde você vai morar', 'Dónde vas a vivir')}</h2>
      <ul className="rp-near">
        <li><Glyph name="transport"/><span><b>{say('Metrô Polanco', 'Metro Polanco')}</b><small>{say('10 min a pé', '10 min a pie')}</small></span></li>
        <li><Glyph name="green"/><span><b>Parque Lincoln</b><small>{say('4 min a pé', '4 min a pie')}</small></span></li>
        <li><Glyph name="education"/><span><b>{say('Kínder & Primaria Lafontaine', 'Kínder & Primaria Lafontaine')}</b><small>{say('4 min a pé', '4 min a pie')}</small></span></li>
      </ul>
      {!modelFailed && <button type="button" className="rp-secondary is-block" onClick={onCityMode}>{say('Ver na cidade', 'Ver en la ciudad')}</button>}
    </section>
    <section className="rp-block rp-developer" aria-label={say('Incorporadora', 'Desarrolladora')}>
      <div className="rp-reviews" aria-label={say('Avaliações da incorporadora', 'Reseñas de la desarrolladora')}>
        <ListingReviews home={home} advertiser={advertiser} language={language} say={say} compact/>
      </div>
      <div className="rp-developer-card">
        {advertiser.logo
          ? <img className="rp-developer-logo" src={advertiser.logo} alt=""/>
          : <span className="rp-developer-logo is-initials" aria-hidden="true">{advertiser.initials}</span>}
        <p className="rp-developer-name">
          <strong>{advertiser.name}</strong>
          {advertiser.verified && <span className="rp-developer-check" aria-label={say('Incorporadora verificada', 'Desarrolladora verificada')}><RIcon name="check" size={12}/></span>}
        </p>
        <button type="button" className="rp-verified-toggle" aria-expanded={verified} aria-controls="rp-developer-trust" onClick={() => setVerified(value => !value)}>
          <span>{say('Verificado', 'Verificado')}</span><RIcon name="chevron" size={16}/>
        </button>
        {verified && <div className="rp-trust" id="rp-developer-trust">
          <p>{say('Histórico do grupo', 'Historial del grupo')}</p>
          <ul>
            <li><strong>{2026 - DEVELOPER.since}</strong><small>{say('anos no mercado', 'años en el mercado')}</small></li>
            <li><strong>{DEVELOPER.otherProjects}</strong><small>{say('outros empreendimentos', 'otros desarrollos')}</small></li>
          </ul>
        </div>}
      </div>
    </section>
  </>;
}

const SORT_LABEL = {
  floor:['Por andar', 'Por piso'],
  price:['Menor preço', 'Menor precio'],
  'price-desc':['Maior preço', 'Mayor precio'],
  size:['Maior área', 'Mayor superficie'],
};
const VIEW_COPY = {
  norte:['Para o Parque América', 'Hacia el Parque América'],
  sur:['Para o Parque Lincoln', 'Hacia el Parque Lincoln'],
};
const snapPrice = value => Math.round(value / 10_000) * 10_000;
const viewsOf = filters => filters.views?.length ? filters.views : [];
const pricePill = (filters, say) => {
  const [lo, hi] = PRICE_BOUNDS;
  const min = filters.minPrice ?? lo, max = filters.maxPrice ?? hi;
  if (min > lo && max < hi) return `${short(min)} a ${short(max)}`;
  if (max < hi) return say(`Até ${short(max)}`, `Hasta ${short(max)}`);
  if (min > lo) return say(`A partir de ${short(min)}`, `Desde ${short(min)}`);
  return '';
};
const viewPill = (views, say) => {
  if (views.length === 1) return views[0] === 'norte' ? 'Norte' : say('Sul', 'Sur');
  if (views.length === 2) return say('Norte e sul', 'Norte y sur');
  return '';
};

function UnitsView({say, filters, onFilters, sort, onSort, hoverId, onHoverUnit, onUnit, reduce, selectedId}) {
  const list = listedUnits(filters, sort);
  const baseline = listedUnits({...DEFAULT_FILTERS, onlyAvailable:filters.onlyAvailable}, sort).length;
  const groups = groupByTypology(list);
  const rowProps = unit => ({onMouseEnter:() => onHoverUnit(unit.id), onMouseLeave:() => onHoverUnit(null), onFocus:() => onHoverUnit(unit.id), onBlur:() => onHoverUnit(null), onClick:event => onUnit(unit.id, originFrom(event))});
  const from = units => units.filter(unit => unit.status === 'available').map(unit => unit.price);
  return <>
    <UnitsBar say={say} filters={filters} onFilters={onFilters} sort={sort} onSort={onSort} list={list.length} baseline={baseline} reduce={reduce}/>
    {groups.length ? groups.map(({type, units}) => {
      const prices = from(units);
      return <section key={type.id} className="rp-type">
        <div className="rp-type-head">
          <img src={type.plan} alt=""/>
          <span className="rp-type-meta">
            <b>{say(`Tipo ${type.id}`, `Tipo ${type.id}`)}</b>
            <small>{say(`${type.beds} ${type.beds === 1 ? 'quarto' : 'quartos'} · ${type.size} m²`, `${type.beds} ${type.beds === 1 ? 'recámara' : 'recámaras'} · ${type.size} m²`)}{prices.length ? ` · ${say('a partir de', 'desde')} ${formatMoney(Math.min(...prices))}` : ''}</small>
          </span>
        </div>
        <ul className="rp-rows">{units.map(unit => <UnitRow key={unit.id} unit={unit} say={say} hovered={hoverId === unit.id} selected={selectedId === unit.id} {...rowProps(unit)}/>)}</ul>
      </section>;
    }) : <div className="rp-empty">
      <p>{say('Nenhuma unidade coincide com estes filtros.', 'Ninguna unidad coincide con estos filtros.')}</p>
      <button type="button" className="rp-secondary" onClick={() => onFilters({...DEFAULT_FILTERS, onlyAvailable:filters.onlyAvailable})}>{say('Limpar filtros', 'Limpiar filtros')}</button>
    </div>}
  </>;
}

const FLOORS = [...new Set(UNITS.map(unit => unit.floor))].sort((a, b) => b - a);

function UnitsBar({say, filters, onFilters, sort, onSort, list, baseline, reduce}) {
  const [open, setOpen] = useState(null);
  const bar = useRef(null);
  const drawer = useId();
  const set = patch => onFilters({...filters, ...patch});
  const views = viewsOf(filters);
  const floorOn = filters.floor != null;
  const bedsOn = filters.beds != null;
  const priceOn = priceActive(filters);
  const viewOn = views.length > 0;
  const active = filtersActive(filters);
  const toggle = key => setOpen(current => current === key ? null : key);
  const choose = patch => { set(patch); setOpen(null); };
  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && bar.current?.contains(event.target)) return;
      setOpen(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const remaining = patch => listedUnits({...filters, ...patch}).length;
  const availableLeft = patch => listedUnits({...filters, ...patch, onlyAvailable:true}).length;
  const extraOn = sort !== 'floor' || !filters.onlyAvailable;
  const extraLabel = sort !== 'floor' ? say(...SORT_LABEL[sort]) : say('Filtros', 'Filtros');
  return <div ref={bar} className="rp-units-bar">
    <div className="rp-filter-pills" role="toolbar" aria-label={say('Filtros das unidades', 'Filtros de unidades')}>
      <FilterPill open={open === 'floor'} active={floorOn} label={floorOn ? say(`Andar ${filters.floor}`, `Piso ${filters.floor}`) : say('Andar', 'Piso')}
        controls={drawer} onToggle={() => toggle('floor')} onClear={() => { set({floor:null}); if (open === 'floor') setOpen(null); }} say={say}/>
      <FilterPill open={open === 'beds'} active={bedsOn} label={bedsOn ? say(`${filters.beds} qto.`, `${filters.beds} rec.`) : say('Quartos', 'Recámaras')}
        controls={drawer} onToggle={() => toggle('beds')} onClear={() => { set({beds:null}); if (open === 'beds') setOpen(null); }} say={say}/>
      <FilterPill open={open === 'price'} active={priceOn} label={priceOn ? pricePill(filters, say) : say('Preço', 'Precio')}
        controls={drawer} onToggle={() => toggle('price')} onClear={() => { set({minPrice:null, maxPrice:null}); if (open === 'price') setOpen(null); }} say={say}/>
      <FilterPill open={open === 'view'} active={viewOn} label={viewOn ? viewPill(views, say) : say('Vista', 'Vista')}
        controls={drawer} onToggle={() => toggle('view')} onClear={() => { set({views:[]}); if (open === 'view') setOpen(null); }} say={say}/>
      <FilterPill open={open === 'sort'} active={extraOn} label={extraLabel}
        controls={drawer} onToggle={() => toggle('sort')} onClear={() => { onSort('floor'); set({onlyAvailable:true}); if (open === 'sort') setOpen(null); }} say={say}/>
    </div>
    <div className="rp-count">
      <p aria-live="polite">{active
        ? <>{say(`${list} unidades`, `${list} unidades`)} <span>{say(`de ${baseline}`, `de ${baseline}`)}</span></>
        : say(`${list} unidades`, `${list} unidades`)}
      {active && <button type="button" className="rp-clear-link" onClick={() => { onFilters({...DEFAULT_FILTERS, onlyAvailable:filters.onlyAvailable}); setOpen(null); }}>{say('Limpar', 'Limpiar')}</button>}</p>
    </div>
    {open && <div className={`rp-menu${open === 'sort' ? ' is-end' : ''}${open === 'price' || open === 'view' ? ' is-wide' : ''}`} id={drawer} data-reduce={reduce || undefined}>
      {open === 'floor' && <div className="rp-menu-list" role="menu" aria-label={say('Andar', 'Piso')}>
        <button type="button" role="menuitemradio" aria-checked={!floorOn} onClick={() => choose({floor:null})}>{say('Todos os andares', 'Todos los pisos')}</button>
        {FLOORS.map(floor => <button key={floor} type="button" role="menuitemradio" aria-checked={filters.floor === floor} onClick={() => choose({floor})}>
          {say(`Andar ${floor}`, `Piso ${floor}`)}{filters.floor === floor && <RIcon name="check" size={16}/>}
        </button>)}
      </div>}
      {open === 'beds' && <div className="rp-segment" role="radiogroup" aria-label={say('Quartos', 'Recámaras')}>
        {[[null, say('Todas', 'Todas')], [1, '1'], [2, '2'], [3, '3']].map(([beds, label]) => {
          const count = availableLeft({beds});
          const empty = remaining({beds}) === 0 && filters.beds !== beds;
          return <button key={String(beds)} type="button" role="radio" aria-checked={filters.beds === beds} disabled={empty || undefined} onClick={() => choose({beds})}>
            {label}<small>{say(`${count} disp.`, `${count} disp.`)}</small>
          </button>;
        })}
      </div>}
      {open === 'price' && <PricePanel filters={filters} onChange={set} say={say}/>}
      {open === 'view' && <div className="rp-view-grid">
        {SIDES.map(side => {
          const on = views.includes(side);
          const count = availableLeft({views:[side]});
          return <button key={side} type="button" className="rp-view-card" aria-pressed={on} onClick={() => set({views:on ? views.filter(item => item !== side) : [...views, side]})}>
            <Compass side={side}/>
            <b>{side === 'norte' ? 'Norte' : say('Sul', 'Sur')}</b>
            <small>{say(...VIEW_COPY[side])}</small>
            <em>{say(`${count} disp.`, `${count} disp.`)}</em>
          </button>;
        })}
      </div>}
      {open === 'sort' && <div className="rp-menu-list" role="menu" aria-label={say('Ordenar', 'Ordenar')}>
        {SORTS.map(id => <button key={id} type="button" role="menuitemradio" aria-checked={sort === id} onClick={() => { onSort(id); setOpen(null); }}>
          {say(...SORT_LABEL[id])}{sort === id && <RIcon name="check" size={16}/>}
        </button>)}
        <hr/>
        <label className="rp-mini-switch">{say('Só disponíveis', 'Solo disponibles')}
          <input type="checkbox" role="switch" checked={filters.onlyAvailable} onChange={event => set({onlyAvailable:event.target.checked})}/>
        </label>
      </div>}
    </div>}
  </div>;
}

function FilterPill({open, active, label, controls, onToggle, onClear, say}) {
  return <div className="rp-filter-pill" data-active={active || undefined} data-open={open || undefined}>
    <button type="button" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <span>{label}</span>
      {!active && <RIcon name="chevron" size={14}/>}
    </button>
    {active && <button type="button" className="rp-pill-clear" aria-label={say('Limpar este filtro', 'Quitar este filtro')} onClick={onClear}><RIcon name="close" size={10}/></button>}
  </div>;
}

function PricePanel({filters, onChange, say}) {
  const [lo, hi] = PRICE_BOUNDS;
  const min = filters.minPrice ?? lo, max = filters.maxPrice ?? hi;
  const {counts} = priceHistogram();
  const peak = Math.max(1, ...counts);
  const apply = (nextMin, nextMax) => {
    const a = Math.max(lo, Math.min(nextMin, nextMax - 10_000));
    const b = Math.min(hi, Math.max(nextMax, nextMin + 10_000));
    onChange({minPrice:a <= lo ? null : snapPrice(a), maxPrice:b >= hi ? null : snapPrice(b)});
  };
  return <div className="rp-price-panel">
    <div className="rp-price-chart" aria-hidden="true">{counts.map((count, i) => {
      const start = lo + (hi - lo) * i / counts.length, end = lo + (hi - lo) * (i + 1) / counts.length;
      return <i key={i} className={end > min && start < max ? 'is-in' : undefined} style={{height:`${Math.max(6, count / peak * 100)}%`}}/>;
    })}</div>
    <PriceSlider min={min} max={max} lo={lo} hi={hi} onChange={apply} say={say}/>
    <div className="rp-price-fields">
      <label>{say('Mínimo', 'Mínimo')}<input inputMode="numeric" value={formatMoney(min)} onChange={event => apply(Number(event.target.value.replace(/\D/g, '')) || lo, max)}/></label>
      <label>{say('Máximo', 'Máximo')}<input inputMode="numeric" value={formatMoney(max)} onChange={event => apply(min, Number(event.target.value.replace(/\D/g, '')) || hi)}/></label>
    </div>
  </div>;
}

function PriceSlider({min, max, lo, hi, onChange, say}) {
  const track = useRef(null);
  const span = hi - lo || 1;
  const at = clientX => {
    const rect = track.current.getBoundingClientRect();
    return snapPrice(lo + Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * span);
  };
  const start = (event, edge) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const thumb = event.currentTarget;
    const move = point => {
      const value = at(point.clientX);
      onChange(edge === 'min' ? value : min, edge === 'max' ? value : max);
    };
    const finish = point => {
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', finish);
      thumb.removeEventListener('pointercancel', finish);
      if (thumb.hasPointerCapture?.(point.pointerId)) thumb.releasePointerCapture(point.pointerId);
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', finish);
    thumb.addEventListener('pointercancel', finish);
    thumb.setPointerCapture?.(event.pointerId);
  };
  return <div className="rp-price-slider" ref={track}>
    <i className="rp-price-range" style={{left:`${(min - lo) / span * 100}%`, right:`${(hi - max) / span * 100}%`}}/>
    {[['min', min, say('Preço mínimo', 'Precio mínimo')], ['max', max, say('Preço máximo', 'Precio máximo')]].map(([edge, value, label]) =>
      <button key={edge} type="button" role="slider" aria-label={label} aria-valuemin={edge === 'min' ? lo : min} aria-valuemax={edge === 'min' ? max : hi}
        aria-valuenow={value} aria-valuetext={formatMoney(value)} style={{left:`${(value - lo) / span * 100}%`}}
        onPointerDown={event => start(event, edge)}/>)}
  </div>;
}

function Compass({side}) {
  return <svg className="rp-compass" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style={{transform:side === 'sur' ? 'rotate(180deg)' : undefined}}>
    <circle cx="18" cy="18" r="16" fill="#fff" stroke="#ebebeb"/>
    <path d="M18 5l4.5 13H13.5Z" fill="#e32636"/>
    <path d="M18 31l4.5-13H13.5Z" fill="#d0d0d0"/>
  </svg>;
}

function UnitRow({unit, say, hovered, selected, ...handlers}) {
  const muted = unit.status !== 'available';
  return <li><button type="button" className="rp-row" data-unit={unit.id} data-hovered={hovered || undefined} data-selected={selected || undefined} data-muted={muted || undefined} {...handlers}
    aria-label={`${say('Unidade', 'Unidad')} ${unit.id}, ${say('andar', 'piso')} ${unit.floor}, ${orientationLabel(unit, say)}, ${formatMoney(unit.price)}, ${statusLabel(unit.status, say)}`}>
    <span><b>{unit.id}</b><small>{say(`Andar ${unit.floor}`, `Piso ${unit.floor}`)} · {orientationLabel(unit, say)}</small></span>
    <span><b>{formatMoney(unit.price)}</b><StatusPill status={unit.status} say={say}/></span>
  </button></li>;
}

function UnitLayer({unit, home, say, reduce, origin, morphId, onUnit, onHoverUnit, onWindow, onLeaveWindow, windowId, mode, onPlanMode, onPhoto, onOpenChat, modelFailed, hoverId, inert}) {
  const {language} = useLanguage();
  const type = TYPOLOGIES.find(item => item.id === unit.typology);
  const similar = similarUnits(unit);
  const fromRow = !reduce && origin && morphId === unit.id;
  const travel = fromRow ? origin.top - SCROLL_PAD + ROW_PAD : 0;
  const facts = rise(reduce);
  const specs = [
    ['area', `${unit.size} m²`, say('Área', 'Superficie')],
    ['bed', unit.beds, say(unit.beds === 1 ? 'Quarto' : 'Quartos', unit.beds === 1 ? 'Recámara' : 'Recámaras')],
    ['bath', unit.baths, say(unit.baths === 1 ? 'Banheiro' : 'Banheiros', unit.baths === 1 ? 'Baño' : 'Baños')],
    ...(unit.parking ? [['car', unit.parking, say(unit.parking === 1 ? 'Vaga' : 'Vagas', unit.parking === 1 ? 'Estac.' : 'Estac.')]] : []),
    ['floor', say(`${unit.floor}º`, `${unit.floor}`), say('Andar', 'Piso')],
  ];
  const rowProps = item => ({onMouseEnter:() => onHoverUnit(item.id), onMouseLeave:() => onHoverUnit(null), onFocus:() => onHoverUnit(item.id), onBlur:() => onHoverUnit(null), onClick:() => onUnit(item.id)});
  const sheet = {
    hidden:{opacity:1, transform:travel ? `translateY(${travel}px)` : 'translateY(0px)'},
    show:{opacity:1, transform:'translateY(0px)', transition:travel ? SPRING_MORPH : {duration:0}},
    exit:{opacity:0, transition:{duration:0.12}},
  };
  const meta = {
    hidden:{},
    show:{transition:{delayChildren:reduce ? 0 : (travel ? 0.1 : 0.04), staggerChildren:reduce ? 0 : 0.04}},
  };
  const body = {
    hidden:{},
    show:{transition:{delayChildren:reduce ? 0 : (travel ? CONTENT_DELAY / 1000 : 0.08), staggerChildren:reduce ? 0 : 0.05}},
  };
  const specList = {hidden:{}, show:{transition:{staggerChildren:reduce ? 0 : 0.04}}};
  const place = say(`Tipo ${type.id} · Andar ${unit.floor} · Vista ${orientationLabel(unit, say).toLowerCase()}`, `Tipo ${type.id} · Piso ${unit.floor} · Vista ${orientationLabel(unit, say).toLowerCase()}`);
  return <motion.div className="rp-unit-layer" aria-label={say(`Unidade ${unit.id}`, `Unidad ${unit.id}`)} inert={inert || undefined} aria-hidden={inert || undefined} {...layerMorph(reduce, origin)}>
    <div className="rp-scroll">
      <AnimatePresence mode="wait">
        <motion.div key={unit.id} className="rp-unit-sheet" variants={sheet} initial="hidden" animate="show" exit="exit">
          <motion.header className="rp-identity" variants={{hidden:{opacity:1}, show:{opacity:1}}}>
            <motion.h1 variants={titleMotion(reduce, travel)} style={travel ? {transformOrigin:'0 0'} : undefined}>{say(`Unidade ${unit.id}`, `Unidad ${unit.id}`)}</motion.h1>
            {travel ? <>
              <p className="rp-area">{place}</p>
              <StatusPill status={unit.status} say={say}/>
            </> : <motion.div variants={meta}>
              <motion.p className="rp-area" variants={facts}>{place}</motion.p>
              <motion.span variants={facts}><StatusPill status={unit.status} say={say}/></motion.span>
            </motion.div>}
          </motion.header>
          <motion.div className="rp-content" variants={body}>
            {(unit.status !== 'sold' || !modelFailed) && <motion.div className="rp-offer" variants={facts}>
              {unit.status !== 'sold' && <section className="rp-block rp-price">
                <p className="rp-price-main">{formatMoney(unit.price)} MXN</p>
                <p className="rp-muted">{formatMoney(unit.perMeter)} / m²</p>
              </section>}
              {!modelFailed && <button type="button" className="mini-secondary rp-window" aria-pressed={windowId === unit.id || undefined} onClick={() => windowId === unit.id ? onLeaveWindow() : onWindow(unit)}><Glyph name="view" size={18}/>{windowId === unit.id ? say('Voltar à torre', 'Volver a la torre') : say('Conferir vista da janela', 'Ver la vista de la ventana')}</button>}
            </motion.div>}
            <motion.ul className="pp-specs rp-unit-specs" variants={specList}>{specs.map(([icon, value, label]) => <motion.li key={icon} variants={facts}>
              <img src={specAsset(icon)} alt=""/>
              <span><strong>{value}</strong><small>{label}</small></span>
            </motion.li>)}</motion.ul>
            <motion.section className="rp-block rp-mora" variants={facts} aria-label={say('Mora sobre esta unidade', 'Mora sobre esta unidad')}>
              <MoraInsight home={home} {...tourReading(home, language, unit)} short={formatMoney} say={say} variant="verdict" label={say('Sobre esta unidade', 'Sobre esta unidad')}/>
              <p className="pp-mora-note">{moraNote(say)}</p>
            </motion.section>
            <motion.section className="rp-block rp-plan" variants={facts}>
              <h2>{say('Planta', 'Planta')}</h2>
              <div className="rp-plan-frame">
                <button type="button" className="rp-plan-image" onClick={() => onPhoto({src:unit.plan, alt:say(`Planta do tipo ${type.id}`, `Planta del tipo ${type.id}`)})} aria-label={say('Ampliar planta', 'Ampliar planta')}>
                  <img src={unit.plan} alt={say(`Planta do tipo ${type.id}`, `Planta del tipo ${type.id}`)}/><span className="rp-plan-zoom"><RIcon name="zoom" size={18}/></span>
                </button>
                {!modelFailed && <button type="button" className="rp-plan-building" aria-pressed={mode === 'plan'} onClick={() => onPlanMode(mode !== 'plan')}>{say('Ver sobre o prédio', 'Ver sobre el edificio')}</button>}
              </div>
            </motion.section>
            {similar.length > 0 && <motion.section className="rp-block" variants={facts}>
              <h2>{say('Unidades parecidas', 'Unidades similares')}</h2>
              <ul className="rp-rows">{similar.map(item => <UnitRow key={item.id} unit={item} say={say} hovered={hoverId === item.id} selected={false} {...rowProps(item)}/>)}</ul>
            </motion.section>}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  </motion.div>;
}
