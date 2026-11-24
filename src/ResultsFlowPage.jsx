import React,{Suspense,lazy,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {SearchBar} from './SearchBar';
import {HouseCard} from './Home';
import {NeighborhoodRail} from './NeighborhoodRail.jsx';
import {NearbyResults} from './NearbyResults.jsx';
import {PriceInsights} from './PriceInsights.jsx';
import {RegionInsights} from './RegionInsights.jsx';
import {NearbyPlaces} from './NearbyPlaces.jsx';
import {CostOfLiving} from './CostOfLiving.jsx';
import {SearchFaq} from './SearchFaq.jsx';
import {HomeInternalLinks} from './HomeInternalLinks.jsx';
import {Icon} from './App';
import {useLanguage} from './i18n';
import {matchingHomes,pinShowcaseDevelopments,selectedAreas,spreadTourListings} from './journey';
import {homes,listingPrice} from './data';
import {PROPERTY_TYPES} from './homeSearchModel';
import {installHomeMotion} from './homeMotion';
import {playHomeTransition} from './searchFlowMotion';
import {HomePopover} from './HomeSearch';
import {SORTS,canonicalSort,sortLabel,sortResults,sortSignal} from './resultSort';
import {ResultsPager} from './ResultsPager.jsx';
import {resultsPageSize} from './resultsPager.js';

const SearchMap=lazy(()=>import('./SearchMap.jsx'));
const SPLIT_MIN = 951;
const REFLOW_OUT = 120;

const viewportWidth=()=>typeof window === 'undefined' ? 1512 : document.documentElement.clientWidth;

function gridColumns(width, layout) {
  if (layout === 'half') return width > 1200 ? 2 : 1;
  if (width <= 700) return 1;
  if (width <= 950) return 2;
  if (width <= 1200) return 3;
  return 4;
}

function resultsHeading(search, say, language) {
  const pt = language === 'pt-BR';
  const typeId = search.propertyType || 'apartment';
  const type = PROPERTY_TYPES.find(([id]) => id === typeId) || PROPERTY_TYPES[0];
  const operation = {rent:['Aluguel','Renta'], development:['Empreendimentos','Desarrollos'], auction:['Leilão','Remate']}[search.mode] || ['Venda','Venta'];
  const areas = selectedAreas(search).filter(area => area !== 'Ambas zonas');
  const city = say('Cidade do México','Ciudad de México');
  const place = areas.length === 1 ? areas[0] : areas.length > 1 ? `${areas[0]} +${areas.length - 1}` : '';
  const beds = search.beds || 1;
  const rooms = pt ? `${beds} ${beds === 1 ? 'quarto' : 'quartos'}` : `${beds} ${beds === 1 ? 'recámara' : 'recámaras'}`;
  const crumbs = [say(operation[0], operation[1]), say(type[1], type[2]), city, ...(place ? [place] : []), ...(search.address ? [search.address] : []), rooms];
  const titled = areas.length === 1 ? areas[0] : city;
  return {crumbs, title:say(`Imóveis em ${titled}`, `Inmuebles en ${titled}`)};
}

/** Homes outside the current search, preferring other neighborhoods. The carousel stays local and simulated. */
function nearbyListings(search, visible) {
  const shown = new Set(visible.map(home => home.id));
  const areas = new Set(selectedAreas(search).filter(area => area && area !== 'Ambas zonas'));
  const mode = search.mode === 'rent' || search.mode === 'buy' ? search.mode : null;
  const pool = homes.filter(home => !home.development && !shown.has(home.id) && (!mode || home.mode === mode));
  const outside = areas.size ? pool.filter(home => home.area && !areas.has(home.area)) : [];
  const list = outside.length >= 4 ? outside : pool;
  return list.slice().sort((a, b) => listingPrice(b) - listingPrice(a) || String(a.street).localeCompare(String(b.street), 'es')).slice(0, 12);
}

function mapAreaLabel(search, say) {
  const areas=selectedAreas(search).filter(area=>area!=='Ambas zonas');
  if (!areas.length && search.address) return `${search.address}, CDMX`;
  if (!areas.length) return say('Cidade do México','Ciudad de México');
  return areas.length===1 ? `${areas[0]}, CDMX` : `${areas[0]} +${areas.length-1}`;
}

/** Results order, in the bar's filter style. Favorites are reached from the heart, the toast and the avatar. */
function SortControl({sort,onSort,language,say}) {
  const anchor=useRef(null),[open,setOpen]=useState(false),[menuMotion,setMenuMotion]=useState(true);
  const close=(restore=false,animate=true)=>{setMenuMotion(animate);setOpen(false);if(restore)anchor.current?.focus({preventScroll:true});};
  const label=sortLabel(sort,language);
  return <>
    <button ref={anchor} type="button" className="mora-filter flow-sort" aria-haspopup="listbox" aria-expanded={open} aria-label={`${say('Ordenar por','Ordenar por')}: ${label}`}
      onClick={event=>{setMenuMotion(event.detail>0);setOpen(current=>!current);}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setMenuMotion(false);setOpen(true);}}}>
      <span>{label}</span><img className="mora-chevron" src="/assets/search-flow/chevron.svg" alt=""/>
    </button>
    <HomePopover open={open} animate={menuMotion} anchor={anchor.current} label={say('Ordenar resultados','Ordenar resultados')} kind="list" variant="sort" onClose={close}>
      {SORTS.map(key=><button type="button" role="option" className="home-option" aria-selected={key===sort} key={key} onClick={event=>{onSort(key);close(true,event.detail>0);}}>{sortLabel(key,language)}</button>)}
    </HomePopover>
  </>;
}

