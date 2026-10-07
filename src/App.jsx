import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {PropertyDetail} from './PropertyDetail';
import {SearchBar} from './SearchBar';
import {readContactProfile,writeContactProfile} from './contactProfile.js';

import {Home,HomeHeader} from './Home';
import {ResultsFlowPage} from './ResultsFlowPage';
import {captureHomeTransition} from './searchFlowMotion';

import {homes,listingPrice} from './data';
import {languages,useLanguage,translateKnownNote} from './i18n';
import {normalizeSearch,matchingHomes,prototypeResults,readJourney,journeyUrl} from './journey';
const paths={search:'m21 21-4.5-4.5 M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',close:'m6 6 12 12M6 18 18 6',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',check:'m5 12 4 4L19 6',sliders:'M4 7h16M4 17h16M8 4v6m8 4v6',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',bed:'M3 18V6m18 12V9H3m0 5h18m0-5v11M3 18v2M6 9V5h6v4m0 0V5h6v4',bath:'M3 12h18M5 12V5a3 3 0 0 1 6 0M4 12v3a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-3M7 19v2m10-2v2',size:'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',home:'m3 10 9-8 9 8v11H3V10Zm6 11v-8h6v8',reset:'M3 10a9 9 0 1 1 2 8M3 3v7h7',chevron:'m9 5 7 7-7 7',info:'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',office:'M4 4h16v12H4zM2 20h20M9 16v4m6-4v4',send:'m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2'};
export function Icon({name,size=20,...rest}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={paths[name]||paths.home}/></svg>}

