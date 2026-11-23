import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AccountMenu} from './Account';
import {FavoriteHeart} from './FavoriteHeart';
import {listingPrice,areaLabel, propertyPhoto, inspirationCollections, homes} from './data';
import {demoRecentIdeaCards, ideaCardsFromHistory, ideaSuggestionCards} from './searchHistory.js';
import {advertiserFor} from './listingAdvertiser';
import {listingDetails} from './listingPresentation';
import {Icon} from './App';
import {HomeSearch} from './HomeSearch.jsx';
import {NeighborhoodRail} from './NeighborhoodRail.jsx';
import {HomeGuestPromo} from './HomeGuestPromo.jsx';
import {HomePopularCities} from './HomePopularCities.jsx';
import {HomeBlog} from './HomeBlog.jsx';
import {HomeCityGuide} from './HomeCityGuide.jsx';
import {HomeBrokers} from './HomeBrokers.jsx';
import {HomeInternalLinks} from './HomeInternalLinks.jsx';
import {RailHeading, useRailScroll} from './DiscoveryRail.jsx';
import {canStartHomeSearch, hasChosenLocation} from './homeSearchModel.js';
import {areas} from './data';
import {DEMO_MXN_PER_USD} from './i18n';
import {describeHomeQuery} from './searchCriteria.js';
import {headerMenus, padMenuColumns} from './headerMenuData.js';
import {useLanguage,roomCount,bathCount} from './i18n';
import {installHomeMotion} from './homeMotion.js';
import {PropertyPreview, previewPhotoProps, usePropertyPreview} from './ideaPreview.jsx';
import {useHoverIntent} from './listingPreload';
import {listingCardTags} from './listingCardTags';
import {ListingAgencyLogo, ListingTagList} from './ListingCardChrome';
import {developmentFacts, developmentKind} from './development/listingFacts';

const asset = name => `/assets/figma-home/${name}`;

