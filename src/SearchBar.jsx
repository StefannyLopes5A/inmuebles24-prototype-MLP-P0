import React,{useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {BudgetPicker, HomePopover, HomeSearch, LocationSearch} from './HomeSearch';
import {SearchDetails} from './SearchDetails';
import {AllFilters} from './AllFilters';
import {Icon} from './App';
import {PROPERTY_TYPES,OPERATIONS,foldSearchText} from './homeSearchModel';
import {CRITERIA,interpretSmartInput,smartDetailTokens,criterionLabel} from './searchCriteria';
import {areas,homes,listingPrice,propertyPhoto} from './data';
import {expansionOptions,addArea,matchingHomes} from './journey';
import {searchLocations, suggestedLocations, visiblePlaces} from './locationSearch';
import {LocationMenu} from './LocationMenu.jsx';
import {MARKET_TOPICS,marketAnswer,marketQuestion,marketTopic} from './marketAnswers.js';
import {readSeeker,writeSeeker} from './seekerSignals.js';
import {useLanguage,DEMO_MXN_PER_USD} from './i18n';
import {measureBar,animateBar} from './searchFlowMotion';
import {useReducedMotion} from 'motion/react';
import {MoraSignature,MoraWords,wordCount} from './MoraVoice';
import {nextRefineStep,isTooOpen,refineOptions,applyRefineAnswer} from './refineSteps.js';

const chosen={mode:true,propertyType:true,beds:true,area:true,budget:true};
const noop=()=>{};
const asset=name=>`/assets/search-flow/${name}.svg`;
const Chevron=()=> <img className="mora-chevron" src={asset('chevron')} alt=""/>;
function quickFilterVariant(key) {return !key || key.startsWith('criterion:') ? 'amenity' : key;}
function quickFilterKind(key) {return key==='beds' || key==='baths' || key==='parking' || key==='budget' || key==='area' ? key : 'list';}
function quickFilterLabel(key, say) {
  if (!key || key.startsWith('criterion:')) return say('Comodidades','Comodidades');
  if (key==='mode') return say('Quero comprar ou alugar','Quiero comprar o rentar');
  if (key==='propertyType') return say('Tipo de imóvel','Tipo de inmueble');
  if (key==='beds') return say('Número de quartos','Número de recámaras');
  if (key==='baths') return say('Número de banheiros','Número de baños');
  if (key==='parking') return say('Número de vagas','Número de estacionamientos');
  if (key==='area') return say('Localização','Ubicación');
  return say('Orçamento máximo','Presupuesto máximo');
}
// Streets with listings in each operation, so a street only becomes a token where it has something to show.
const STREETS={rent:homes.filter(home=>home.mode==='rent').map(home=>home.street),buy:homes.filter(home=>home.mode!=='rent').map(home=>home.street)};
const streetsFor=search=>STREETS[search?.mode==='rent'?'rent':'buy'];

/** Mora's turn in the bar: signed, the headline inks in, the detail continues its cadence. Replies are local, so there is no thinking line. */
function MoraMessage({headline,detail,note}) {
  const animate=!useReducedMotion();
  return <div className="mora-message" aria-live="polite">
    <MoraSignature/>
    <MoraWords as="h2" text={headline} animate={animate}/>
    {detail&&<MoraWords text={detail} animate={animate} offset={wordCount(headline)}/>}
    {note&&<small className="mora-message-note">{note}</small>}
  </div>;
}

export function SearchBar({search,onChange,pref,onPref,onOpen,blocked=false,proactive=true,request,askPrompt,alert,cue,onCue,chosen={}}) {
  const {language,money,currency}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const [view,setView]=useState('collapsed'),[draft,setDraft]=useState(''),[question,setQuestion]=useState('');
  const [menuRequest,setMenuRequest]=useState(null),[filterMenu,setFilterMenu]=useState(null),[allFilters,setAllFilters]=useState(false);
  const [focused,setFocused]=useState(false),[message,setMessage]=useState('');
  const [filterEdges,setFilterEdges]=useState({start:true,end:true}),[filterPoint,setFilterPoint]=useState({start:false,end:false}),[locationTerm,setLocationTerm]=useState('');
  const [sentenceIntro,setSentenceIntro]=useState(false),[missingStreet,setMissingStreet]=useState('');
  const [refineStep,setRefineStep]=useState(null),refineDone=useRef(new Set()),refineAsked=useRef(false),refineGuide=useRef(false);
  const bar=useRef(null),scroll=useRef(null),filterAnchor=useRef(null),before=useRef(null),animation=useRef(noop),animateNext=useRef(true),trigger=useRef(null);
  const current=useRef({search,view,draft,blocked,proactive});current.current={search,view,draft,blocked:blocked||allFilters,proactive};
  const prompted=useRef({region:false,work:false,moment:readSeeker().asked}), pendingWork=useRef(/home\s*office|trabalhar em casa|trabajar en casa/i.test(search.note));
  const appliedDraft=useRef(''),beforeStreet=useRef(null);
  const lastProcessed=useRef(''),scrollIdle=useRef(null),lastScroll=useRef(window.scrollY);
  const interaction=useRef(noop),pointerFocus=useRef(false),pendingMenu=useRef(null);
  const awaitingSentence=useRef(false),awaitingSurface=useRef(false);
  const options=expansionOptions(search).slice(0,5),matches=matchingHomes(search);
  const tokenMatcher=useCallback(text=>smartDetailTokens(text,search.criteria,streetsFor(search)),[(search.criteria||[]).join('|'),search.mode]);
  const locale=pt?1:2;
  const places=visiblePlaces(search);
  const locationLabel=places.length>1?'Multilocation':places[0]?.label||say('Cidade do México','Ciudad de México');
  const locationChoices=locationTerm.trim().length>=2?searchLocations(locationTerm,8):places.length?places:suggestedLocations(8);
  const filters=[
    ['mode',OPERATIONS.find(([key])=>key===search.mode)?.[locale]],
    ['propertyType',PROPERTY_TYPES.find(([key])=>key===(search.propertyType||'apartment'))?.[locale]],
    ['area',locationLabel],
    ['beds',`${search.beds}+ ${say('quartos','recámaras')}`],
    ['baths',`${search.baths || 1}+ ${say((search.baths || 1) === 1 ? 'banheiro' : 'banheiros', (search.baths || 1) === 1 ? 'baño' : 'baños')}`],
    ...(search.parking ? [['parking',`${search.parking}+ ${say(search.parking === 1 ? 'vaga' : 'vagas', search.parking === 1 ? 'estacionamiento' : 'estacionamientos')}`]] : []),
    ['budget',`${search.minBudget?money(search.minBudget)+' – ':''}${money(search.budget)} ${currency}`],
    ...(search.criteria||[]).map(id=>[`criterion:${id}`,criterionLabel(id,language)]),
    ...(pendingWork.current||pref!=='none'?[['work',say('Home office','Home office')]]:[]),
    ...(search.tour3d?[['tour3d',say('Só com tour 3D','Solo con tour 3D')]]:[]),
  ];
  const filterContents=JSON.stringify([filters,alert?.on]);
  useLayoutEffect(()=>{
    const rail=scroll.current;if(!rail)return;
    const update=()=>setFilterEdges({start:rail.scrollLeft<=1,end:rail.scrollWidth-rail.clientWidth-rail.scrollLeft<=1});
    const resize=new ResizeObserver(update);
    resize.observe(rail);for(const filter of rail.children)resize.observe(filter);
    rail.addEventListener('scroll',update,{passive:true});update();
    return()=>{resize.disconnect();rail.removeEventListener('scroll',update);};
  },[view,filterContents]);
  function transition(next,withMotion=true,from=measureBar(bar.current)) {
    before.current=from;animation.current();animateNext.current=withMotion;setView(next);
  }
  function openPendingMenu() {
    if(awaitingSurface.current||awaitingSentence.current)return;
    const next=pendingMenu.current;pendingMenu.current=null;
    if(next&&current.current.view==='edit'&&!current.current.blocked)setMenuRequest(next);
  }
  function sentenceReady() {awaitingSentence.current=false;openPendingMenu();}
  useLayoutEffect(()=>{
    animation.current=animateBar(bar.current,before.current,animateNext.current,()=>{
      awaitingSurface.current=false;openPendingMenu();
    },!sentenceIntro);
    before.current=null;return()=>animation.current();
  },[view]);
  function closeFilterMenu(restore=false) {
    const anchor=filterAnchor.current;
    setFilterMenu(null);
    if(restore)requestAnimationFrame(()=>anchor?.focus({preventScroll:true}));
  }
  function openQuickFilter(key, event, forceOpen=false) {
    if(key==='work'){expand(key,event.detail>0);return;}
    if(!forceOpen&&filterMenu?.key===key){closeFilterMenu(false);return;}
    filterAnchor.current=event.currentTarget;
    if(key==='area')setLocationTerm('');
    setFilterMenu({key,animate:event.detail>0});
  }
  function pointAtFilters(event) {
    if(event.pointerType==='touch')return;
    const box=event.currentTarget.getBoundingClientRect();
    const x=event.clientX-box.left;
    const zone=88;
    const next={start:x<=zone,end:box.width-x<=zone};
    setFilterPoint(current=>current.start===next.start&&current.end===next.end?current:next);
  }
  function revealFilters(direction) {
    const rail=scroll.current;if(!rail)return;
    const edge=rail.getBoundingClientRect();
    const items=[...rail.querySelectorAll('.mora-filter')];
    const behavior=matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';
    if(direction>0){
      const next=items.find(item=>item.getBoundingClientRect().right>edge.right+1);
      rail.scrollTo({left:next?next.offsetLeft-8:rail.scrollWidth,behavior});
    }else{
      const prev=[...items].reverse().find(item=>item.getBoundingClientRect().left<edge.left-1);
      rail.scrollTo({left:prev?Math.max(0,prev.offsetLeft-rail.clientWidth+prev.offsetWidth+8):0,behavior});
    }
  }
  function removePlace(place) {
    apply({...current.current.search,places:places.filter(item=>item.key!==place.key)});
  }
  function choosePlace(place) {
    const active=places.some(item=>item.key===place.key);
    const next=active?places.filter(item=>item.key!==place.key):place.kind==='city'||place.kind==='state'?[place]:[...places.filter(item=>item.kind!=='city'&&item.kind!=='state'),place];
    apply({...current.current.search,places:next});
    closeFilterMenu(true);
  }
  function applyMode(mode) {
    const active=current.current.search;
    const next={...active,mode};
    if(mode!==active.mode){next.budget=mode==='rent'?28000:7500000;next.minBudget=0;}
    apply(next);
  }
  function applyCriterion(id) {
    const active=current.current.search;
    const opened=filterMenu?.key?.startsWith('criterion:')?filterMenu.key.slice('criterion:'.length):'';
    const criteria=active.criteria||[];
    const next=opened&&opened!==id
      ? criteria.includes(id)?criteria.filter(item=>item!==opened):criteria.map(item=>item===opened?id:item)
      : criteria.includes(id)?criteria.filter(item=>item!==id):[...criteria,id];
    apply({...active,criteria:next});
  }
  function expand(key,withMotion=true) {
    pendingMenu.current=null;setFilterMenu(null);
    trigger.current=document.activeElement;
    if(key==='work'){transition('qualify',withMotion);return;}
    const reveal=view==='collapsed'&&withMotion&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
    awaitingSentence.current=reveal;awaitingSurface.current=view==='collapsed';setSentenceIntro(reveal);
    setFocused(key==='input');
    const next=key&&key!=='input'&&!key.startsWith('criterion:')?{key,animate:withMotion,id:Date.now()}:null;
    if(view==='collapsed'&&next){pendingMenu.current=next;setMenuRequest(null);}
    else setMenuRequest(next);
    transition(key==='input'?'input':'edit',withMotion);
  }
  function collapse(withMotion=true,restoreFocus=true) {
    pendingMenu.current=null;
    awaitingSentence.current=false;setSentenceIntro(false);
    if(['edit','input'].includes(view))process(draft,true,false);
    setFocused(false);setMenuRequest(null);transition('collapsed',withMotion);
    if(restoreFocus)requestAnimationFrame(()=>{const target=trigger.current?.isConnected?trigger.current:bar.current?.querySelector('.mora-smart-trigger');target?.focus({preventScroll:true});});
  }
  interaction.current=event=>{
    if(event.type==='keydown') {
      if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open],.home-popover[data-open="true"]')&&view!=='collapsed'){event.preventDefault();collapse(false);}
      return;
    }
    if(view==='collapsed'||blocked||allFilters||event.target.closest('.home-popover[data-mora-popover="true"]'))return;
    if(!bar.current?.contains(event.target)){collapse(event.type==='click'&&event.detail>0,false);return;}
    if(!event.target.closest('.home-details')) {
      if(['edit','input'].includes(view))process(draft,true,false);
      setFocused(false);
      if(document.activeElement?.closest('.home-details'))document.activeElement.blur();
    }
  };
  useEffect(()=>{if(request)expand(request.key||'input',request.animate!==false);},[request]);
  useEffect(()=>{if(!askPrompt?.text)return;setDraft(askPrompt.text);expand('input');},[askPrompt?.id]);
  // The presenter's guide opens a Mora turn on demand, skipping the scroll pause; each prompt still counts as asked.
  useEffect(()=>{
    if(!cue?.view)return;
    pendingMenu.current=null;awaitingSentence.current=false;setSentenceIntro(false);setFocused(false);setMenuRequest(null);
    trigger.current=null;
    if(cue.view==='answer')setQuestion(marketQuestion('notary',language));
    if(cue.view==='suggest')prompted.current.region=true;
    if(cue.view==='refine'){refineGuide.current=true;refineAsked.current=true;refineDone.current=new Set();setRefineStep(nextRefineStep(current.current.search,{},refineDone.current)||'area');}
    if(cue.view==='qualify'){prompted.current.work=true;pendingWork.current=false;}
    if(cue.view==='moment'){prompted.current.moment=true;writeSeeker({asked:true});}
    transition(cue.view);
    onCue?.();
    // The close button mounts with the expanded surface, a few frames after the view changes.
    let frames=0;
    const focusClose=()=>{
      const close=bar.current?.querySelector('.mora-close');
      if(close)close.focus({preventScroll:true});else if(++frames<30)requestAnimationFrame(focusClose);
    };
    requestAnimationFrame(focusClose);
  },[cue?.id]);
  useEffect(()=>{
    let startedInDetails=false;
    const cancelPointer=()=>{startedInDetails=false;};
    const interrupt=()=>{pendingMenu.current=null;awaitingSentence.current=false;setSentenceIntro(false);};
    const pointer=event=>{if(event.target.closest('.home-skip-intro'))pendingMenu.current=null;else interrupt();pointerFocus.current=true;startedInDetails=!!event.target.closest('.home-details')&&bar.current?.contains(event.target);};
    const keyboard=()=>{interrupt();pointerFocus.current=false;cancelPointer();};
    const handle=event=>{
      if(event.type==='click') {
        const beganInInput=startedInDetails;cancelPointer();
        // Focus moves the editor before pointerup; that same gesture still belongs to the input.
        if(beganInInput)return;
      }
      interaction.current(event);
    };
    const focus=event=>{if(!pointerFocus.current)handle(event);};
    // Wait for click, so releasing input emphasis never moves a control between pointerdown and pointerup.
    document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',keyboard,true);
    document.addEventListener('pointercancel',cancelPointer,true);
    document.addEventListener('click',handle,true);document.addEventListener('focusin',focus);
    window.addEventListener('keydown',handle);
    return()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',keyboard,true);document.removeEventListener('pointercancel',cancelPointer,true);document.removeEventListener('click',handle,true);document.removeEventListener('focusin',focus);window.removeEventListener('keydown',handle);};
  },[]);
  useEffect(()=>()=>{clearTimeout(scrollIdle.current);animation.current();},[]);

  function apply(next) {
    if(JSON.stringify(next)!==JSON.stringify(current.current.search)){current.current.search=next;onChange(next);}
  }
  function process(text,commit=false,allowConversation=true) {
    if(text===lastProcessed.current)return;
    const activeSearch=current.current.search;
    const nextDraft=interpretSmartInput(text,{...activeSearch,criteria:[],note:''},currency,areas,DEMO_MXN_PER_USD,commit,streetsFor(activeSearch));
    if(nextDraft.kind==='question') {
      if(!allowConversation||!commit&&!text.trim().endsWith('?'))return;
      lastProcessed.current=text;setQuestion(text);setFocused(false);
      if(/home\s*office|trabalh|trabaj/.test(foldSearchText(text))) {prompted.current.work=true;transition('qualify');}
      else transition('answer');
      requestAnimationFrame(()=>bar.current?.querySelector('.mora-close')?.focus({preventScroll:true}));
      return;
    }
    if(nextDraft.kind==='street-missing') {
      if(!allowConversation)return;
      lastProcessed.current=text;setMissingStreet(nextDraft.street);setFocused(false);transition('street');
      requestAnimationFrame(()=>bar.current?.querySelector('.mora-close')?.focus({preventScroll:true}));
      return;
    }
    if(nextDraft.kind==='draft')return;
    const previous=appliedDraft.current?interpretSmartInput(appliedDraft.current,{...activeSearch,criteria:[],note:''},currency,areas,DEMO_MXN_PER_USD,true,streetsFor(activeSearch)).search.criteria||[]:[];
    // Deleting a street token gives back the location it replaced, unless the location was changed since.
    const street=beforeStreet.current,restore=street&&activeSearch.address===street.address&&!nextDraft.street?street.location:null;
    const base={...activeSearch,...restore,criteria:(activeSearch.criteria||[]).filter(id=>!previous.includes(id)),note:activeSearch.note.split('; ').filter(part=>part!==appliedDraft.current).join('; ')};
    const parsed=interpretSmartInput(text,base,currency,areas,DEMO_MXN_PER_USD,commit,streetsFor(activeSearch));
    if(parsed.street)beforeStreet.current={address:parsed.search.address,location:street&&activeSearch.address===street.address?street.location:{areas:activeSearch.areas,area:activeSearch.area,address:activeSearch.address}};
    else if(restore||street&&activeSearch.address!==street.address)beforeStreet.current=null;
    lastProcessed.current=text;appliedDraft.current=text;apply(parsed.search);
    pendingWork.current=!!parsed.qualify;
    setMessage(say('Busca atualizada.','Búsqueda actualizada.'));
    if(allowConversation&&commit&&parsed.qualify){prompted.current.work=true;setFocused(false);transition('qualify');requestAnimationFrame(()=>bar.current?.querySelector('.mora-close')?.focus({preventScroll:true}));}
  }
  const isCustomDraft=text=>interpretSmartInput(text,search,currency,areas,DEMO_MXN_PER_USD,false,streetsFor(search)).kind==='draft';

  // A search that arrives too open starts a short Mora conversation: location, operation, type, rooms, price, amenities.
  useEffect(()=>{
    if(refineAsked.current)return;
    const timer=setTimeout(()=>{
      const state=current.current;
      if(refineAsked.current||!state.proactive||state.view!=='collapsed'||state.blocked||pendingWork.current||document.hidden||document.querySelector('dialog[open]'))return;
      if(!isTooOpen(state.search,chosen))return;
      refineAsked.current=true;prompted.current.region=true;
      setRefineStep(nextRefineStep(state.search,chosen,refineDone.current));transition('refine');
    },900);
    return()=>clearTimeout(timer);
  },[]);
  // Prompts follow a pause after actual browsing, never a timer on load or an interrupted edit.
  useEffect(()=>{
    function onScroll() {
      const moved=Math.abs(window.scrollY-lastScroll.current)>24;lastScroll.current=window.scrollY;
      if(!moved||window.scrollY<300)return;
      clearTimeout(scrollIdle.current);
      scrollIdle.current=setTimeout(()=>{
        const state=current.current;
        if(!state.proactive||state.view!=='collapsed'||state.blocked||document.hidden||document.querySelector('dialog[open]')||document.activeElement?.closest('input,[contenteditable],select'))return;
        if(pendingWork.current&&!prompted.current.work){prompted.current.work=true;transition('qualify');}
        else if(!prompted.current.region&&expansionOptions(state.search).length){prompted.current.region=true;transition('suggest');}
        // Once per session, after the region prompt: where the person is in the move. Never asked on load or mid-edit.
        else if(prompted.current.region&&!prompted.current.moment){prompted.current.moment=true;writeSeeker({asked:true});transition('moment');}
      },750);
    }
    window.addEventListener('scroll',onScroll,{passive:true});return()=>{window.removeEventListener('scroll',onScroll);clearTimeout(scrollIdle.current);};
  },[]);
  useEffect(()=>{
    const rail=scroll.current;if(!rail)return;
    const wheel=event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&rail.scrollWidth>rail.clientWidth){const atEdge=event.deltaY<0?rail.scrollLeft<=0:rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-1;if(!atEdge){event.preventDefault();rail.scrollLeft+=event.deltaY;}}};
    rail.addEventListener('wheel',wheel,{passive:false});return()=>rail.removeEventListener('wheel',wheel);
  },[view]);

  function removeCriterion(id) {const activeSearch=current.current.search;apply({...activeSearch,criteria:(activeSearch.criteria||[]).filter(value=>value!==id)});}
  function chooseArea(area) {apply(addArea(search,area));setDraft('');collapse();}
  function chooseWork(kind) {
    pendingWork.current=false;prompted.current.work=true;
    if(kind==='coworking')apply({...search,criteria:[...new Set([...(search.criteria||[]),'coworking'])]});
    else onPref(kind);
    setDraft('');collapse();
  }
  function chooseMoment(move) {
    if(!move){collapse();return;}
    writeSeeker({move});
    if(search.mode!=='rent')transition('credit');else collapse();
  }
  function chooseRefine(step,value) {
    refineDone.current.add(step);
    const next=applyRefineAnswer(step,value,current.current.search);
    apply(next);
    const following=nextRefineStep(next,refineGuide.current?{}:chosen,refineDone.current);
    if(following){before.current=measureBar(bar.current);setRefineStep(following);}else collapse();
  }
  function chooseCredit(credit) {if(credit)writeSeeker({credit});collapse();}
  function askMarket(topic) {setQuestion(marketQuestion(topic,language));transition('answer');}
  const isEditor=view==='edit'||view==='input';
  const market=view==='answer'?marketTopic(question):null;
  const marketReply=market?marketAnswer(market,{mode:search.mode,price:search.budget,language}):null;
  const focusedInput=isEditor&&focused;
  const answerType=/bairro|barrio|zona|onde|donde/.test(foldSearchText(question))?'area':/pre[cç]o|precio|valor|or[cç]amento|presupuesto/.test(foldSearchText(question))?'price':'general';
  const cheapest=[...matches].sort((a,b)=>listingPrice(a)-listingPrice(b))[0];
  return <>
    <section ref={bar} className={`mora-bar ${view!=='collapsed'?'is-expanded':''} ${focusedInput?'is-input-focused':''}`} data-view={view} aria-label={say('Busca e assistência Mora','Búsqueda y asistencia Mora')}>
      <div className="mora-bar-surface" aria-hidden="true"/>
      {view==='collapsed'?<div className="mora-collapsed">
        <button className="mora-smart-trigger" onClick={event=>expand('input',event.detail>0)}><span>{say('Digite para tirar dúvidas ou alterar a busca...','Escribe para resolver dudas o cambiar tu búsqueda...')}</span><Icon name="spark" size={20}/></button>
        <div className="mora-filter-region" data-scroll-end={filterEdges.end}><div className="mora-filter-rail" onPointerMove={pointAtFilters} onPointerLeave={()=>setFilterPoint({start:false,end:false})}><div className="mora-filter-scroll" ref={scroll} role="group" aria-label={say('Filtros da busca; role para ver todos','Filtros de búsqueda; desplázate para ver todos')}>
          {filters.map(([key,label])=>key==='tour3d'?<button className="mora-filter is-removable" key={key} data-search-key={key} onClick={()=>apply({...current.current.search,tour3d:false})} aria-label={`${say('Remover','Quitar')} ${label}`}><span>{label}</span><Icon name="close" size={14}/></button>:<button className="mora-filter" key={key} data-search-key={key} aria-haspopup={key==='work'?undefined:key==='beds'||key==='baths'||key==='parking'||key==='budget'||key==='area'?'dialog':'listbox'} aria-expanded={key==='work'?false:filterMenu?.key===key} onClick={event=>openQuickFilter(key,event)} onKeyDown={event=>{if(event.key==='ArrowDown'&&key!=='work'){event.preventDefault();openQuickFilter(key,event,true);}}}><span>{label}</span><Chevron/></button>)}
        </div>{!filterEdges.start&&<button type="button" className={`mora-filter-nav is-prev${filterPoint.start?' is-shown':''}`} aria-label={say('Ver filtros anteriores','Ver filtros anteriores')} onClick={()=>revealFilters(-1)}><Chevron/></button>}{!filterEdges.end&&<button type="button" className={`mora-filter-nav is-next${filterPoint.end?' is-shown':''}`} aria-label={say('Ver mais filtros','Ver más filtros')} onClick={()=>revealFilters(1)}><Chevron/></button>}</div><button className="mora-more" onClick={()=>setAllFilters(true)}><img src={asset('tune')} alt=""/>{say('Mais filtros','Más filtros')}</button></div>
        {alert&&<button className={`btn-secondary mora-save ${alert.on?'is-on':''}`} aria-pressed={alert.on} onClick={alert.onToggle}>{alert.on?say('Busca salva','Búsqueda guardada'):say('Salvar busca','Guardar búsqueda')}</button>}
      </div>:<div className={`mora-expanded ${isEditor?'mora-editor':'mora-conversation'}`}>
        <button className="mora-close" aria-label={say('Recolher barra de busca','Contraer barra de búsqueda')} onClick={event=>collapse(event.detail>0)}><img src={asset('close')} alt=""/></button>
        {isEditor?<>
          <HomeSearch variant="results" search={search} setSearch={apply} choices={chosen} onChoose={noop} skipIntro={!sentenceIntro} onIntroDone={sentenceReady} onSubmit={()=>process(draft,true)} openRequest={menuRequest}
            extraContent={(search.criteria||[]).map(id=><button key={id} className="home-word-control is-chosen mora-extra-term" data-search-key={`criterion:${id}`} onClick={()=>removeCriterion(id)} aria-label={`${say('Remover','Quitar')} ${criterionLabel(id,language)}`}>{criterionLabel(id,language).toLowerCase()}<Icon name="close" size={24}/></button>)}
            detailContent={<SearchDetails value={draft} onChange={setDraft} language={language} placeholder={say('Digite para tirar dúvidas ou alterar a busca...','Escribe para resolver dudas o cambiar tu búsqueda...')} mobilePlaceholder={say('O que você procura ou quer saber?','¿Qué buscas o quieres saber?')} label={say('Pergunte ou altere sua busca','Pregunta o cambia tu búsqueda')} onSubmit={text=>process(text,true)} onSettle={text=>process(text,isCustomDraft(text))} settleDelay={text=>isCustomDraft(text)?1400:650} onFocus={()=>setFocused(true)} autoFocus={view==='input'} tokenMatcher={tokenMatcher}/>}/>
          <span className="sr-only" role="status">{message}</span>
        </>:<>
          {marketReply?<MoraMessage key={view+question} headline={marketReply.headline} detail={marketReply.detail} note={marketReply.note}/>
          :view==='moment'?<MoraMessage key={view} headline={say('Quer se mudar logo ou ainda está olhando?','¿Quieres mudarte pronto o todavía estás viendo?')} detail={say('Assim a imobiliária sabe como te atender. Não muda seus filtros.','Así la inmobiliaria sabe cómo atenderte. No cambia tus filtros.')}/>
          :view==='refine'&&refineStep?<MoraMessage key={view+refineStep} headline={{area:say('Em qual região você quer morar?','¿En qué zona quieres vivir?'),mode:say('Você quer comprar ou alugar?','¿Quieres comprar o rentar?'),propertyType:say('Que tipo de imóvel você procura?','¿Qué tipo de inmueble buscas?'),beds:say('Quantos quartos você precisa?','¿Cuántas recámaras necesitas?'),budget:say('Qual o valor máximo que você quer pagar?','¿Cuál es el máximo que quieres pagar?'),criteria:say('Algo que não pode faltar?','¿Algo que no puede faltar?')}[refineStep]} detail={say('Cada resposta ajusta seus filtros.','Cada respuesta ajusta tus filtros.')}/>
          :view==='credit'?<MoraMessage key={view} headline={say('Já tem financiamento, vai pagar à vista, ou ainda não chegou nisso?','¿Ya tienes crédito, vas de contado, o aún no llegas a eso?')} detail={say('Só vai junto quando você pedir contato.','Solo va cuando pidas contacto.')}/>
          :view==='street'?<MoraMessage key={view+missingStreet} headline={say(`Não há anúncios em ${missingStreet}.`,`No hay anuncios en ${missingStreet}.`)} detail={say('Posso buscar em bairros próximos da sua busca.','Puedo buscar en colonias cercanas a tu búsqueda.')}/>
          :<MoraMessage key={view+question} headline={view==='suggest'?say('Você também pode gostar de imóveis nesses bairros.','También podrían gustarte inmuebles en estos barrios.'):view==='qualify'?say('Como você gostaria de trabalhar em casa?','¿Cómo te gustaría trabajar en casa?'):answerType==='area'?say('Vamos explorar os bairros dentro da sua busca.','Exploremos los barrios dentro de tu búsqueda.'):answerType==='price'&&cheapest?say(`As opções começam em ${money(listingPrice(cheapest))} ${currency}.`,`Las opciones empiezan en ${money(listingPrice(cheapest))} ${currency}.`):matches.length?say(`Encontrei ${matches.length} imóveis dentro dos seus filtros.`,`Encontré ${matches.length} inmuebles dentro de tus filtros.`):say('Podemos ajustar sua busca para encontrar mais opções.','Podemos ajustar tu búsqueda para encontrar más opciones.')}
            detail={view==='qualify'?say('Quer um canto para trabalhar ou um ambiente só para isso?','¿Buscas un rincón para trabajar o un ambiente solo para eso?'):view==='answer'?(answerType==='area'?say('Você pode incluir outro bairro mantendo o orçamento e os demais filtros.','Puedes incluir otro barrio manteniendo el presupuesto y los demás filtros.'):say('Posso ajudar com preços, bairros e filtros. Os detalhes de planta e disponibilidade precisam ser confirmados no anúncio.','Puedo ayudar con precios, barrios y filtros. Confirma la distribución y disponibilidad en el anuncio.')):null}/>}
          <div className="mora-replies">
            {marketReply&&<>{MARKET_TOPICS.filter(topic=>topic!==market).map(topic=><button className="mora-pill" key={topic} onClick={()=>askMarket(topic)}>{marketQuestion(topic,language)}</button>)}<button className="mora-pill mora-pill-quiet" onClick={()=>collapse()}>{say('Continuar explorando','Seguir explorando')}</button></>}
            {view==='refine'&&refineStep&&<>{refineOptions(refineStep,search,language).map(option=><button className="mora-pill mora-pill-quiet" key={option.value.key||option.value} onClick={()=>chooseRefine(refineStep,option.value)}>{option.amount?`${money(option.value)} ${currency}`:option.label}</button>)}<button className="mora-pill mora-pill-quiet" onClick={()=>collapse()}>{say('Agora não','Ahora no')}</button></>}
            {view==='moment'&&<><button className="mora-pill" onClick={()=>chooseMoment('asap')}>{say('O quanto antes','Lo antes posible')}</button><button className="mora-pill" onClick={()=>chooseMoment('months')}>{say('Nos próximos meses','En los próximos meses')}</button><button className="mora-pill" onClick={()=>chooseMoment('exploring')}>{say('Só estou explorando','Solo estoy explorando')}</button><button className="mora-pill mora-pill-quiet" onClick={()=>chooseMoment(null)}>{say('Agora não','Ahora no')}</button></>}
            {view==='credit'&&<><button className="mora-pill" onClick={()=>chooseCredit('credit')}>{say('Com financiamento','Con crédito')}</button><button className="mora-pill" onClick={()=>chooseCredit('cash')}>{say('À vista','De contado')}</button><button className="mora-pill" onClick={()=>chooseCredit('open')}>{say('Ainda não cheguei nisso','Aún no llego a eso')}</button><button className="mora-pill mora-pill-quiet" onClick={()=>chooseCredit(null)}>{say('Agora não','Ahora no')}</button></>}
            {view==='street'&&<>{options.map(option=><button className="mora-pill" key={option.area} onClick={()=>chooseArea(option.area)}>{option.area}<span>+{option.additional}</span></button>)}<button className="mora-pill" onClick={()=>expand('area')}>{say('Escolher bairros','Elegir colonias')}</button><button className="mora-pill mora-pill-quiet" onClick={()=>collapse()}>{say('Nenhuma dessas opções','Ninguna de estas opciones')}</button></>}
            {!market&&(view==='suggest'||view==='answer'&&answerType==='area')&&<>{options.map(option=><button className="mora-pill" key={option.area} onClick={()=>chooseArea(option.area)}>{option.area}<span>+{option.additional}</span></button>)}{!options.length&&<button className="mora-pill" onClick={()=>expand('area')}>{say('Escolher bairros','Elegir barrios')}</button>}<button className="mora-pill mora-pill-quiet" onClick={()=>collapse()}>{say('Nenhuma dessas opções','Ninguna de estas opciones')}</button></>}
            {view==='qualify'&&<><button className="mora-pill" onClick={()=>chooseWork('open')}>{say('Um canto na sala','Un rincón en la sala')}</button><button className="mora-pill" onClick={()=>chooseWork('extra')}>{say('Um quarto dedicado ao trabalho','Una recámara para trabajar')}</button><button className="mora-pill" onClick={()=>chooseWork('coworking')}>{say('Condomínio com coworking','Edificio con coworking')}</button><button className="mora-pill mora-pill-quiet" onClick={()=>chooseWork('none')}>{say('Não sei ainda','Aún no lo sé')}</button></>}
            {!market&&view==='answer'&&answerType!=='area'&&<>{cheapest&&<button className="mora-mini-listing" onClick={()=>{collapse(false,false);onOpen(cheapest);}}><img src={propertyPhoto(cheapest)} alt=""/><span><strong>{money(listingPrice(cheapest))} {currency}</strong><span>{cheapest.street} · {cheapest.area}</span></span><Icon name="arrow"/></button>}<button className="mora-pill" onClick={()=>expand('budget')}>{say('Ajustar orçamento','Ajustar presupuesto')}</button><button className="mora-pill" onClick={()=>{prompted.current.region=true;transition('suggest');}}>{say('Explorar bairros','Explorar barrios')}</button><button className="mora-pill mora-pill-quiet" onClick={()=>collapse()}>{say('Continuar explorando','Seguir explorando')}</button></>}
          </div>
        </>}
      </div>}
      {view==='collapsed' && <HomePopover open={!!filterMenu} animate={filterMenu?.animate!==false} anchor={filterAnchor.current} label={quickFilterLabel(filterMenu?.key, say)} kind={quickFilterKind(filterMenu?.key)} variant={quickFilterVariant(filterMenu?.key)} onClose={restore=>closeFilterMenu(restore)}>
        {(filterMenu?.key==='mode'?OPERATIONS:filterMenu?.key==='propertyType'?PROPERTY_TYPES:[]).map(([option,ptLabel,esLabel])=><button type="button" className="home-option" role="option" aria-selected={option===(filterMenu.key==='mode'?search.mode:(search.propertyType||'apartment'))} key={option} onClick={()=>{if(filterMenu.key==='mode')applyMode(option);else apply({...current.current.search,propertyType:option});closeFilterMenu(true);}}>{say(ptLabel,esLabel)}</button>)}
        {filterMenu?.key?.startsWith('criterion:') && CRITERIA.map(item=><button type="button" className="home-option" role="option" aria-selected={(search.criteria||[]).includes(item.id)} key={item.id} onClick={()=>{applyCriterion(item.id);closeFilterMenu(true);}}>{criterionLabel(item.id,language)}</button>)}
        {filterMenu?.key==='beds' && <div className="home-bed-stepper"><button type="button" className="home-step" disabled={search.beds<=1} aria-label={say('Diminuir quartos','Reducir recámaras')} onClick={()=>apply({...current.current.search,beds:Math.max(1,search.beds-1)})}><img src="/assets/home-evolution/minus.svg" alt=""/></button><output aria-live="polite">{search.beds}+</output><button type="button" className="home-step" disabled={search.beds>=10} aria-label={say('Aumentar quartos','Aumentar recámaras')} onClick={()=>apply({...current.current.search,beds:Math.min(10,search.beds+1)})}><img src="/assets/home-evolution/plus.svg" alt=""/></button></div>}
        {filterMenu?.key==='baths' && <div className="home-bed-stepper"><button type="button" className="home-step" disabled={(search.baths||1)<=1} aria-label={say('Diminuir banheiros','Reducir baños')} onClick={()=>apply({...current.current.search,baths:Math.max(1,(search.baths||1)-1)})}><img src="/assets/home-evolution/minus.svg" alt=""/></button><output aria-live="polite">{search.baths||1}+</output><button type="button" className="home-step" disabled={(search.baths||1)>=10} aria-label={say('Aumentar banheiros','Aumentar baños')} onClick={()=>apply({...current.current.search,baths:Math.min(10,(search.baths||1)+1)})}><img src="/assets/home-evolution/plus.svg" alt=""/></button></div>}
        {filterMenu?.key==='parking' && <div className="home-bed-stepper"><button type="button" className="home-step" disabled={search.parking<=1} aria-label={say('Diminuir vagas','Reducir estacionamientos')} onClick={()=>apply({...current.current.search,parking:Math.max(1,search.parking-1)})}><img src="/assets/home-evolution/minus.svg" alt=""/></button><output aria-live="polite">{search.parking}+</output><button type="button" className="home-step" disabled={search.parking>=6} aria-label={say('Aumentar vagas','Aumentar estacionamientos')} onClick={()=>apply({...current.current.search,parking:Math.min(6,search.parking+1)})}><img src="/assets/home-evolution/plus.svg" alt=""/></button></div>}
        {filterMenu?.key==='area' && <><LocationSearch label={say('Buscar localização','Buscar ubicación')} placeholder={say('Bairro, rua, metrô, escola…','Colonia, calle, metro, escuela…')} clearLabel={say('Limpar localização','Borrar ubicación')} value={locationTerm} onChange={setLocationTerm}/><LocationMenu label={say('Localização','Ubicación')} places={locationChoices} selectedKeys={places.map(place=>place.key)} say={say} onChoose={choosePlace} onRemove={removePlace} empty={locationTerm.trim().length>=2 && !locationChoices.length ? say('Nenhum lugar encontrado. Tente outro nome.','No encontramos ese lugar. Prueba otro nombre.') : null}/></>}
        {filterMenu?.key==='budget' && <BudgetPicker search={search} say={say} onChange={values=>apply({...current.current.search,...values})}/>}
      </HomePopover>}
      <div className="mora-bar-divider" aria-hidden="true"/>
    </section>
    {allFilters&&<AllFilters search={search} onChange={apply} onClose={()=>setAllFilters(false)} onSmartInput={()=>expand('input')}/>}
  </>;
}
