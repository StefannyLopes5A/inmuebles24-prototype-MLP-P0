import React, {lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {SectionInsight} from './SectionInsight.jsx';
import {Icon} from './App';
import {homes, listingPrice} from './data';
import {DEMO_MXN_PER_USD, useLanguage} from './i18n';
import agencies from '../AGENCY-SOURCES.json';
import {advertiserFor} from './listingAdvertiser';
import {listingStory, similarListings} from './listingStory';
import {shortMoney} from './moraAnalysis';
import {MoraOpening} from './MoraInsight';
import {detailReading} from './moraDetail';
import {ListingGallery} from './ListingGallery';
import {Amenities, Description, Host, Location, Specs} from './ListingSections';
import {ListingReviews} from './ListingReviews';
import {ListingOffers} from './ListingOffers';
import {ListingCosts} from './ListingCosts';
import {offerIdeas} from './offerIdeas';
import {ListingPriceHistory} from './ListingPriceHistory';
import {priceHistory} from './priceHistory';
import {SimilarListings} from './SimilarListings';
import {HomeInternalLinks} from './HomeInternalLinks';
import {ListingSimilarPrices} from './ListingSimilarPrices';
import {ListingContactCard, ListingQuestions} from './ListingContact';
import {sortSignal} from './resultSort';
import './property-page.css';

const ListingMap = lazy(() => import('./ListingMap'));
const MORA_MARK = '/assets/mini-listing/mora.svg';

const Heart = ({filled}) => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className={`pp-save-heart${filled ? ' is-on' : ''}`}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>;
const ShareIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>;
const HideIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 12S6.2 6.5 12 6.5 21.5 12 21.5 12 17.8 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.2"/><path d="M4 20 20 4"/></svg>;
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
export function PropertyDetail({home, search, pref = 'none', sort = 'recommended', favorites = [], saved = [], receipts = [], hidden = false, onLike, onShare, onHide, onFavorite, onCompare, onOpenListing, onMore, onSearch, onClose, onAskSection, profile, onProfile, onReceipt, receipt}) {
  const {language, money, compactMoney, currency} = useLanguage(), pt = language === 'pt-BR';
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
  const linkSearch = useMemo(() => ({...search, mode:home.mode === 'rent' ? 'rent' : 'buy', area:home.area, areas:home.area ? [home.area] : [], address:'', propertyType:'apartment'}), [search, home.mode, home.area]);
  const offers = useMemo(() => offerIdeas(home), [home]);
  const history = useMemo(() => priceHistory(home, story.neighborhood?.(language)), [home, story, language]);
  const signal = sortSignal(home, sort, language, {long:true});
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
  const [openInsights, setOpenInsights] = useState(() => new Set());
  const toggleInsight = section => setOpenInsights(current => { const next = new Set(current); if (!next.delete(section)) next.add(section); return next; });
  useEffect(() => { setOpenInsights(new Set()); }, [home.id]);
  const insightFor = section => openInsights.has(section) ? <SectionInsight section={section} home={home} language={language}/> : null;
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
  const toMap = () => {
    const el = document.getElementById('pp-location');
    if (!el) return;
    const header = document.querySelector('.home-header-bar, .home-header')?.offsetHeight || 0;
    const top = el.getBoundingClientRect().top + window.scrollY - header - 24;
    window.scrollTo({top, behavior:reduce ? 'instant' : 'smooth'});
  };
  const priceQuestion = say('É um bom preço?', '¿Es un buen precio?');
  const crumbs = [
    say(home.mode === 'rent' ? 'Alugar' : 'Venda', home.mode === 'rent' ? 'Renta' : 'Venta'),
    say('Apartamento', 'Departamento'),
    say('Cidade do México', 'Ciudad de México'),
    home.area,
    home.street,
    say(`Imóvel ${home.listingId}`, `Inmueble ${home.listingId}`),
  ];
  const reviewsFromContact = () => { toReviews(); document.getElementById('pp-reviews')?.focus({preventScroll:true}); };

  async function share() {
    if (onShare) { onShare(home); return; }
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

  return <>
  <article className="property-page pp" data-arrival={arrival}>
    <ListingNav intro={intro} card={card} advertiser={advertiser} say={say} onContact={contactFromNav}
      price={<>{money(price)} {currency}{home.mode === 'rent' && <small> / {say('mês', 'mes')}</small>}</>}/>
    <div className="pp-top">
      <button className="compare-back" type="button" onClick={onClose} aria-label={say('Voltar à busca', 'Volver a la búsqueda')}><Icon name="back" size={20}/></button>
      <div className="pp-top-actions">
        <span className="pp-copied" role="status" data-visible={copied || undefined}>{copied ? say('Link copiado', 'Enlace copiado') : ''}</span>
        <button className="compare-back" type="button" onClick={share} aria-label={say('Compartilhar', 'Compartir')}><ShareIcon/></button>
        {onLike && <button className="compare-back pp-save" type="button" aria-pressed={isSaved} onClick={() => onLike(home)} aria-label={isSaved ? say('Salvo nos favoritos', 'Guardado en favoritos') : say('Salvar nos favoritos', 'Guardar en favoritos')}><Heart filled={isSaved}/></button>}
        <button className="compare-back pp-hide" type="button" aria-pressed={hidden} onClick={() => onHide?.(home)} aria-label={hidden ? say('Mostrar anúncio', 'Mostrar anuncio') : say('Ocultar anúncio', 'Ocultar anuncio')}><HideIcon/></button>
      </div>
    </div>
    <p className="pp-intro-crumbs">{crumbs.map((item, index) => <span key={`${item}-${index}`}>{index > 0 && <span className="pp-intro-dot" aria-hidden="true">·</span>}{item}</span>)}</p>
    <div id="pp-photos" className="pp-gallery"><ListingGallery home={home} gallery={story.gallery} say={say} language={language} opener={openGallery}/></div>

    <div className="pp-layout">
      <section ref={intro} className="pp-section pp-intro" aria-label={say('Resumo', 'Resumen')}>
        <div className="pp-intro-top">
          <div className="pp-intro-copy">
            <div className="pp-intro-heading">
              <h1 ref={title} tabIndex={-1} className="pp-intro-title">{say(home.mode === 'rent' ? `Apartamento para alugar em ${home.area}` : `Apartamento à venda em ${home.area}`, home.mode === 'rent' ? `Departamento en renta en ${home.area}` : `Departamento en venta en ${home.area}`)}</h1>
              <p className="pp-intro-facts">{facts.size} m² · {facts.beds} {say(facts.beds === 1 ? 'quarto' : 'quartos', facts.beds === 1 ? 'recámara' : 'recámaras')} · {facts.baths} {say(facts.baths === 1 ? 'banheiro' : 'banheiros', facts.baths === 1 ? 'baño' : 'baños')} · {say(`${facts.floor}º andar`, `piso ${facts.floor}`)}</p>
            </div>
          </div>
          <button type="button" className="pp-intro-map" onClick={toMap} aria-label={say(`Ver o mapa de ${home.area}`, `Ver el mapa de ${home.area}`)}>
            <Suspense fallback={<span className="pp-intro-map-fallback" aria-hidden="true"/>}>
              <ListingMap center={story.location.center} language={language} say={say} preview/>
            </Suspense>
          </button>
        </div>
        <div className="pp-intro-offer">
          <div className="pp-intro-price">
            <p className="pp-intro-amount">{money(price)} {currency}{home.mode === 'rent' && <small> / {say('mês', 'mes')}</small>}</p>
            <button type="button" className="pp-mora-pill" aria-expanded={openInsights.has('price')} onClick={event => toggleInsight('price')}><img src={MORA_MARK} alt="" width="16" height="16"/><span>{priceQuestion}</span></button>
          </div>
          {insightFor('price')}
          <p className="pp-intro-fees"><span>{say('Condomínio', 'Mantenimiento')} {money(facts.fee)}</span><span className="pp-intro-fee-dot" aria-hidden="true">·</span><span>{say('IPTU', 'Predial')} {say('a confirmar', 'por confirmar')}</span></p>
        </div>
        <Host advertiser={advertiser} onReviews={toReviews} say={say}/>
      </section>

      <section className="pp-section pp-mora-section" aria-labelledby="pp-mora-title">
        <h2 id="pp-mora-title" className="sr-only">{say('Análise da Mora', 'Análisis de Mora')}</h2>
        <MoraOpening home={home} reading={reading} detail={detail} short={short} say={say} onAsk={question => openContact('message', question)}
          note={say('A Mora lê o anúncio, a zona e a sua busca. Confirme os detalhes com a imobiliária.', 'Mora lee el anuncio, la zona y tu búsqueda. Confirma los detalles con la inmobiliaria.')}
          onPhoto={(index, element) => openGallery.current?.(index, element)}/>
      </section>

      <section className="pp-section" aria-labelledby="pp-specs-title">
        <h2 id="pp-specs-title" className="pp-section-title">{say('Ficha do imóvel', 'Ficha del inmueble')}</h2>
        <Specs facts={facts} money={money} currency={currency} say={say}/>
      </section>

      <aside ref={card} className="pp-aside" aria-label={say('Preço e contato', 'Precio y contacto')}>
        <ListingContactCard home={home} advertiser={advertiser} search={search} language={language} contact={contact} stuck={stuck}
          onContact={openContact} onClose={() => setContact(null)} onReviews={reviewsFromContact} profile={profile} onProfile={onProfile} onReceipt={onReceipt} receipt={receipt} say={say}
          price={<><p className="pp-card-price">{money(price)} {currency}{home.mode === 'rent' && <small> / {say('mês', 'mes')}</small>}</p>{signal && <p className="pp-card-signal">{signal}</p>}</>}
          fee={<p className="pp-card-fee">{home.mode === 'rent'
            ? say(`+ ${money(facts.fee)} de condomínio · ${money(price + facts.fee)} ${currency} por mês no total`, `+ ${money(facts.fee)} de mantenimiento · ${money(price + facts.fee)} ${currency} al mes en total`)
            : say(`Condomínio de ${money(facts.fee)} ${currency} por mês`, `Mantenimiento de ${money(facts.fee)} ${currency} al mes`)}</p>}/>
      </aside>

      <section className="pp-section" aria-labelledby="pp-about-title">
        <div className="pp-about-head">
          <h2 id="pp-about-title" className="pp-section-title">{say('Sobre este imóvel', 'Acerca de este inmueble')}</h2>
          <button type="button" className="pp-mora-pill" aria-expanded={openInsights.has('description')} onClick={() => toggleInsight('description')}><img src={MORA_MARK} alt="" width="16" height="16"/><span>{say('O que vale olhar de perto', 'Qué vale mirar de cerca')}</span></button>
        </div>
        {insightFor('description')}
        <Description paragraphs={story.description(language)} home={home} advertiser={advertiser} say={say}/>
      </section>

      <section id="pp-amenities" className="pp-section" aria-labelledby="pp-amenities-title">
        <h2 id="pp-amenities-title" className="pp-section-title">{say('O que este lugar oferece', 'Lo que ofrece este lugar')}</h2>
        <Amenities amenities={story.amenities} gallery={story.gallery} language={language} say={say} onRoom={(index, element) => openGallery.current?.(index, element)}/>
      </section>

      {home.mode === 'buy' && price > 0 && <section id="pp-costs" className="pp-section" aria-labelledby="pp-costs-title">
        <ListingCosts key={home.id} price={price} money={money} currency={currency} language={language} say={say} onAsk={ask => toggleInsight(ask.section)} expanded={openInsights.has('costs')} insight={insightFor('costs')}/>
      </section>}

      {history && <section id="pp-history" className="pp-section" aria-labelledby="pp-history-title">
        <ListingPriceHistory key={home.id} history={history} money={money} currency={currency} language={language} say={say} onAsk={ask => toggleInsight(ask.section)} expanded={openInsights.has('history')} insight={insightFor('history')}/>
      </section>}

      {offers && <section id="pp-offers" className="pp-section" aria-labelledby="pp-offers-title">
        <ListingOffers ideas={offers} money={money} language={language} say={say} onAsk={ask => toggleInsight(ask.section)} expanded={openInsights.has('offer')} insight={insightFor('offer')}/>
      </section>}
    </div>

    <div className="pp-rest">
      <section id="pp-location" className="pp-section" aria-labelledby="pp-location-title">
        <h2 id="pp-location-title" className="pp-section-title">{say('Onde você vai morar', 'Dónde vas a vivir')}</h2>
        <Location home={home} location={story.location} neighborhood={story.neighborhood} language={language} money={money} currency={currency} say={say}/>
      </section>

      <section id="pp-reviews" className="pp-section" tabIndex={-1} aria-label={say('Avaliações da imobiliária', 'Reseñas de la inmobiliaria')}>
        <ListingReviews home={home} advertiser={advertiser} language={language} say={say}/>
      </section>

      <section className="pp-section pp-ask-section" aria-labelledby="pp-ask-title">
        <ListingQuestions say={say} onSend={text => openContact('message', text)}/>
      </section>

      <ListingSimilarPrices home={home} money={money} compactMoney={compactMoney} currency={currency} say={say} onOpen={item => onOpenListing?.(item)}/>

      {similar.length > 0 && <section className="pp-section" aria-labelledby="pp-similar-title">
        <div className="pp-similar-head">
          <div className="pp-similar-copy">
            <h2 id="pp-similar-title" className="pp-similar-title">{say('Imóveis parecidos', 'Inmuebles parecidos')}</h2>
            <p className="pp-similar-sub">{say(`Para ${home.mode === 'rent' ? 'alugar' : 'comprar'}, perto de ${home.area} e deste preço`, `En ${home.mode === 'rent' ? 'renta' : 'venta'}, cerca de ${home.area} y de este precio`)}</p>
          </div>
          {onMore && <button type="button" className="pp-similar-all" onClick={onMore}><span>{say('Todos os imóveis', 'Todos los inmuebles')}</span><img src="/assets/price-insights/arrow-forward.svg" alt="" width="16" height="16"/></button>}
        </div>
        <SimilarListings items={similar} search={search} pref={pref} saved={saved} receipts={receipts} onLike={onLike} onOpen={item => onOpenListing?.(item)}/>
      </section>}
    </div>
  </article>
  {/* Outside the centered column, so the related searches span the page like the results page does. */}
  <div className="pp-links-bleed">
    <HomeInternalLinks variant="results" search={linkSearch} onSearch={onSearch} onOpen={(item, event) => onOpenListing?.(item, event)}/>
  </div>
  </>;
}