export function HomeHeader({onHome,onAction,onLogin,onAccount,signedIn=false,inert=false,results=false}) {
  const [currencyInfo,setCurrencyInfo]=useState(false);
  const [openMenu,setOpenMenu]=useState(null);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [mobileSection,setMobileSection]=useState(null);
  const [headerHidden,setHeaderHidden]=useState(false);
  const currencyControl=useRef(null);
  const headerRef=useRef(null);
  const closeMenuTimer=useRef(null);
  const lastScrollY=useRef(typeof window!=='undefined'?window.scrollY:0);
  const panelId=useId();
  const {t,currency,setCurrency}=useLanguage();
  const activeMenu=headerMenus.find(menu=>menu.id===openMenu) || null;

  useEffect(()=>()=>{clearTimeout(closeMenuTimer.current)},[]);

  useEffect(()=>{
    lastScrollY.current=window.scrollY;
    const onScroll=()=>{
      const y=window.scrollY;
      const delta=y-lastScrollY.current;
      // The listing panel scrolls the page to fit itself; the header keeps whatever state it had.
      if(document.documentElement.dataset.listingPanel!=null){
        lastScrollY.current=y;
        return;
      }
      if(y<=8){
        setHeaderHidden(false);
      }else if(delta>6){
        setHeaderHidden(true);
        setOpenMenu(null);
        setMobileOpen(false);
        setCurrencyInfo(false);
      }else if(delta<-2){
        setHeaderHidden(false);
      }
      lastScrollY.current=y;
    };
    window.addEventListener('scroll',onScroll,{passive:true});
    return()=>window.removeEventListener('scroll',onScroll);
  },[]);

  useEffect(()=>{
    if(!currencyInfo)return;
    const close=e=>{if(e.type==='keydown'&&e.key==='Escape'){setCurrencyInfo(false);currencyControl.current?.querySelector('button')?.focus();}else if(e.type!=='keydown'&&!currencyControl.current?.contains(e.target))setCurrencyInfo(false)};
    document.addEventListener('pointerdown',close);document.addEventListener('focusin',close);document.addEventListener('keydown',close);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('focusin',close);document.removeEventListener('keydown',close)};
  },[currencyInfo]);

  useEffect(()=>{
    if(!signedIn)setMobileOpen(false);
  },[signedIn]);

  useEffect(()=>{
    if(!mobileOpen)return;
    const close=e=>{
      if(e.type==='keydown'){if(e.key==='Escape'){setMobileOpen(false);headerRef.current?.querySelector('.header-burger')?.focus();}return;}
      if(headerRef.current&&!headerRef.current.contains(e.target))setMobileOpen(false);
    };
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',close);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close)};
  },[mobileOpen]);

  useEffect(()=>{
    if(!openMenu)return;
    const close=e=>{
      if(e.type==='keydown'&&e.key==='Escape'){
        setOpenMenu(null);
        headerRef.current?.querySelector(`[data-menu-trigger="${openMenu}"]`)?.focus();
        return;
      }
      if(e.type!=='keydown'&&headerRef.current&&!headerRef.current.contains(e.target))setOpenMenu(null);
    };
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',close);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close)};
  },[openMenu]);

  function fineHover(){
    return typeof window!=='undefined'&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  }
  function cancelCloseMenu(){
    clearTimeout(closeMenuTimer.current);
  }
  function openFromHover(id){
    if(!fineHover())return;
    cancelCloseMenu();
    setOpenMenu(id);
  }
  function closeFromHover(){
    if(!fineHover())return;
    cancelCloseMenu();
    closeMenuTimer.current=setTimeout(()=>setOpenMenu(null),60);
  }
  function leaveMenuZone(event){
    if(!fineHover())return;
    const next=event.relatedTarget;
    if(next instanceof Element&&(next.closest('.header-menu-item')||next.closest('.header-mega')))return;
    closeFromHover();
  }
  function ignoreSeoLink(event){
    event.preventDefault();
  }

  return <header
    ref={headerRef}
    className={'site-header home-header'+(results?' results-header':'')+(openMenu?' has-mega-menu':'')+(headerHidden?' is-header-hidden':'')}
    inert={inert}
    onMouseLeave={closeFromHover}
  >
    <div className="home-header-bar">
      <button className="brand" onClick={onHome} onMouseEnter={closeFromHover} aria-label={t('Inmuebles24, inicio')}><img src={asset('d0d59.svg')} alt="Inmuebles24"/></button>
      <nav className="figma-header-links" aria-label={t('Navegación principal')}>
        <div className="figma-header-nav">
          {headerMenus.map(menu=>{
            const expanded=openMenu===menu.id;
            return <div
              key={menu.id}
              className={'header-menu-item'+(expanded?' is-open':'')}
              onMouseEnter={()=>openFromHover(menu.id)}
              onMouseLeave={leaveMenuZone}
            >
              <button
                type="button"
                className="header-menu-trigger"
                data-menu-trigger={menu.id}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={()=>setOpenMenu(expanded?null:menu.id)}
              >
                <span>{t(menu.labelKey)}</span>
                <img className="header-menu-chevron" src="/assets/figma-results/currency-chevron.svg" alt="" />
              </button>
            </div>;
          })}
          <a href="#imobiliarias" onMouseEnter={closeFromHover} onClick={event=>{event.preventDefault();onAction?.('agencies');}}>{t('Buscar imobiliárias')}</a>
        </div>
        <div className={'figma-header-actions'+(signedIn?' is-signed-in':'')} onMouseEnter={closeFromHover}>
          {signedIn && <div className="header-currency" ref={currencyControl}><button type="button" aria-expanded={currencyInfo} aria-label={`${t('Moneda de visualización')}: ${currency}`} onClick={()=>setCurrencyInfo(!currencyInfo)}>${currency}<img src="/assets/figma-results/currency-chevron.svg" alt=""/></button>{currencyInfo&&<div className="currency-info"><strong>{t('Moneda de visualización')}</strong><div className="currency-options" role="group" aria-label={t('Moneda de visualización')}><button type="button" aria-pressed={currency==='USD'} onClick={()=>{setCurrency('USD');setCurrencyInfo(false)}}>{t('Dólar estadounidense (USD)')}</button><button type="button" aria-pressed={currency==='MXN'} onClick={()=>{setCurrency('MXN');setCurrencyInfo(false)}}>{t('Peso mexicano (MXN)')}</button></div>{currency==='USD'&&<p>{t('Conversión ilustrativa: 1 USD = 20 MXN. Confirma el precio en el anuncio original.')}</p>}</div>}</div>}
          {!signedIn && <a className="figma-publish" href="#publicar" onClick={event=>{event.preventDefault();onAction?.('publish');}}>{t('Anunciar')}</a>}
          {signedIn
            ? <AccountMenu onSelect={action=>onAccount?.(action)}/>
            : <a className="figma-login" href="#entrar" onClick={event=>{event.preventDefault();onLogin?.();}}>{t('Entrar')}</a>}
          {signedIn && <button type="button" className="header-burger" aria-expanded={mobileOpen} aria-controls={`${panelId}-mobile`} aria-label={t('Menú')} onClick={()=>setMobileOpen(!mobileOpen)}><span aria-hidden="true"/></button>}
        </div>
      </nav>
    </div>
    {signedIn&&mobileOpen&&<div className="header-mobile-menu" id={`${panelId}-mobile`} role="region" aria-label={t('Navegación principal')}>
      <ul>
        {headerMenus.map(menu=>{
          const expanded=mobileSection===menu.id;
          return <li key={menu.id}>
            <button type="button" className="header-mobile-trigger" aria-expanded={expanded} onClick={()=>setMobileSection(expanded?null:menu.id)}>
              <span>{t(menu.labelKey)}</span>
              <img className="header-menu-chevron" src="/assets/figma-results/currency-chevron.svg" alt=""/>
            </button>
            {expanded&&<div className="header-mobile-columns">
              {menu.columns.map(column=><div key={column.titleKey}>
                <p>{t(column.titleKey)}</p>
                <ul>{column.items.map(item=><li key={item}><a href="#seo" onClick={ignoreSeoLink}>{t(item)}</a></li>)}</ul>
              </div>)}
            </div>}
          </li>;
        })}
        <li><a className="header-mobile-link" href="#imobiliarias" onClick={event=>{event.preventDefault();setMobileOpen(false);onAction?.('agencies');}}>{t('Buscar imobiliárias')}</a></li>
      </ul>
    </div>}
    {activeMenu&&<div className="header-mega" id={panelId} role="region" aria-label={t(activeMenu.labelKey)} onMouseEnter={()=>openFromHover(activeMenu.id)} onMouseLeave={leaveMenuZone}>
      <div className="header-mega-grid">
        {padMenuColumns(activeMenu.columns).map((column,index)=>column
          ? <div className="header-mega-column" key={`${activeMenu.id}-${column.titleKey}`}>
              <p className="header-mega-title">{t(column.titleKey)}</p>
              <ul>
                {column.items.map(item=><li key={item}><a href="#seo" onClick={ignoreSeoLink}>{t(item)}</a></li>)}
              </ul>
            </div>
          : <div className="header-mega-column is-empty" key={`${activeMenu.id}-empty-${index}`} aria-hidden="true" />)}
      </div>
    </div>}
  </header>;
}

