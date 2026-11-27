import React,{lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AnimatePresence} from 'motion/react';
import {PropertyDetail} from './PropertyDetail';
import {FavoritesPage} from './FavoritesPage.jsx';
import {SavedSearches} from './SavedSearches.jsx';
import {MessagesPage} from './MessagesPage.jsx';
import {HistoryPage} from './HistoryPage.jsx';
import {AccountToast,LoginDialog} from './Account';
import {normalizeSaved,toggleSaved,normalizeRecent,recordView,savedCountLabel} from './favorites.js';
import {readContactProfile,writeContactProfile} from './contactProfile.js';

import {Home,HomeHeader} from './Home';
import {ResultsFlowPage} from './ResultsFlowPage';
import {ProjectGuide} from './ProjectGuide';
import {VersionSwitcher} from './VersionSwitcher';
import {guideEnabled} from './guideStops.js';
import {captureHomeTransition} from './searchFlowMotion';
import {cardPhoto,morphFromListing,morphPending,morphToListing,settlePop} from './heroMorph';
import {flushSync} from 'react-dom';

import {homes,listingPrice} from './data';
import {languages,useLanguage,translateKnownNote} from './i18n';
import {CatalogFooter} from './CatalogFooter.jsx';
import {BrandMark} from './BrandMark.jsx';
import {alertKey,normalizeSearch,matchingHomes,prototypeResults,readJourney,journeyUrl} from './journey';
import {readSavedSearches,savedKey} from './savedSearches.js';
import {demoSearchHistory,normalizeSearchHistory,recordSearchHistory} from './searchHistory.js';
const paths={message:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',user:'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',settings:'M20 7h-9M14 17H5M20 17h-3M7 7H4M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',help:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',search:'m21 21-4.5-4.5 M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',close:'m6 6 12 12M6 18 18 6',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',check:'m5 12 4 4L19 6',sliders:'M4 7h16M4 17h16M8 4v6m8 4v6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',bookmark:'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',bed:'M3 18V6m18 12V9H3m0 5h18m0-5v11M3 18v2M6 9V5h6v4m0 0V5h6v4',bath:'M3 12h18M5 12V5a3 3 0 0 1 6 0M4 12v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3M7 19v2m10-2v2',size:'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',home:'m3 10 9-8 9 8v11H3V10Zm6 11v-8h6v8',reset:'M3 10a9 9 0 1 1 2 8M3 3v7h7',history:'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5',chevron:'m9 5 7 7-7 7',info:'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',office:'M4 4h16v12H4zM2 20h20M9 16v4m6-4v4',send:'m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2'};
export function Icon({name,size=20,...rest}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={paths[name]||paths.home}/></svg>}

const SESSION='inmuebles24-v2-session';
function stored(){try{return JSON.parse(sessionStorage.getItem(SESSION))||{}}catch{return {}}}
const initialRoute=()=>readJourney(window.location);
const KNOWN_HOMES=new Set(homes.map(home=>home.id));
const lookupHome=id=>homes.find(home=>home.id===id);
const homesFor=ids=>ids.map(lookupHome).filter(Boolean);
export function App(){
 const {language,setLanguage,t}=useLanguage();const pt=language==='pt-BR';const say=(es,br)=>pt?br:es;
 const [route,setRoute]=useState(initialRoute);const {page,search,pref,propertyId,sort='recommended',map:mapView}=route;
 const [profile,setProfile]=useState(()=>readContactProfile(stored().profile));
const [saved,setSaved]=useState(()=>normalizeSaved(stored().saved,KNOWN_HOMES));
 const [recent,setRecent]=useState(()=>normalizeRecent(stored().recent,KNOWN_HOMES));
 const [receipts,setReceipts]=useState([]);
 const [account,setAccount]=useState(()=>{const value=stored().account||{};return {signedIn:value.signedIn===true,name:typeof value.name==='string'&&value.name.trim()?value.name.trim().slice(0,24):'Alex'}}),[loginOpen,setLoginOpen]=useState(false);
 const [alerts,setAlerts]=useState(()=>readSavedSearches(stored().alerts));
 const [searchHistory,setSearchHistory]=useState(()=>normalizeSearchHistory(stored().searchHistory));
 const afterLogin=useRef(null),[loginReason,setLoginReason]=useState(null);
 const [hiddenListings,setHiddenListings]=useState([]);
 const [guideOn]=useState(()=>guideEnabled(window.location.search));
 const [toast,setToast]=useState(null),[accountToast,setAccountToast]=useState(null);
 const lastSearchChange=useRef({time:0,keys:''});
 const toastTimer=useRef(),routeRef=useRef(route);routeRef.current=route;
 const accountRef=useRef(account);accountRef.current=account;
 const selected=homes.find(h=>h.id===propertyId)||null;
 useLayoutEffect(()=>{const on=page==='listing'&&!!selected;document.documentElement.classList.toggle('is-listing-route',on);return()=>document.documentElement.classList.remove('is-listing-route')},[page,selected]);
 useLayoutEffect(()=>{const header=document.querySelector('.home-header');if(!header)return;const measure=()=>{if(header.classList.contains('is-header-hidden')){document.documentElement.style.setProperty('--flow-header-height','0px');return;}const bar=header.querySelector('.home-header-bar');document.documentElement.style.setProperty('--flow-header-height',`${(bar||header).offsetHeight}px`)};const observer=new ResizeObserver(measure);observer.observe(header);const classObserver=new MutationObserver(measure);classObserver.observe(header,{attributes:true,attributeFilter:['class']});measure();return()=>{observer.disconnect();classObserver.disconnect()}},[]);
 function armToast(duration=6500){clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>{setToast(null);setAccountToast(null)},duration)}
 function announce(text,undo){setAccountToast(null);setToast(undo?{text,undo}:{text});armToast()}
 function showAccountToast(text){setToast(null);setAccountToast({text});armToast(3000)}
 function navigate(next,{replace=false,scroll,layer=null}={}){
   history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);
   history[replace?'replaceState':'pushState']({scroll:scroll??window.scrollY,layer},'',journeyUrl(next));routeRef.current=next;setRoute(next);
   if(scroll!==undefined)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
 }
 useEffect(()=>{history.scrollRestoration='manual';const onPop=()=>{if(morphPending()){flushSync(()=>setRoute(initialRoute()));window.scrollTo({top:history.state?.scroll||0,behavior:'instant'});settlePop();return;}setRoute(initialRoute());requestAnimationFrame(()=>window.scrollTo({top:history.state?.scroll||0,behavior:'instant'}))};window.addEventListener('popstate',onPop);const saveScroll=()=>history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);window.addEventListener('pagehide',saveScroll);return()=>{window.removeEventListener('popstate',onPop);window.removeEventListener('pagehide',saveScroll);clearTimeout(toastTimer.current)}},[]);
 useEffect(()=>{try{sessionStorage.setItem(SESSION,JSON.stringify({profile,saved,recent,account,alerts,searchHistory}))}catch{/* Session can continue without browser storage. */}},[profile,saved,recent,account,alerts,searchHistory]);
 useEffect(()=>{if(propertyId)setRecent(current=>recordView(current,propertyId))},[propertyId]);
 useEffect(()=>{writeContactProfile(profile)},[profile]);
 useEffect(()=>{if(history.state?.scroll)requestAnimationFrame(()=>window.scrollTo(0,history.state.scroll))},[]);
 function updateSearch(next,label){const normalized=normalizeSearch(next);if(JSON.stringify(normalized)===JSON.stringify(search))return;const keys=Object.keys(normalized).filter(key=>JSON.stringify(normalized[key])!==JSON.stringify(search[key])).sort().join('|');const time=performance.now();const continuous=keys===lastSearchChange.current.keys&&time-lastSearchChange.current.time<600;const nextPage=page==='listing'||page==='favorites'||page==='saved'||page==='messages'||page==='history'?'results':page;navigate({...route,page:nextPage,propertyId:null,search:normalized},{replace:continuous});lastSearchChange.current={time,keys};if(label)announce(label)}
 function changePref(next){navigate({...route,pref:next});announce(say('Listo, reordené por lo que prefieres. Tus filtros siguen igual.','Pronto, reordenei pelo que você prefere. Seus filtros continuam iguais.'))}
 function begin(next){const normalized=normalizeSearch(next);if(account.signedIn)setSearchHistory(current=>recordSearchHistory(current,normalized));captureHomeTransition();navigate({page:'results',search:normalized,pref:'none',propertyId:null},{scroll:0})}
 function returnFromListing(){const id=routeRef.current.propertyId;if(history.state?.layer==='listing')morphFromListing(id,()=>history.back(),{viaHistory:true});else morphFromListing(id,()=>navigate({...route,page:'results',propertyId:null},{replace:true,scroll:0}));}
 function hideListing(home){if(!home)return;const hidden=hiddenListings.includes(home.id);setHiddenListings(current=>hidden?current.filter(id=>id!==home.id):[...current,home.id]);if(hidden){announce(say('Este inmueble volvió a la búsqueda','Este anúncio voltou à busca'));return;}setListingAsk(null);returnFromListing();const text=say('Ocultaste este inmueble','Você ocultou este anúncio'),undo=()=>setHiddenListings(current=>current.filter(id=>id!==home.id));const root=document.documentElement;let seen=false,settled=false;const finish=()=>{if(settled)return;settled=true;observer.disconnect();announce(text,undo);};const observer=new MutationObserver(()=>{if(root.dataset.heroMorph)seen=true;else if(seen)finish();});observer.observe(root,{attributes:true,attributeFilter:['data-hero-morph']});requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!seen)finish();}));setTimeout(finish,1200);}
 function hideToasts(){setToast(null);setAccountToast(null)}
 useEffect(()=>{const show=event=>{if(event.detail?.text)announce(event.detail.text)};window.addEventListener('listing-highlight',show);return()=>window.removeEventListener('listing-highlight',show)},[])
 function openFavorites(){hideToasts();navigate({...routeRef.current,page:'favorites',propertyId:null},{layer:'favorites',scroll:0})}
 function returnFromFavorites(){if(history.state?.layer==='favorites')history.back();else navigate({...route,page:'results',propertyId:null},{replace:true,scroll:0});}
 function openMessages(){hideToasts();navigate({...routeRef.current,page:'messages',propertyId:null},{layer:'messages',scroll:0})}
 function returnFromMessages(){if(history.state?.layer==='messages')history.back();else navigate({...route,page:'results',propertyId:null},{replace:true,scroll:0});}
 function openHistory(){hideToasts();navigate({...routeRef.current,page:'history',propertyId:null},{layer:'history',scroll:0})}
 function returnFromHistory(){if(history.state?.layer==='history')history.back();else navigate({...route,page:'results',propertyId:null},{replace:true,scroll:0});}
 function openSavedSearches(){hideToasts();navigate({...routeRef.current,page:'saved',propertyId:null},{layer:'saved',scroll:0})}
 function returnFromSaved(){if(history.state?.layer==='saved')history.back();else navigate({...route,page:'results',propertyId:null},{replace:true,scroll:0});}
 /** Every card opens the full listing page; the card's photo grows into the cover. */
 function open(home,event){
  morphToListing(event?.currentTarget?.querySelector?.('.discovery-media')||cardPhoto(home.id),()=>navigate({...routeRef.current,page:'listing',propertyId:home.id},{layer:'listing',scroll:0}))
 }
 /** The map is a full-screen page over the results: it takes a history entry, so Back returns to the list. */
 function openMap(){hideToasts();navigate({...routeRef.current,map:'full'},{layer:'map',scroll:0})}
 function closeMap(){if(history.state?.layer==='map'){history.back()}else{const {map,...rest}=routeRef.current;navigate(rest,{replace:true})}}
 function openFromMap(home){navigate({...routeRef.current,page:'listing',propertyId:home.id},{layer:'listing',scroll:0})}
 function openLogin(reason=null){hideToasts();setLoginReason(typeof reason==='string'?reason:null);setLoginOpen(true)}
 function headerAction(action){announce(action==='agencies'?say('Abre un inmueble para conocer a su anunciante y simular un contacto.','Abra um imóvel para conhecer seu anunciante e simular um contato.'):say('Este prototipo demuestra la búsqueda de inmuebles. La publicación no forma parte de este recorrido.','Este protótipo demonstra a busca de imóveis. A publicação não faz parte deste percurso.'));}
 /** A heart toggles a flat favorite: no folders, sharing or comparison. */
 function saveHome(home){const adding=!saved.includes(home.id);setSaved(current=>toggleSaved(current,home.id).ids);announce(adding?say('Guardado en favoritos','Salvo nos favoritos'):say('Quitado de favoritos','Removido dos favoritos'),adding?undefined:()=>setSaved(current=>current.includes(home.id)?current:toggleSaved(current,home.id).ids))}
 /** Saving a listing needs the simulated login; the pending save finishes right after signing in. */
 function requestSave(home){withAccount(()=>saveHome(home),'favorite')}
 /** A stable id and a display name only; a second account in this browser gets another fictitious name. */
 function startSession(){const next={signedIn:true,name:accountRef.current.name||'Alex'};accountRef.current=next;setAccount(next);return next}
 function signIn(){setLoginOpen(false);const who=startSession();setSearchHistory(current=>current.length?current:demoSearchHistory(routeRef.current.search?.mode==='rent'?'rent':'buy'));const next=afterLogin.current;afterLogin.current=null;if(next){next(who);return;}showAccountToast(say('Sesión iniciada · tus favoritos quedan guardados','Login feito · seus favoritos ficam salvos'))}
 function closeLogin(){afterLogin.current=null;setLoginOpen(false)}
 /** Alert and folder sharing ask for the simulated login first, then finish what was asked. */
 function withAccount(run,reason){if(account.signedIn){run(account);return;}afterLogin.current=run;openLogin(reason)}
 const searchAlertKey=alertKey(search),alertOn=alerts.some(item=>savedKey(item)===searchAlertKey);
 function toggleAlert(){
   if(alertOn){setAlerts(current=>current.filter(item=>savedKey(item)!==searchAlertKey));showAccountToast(say('Búsqueda eliminada','Busca removida'));return;}
   withAccount(()=>{setAlerts(current=>[{key:searchAlertKey,savedAt:Date.now(),search:normalizeSearch(search)},...current.filter(item=>savedKey(item)!==searchAlertKey)].slice(0,20));showAccountToast(say('Búsqueda guardada','Busca salva'))},'search');
 }
 function changeSort(next){navigate({...routeRef.current,sort:next},{replace:true})}

 /** The guide's stops: each one lands on a page of this version and the guide outlines what it points to. */
 function guideResults(extra={}){
   const current=routeRef.current;
   const there=current.page==='results'&&!current.propertyId&&current.map!=='full';
   const next={...current,page:'results',propertyId:null,...extra};
   if(!extra.map)delete next.map;
   if(there&&JSON.stringify(next)===JSON.stringify(current))return false;
   navigate(next,there?{replace:true}:{scroll:0});
   return !there;
 }
 function guideListing(){
   const current=routeRef.current;
   const home=matchingHomes(current.search).find(item=>!item.development)||homes.find(item=>!item.development);
   if(!home)return false;
   if(current.page==='listing'&&current.propertyId===home.id)return false;
   const {map,...rest}=current;
   navigate({...rest,page:'listing',propertyId:home.id},{layer:'listing',scroll:0});
   return true;
 }
 /** Waits for the destination to paint, then runs `step` once. */
 function guideAfter(find,step,wait=3000){
   const started=performance.now();
   const tick=()=>{const node=find();if(node){step(node);return;}if(performance.now()-started<wait)requestAnimationFrame(tick);};
   setTimeout(()=>requestAnimationFrame(tick),500);
 }
 function guideAction(action){
   const current=routeRef.current;
   setLoginOpen(false);
   switch(action){
     case 'home':navigate({...current,page:'home',propertyId:null},{scroll:0});return;
     case 'results':guideResults();return;
     case 'all-filters':guideResults();guideAfter(()=>document.querySelector('.mora-more'),button=>button.click());return;
     case 'sort-price':guideResults({sort:'price'});return;
     case 'mora-price':guideListing();return;
     case 'map-float':guideResults();return;
     case 'map-full':if(current.page==='results'&&current.map==='full')return;navigate({...current,page:'results',propertyId:null,map:'full'},{layer:'map',scroll:0});return;
     case 'development':navigate({...current,page:'results',propertyId:null,search:normalizeSearch({...current.search,mode:'development'})},{scroll:0});return;
     case 'listing':guideListing();return;
     case 'seo-home':navigate({...current,page:'home',propertyId:null},{scroll:0});return;
     case 'seo-results':guideResults();return;
     case 'seo-listing':guideListing();return;
     case 'contact':guideListing();guideAfter(()=>[...document.querySelectorAll('.pp-intro-offer button, .pp-contact button, button')].find(button=>/Hablar con inmobiliaria|Falar com a imobiliária/i.test(button.textContent)),button=>button.click(),4500);return;
     case 'sign-in':if(account.signedIn)showAccountToast(say('Ya tienes sesión iniciada','Você já está com login feito'));else openLogin();return;
     case 'favorite':guideResults();guideAfter(()=>document.querySelector('.flow-listings .discovery-like'),button=>button.click());return;
     case 'save-search':guideResults();guideAfter(()=>document.querySelector('.mora-save'),button=>button.click());return;
     case 'mora-search':guideResults();return;
     case 'mora-listing':guideListing();return;
     default:
   }
 }

 function accountAction(action){
   if(action==='favorites'){openFavorites();return;}
   if(action==='saved'){openSavedSearches();return;}
   if(action==='messages'){openMessages();return;}
   if(action==='history'){openHistory();return;}
   if(action==='logout'){setAccount(current=>({...current,signedIn:false}));return;}
   showAccountToast(say('Disponible fuera de este prototipo','Disponível fora deste protótipo'));
 }
 function changeLanguage(next){const updated={...route,search:{...search,note:translateKnownNote(search.note,next)}};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated);setLanguage(next)}
 const exactIds=new Set(matchingHomes(search).map(home=>home.id));
 const visible=prototypeResults(search).filter(home=>!hiddenListings.includes(home.id)).sort((a,b)=>Number(exactIds.has(b.id))-Number(exactIds.has(a.id))||((pref==='extra'||pref==='separate')?Number(b.beds>=3)-Number(a.beds>=3):0)||(exactIds.has(a.id)?listingPrice(a)-listingPrice(b):0));
 const addReceipt=receipt=>setReceipts(current=>[receipt,...current.filter(r=>r.id!==receipt.id)]);

