import React,{useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {HomeSearch} from './HomeSearch';
import {SearchDetails} from './SearchDetails';
import {AllFilters} from './AllFilters';
import {MiniListing} from './MiniListing';
import {Icon} from './App';
import {PROPERTY_TYPES,OPERATIONS,foldSearchText} from './homeSearchModel';
import {interpretSmartInput,smartDetailTokens,criterionLabel} from './searchCriteria';
import {areas,listingPrice,propertyPhoto} from './data';
import {expansionOptions,addArea,matchingHomes} from './journey';
import {useLanguage,DEMO_MXN_PER_USD} from './i18n';
import {measureBar,animateBar} from './searchFlowMotion';

const chosen={mode:true,propertyType:true,beds:true,area:true,budget:true};
const noop=()=>{};
const asset=name=>`/assets/search-flow/${name}.svg`;
const Chevron=()=> <img className="mora-chevron" src={asset('chevron')} alt=""/>;

export function SearchBar({search,onChange,pref,onPref,onOpen,blocked=false,proactive=true,request,askPrompt,activeHome,onCloseHome,onDetails,profile,onProfile,onReceipt,contactRequest}) {
  const {language,money,currency}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const [view,setView]=useState(activeHome?'listing':'collapsed'),[draft,setDraft]=useState(''),[question,setQuestion]=useState('');
  const [menuRequest,setMenuRequest]=useState(null),[allFilters,setAllFilters]=useState(false);
  const [focused,setFocused]=useState(false),[message,setMessage]=useState('');
  const [filtersAtEnd,setFiltersAtEnd]=useState(true);
  const [sentenceIntro,setSentenceIntro]=useState(false);
  const bar=useRef(null),scroll=useRef(null),before=useRef(null),animation=useRef(noop),animateNext=useRef(true),trigger=useRef(null),settledSize=useRef(null);
  const current=useRef({search,view,draft,blocked,proactive});current.current={search,view,draft,blocked:blocked||allFilters||!!activeHome,proactive};
  const prompted=useRef({region:false,work:false}), pendingWork=useRef(/home\s*office|trabalhar em casa|trabajar en casa/i.test(search.note));
  const appliedDraft=useRef('');
  const lastProcessed=useRef(''),scrollIdle=useRef(null),lastScroll=useRef(window.scrollY);
  const interaction=useRef(noop),pointerFocus=useRef(false),pendingMenu=useRef(null);
  const awaitingSentence=useRef(false),awaitingSurface=useRef(false);
  const options=expansionOptions(search).slice(0,5),matches=matchingHomes(search);
  const tokenMatcher=useCallback(text=>smartDetailTokens(text,search.criteria),[(search.criteria||[]).join('|')]);
  const locale=pt?1:2;
  const filters=[
    ['mode',OPERATIONS.find(([key])=>key===search.mode)?.[locale]],
    ['propertyType',PROPERTY_TYPES.find(([key])=>key===(search.propertyType||'apartment'))?.[locale]],
    ['beds',`${search.beds}+ ${say('quartos','recámaras')}`],
    ['area',search.areas.length>1?`${search.areas[0]} +${search.areas.length-1}`:search.areas[0]||say('Cidade do México','Ciudad de México')],
    ['budget',`${search.minBudget?money(search.minBudget)+' – ':''}${money(search.budget)} ${currency}`],
    ...(search.criteria||[]).map(id=>[`criterion:${id}`,criterionLabel(id,language)]),
    ...(pendingWork.current||pref!=='none'?[['work',say('Home office','Home office')]]:[]),
  ];
  const filterContents=JSON.stringify(filters);
  useLayoutEffect(()=>{
    const rail=scroll.current;if(!rail)return;
    const update=()=>setFiltersAtEnd(rail.scrollWidth-rail.clientWidth-rail.scrollLeft<=1);
    const resize=new ResizeObserver(update);
    resize.observe(rail);for(const filter of rail.children)resize.observe(filter);
    rail.addEventListener('scroll',update,{passive:true});update();
    return()=>{resize.disconnect();rail.removeEventListener('scroll',update);};
  },[view,filterContents]);
  useLayoutEffect(()=>{
    const observer=new ResizeObserver(()=>{settledSize.current={height:bar.current.getBoundingClientRect().height};});
    if(bar.current)observer.observe(bar.current);
    return()=>observer.disconnect();
  },[]);
  function transition(next,withMotion=true,from=measureBar(bar.current)) {
    before.current=from;animation.current();animateNext.current=withMotion;setView(next);
  }
  useLayoutEffect(()=>{
    if(activeHome){setAllFilters(false);setMenuRequest(null);setFocused(false);transition('listing',true,settledSize.current||{height:0});}
    else if(current.current.view==='listing')transition('collapsed',true,settledSize.current);
  },[activeHome?.id]);
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
  function expand(key,withMotion=true) {
    pendingMenu.current=null;
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
    if(activeHome){onCloseHome();return;}
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
    if(view==='collapsed'||activeHome||blocked||allFilters||event.target.closest('.home-popover[data-mora-popover="true"]'))return;
    if(!bar.current?.contains(event.target)){collapse(event.type==='click'&&event.detail>0,false);return;}
    if(!event.target.closest('.home-details')) {
      if(['edit','input'].includes(view))process(draft,true,false);
      setFocused(false);
      if(document.activeElement?.closest('.home-details'))document.activeElement.blur();
    }
  };
  useEffect(()=>{if(request)expand(request.key||'input',request.animate!==false);},[request]);
  useEffect(()=>{if(!askPrompt?.text)return;setDraft(askPrompt.text);expand('input');},[askPrompt?.id]);
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
    const nextDraft=interpretSmartInput(text,{...activeSearch,criteria:[],note:''},currency,areas,DEMO_MXN_PER_USD,commit);
    if(nextDraft.kind==='question') {
      if(!allowConversation||!commit&&!text.trim().endsWith('?'))return;
      lastProcessed.current=text;setQuestion(text);setFocused(false);
      if(/home\s*office|trabalh|trabaj/.test(foldSearchText(text))) {prompted.current.work=true;transition('qualify');}
      else transition('answer');
      requestAnimationFrame(()=>bar.current?.querySelector('.mora-close')?.focus({preventScroll:true}));
      return;
    }
    if(nextDraft.kind==='draft')return;
    const previous=appliedDraft.current?interpretSmartInput(appliedDraft.current,{...activeSearch,criteria:[],note:''},currency,areas,DEMO_MXN_PER_USD,true).search.criteria||[]:[];
    const base={...activeSearch,criteria:(activeSearch.criteria||[]).filter(id=>!previous.includes(id)),note:activeSearch.note.split('; ').filter(part=>part!==appliedDraft.current).join('; ')};
    const parsed=interpretSmartInput(text,base,currency,areas,DEMO_MXN_PER_USD,commit);
    lastProcessed.current=text;appliedDraft.current=text;apply(parsed.search);
    pendingWork.current=!!parsed.qualify;
    setMessage(say('Busca atualizada.','Búsqueda actualizada.'));
    if(allowConversation&&commit&&parsed.qualify){prompted.current.work=true;setFocused(false);transition('qualify');requestAnimationFrame(()=>bar.current?.querySelector('.mora-close')?.focus({preventScroll:true}));}
  }
  const isCustomDraft=text=>interpretSmartInput(text,search,currency,areas,DEMO_MXN_PER_USD).kind==='draft';

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
  const isEditor=view==='edit'||view==='input';
  const focusedInput=isEditor&&focused;
  const answerType=/bairro|barrio|zona|onde|donde/.test(foldSearchText(question))?'area':/pre[cç]o|precio|valor|or[cç]amento|presupuesto/.test(foldSearchText(question))?'price':'general';
  const cheapest=[...matches].sort((a,b)=>listingPrice(a)-listingPrice(b))[0];
  return <>
    {activeHome&&<button className="mini-backdrop" onClick={onCloseHome} tabIndex={-1} aria-label={say('Fechar resumo do imóvel','Cerrar resumen del inmueble')}/>}
    <section ref={bar} className={`mora-bar ${view!=='collapsed'?'is-expanded':''} ${focusedInput?'is-input-focused':''} ${activeHome?'has-mini-listing':''}`} data-view={activeHome?'listing':view} aria-label={say('Busca e assistência Mora','Búsqueda y asistencia Mora')}>
      <div className="mora-bar-surface" aria-hidden="true"/>
      {activeHome?<MiniListing key={`${activeHome.id}-${contactRequest?.type||'summary'}`} home={activeHome} search={search} pref={pref} profile={profile} onProfile={onProfile} onReceipt={onReceipt} onClose={onCloseHome} onDetails={onDetails} initialAction={contactRequest}/>:view==='collapsed'||view==='listing'?<div className="mora-collapsed">
        <div className="mora-filter-region" data-scroll-end={filtersAtEnd}><div className="mora-filter-scroll" ref={scroll} role="group" aria-label={say('Filtros da busca; role para ver todos','Filtros de búsqueda; desplázate para ver todos')}>
          {filters.map(([key,label])=><button className="mora-filter" key={key} data-search-key={key} onClick={event=>expand(key,event.detail>0)} aria-expanded="false"><span>{label}</span><Chevron/></button>)}
        </div><button className="mora-more" onClick={()=>setAllFilters(true)}>{say('Mais filtros','Más filtros')}<Chevron/></button></div>
        <button className="mora-smart-trigger" onClick={event=>expand('input',event.detail>0)}><span>{say('Digite para tirar dúvidas ou alterar a busca...','Escribe para resolver dudas o cambiar tu búsqueda...')}</span><Icon name="spark" size={20}/></button>
      </div>:<div className={`mora-expanded ${isEditor?'mora-editor':'mora-conversation'}`}>
        <button className="mora-close" aria-label={say('Recolher barra de busca','Contraer barra de búsqueda')} onClick={event=>collapse(event.detail>0)}><img src={asset('close')} alt=""/></button>
        {isEditor?<>
          <HomeSearch variant="results" search={search} setSearch={apply} choices={chosen} onChoose={noop} skipIntro={!sentenceIntro} onIntroDone={sentenceReady} onSubmit={()=>process(draft,true)} openRequest={menuRequest}
            extraContent={(search.criteria||[]).map(id=><button key={id} className="home-word-control is-chosen mora-extra-term" data-search-key={`criterion:${id}`} onClick={()=>removeCriterion(id)} aria-label={`${say('Remover','Quitar')} ${criterionLabel(id,language)}`}>{criterionLabel(id,language).toLowerCase()}<Icon name="close" size={24}/></button>)}
            detailContent={<SearchDetails value={draft} onChange={setDraft} language={language} placeholder={say('Digite para tirar dúvidas ou alterar a busca...','Escribe para resolver dudas o cambiar tu búsqueda...')} mobilePlaceholder={say('O que você procura ou quer saber?','¿Qué buscas o quieres saber?')} label={say('Pergunte ou altere sua busca','Pregunta o cambia tu búsqueda')} onSubmit={text=>process(text,true)} onSettle={text=>process(text,isCustomDraft(text))} settleDelay={text=>isCustomDraft(text)?1400:650} onFocus={()=>setFocused(true)} autoFocus={view==='input'} tokenMatcher={tokenMatcher}/>}/>
          <span className="sr-only" role="status">{message}</span>
        </>:<>
          <div className="mora-message"><div className="mora-name"><img src={asset('mora')} alt=""/>Mora</div>
            <h2>{view==='suggest'?say('Você também pode gostar de imóveis nesses bairros.','También podrían gustarte inmuebles en estos barrios.'):view==='qualify'?say('Como você gostaria de trabalhar em casa?','¿Cómo te gustaría trabajar en casa?'):answerType==='area'?say('Vamos explorar os bairros dentro da sua busca.','Exploremos los barrios dentro de tu búsqueda.'):answerType==='price'&&cheapest?say(`As opções começam em ${money(listingPrice(cheapest))} ${currency}.`,`Las opciones empiezan en ${money(listingPrice(cheapest))} ${currency}.`):matches.length?say(`Encontrei ${matches.length} imóveis dentro dos seus filtros.`,`Encontré ${matches.length} inmuebles dentro de tus filtros.`):say('Podemos ajustar sua busca para encontrar mais opções.','Podemos ajustar tu búsqueda para encontrar más opciones.')}</h2>
            {view==='qualify'&&<p>{say('Quer um canto para trabalhar ou um ambiente só para isso?','¿Buscas un rincón para trabajar o un ambiente solo para eso?')}</p>}
            {view==='answer'&&<p>{answerType==='area'?say('Você pode incluir outro bairro mantendo o orçamento e os demais filtros.','Puedes incluir otro barrio manteniendo el presupuesto y los demás filtros.'):say('Posso ajudar com preços, bairros e filtros. Os detalhes de planta e disponibilidade precisam ser confirmados no anúncio.','Puedo ayudar con precios, barrios y filtros. Confirma la distribución y disponibilidad en el anuncio.')}</p>}
          </div>
          <div className="mora-replies">
            {(view==='suggest'||view==='answer'&&answerType==='area')&&<>{options.map(option=><button className="mora-pill" key={option.area} onClick={()=>chooseArea(option.area)}>{option.area}<span>+{option.additional}</span></button>)}{!options.length&&<button className="mora-pill" onClick={()=>expand('area')}>{say('Escolher bairros','Elegir barrios')}</button>}<button className="mora-pill mora-pill-quiet" onClick={()=>collapse()}>{say('Nenhuma dessas opções','Ninguna de estas opciones')}</button></>}
            {view==='qualify'&&<><button className="mora-pill" onClick={()=>chooseWork('open')}>{say('Um canto na sala','Un rincón en la sala')}</button><button className="mora-pill" onClick={()=>chooseWork('extra')}>{say('Um quarto dedicado ao trabalho','Una recámara para trabajar')}</button><button className="mora-pill" onClick={()=>chooseWork('coworking')}>{say('Condomínio com coworking','Edificio con coworking')}</button><button className="mora-pill mora-pill-quiet" onClick={()=>chooseWork('none')}>{say('Não sei ainda','Aún no lo sé')}</button></>}
            {view==='answer'&&answerType!=='area'&&<>{cheapest&&<button className="mora-mini-listing" onClick={()=>onOpen(cheapest)}><img src={propertyPhoto(cheapest)} alt=""/><span><strong>{money(listingPrice(cheapest))} {currency}</strong><span>{cheapest.street} · {cheapest.area}</span></span><Icon name="arrow"/></button>}<button className="mora-pill" onClick={()=>expand('budget')}>{say('Ajustar orçamento','Ajustar presupuesto')}</button><button className="mora-pill" onClick={()=>{prompted.current.region=true;transition('suggest');}}>{say('Explorar bairros','Explorar barrios')}</button><button className="mora-pill mora-pill-quiet" onClick={()=>collapse()}>{say('Continuar explorando','Seguir explorando')}</button></>}
          </div>
        </>}
      </div>}
      <div className="mora-bar-divider" aria-hidden="true"/>
    </section>
    {allFilters&&<AllFilters search={search} onChange={apply} onClose={()=>setAllFilters(false)} onSmartInput={()=>expand('input')}/>}
  </>;
}