function canPlayHoverVideo() {
  return matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches;
}

function ListingPhotos({home}) {
  const photos = listingDetails(home).gallery.slice(0, 8);
  if (photos.length < 2) return <img src={photos[0] || propertyPhoto(home)} alt={home.imageAlt} loading="lazy"/>;
  return <span className="discovery-slides">{photos.map((src, index) => <img className="discovery-slide" key={src} src={src} alt={index ? '' : home.imageAlt} loading="lazy"/>)}</span>;
}

export function RailListingCopy({home:h, videoRef}) {
  const {t,language,money,currency}=useLanguage();
  const say=(br,es)=>language==='pt-BR'?br:es;
  const advertiser=advertiserFor(h);
  const kind=h.development?[developmentKind(language)]:[t(h.mode==='buy'?'Venta':'Renta'),t('Departamento')];
  const facts=h.development?developmentFacts(language):[t(areaLabel(h)),roomCount(h.beds,language),bathCount(h.baths,language)];
  const dotted=items=>items.flatMap((item,index)=>index?[<span key={`dot-${index}`} className="discovery-separator" aria-hidden="true">•</span>,<span key={item}>{item}</span>]:[<span key={item}>{item}</span>]);
  return <>
    <span className={"discovery-media"+(h.video?" has-video":"")+(h.development?" is-development":"")}><ListingPhotos home={h}/>{h.video&&<video ref={videoRef} className="discovery-video" src={h.video} muted loop playsInline preload="none" aria-hidden="true" onPlaying={e=>e.currentTarget.parentElement.classList.add('is-playing')} onPause={e=>e.currentTarget.parentElement.classList.remove('is-playing')}/>}<span className="discovery-copy"><span className="discovery-kind">{dotted(kind)}</span><strong>{money(listingPrice(h))} <small>{currency}{h.mode==='rent'?' / '+t('mes'):''}</small></strong></span></span>
    <span className="discovery-meta"><span className="discovery-meta-copy"><b title={`${h.street} · ${h.area}`}>{h.street} · {h.area}</b><span className="discovery-facts">{dotted(facts)}</span></span><ListingAgencyLogo home={h} say={say} alt={h.brokerLogo?h.broker:(advertiser.logo?advertiser.name:'')}/></span>
  </>;
}

