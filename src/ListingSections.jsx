import React, {Suspense, lazy, useLayoutEffect, useRef, useState} from 'react';
import {motion, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {seed} from './listingAdvertiser';
import {SPRING_SIZE} from './listingPanelMotion';
import {poiIconUrl} from './pois';
import {travelMinutes} from './compareReading';
import {ListingPlaces} from './ListingPlaces';

const ListingMap = lazy(() => import('./ListingMap'));
const asset = name => `/assets/mini-listing/${name}.svg`;

/** Height follows the content with the panel's spring; `collapsed` clips it until opened. */
export function Expandable({open = true, collapsed, className = '', children, toggle}) {
  const inner = useRef(null), reduce = useReducedMotion();
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);
  const overflows = collapsed != null && height != null && height > collapsed + 1;
  const target = height == null ? (collapsed != null && !open ? collapsed : 'auto') : open || collapsed == null ? height : Math.min(collapsed, height);
  return <>
    <motion.div className={`pp-expand${className ? ` ${className}` : ''}`} data-clipped={!open && overflows ? '' : undefined} initial={false} animate={{height:target}} transition={reduce ? {duration:0} : SPRING_SIZE}>
      <div ref={inner}>{children}</div>
    </motion.div>
    {toggle?.(overflows)}
  </>;
}

export function MoreButton({open, onClick, more, less, controls, plain = false}) {
  return <button type="button" className={`pp-more${plain ? ' is-plain' : ''}`} aria-expanded={open} aria-controls={controls} onClick={onClick}>
    <span>{open ? less : more}</span><Icon name="chevron" size={16} className="pp-more-chevron"/>
  </button>;
}

export function Host({advertiser, onReviews, say}) {
  const developer = advertiser.service === 'developer';
  const reply = advertiser.domi ? say('Responde em minutos pelo WhatsApp', 'Responde en minutos por WhatsApp') : say(`Costuma responder em ${advertiser.replyHours} h`, `Suele responder en ${advertiser.replyHours} h`);
  return <div className="pp-host">
    <div className="pp-host-main">
      {advertiser.logo ? <img className="pp-host-logo" src={advertiser.logo} alt=""/> : <span className="pp-host-logo is-initials" aria-hidden="true">{advertiser.initials}</span>}
      <div className="pp-host-copy">
        <p className="pp-host-name">{developer ? say('Empreendimento de', 'Desarrollo de') : say('Anunciado por', 'Publicado por')} <span className="pp-host-who"><strong>{advertiser.name}</strong>{advertiser.verified && <span className="pp-host-verified" aria-label={developer ? say('Incorporadora verificada', 'Desarrolladora verificada') : say('Imobiliária verificada', 'Inmobiliaria verificada')}><Icon name="check" size={12}/></span>}</span></p>
        <p className="pp-host-meta">
          <button type="button" className="pp-host-rating" onClick={onReviews}>★ {advertiser.rating.toFixed(1).replace('.', ',')} · {advertiser.reviews} {say('avaliações no Google', 'reseñas en Google')}</button>
          <span className="pp-host-reply"> · {reply}</span>
        </p>
      </div>
    </div>
  </div>;
}

const FeeIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M12 9.5v5M13.6 10.3c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.5-1.6 1.2s.7 1 1.6 1.2c.9.2 1.6.6 1.6 1.3s-.7 1.2-1.6 1.2c-.7 0-1.3-.3-1.6-.8"/></svg>;

