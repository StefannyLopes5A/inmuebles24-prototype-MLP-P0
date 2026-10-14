import React, {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AccountMenu} from './Account';
import {FavoriteHeart} from './FavoriteHeart';
import {createPortal} from 'react-dom';
import {listingPrice,areaLabel, propertyPhoto, inspirationCollections} from './data';
import {advertiserFor} from './listingAdvertiser';
import {listingDetails} from './listingPresentation';
import {Icon} from './App';
import {HomeSearch} from './HomeSearch.jsx';
import {NeighborhoodRail} from './NeighborhoodRail.jsx';
import {canStartSearch} from './homeSearchModel.js';
import {headerMenus, padMenuColumns} from './headerMenuData.js';
import {useLanguage,roomCount,bathCount} from './i18n';
import {installHomeMotion,playIdeaPreview} from './homeMotion.js';
import {useHoverIntent} from './listingPreload';
import {listingCardTags} from './listingCardTags';
import {ListingAgencyLogo, ListingTagList} from './ListingCardChrome';
import {developmentFacts, developmentKind} from './development/listingFacts';

const asset = name => `/assets/figma-home/${name}`;

export function HomeHeader({onHome,onAction,onLogin,onAccount,signedIn=false,inert=false,results=false}) {
  const [currencyInfo,setCurrencyInfo]=useState(false);
  const [openMenu,setOpenMenu]=useState(null);
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
          <a href="#publicar" onMouseEnter={closeFromHover} onClick={event=>{event.preventDefault();onAction?.('publish');}}>{t('Publicar')}</a>
        </div>
        <div className="figma-header-actions" onMouseEnter={closeFromHover}>
          <div className="header-currency" ref={currencyControl}><button type="button" aria-expanded={currencyInfo} aria-label={`${t('Moneda de visualización')}: ${currency}`} onClick={()=>setCurrencyInfo(!currencyInfo)}>${currency}<img src="/assets/figma-results/currency-chevron.svg" alt=""/></button>{currencyInfo&&<div className="currency-info"><strong>{t('Moneda de visualización')}</strong><div className="currency-options" role="group" aria-label={t('Moneda de visualización')}><button type="button" aria-pressed={currency==='USD'} onClick={()=>{setCurrency('USD');setCurrencyInfo(false)}}>{t('Dólar estadounidense (USD)')}</button><button type="button" aria-pressed={currency==='MXN'} onClick={()=>{setCurrency('MXN');setCurrencyInfo(false)}}>{t('Peso mexicano (MXN)')}</button></div>{currency==='USD'&&<p>{t('Conversión ilustrativa: 1 USD = 20 MXN. Confirma el precio en el anuncio original.')}</p>}</div>}</div>
          {signedIn
            ? <AccountMenu onSelect={action=>onAccount?.(action)}/>
            : <a className="figma-login" href="#entrar" onClick={event=>{event.preventDefault();onLogin?.();}}>{t('Entrar')}</a>}
        </div>
      </nav>
    </div>
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

function ListingCopy({home:h}) {
  const {t,language,money,currency}=useLanguage();
  if (h.development) return <><span>{developmentKind(language)}</span><strong>{money(listingPrice(h))} <small>{currency}</small></strong><b>{h.street} · {h.area}</b><span>{developmentFacts(language).join(' · ')}</span></>;
  return <><span>{t(h.mode==='buy'?'Venta':'Renta')} · {t('Departamento')}</span><strong>{money(listingPrice(h))} <small>{currency}{h.mode==='rent'?' / '+t('mes'):''}</small></strong><b>{h.street} · {h.area}</b><span>{t(areaLabel(h))} · {roomCount(h.beds,language)} · {bathCount(h.baths,language)}</span></>;
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

export function HouseCard({home, saved, onLike, onOpen, contacted=false, search, pref='none'}) {
  const {t,language}=useLanguage();
  const videoRef=useRef(null);
  const tags=useMemo(()=>listingCardTags(home,{search,pref,language,contacted}),[home,search,pref,language,contacted]);
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

function InspirationRail({title,subtitle,items,saved,onLike,onOpen,receipts=[],compact=false,search,pref='none'}) {
  const {t}=useLanguage();
  const rail=useRef(null);
  const [position,setPosition]=useState({start:true,end:false});
  useEffect(()=>{if(!rail.current)return;const observer=new ResizeObserver(measure);observer.observe(rail.current);measure();return()=>observer.disconnect()},[items.length,items[0]?.id]);
  function move(direction){const el=rail.current;el.scrollBy({left:direction*(el.clientWidth*.8),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  function measure(){const el=rail.current;if(el)setPosition({start:el.scrollLeft<2,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-2});}
  return <section className={'discovery-section '+(compact?'compact-rail':'')} aria-label={t(title)}>
    <div className="discovery-heading"><div><h2>{t(title)}</h2><p>{t(subtitle)}</p></div><div className="rail-controls"><button className="icon-button" aria-label={t('Anterior: ')+t(title)} disabled={position.start} onClick={()=>move(-1)}><Icon name="back"/></button><button className="icon-button" aria-label={t('Siguiente: ')+t(title)} disabled={position.end||items.length<2} onClick={()=>move(1)}><Icon name="arrow"/></button></div></div>
    <div className="discovery-rail" ref={rail} onScroll={measure}>{items.map(h=><HouseCard key={h.id} home={h} search={search} pref={pref} contacted={receipts.some(r=>r.propertyId===h.id)} saved={saved.includes(h.id)} onLike={onLike} onOpen={onOpen}/>)}</div>
  </section>;
}

function IdeaCards({collections,onChoose,onOpen,saved,onLike}) {
  const {t}=useLanguage();
  const rail=useRef(null);
  const [preview,setPreview]=useState(null);
  const closeTimer=useRef();
  const popup=useRef(null);
  const trigger=useRef(null);
  const previewInput=useRef('hover');
  const previewMotion=useRef(null);
  const restoringFocus=useRef(false);
  function cancelClose(){clearTimeout(closeTimer.current);}
  function closeSoon(){
    cancelClose();
    closeTimer.current=setTimeout(()=>{
      const hovering=trigger.current?.matches(':hover')||popup.current?.matches(':hover');
      const keyboardFocus=previewInput.current==='keyboard'&&(document.activeElement===trigger.current||popup.current?.contains(document.activeElement));
      if(!hovering&&!keyboardFocus)dismissPreview();
    },300);
  }
  function dismissPreview(restoreFocus=false,animate=previewInput.current!=='keyboard'){
    cancelClose();
    if(restoreFocus){restoringFocus.current=true;trigger.current?.focus({preventScroll:true});restoringFocus.current=false;}
    if(animate&&!matchMedia('(prefers-reduced-motion:reduce)').matches&&!document.hidden){
      setPreview(value=>value?{...value,closing:true,animate}:null);
    }else setPreview(null);
  }
  function show(home,event,input='hover'){
    cancelClose();previewInput.current=input;trigger.current=event.currentTarget;
    const anchor=event.currentTarget.getBoundingClientRect(),width=Math.min(310,window.innerWidth-32);
    setPreview({home,anchor,left:Math.max(16,Math.min(anchor.left-65,window.innerWidth-width-16)),top:anchor.bottom+12,width,closing:false,animate:input!=='keyboard'});
  }
  useLayoutEffect(()=>{
    if(!preview||!popup.current)return;
    // Measure the real card so the hover path is a short gap, never an overlap.
    const height=popup.current.offsetHeight,{anchor}=preview;
    const above=anchor.top-height-12;
    const top=Math.max(16,Math.min(above>=16?above:anchor.bottom+12,window.innerHeight-height-16));
    popup.current.style.top=`${top}px`;
  },[preview]);
  useLayoutEffect(()=>{
    const panel=popup.current,previous=previewMotion.current;
    const style=panel&&previous?.playState==='running'?getComputedStyle(panel):null;
    const interrupted=style?{opacity:style.opacity,transform:style.transform,filter:style.filter}:null;
    previewMotion.current=null;previous?.cancel();
    if(!preview||!panel)return;
    const animation=playIdeaPreview(panel,!preview.closing,preview.animate,preview.anchor,interrupted);
    previewMotion.current=animation;
    if(preview.closing){
      if(!animation){setPreview(null);return;}
      const finish=()=>{
        if(previewMotion.current!==animation)return;
        previewMotion.current=null;
        setPreview(value=>value?.closing?null:value);
      };
      animation.finished.then(finish,finish);
    }
  },[preview?.home.id,preview?.closing]);
  function cycleWidth(){const el=rail.current;return el?.children[collections.length]?.offsetLeft-el?.children[0]?.offsetLeft||0;}
  function loopScroll(){const el=rail.current;const width=cycleWidth();if(!el||!width)return;if(el.scrollLeft<width/2)el.scrollLeft+=width;else if(el.scrollLeft>width*1.5)el.scrollLeft-=width;}
  useEffect(()=>{
    const el=rail.current;if(!el)return;
    const alignStart=()=>{
      el.scrollLeft=cycleWidth();
      // The rail starts in its middle copy. Stagger by screen position, not DOM order.
      const cards=[...el.children].map(card=>({card,box:card.getBoundingClientRect()}));
      const first=cards.find(({box})=>box.right>0)?.box.left||0;
      cards.forEach(({card,box})=>card.style.setProperty('--intro-card-delay',`${Math.max(0,Math.min(4,Math.round((box.left-first)/(box.width+16))))*65}ms`));
    };
    alignStart();const observer=new ResizeObserver(alignStart);observer.observe(el);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const close=()=>dismissPreview(false,false);
    const key=e=>{if(e.key==='Escape'&&popup.current)dismissPreview(true,false);};
    const outside=e=>{if(popup.current&&!popup.current.contains(e.target)&&!trigger.current?.contains(e.target))dismissPreview();};
    const scroll=e=>{
      if(popup.current?.contains(e.target))return;
      if(previewInput.current==='keyboard'&&trigger.current){
        const anchor=trigger.current.getBoundingClientRect();
        setPreview(value=>value?{...value,anchor}:null);
      }else close();
    };
    window.addEventListener('resize',close);window.addEventListener('keydown',key);window.addEventListener('scroll',scroll,true);document.addEventListener('pointerdown',outside);
    return()=>{cancelClose();const animation=previewMotion.current;previewMotion.current=null;animation?.cancel();window.removeEventListener('resize',close);window.removeEventListener('keydown',key);window.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',outside);};
  },[]);
  return <section className="idea-section" aria-label={t('Ideas para empezar')}><h2>{t('O empieza por algo que te inspire')}</h2><div className="idea-rail" ref={rail} tabIndex={0} aria-label={t('Ideas para empezar')} onScroll={loopScroll}>{[0,1,2].flatMap(copy=>collections.map(idea=><article className="idea-card" key={`${copy}-${idea.id}`}><div className="idea-bottom"><div className="photo-stack">{idea.previewItems.map(h=><button className="idea-photo" key={h.id} aria-label={t('Vista previa de ')+h.street} aria-expanded={!preview?.closing&&preview?.home.id===h.id} aria-controls={!preview?.closing&&preview?.home.id===h.id?'idea-property-preview':undefined}
      onPointerEnter={e=>{if(e.pointerType!=='touch')show(h,e);}} onPointerLeave={e=>{if(e.pointerType!=='touch')closeSoon();}}
      onFocus={e=>{if(!restoringFocus.current&&e.currentTarget.matches(':focus-visible'))show(h,e,'keyboard');}}
      onBlur={e=>{if(!popup.current?.contains(e.relatedTarget))closeSoon();}}
      onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();cancelClose();requestAnimationFrame(()=>popup.current?.querySelector('button')?.focus({preventScroll:true}));}}}
      onClick={e=>show(h,e,e.detail?'click':'keyboard')}><img src={propertyPhoto(h)} alt={h.imageAlt} loading="lazy"/></button>)}</div></div><button className="idea-title" onClick={()=>onChoose(idea)} title={t(idea.queryLead)}>{t(idea.queryLead)}</button></article>))}</div>{preview&&createPortal(<section ref={popup} id="idea-property-preview" className="idea-property-preview" aria-label={t('Vista previa: ')+preview.home.street} data-open={!preview.closing} data-preview-motion={preview.animate} inert={preview.closing} aria-hidden={preview.closing||undefined} style={{left:preview.left,top:preview.top,width:preview.width}} onPointerEnter={cancelClose} onPointerLeave={e=>{if(e.pointerType!=='touch')closeSoon();}} onFocus={cancelClose} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))closeSoon();}}>
    <span className="preview-visual" key={preview.home.id}><img className="preview-photo" src={propertyPhoto(preview.home)} alt={preview.home.imageAlt}/></span><button className="preview-close icon-button" aria-label={t('Cerrar vista previa')} onClick={e=>dismissPreview(true,e.detail>0)}><Icon name="close" size={17}/></button><div className="preview-copy"><ListingCopy home={preview.home}/></div><div className="preview-actions"><button className="text-button" onClick={e=>{onOpen(preview.home,{currentTarget:trigger.current});dismissPreview(false,false);}}>{t('Ver inmueble')}<Icon name="arrow" size={17}/></button><button className="icon-button" aria-label={t('Guardar ')+preview.home.street} aria-pressed={saved.includes(preview.home.id)} onClick={()=>onLike(preview.home)}><Icon name="heart"/></button></div>
  </section>,document.body)}</section>;
}

