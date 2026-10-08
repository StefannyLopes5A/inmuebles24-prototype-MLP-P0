import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {SearchBar} from './SearchBar';
import {HouseCard} from './Home';
import {NeighborhoodRail} from './NeighborhoodRail.jsx';
import {Icon} from './App';
import {useLanguage} from './i18n';
import {spreadTourListings} from './journey';
import {installHomeMotion} from './homeMotion';
import {playHomeTransition} from './searchFlowMotion';

const FIRST_ROWS = 4;

function gridColumns() {
  if (typeof window === 'undefined') return 4;
  const width = window.innerWidth;
  if (width <= 700) return 1;
  if (width <= 950) return 2;
  if (width <= 1200) return 3;
  return 4;
}

export function ResultsFlowPage({search,onChange,visible,saved,onSave,onOpen,onFavorites,receipts,assistantProps,blocked,miniProps}) {
  const {language,t}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const root=useRef(null),[updating,setUpdating]=useState(false);
  const [columns,setColumns]=useState(gridColumns);
  const signature=JSON.stringify(search),prior=useRef(signature),refresh=useRef(null);
  const ordered=spreadTourListings(visible, columns);
  const splitAt=Math.min(ordered.length, FIRST_ROWS * columns);
  const leading=ordered.slice(0, splitAt);
  const trailing=ordered.slice(splitAt);
  const showNeighborhoods=leading.length >= FIRST_ROWS * columns;
  useEffect(()=>{
    const onResize=()=>setColumns(gridColumns());
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);
  useLayoutEffect(()=>installHomeMotion(root.current),[]);
  useLayoutEffect(()=>playHomeTransition(root.current),[]);
  useLayoutEffect(()=>{
    if(prior.current===signature)return;prior.current=signature;
    clearTimeout(refresh.current);
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){setUpdating(false);return;}
    setUpdating(true);refresh.current=setTimeout(()=>setUpdating(false),320);
    return()=>clearTimeout(refresh.current);
  },[signature]);
  function renderGrid(items, orderOffset=0){
    if(!items.length)return null;
    return <div className={`results-grid flow-grid ${updating?'is-updating':''}`} aria-busy={updating}>
      {items.map((home,index)=><div className="flow-result-item" key={home.id} style={{'--result-order':Math.min(orderOffset+index,7)}}><HouseCard home={home} saved={saved.includes(home.id)} onLike={onSave} onOpen={onOpen}/>{receipts.some(receipt=>receipt.propertyId===home.id)&&<span className="v2-contacted"><Icon name="check" size={14}/>{say('Contato simulado registrado','Contacto simulado registrado')}</span>}</div>)}
    </div>;
  }
  return <div ref={root} className="search-flow-page home-evolution">
    <SearchBar search={search} onChange={onChange} pref={assistantProps.pref} onPref={assistantProps.onPref} onOpen={onOpen} blocked={blocked} {...miniProps}/>
    <div className="flow-results-content" inert={!!miniProps?.activeHome}>
      <div className="flow-results-heading">
        <h1>{say('Todos os resultados','Todos los resultados')}<span aria-label={say('imóveis encontrados','inmuebles encontrados')} className="results-count">{visible.length}</span></h1>
        {onFavorites&&<button className="compare-favorites-link" type="button" onClick={onFavorites}>{say('Ver favoritos','Ver favoritos')}</button>}
      </div>
      {assistantProps.pref!=='none'&&<div className="flow-current-state">
        {assistantProps.pref!=='none'&&<button onClick={()=>assistantProps.onPref('none')}>{assistantProps.pref==='extra'?say('Prioridade: 3+ quartos','Prioridad: 3+ recámaras'):say('Preferência: espaço na sala','Preferencia: espacio en la sala')}<Icon name="close" size={14}/></button>}
      </div>}
      <div className="flow-results-workspace"><section className="flow-listings" aria-label={t('Todos los resultados')}>
        {renderGrid(leading)}
        {showNeighborhoods&&<NeighborhoodRail
          mode={search.mode}
          onModeChange={(mode,budget)=>onChange({...search,mode,budget,minBudget:0})}
          onSelect={(area,mode)=>onChange({...search,mode,area,areas:[area],address:'',...(mode==='rent'?{budget:28000}:mode!==search.mode?{budget:7500000}:{})})}
        />}
        {renderGrid(trailing, leading.length)}
      </section></div>
    </div>
  </div>;
}
