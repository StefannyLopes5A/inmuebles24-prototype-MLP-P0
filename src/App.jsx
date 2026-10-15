import React,{lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AnimatePresence} from 'motion/react';
import {PropertyDetail} from './PropertyDetail';
import {CompareFavorites} from './CompareFavorites';
import {FavoritesIndex,FolderPicker,FolderToast} from './FavoriteFolders';
import {AccountToast,LoginDialog} from './Account';
import {RECENT_ID,pickId,pickIds,createFolder,folderOf,normalizeFolders,normalizeRecent,recordView,removeHome,restoreHome,saveToFolder,savedCountLabel,savedIds,suggestedFolderName,uniqueFolderName} from './favoriteLists';
import {ListingPanel} from './ListingPanel';
import {readContactProfile,writeContactProfile} from './contactProfile.js';

import {Home,HomeHeader} from './Home';
import {ResultsFlowPage} from './ResultsFlowPage';
import {captureHomeTransition} from './searchFlowMotion';
import {cardPhoto,morphFromListing,morphPending,morphToListing,settlePop} from './heroMorph';
import {flushSync} from 'react-dom';

import {homes,listingPrice} from './data';
import {UNIT_HOMES, unitHomeById} from './development/torreOlmo.js';
import {RecorridoShell} from './development/RecorridoShell.jsx';
import {languages,useLanguage,translateKnownNote} from './i18n';
import {normalizeSearch,matchingHomes,prototypeResults,readJourney,journeyUrl} from './journey';
const RecorridoPage = lazy(() => import('./development/RecorridoPage.jsx'));
const paths={message:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',user:'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',settings:'M20 7h-9M14 17H5M20 17h-3M7 7H4M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',help:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',search:'m21 21-4.5-4.5 M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',close:'m6 6 12 12M6 18 18 6',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',check:'m5 12 4 4L19 6',sliders:'M4 7h16M4 17h16M8 4v6m8 4v6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',bed:'M3 18V6m18 12V9H3m0 5h18m0-5v11M3 18v2M6 9V5h6v4m0 0V5h6v4',bath:'M3 12h18M5 12V5a3 3 0 0 1 6 0M4 12v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3M7 19v2m10-2v2',size:'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',home:'m3 10 9-8 9 8v11H3V10Zm6 11v-8h6v8',reset:'M3 10a9 9 0 1 1 2 8M3 3v7h7',chevron:'m9 5 7 7-7 7',info:'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',office:'M4 4h16v12H4zM2 20h20M9 16v4m6-4v4',send:'m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2'};
export function Icon({name,size=20,...rest}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={paths[name]||paths.home}/></svg>}

const SESSION='inmuebles24-v2-session';
function stored(){try{return JSON.parse(sessionStorage.getItem(SESSION))||{}}catch{return {}}}
const initialRoute=()=>readJourney(window.location);
const KNOWN_HOMES=new Set([...homes.map(home=>home.id), ...UNIT_HOMES.map(home=>home.id)]);
const lookupHome=id=>homes.find(home=>home.id===id)||unitHomeById(id);
const homesFor=ids=>ids.map(lookupHome).filter(Boolean);
const listingOf=home=>home?.unitOf?homes.find(item=>item.id===home.unitOf):home;
export function App(){
 const {language,setLanguage,t}=useLanguage();const pt=language==='pt-BR';const say=(es,br)=>pt?br:es;
 const [route,setRoute]=useState(initialRoute);const {page,search,pref,propertyId,listId,map:mapMode='mini'}=route;
 const [homeChoices,setHomeChoices]=useState({}),[homeIntroDone,setHomeIntroDone]=useState(false);
 const [profile,setProfile]=useState(()=>readContactProfile(stored().profile));
 const [folders,setFolders]=useState(()=>{const session=stored();return normalizeFolders(session.folders,session.saved,KNOWN_HOMES)});
 const [recent,setRecent]=useState(()=>normalizeRecent(stored().recent,KNOWN_HOMES));
 const [receipts,setReceipts]=useState([]);
 const [compareView,setCompareView]=useState(()=>{const value=stored().compare;return {hidden:value?.hidden&&typeof value.hidden==='object'?value.hidden:{},seen:Array.isArray(value?.seen)?value.seen:[]}});
 const [account,setAccount]=useState(()=>({signedIn:stored().account?.signedIn===true})),[loginOpen,setLoginOpen]=useState(false);
 const [askPrompt,setAskPrompt]=useState(null);
 const [recorridoUnitId,setRecorridoUnitId]=useState(null);
 const saved=savedIds(folders);
 const [toast,setToast]=useState(null),[folderToast,setFolderToast]=useState(null),[picker,setPicker]=useState(null);
 const lastSearchChange=useRef({time:0,keys:''});
 const toastTimer=useRef(),loginAfterPicker=useRef(false),panelOrigin=useRef(null),routeRef=useRef(route);routeRef.current=route;
 const selected=homes.find(h=>h.id===propertyId)||null;
 const isRecorrido=page==='listing'&&!!selected?.development;
 const picked=page==='compare'?pickIds(listId)?.filter(id=>KNOWN_HOMES.has(id)):null;
 const activeFolder=page!=='compare'?null:picked?(picked.length>1?{id:listId,name:say('Este inmueble y tus favoritos','Este imóvel e seus favoritos'),homeIds:picked,pick:true}:null):listId===RECENT_ID?(recent.length?{id:RECENT_ID,name:say('Vistos recientemente','Vistos recentemente'),homeIds:recent.map(entry=>entry.id)}:null):folders.find(folder=>folder.id===listId)||null;
 const folderHomes=activeFolder?homesFor(activeFolder.homeIds):[];
 useLayoutEffect(()=>{document.documentElement.classList.toggle('is-recorrido-route',isRecorrido);if(isRecorrido)document.documentElement.style.setProperty('--flow-header-height','0px');return()=>document.documentElement.classList.remove('is-recorrido-route')},[isRecorrido]);
 useLayoutEffect(()=>{const header=document.querySelector('.home-header');if(!header)return;const measure=()=>{if(header.classList.contains('is-header-hidden')||document.documentElement.classList.contains('is-recorrido-route')){document.documentElement.style.setProperty('--flow-header-height','0px');return;}const bar=header.querySelector('.home-header-bar');document.documentElement.style.setProperty('--flow-header-height',`${(bar||header).offsetHeight}px`)};const observer=new ResizeObserver(measure);observer.observe(header);const classObserver=new MutationObserver(measure);classObserver.observe(header,{attributes:true,attributeFilter:['class']});measure();return()=>{observer.disconnect();classObserver.disconnect()}},[]);
 function armToast(duration=6500){clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>{setToast(null);setFolderToast(null)},duration)}
 function announce(text){setFolderToast(null);setToast({text});armToast()}
 function showFolderToast(homeId,folderId,removed=false,folder=null){setToast(null);setFolderToast({homeId,folderId,removed,folder});armToast(3000)}
 function showAccountToast(text){setToast(null);setFolderToast({account:true,text});armToast(3000)}
 function navigate(next,{replace=false,scroll,layer=null}={}){
   history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);
   history[replace?'replaceState':'pushState']({scroll:scroll??window.scrollY,layer},'',journeyUrl(next));routeRef.current=next;setRoute(next);
   if(scroll!==undefined)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
 }
 useEffect(()=>{history.scrollRestoration='manual';const onPop=()=>{if(morphPending()){flushSync(()=>setRoute(initialRoute()));window.scrollTo({top:history.state?.scroll||0,behavior:'instant'});settlePop();return;}setRoute(initialRoute());requestAnimationFrame(()=>window.scrollTo({top:history.state?.scroll||0,behavior:'instant'}))};window.addEventListener('popstate',onPop);const saveScroll=()=>history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);window.addEventListener('pagehide',saveScroll);return()=>{window.removeEventListener('popstate',onPop);window.removeEventListener('pagehide',saveScroll);clearTimeout(toastTimer.current)}},[]);
 useEffect(()=>{try{sessionStorage.setItem(SESSION,JSON.stringify({profile,folders,recent,saved:savedIds(folders),account,compare:compareView}))}catch{/* Session can continue without browser storage. */}},[profile,folders,recent,account,compareView]);
 useEffect(()=>{if(propertyId)setRecent(current=>recordView(current,propertyId))},[propertyId]);
 useEffect(()=>{writeContactProfile(profile)},[profile]);
 useEffect(()=>{if(history.state?.scroll)requestAnimationFrame(()=>window.scrollTo(0,history.state.scroll))},[]);
 function updateSearch(next,label){const normalized=normalizeSearch(next);if(JSON.stringify(normalized)===JSON.stringify(search))return;const keys=Object.keys(normalized).filter(key=>JSON.stringify(normalized[key])!==JSON.stringify(search[key])).sort().join('|');const time=performance.now();const continuous=keys===lastSearchChange.current.keys&&time-lastSearchChange.current.time<600;const nextPage=page==='listing'||page==='compare'||page==='favorites'?'results':page;navigate({...route,page:nextPage,propertyId:null,search:normalized},{replace:continuous});lastSearchChange.current={time,keys};if(label)announce(label)}
 function changePref(next){navigate({...route,pref:next});announce(say('Preferencia actualizada. Los límites no cambiaron.','Preferência atualizada. Os limites não mudaram.'))}
 function begin(next){captureHomeTransition();navigate({page:'results',search:normalizeSearch(next),pref:'none',propertyId:null},{scroll:0})}
 function open(home,event){
  const listing=listingOf(home)||home;
  setRecorridoUnitId(home.unitId||null);
  if(home.unitOf){morphToListing(event?.currentTarget?.querySelector?.('.discovery-media')||cardPhoto(listing.id),()=>navigate({...routeRef.current,page:'listing',propertyId:listing.id},{layer:'listing',scroll:0}));return;}
  if(routeRef.current.propertyId&&routeRef.current.page!=='listing'){navigateListing(listing.id);return;}
  panelOrigin.current=event?.currentTarget?.closest?.('.discovery-item')||null;navigate({...routeRef.current,propertyId:listing.id},{layer:'detail'})
 }
 function navigateListing(id){const home=lookupHome(id);const listing=listingOf(home)||home;if(home?.unitId)setRecorridoUnitId(home.unitId);navigate({...routeRef.current,propertyId:listing.id},{replace:true,layer:'detail'})}
 function closeDetail(){if(history.state?.layer==='detail'){history.back()}else{navigate({...route,propertyId:null},{replace:true})}}
 function openDetails(){if(page==='listing'){window.scrollTo({top:0,behavior:'instant'});return;}
 // The full listing takes the panel's history entry, so going back lands on the results without reopening the panel.
 morphToListing(document.querySelector('.lp-shell .lp-media'),()=>navigate({...route,page:'listing'},{replace:true,layer:history.state?.layer==='detail'?'listing':null,scroll:0}));}
 function returnFromListing(){const id=routeRef.current.propertyId;if(history.state?.layer==='listing')morphFromListing(id,()=>history.back(),{viaHistory:true});else morphFromListing(id,()=>navigate({...route,page:'results',propertyId:null},{replace:true,scroll:0}));}
 function hideToasts(){setToast(null);setFolderToast(null)}
 function openFavorites(){hideToasts();navigate({...routeRef.current,page:'favorites',propertyId:null,listId:null},{layer:'favorites',scroll:0})}
 function returnFromFavorites(){if(history.state?.layer==='favorites')history.back();else navigate({...route,page:'results',propertyId:null,listId:null},{replace:true,scroll:0});}
 function openFolder(id,fromIndex=false){hideToasts();navigate({...routeRef.current,page:'compare',propertyId:null,listId:id},{layer:fromIndex?'folder':'compare',scroll:0})}
 function compareWith(ids){hideToasts();navigate({...routeRef.current,page:'compare',propertyId:null,listId:pickId(ids)},{layer:'pick',scroll:0})}
 function returnFromCompare(){if(history.state?.layer==='folder'||history.state?.layer==='pick')history.back();else navigate({...route,page:'favorites',propertyId:null,listId:null},{replace:true,scroll:0,layer:history.state?.layer==='compare'?'favorites':null});}
 function changeMapMode(next){
   const current=routeRef.current.map||'mini';
   if(next===current)return;
   if(current==='full'&&history.state?.layer==='map'){history.back();return;}
   navigate({...routeRef.current,map:next},next==='full'?{layer:'map'}:{replace:true});
 }
 function openListingFromMap(home){morphToListing(cardPhoto(home.id),()=>navigate({...routeRef.current,page:'listing',propertyId:home.id},{layer:'listing',scroll:0}))}
 function openListingFromCompare(home,event){
  const listing=listingOf(home)||home;
  if(home.unitId)setRecorridoUnitId(home.unitId);
  morphToListing(event?.currentTarget?.querySelector?.('.discovery-media')||cardPhoto(listing.id),()=>navigate({...routeRef.current,page:'listing',propertyId:listing.id},{layer:'listing',scroll:0}))
 }
 function hideFromCompare(folderId,homeId){setCompareView(current=>({...current,hidden:{...current.hidden,[folderId]:[...new Set([...(current.hidden[folderId]||[]),homeId])]}}))}
 function showAllInCompare(folderId){setCompareView(current=>{const hidden={...current.hidden};delete hidden[folderId];return {...current,hidden}})}
 function markCompareSeen(folderId){setCompareView(current=>current.seen.includes(folderId)?current:{...current,seen:[...current.seen,folderId]})}
 function openLogin(){hideToasts();setLoginOpen(true)}
 function headerAction(action){announce(action==='agencies'?say('Abre un inmueble para conocer a su anunciante y simular un contacto.','Abra um imóvel para conhecer seu anunciante e simular um contato.'):say('Este prototipo demuestra la búsqueda de inmuebles. La publicación no forma parte de este recorrido.','Este protótipo demonstra a busca de imóveis. A publicação não faz parte deste percurso.'));}
 function requestSave(home){
   const current=folderOf(folders,home.id);
   if(current){setFolders(removeHome(folders,home.id));showFolderToast(home.id,current.id,true,current);return;}
   setFolderToast(null);setPicker({home});
 }
 function selectFolder(folderId){
   const home=picker?.home;if(!home||picker.nudge)return;
   const result=saveToFolder(folders,folderId,home.id);
   settleSave(home,result.folders,folderId,result.removed,result.folder);
 }
 function createList(name){
   const home=picker?.home;if(!home||picker.nudge)return;
   const {folders:next,folder}=createFolder(folders,name,home.id);
   if(!folder)return;
   settleSave(home,next,folder.id,false,folder);
 }
 function settleSave(home,next,folderId,removed,folder){
   setFolders(next);
   const ids=savedIds(next);
   if(!removed&&!account.signedIn&&ids.length===3){
     setPicker({home,nudge:{folderId,homes:homesFor([home.id,...ids.filter(id=>id!==home.id)].slice(0,3))}});
     return;
   }
   setPicker(null);showFolderToast(home.id,folderId,removed,folder);
 }
 function dismissNudge(){const current=picker;setPicker(null);if(current?.nudge)showFolderToast(current.home.id,current.nudge.folderId)}
 function loginFromNudge(){loginAfterPicker.current=true;setPicker(null)}
 function signIn(){setLoginOpen(false);setAccount({signedIn:true});showAccountToast(say('Sesión iniciada · tus favoritos quedan guardados','Login feito · seus favoritos ficam salvos'))}
 function accountAction(action){
   if(action==='favorites'){openFavorites();return;}
   if(action==='logout'){setAccount({signedIn:false});return;}
   showAccountToast(say('Disponible fuera de este prototipo','Disponível fora deste protótipo'));
 }
 const toastFolder=folderToast&&(folders.find(folder=>folder.id===folderToast.folderId)||(folderToast.removed?folderToast.folder:null));
 const toastHome=folderToast&&lookupHome(folderToast.homeId);
 function changeLanguage(next){const updated={...route,search:{...search,note:translateKnownNote(search.note,next)}};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated);setLanguage(next)}
 const exactIds=new Set(matchingHomes(search).map(home=>home.id));
 const visible=prototypeResults(search).sort((a,b)=>Number(exactIds.has(b.id))-Number(exactIds.has(a.id))||((pref==='extra'||pref==='separate')?Number(b.beds>=3)-Number(a.beds>=3):0)||(exactIds.has(a.id)?listingPrice(a)-listingPrice(b):0));
 const addReceipt=receipt=>setReceipts(current=>[receipt,...current.filter(r=>r.id!==receipt.id)]);

 const showResults=page!=='home'&&page!=='listing'&&page!=='compare'&&page!=='favorites';
 const panelHome=page==='home'||showResults?selected:null;
 const favoritesPage=page==='favorites'||(page==='compare'&&!activeFolder);
 const folderMeta=activeFolder?.pick?say(`${folderHomes.length} inmuebles lado a lado`,`${folderHomes.length} imóveis lado a lado`):activeFolder?.id===RECENT_ID?say(`${folderHomes.length} vistos en esta sesión`,`${folderHomes.length} vistos nesta sessão`):savedCountLabel(folderHomes.length,language);
 return <><HomeHeader results={page!=='home'} signedIn={account.signedIn} onAction={headerAction} onLogin={openLogin} onAccount={accountAction} onHome={()=>navigate({...routeRef.current,page:'home',propertyId:null},{scroll:0})}/>
 <main>{page==='home'?<div><Home choices={homeChoices} onChoose={key=>setHomeChoices(current=>key==='template'?{...current,mode:true,propertyType:true}:{...current,[key]:true})} skipIntro={homeIntroDone} onIntroDone={()=>setHomeIntroDone(true)} search={search} setSearch={next=>{const updated={...route,search:typeof next==='function'?next(search):next};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated)}} onSearch={begin} saved={saved} receipts={receipts} onOpen={open} onLike={requestSave}/></div>:page==='listing'&&selected?selected.development?<Suspense fallback={<RecorridoShell home={selected}/>}><RecorridoPage key={selected.id} home={selected} savedIds={saved} initialUnitId={recorridoUnitId} onLike={requestSave} onClose={returnFromListing} onHome={()=>navigate({...routeRef.current,page:'home',propertyId:null},{scroll:0})}/></Suspense>:<div className="search-flow-page home-evolution listing-route"><div><PropertyDetail key={selected.id} home={selected} search={search} pref={pref} favorites={homesFor(saved)} saved={saved} receipts={receipts} onLike={requestSave} onOpenListing={openListingFromCompare} onMore={()=>navigate({...routeRef.current,page:'results',propertyId:null},{scroll:0})} onFavorite={navigateListing} onCompare={compareWith} receipt={receipts.find(r=>r.propertyId===selected.id)} onClose={returnFromListing} profile={profile} onProfile={setProfile} onReceipt={addReceipt}/></div></div>:favoritesPage?<FavoritesIndex folders={folders} recent={recent} onOpenFolder={id=>openFolder(id,true)} onBack={returnFromFavorites}/>:page==='compare'?<div className="compare-route"><CompareFavorites key={activeFolder.id} folderName={activeFolder.name} meta={folderMeta} homes={folderHomes} hiddenIds={(compareView.hidden[activeFolder.id]||[]).filter(id=>folderHomes.some(home=>home.id===id))} onHide={id=>hideFromCompare(activeFolder.id,id)} onShowAll={()=>showAllInCompare(activeFolder.id)} receipts={receipts} profile={profile} onProfile={setProfile} onReceipts={list=>setReceipts(current=>[...list,...current])} intro={!compareView.seen.includes(activeFolder.id)&&!folderHomes.some(home=>receipts.some(receipt=>receipt.propertyId===home.id))} onIntroSeen={()=>markCompareSeen(activeFolder.id)} onClose={returnFromCompare} onOpen={openListingFromCompare} backLabel={activeFolder.pick?say('Volver al inmueble','Voltar ao imóvel'):undefined}/></div>:showResults?<div className="results-layout"><div className="results-main"><ResultsFlowPage blocked={!!propertyId} search={search} onChange={updateSearch} visible={visible} saved={saved} onSave={requestSave} onOpen={open} onFavorites={saved.length||recent.length?openFavorites:null} receipts={receipts} assistantProps={{search,pref,onPref:changePref,onChange:updateSearch}} mapProps={{mode:mapMode,onMode:changeMapMode,onOpenListing:openListingFromMap,recent:recent.map(entry=>entry.id),hidden:false,signedIn:account.signedIn,onLogin:openLogin,onAskMora:text=>setAskPrompt({text,id:Date.now()})}}/></div></div>:null}</main>
 <AnimatePresence>{panelHome&&<ListingPanel key="listing-panel" home={panelHome} origin={panelOrigin.current} search={search} pref={pref} hasSearch={page!=='home'} favorites={homesFor(saved)} profile={profile} onProfile={setProfile} onReceipt={addReceipt} onClose={closeDetail} onNavigate={navigateListing} onDetails={openDetails}/>}</AnimatePresence>
 {page!=='compare'&&page!=='favorites'&&!isRecorrido&&<footer className="site-footer"><span>inmuebles24</span><p>{say('Prototipo V2 · Contacto simulado','Protótipo V2 · Contato simulado')}</p><div className="footer-controls"><select className="footer-language" aria-label={t('Idioma')} value={language} onChange={e=>changeLanguage(e.target.value)}>{languages.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></div></footer>}

 {toast&&<div className="toast" role="status"><span>{toast.text}</span><button className="icon-button" onClick={()=>setToast(null)} aria-label={t('Cerrar aviso')}><Icon name="close" size={16}/></button></div>}
 <AnimatePresence>{folderToast?.account?<AccountToast key="folder-toast" text={folderToast.text} onHold={()=>clearTimeout(toastTimer.current)} onRelease={()=>armToast(3000)}/>:toastFolder&&toastHome&&<FolderToast key="folder-toast" home={toastHome} folder={toastFolder} removed={folderToast.removed} onUndo={()=>{setFolders(current=>restoreHome(current,toastFolder,toastHome.id));showFolderToast(toastHome.id,toastFolder.id)}} onChange={()=>{setFolderToast(null);setPicker({home:toastHome})}} onView={()=>openFolder(toastFolder.id)} onHold={()=>clearTimeout(toastTimer.current)} onRelease={()=>armToast(3000)}/>}</AnimatePresence>
 <AnimatePresence onExitComplete={()=>{if(loginAfterPicker.current){loginAfterPicker.current=false;setLoginOpen(true)}}}>{picker&&<FolderPicker key="folder-picker" home={picker.home} folders={folders} suggestion={uniqueFolderName(suggestedFolderName(search),folders)} nudge={picker.nudge} onSelect={selectFolder} onCreate={createList} onClose={()=>setPicker(null)} onLogin={loginFromNudge} onDismissNudge={dismissNudge}/>}</AnimatePresence>
 <AnimatePresence>{loginOpen&&<LoginDialog key="login" onSignIn={signIn} onClose={()=>setLoginOpen(false)}/>}</AnimatePresence>
 </>;
}
