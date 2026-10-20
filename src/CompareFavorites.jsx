import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, LayoutGroup, motion, useAnimate, useInView, useReducedMotion} from 'motion/react';
import agencies from '../AGENCY-SOURCES.json';
import {Icon} from './App';
import {RailListingCopy} from './Home';
import {useLanguage} from './i18n';
import {PRICE_BANDS, TRAVEL_MODES, byPricePerM2, compareReading} from './compareReading';
import {AmenityIcon} from './MapWidgetStack';
import {textOf} from './mapWidgetContent';
import {contactRecipient, contactValidation, createContactReceipt, normalizeContactProfile} from './contactFlow';
import {EASE, EASE_IN_OUT, EASE_OUT, riseIn, useMediaQuery} from './favoriteMotion';
import {SOFT_MOTION} from './homeIntro.js';
import {markVisit} from './seekerSignals.js';

const MAX_COLUMNS = 6;
const COMPARING_MS = 600, SEND_MS = 2500, MORPH_MS = 280, SWEEP_MS = 600;
const summaryWords = summary => `${summary.lead} ${summary.text}`.trim().split(/\s+/).length;
const LOGO_STAGGER = 0.04, LOGO_FADE = 0.15;
const MORA_MARK = '/assets/mini-listing/mora.svg';
const PRICE_TAG_ICON = '/assets/compare/best-price.svg';

function useSay() {
  const {language, compactMoney} = useLanguage();
  const pt = language === 'pt-BR';
  return {language, compactMoney, pt, say:(br, es) => pt ? br : es};
}

function shortDate(iso, language) {
  return new Intl.DateTimeFormat(language === 'pt-BR' ? 'pt-BR' : 'es-MX', {day:'numeric', month:'short'}).format(new Date(iso)).replace(/\.$/, '');
}

function recipientOf(home, language) {
  const recipient = contactRecipient(home, agencies.logos, language);
  const name = recipient.verified ? recipient.name : language === 'pt-BR' ? `o anunciante de ${home.street}` : `el anunciante de ${home.street}`;
  return {...recipient, display:name};
}

/** Two layers share one grid cell so the outgoing value fades over the incoming one without a jump. */
function Crossfade({id, className = '', layout = false, children}) {
  return <motion.span className={`compare-stack ${className}`} layout={layout ? 'position' : undefined}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className="compare-stack-layer" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2, ease:EASE}}>{children}</motion.span>
    </AnimatePresence>
  </motion.span>;
}

function RollingCount({value, reduce}) {
  const enter = reduce ? {opacity:0} : {opacity:0, transform:'translateY(100%)'};
  const leave = reduce ? {opacity:0} : {opacity:0, transform:'translateY(-100%)'};
  return <span className="compare-count">
    <AnimatePresence initial={false}>
      <motion.span key={value} initial={enter} animate={{opacity:1, transform:'translateY(0%)'}} exit={leave} transition={{duration:0.2, ease:EASE_OUT}}>{value}</motion.span>
    </AnimatePresence>
  </span>;
}

function Logos({recipients, animate}) {
  return <span className="compare-logos" aria-hidden="true">
    {recipients.map((recipient, index) => <motion.span key={recipient.display} className="compare-logo"
      initial={animate ? {opacity:0, transform:'scale(0.95)'} : false} animate={{opacity:1, transform:'scale(1)'}}
      transition={{duration:LOGO_FADE, ease:EASE_OUT, delay:index * LOGO_STAGGER}}>
      {recipient.logo ? <img src={recipient.logo} alt=""/> : <Icon name="home" size={14}/>}
    </motion.span>)}
  </span>;
}

/** The 24px icon disc lands as its column's price bar settles, unrolls to the right to reveal the label, then one light pass crosses it. */
const BEST_OPEN = 'inset(-10px -10px -14px -10px round 24px)';
function BestTag({index, reduce, label}) {
  const [scope, animate] = useAnimate();
  const inView = useInView(scope, {once:true, amount:0.5});
  const [swept, setSwept] = useState(false);
  useEffect(() => {
    const el = scope.current;
    if (!inView || !el) return;
    const delay = index * 0.05 + 0.24;
    if (reduce) {animate(el, {opacity:1}, {duration:0.2, ease:EASE_OUT, delay}); return;}
    const disc = `inset(2px ${el.offsetWidth - 28}px 2px 4px round 12px)`;
    animate([
      [el, {opacity:[0, 1], transform:['scale(0.9)', 'scale(1)'], clipPath:[disc, disc]}, {duration:0.16, ease:EASE_OUT, delay}],
      [el, {clipPath:BEST_OPEN}, {duration:0.28, ease:EASE_OUT, at:'-0.04'}],
    ]).then(() => setSwept(true));
  }, [inView]);
  return <motion.span ref={scope} className="compare-best-tag" data-sweep={swept || undefined} initial={{opacity:0}}
    exit={{opacity:0, transition:{duration:0.15, ease:EASE_OUT}}}>
    <img src={PRICE_TAG_ICON} alt="" width="16" height="16"/>
    <span className="compare-best-label">{label}</span>
  </motion.span>;
}

