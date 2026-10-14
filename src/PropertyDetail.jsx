import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {homes, listingPrice} from './data';
import {DEMO_MXN_PER_USD, useLanguage} from './i18n';
import agencies from '../AGENCY-SOURCES.json';
import {advertiserFor} from './listingAdvertiser';
import {listingStory, similarListings} from './listingStory';
import {shortMoney} from './moraAnalysis';
import {MoraInsight} from './MoraInsight';
import {detailReading} from './moraDetail';
import {ListingGallery} from './ListingGallery';
import {Amenities, Description, Host, Location, Specs} from './ListingSections';
import {ListingReviews} from './ListingReviews';
import {SimilarListings} from './SimilarListings';
import {ListingContactCard, ListingQuestions} from './ListingContact';
import './property-page.css';

const Heart = ({filled}) => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className={`pp-save-heart${filled ? ' is-on' : ''}`}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>;
const ShareIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>;
/**
 * Mora's card at the top of the reading column: the mini-listing's sentence, so the reading is recognizable, then
 * everything she found, with the evidence the panel had no room for.
 */
function MoraOpening({home, reading, detail, short, say, onAsk, onPhoto}) {
  return <div className="pp-mora">
    <MoraInsight home={home} options={reading.options} signature={reading.signature} short={short} say={say} variant="page"
      detail={detail} onAsk={onAsk} onPhoto={onPhoto}/>
    <p className="pp-mora-note">{say('A Mora lê o anúncio, a zona e a sua busca. Confirme os detalhes com a imobiliária.', 'Mora lee el anuncio, la zona y tu búsqueda. Confirma los detalles con la inmobiliaria.')}</p>
  </div>;
}

const NAV_SECTIONS = [
  {id:'pp-photos', pt:'Fotos', es:'Fotos'},
  {id:'pp-amenities', pt:'Comodidades', es:'Comodidades'},
  {id:'pp-location', pt:'Localização', es:'Ubicación'},
  {id:'pp-reviews', pt:'Avaliações', es:'Reseñas'},
];
const headerHeight = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--flow-header-height')) || 0;