export function Specs({facts, money, currency, say}) {
  const items = [
    ['area', `${facts.size} m²`, say('Área construída', 'Superficie')],
    ['bed', facts.beds, say(facts.beds === 1 ? 'Quarto' : 'Quartos', facts.beds === 1 ? 'Recámara' : 'Recámaras')],
    ['bath', facts.baths, say(facts.baths === 1 ? 'Banheiro' : 'Banheiros', facts.baths === 1 ? 'Baño' : 'Baños')],
    ['car', facts.parking, say(facts.parking === 1 ? 'Vaga' : 'Vagas', facts.parking === 1 ? 'Estacionamiento' : 'Estacionamientos')],
    ['floor', say(`${facts.floor}º`, `${facts.floor}`), say('Andar', 'Piso')],
    ['fee', `${money(facts.fee)} ${currency}`, say('Condomínio por mês', 'Mantenimiento al mes')],
  ];
  return <ul className="pp-specs">{items.map(([icon, value, label]) => <li key={icon}>
    {icon === 'fee' ? <FeeIcon/> : <img src={asset(icon)} alt=""/>}
    <span><strong>{value}</strong><small>{label}</small></span>
  </li>)}</ul>;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A stable advertiser reference, derived from the invented agency, never a person's name. */
function advertiserCode(advertiser) {
  const n = seed(advertiser.name.toLowerCase());
  const token = [0, 1, 2, 3, 4].map(shift => CODE_ALPHABET[(n >>> (shift * 3)) % CODE_ALPHABET.length]).join('');
  return `${advertiser.handle.replace(/^@/, '').slice(0, 14)}#${token}`;
}

export function Description({paragraphs, home, advertiser, say}) {
  const [open, setOpen] = useState(false);
  const codes = [
    [say('Código do anunciante', 'Código del anunciante'), advertiserCode(advertiser)],
    [say('Cód. Imovelweb', 'Cód. Inmuebles24'), String(home.listingId)],
    [say('CRECI', 'Registro'), say('por confirmar', 'por confirmar')],
  ];
  return <>
    <Expandable open={open} collapsed={144} className="pp-description" toggle={overflows => (overflows || open) && <MoreButton plain open={open} onClick={() => setOpen(!open)} controls="pp-description" more={say('Mostrar mais', 'Mostrar más')} less={say('Mostrar menos', 'Mostrar menos')}/>}>
      <div id="pp-description">{paragraphs.map((parts, index) => <p key={index}>{parts.map((part, i) => part.strong ? <strong key={i}>{part.text}</strong> : part.text)}</p>)}</div>
    </Expandable>
    <ul className="pp-codes">{codes.map(([label, value]) => <li key={label} className="pp-code">{label}: {value}</li>)}</ul>
  </>;
}

const PATHS = {
  kitchen:'M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M6 12v9M17 3c-2 0-3 2-3 5s1 4 3 4v9',
  closet:'M5 3h14v18H5zM12 3v18M9.5 11v2M14.5 11v2',
  washer:'M4 3h16v18H4zM4 7h16M7.5 5h.01M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  ac:'M3 5h18v7H3zM6 9h12M7 15c0 2 1 3 1 5M12 15v5M17 15c0 2-1 3-1 5',
  heater:'M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9ZM12 13c1 1 1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 .5-2 1.5-3Z',
  storage:'M3 8l9-5 9 5v13H3zM7 21v-8h10v8M7 17h10',
  light:'M4 3h16v18H4zM12 3v18M4 12h16',
  wood:'M3 4h18v16H3zM3 9h18M3 14h18M9 4v5M15 9v5M9 14v6',
  sofa:'M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11a2 2 0 0 1 2 2v2h14v-2a2 2 0 1 1 2 2v3H3v-3a2 2 0 0 1 0-4ZM6 18v2M18 18v2',
  balcony:'M4 10h16M6 10V4h12v6M4 20h16M6 10v10M10 10v10M14 10v10M18 10v10',
  elevator:'M5 3h14v18H5zM12 3v18M8.5 9 7 11h3zM15.5 13l-1.5 2h3z',
  security:'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4',
  lobby:'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
  cowork:'M3 5h18v11H3zM8 20h8M12 16v4',
  roof:'M12 21v-6M9 21h6M12 15a6 6 0 0 0 6-6c0-2-1-4-2-5-1 2-2.5 3-4 3S9 6 8 4C7 5 6 7 6 9a6 6 0 0 0 6 6Z',
  bike:'M5.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5.5 14.5 9 7h5l4.5 7.5M9 7l3 7.5h6.5M13 4h3',
  gym:'M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12',
  pool:'M3 18c2 0 2-1.5 4.5-1.5S10 18 12 18s2-1.5 4.5-1.5S19 18 21 18M8 15V5a2 2 0 0 1 4 0M16 15V5a2 2 0 0 0-4 0M8 9h8',
  nopets:'M5 5l14 14M8.5 8a1.5 1.5 0 1 0 0-3M15.5 5a1.5 1.5 0 1 0 0 3M12 13c-3 0-5 2.5-5 4.5 0 1.5 1 2.5 2.5 2.5S11 19 12 19s1.5 1 2.5 1 2.5-1 2.5-2.5',
};
function AmenityIcon({id}) {
  if (id === 'car' || id === 'pets') return <img src={asset(id)} alt=""/>;
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[id] || PATHS.lobby}/></svg>;
}

const GROUPS = [
  ['interior', 'No apartamento', 'En el departamento'],
  ['building', 'No prédio', 'En el edificio'],
];
const ROOM_IDS = ['living', 'bedrooms', 'kitchen', 'bath', 'outdoor'];