export function HouseCard({home, saved, onLike, onOpen, contacted=false, search, pref='none', signal=null}) {
  const {t,language}=useLanguage();
  const videoRef=useRef(null);
  const tags=useMemo(()=>listingCardTags(home,{search,pref,language,contacted,signal}),[home,search,pref,language,contacted,signal]);
  const intent=useHoverIntent(home);
  const videoDelay=useRef(null);
  useEffect(()=>()=>clearTimeout(videoDelay.current),[]);
  function playVideo(event) {
    if (event?.pointerType==='touch' || !home.video || !canPlayHoverVideo()) return;
    const start=()=>{const el=videoRef.current;if (el?.paused) el.play()?.catch(()=>{});};
    // The development's film is a render; a short dwell keeps a pass over the grid from starting it.
    if (home.development) {clearTimeout(videoDelay.current);videoDelay.current=setTimeout(start,400);return;}
    start();
  }
  function stopVideo() {
    clearTimeout(videoDelay.current);
    const el=videoRef.current;
    if (!el) return;
    el.pause();
    try { el.currentTime=0; } catch { /* The file can still be loading. */ }
  }
  return <article className="discovery-item" data-listing-id={home.listingId} data-home-id={home.id}>
    <div className="discovery-card" onPointerEnter={event=>{playVideo(event);intent.onPointerEnter(event);}} onPointerLeave={event=>{intent.onPointerLeave();if (event.pointerType!=='touch') stopVideo();}} onFocus={()=>{playVideo();intent.onFocus();}} onBlur={event=>{if (!event.currentTarget.contains(event.relatedTarget)) stopVideo();}}>
      <button className="discovery-open" onClick={e=>onOpen(home,e)} aria-label={t('Explorar ')+home.street}><RailListingCopy home={home} videoRef={videoRef}/></button>
      {(tags.length>0||contacted)&&<span className="discovery-tags">
        {contacted&&<span className="discovery-tag is-contacted"><Icon name="check" size={12}/>{language==='pt-BR'?'Contato enviado':'Contacto enviado'}</span>}
        <ListingTagList tags={tags}/>
      </span>}
      <button className={'discovery-like '+(saved?'is-liked':'')} aria-label={t(saved?'Quitar de favoritos ':'Me gusta ')+home.street} aria-pressed={saved} onClick={()=>onLike(home)}>
        <FavoriteHeart/>
      </button>
    </div>
  </article>;
}

function InspirationRail({title,subtitle,titleValues,items,saved,onLike,onOpen,receipts=[],compact=false,search,pref='none'}) {
  const {t}=useLanguage();
  const heading=t(title,titleValues);
  const {rail,position,measure,move}=useRailScroll([items.length,items[0]?.id]);
  return <section className={'discovery-section '+(compact?'compact-rail':'')} aria-label={heading}>
    <RailHeading title={heading} subtitle={t(subtitle)} prevLabel={t('Anterior: ')+heading} nextLabel={t('Siguiente: ')+heading} position={position} onMove={move} nextDisabled={items.length<2}/>
    <div className="discovery-rail" ref={rail} onScroll={measure}>{items.map(h=><HouseCard key={h.id} home={h} search={search} pref={pref} contacted={receipts.some(r=>r.propertyId===h.id)} saved={saved.includes(h.id)} onLike={onLike} onOpen={onOpen}/>)}</div>
  </section>;
}