const SESSION='inmuebles24-v2-session';
function stored(){try{return JSON.parse(sessionStorage.getItem(SESSION))||{}}catch{return {}}}
const initialRoute=()=>readJourney(window.location);
export function App(){
 const {language,setLanguage,t}=useLanguage();const pt=language==='pt-BR';const say=(es,br)=>pt?br:es;
 const [route,setRoute]=useState(initialRoute);const {page,search,pref,propertyId}=route;
 const [homeChoices,setHomeChoices]=useState({}),[homeIntroDone,setHomeIntroDone]=useState(false);
 const [contact,setContact]=useState(null);
 const [profile,setProfile]=useState(()=>readContactProfile(stored().profile));
 const [saved,setSaved]=useState(()=>stored().saved||[]),[receipts,setReceipts]=useState(()=>stored().receipts||[]);
 const [toast,setToast]=useState('');
 const lastSearchChange=useRef({time:0,keys:''});
 const toastTimer=useRef(),detailOrigin=useRef(null),routeRef=useRef(route);routeRef.current=route;
 const selected=homes.find(h=>h.id===propertyId)||null;
 useLayoutEffect(()=>{const header=document.querySelector('.home-header');if(!header)return;const measure=()=>{if(header.classList.contains('is-header-hidden')){document.documentElement.style.setProperty('--flow-header-height','0px');return;}const bar=header.querySelector('.home-header-bar');document.documentElement.style.setProperty('--flow-header-height',`${(bar||header).offsetHeight}px`)};const observer=new ResizeObserver(measure);observer.observe(header);const classObserver=new MutationObserver(measure);classObserver.observe(header,{attributes:true,attributeFilter:['class']});measure();return()=>{observer.disconnect();classObserver.disconnect()}},[]);
 function announce(text){setToast(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),6500)}
 function navigate(next,{replace=false,scroll,layer=null}={}){
   history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);
   history[replace?'replaceState':'pushState']({scroll:scroll??window.scrollY,layer},'',journeyUrl(next));routeRef.current=next;setRoute(next);setContact(null);
   if(scroll!==undefined)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));
 }
 useEffect(()=>{history.scrollRestoration='manual';const onPop=()=>{setRoute(initialRoute());setContact(null);requestAnimationFrame(()=>window.scrollTo({top:history.state?.scroll||0,behavior:'instant'}))};window.addEventListener('popstate',onPop);const saveScroll=()=>history.replaceState({...history.state,scroll:window.scrollY},'',window.location.href);window.addEventListener('pagehide',saveScroll);return()=>{window.removeEventListener('popstate',onPop);window.removeEventListener('pagehide',saveScroll);clearTimeout(toastTimer.current)}},[]);
 useEffect(()=>{try{sessionStorage.setItem(SESSION,JSON.stringify({profile,saved,receipts}))}catch{/* Session can continue without browser storage. */}},[profile,saved,receipts]);
 useEffect(()=>{writeContactProfile(profile)},[profile]);
 useEffect(()=>{if(history.state?.scroll)requestAnimationFrame(()=>window.scrollTo(0,history.state.scroll))},[]);
 function updateSearch(next,label){const normalized=normalizeSearch(next);if(JSON.stringify(normalized)===JSON.stringify(search))return;const keys=Object.keys(normalized).filter(key=>JSON.stringify(normalized[key])!==JSON.stringify(search[key])).sort().join('|');const time=performance.now();const continuous=keys===lastSearchChange.current.keys&&time-lastSearchChange.current.time<600;navigate({...route,page:page==='listing'?'results':page,propertyId:null,search:normalized},{replace:continuous});lastSearchChange.current={time,keys};if(label)announce(label)}
 function changePref(next){navigate({...route,pref:next});announce(say('Preferencia actualizada. Los límites no cambiaron.','Preferência atualizada. Os limites não mudaram.'))}
 function begin(next){captureHomeTransition();navigate({page:'results',search:normalizeSearch(next),pref:'none',propertyId:null},{scroll:0})}
 function open(home){detailOrigin.current=document.activeElement;navigate({...routeRef.current,propertyId:home.id},{layer:'detail'})}
 function closeDetail(){if(history.state?.layer==='detail'){history.back()}else{navigate({...route,propertyId:null},{replace:true})};requestAnimationFrame(()=>detailOrigin.current?.focus?.({preventScroll:true}))}
 function openDetails(){if(page==='listing'){setContact(null);window.scrollTo({top:0,behavior:'instant'});return;}navigate({...route,page:'listing'},{layer:'listing',scroll:0});}
 function returnFromListing(){if(history.state?.layer==='listing')history.back();else navigate({...route,page:'results',propertyId:null},{replace:true,scroll:0});}
 function headerAction(action){announce(action==='login'?say('Puedes explorar y simular contactos sin iniciar sesión.','Você pode explorar e simular contatos sem entrar em uma conta.'):action==='agencies'?say('Abre un inmueble para conocer a su anunciante y simular un contacto.','Abra um imóvel para conhecer seu anunciante e simular um contato.'):say('Este prototipo demuestra la búsqueda de inmuebles. La publicación no forma parte de este recorrido.','Este protótipo demonstra a busca de imóveis. A publicação não faz parte deste percurso.'));}
 function toggleSave(home){setSaved(ids=>ids.includes(home.id)?ids.filter(id=>id!==home.id):[...ids,home.id]);announce(t(saved.includes(home.id)?'Se quitó de tus favoritos.':'Guardado. Lo tendremos en cuenta al ordenar tu búsqueda.'))}
 function changeLanguage(next){const updated={...route,search:{...search,note:translateKnownNote(search.note,next)}};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated);setLanguage(next)}
 const exactIds=new Set(matchingHomes(search).map(home=>home.id));
 const visible=prototypeResults(search).sort((a,b)=>Number(exactIds.has(b.id))-Number(exactIds.has(a.id))||((pref==='extra'||pref==='separate')?Number(b.beds>=3)-Number(a.beds>=3):0)||Number(saved.includes(b.id))-Number(saved.includes(a.id))||(exactIds.has(a.id)?listingPrice(a)-listingPrice(b):0));
 const miniProps={activeHome:page==='listing'?(contact?selected:null):selected,onCloseHome:page==='listing'?()=>setContact(null):closeDetail,onDetails:openDetails,profile,onProfile:setProfile,onReceipt:receipt=>setReceipts(current=>[receipt,...current.filter(r=>r.id!==receipt.id)]),contactRequest:contact};
 const barProps={search,onChange:updateSearch,pref,onPref:changePref,onOpen:open,proactive:false,...miniProps};
 return <><HomeHeader results={page!=='home'} onAction={headerAction} onHome={()=>navigate({...routeRef.current,page:'home',propertyId:null},{scroll:0})}/>
 {page==='home'&&selected&&<div className="search-flow-page home-evolution mini-home-context"><SearchBar {...barProps}/></div>}
 <main>{page==='home'?<div inert={!!selected}><Home choices={homeChoices} onChoose={key=>setHomeChoices(current=>key==='template'?{...current,mode:true,propertyType:true}:{...current,[key]:true})} skipIntro={homeIntroDone} onIntroDone={()=>setHomeIntroDone(true)} search={search} setSearch={next=>{const updated={...route,search:typeof next==='function'?next(search):next};history.replaceState(history.state,'',journeyUrl(updated));setRoute(updated)}} onSearch={begin} saved={saved} receipts={receipts} onOpen={open} onLike={toggleSave}/></div>:page==='listing'&&selected?<div className="search-flow-page home-evolution listing-route"><SearchBar {...barProps}/><div inert={!!contact}><PropertyDetail key={selected.id} home={selected} search={search} receipt={receipts.find(r=>r.propertyId===selected.id)} onClose={returnFromListing} onContact={(type,question='')=>setContact({type,question})}/></div></div>:<div className="results-layout"><div className="results-main"><ResultsFlowPage blocked={!!propertyId||!!contact} search={search} onChange={updateSearch} visible={visible} saved={saved} onSave={toggleSave} onOpen={open} receipts={receipts} assistantProps={{search,pref,onPref:changePref,onChange:updateSearch}} miniProps={miniProps}/></div></div>}</main>
 <footer className="site-footer"><span>inmuebles24</span><p>{say('Prototipo V2 · Contacto simulado','Protótipo V2 · Contato simulado')}</p><div className="footer-controls"><select className="footer-language" aria-label={t('Idioma')} value={language} onChange={e=>changeLanguage(e.target.value)}>{languages.map(o=><option key={o.code} value={o.code}>{o.label}</option>)}</select></div></footer>

 {toast&&<div className="toast" role="status"><span>{toast}</span><button className="icon-button" onClick={()=>setToast('')} aria-label={t('Cerrar aviso')}><Icon name="close" size={16}/></button></div>}
 </>;
}