/** Mora writes each reading with the home sentence's word cadence. */
function StreamedSummary({lead, text, animate}) {
  const leadWords = lead ? lead.split(/\s+/) : [];
  const word = (chunk, index) => <React.Fragment key={index}>
    {index > 0 && ' '}
    <span className="compare-word" style={animate ? {animationDelay:`${index * SOFT_MOTION.wordStep}ms`, animationDuration:`${SOFT_MOTION.fade}ms`} : undefined}>{chunk}</span>
  </React.Fragment>;
  return <p className="compare-summary" data-streaming={animate || undefined}>
    {leadWords.length > 0 && <strong>{leadWords.map(word)}</strong>}
    {text.split(/\s+/).map((chunk, index) => word(chunk, leadWords.length + index))}
  </p>;
}

function PriceBar({band, position, index, animate}) {
  const enter = {duration:0.24, ease:EASE_OUT, delay:index * 0.05};
  const inView = {viewport:{once:true, amount:1}};
  return <span className="compare-bar" aria-hidden="true">
    {PRICE_BANDS.map(item => <span key={item.id} className="compare-bar-band" data-band={item.id} style={{left:`${item.start * 100}%`, width:`${(item.end - item.start) * 100}%`}}>
      {item.id === band && (animate
        ? <motion.span className="compare-bar-fill" initial={{opacity:0}} whileInView={{opacity:1}} {...inView} transition={enter}/>
        : <span className="compare-bar-fill"/>)}
    </span>)}
    {animate
      ? <motion.span className="compare-bar-dot" data-band={band} style={{left:`${position * 100}%`}} initial={{opacity:0, x:-4}} whileInView={{opacity:1, x:0}} {...inView} transition={enter}/>
      : <span className="compare-bar-dot" data-band={band} style={{left:`${position * 100}%`}}/>}
  </span>;
}

const MODE_LABELS = {walk:['A pé', 'A pie'], bike:['Bike', 'Bici'], car:['Carro', 'Auto']};
function TravelModes({mode, onChange, reduce, hidden}) {
  const {say} = useSay();
  const group = useId();
  return <div className="compare-modes" role="group" aria-label={say('Como você vai', 'Cómo te mueves')} aria-hidden={hidden || undefined}>
    {TRAVEL_MODES.map(item => <button key={item} type="button" aria-pressed={item === mode} tabIndex={hidden ? -1 : undefined} onClick={() => onChange(item)}>
      {item === mode && <motion.span className="compare-modes-pill" layoutId={`${group}-pill`} transition={reduce ? {duration:0} : {duration:0.2, ease:EASE_OUT}}/>}
      <span className="compare-modes-label">{say(...MODE_LABELS[item])}</span>
    </button>)}
  </div>;
}

function NearbyPlaces({places, mode, fastest}) {
  const {say, language} = useSay();
  const modeName = say(...MODE_LABELS[mode]).toLowerCase();
  return <ul className="compare-places">
    {places.map(place => {
      const minutes = place.minutes[mode];
      const name = textOf(place.name, language);
      const best = fastest[place.kind] === minutes;
      return <li key={place.kind} className="compare-place" data-best={best || undefined} title={name}>
        <AmenityIcon kind={place.kind}/>
        <span className="compare-place-name" aria-hidden="true">{name}</span>
        <strong aria-hidden="true"><Crossfade id={minutes}>{minutes} min</Crossfade></strong>
        <span className="sr-only">{`${name}: ${minutes} min ${modeName}${best ? say(', o mais rápido da comparação', ', el más rápido de la comparación') : ''}`}</span>
      </li>;
    })}
  </ul>;
}