function IdeaCards({cards,heading,onRunSearch,onOpen,saved,onLike,variant='suggestions',infiniteLoop=false}) {
  const {t}=useLanguage();
  const {rail,position,measure,move}=useRailScroll([cards.length,variant]);
  const previewApi=usePropertyPreview();
  const {preview,dismissPreview}=previewApi;
  function cycleWidth(){const el=rail.current;return el?.children[cards.length]?.offsetLeft-el?.children[0]?.offsetLeft||0;}
  function runCard(card){dismissPreview(false,false);onRunSearch(card);}
  function cardActivate(event,card){if(event.target.closest('.idea-photo'))return;runCard(card);}
  function loopScroll(){if(!infiniteLoop)return;const el=rail.current;const width=cycleWidth();if(!el||!width)return;if(el.scrollLeft<width/2)el.scrollLeft+=width;else if(el.scrollLeft>width*1.5)el.scrollLeft-=width;}
  useEffect(()=>{
    const el=rail.current;if(!el)return;
    const alignStart=()=>{
      el.scrollLeft=infiniteLoop?cycleWidth():0;
      const items=[...el.children].map(card=>({card,box:card.getBoundingClientRect()}));
      const first=items.find(({box})=>box.right>0)?.box.left||0;
      items.forEach(({card,box})=>card.style.setProperty('--intro-card-delay',`${Math.max(0,Math.min(4,Math.round((box.left-first)/(box.width+16))))*65}ms`));
    };
    alignStart();const observer=new ResizeObserver(alignStart);observer.observe(el);
    return()=>observer.disconnect();
  },[cards.length,infiniteLoop]);
  const railCards=infiniteLoop?[0,1,2].flatMap(copy=>cards.map(card=>({card,key:`${copy}-${card.id}`}))):cards.map(card=>({card,key:card.id}));
  return <section className="idea-section" data-idea-variant={variant} aria-label={heading}><div className="idea-heading"><h2>{heading}</h2>{variant==='suggestions'&&<div className="rail-controls"><button type="button" className="icon-button" aria-label={t('Anterior: ')+heading} disabled={position.start} onClick={()=>move(-1)}><Icon name="back"/></button><button type="button" className="icon-button" aria-label={t('Siguiente: ')+heading} disabled={position.end||cards.length<2} onClick={()=>move(1)}><Icon name="arrow"/></button></div>}</div><div className={`idea-rail${variant==='recent'?' idea-rail--static':infiniteLoop?'':' idea-rail--scroll'}`} ref={rail} tabIndex={variant==='recent'?undefined:0} aria-label={heading} onScroll={infiniteLoop?loopScroll:variant==='recent'?undefined:measure}>{railCards.map(({card,key})=><article className="idea-card" data-clickable key={key} tabIndex={0} aria-label={t(card.queryLead)} onClick={event=>cardActivate(event,card)} onKeyDown={event=>{if(event.target.closest('.idea-photo'))return;if(event.key==='Enter'||event.key===' '){event.preventDefault();runCard(card);}}}>{card.recent&&<span className="idea-recent-mark" aria-hidden="true"><Icon name="history" size={18}/></span>}<div className="idea-bottom"><div className="photo-stack">{card.previewItems.map(h=><button type="button" className="idea-photo" key={h.id} aria-label={t('Vista previa de ')+h.street} {...previewPhotoProps(h,previewApi)}><img src={propertyPhoto(h)} alt={h.imageAlt} loading="lazy"/></button>)}</div></div><span className="idea-title">{t(card.queryLead)}</span></article>)}</div><PropertyPreview api={previewApi} saved={saved} onLike={onLike} onOpen={onOpen}/></section>;
}