export function Home({search,setSearch,onSearch,saved,onLike,onOpen,receipts=[],choices,onChoose,skipIntro,onIntroDone}) {
  const {t}=useLanguage();
  const motionRoot=useRef(null);
  useLayoutEffect(()=>installHomeMotion(motionRoot.current),[]);
  const [{stage,animate},setStage]=useState({stage:skipIntro?3:0,animate:!skipIntro});
  const collections=inspirationCollections(search.mode==='rent'?'rent':'buy');
  const common={saved,onLike,onOpen,receipts};
  function submit(){if(canStartSearch(choices))onSearch({...search,area:search.area||'Ambas zonas',address:'',fromIdea:false});}
  return <div ref={motionRoot} className="discovery-home home-evolution" data-intro-stage={stage} data-intro-animate={animate}>
    <div className="home-firstfold">
    <HomeSearch search={search} setSearch={setSearch} choices={choices} onChoose={onChoose} skipIntro={skipIntro} onIntroDone={onIntroDone} onStage={setStage} onSubmit={submit}/>
    <div className="home-ideas-reveal" inert={stage<1}>
      <IdeaCards key={search.mode} collections={collections} saved={saved} onLike={onLike} onOpen={onOpen} onChoose={idea=>{onIntroDone();onChoose('template');onSearch({...search,mode:search.mode==='rent'?'rent':'buy',propertyType:'apartment',criteria:[],minBudget:0,area:idea.area,areas:[idea.area],address:'',beds:idea.beds,budget:idea.budget,note:t(idea.note),ideaLabel:idea.queryLead,fromIdea:true});}}/>
    </div>
    </div>
    <div className="home-discovery-reveal" inert={stage<3}>
      {collections.map((collection,i)=><React.Fragment key={search.mode+collection.id}>
        <InspirationRail {...collection} compact={i>0} {...common}/>
        {i===1&&<NeighborhoodRail
          mode={search.mode}
          onModeChange={(mode,budget)=>setSearch(current=>({...current,mode,budget,minBudget:0}))}
          onSelect={(area,mode)=>{onIntroDone();onChoose('template');onSearch({...search,mode,propertyType:'apartment',criteria:[],minBudget:0,budget:mode==='rent'?28000:7500000,area,areas:[area],address:'',fromIdea:false});}}
        />}
      </React.Fragment>)}
    </div>
  </div>;
}