/** The search bar's Onda sweep, at half its 1200 ms, once the composer has folded back into the pill. */
function SentSweep() {
  const light = useRef(null);
  useLayoutEffect(() => {
    const el = light.current, width = el.parentElement.offsetWidth;
    el.style.width = `${width * 3}px`;
    const run = el.animate([{transform:`translateX(${-width * 3}px)`}, {transform:`translateX(${width}px)`}],
      {duration:SWEEP_MS, delay:MORPH_MS, easing:'linear', fill:'both'});
    return () => run.cancel();
  }, []);
  return <span className="transition-bar-wash" aria-hidden="true"><span ref={light} className="transition-bar-sweep"/></span>;
}

const CHIPS = [
  {id:'weekend', es:['Visita este fin de semana', '¿Puede ser este fin de semana?'], br:['Visita neste fim de semana', 'Pode ser neste fim de semana?']},
  {id:'negotiable', es:['¿Es negociable?', '¿El precio es negociable?'], br:['É negociável?', 'O preço é negociável?']},
];

function Composer({recipients, profile, mobile, reduce, morph, pending, onCancel, onSend}) {
  const {say, pt} = useSay();
  const prefix = useId();
  const root = useRef(null), title = useRef(null), timer = useRef(null), cancel = useRef(onCancel);
  cancel.current = onCancel;
  const chips = CHIPS.map(chip => ({id:chip.id, label:chip[pt ? 'br' : 'es'][0], line:chip[pt ? 'br' : 'es'][1]}));
  const [text, setText] = useState(() => `${say('Olá, tenho interesse neste imóvel e gostaria de visitá-lo.', 'Hola, me interesa este inmueble y me gustaría visitarlo.')}\n${chips[0].line}`);
  const [data, setData] = useState(() => normalizeContactProfile(profile));
  const known = useMemo(() => {
    const errors = contactValidation({profile, channel:'whatsapp', message:'Contacto de prueba'});
    return {name:!errors.name, phone:!errors.phone};
  }, []);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState({}), [sending, setSending] = useState(false), [failure, setFailure] = useState('');
  const showName = editing || !known.name, showPhone = editing || !known.phone;
  const count = recipients.length;

  useLayoutEffect(() => {title.current?.focus({preventScroll:true});}, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    function key(event) {
      if (event.key === 'Escape' && !pending.current) {event.preventDefault(); cancel.current();}
      if (event.key === 'Tab' && mobile && root.current) {
        const items = [...root.current.querySelectorAll('button,textarea,input')].filter(item => !item.disabled);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
      }
    }
    function outside(event) {
      if (mobile || pending.current || root.current?.contains(event.target) || event.target.closest?.('.compare-cta')) return;
      cancel.current();
    }
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    return () => {document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside);};
  }, [mobile]);

  const swap = {initial:{opacity:0}, animate:{opacity:1}, exit:{opacity:0}, transition:{duration:reduce ? 0.2 : 0.18, ease:EASE_OUT, layout:morph}};
  function edit() {
    setEditing(true);
    requestAnimationFrame(() => root.current?.querySelector('.compare-composer-fields input')?.focus({preventScroll:true}));
  }
  function toggle(line) {
    setErrors(current => ({...current, message:undefined}));
    setText(current => current.includes(line)
      ? current.replace(`\n${line}`, '').replace(line, '').trim()
      : `${current.trim()}\n${line}`);
  }
  function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const {name, phone, message} = contactValidation({profile:data, channel:'whatsapp', message:text});
    const next = Object.fromEntries(Object.entries({name, phone, message}).filter(([, value]) => value));
    setErrors(next); setFailure('');
    if (Object.keys(next).length) {
      if ((next.name && !showName) || (next.phone && !showPhone)) setEditing(true);
      requestAnimationFrame(() => root.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    pending.current = true; setSending(true);
    timer.current = setTimeout(() => {
      try { onSend(normalizeContactProfile(data), text.trim()); }
      catch {
        pending.current = false; setSending(false);
        setFailure(say('Não foi possível registrar o envio. Tente novamente.', 'No se pudo registrar el envío. Inténtalo de nuevo.'));
      }
    }, SEND_MS);
  }
  const fieldError = name => name === 'name'
    ? say('Digite seu nome, com pelo menos 2 letras.', 'Escribe tu nombre, con al menos 2 letras.')
    : say('Inclua + e o código do país, como +52 55 1234 5678.', 'Incluye + y el código del país, como +52 55 1234 5678.');
  const field = (name, label, type, placeholder, autoComplete) => <label className="mini-field" htmlFor={`${prefix}-${name}`}>
    <span>{label}</span>
    <input id={`${prefix}-${name}`} name={name} type={type} inputMode={type === 'tel' ? 'tel' : 'text'} autoComplete={autoComplete} value={data[name]} placeholder={placeholder} maxLength={name === 'name' ? 80 : 120}
      aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined}
      onChange={event => {const value = event.target.value; setData(current => ({...current, [name]:value})); setErrors(current => ({...current, [name]:undefined}));}}/>
    {errors[name] && <span className="mini-field-error" id={`${prefix}-${name}-error`}>{fieldError(name)}</span>}
  </label>;

  return <form ref={root} className="compare-composer" role="dialog" aria-modal={mobile || undefined} aria-labelledby={`${prefix}-title`} aria-busy={sending} noValidate onSubmit={submit}>
      <div className="compare-composer-head">
        <Logos recipients={recipients} animate={!reduce}/>
        <h2 id={`${prefix}-title`} ref={title} tabIndex={-1}>{count === 1 ? say(`Enviar mensagem de interesse para ${recipients[0].display}`, `Enviar mensaje de interés a ${recipients[0].display}`) : say(`Enviar mensagem de interesse para ${count} imobiliárias`, `Enviar mensaje de interés a ${count} inmobiliarias`)}</h2>
        <button type="button" className="compare-composer-close" onClick={onCancel} disabled={sending} aria-label={say('Fechar mensagem', 'Cerrar mensaje')}><Icon name="close" size={18}/></button>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {showName || showPhone
          ? <motion.div key="fields" className="mini-fields compare-composer-fields" layout {...swap}>
            {showName && field('name', say('Seu nome', 'Tu nombre'), 'text', say('Nome e sobrenome', 'Nombre y apellido'), 'name')}
            {showPhone && field('phone', 'WhatsApp', 'tel', '+52 55 1234 5678', 'tel')}
          </motion.div>
          : <motion.div key="reuse" className="compare-composer-reuse" layout {...swap}>
            <p>{say('Vão escrever para', 'Te escribirán a')} <strong>{data.name}</strong></p>
            <p><span className="compare-composer-phone">{data.phone}</span> • <button className="compare-composer-change" type="button" onClick={edit}>{say('Alterar', 'Cambiar')}</button></p>
          </motion.div>}
      </AnimatePresence>
      <label className="sr-only" htmlFor={`${prefix}-message`}>{say('Sua mensagem', 'Tu mensaje')}</label>
      <motion.textarea id={`${prefix}-message`} className="compare-composer-text" value={text} rows={4} maxLength={1200} layout="position" transition={{layout:morph}}
        aria-invalid={!!errors.message} aria-describedby={errors.message ? `${prefix}-message-error` : undefined}
        onChange={event => {setText(event.target.value); setErrors(current => ({...current, message:undefined}));}}/>
      {errors.message && <span className="mini-field-error" id={`${prefix}-message-error`}>{say('Escreva uma mensagem de pelo menos 10 caracteres.', 'Escribe un mensaje de al menos 10 caracteres.')}</span>}
      <motion.div className="compare-chips" role="group" aria-label={say('Adicionar à mensagem', 'Agregar al mensaje')} layout="position" transition={{layout:morph}}>
        {chips.map(chip => <button key={chip.id} type="button" aria-pressed={text.includes(chip.line)} onClick={() => toggle(chip.line)}>{chip.label}</button>)}
      </motion.div>
      {failure && <p role="alert" className="mini-field-error">{failure}</p>}
      <motion.p className="compare-composer-share" layout="position" transition={{layout:morph}}>{count === 1
        ? say('Ao clicar no botão abaixo, você concorda em compartilhar seus dados com 1 imobiliária.', 'Al hacer clic en el botón de abajo, aceptas compartir tus datos con 1 inmobiliaria.')
        : say(`Ao clicar no botão abaixo, você concorda em compartilhar seus dados com ${count} imobiliárias.`, `Al hacer clic en el botón de abajo, aceptas compartir tus datos con ${count} inmobiliarias.`)}</motion.p>
      <motion.div className="compare-composer-send-wrap" layoutId="compare-cta" transition={{layout:morph}}>
        <button className="mini-primary compare-composer-send" aria-disabled={sending || undefined}>
          <Crossfade id={sending ? 'sending' : 'send'} layout>{sending ? say('Enviando…', 'Enviando…') : say('Enviar mensagem', 'Enviar mensaje')}</Crossfade>
        </button>
      </motion.div>
    </form>;
}