const showResults=page!=='home'&&page!=='listing'&&page!=='favorites'&&page!=='saved'&&page!=='messages'&&page!=='history';
 return <div className="app-shell"><HomeHeader results={page!=='home'} signedIn={account.signedIn} onAction={headerAction} onLogin={openLogin} onAccount={accountAction} onHome={()=>navigate({...routeRef.current,page:'home',propertyId:null},{scroll:0})}/>
 <main>{page==='home'?<div><Home search={search} setSearch={next=>{const updated={...route,search:typeof next==='function'?next(search):next};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated)}} onSearch={begin} saved={saved} receipts={receipts} onOpen={open} onLike={requestSave} signedIn={account.signedIn} searchHistory={searchHistory} recent={recent} onLogin={openLogin}/></div>:page==='listing'&&selected?<div className="search-flow-page home-evolution listing-route"><div><PropertyDetail key={selected.id} home={selected} search={search} pref={pref} sort={sort} saved={saved} receipts={receipts} onLike={requestSave} hidden={hiddenListings.includes(selected.id)} onHide={hideListing} onOpenListing={open} onMore={()=>navigate({...routeRef.current,page:'results',propertyId:null},{scroll:0})} onSearch={next=>navigate({...routeRef.current,page:'results',search:next,propertyId:null},{scroll:0})} receipt={receipts.find(r=>r.propertyId===selected.id)} onClose={returnFromListing} profile={profile} onProfile={setProfile} onReceipt={addReceipt} onMessages={account.signedIn?openMessages:undefined}/></div></div>
 :page==='history'?<HistoryPage recent={recent} homeFor={lookupHome} saved={saved} receipts={receipts} search={search} onLike={requestSave} onOpen={open} onBack={returnFromHistory}/>:page==='messages'?<MessagesPage receipts={receipts} homeFor={lookupHome} saved={saved} onLike={requestSave} onOpen={open} onBack={returnFromMessages}/>:page==='saved'?<SavedSearches entries={alerts} onOpen={next=>navigate({...route,page:'results',search:next,propertyId:null},{scroll:0})} onRemove={key=>setAlerts(current=>current.filter(item=>savedKey(item)!==key))} onBack={returnFromSaved}/>:page==='favorites'?<FavoritesPage homes={homesFor(saved)} search={search} receipts={receipts} onLike={requestSave} onOpen={open} onBack={returnFromFavorites}/>:showResults?<div className="results-layout"><div className="results-main"><ResultsFlowPage search={search} onChange={updateSearch} visible={visible} saved={saved} onSave={requestSave} onOpen={open} sort={sort} onSort={changeSort} alert={{on:alertOn,onToggle:toggleAlert}} receipts={receipts} onOpenMap={openMap} mapOpen={mapView==='full'} onCloseMap={closeMap} onOpenFromMap={openFromMap} assistantProps={{search,pref,onPref:changePref,onChange:updateSearch}}/></div></div>:null}</main>
 {(page==='home'||page==='listing'||showResults)?<CatalogFooter/>:<footer className="site-footer"><BrandMark/><p>{say('Prototipo V2 · Contacto simulado','Protótipo V2 · Contato simulado')}</p><div className="footer-controls"><select className="footer-language" aria-label={t('Idioma')} value={language} onChange={e=>changeLanguage(e.target.value)}>{languages.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></div></footer>}
 {toast&&<div className="toast" role="status"><span>{toast.text}</span>{toast.undo&&<button type="button" className="toast-action" onClick={()=>{toast.undo();setToast(null)}}>{say('Deshacer','Desfazer')}</button>}<button className="icon-button" onClick={()=>setToast(null)} aria-label={t('Cerrar aviso')}><Icon name="close" size={16}/></button></div>}
 <AnimatePresence>{accountToast&&<AccountToast key="account-toast" text={accountToast.text} onHold={()=>clearTimeout(toastTimer.current)} onRelease={()=>armToast(3000)}/>}</AnimatePresence>
 <AnimatePresence>{loginOpen&&<LoginDialog key="login" reason={loginReason} onSignIn={signIn} onClose={closeLogin}/>}</AnimatePresence>
 {guideOn&&<ProjectGuide onAction={guideAction}/>}
 <VersionSwitcher aboveGuide={guideOn}/>
 </div>;
}