export function ResultsFlowPage({search,onChange,visible,saved,onSave,onOpen,receipts,assistantProps,blocked,mapProps,sort:rawSort,onSort,alert,cue,onCue,chosen}) {
  const {language,t}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const sort=canonicalSort(rawSort);
  const root=useRef(null),[updating,setUpdating]=useState(false);
  const [width,setWidth]=useState(viewportWidth);
  const wantsHalf=mapProps.mode==='half'&&width>=SPLIT_MIN;
  const [layout,setLayout]=useState(wantsHalf?'half':'grid');
  const [reflowing,setReflowing]=useState(false),[gridKey,setGridKey]=useState(0);
  const [hoveredId,setHoveredId]=useState(null);
  const [mapTucked,setMapTucked]=useState(false);
  const [page,setPage]=useState(1);
  const columns=gridColumns(width,layout);
  // The sort is part of the signature, so reordering the same set of cards plays the skeleton and the cascade again.
  const signature=JSON.stringify([search,sort]),prior=useRef(signature),refresh=useRef(null);
  const heading=resultsHeading(search, say, language);
  const ordered=sort==='recommended'
    ?pinShowcaseDevelopments(spreadTourListings(visible, columns), search)
    :sortResults(visible, sort, new Set(matchingHomes(search).map(home=>home.id)));
  const pageSize=resultsPageSize(columns);
  const pageCount=Math.max(1, Math.ceil(ordered.length / pageSize));
  const safePage=Math.min(page, pageCount);
  const pageItems=ordered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showNeighborhoods=safePage === 1 && ordered.length >= pageSize;
  const pagerSlots=(layout === 'half' ? width - Math.min(760, Math.max(360, width * 0.42)) : width) < 640 ? 3 : 5;
  const mapFull=mapProps.mode==='full'&&!mapProps.hidden;
  const nearby=nearbyListings(search, ordered);
  useEffect(()=>{
    const onResize=()=>setWidth(viewportWidth());
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);
  useEffect(()=>{
    const next=wantsHalf?'half':'grid';
    if(next===layout)return;
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){setLayout(next);return;}
    setReflowing(true);
    const timer=setTimeout(()=>{setLayout(next);setGridKey(key=>key+1);setReflowing(false);},REFLOW_OUT);
    return()=>clearTimeout(timer);
  },[wantsHalf]);
  useEffect(()=>{if(layout!=='half')setHoveredId(null)},[layout]);
  // The floating map is an entry to the listings. Once the rich content below them reaches it, the card steps aside.
  useEffect(()=>{
    const page=root.current;
    if(!page)return;
    let frame=0;
    const check=()=>{
      frame=0;
      const rich=page.querySelector('.price-insights');
      if(!rich){setMapTucked(false);return;}
      const compact=document.documentElement.clientWidth<=700;
      const clearance=(compact?128:192)+(compact?16:48);
      setMapTucked(rich.getBoundingClientRect().top<window.innerHeight-clearance);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(check);};
    check();
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
  },[ordered.length,safePage,layout]);
  useLayoutEffect(()=>installHomeMotion(root.current),[]);
  useLayoutEffect(()=>playHomeTransition(root.current),[]);
  useLayoutEffect(()=>{
    if(prior.current===signature)return;prior.current=signature;
    setPage(1);
    clearTimeout(refresh.current);
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){setUpdating(false);return;}
    setUpdating(true);refresh.current=setTimeout(()=>setUpdating(false),320);
    return()=>clearTimeout(refresh.current);
  },[signature]);
  const hoverProps=id=>layout!=='half'?{}:{
    onPointerEnter:event=>{if(event.pointerType!=='touch')setHoveredId(id)},
    onPointerLeave:()=>setHoveredId(current=>current===id?null:current),
    onFocus:()=>setHoveredId(id),
    onBlur:event=>{if(!event.currentTarget.contains(event.relatedTarget))setHoveredId(current=>current===id?null:current)},
  };
  function reveal(selector){
    const target=root.current?.querySelector(selector);
    if(!target)return;
    const behavior=matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';
    // The sticky search bar changes height with scroll direction, so the landing spot is checked again once scrolling stops.
    const offset=()=>target.getBoundingClientRect().top-Math.max(root.current?.querySelector('.mora-bar')?.getBoundingClientRect().bottom||0,0)-16;
    target.focus({preventScroll:true});
    let settle;
    const correct=()=>{clearTimeout(settle);window.removeEventListener('scrollend',correct);const off=offset();if(Math.abs(off)>2)window.scrollBy({top:off,behavior});};
    window.addEventListener('scrollend',correct);
    settle=setTimeout(correct,2000);
    window.scrollTo({top:window.scrollY+offset(),behavior});
  }
  function goToPage(next) {
    const target=Math.min(pageCount, Math.max(1, next));
    if(target===safePage)return;
    setPage(target);
    const title=root.current?.querySelector('.flow-results-heading h1');
    if(!title)return;
    const behavior=matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth';
    const bar=root.current.querySelector('.mora-bar')?.getBoundingClientRect().height||0;
    const top=title.getBoundingClientRect().top+window.scrollY-bar-16;
    title.focus({preventScroll:true});
    window.scrollTo({top:Math.max(0, top),behavior});
  }
  function renderGrid(items){
    if(!items.length)return null;
    return <div key={`${gridKey}-${safePage}`} className={`results-grid flow-grid ${updating?'is-updating':''}`} aria-busy={updating}>
      {items.map((home,index)=><div className="flow-result-item" key={home.id} style={{'--result-order':Math.min(index,7)}} {...hoverProps(home.id)}><HouseCard home={home} search={search} pref={assistantProps.pref} signal={sortSignal(home,sort,language)} contacted={receipts.some(receipt=>receipt.propertyId===home.id)} saved={saved.includes(home.id)} onLike={onSave} onOpen={onOpen}/></div>)}
    </div>;
  }
  return <div ref={root} className="search-flow-page home-evolution">
    <SearchBar search={search} onChange={onChange} pref={assistantProps.pref} onPref={assistantProps.onPref} onOpen={onOpen} blocked={blocked} proactive={!mapFull} alert={alert} cue={cue} onCue={onCue} homeChosen={chosen}/>
    <div className="flow-results-content" data-map-layout={layout} inert={mapFull} aria-hidden={mapFull||undefined}>
      <div className="flow-results-heading">
        <div className="flow-results-title">
          <nav className="flow-results-crumbs" aria-label={say('Caminho da busca','Ruta de la búsqueda')}>{heading.crumbs.map((crumb, index) => <span key={`${crumb}-${index}`}>{crumb}{index < heading.crumbs.length - 1 && <span className="flow-results-crumb-sep" aria-hidden="true">&gt;</span>}</span>)}</nav>
          <h1 tabIndex={-1}>{new Intl.NumberFormat(language).format(visible.length)} {heading.title}</h1>
        </div>
        <SortControl sort={sort} onSort={onSort} language={language} say={say}/>
      </div>
      {assistantProps.pref!=='none'&&<div className="flow-current-state">
        {assistantProps.pref!=='none'&&<button onClick={()=>assistantProps.onPref('none')}>{assistantProps.pref==='extra'?say('Prioridade: 3+ quartos','Prioridad: 3+ recámaras'):say('Preferência: espaço na sala','Preferencia: espacio en la sala')}<Icon name="close" size={14}/></button>}
      </div>}
      <div className={'flow-results-workspace'+(reflowing?' is-map-reflow':'')}><section className="flow-listings" aria-label={t('Todos los resultados')}>
        {renderGrid(pageItems)}
        <ResultsPager page={safePage} pages={pageCount} slots={pagerSlots} onPage={goToPage} say={say}/>
        <NearbyResults homes={nearby} saved={saved} onLike={onSave} onOpen={onOpen} receipts={receipts} search={search} pref={assistantProps.pref}/>
        {showNeighborhoods&&<NeighborhoodRail
          onSelect={(area,mode)=>onChange({...search,mode,area,areas:[area],address:'',...(mode==='rent'?{budget:28000}:mode!==search.mode?{budget:7500000}:{})})}
        />}
        {ordered.length>0&&<PriceInsights search={search} onChange={onChange}/>}
        {ordered.length>0&&<RegionInsights search={search} onChange={onChange} onOpen={onOpen} onGuide={()=>mapProps.onMode('full')} saved={saved} onLike={onSave}/>}
        {ordered.length>0&&<NearbyPlaces search={search} onMap={()=>mapProps.onMode('full')} onCostOfLiving={()=>reveal('.cost-of-living')}/>}
        {ordered.length>0&&<CostOfLiving search={search} onPrices={()=>reveal('.price-insights')}/>}
        {ordered.length>0&&<SearchFaq search={search}/>}
        {ordered.length>0&&<HomeInternalLinks variant="results" search={search} onSearch={onChange} onOpen={onOpen}/>}
      </section></div>
    </div>
    <Suspense fallback={null}>
      <SearchMap mode={mapProps.mode} onMode={mapProps.onMode} homes={visible} hoveredId={hoveredId} saved={saved} recent={mapProps.recent} tuck={mapTucked}
        areaLabel={mapAreaLabel(search,say)} hidden={mapProps.hidden} onOpenListing={mapProps.onOpenListing} onSave={onSave}
        search={search} pref={assistantProps.pref} signedIn={mapProps.signedIn} onLogin={mapProps.onLogin} onAskMora={mapProps.onAskMora}/>
    </Suspense>
  </div>;
}