/** The rooms the gallery can show, in the order of the page: one cover and the photos that belong to it. */
function roomSpaces(gallery) {
  const byId = new Map((gallery?.categories || []).map(category => [category.id, category]));
  return ROOM_IDS.map(id => byId.get(id)).filter(room => room?.photos.length);
}

export function Amenities({amenities, gallery, language, say, onRoom}) {
  const pt = language === 'pt-BR';
  const rooms = roomSpaces(gallery);
  const countLabel = count => count === 1 ? say('1 foto', '1 foto') : say(`${count} fotos`, `${count} fotos`);
  return <div className="pp-amenities">
    {rooms.length > 0 && <ul className="pp-rooms" aria-label={say('Explorar por espaço', 'Explorar por espacio')}>
      {rooms.map(room => {
        const name = pt ? room.pt : room.es;
        const count = countLabel(room.photos.length);
        return <li key={room.id}>
          <button type="button" className="pp-room" onClick={event => onRoom?.(room.photos[0].index, event.currentTarget)}>
            <span className="pp-room-photo" data-photo-index={room.photos[0].index}><img src={room.photos[0].src} alt=""/></span>
            <span className="pp-room-name">{name}</span>
            <span className="pp-room-count">{count}</span>
          </button>
        </li>;
      })}
    </ul>}
    {GROUPS.map(([group, br, es]) => {
      const items = amenities.filter(item => item.group === group);
      if (!items.length) return null;
      return <div key={group} className="pp-amenity-group">
        <h3>{say(br, es)}</h3>
        <ul>{items.map(item => <li key={item.id + item.es}><AmenityIcon id={item.id}/><span>{pt ? item.pt : item.es}</span></li>)}</ul>
      </div>;
    })}
  </div>;
}

const NOUNS = {
  cafe:[['café', 'cafés'], ['café', 'cafés']],
  bar_restaurante:[['restaurante', 'restaurantes'], ['restaurante', 'restaurantes']],
  parque:[['parque', 'parques'], ['parque', 'parques']],
  supermercado:[['mercado', 'mercados'], ['súper', 'súpers']],
  metro:[['estação de metrô', 'estações de metrô'], ['estación de metro', 'estaciones de metro']],
};

function aroundList(counts, pt) {
  return Object.keys(NOUNS).filter(key => counts[key] > 0).slice(0, 3).map(key => `${counts[key]} ${NOUNS[key][pt ? 0 : 1][counts[key] === 1 ? 0 : 1]}`);
}

const HOOD_ICON = name => `/assets/hood/${name}.svg`;
const NEARBY_KINDS = [
  ['metro', 'Transportes', 'Transportes'],
  ['escola', 'Escolas', 'Escuelas'],
  ['supermercado', 'Mercados', 'Mercados'],
  ['comercio', 'Shoppings', 'Shoppings'],
  ['parque', 'Parques', 'Parques'],
];
const PLACE_LIMIT = 10;

function carMinutes(place) {
  const meters = Math.max(80, place.minutes * 80);
  let value = 2166136261;
  for (const char of place.name) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return travelMinutes(meters, 'car', (value >>> 0) % 1000 / 1000);
}

const STAT_EASE = [0.23, 1, 0.32, 1];
const statsList = reduce => ({hidden:{}, show:{transition:{staggerChildren:reduce ? 0 : 0.06}}});
const statItem = reduce => reduce
  ? {hidden:{opacity:0}, show:{opacity:1, transition:{duration:0.2}}}
  : {hidden:{opacity:0, transform:'translateY(8px)'}, show:{opacity:1, transform:'translateY(0px)', transition:{duration:0.3, ease:STAT_EASE}}};

