import React,{lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {AnimatePresence} from 'motion/react';
import {PropertyDetail} from './PropertyDetail';
import {CompareFavorites} from './CompareFavorites';
import {FavoritesIndex,FolderPicker,FolderToast} from './FavoriteFolders';
import {SavedSearches} from './SavedSearches.jsx';
import {AccountToast,LoginDialog} from './Account';
import {InviteDialog,ShareSheet} from './ShareSheet';
import {FolderPage} from './FolderPage';
import {FolderViewSwap} from './FolderViewSwap';
import {ConfirmDialog,InviteBanner,InviteUnavailable,JoinDialog} from './InviteLayer';
import {RECENT_ID,pickId,pickIds,createFolder,folderOf,mergeSharedHomes,normalizeFolders,normalizeRecent,recordView,removeHome,restoreHome,saveToFolder,savedCountLabel,savedIds,suggestedFolderName,uniqueFolderName} from './favoriteLists';
import {readBoard, withGuest, withLabels, withStage, withoutGuest} from './boardModel.js';
import {SHARED_KEY,accountName,activeMembers,deleteShared,findByToken,isAccountId,isCollaborative,isGuestId,joinFolder,leaveFolder,memberOf,migrateReactions,newAccountId,newEvent,newGuestId,react,readSharedFolders,removeMember,revokeInvite,setNote,shareFolder,syncShared} from './collaborativeLists';
import {reactionLabel} from './Collaboration';
import {ListingPanel} from './ListingPanel';
import {SelectionMora} from './SelectionMora';
import {ProjectGuide} from './ProjectGuide';
import {GUIDE_COMPARE_SIZE,GUIDE_FOLDER_NAME,comparableFolder,guideEnabled} from './guideStops.js';
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
import {CatalogFooter} from './CatalogFooter.jsx';
import {BrandMark} from './BrandMark.jsx';
import {alertKey,normalizeSearch,matchingHomes,prototypeResults,readJourney,journeyUrl} from './journey';
import {readSavedSearches,savedKey} from './savedSearches.js';
import {demoSearchHistory,normalizeSearchHistory,recordSearchHistory} from './searchHistory.js';
const RecorridoPage = lazy(() => import('./development/RecorridoPage.jsx'));
const paths={message:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',user:'M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',bell:'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',settings:'M20 7h-9M14 17H5M20 17h-3M7 7H4M17 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',help:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',search:'m21 21-4.5-4.5 M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',close:'m6 6 12 12M6 18 18 6',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',check:'m5 12 4 4L19 6',sliders:'M4 7h16M4 17h16M8 4v6m8 4v6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',bookmark:'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',bed:'M3 18V6m18 12V9H3m0 5h18m0-5v11M3 18v2M6 9V5h6v4m0 0V5h6v4',bath:'M3 12h18M5 12V5a3 3 0 0 1 6 0M4 12v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3M7 19v2m10-2v2',size:'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',home:'m3 10 9-8 9 8v11H3V10Zm6 11v-8h6v8',reset:'M3 10a9 9 0 1 1 2 8M3 3v7h7',history:'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8 M3 3v5h5',chevron:'m9 5 7 7-7 7',info:'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',office:'M4 4h16v12H4zM2 20h20M9 16v4m6-4v4',send:'m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2'};
export function Icon({name,size=20,...rest}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={paths[name]||paths.home}/></svg>}

const SESSION='inmuebles24-v2-session';
function stored(){try{return JSON.parse(sessionStorage.getItem(SESSION))||{}}catch{return {}}}
function storedShared(){try{return JSON.parse(localStorage.getItem(SHARED_KEY))}catch{return null}}
const initialRoute=()=>readJourney(window.location);
const KNOWN_HOMES=new Set([...homes.map(home=>home.id), ...UNIT_HOMES.map(home=>home.id)]);
const lookupHome=id=>homes.find(home=>home.id===id)||unitHomeById(id);
const homesFor=ids=>ids.map(lookupHome).filter(Boolean);
const listingOf=home=>home?.unitOf?homes.find(item=>item.id===home.unitOf):home;
export function App(){
 const {language,setLanguage,t}=useLanguage();const pt=language==='pt-BR';const say=(es,br)=>pt?br:es;
 const [route,setRoute]=useState(initialRoute);const {page,search,pref,propertyId,listId,map:mapMode='mini',sort='recommended'}=route;
 const [homeChoices,setHomeChoices]=useState({}),[homeIntroDone,setHomeIntroDone]=useState(false);
 const [profile,setProfile]=useState(()=>readContactProfile(stored().profile));
 const [folders,setFolders]=useState(()=>{const session=stored();return normalizeFolders(session.folders,session.saved,KNOWN_HOMES)});
 const [recent,setRecent]=useState(()=>normalizeRecent(stored().recent,KNOWN_HOMES));
 const [receipts,setReceipts]=useState([]);
 const [compareView,setCompareView]=useState(()=>{const value=stored().compare;return {hidden:value?.hidden&&typeof value.hidden==='object'?value.hidden:{},seen:Array.isArray(value?.seen)?value.seen:[]}});
 const [account,setAccount]=useState(()=>{const value=stored().account||{};return {signedIn:value.signedIn===true,...(isAccountId(value.id)?{id:value.id,name:typeof value.name==='string'&&value.name.trim()?value.name.trim().slice(0,24):'Alex'}:{})}}),[loginOpen,setLoginOpen]=useState(false);
 const [guestId]=useState(()=>{const value=stored().guestId;return isGuestId(value)?value:newGuestId()});
 const [lastFolderId,setLastFolderId]=useState(()=>{const value=stored().lastFolderId;return typeof value==='string'?value:null});
 const [shareSheet,setShareSheet]=useState(null),[confirm,setConfirm]=useState(null),[joinPrompt,setJoinPrompt]=useState(null),[inviteDialog,setInviteDialog]=useState(null);
 const [alerts,setAlerts]=useState(()=>readSavedSearches(stored().alerts));
 const [searchHistory,setSearchHistory]=useState(()=>normalizeSearchHistory(stored().searchHistory));
 const [shared,setShared]=useState(()=>readSharedFolders(storedShared(),KNOWN_HOMES));
 const afterLogin=useRef(null);
 const [askPrompt,setAskPrompt]=useState(null);
 const [listingAsk,setListingAsk]=useState(null);
 const [hiddenListings,setHiddenListings]=useState([]);
 const [recorridoUnitId,setRecorridoUnitId]=useState(null);
 const [guideOn]=useState(()=>guideEnabled(window.location.search)),[guideCue,setGuideCue]=useState(null),[guideContact,setGuideContact]=useState(null);
 const [searchLayout,setSearchLayout]=useState(()=>{try{const stored=sessionStorage.getItem('inmuebles24-v2-search-layout');return stored==='hybrid'||stored==='inline'?stored:'original'}catch{return 'original'}});
 function chooseSearchLayout(next){const layout=next==='hybrid'||next==='inline'?next:'original';setSearchLayout(layout);try{sessionStorage.setItem('inmuebles24-v2-search-layout',layout)}catch{/* the choice stays for this view */}}
 const saved=savedIds(folders);
 const [toast,setToast]=useState(null),[folderToast,setFolderToast]=useState(null),[picker,setPicker]=useState(null);
 const lastSearchChange=useRef({time:0,keys:''});
 const toastTimer=useRef(),loginAfterPicker=useRef(false),panelOrigin=useRef(null),routeRef=useRef(route);routeRef.current=route;
 const accountRef=useRef(account);accountRef.current=account;
 const sharedSeen=useRef(shared);
 const meId=account.signedIn?account.id:null;
 const selected=homes.find(h=>h.id===propertyId)||null;
 const isRecorrido=page==='listing'&&!!selected?.development;
 const picked=page==='compare'?pickIds(listId)?.filter(id=>KNOWN_HOMES.has(id)):null;
 const activeFolder=page!=='compare'?null:picked?(picked.length>1?{id:listId,name:say('Este inmueble y tus favoritos','Este imóvel e seus favoritos'),homeIds:picked,pick:true}:null):listId===RECENT_ID?(recent.length?{id:RECENT_ID,name:say('Vistos recientemente','Vistos recentemente'),homeIds:recent.map(entry=>entry.id)}:null):folders.find(folder=>folder.id===listId)||(shared[listId]&&!shared[listId].deleted&&!shared[listId].members.length&&shared[listId].homeIds.length?{...shared[listId],shared:true}:null);
 const folderHomes=activeFolder?homesFor(activeFolder.homeIds):[];
 useLayoutEffect(()=>{const on=page==='listing'&&!!selected&&!selected.development;document.documentElement.classList.toggle('is-listing-route',on);return()=>document.documentElement.classList.remove('is-listing-route')},[page,selected]);
 useLayoutEffect(()=>{document.documentElement.classList.toggle('is-recorrido-route',isRecorrido);if(isRecorrido)document.documentElement.style.setProperty('--flow-header-height','0px');return()=>document.documentElement.classList.remove('is-recorrido-route')},[isRecorrido]);
 useLayoutEffect(()=>{const header=document.querySelector('.home-header');if(!header)return;const measure=()=>{if(header.classList.contains('is-header-hidden')||document.documentElement.classList.contains('is-recorrido-route')){document.documentElement.style.setProperty('--flow-header-height','0px');return;}const bar=header.querySelector('.home-header-bar');document.documentElement.style.setProperty('--flow-header-height',`${(bar||header).offsetHeight}px`)};const observer=new ResizeObserver(measure);observer.observe(header);const classObserver=new MutationObserver(measure);classObserver.observe(header,{attributes:true,attributeFilter:['class']});measure();return()=>{observer.disconnect();classObserver.disconnect()}},[]);
 function armToast(duration=6500){clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>{setToast(null);setFolderToast(null)},duration)}
 function announce(text,undo){setFolderToast(null);setToast(undo?{text,undo}:{text});armToast()}
 function showFolderToast(homeId,folderId,removed=false,folder=null){setToast(null);setFolderToast({homeId,folderId,removed,folder});armToast(3000)}
 function showAccountToast(text){setToast(null);setFolderToast({account:true,text});armToast(3000)}
 function navigate(next,{replace=false,scroll,layer=null,keepInvite=false}={}){
   // An invite belongs to the page it opened; any other page drops it, so its banner never lands on another listing.
   if(!keepInvite&&(next.invite||next.from)){next={...next};delete next.invite;delete next.from;}
   history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);
   history[replace?'replaceState':'pushState']({scroll:scroll??window.scrollY,layer},'',journeyUrl(next));routeRef.current=next;setRoute(next);
   if(scroll!==undefined)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
 }
 useEffect(()=>{history.scrollRestoration='manual';const onPop=()=>{if(morphPending()){flushSync(()=>setRoute(initialRoute()));window.scrollTo({top:history.state?.scroll||0,behavior:'instant'});settlePop();return;}setRoute(initialRoute());requestAnimationFrame(()=>window.scrollTo({top:history.state?.scroll||0,behavior:'instant'}))};window.addEventListener('popstate',onPop);const saveScroll=()=>history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);window.addEventListener('pagehide',saveScroll);return()=>{window.removeEventListener('popstate',onPop);window.removeEventListener('pagehide',saveScroll);clearTimeout(toastTimer.current)}},[]);
 useEffect(()=>{try{sessionStorage.setItem(SESSION,JSON.stringify({profile,folders,recent,saved:savedIds(folders),account,guestId,lastFolderId,compare:compareView,alerts,searchHistory}))}catch{/* Session can continue without browser storage. */}},[profile,folders,recent,account,guestId,lastFolderId,compareView,alerts,searchHistory]);
 useEffect(()=>{try{const text=JSON.stringify(shared);if(localStorage.getItem(SHARED_KEY)!==text)localStorage.setItem(SHARED_KEY,text)}catch{/* Sharing still works in this tab. */}},[shared]);
 // Another tab of this browser plays the other person: its writes arrive here as storage events.
 useEffect(()=>{const onStorage=event=>{if(event.key!==SHARED_KEY)return;let raw=null;try{raw=JSON.parse(event.newValue)}catch{/* A broken copy reads as empty. */}setShared(readSharedFolders(raw,KNOWN_HOMES))};window.addEventListener('storage',onStorage);return()=>window.removeEventListener('storage',onStorage)},[]);
 useEffect(()=>{
   const before=sharedSeen.current;sharedSeen.current=shared;
   if(!meId)return;
   const lost=[];let next=folders;
   for(const folder of folders){
     const record=shared[folder.id];
     if(!record||record.deleted)continue;
     if(!memberOf(record,meId)){if(folder.collab){next=next.filter(item=>item.id!==folder.id);lost.push(folder.name)}continue;}
     const collab=isCollaborative(record);
     if(folder.name!==record.name||folder.homeIds.join()!==record.homeIds.join()||!!folder.collab!==collab)next=mergeSharedHomes(next,folder.id,record.name,record.homeIds,collab);
   }
   if(next!==folders)setFolders(next);
   if(lost.length){announce(say(`Ya no formas parte de "${lost[0]}".`,`Você não faz mais parte de "${lost[0]}".`));return;}
   for(const record of Object.values(shared)){
     if(!memberOf(record,meId))continue;
     const event=newEvent(before[record.id],record,meId);if(!event)continue;
     const who=event.name||say('Tu invitado','Seu convidado');
     announce(event.kind==='join'?say(`${who} se unió a "${record.name}"`,`${who} entrou em "${record.name}"`)
       :event.kind==='add'?say(`${who} agregó un depa a "${record.name}"`,`${who} adicionou um apê em "${record.name}"`)
       :say(`${who} reaccionó: ${reactionLabel(event.reaction,say)}`,`${who} reagiu: ${reactionLabel(event.reaction,say)}`));
     break;
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[shared,meId]);
 useEffect(()=>{
   if(!meId)return;
   const changed=folders.filter(folder=>{const record=shared[folder.id];return record&&!record.deleted&&memberOf(record,meId)&&(record.name!==folder.name||record.homeIds.join()!==folder.homeIds.join())});
   if(changed.length)setShared(current=>readSharedFolders(changed.reduce((next,folder)=>({...next,[folder.id]:syncShared(next[folder.id],folder,meId)}),current),KNOWN_HOMES));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[folders,meId]);
 useEffect(()=>{if(propertyId)setRecent(current=>recordView(current,propertyId))},[propertyId]);
 useEffect(()=>{setListingAsk(null)},[page,propertyId]);
 useEffect(()=>{writeContactProfile(profile)},[profile]);
 useEffect(()=>{if(history.state?.scroll)requestAnimationFrame(()=>window.scrollTo(0,history.state.scroll))},[]);
 function updateSearch(next,label){const normalized=normalizeSearch(next);if(JSON.stringify(normalized)===JSON.stringify(search))return;const keys=Object.keys(normalized).filter(key=>JSON.stringify(normalized[key])!==JSON.stringify(search[key])).sort().join('|');const time=performance.now();const continuous=keys===lastSearchChange.current.keys&&time-lastSearchChange.current.time<600;const nextPage=page==='listing'||page==='compare'||page==='favorites'||page==='folder'||page==='saved'?'results':page;navigate({...route,page:nextPage,propertyId:null,search:normalized},{replace:continuous});lastSearchChange.current={time,keys};if(label)announce(label)}
 function changePref(next){navigate({...route,pref:next});announce(say('Listo, reordené por lo que prefieres. Tus filtros siguen igual.','Pronto, reordenei pelo que você prefere. Seus filtros continuam iguais.'))}
 function begin(next){const normalized=normalizeSearch(next);if(account.signedIn)setSearchHistory(current=>recordSearchHistory(current,normalized));captureHomeTransition();navigate({page:'results',search:normalized,pref:'none',propertyId:null},{scroll:0})}
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
 function hideListing(home){if(!home)return;const hidden=hiddenListings.includes(home.id);setHiddenListings(current=>hidden?current.filter(id=>id!==home.id):[...current,home.id]);if(hidden){announce(say('Este inmueble volvió a la búsqueda','Este anúncio voltou à busca'));return;}setListingAsk(null);returnFromListing();const text=say('Ocultaste este inmueble','Você ocultou este anúncio'),undo=()=>setHiddenListings(current=>current.filter(id=>id!==home.id));const root=document.documentElement;let seen=false,settled=false;const finish=()=>{if(settled)return;settled=true;observer.disconnect();announce(text,undo);};const observer=new MutationObserver(()=>{if(root.dataset.heroMorph)seen=true;else if(seen)finish();});observer.observe(root,{attributes:true,attributeFilter:['data-hero-morph']});requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!seen)finish();}));setTimeout(finish,1200);}
 function hideToasts(){setToast(null);setFolderToast(null)}
 useEffect(()=>{const show=event=>{if(event.detail?.text)announce(event.detail.text)};window.addEventListener('listing-highlight',show);return()=>window.removeEventListener('listing-highlight',show)},[])
 function openFavorites(){hideToasts();navigate({...routeRef.current,page:'favorites',propertyId:null,listId:null},{layer:'favorites',scroll:0})}
 function returnFromFavorites(){if(history.state?.layer==='favorites')history.back();else navigate({...route,page:'results',propertyId:null,listId:null},{replace:true,scroll:0});}
 function openSavedSearches(){hideToasts();navigate({...routeRef.current,page:'saved',propertyId:null,listId:null},{layer:'saved',scroll:0})}
 function returnFromSaved(){if(history.state?.layer==='saved')history.back();else navigate({...route,page:'results',propertyId:null,listId:null},{replace:true,scroll:0});}
 function openFolder(id){hideToasts();if(id===RECENT_ID){navigate({...routeRef.current,page:'compare',propertyId:null,listId:id},{layer:'folder',scroll:0});return;}navigate({...routeRef.current,page:'folder',propertyId:null,listId:id},{layer:'folderpage',scroll:0})}
 function returnFromFolder(){if(history.state?.layer==='folderpage')history.back();else navigate({...routeRef.current,page:'favorites',propertyId:null,listId:null},{replace:true,scroll:0})}
 function compareFolder(id){hideToasts();navigate({...routeRef.current,page:'compare',propertyId:null,listId:id},{layer:'folder',scroll:0})}
 function compareWith(ids){hideToasts();navigate({...routeRef.current,page:'compare',propertyId:null,listId:pickId(ids)},{layer:'pick',scroll:0})}
 function returnFromCompare(){if(history.state?.layer==='folder'||history.state?.layer==='pick')history.back();else if(folders.some(folder=>folder.id===listId))navigate({...route,page:'folder'},{replace:true,scroll:0});else navigate({...route,page:'favorites',propertyId:null,listId:null},{replace:true,scroll:0,layer:history.state?.layer==='compare'?'favorites':null});}
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
 /** Others in the folder lose the listing too, so taking it out of a shared folder asks first. */
 const sharedWithOthers=folder=>!!folder&&!!meId&&isCollaborative(shared[folder.id])&&!!memberOf(shared[folder.id],meId);
 function unsave(home,folder){setFolders(current=>removeHome(current,home.id));showFolderToast(home.id,folder.id,true,folder)}
 function requestUnsave(home,folder){
   if(!sharedWithOthers(folder)){unsave(home,folder);return;}
   setPicker(null);
   const others=activeMembers(shared[folder.id]).filter(member=>member.id!==meId).map(member=>member.name);
   setConfirm({title:say(`¿Quitar de "${folder.name}"?`,`Remover de "${folder.name}"?`),text:others.length===1?say(`Saldrá de la lista para todos: ${others[0]} también dejará de verlo.`,`Sai da lista para todos: ${others[0]} também deixará de ver.`):say(`Saldrá de la lista para todos: ${others.join(', ')} también dejarán de verlo.`,`Sai da lista para todos: ${others.join(', ')} também deixarão de ver.`),action:say('Quitar para todos','Remover para todos'),run:()=>unsave(home,folder)});
 }
 function requestSave(home){
   const current=folderOf(folders,home.id);
   if(current){requestUnsave(home,current);return;}
   setFolderToast(null);setPicker({home});
 }
 function selectFolder(folderId){
   const home=picker?.home;if(!home||picker.nudge)return;
   const target=folders.find(folder=>folder.id===folderId);
   if(target?.homeIds.includes(home.id)&&sharedWithOthers(target)){requestUnsave(home,target);return;}
   setLastFolderId(folderId);
   const result=saveToFolder(folders,folderId,home.id);
   settleSave(home,result.folders,folderId,result.removed,result.folder);
 }
 function createList(name){
   const home=picker?.home;if(!home||picker.nudge)return;
   const {folders:next,folder}=createFolder(folders,name,home.id);
   if(!folder)return;
   setLastFolderId(folder.id);
   settleSave(home,next,folder.id,false,folder);
 }
 /** A list named from Favoritos stays even before it has a home. */
 function createNamedList(name){
   const {folders:next,folder}=createFolder(folders,name,null);
   if(!folder)return;
   setLastFolderId(folder.id);
   setFolders(next.map(item=>item.id===folder.id?{...item,kept:true}:item));
   openFolder(folder.id);
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
 /** A stable id and a display name only; a second account in this browser gets another fictitious name. */
 function startSession(){
   const current=accountRef.current;
   const who=current.id?{id:current.id,name:current.name}:{id:newAccountId(),name:accountName(Object.values(shared).flatMap(record=>record.members.map(member=>member.name)))};
   const next={signedIn:true,...who};accountRef.current=next;setAccount(next);return who;
 }
 function signIn(){setLoginOpen(false);const who=startSession();setSearchHistory(current=>current.length?current:demoSearchHistory(routeRef.current.search?.mode==='rent'?'rent':'buy'));const next=afterLogin.current;afterLogin.current=null;if(next){next(who);return;}showAccountToast(say('Sesión iniciada · tus favoritos quedan guardados','Login feito · seus favoritos ficam salvos'))}
 function closeLogin(){afterLogin.current=null;setLoginOpen(false)}
 /** Alert and folder sharing ask for the simulated login first, then finish what was asked. */
 function withAccount(run){if(account.signedIn){run(account);return;}afterLogin.current=run;openLogin()}
 const searchAlertKey=alertKey(search),alertOn=alerts.some(item=>savedKey(item)===searchAlertKey);
 function toggleAlert(){
   if(alertOn){setAlerts(current=>current.filter(item=>savedKey(item)!==searchAlertKey));showAccountToast(say('Búsqueda eliminada','Busca removida'));return;}
   withAccount(()=>{setAlerts(current=>[{key:searchAlertKey,savedAt:Date.now(),search:normalizeSearch(search)},...current.filter(item=>savedKey(item)!==searchAlertKey)].slice(0,20));showAccountToast(say('Búsqueda guardada','Busca salva'))});
 }
 const absolute=path=>new URL(path,window.location.origin).href;
 const writeShared=next=>setShared(readSharedFolders(next,KNOWN_HOMES));
 const updateRecord=(id,change)=>setShared(current=>current[id]?readSharedFolders({...current,[id]:change(current[id])},KNOWN_HOMES):current);
 /** The public listing link; with an account it carries only an opaque sender id. */
 const publicUrl=home=>absolute(journeyUrl({page:'listing',search,propertyId:(listingOf(home)||home).id,from:meId}));
 function openShare(home){hideToasts();setShareSheet({home})}
 /** "Decidir juntos": keeps the listing in the chosen folder and makes sure the folder has a live invite. */
 function saveTogether({folderId,name}){
   const home=shareSheet?.home,who=accountRef.current;if(!home||!who.id)return null;
   let next=folders,folder;
   if(name){({folders:next,folder}=createFolder(folders,name,home.id));if(!folder)return null;}
   else{folder=folders.find(item=>item.id===folderId);if(!folder)return null;if(!folder.homeIds.includes(home.id))({folders:next,folder}=saveToFolder(folders,folderId,home.id));}
   const now=Date.now(),before=shared[folder.id];
   const created=shareFolder(shared,{...folder,homeIds:before&&!before.deleted?before.homeIds:folder.homeIds},now,who);
   const record=syncShared(created[folder.id],folder,who.id,now);
   writeShared({...created,[folder.id]:record});
   setFolders(next);setLastFolderId(folder.id);
   const others=activeMembers(record).filter(member=>member.id!==who.id).map(member=>member.name);
   return {folder,others,url:absolute(journeyUrl({page:'listing',search,propertyId:(listingOf(home)||home).id,invite:record.inviteToken,from:who.id}))};
 }
 function sentTogether(saved,channel){
   setShareSheet(null);
   announce(saved.others.length&&!channel?say(`Guardado en "${saved.folder.name}". ${saved.others.join(', ')} ya lo ven.`,`Salvo em "${saved.folder.name}". ${saved.others.join(', ')} já veem.`)
     :say(`Guardado en tu lista. Te avisamos cuando reaccionen.`,`Salvo na sua lista. Avisamos quando reagirem.`));
 }

 /** The folder's "+": the first invite turns the list into a shared one, with this account as owner. */
 function inviteToFolder(folder,cover){
   withAccount(who=>{
     const created=shareFolder(shared,folder,Date.now(),who);writeShared(created);
     const record=created[folder.id];
     setInviteDialog({folderName:folder.name,cover,count:record.homeIds.length,url:absolute(journeyUrl({page:'folder',search,invite:record.inviteToken,from:who.id}))});
   });
 }
 function reactInFolder(folderId,homeId,kind){if(meId)updateRecord(folderId,record=>react(record,meId,homeId,kind))}
 function noteInFolder(folderId,homeId,text){if(meId)updateRecord(folderId,record=>setNote(record,meId,homeId,text))}
 function renameFolder(folderId,name){setFolders(current=>current.map(folder=>folder.id===folderId?{...folder,name}:folder))}
 function leaveSharedFolder(folderId){
   const folder=folders.find(item=>item.id===folderId);if(!folder)return;
   setConfirm({title:say(`¿Salir de "${folder.name}"?`,`Sair de "${folder.name}"?`),text:say('Dejarás de ver la lista y sus inmuebles. Para volver, necesitarás una nueva invitación.','Você deixa de ver a lista e os imóveis dela. Para voltar, vai precisar de um novo convite.'),action:say('Salir','Sair'),
     run:()=>{updateRecord(folderId,record=>leaveFolder(record,meId));setFolders(current=>current.filter(item=>item.id!==folderId));returnFromFolder()}});
 }
 function removeFolderMember(folderId,memberId){updateRecord(folderId,record=>removeMember(record,meId,memberId))}
 function revokeFolderLink(folderId){updateRecord(folderId,record=>revokeInvite(record,meId));announce(say('Listo. Los enlaces que ya enviaste dejaron de funcionar.','Pronto. Os links que você já enviou pararam de funcionar.'))}
 function moveInFolder(homeId, stage){setFolders(current=>current.map(folder=>folder.id===listId?withStage(folder, homeId, stage):folder))}
 function saveFolderStages(labels){setFolders(current=>current.map(folder=>folder.id===listId?withLabels(folder, labels):folder))}
 function addFolderGuest(email){const folder=folders.find(item=>item.id===listId);if(!folder)return false;const result=withGuest(folder, email);if(result.added)setFolders(current=>current.map(item=>item.id===listId?result.folder:item));return result.added}
 function removeFolderGuest(email){setFolders(current=>current.map(folder=>folder.id===listId?withoutGuest(folder, email):folder))}
 function shareFolderView(){const url=absolute(journeyUrl({page:'folder',search,listId}));const done=()=>announce(say('Enlace copiado. Ábrelo en este navegador para ver la lista.','Link copiado. Abra neste navegador para ver a lista.'));if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(done,()=>announce(url.replace(/^https?:\/\//,'')));else announce(url.replace(/^https?:\/\//,''))}
 function duplicateFolder(folderId){
   const folder=folders.find(item=>item.id===folderId);if(!folder)return;
   const name=uniqueFolderName(say(`${folder.name} (copia)`,`${folder.name} (cópia)`),folders);
   const {folders:next,folder:copy}=createFolder(folders,name,null);if(!copy)return;
   setFolders(next.map(item=>item.id===copy.id?{...item,homeIds:[...folder.homeIds],kept:true,...(folder.board?{board:JSON.parse(JSON.stringify(folder.board))}:{})}:item));
   openFolder(copy.id);
 }
 function deleteFolder(folderId){
   const folder=folders.find(item=>item.id===folderId);if(!folder)return;
   setConfirm({title:say(`¿Eliminar "${folder.name}"?`,`Excluir "${folder.name}"?`),
     text:sharedWithOthers(folder)?say('Los miembros perderán acceso; les ofreceremos guardar una copia.','Os membros perderão o acesso; vamos oferecer que guardem uma cópia.'):say('Los inmuebles guardados aquí saldrán de tus favoritos.','Os imóveis salvos aqui sairão dos seus favoritos.'),
     action:say('Eliminar lista','Excluir lista'),
     run:()=>{if(shared[folderId]&&meId)setShared(current=>readSharedFolders(deleteShared(current,folderId,meId),KNOWN_HOMES));setFolders(current=>current.filter(item=>item.id!==folderId));returnFromFolder()}});
 }
 /** A member of a deleted list keeps its listings as a private copy. */
 function copyDeletedFolder(folderId){
   const folder=folders.find(item=>item.id===folderId);if(!folder)return;
   const rest=folders.filter(item=>item.id!==folderId);
   const {folders:next,folder:copy}=createFolder(rest,uniqueFolderName(say(`${folder.name} (copia)`,`${folder.name} (cópia)`),rest),null);
   setFolders(next.map(item=>item.id===copy.id?{...item,homeIds:folder.homeIds}:item));
   navigate({...routeRef.current,page:'folder',listId:copy.id},{replace:true,scroll:0});
 }
 function dismissDeletedFolder(folderId){setFolders(current=>current.filter(item=>item.id!==folderId));returnFromFolder()}

 /** Joining from an invite: the anonymous reactions of this tab move to the account. */
 function joinShared(record,who){
   setShared(current=>current[record.id]?readSharedFolders({...current,[record.id]:migrateReactions(joinFolder(current[record.id],who),guestId,who.id)},KNOWN_HOMES):current);
   setFolders(current=>mergeSharedHomes(current,record.id,record.name,record.homeIds,true));
 }
 const inviteRecord=route.invite?findByToken(shared,route.invite):null;
 const inviteSender=inviteRecord?(inviteRecord.members.find(member=>member.id===route.from)||inviteRecord.members.find(member=>member.role==='owner'&&!member.left)||null):null;
 function openInvitedFolder(record){navigate({...routeRef.current,page:'folder',listId:record.id,propertyId:null},{layer:'folderpage',scroll:0})}
 function joinAndOpen(record,who){
   joinShared(record,who);
   const name=record.members.find(member=>member.id===route.from)?.name||record.members.find(member=>member.role==='owner')?.name;
   announce(name?say(`Te uniste a la lista de ${name}`,`Você entrou na lista de ${name}`):say('Te uniste a la lista','Você entrou na lista'));
   navigate({...routeRef.current,page:'folder',listId:record.id,propertyId:null},{replace:routeRef.current.page==='folder',scroll:0});
 }
 /** Guests react without an account; the first reaction invites them in. A signed-in guest joins by reacting. */
 function reactAsGuest(kind){
   const record=inviteRecord,homeId=propertyId;if(!record||!homeId)return;
   if(meId){if(!memberOf(record,meId)){joinShared(record,account);announce(say('Te uniste a la lista','Você entrou na lista'))}updateRecord(record.id,current=>react(current,meId,homeId,kind));return;}
   const first=!Object.values(record.reactions).some(byActor=>byActor[guestId]);
   updateRecord(record.id,current=>react(current,guestId,homeId,kind));
   if(first)setJoinPrompt({record,reason:'react'});
 }
 function requestJoin(record){if(meId){joinAndOpen(record,account);return;}setJoinPrompt({record,reason:'folder'})}
 function signInToJoin(){const prompt=joinPrompt;setJoinPrompt(null);const who=startSession();if(prompt?.record)joinAndOpen(prompt.record,who)}
 function changeSort(next){navigate({...routeRef.current,sort:next},{replace:true})}

 /** The guide's stops land on the results grid unless they need another page; the search itself is kept. */
 function guideResults(extra={}){
   const current=routeRef.current;
   const there=current.page==='results'&&!current.propertyId&&(current.map||'mini')!=='full'&&!current.listId;
   const next={...current,page:'results',propertyId:null,listId:null,map:current.map==='half'?'half':'mini',...extra};
   if(there&&JSON.stringify(next)===JSON.stringify(current))return false;
   navigate(next,there?{replace:true}:{scroll:0});
   return !there;
 }
 function guideCueBar(view){
   const current=routeRef.current.search;
   // Credit only exists in a purchase, so that stop moves a rent search to buying.
   const extra=view==='credit'&&current.mode==='rent'?{search:normalizeSearch({...current,mode:'buy',budget:7500000,minBudget:0})}:view==='refine'?{search:normalizeSearch({areas:current.areas.length?current.areas:['Narvarte Poniente']})}:{};
   guideResults(extra);
   setGuideCue({view,id:Date.now()});
 }
 /** Opens the first listing on screen through the card itself, so the panel keeps its morph. */
 function guideOpenCard(){
   const current=routeRef.current;
   if(current.page==='results'&&current.propertyId)return;
   const moved=guideResults();
   const started=performance.now();
   const find=()=>{
     const cards=[...document.querySelectorAll('.flow-listings .discovery-item[data-home-id]')].filter(node=>!lookupHome(node.dataset.homeId)?.development&&node.getBoundingClientRect().height>0);
     if(!cards.length){if(performance.now()-started<2500)requestAnimationFrame(find);return;}
     const card=cards.find(node=>{const rect=node.getBoundingClientRect();return rect.top>=0&&rect.bottom<=innerHeight})||cards[0];
     const home=lookupHome(card.dataset.homeId);if(!home)return;
     open(home,{currentTarget:card.querySelector('.discovery-open')});
   };
   setTimeout(()=>requestAnimationFrame(find),moved?480:0);
 }
 /** A folder with three or more homes, or a new "Guide" one with homes from this search that aren't saved yet. */
 function guideFolder(){
   const existing=comparableFolder(folders);if(existing)return existing.id;
   const savedNow=new Set(savedIds(folders));
   const picks=[...matchingHomes(search),...prototypeResults(search)].filter((home,index,list)=>!home.development&&!savedNow.has(home.id)&&list.findIndex(item=>item.id===home.id)===index).slice(0,GUIDE_COMPARE_SIZE).map(home=>home.id);
   const {folders:next,folder}=createFolder(folders,uniqueFolderName(GUIDE_FOLDER_NAME,folders),null);
   if(!folder)return null;
   setFolders(next.map(item=>item.id===folder.id?{...item,homeIds:picks}:item));
   return folder.id;
 }
 function guideCompare(contact){
   const id=guideFolder();if(!id)return;
   hideToasts();
   setGuideContact(contact?{folderId:id,id:Date.now()}:null);
   navigate({...routeRef.current,page:'compare',propertyId:null,listId:id},{layer:'folder',scroll:0});
 }
 function guideAction(action){
   const current=routeRef.current;
   setLoginOpen(false);
   switch(action){
     case 'home':navigate({...current,page:'home',propertyId:null,listId:null,map:'mini'},{scroll:0});return;
    case 'hybrid-search':chooseSearchLayout('hybrid');navigate({...current,page:'home',propertyId:null,listId:null,map:'mini'},{scroll:0});return;
    case 'inline-search':chooseSearchLayout('inline');navigate({...current,page:'home',propertyId:null,listId:null,map:'mini'},{scroll:0});return;
    case 'original-search':chooseSearchLayout('original');navigate({...current,page:'home',propertyId:null,listId:null,map:'mini'},{scroll:0});return;
     case 'mora-answer':guideCueBar('answer');return;
     case 'mora-suggest':guideCueBar('suggest');return;
    case 'mora-refine':guideCueBar('refine');return;
     case 'ask-moment':guideCueBar('moment');return;
     case 'ask-credit':guideCueBar('credit');return;
     case 'ask-work':guideCueBar('qualify');return;
     case 'map-full':case 'context-map':
       if(current.page==='results'&&!current.propertyId&&current.map==='full')return;
       navigate({...current,page:'results',propertyId:null,listId:null,map:'full'},{layer:'map',scroll:0});return;
     case 'grid':case 'favorites':guideResults({sort:'recommended'});return;
     case 'sort-rarity':guideResults({sort:'rarity'});return;     case 'mini-listing':case 'context-panel':guideOpenCard();return;
     case 'context-listing':{
       const home=matchingHomes(current.search).find(item=>!item.development)||homes.find(item=>!item.development);
       navigate({...current,page:'listing',propertyId:home.id,listId:null,map:'mini'},{layer:'listing',scroll:0});return;
     }
     case 'sign-in':if(account.signedIn)showAccountToast(say('Ya tienes sesión iniciada','Você já está com login feito'));else openLogin();return;
     case 'share-list':{const id=guideFolder();if(id)navigate({...current,page:'folder',propertyId:null,listId:id},{layer:'folderpage',scroll:0});return;}
     case 'compare':guideCompare(false);return;
     case 'batch':guideCompare(true);return;
     case 'tour':setRecorridoUnitId(null);navigate({...current,page:'listing',propertyId:'torre-olmo',listId:null,map:'mini'},{layer:'listing',scroll:0});return;
     default:
   }
 }
 useEffect(()=>{if(page!=='compare')setGuideContact(null)},[page]);
 function accountAction(action){
   if(action==='favorites'){openFavorites();return;}
   if(action==='saved'){openSavedSearches();return;}
   if(action==='logout'){setAccount(current=>({...current,signedIn:false}));return;}
   showAccountToast(say('Disponible fuera de este prototipo','Disponível fora deste protótipo'));
 }
 const toastFolder=folderToast&&(folders.find(folder=>folder.id===folderToast.folderId)||(folderToast.removed?folderToast.folder:null));
 const toastHome=folderToast&&lookupHome(folderToast.homeId);
 function changeLanguage(next){const updated={...route,search:{...search,note:translateKnownNote(search.note,next)}};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated);setLanguage(next)}
 const exactIds=new Set(matchingHomes(search).map(home=>home.id));
 const visible=prototypeResults(search).filter(home=>!hiddenListings.includes(home.id)).sort((a,b)=>Number(exactIds.has(b.id))-Number(exactIds.has(a.id))||((pref==='extra'||pref==='separate')?Number(b.beds>=3)-Number(a.beds>=3):0)||(exactIds.has(a.id)?listingPrice(a)-listingPrice(b):0));
 const addReceipt=receipt=>{setReceipts(current=>[receipt,...current.filter(r=>r.id!==receipt.id)]);setFolders(current=>current.map(folder=>folder.homeIds.includes(receipt.propertyId)?withStage(folder,receipt.propertyId,'contacted',{keepLater:true}):folder))};

 const pageFolder=page==='folder'&&listId?folders.find(folder=>folder.id===listId)||null:null;
 const pageRecord=page==='folder'?(listId?shared[listId]||null:inviteRecord):null;
 const folderMode=page!=='folder'?null
   :pageFolder?(pageFolder.collab&&pageRecord?.deleted&&!memberOf(pageRecord,meId)?'deleted':pageFolder.collab&&!meId?'gate':'member')
   :route.invite?(pageRecord?'preview':'missing'):null;
 const folderRecord=folderMode==='member'&&pageRecord&&!pageRecord.deleted&&memberOf(pageRecord,meId)?pageRecord:folderMode==='preview'||folderMode==='deleted'?pageRecord:null;
 const folderPageHomes=homesFor(folderMode==='preview'?pageRecord.homeIds:pageFolder?.homeIds||[]);
 // Opening your own link lands in the folder itself, without the invite banner.
 useEffect(()=>{
   if(!route.invite||!inviteRecord||!meId||!memberOf(inviteRecord,meId))return;
   if(page==='folder'||(page==='listing'&&route.from===meId)){
     if(!folders.some(folder=>folder.id===inviteRecord.id))setFolders(current=>mergeSharedHomes(current,inviteRecord.id,inviteRecord.name,inviteRecord.homeIds,isCollaborative(inviteRecord)));
     navigate({...route,page:'folder',listId:inviteRecord.id,propertyId:null},{replace:true,scroll:0});
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[route.invite,page,meId,inviteRecord?.id]);
 const myReaction=inviteRecord&&propertyId?inviteRecord.reactions[propertyId]?.[meId&&memberOf(inviteRecord,meId)?meId:guestId]?.kind||null:null;
 const inviteBanner=page==='listing'&&route.invite?<InviteBanner record={inviteRecord} sender={inviteSender} reaction={myReaction} joined={!!meId&&!!memberOf(inviteRecord,meId)}
   onReact={reactAsGuest} onJoin={()=>inviteRecord&&requestJoin(inviteRecord)}
   onOpenList={()=>{if(!inviteRecord)return;if(meId&&memberOf(inviteRecord,meId))openInvitedFolder(inviteRecord);else navigate({...route,page:'folder',propertyId:null,listId:null},{keepInvite:true,layer:'folderpage',scroll:0})}}/>:null;
 const showResults=page!=='home'&&page!=='listing'&&page!=='compare'&&page!=='favorites'&&page!=='folder'&&page!=='saved';
 const panelHome=page==='home'||showResults?selected:null;
 const favoritesPage=page==='favorites'||(page==='compare'&&!activeFolder)||(page==='folder'&&!folderMode);
 const folderMeta=activeFolder?.pick?say(`${folderHomes.length} inmuebles lado a lado`,`${folderHomes.length} imóveis lado a lado`):activeFolder?.id===RECENT_ID?say(`${folderHomes.length} vistos en esta sesión`,`${folderHomes.length} vistos nesta sessão`):activeFolder?.shared?`${savedCountLabel(folderHomes.length,language)} · ${say('carpeta compartida','pasta compartilhada')}`:savedCountLabel(folderHomes.length,language);
 const boardCompare=page==='compare'&&!!activeFolder&&!activeFolder.pick&&activeFolder.id!==RECENT_ID;
 const folderView=folderMode?<FolderPage key={`${listId||route.invite}|${folderMode}`} mode={folderMode} name={folderMode==='preview'||folderMode==='missing'?pageRecord?.name||'':pageFolder.name} homes={folderPageHomes} board={readBoard(pageFolder)} record={folderRecord} meId={meId} me={account.signedIn?account:null} sender={inviteSender} search={search} saved={saved} receipts={receipts} onLike={requestSave}
   onBack={folderMode==='preview'||folderMode==='missing'?()=>navigate({...routeRef.current,page:'results',listId:null,propertyId:null},{scroll:0}):returnFromFolder} onOpen={openListingFromCompare} onCompare={()=>compareFolder(listId)} onExplore={()=>navigate({...route,page:'results',propertyId:null,listId:null},{scroll:0})}
   onInvite={()=>inviteToFolder(pageFolder,folderPageHomes[0])} onReact={(homeId,kind)=>reactInFolder(listId,homeId,kind)} onNote={(homeId,text)=>noteInFolder(listId,homeId,text)}
   onRename={name=>renameFolder(listId,name)} onLeave={()=>leaveSharedFolder(listId)} onRemoveMember={id=>removeFolderMember(listId,id)} onRevoke={()=>revokeFolderLink(listId)} onDelete={()=>deleteFolder(listId)}
   onCopy={()=>copyDeletedFolder(listId)} onDismiss={()=>dismissDeletedFolder(listId)} onJoin={()=>pageRecord&&requestJoin(pageRecord)} onLogin={()=>startSession()}
   onMove={moveInFolder} onStages={saveFolderStages} onAddGuest={addFolderGuest} onRemoveGuest={removeFolderGuest} onShare={shareFolderView} onDuplicate={()=>duplicateFolder(listId)}/>:null;
 const comparePage=page==='compare'&&activeFolder?<div className="compare-route"><CompareFavorites key={activeFolder.id} folderName={activeFolder.name} meta={folderMeta} homes={folderHomes} hiddenIds={(compareView.hidden[activeFolder.id]||[]).filter(id=>folderHomes.some(home=>home.id===id))} onHide={id=>hideFromCompare(activeFolder.id,id)} onShowAll={()=>showAllInCompare(activeFolder.id)} receipts={receipts} profile={profile} onProfile={setProfile} onReceipts={list=>{setReceipts(current=>[...list,...current]);setFolders(current=>current.map(folder=>list.reduce((item,receipt)=>item.homeIds.includes(receipt.propertyId)?withStage(item,receipt.propertyId,'contacted',{keepLater:true}):item,folder)))}} intro={!compareView.seen.includes(activeFolder.id)&&!folderHomes.some(home=>receipts.some(receipt=>receipt.propertyId===home.id))} onIntroSeen={()=>markCompareSeen(activeFolder.id)} startContact={guideContact?.folderId===activeFolder.id?guideContact.id:null} onClose={returnFromCompare} onOpen={openListingFromCompare} onExplore={()=>navigate({...route,page:'results',propertyId:null,listId:null},{scroll:0})} backLabel={activeFolder.pick?say('Volver al inmueble','Voltar ao imóvel'):folders.some(folder=>folder.id===activeFolder.id)?say('Volver a la lista','Voltar para a lista'):undefined} onBoard={!activeFolder.pick&&activeFolder.id!==RECENT_ID?()=>openFolder(activeFolder.id):undefined} chipActions={activeFolder.id===RECENT_ID}/></div>:null;
 return <div className="app-shell"><HomeHeader results={page!=='home'} signedIn={account.signedIn} onAction={headerAction} onLogin={openLogin} onAccount={accountAction} onHome={()=>navigate({...routeRef.current,page:'home',propertyId:null},{scroll:0})}/>
 <main>{page==='home'?<div><Home choices={homeChoices} onChoose={key=>setHomeChoices(current=>key==='template'?{...current,mode:true,propertyType:true}:{...current,[key]:true})} skipIntro={homeIntroDone} onIntroDone={()=>setHomeIntroDone(true)} search={search} setSearch={next=>{const updated={...route,search:typeof next==='function'?next(search):next};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated)}} onSearch={begin} saved={saved} receipts={receipts} onOpen={open} onLike={requestSave} signedIn={account.signedIn} searchHistory={searchHistory} recent={recent} onLogin={openLogin} searchLayout={searchLayout}/></div>:page==='listing'&&selected?selected.development?<Suspense fallback={<RecorridoShell home={selected}/>}><RecorridoPage key={selected.id} home={selected} savedIds={saved} initialUnitId={recorridoUnitId} onLike={requestSave} onShare={openShare} onClose={returnFromListing} onHome={()=>navigate({...routeRef.current,page:'home',propertyId:null},{scroll:0})}/></Suspense>:<div className="search-flow-page home-evolution listing-route">{inviteBanner}<div><PropertyDetail key={selected.id} home={selected} search={search} pref={pref} sort={sort} favorites={homesFor(saved)} saved={saved} receipts={receipts} onLike={requestSave} onShare={openShare} hidden={hiddenListings.includes(selected.id)} onHide={hideListing} onOpenListing={openListingFromCompare} onMore={()=>navigate({...routeRef.current,page:'results',propertyId:null},{scroll:0})} onSearch={next=>navigate({...routeRef.current,page:'results',search:next,propertyId:null},{scroll:0})} onFavorite={navigateListing} onCompare={compareWith} receipt={receipts.find(r=>r.propertyId===selected.id)} onClose={returnFromListing} onAskSection={ask=>setListingAsk({section:ask.section,question:ask.question})} profile={profile} onProfile={setProfile} onReceipt={addReceipt}/></div></div>:page==='listing'&&route.invite?<div className="search-flow-page home-evolution listing-route">{inviteBanner}<InviteUnavailable search={search} onOpen={home=>navigate({...routeRef.current,page:'listing',propertyId:home.id},{scroll:0})}/></div>
 :(folderMode||boardCompare)?<FolderViewSwap mode={boardCompare?'compare':'board'}>{boardCompare?comparePage:folderView}</FolderViewSwap>
 :page==='saved'?<SavedSearches entries={alerts} onOpen={next=>navigate({...route,page:'results',search:next,propertyId:null,listId:null},{scroll:0})} onRemove={key=>setAlerts(current=>current.filter(item=>savedKey(item)!==key))} onBack={returnFromSaved}/>:favoritesPage?<FavoritesIndex folders={folders} recent={recent} shared={shared} meId={meId} suggestion={uniqueFolderName(suggestedFolderName(search),folders)} onOpenFolder={openFolder} onCreate={createNamedList} onBack={returnFromFavorites}/>:page==='compare'?comparePage:showResults?<div className="results-layout"><div className="results-main"><ResultsFlowPage chosen={homeChoices} blocked={!!propertyId} search={search} onChange={updateSearch} visible={visible} saved={saved} onSave={requestSave} onOpen={open} sort={sort} onSort={changeSort} alert={{on:alertOn,onToggle:toggleAlert}} receipts={receipts} cue={guideCue} onCue={()=>setGuideCue(null)} assistantProps={{search,pref,onPref:changePref,onChange:updateSearch}} mapProps={{mode:mapMode,onMode:changeMapMode,onOpenListing:openListingFromMap,recent:recent.map(entry=>entry.id),hidden:false,signedIn:account.signedIn,onLogin:openLogin,onAskMora:text=>setAskPrompt({text,id:Date.now()})}}/></div></div>:null}</main>
 <AnimatePresence>{panelHome&&<ListingPanel key="listing-panel" home={panelHome} origin={panelOrigin.current} search={search} pref={pref} hasSearch={page!=='home'} favorites={homesFor(saved)} profile={profile} onProfile={setProfile} onReceipt={addReceipt} onClose={closeDetail} onNavigate={navigateListing} onDetails={openDetails}/>}</AnimatePresence>
 <AnimatePresence>{page==='listing'&&selected&&!selected.development&&listingAsk&&<ListingPanel key={`listing-ask-${listingAsk.section}`} home={lookupHome(listingAsk.homeId)||selected} origin={null} search={search} pref={pref} hasSearch favorites={homesFor(saved)} sequence={visible.some(home=>home.id===selected.id)?visible.map(home=>home.id):[]} initialAction={{type:'ask',question:listingAsk.question,section:listingAsk.section}} profile={profile} onProfile={setProfile} onReceipt={addReceipt} onClose={()=>setListingAsk(null)} onNavigate={id=>setListingAsk(current=>current&&{...current,homeId:id})} onDetails={()=>{const id=listingAsk.homeId;setListingAsk(null);if(!id||id===selected.id){window.scrollTo({top:0,behavior:'instant'});return;}const listing=listingOf(lookupHome(id))||lookupHome(id);navigate({...routeRef.current,propertyId:listing.id},{scroll:0})}}/>}</AnimatePresence>
 {isRecorrido?null:(page==='home'||page==='listing'||showResults)?<CatalogFooter/>:<footer className="site-footer"><BrandMark/><p>{say('Prototipo V2 · Contacto simulado','Protótipo V2 · Contato simulado')}</p><div className="footer-controls"><select className="footer-language" aria-label={t('Idioma')} value={language} onChange={e=>changeLanguage(e.target.value)}>{languages.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></div></footer>}

 {toast&&<div className="toast" role="status"><span>{toast.text}</span>{toast.undo&&<button type="button" className="toast-action" onClick={()=>{toast.undo();setToast(null)}}>{say('Deshacer','Desfazer')}</button>}<button className="icon-button" onClick={()=>setToast(null)} aria-label={t('Cerrar aviso')}><Icon name="close" size={16}/></button></div>}
 <AnimatePresence>{folderToast?.account?<AccountToast key="folder-toast" text={folderToast.text} onHold={()=>clearTimeout(toastTimer.current)} onRelease={()=>armToast(3000)}/>:toastFolder&&toastHome&&<FolderToast key="folder-toast" home={toastHome} folder={toastFolder} removed={folderToast.removed} onUndo={()=>{setFolders(current=>restoreHome(current,toastFolder,toastHome.id));showFolderToast(toastHome.id,toastFolder.id)}} onChange={()=>{setFolderToast(null);setPicker({home:toastHome})}} onView={()=>openFolder(toastFolder.id)} onHold={()=>clearTimeout(toastTimer.current)} onRelease={()=>armToast(3000)}/>}</AnimatePresence>
 <AnimatePresence onExitComplete={()=>{if(loginAfterPicker.current){loginAfterPicker.current=false;setLoginOpen(true)}}}>{picker&&<FolderPicker key="folder-picker" home={picker.home} folders={folders} suggestion={uniqueFolderName(suggestedFolderName(search),folders)} nudge={picker.nudge} onSelect={selectFolder} onCreate={createList} onClose={()=>setPicker(null)} onLogin={loginFromNudge} onDismissNudge={dismissNudge}/>}</AnimatePresence>
 <AnimatePresence>{shareSheet&&<ShareSheet key="share-sheet" home={shareSheet.home} signedIn={account.signedIn} folders={folders} shared={shared} lastFolderId={lastFolderId}
   suggestion={uniqueFolderName(suggestedFolderName(search),folders)} publicUrl={publicUrl(shareSheet.home)} onSignIn={startSession} onSave={saveTogether} onSent={sentTogether} onClose={()=>setShareSheet(null)}/>}</AnimatePresence>
 <AnimatePresence>{inviteDialog&&<InviteDialog key="invite-dialog" folderName={inviteDialog.folderName} cover={inviteDialog.cover} count={inviteDialog.count} url={inviteDialog.url} onSent={()=>{setInviteDialog(null);announce(say('Invitación lista. Te avisamos cuando se unan.','Convite pronto. Avisamos quando entrarem.'))}} onClose={()=>setInviteDialog(null)}/>}</AnimatePresence>
 <AnimatePresence>{joinPrompt&&<JoinDialog key="join" reason={joinPrompt.reason} record={joinPrompt.record} sender={inviteSender} onSignIn={signInToJoin} onClose={()=>setJoinPrompt(null)}/>}</AnimatePresence>
 <AnimatePresence>{confirm&&<ConfirmDialog key="confirm" {...confirm} onConfirm={()=>{const run=confirm.run;setConfirm(null);run()}} onClose={()=>setConfirm(null)}/>}</AnimatePresence>
 <AnimatePresence>{loginOpen&&<LoginDialog key="login" onSignIn={signIn} onClose={closeLogin}/>}</AnimatePresence>
 <SelectionMora contextHome={selected} routeKey={`${page}|${propertyId||''}|${listId||''}`}/>
 {guideOn&&<ProjectGuide onAction={guideAction} searchLayout={searchLayout}/>}
 </div>;
}