/** Sticky anchors once the intro scrolls away; price and the main contact join them once the card is gone too. */
function ListingNav({intro, card, price, advertiser, onContact, say}) {
  const nav = useRef(null);
  const [state, setState] = useState({show:false, compact:false});
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = headerHeight(), bottom = top + (nav.current?.offsetHeight || 0);
      const show = (intro.current?.getBoundingClientRect().bottom ?? 1) < top;
      const box = card.current?.querySelector('.pp-card');
      const compact = show && !!box && box.getBoundingClientRect().bottom < bottom;
      setState(current => current.show === show && current.compact === compact ? current : {show, compact});
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onScroll);
    check();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, [intro, card]);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pp-nav-height', state.show ? `${nav.current?.offsetHeight || 0}px` : '0px');
    return () => root.style.removeProperty('--pp-nav-height');
  }, [state.show]);
  function jump(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY;
    const header = y < window.scrollY ? (document.querySelector('.home-header-bar, .home-header')?.offsetHeight || 0) : 0;
    window.scrollTo({top:y - header - (nav.current?.offsetHeight || 0) - 24, behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'});
  }
  return <div ref={nav} className={`pp-nav${state.show ? ' is-visible' : ''}`} inert={!state.show}>
    <div className="pp-nav-inner">
      <nav className="pp-nav-links" aria-label={say('Seções do anúncio', 'Secciones del anuncio')}>
        {NAV_SECTIONS.map(section => <a key={section.id} href={`#${section.id}`} onClick={event => { event.preventDefault(); jump(section.id); }}>{say(section.pt, section.es)}</a>)}
      </nav>
      <div className={`pp-nav-cta${state.compact ? ' is-visible' : ''}`} inert={!state.compact}>
        <div className="pp-nav-price">
          <strong>{price}</strong>
          <small>★ {advertiser.rating.toFixed(1).replace('.', ',')} · {advertiser.reviews} {say('avaliações', 'reseñas')}</small>
        </div>
        <button type="button" className="mini-primary" onClick={onContact}>{say('Falar com imobiliária', 'Hablar con inmobiliaria')}</button>
      </div>
    </div>
  </div>;
}

/** The full listing: Airbnb-style page built from the catalog plus a stable invented story. Contact grows inside the price card. */
export function PropertyDetail({home, search, pref = 'none', favorites = [], saved = [], receipts = [], onLike, onFavorite, onCompare, onOpenListing, onMore, onClose, profile, onProfile, onReceipt, receipt}) {
  const {language, money, currency} = useLanguage(), pt = language === 'pt-BR';
  const say = (br, es) => pt ? br : es;
  const short = amount => shortMoney(currency === 'USD' ? amount / DEMO_MXN_PER_USD : amount);
  const title = useRef(null), intro = useRef(null), card = useRef(null), openGallery = useRef(null);
  const [contact, setContact] = useState(null);
  const [stuck, setStuck] = useState(false), [copied, setCopied] = useState(false), copyTimer = useRef(0);
  const [arrival] = useState(() => document.documentElement.dataset.heroMorph === 'forward' ? 'morph' : 'plain');
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const story = useMemo(() => listingStory(home), [home]);
  const advertiser = useMemo(() => advertiserFor(home, agencies.logos), [home]);
  const similar = useMemo(() => similarListings(home, homes), [home]);
  const favoriteIds = favorites.map(item => item.id).join(',');
  const reading = useMemo(() => ({
    options:{search, pref, favorites:favorites.filter(item => item.id !== home.id), stage:'deciding', language, money, short},
    signature:JSON.stringify(['detail', search, pref, favoriteIds, language, currency]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [home.id, search, pref, favoriteIds, language, currency]);
  const detail = useCallback(analysis => detailReading(analysis, {home, search, places:story.location.places, gallery:story.gallery.photos, short, say}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [home, search, story, language, currency]);
  const {facts} = story;
  const price = listingPrice(home);
  const isSaved = saved.includes(home.id);

  useLayoutEffect(() => {title.current?.focus({preventScroll:true});}, []);
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = card.current;
      if (!el || getComputedStyle(el).position !== 'sticky') { setStuck(false); return; }
      const top = parseFloat(getComputedStyle(el).top) || 0;
      setStuck(el.getBoundingClientRect().top <= top + 0.5 && window.scrollY > 0);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(check); };
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onScroll);
    check();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
  }, []);

  const reduce = useReducedMotion();
  function openContact(intent, question = '') {
    setContact({intent, question});
    const el = card.current;
    if (el && getComputedStyle(el).position !== 'sticky' && el.getBoundingClientRect().top < 0) el.scrollIntoView({behavior:reduce ? 'instant' : 'smooth', block:'start'});
  }

  const toReviews = () => document.getElementById('pp-reviews')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block:'start'});
  const reviewsFromContact = () => { toReviews(); document.getElementById('pp-reviews')?.focus({preventScroll:true}); };
  const operation = say(home.mode === 'rent' ? 'Alugar · Apartamento' : 'Comprar · Apartamento', home.mode === 'rent' ? 'Renta · Departamento' : 'Venta · Departamento');

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); } catch { return; }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  function contactFromNav() {
    const layout = document.querySelector('.pp-layout');
    const above = (document.querySelector('.home-header-bar, .home-header')?.offsetHeight || 0) + (document.querySelector('.pp-nav')?.offsetHeight || 0) + 24;
    const top = layout ? layout.getBoundingClientRect().top + window.scrollY - above : window.scrollY;
    if (reduce || Math.abs(top - window.scrollY) < 2) { window.scrollTo({top, behavior:'instant'}); openContact('message'); return; }
    // Focusing the opened form cancels a smooth scroll, so the card opens once the page has arrived.
    let timer = 0;
    const arrive = () => { clearTimeout(timer); window.removeEventListener('scrollend', arrive); openContact('message'); };
    window.addEventListener('scrollend', arrive);
    timer = setTimeout(arrive, 900);
    window.scrollTo({top, behavior:'smooth'});
  }

  return <article className="property-page pp" data-arrival={arrival}>
    <ListingNav intro={intro} card={card} advertiser={advertiser} say={say} onContact={contactFromNav}
      price={<>{money(price)} {currency}{home.mode === 'rent' && <small> / {say('mês', 'mes')}</small>}</>}/>
    <div className="pp-top">
      <button className="compare-back" type="button" onClick={onClose} aria-label={say('Voltar à busca', 'Volver a la búsqueda')}><Icon name="back" size={20}/></button>
      <div className="pp-top-actions">
        <span className="pp-copied" role="status" data-visible={copied || undefined}>{copied ? say('Link copiado', 'Enlace copiado') : ''}</span>
        <button className="compare-back" type="button" onClick={share} aria-label={say('Compartilhar', 'Compartir')}><ShareIcon/></button>
        {onLike && <button className="compare-back pp-save" type="button" aria-pressed={isSaved} onClick={() => onLike(home)} aria-label={isSaved ? say('Salvo nos favoritos', 'Guardado en favoritos') : say('Salvar nos favoritos', 'Guardar en favoritos')}><Heart filled={isSaved}/></button>}
      </div>
    </div>
    <header className="pp-head">
      <p className="pp-operation">{operation}</p>
      <h1 ref={title} tabIndex={-1}>{home.street}, {home.area}</h1>
    </header>
    <div id="pp-photos" className="pp-gallery"><ListingGallery home={home} gallery={story.gallery} say={say} language={language} opener={openGallery}/></div>

    <div className="pp-layout">
      <section className="pp-section pp-intro" aria-label={say('Resumo', 'Resumen')}>
        <h2 className="pp-intro-title">{say(home.mode === 'rent' ? `Apartamento para alugar em ${home.area}` : `Apartamento à venda em ${home.area}`, home.mode === 'rent' ? `Departamento en renta en ${home.area}` : `Departamento en venta en ${home.area}`)}</h2>
        <p ref={intro} className="pp-intro-facts">{facts.size} m² · {facts.beds} {say(facts.beds === 1 ? 'quarto' : 'quartos', facts.beds === 1 ? 'recámara' : 'recámaras')} · {facts.baths} {say(facts.baths === 1 ? 'banheiro' : 'banheiros', facts.baths === 1 ? 'baño' : 'baños')} · {say(`${facts.floor}º andar`, `piso ${facts.floor}`)}</p>
        <Host advertiser={advertiser} onReviews={toReviews} say={say}/>
      </section>

      <section className="pp-section pp-mora-section" aria-labelledby="pp-mora-title">
        <h2 id="pp-mora-title" className="sr-only">{say('Análise da Mora', 'Análisis de Mora')}</h2>
        <MoraOpening home={home} reading={reading} detail={detail} short={short} say={say} onAsk={question => openContact('message', question)}
          onPhoto={(index, element) => openGallery.current?.(index, element)}/>
      </section>

      <section className="pp-section" aria-labelledby="pp-specs-title">
        <h2 id="pp-specs-title" className="pp-section-title">{say('Ficha do imóvel', 'Ficha del inmueble')}</h2>
        <Specs facts={facts} money={money} currency={currency} say={say}/>
      </section>

      <aside ref={card} className="pp-aside" aria-label={say('Preço e contato', 'Precio y contacto')}>
        <ListingContactCard home={home} advertiser={advertiser} search={search} language={language} contact={contact} stuck={stuck}
          onContact={openContact} onClose={() => setContact(null)} onReviews={reviewsFromContact} profile={profile} onProfile={onProfile} onReceipt={onReceipt} receipt={receipt} say={say}
          price={<p className="pp-card-price">{money(price)} {currency}{home.mode === 'rent' && <small> / {say('mês', 'mes')}</small>}</p>}
          fee={<p className="pp-card-fee">{home.mode === 'rent'
            ? say(`+ ${money(facts.fee)} de condomínio · ${money(price + facts.fee)} ${currency} por mês no total`, `+ ${money(facts.fee)} de mantenimiento · ${money(price + facts.fee)} ${currency} al mes en total`)
            : say(`Condomínio de ${money(facts.fee)} ${currency} por mês`, `Mantenimiento de ${money(facts.fee)} ${currency} al mes`)}</p>}/>
        <AnimatePresence initial={false}>
          {!contact && <motion.div key="ask" className="pp-ask-wrap" initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}
            transition={reduce ? {duration:0} : {duration:0.25, ease:[0.2, 0.8, 0.2, 1]}}>
            <ListingQuestions say={say} onSend={text => openContact('message', text)}/>
          </motion.div>}
        </AnimatePresence>
      </aside>

      <section className="pp-section" aria-labelledby="pp-about-title">
        <h2 id="pp-about-title" className="pp-section-title">{say('Sobre este imóvel', 'Acerca de este inmueble')}</h2>
        <Description paragraphs={story.description(language)} say={say}/>
      </section>

      <section id="pp-amenities" className="pp-section" aria-labelledby="pp-amenities-title">
        <h2 id="pp-amenities-title" className="pp-section-title">{say('O que este lugar oferece', 'Lo que ofrece este lugar')}</h2>
        <Amenities amenities={story.amenities} language={language} say={say}/>
      </section>
    </div>

    <div className="pp-rest">
      <section id="pp-location" className="pp-section" aria-labelledby="pp-location-title">
        <h2 id="pp-location-title" className="pp-section-title">{say('Onde você vai morar', 'Dónde vas a vivir')}</h2>
        <Location home={home} location={story.location} neighborhood={story.neighborhood} language={language} money={money} currency={currency} say={say}/>
      </section>

      <section id="pp-reviews" className="pp-section" tabIndex={-1} aria-label={say('Avaliações da imobiliária', 'Reseñas de la inmobiliaria')}>
        <ListingReviews home={home} advertiser={advertiser} language={language} say={say}/>
      </section>

      {similar.length > 0 && <section className="pp-section is-last" aria-labelledby="pp-similar-title">
        <div className="pp-section-head">
          <div>
            <h2 id="pp-similar-title" className="pp-section-title">{say('Imóveis parecidos', 'Inmuebles parecidos')}</h2>
            <p className="pp-section-sub">{say(`Para ${home.mode === 'rent' ? 'alugar' : 'comprar'}, perto de ${home.area} e deste preço.`, `En ${home.mode === 'rent' ? 'renta' : 'venta'}, cerca de ${home.area} y de este precio.`)}</p>
          </div>
          {onMore && <button type="button" className="pp-pill" onClick={onMore}>{say('Ver mais imóveis', 'Ver más inmuebles')}</button>}
        </div>
        <SimilarListings items={similar} saved={saved} receipts={receipts} onLike={onLike} onOpen={item => onOpenListing?.(item)}/>
      </section>}
    </div>
  </article>;
}