export function Location({home, location, neighborhood, language, money, currency, say}) {
  const pt = language === 'pt-BR';
  const hood = neighborhood?.(language);
  const reduce = useReducedMotion();
  const around = aroundList(location.counts, pt);
  const trend = hood && {up:say('Em alta', 'Al alza'), down:say('Em baixa', 'A la baja'), flat:say('Estável', 'Estable')}[hood.trend.direction];
  return <>
    <p className="pp-section-sub">{/ciudad de m[eé]xico|cdmx/i.test(home.location || '') ? home.location : `${home.location || home.area}, ${say('Cidade do México', 'Ciudad de México')}`}</p>
    {hood && <motion.ul className="pp-hood-stats" variants={statsList(reduce)} initial="hidden" whileInView="show" viewport={{once:true, amount:0.4}}>
      <motion.li variants={statItem(reduce)}>
        <span>{say('Valorização em 12 meses', 'Plusvalía en 12 meses')}</span>
        <strong>{trend}</strong>
      </motion.li>
      <motion.li variants={statItem(reduce)}>
        <span>{say(`Preço de venda em ${hood.name}`, `Precio de venta en ${hood.name}`)}</span>
        <strong>{money(hood.medianPerM2)} {currency}/m²</strong>
        <small>{say('mediana da colônia', 'mediana de la colonia')}</small>
      </motion.li>
      <motion.li variants={statItem(reduce)}>
        <span>{say(`Até ${hood.commute.destination}`, `Hasta ${hood.commute.destination}`)}</span>
        <strong>{hood.commute.minutes} min</strong>
        <small>{say('em transporte, ilustrativo', 'en transporte, ilustrativo')}</small>
      </motion.li>
      {around.length > 0 && <motion.li variants={statItem(reduce)}>
        <span>{say('Num raio de 500 m', 'En 500 m a la redonda')}</span>
        <strong>{around[0]}</strong>
        {around.length > 1 && <small>{around.slice(1).join(' · ')}</small>}
      </motion.li>}
    </motion.ul>}
    <Suspense fallback={<div className="pp-map is-loading" aria-hidden="true"/>}>
      <ListingMap center={location.center} language={language} say={say}/>
    </Suspense>
    <p className="pp-map-note">{say('Localização aproximada: o endereço exato é compartilhado quando a visita é confirmada.', 'Ubicación aproximada: la dirección exacta se comparte al confirmar la visita.')}</p>
    <ListingPlaces center={location.center} language={language} say={say}/>

    <div className="pp-hood">
      <div className="pp-hood-top">
        {hood && <div className="pp-hood-intro">
          <h3>{say(`Como é viver em ${hood.name}`, `Así se vive en ${hood.name}`)}</h3>
          <p className="pp-hood-reading">{hood.reading}</p>
        </div>}
        {NEARBY_KINDS.some(([id]) => location.counts?.[id] > 0) && <ul className="pp-hood-chips" aria-label={say('O que há por perto', 'Qué hay cerca')}>
          {NEARBY_KINDS.filter(([id]) => location.counts?.[id] > 0).map(([id, br, es]) => <li key={id}>
            <img src={HOOD_ICON('check')} alt="" width="16" height="16"/>{say(br, es)}
          </li>)}
        </ul>}
      </div>
      <div className={`pp-hood-grid${location.places.length ? '' : ' is-card-only'}`}>
        {location.places.length > 0 && <div className={`pp-hood-places${location.places.length > 5 ? '' : ' is-single'}`}>
          {(location.places.length > 5 ? [location.places.slice(0, 5), location.places.slice(5, PLACE_LIMIT)] : [location.places.slice(0, PLACE_LIMIT)]).map(column => <ul key={column[0].name} className="pp-places">{column.map(place => <li key={place.categoria + place.name}>
            <img src={poiIconUrl(place.categoria)} alt="" width="20" height="20"/>
            <span className="pp-place-copy"><b title={place.name}>{place.name}</b><small>{pt ? place.kind[0] : place.kind[1]}</small></span>
            <span className="pp-place-times">
              <span><img src={HOOD_ICON('walk')} alt="" width="16" height="16"/>{place.minutes} min<span className="sr-only"> {say('a pé', 'a pie')}</span></span>
              <span><img src={HOOD_ICON('car')} alt="" width="16" height="16"/>{carMinutes(place)} min<span className="sr-only"> {say('de carro', 'en auto')}</span></span>
            </span>
          </li>)}</ul>)}
        </div>}
        {hood && <div className="pp-hood-card-slot"><div className="pp-hood-card">
          <div className="pp-hood-card-head">
            <p className="pp-hood-mora"><img src={HOOD_ICON('mora')} alt="" width="20" height="20"/>Mora</p>
            <h4>{say('O que os vizinhos valorizam', 'Lo que valoran los vecinos')}</h4>
          </div>
          <motion.ul className="pp-hood-bars" initial="hidden" whileInView="show" viewport={{once:true, amount:0.6}}
            variants={{hidden:{}, show:{transition:{staggerChildren:reduce ? 0 : 0.06}}}}>{hood.bars.map(bar => <li key={bar.id}>
            <span>{bar.label}</span><strong>{bar.value}%</strong>
            <i aria-hidden="true"><motion.b style={{width:`${bar.value}%`}}
              variants={reduce ? undefined : {hidden:{scaleX:0}, show:{scaleX:1, transition:{duration:0.6, ease:STAT_EASE}}}}/></i>
          </li>)}</motion.ul>
        </div></div>}
      </div>
    </div>
  </>;
}