export function Home({search,setSearch,onSearch,saved,onLike,onOpen,receipts=[],choices,onChoose,skipIntro,onIntroDone,signedIn=false,searchHistory=[],recent=[],onLogin,searchLayout='inline'}) {
  const {t,currency,language}=useLanguage();
  const say=(pt,es)=>language==='pt-BR'?pt:es;
  const motionRoot=useRef(null);
  useLayoutEffect(()=>installHomeMotion(motionRoot.current),[]);
  const [{stage,animate},setStage]=useState({stage:3,animate:false});
  const mode=search.mode==='rent'?'rent':'buy';
  const collections=inspirationCollections(mode);
  const byId=Object.fromEntries(collections.map(collection=>[collection.id,collection]));
  const places='Diez lugares para empezar a imaginar tu vida en CDMX.';
  const wide='Explora los espacios más amplios de esta selección.';
  const city='Ciudad de México';
  const seen=recent.map(entry=>homes.find(home=>home.id===(entry.id||entry))).filter(home=>home&&home.mode===mode);
  const guestRails=[
    {...byId.discover,title:'Próximos lanzamientos inmobiliarios al máximo',subtitle:places},
    {...byId.space,title:'Propiedades más vistas de la semana',subtitle:wide},
  ];
  const closingRail={...byId.city,title:'Casas y Departamentos en Ciudad de México',subtitle:wide};
  const memberRails=[
    {...byId.discover,title:'Apartamentos para ti en {city}',subtitle:places,titleValues:{city}},
    {...byId.routine,title:'Continúa buscando {city}',subtitle:places,titleValues:{city}},
  ];
  const memberAfterPrice=[
    {...byId.possibilities,title:'Casas en tendencia en {city}',subtitle:places,titleValues:{city}},
    {...byId.space,title:'Visto recientemente',subtitle:wide,items:seen.length?seen:byId.space.items},
  ];
  const suggestionCards=useMemo(()=>ideaSuggestionCards(mode, value=>t(value)),[mode,language]);
  const recentCards=useMemo(()=>{
    const saved=ideaCardsFromHistory(searchHistory,mode);
    if (saved.length) return saved;
    return signedIn ? demoRecentIdeaCards(mode) : [];
  },[searchHistory,mode,signedIn]);
  const ideaCards=signedIn?recentCards:suggestionCards;
  const ideaHeading=signedIn?say('Suas buscas recentes','Tus búsquedas recientes'):t('Sugerencia de búsquedas');
  const common={saved,onLike,onOpen,receipts};
  function runIdeaSearch(card){onIntroDone();onChoose('template');onSearch({...card.search,fromIdea:!!card.search.fromIdea});}
  function openNeighborhood(area,nextMode){onIntroDone();onChoose('template');onSearch({...search,mode:nextMode,propertyType:'apartment',criteria:[],minBudget:0,budget:nextMode==='rent'?28000:7500000,area,areas:[area],address:'',fromIdea:false});}
  function submit(next){
    if (searchLayout === 'original') {
      const source = next && typeof next === 'object' ? next : search;
      if (!hasChosenLocation(source)) return;
      onSearch({...source, area: source.area || 'Ambas zonas', fromIdea: false});
      return;
    }
    const detected = describeHomeQuery(search.note, areas, currency, DEMO_MXN_PER_USD);
    if (!canStartHomeSearch(search.note, detected)) return;
    onSearch({...search, area: search.area || 'Ambas zonas', address: '', fromIdea: false});
  }
  return <div ref={motionRoot} className="discovery-home home-evolution" data-home-session={signedIn?'member':'guest'} data-intro-stage={stage} data-intro-animate={animate}>
    <div className="home-firstfold">
    <HomeSearch search={search} setSearch={setSearch} choices={choices} onChoose={onChoose} skipIntro={skipIntro} onIntroDone={onIntroDone} onStage={setStage} onSubmit={submit} layout={searchLayout}/>
    <div className="home-ideas-reveal" inert={stage<1}>
      <IdeaCards key={`${search.mode}-${signedIn}-${ideaCards[0]?.id||'ideas'}`} cards={ideaCards} heading={ideaHeading} variant={signedIn?'recent':'suggestions'} infiniteLoop={false} saved={saved} onLike={onLike} onOpen={onOpen} onRunSearch={runIdeaSearch}/>
    </div>
    {!signedIn && <div className="home-guest-promo-reveal" inert={stage<1}><HomeGuestPromo onLogin={onLogin}/></div>}
    </div>
    <div className="home-discovery-reveal" inert={stage<3}>
      {signedIn
        ? <>
          {memberRails.map((collection,index)=><InspirationRail key={collection.title} {...collection} compact={index>0} search={search} {...common}/>)}
          <NeighborhoodRail onSelect={openNeighborhood}/>
          {memberAfterPrice.map(collection=><InspirationRail key={collection.title} {...collection} compact search={search} {...common}/>)}
          <HomePopularCities search={search} onSearch={onSearch} onIntroDone={onIntroDone} onChoose={onChoose}/>
        </>
        : <>
          <HomePopularCities search={search} onSearch={onSearch} onIntroDone={onIntroDone} onChoose={onChoose}/>
          {guestRails.map((collection,index)=><InspirationRail key={collection.title} {...collection} compact={index>0} search={search} {...common}/>)}
          <NeighborhoodRail onSelect={openNeighborhood}/>
        </>}
      <HomeBlog/>
      <HomeCityGuide search={search} onSearch={onSearch} onIntroDone={onIntroDone} onChoose={onChoose}/>
      <HomeBrokers search={search} onSearch={onSearch} onIntroDone={onIntroDone} onChoose={onChoose}/>
      <InspirationRail {...closingRail} compact search={search} {...common}/>
      <HomeInternalLinks search={search} onSearch={onSearch} onIntroDone={onIntroDone} onChoose={onChoose}/>
    </div>
  </div>;
}
