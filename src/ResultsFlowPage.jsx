import React,{Suspense,lazy,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {SearchBar} from './SearchBar';
import {HouseCard} from './Home';
import {NeighborhoodRail} from './NeighborhoodRail.jsx';
import {NearbyResults} from './NearbyResults.jsx';
import {PriceInsights} from './PriceInsights.jsx';
import {RegionInsights} from './RegionInsights.jsx';
import {SearchFaq} from './SearchFaq.jsx';
import {MoraEntry} from './MoraEntry.jsx';
import {HomeInternalLinks} from './HomeInternalLinks.jsx';
import {Icon} from './App';
import {useLanguage} from './i18n';
import {matchingHomes,selectedAreas,spreadTourListings} from './journey';
import {homes,listingPrice} from './data';
import {PROPERTY_TYPES} from './homeSearchModel';
import {installHomeMotion} from './homeMotion';
import {playHomeTransition} from './searchFlowMotion';
import {HomePopover} from './HomeSearch';
import {SORTS,canonicalSort,sortLabel,sortResults,sortSignal} from './resultSort';
import {ResultsPager} from './ResultsPager.jsx';
import {resultsBlockSize, resultsPageSize} from './resultsPager.js';


const MapFloat=lazy(()=>import('./MapFloat.jsx'));
const ResultsMap=lazy(()=>import('./ResultsMap.jsx'));

function mapAreaLabel(search, say) {
  const areas=selectedAreas(search).filter(area=>area!=='Ambas zonas');
  if (!areas.length && search.address) return `${search.address}, CDMX`;
  if (!areas.length) return say('Cidade do México','Ciudad de México');
  return areas.length===1 ? `${areas[0]}, CDMX` : `${areas[0]} +${areas.length-1}`;
}

const viewportWidth=()=>typeof window === 'undefined' ? 1512 : document.documentElement.clientWidth;

function gridColumns(width) {
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

export function ResultsFlowPage({search,onChange,visible,saved,onSave,onOpen,receipts,assistantProps,onOpenMap,mapOpen=false,onCloseMap,onOpenFromMap,sort:rawSort,onSort,alert}) {
  const {language,t}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const sort=canonicalSort(rawSort);
  const root=useRef(null),[updating,setUpdating]=useState(false);
  const [width,setWidth]=useState(viewportWidth);
  const [gridKey]=useState(0);
  const [page,setPage]=useState(1);
  const [moraState,setMoraState]=useState('open');
  const columns=gridColumns(width);
  // The sort is part of the signature, so reordering the same set of cards plays the skeleton and the cascade again.
  const signature=JSON.stringify([search,sort]),prior=useRef(signature),refresh=useRef(null);
  const heading=resultsHeading(search, say, language);
  const ordered=sort==='recommended'
    ?spreadTourListings(visible, columns)
    :sortResults(visible, sort, new Set(matchingHomes(search).map(home=>home.id)));
  const pageSize=resultsPageSize(columns);
  const pageCount=Math.max(1, Math.ceil(ordered.length / pageSize));
  const safePage=Math.min(page, pageCount);
  const pageItems=ordered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const blockSize=resultsBlockSize(columns);
  const firstBlock=pageItems.slice(0, blockSize), secondBlock=pageItems.slice(blockSize);
  // The rail sits between the two blocks of four rows; a page with only one block has nothing to separate.
  const showNeighborhoods=secondBlock.length > 0;
  const pagerSlots=width < 640 ? 3 : 5;
  const nearby=nearbyListings(search, ordered);
  useEffect(()=>{
    const onResize=()=>setWidth(viewportWidth());
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);
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
  function renderGrid(items,part='a'){
    if(!items.length)return null;
    return <div key={`${gridKey}-${safePage}-${part}`} className={`results-grid flow-grid ${updating?'is-updating':''}`} aria-busy={updating}>
      {items.map((home,index)=><div className="flow-result-item" key={home.id} style={{'--result-order':Math.min(index,7)}}><HouseCard home={home} search={search} pref={assistantProps.pref} signal={sortSignal(home,sort,language)} contacted={receipts.some(receipt=>receipt.propertyId===home.id)} saved={saved.includes(home.id)} onLike={onSave} onOpen={onOpen}/></div>)}
    </div>;
  }
  return <div ref={root} className="search-flow-page home-evolution">
    <SearchBar search={search} onChange={onChange} alert={alert}/>
    {mapOpen
      ? <Suspense fallback={<div className="rm-page" aria-busy="true"/>}><ResultsMap homes={visible} search={search} saved={saved} onSave={onSave} onOpen={onOpenFromMap} onClose={onCloseMap}/></Suspense>
      : <>
    {ordered.length>0&&moraState!=='gone'&&<div className={'mora-entry-search'+(moraState==='closing'?' is-closing':'')} onAnimationEnd={event=>{if(event.currentTarget===event.target&&moraState==='closing')setMoraState('gone');}}>
      <div className="mora-entry-search-inner"><MoraEntry id="mora-entry-search-title" title={say('Ficou com dúvidas sobre a sua busca?','¿Te quedaron dudas sobre tu búsqueda?')} say={say} onClose={()=>setMoraState(matchMedia('(prefers-reduced-motion:reduce)').matches?'gone':'closing')}/></div>
    </div>}
    <div className="flow-results-content">
      <div className="flow-results-heading">
        <div className="flow-results-title">
          <nav className="flow-results-crumbs" aria-label={say('Caminho da busca','Ruta de la búsqueda')}>{heading.crumbs.map((crumb, index) => <span key={`${crumb}-${index}`}>{crumb}{index < heading.crumbs.length - 1 && <span className="flow-results-crumb-sep" aria-hidden="true">&gt;</span>}</span>)}</nav>
          <h1 tabIndex={-1}>{new Intl.NumberFormat(language).format(visible.length)} {heading.title}</h1>
        </div>
        <SortControl sort={sort} onSort={onSort} language={language} say={say}/>
      </div>
      <div className={'flow-results-workspace'}><section className="flow-listings" aria-label={t('Todos los resultados')}>
        {renderGrid(firstBlock,'a')}
        {showNeighborhoods&&<NeighborhoodRail
          onSelect={(area,mode)=>onChange({...search,mode,area,areas:[area],address:'',...(mode==='rent'?{budget:28000}:mode!==search.mode?{budget:7500000}:{})})}
        />}
        {renderGrid(secondBlock,'b')}
        <ResultsPager page={safePage} pages={pageCount} slots={pagerSlots} onPage={goToPage} say={say}/>
        <NearbyResults homes={nearby} saved={saved} onLike={onSave} onOpen={onOpen} receipts={receipts} search={search} pref={assistantProps.pref}/>
        {ordered.length>0&&<PriceInsights search={search} onChange={onChange}/>}
        {ordered.length>0&&<RegionInsights search={search} onChange={onChange} onOpen={onOpen} saved={saved} onLike={onSave}/>}
        {ordered.length>0&&<SearchFaq search={search}/>}
        {ordered.length>0&&<HomeInternalLinks variant="results" search={search} onSearch={onChange} onOpen={onOpen}/>}
      </section></div>
    </div>
    <Suspense fallback={null}><MapFloat homes={visible} search={search} label={mapAreaLabel(search,say)} onOpen={onOpenMap}/></Suspense>
      </>}
  </div>;
}
