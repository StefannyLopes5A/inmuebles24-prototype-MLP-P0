import React,{useLayoutEffect,useRef,useState} from 'react';
import {SearchBar} from './SearchBar';
import {HouseCard} from './Home';
import {Icon} from './App';
import {useLanguage} from './i18n';
import {installHomeMotion} from './homeMotion';
import {playHomeTransition} from './searchFlowMotion';

export function ResultsFlowPage({search,onChange,visible,saved,onSave,onOpen,receipts,assistantProps,blocked,miniProps}) {
  const {language,t}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const root=useRef(null),[updating,setUpdating]=useState(false);
  const signature=JSON.stringify(search),prior=useRef(signature),refresh=useRef(null);
  useLayoutEffect(()=>installHomeMotion(root.current),[]);
  useLayoutEffect(()=>playHomeTransition(root.current),[]);
  useLayoutEffect(()=>{
    if(prior.current===signature)return;prior.current=signature;
    clearTimeout(refresh.current);
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){setUpdating(false);return;}
    setUpdating(true);refresh.current=setTimeout(()=>setUpdating(false),320);
    return()=>clearTimeout(refresh.current);
  },[signature]);
  return <div ref={root} className="search-flow-page home-evolution">
    <SearchBar search={search} onChange={onChange} pref={assistantProps.pref} onPref={assistantProps.onPref} onOpen={onOpen} blocked={blocked} {...miniProps}/>
    <div className="flow-results-content" inert={!!miniProps?.activeHome}>
      <div className="flow-results-heading"><h1>{say('Todos os resultados','Todos los resultados')}<span aria-label={say('imóveis encontrados','inmuebles encontrados')} className="results-count">{visible.length}</span></h1></div>
      {assistantProps.pref!=='none'&&<div className="flow-current-state">
        {assistantProps.pref!=='none'&&<button onClick={()=>assistantProps.onPref('none')}>{assistantProps.pref==='extra'?say('Prioridade: 3+ quartos','Prioridad: 3+ recámaras'):say('Preferência: espaço na sala','Preferencia: espacio en la sala')}<Icon name="close" size={14}/></button>}
      </div>}
      <div className="flow-results-workspace"><section className="flow-listings" aria-label={t('Todos los resultados')}>
        <div className={`results-grid flow-grid ${updating?'is-updating':''}`} aria-busy={updating}>
          {visible.map((home,index)=><div className="flow-result-item" key={home.id} style={{'--result-order':Math.min(index,7)}}><HouseCard home={home} saved={saved.includes(home.id)} onLike={onSave} onOpen={onOpen}/>{receipts.some(receipt=>receipt.propertyId===home.id)&&<span className="v2-contacted"><Icon name="check" size={14}/>{say('Contato simulado registrado','Contacto simulado registrado')}</span>}</div>)}
        </div>
      </section></div>
    </div>
  </div>;
}