export function CompareFavorites({folderName, meta, homes, hiddenIds = [], onHide, onShowAll, receipts = [], profile, onProfile, onReceipts, intro = false, onIntroSeen, onClose, onOpen, onExplore, backLabel, onShare, startContact = null}) {
  const {language, compactMoney, say} = useSay();
  const reduce = useReducedMotion();
  const mobile = useMediaQuery('(max-width: 700px)');
  const heading = useRef(null), page = useRef(null), rail = useRef(null), bar = useRef(null), cta = useRef(null), copy = useRef(null), sending = useRef(false);
  const [run, setRun] = useState(0);
  const [revealed, setRevealed] = useState(() => reduce ? Infinity : 0);
  const [offset, setOffset] = useState(0);
  const [travel, setTravel] = useState('walk');
  const [deselected, setDeselected] = useState(() => new Set());
  const [hoverRow, setHoverRow] = useState(null);
  const [stage, setStage] = useState('idle');
  const [batch, setBatch] = useState(null);
  const [shareUrl, setShareUrl] = useState(null), [copied, setCopied] = useState(false);
  /** A local link: it carries only the folder id, and this browser keeps the snapshot that opens it. */
  function share() {
    onShare(url => {
      if (!url) return;
      setShareUrl(url);
      navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
    });
  }

  useLayoutEffect(() => {heading.current?.focus({preventScroll:true});}, []);
  useEffect(() => {if (intro) onIntroSeen?.();}, []);
  useLayoutEffect(() => {
    const el = bar.current, host = page.current;
    if (!el || !host) return;
    // The open composer reuses the dock; only the pill's height should pad the rail.
    const observer = new ResizeObserver(() => {if (!el.dataset.open) host.style.setProperty('--compare-bar-height', `${el.offsetHeight}px`);});
    observer.observe(el);
    return () => observer.disconnect();
  }, [homes.length > hiddenIds.length]);

  const shown = byPricePerM2(homes.filter(home => !hiddenIds.includes(home.id)));
  const visible = shown.length > MAX_COLUMNS ? byPricePerM2(Array.from({length:MAX_COLUMNS}, (_, step) => shown[(offset + step) % shown.length])) : shown;
  const visibleKey = visible.map(home => home.id).join('|');
  const reading = useMemo(() => compareReading(visible, language), [visibleKey, language]);
  // One column at a time: each waits on "Comparando…" until the previous one has written its last word.
  useEffect(() => {
    if (reduce) {setRevealed(Infinity); return;}
    setRevealed(0);
    const ids = [];
    let at = COMPARING_MS;
    reading.cards.forEach((card, index) => {
      ids.push(setTimeout(() => setRevealed(index + 1), at));
      at += summaryWords(card.summary) * SOFT_MOTION.wordStep;
    });
    ids.push(setTimeout(() => setRevealed(Infinity), at));
    return () => ids.forEach(clearTimeout);
  }, [run, reduce]);
  const comparing = revealed < reading.cards.length;
  const contactedAt = new Map();
  for (const receipt of receipts) {
    const previous = contactedAt.get(receipt.propertyId);
    if (!previous || receipt.createdAt < previous) contactedAt.set(receipt.propertyId, receipt.createdAt);
  }
  const open = visible.filter(home => !contactedAt.has(home.id));
  const selected = open.filter(home => !deselected.has(home.id));
  const recipients = selected.map(home => recipientOf(home, language));
  const sentMode = stage === 'sent' || (stage === 'idle' && visible.length > 0 && open.length === 0);
  function compareOthers() {
    setOffset(current => (current + MAX_COLUMNS) % shown.length);
    rail.current?.scrollTo({left:0, behavior:reduce ? 'auto' : 'smooth'});
    setRevealed(reduce ? Infinity : 0);
    setRun(current => current + 1);
  }
  function toggle(home) {
    setDeselected(current => {
      const next = new Set(current);
      if (next.has(home.id)) next.delete(home.id); else next.add(home.id);
      return next;
    });
  }
  function request() {
    if (stage !== 'idle' || sentMode || !selected.length) return;
    setStage('composer');
  }
  const latestRequest = useRef(request);
  latestRequest.current = request;
  // The guide asks for the batch composer: every open home selected, after the columns have settled.
  useEffect(() => {
    if (!startContact) return;
    setDeselected(new Set());
    const id = setTimeout(() => latestRequest.current(), reduce ? 60 : 640);
    return () => clearTimeout(id);
  }, [startContact]);
  function closeComposer() {
    setStage('idle');
    requestAnimationFrame(() => cta.current?.focus({preventScroll:true}));
  }
  function send(data, text) {
    const created = selected.map(home => createContactReceipt({
      home, broker:recipientOf(home, language), intent:'visit', channel:'whatsapp', profile:data,
      message:`${text}\n\n${home.street}, ${home.area} (${say('anúncio', 'anuncio')} ${home.listingId})`,
    }));
    selected.forEach(home => markVisit(home.id));
    onProfile({...profile, ...data});
    onReceipts(created);
    setBatch({ids:selected.map(home => home.id), receiptIds:created.map(receipt => receipt.id), names:recipients.map(item => item.display)});
    setStage('sent');
    requestAnimationFrame(() => copy.current?.focus({preventScroll:true}));
  }

  const ctaState = !selected.length ? 'none' : selected.length === 1 && open.length === 1 && open.length < visible.length ? 'remaining'
      : selected.length === 1 ? 'one' : 'many';
  const ctaLabel = {
    none:say('Escolha pelo menos uma', 'Elige al menos una'),
    remaining:say('Contatar a imobiliária que falta', 'Contactar la inmobiliaria que falta'),
    one:say('Solicitar visita', 'Solicitar visita'),
    many:<>{say('Contatar', 'Contactar')}<RollingCount value={selected.length} reduce={reduce}/>&nbsp;{say('imobiliárias', 'inmobiliarias')}</>,
  }[ctaState];
  const inactive = ctaState === 'none';
  const composing = stage === 'composer';
  const morph = reduce ? {duration:0} : {duration:MORPH_MS / 1000, ease:EASE_IN_OUT};
  const layer = {duration:reduce ? 0.2 : 0.18, ease:EASE_OUT};
  const corner = composing ? 24 : 32, foot = composing && mobile ? 0 : corner;

  const barLine = sentMode
    ? batch
      ? (batch.ids.length === 1 ? say(`Pronto! ${batch.names[0]} já tem sua mensagem e vai responder pelo WhatsApp.`, `¡Listo! ${batch.names[0]} ya tiene tu mensaje y te responderá por WhatsApp.`) : say(`Pronto! ${batch.ids.length} imobiliárias já têm sua mensagem e vão responder pelo WhatsApp.`, `¡Listo! ${batch.ids.length} inmobiliarias ya tienen tu mensaje y te responderán por WhatsApp.`))
      : say('Você já falou com as imobiliárias desta comparação.', 'Ya hablaste con las inmobiliarias de esta comparación.')
    : selected.length
      ? say('Uma só mensagem. Cada imobiliária responde pelo WhatsApp.', 'Un solo mensaje. Cada inmobiliaria te responde por WhatsApp.')
      : say('Marque pelo menos um imóvel para enviar a mensagem.', 'Marca al menos un inmueble para enviar el mensaje.');

  const labels = {
    highlight:say('O que se destaca', 'Lo que destaca'),
    price:say('Preço por m²', 'Precio por m²'),
    nearby:say('O que tem perto', 'Qué hay cerca'),
  };
  const rows = ['card', 'highlight', 'price', 'nearby'];
  const fastest = {};
  if (reading.cards.length > 1) {
    const times = {};
    for (const card of reading.cards) for (const place of card.nearby) (times[place.kind] ??= []).push(place.minutes[travel]);
    for (const [kind, list] of Object.entries(times)) if (Math.min(...list) < Math.max(...list)) fastest[kind] = Math.min(...list);
  }
  const rowProps = row => ({
    onPointerEnter:event => {if (event.pointerType === 'mouse') setHoverRow(row);},
    onPointerLeave:() => setHoverRow(null),
  });
  const label = row => <h3 className="compare-row-label" {...rowProps(row)}>
    {row === 'highlight' && <img src={MORA_MARK} alt="" width="16" height="16"/>}{labels[row]}
  </h3>;
  const cell = (row, extra = {}) => ({className:'compare-cell', 'data-row':row, 'data-active':hoverRow === row || undefined, ...extra});
  const count = homes.length;
  return <article className="compare-page" ref={page}>
    <header className="compare-page-header">
      <div className="compare-page-heading">
        <button className="compare-back" type="button" onClick={onClose} aria-label={backLabel || say('Voltar para favoritos', 'Volver a favoritos')}>
          <Icon name="back" size={20}/>
        </button>
        <motion.div {...riseIn(reduce, 0, 6)}>
          <h1 ref={heading} tabIndex={-1}>{count ? say('Compare seus favoritos', 'Compara tus favoritos') : folderName}</h1>
          {count > 0 && <p className="compare-folder-meta">{folderName}{meta ? ` · ${meta}` : ''}</p>}
          {count === 0 && <p className="compare-empty-copy">{say('Esta pasta está vazia. Toque no coração de um imóvel para salvá-lo aqui.', 'Esta carpeta está vacía. Toca el corazón de un inmueble para guardarlo aquí.')}</p>}
          {count > 0 && !shown.length && <p className="compare-empty-copy">{say('Você tirou todos desta comparação. Eles continuam salvos na pasta.', 'Quitaste todos de esta comparación. Siguen guardados en la carpeta.')}</p>}
          {shareUrl && <p className="compare-share-link" role="status">
            {copied ? say('Link copiado. Abra neste navegador para ver a pasta: ', 'Enlace copiado. Ábrelo en este navegador para ver la carpeta: ') : say('Abra este link neste navegador para ver a pasta: ', 'Abre este enlace en este navegador para ver la carpeta: ')}
            <a href={shareUrl} target="_blank" rel="noopener noreferrer">{shareUrl.replace(/^https?:\/\//, '')}</a>
          </p>}
        </motion.div>
      </div>
      {(shown.length > MAX_COLUMNS || hiddenIds.length > 0 || (onShare && count > 0)) && <motion.div className="compare-header-actions" {...riseIn(reduce, 1, 6)}>
        {hiddenIds.length > 0 && <button className="mini-text-action" type="button" onClick={onShowAll}>{say(`Mostrar todos (${count})`, `Mostrar todos (${count})`)}</button>}
        {shown.length > MAX_COLUMNS && <button className="mini-secondary compare-more" type="button" onClick={compareOthers}>{say('Comparar outros', 'Comparar otros')}</button>}
        {onShare && count > 0 && <button className="mini-secondary compare-share" type="button" onClick={share}>{say('Compartilhar', 'Compartir')}</button>}
      </motion.div>}
    </header>

    {visible.length > 0 && <div className="compare-rail" ref={rail} role="list" aria-busy={comparing || undefined} style={{gridTemplateRows:`repeat(${rows.length}, auto)`}}>
      <AnimatePresence mode="popLayout">
        {reading.cards.map((card, index) => {
          const home = card.home;
          const contacted = contactedAt.has(home.id);
          const isSelected = !contacted && !deselected.has(home.id);
          const recipient = recipientOf(home, language);
          const rise = riseIn(reduce, index + 1);
          return <motion.section key={home.id} className="compare-column" role="listitem" aria-label={home.street}
            data-selected={isSelected} data-contacted={contacted || undefined}
            style={{gridRow:`span ${rows.length}`}} layout="position"
            initial={rise.initial} animate={rise.animate} exit={{opacity:0, transition:{duration:0.2, ease:EASE_OUT}}}
            transition={{...rise.transition, layout:{duration:0.25, ease:EASE_IN_OUT}}}>
            <div className="compare-cell compare-cell-card">
              <article className="discovery-item compare-card" data-listing-id={home.listingId}>
                <div className="discovery-card">
                  <button className="discovery-open compare-dim" type="button" onClick={event => onOpen(home, event)} aria-label={say(`Ver imóvel ${home.street}`, `Ver inmueble ${home.street}`)}>
                    <RailListingCopy home={home} videoRef={{current:null}}/>
                  </button>
                  <label className="compare-check" title={contacted ? say(`Contatada em ${shortDate(contactedAt.get(home.id), language)}`, `Contactada el ${shortDate(contactedAt.get(home.id), language)}`) : undefined}>
                    <input type="checkbox" checked={contacted || isSelected} disabled={contacted} onChange={() => toggle(home)}/>
                    <span className="compare-check-box" aria-hidden="true"><Icon name="check" size={18}/></span>
                    <span className="sr-only">{contacted ? say(`${home.street}: imobiliária contatada em ${shortDate(contactedAt.get(home.id), language)}`, `${home.street}: inmobiliaria contactada el ${shortDate(contactedAt.get(home.id), language)}`) : say(`Incluir ${recipient.display} na mensagem`, `Incluir a ${recipient.display} en el mensaje`)}</span>
                  </label>
                  {shown.length > 1 && <button className="compare-remove" type="button" onClick={() => onHide(home.id)} aria-label={say(`Tirar ${home.street} da comparação`, `Quitar ${home.street} de la comparación`)}><Icon name="close" size={16}/></button>}
                </div>
              </article>
            </div>

            <div {...cell('highlight')}>
              {label('highlight')}
              <div className="compare-highlight-slot compare-dim">
                <AnimatePresence>
                  {index >= revealed && <motion.p key="comparing" className="compare-comparing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15, ease:EASE_OUT}}>
                    <span>{say('Comparando o imóvel…', 'Comparando el inmueble…')}</span>
                  </motion.p>}
                </AnimatePresence>
                <div className="compare-highlight" data-waiting={index >= revealed || undefined}>
                  <StreamedSummary key={index >= revealed ? 'waiting' : 'written'} lead={card.summary.lead} text={card.summary.text}
                    animate={!reduce && index < revealed}/>
                </div>
              </div>
            </div>

            <div {...cell('price', {'data-best':reading.best.price === home.id || undefined})}>
              {label('price')}
              <div className="compare-dim">
                <p className="compare-price-value">
                  <span>{card.ppm2 ? compactMoney(card.ppm2) : say('Área a confirmar', 'Superficie por confirmar')}</span>
                  <AnimatePresence>
                    {reading.best.price === home.id && <BestTag key="best" index={index} reduce={reduce} label={say('Melhor preço', 'Mejor precio')}/>}
                  </AnimatePresence>
                </p>
                {card.delta != null && <>
                  <p className={`compare-delta${card.delta > 0 ? ' is-above' : ''}`}>
                    {card.delta > 0
                      ? say(`↑ ${Math.round(card.delta * 100)}% acima`, `↑ ${Math.round(card.delta * 100)}% arriba`)
                      : say(`↓ ${Math.abs(Math.round(card.delta * 100))}% abaixo da região`, `↓ ${Math.abs(Math.round(card.delta * 100))}% abajo de la zona`)}
                  </p>
                  <PriceBar band={card.band} position={card.position} index={index} animate={!reduce}/>
                </>}
                {card.priceNote && <p className="compare-price-note">{card.priceNote}</p>}
              </div>
            </div>

            <div {...cell('nearby')}>
              <div className="compare-nearby-head" data-repeat={index > 0 || undefined}>
                {label('nearby')}
                <TravelModes mode={travel} onChange={setTravel} reduce={reduce} hidden={index > 0 && !mobile}/>
              </div>
              <div className="compare-dim">
                <NearbyPlaces places={card.nearby} mode={travel} fastest={fastest}/>
              </div>
            </div>
          </motion.section>;
        })}
      </AnimatePresence>
    </div>}

    <AnimatePresence>
      {visible.length > 0 && mobile && composing && <motion.div key="backdrop" className="compare-composer-backdrop" aria-hidden="true" onClick={() => !sending.current && closeComposer()}
        initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2, ease:EASE_OUT}}/>}
    </AnimatePresence>
    {visible.length > 0 && <div className="compare-dock" ref={bar} data-open={composing || undefined} data-sent={(sentMode && !composing) || undefined}><LayoutGroup>
      <motion.div className="compare-action-bar" layout initial={false}
        animate={{borderTopLeftRadius:corner, borderTopRightRadius:corner, borderBottomLeftRadius:foot, borderBottomRightRadius:foot}}
        transition={{...morph, layout:morph}}>
        <AnimatePresence mode="popLayout" initial={false}>
          {composing
            ? <motion.div key="composer" className="compare-action-layer" layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{...layer, layout:morph}}>
              <Composer recipients={recipients} profile={profile} mobile={mobile} reduce={reduce} morph={morph} pending={sending} onCancel={closeComposer} onSend={send}/>
            </motion.div>
            : <motion.div key="pill" className="compare-action-layer compare-action-inner" data-sent={sentMode || undefined} layout initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{...layer, layout:morph}}>
              <p ref={copy} tabIndex={-1} className="compare-action-copy" aria-live="polite" data-pitch={!sentMode || undefined}><Crossfade id={barLine}>{barLine}</Crossfade></p>
              {!sentMode && <motion.div className="compare-cta-wrap" layoutId="compare-cta" transition={{layout:morph}}>
                <button ref={cta} type="button" className="mini-primary compare-cta" data-state={ctaState} onClick={request}
                  aria-label={ctaState === 'many' ? say(`Contatar ${selected.length} imobiliárias`, `Contactar ${selected.length} inmobiliarias`) : undefined}
                  aria-disabled={inactive || undefined} aria-haspopup={sentMode ? undefined : 'dialog'}>
                  <Crossfade id={ctaState} layout>{ctaLabel}</Crossfade>
                </button>
              </motion.div>}
              {sentMode && onExplore && <button type="button" className="mini-secondary compare-explore" onClick={onExplore}>{say('Ver mais imóveis', 'Ver más inmuebles')}</button>}
            </motion.div>}
        </AnimatePresence>
        {batch && !reduce && <SentSweep key={batch.receiptIds[0]}/>}
      </motion.div>
    </LayoutGroup></div>}
  </article>;
}
