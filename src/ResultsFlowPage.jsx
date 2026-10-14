import React,{Suspense,lazy,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {SearchBar} from './SearchBar';
import {HouseCard} from './Home';
import {NeighborhoodRail} from './NeighborhoodRail.jsx';
import {Icon} from './App';
import {useLanguage} from './i18n';
import {pinShowcaseDevelopments,selectedAreas,spreadTourListings} from './journey';
import {installHomeMotion} from './homeMotion';
import {playHomeTransition} from './searchFlowMotion';

const SearchMap=lazy(()=>import('./SearchMap.jsx'));
const FIRST_ROWS = 4;
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

function mapAreaLabel(search, say) {
  const areas=selectedAreas(search).filter(area=>area!=='Ambas zonas');
  if (!areas.length) return say('Cidade do México','Ciudad de México');
  return areas.length===1 ? `${areas[0]}, CDMX` : `${areas[0]} +${areas.length-1}`;
}

export function ResultsFlowPage({search,onChange,visible,saved,onSave,onOpen,onFavorites,receipts,assistantProps,blocked,mapProps}) {
  const {language,t}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const root=useRef(null),[updating,setUpdating]=useState(false);
  const [width,setWidth]=useState(viewportWidth);
  const wantsHalf=mapProps.mode==='half'&&width>=SPLIT_MIN;
  const [layout,setLayout]=useState(wantsHalf?'half':'grid');
  const [reflowing,setReflowing]=useState(false),[gridKey,setGridKey]=useState(0);
  const [hoveredId,setHoveredId]=useState(null);
  const columns=gridColumns(width,layout);
  const signature=JSON.stringify(search),prior=useRef(signature),refresh=useRef(null);
  const ordered=pinShowcaseDevelopments(spreadTourListings(visible, columns), search);
  const splitAt=Math.min(ordered.length, FIRST_ROWS * columns);
  const leading=ordered.slice(0, splitAt);
  const trailing=ordered.slice(splitAt);
  const showNeighborhoods=leading.length >= FIRST_ROWS * columns;
  const mapFull=mapProps.mode==='full'&&!mapProps.hidden;
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
  useLayoutEffect(()=>installHomeMotion(root.current),[]);
  useLayoutEffect(()=>playHomeTransition(root.current),[]);
  useLayoutEffect(()=>{
    if(prior.current===signature)return;prior.current=signature;
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
  function renderGrid(items, orderOffset=0){
    if(!items.length)return null;
    return <div key={`${gridKey}-${orderOffset}`} className={`results-grid flow-grid ${updating?'is-updating':''}`} aria-busy={updating}>
      {items.map((home,index)=><div className="flow-result-item" key={home.id} style={{'--result-order':Math.min(orderOffset+index,7)}} {...hoverProps(home.id)}><HouseCard home={home} search={search} pref={assistantProps.pref} contacted={receipts.some(receipt=>receipt.propertyId===home.id)} saved={saved.includes(home.id)} onLike={onSave} onOpen={onOpen}/></div>)}
    </div>;
  }
  return <div ref={root} className="search-flow-page home-evolution">
    <SearchBar search={search} onChange={onChange} pref={assistantProps.pref} onPref={assistantProps.onPref} onOpen={onOpen} blocked={blocked} proactive={!mapFull}/>
    <div className="flow-results-content" data-map-layout={layout} inert={mapFull} aria-hidden={mapFull||undefined}>
      <div className="flow-results-heading">
        <h1>{say('Todos os resultados','Todos los resultados')}<span aria-label={say('imóveis encontrados','inmuebles encontrados')} className="results-count">{visible.length}</span></h1>
        {onFavorites&&<button className="compare-favorites-link" type="button" onClick={onFavorites}>{say('Ver favoritos','Ver favoritos')}</button>}
      </div>
      {assistantProps.pref!=='none'&&<div className="flow-current-state">
        {assistantProps.pref!=='none'&&<button onClick={()=>assistantProps.onPref('none')}>{assistantProps.pref==='extra'?say('Prioridade: 3+ quartos','Prioridad: 3+ recámaras'):say('Preferência: espaço na sala','Preferencia: espacio en la sala')}<Icon name="close" size={14}/></button>}
      </div>}
      <div className={'flow-results-workspace'+(reflowing?' is-map-reflow':'')}><section className="flow-listings" aria-label={t('Todos los resultados')}>
        {renderGrid(leading)}
        {showNeighborhoods&&<NeighborhoodRail
          mode={search.mode}
          onModeChange={(mode,budget)=>onChange({...search,mode,budget,minBudget:0})}
          onSelect={(area,mode)=>onChange({...search,mode,area,areas:[area],address:'',...(mode==='rent'?{budget:28000}:mode!==search.mode?{budget:7500000}:{})})}
        />}
        {renderGrid(trailing, leading.length)}
      </section></div>
    </div>
    <Suspense fallback={null}>
      <SearchMap mode={mapProps.mode} onMode={mapProps.onMode} homes={visible} hoveredId={hoveredId} saved={saved} recent={mapProps.recent}
        areaLabel={mapAreaLabel(search,say)} hidden={mapProps.hidden} onOpenListing={mapProps.onOpenListing} onSave={onSave}
        search={search} pref={assistantProps.pref} signedIn={mapProps.signedIn} onLogin={mapProps.onLogin} onAskMora={mapProps.onAskMora}/>
    </Suspense>
  </div>;
}
