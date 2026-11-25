import React,{useLayoutEffect,useRef,useState} from 'react';
import {BudgetPicker,HomePopover} from './HomeSearch';
import {AllFilters} from './AllFilters';
import {PROPERTY_TYPES,OPERATIONS} from './homeSearchModel';
import {CRITERIA,criterionLabel} from './searchCriteria';
import {visiblePlaces} from './locationSearch';
import {LocationField} from './LocationField.jsx';
import {useLanguage} from './i18n';

const asset=name=>`/assets/search-flow/${name}.svg`;
const Chevron=()=> <img className="mora-chevron" src={asset('chevron')} alt=""/>;
function quickFilterVariant(key) {return !key || key.startsWith('criterion:') ? 'amenity' : key;}
function quickFilterKind(key) {return key==='beds' || key==='baths' || key==='parking' || key==='budget' ? key : 'list';}
function quickFilterLabel(key, say) {
  if (!key || key.startsWith('criterion:')) return say('Comodidades','Comodidades');
  if (key==='mode') return say('Quero comprar ou alugar','Quiero comprar o rentar');
  if (key==='propertyType') return say('Tipo de imóvel','Tipo de inmueble');
  if (key==='beds') return say('Número de quartos','Número de recámaras');
  if (key==='baths') return say('Número de banheiros','Número de baños');
  if (key==='parking') return say('Número de vagas','Número de estacionamientos');
  return say('Orçamento máximo','Presupuesto máximo');
}

/**
 * The results bar: the location input first, then the quick filters and "Más filtros". The input takes places only
 * (cities, colonias, streets and points of interest); there is no free text, question or conversation here.
 */
export function SearchBar({search,onChange,alert}) {
  const {language,money,currency}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const [filterMenu,setFilterMenu]=useState(null),[allFilters,setAllFilters]=useState(false);
  const [filterEdges,setFilterEdges]=useState({start:true,end:true}),[filterPoint,setFilterPoint]=useState({start:false,end:false});
  const scroll=useRef(null),filterAnchor=useRef(null),current=useRef(search);current.current=search;
  const locale=pt?1:2;
  const places=visiblePlaces(search);
  const filters=[
    ['mode',OPERATIONS.find(([key])=>key===search.mode)?.[locale]],
    ['propertyType',PROPERTY_TYPES.find(([key])=>key===(search.propertyType||'apartment'))?.[locale]],
    ['beds',`${search.beds}+ ${say('quartos','recámaras')}`],
    ['baths',`${search.baths || 1}+ ${say((search.baths || 1) === 1 ? 'banheiro' : 'banheiros', (search.baths || 1) === 1 ? 'baño' : 'baños')}`],
    ...(search.parking ? [['parking',`${search.parking}+ ${say(search.parking === 1 ? 'vaga' : 'vagas', search.parking === 1 ? 'estacionamiento' : 'estacionamientos')}`]] : []),
    ['budget',`${search.minBudget?money(search.minBudget)+' – ':''}${money(search.budget)} ${currency}`],
    ...(search.criteria||[]).map(id=>[`criterion:${id}`,criterionLabel(id,language)]),
  ];
  const filterContents=JSON.stringify([filters,alert?.on]);
  useLayoutEffect(()=>{
    const rail=scroll.current;if(!rail)return;
    const update=()=>setFilterEdges({start:rail.scrollLeft<=1,end:rail.scrollWidth-rail.clientWidth-rail.scrollLeft<=1});
    const resize=new ResizeObserver(update);
    resize.observe(rail);for(const filter of rail.children)resize.observe(filter);
    rail.addEventListener('scroll',update,{passive:true});update();
    return()=>{resize.disconnect();rail.removeEventListener('scroll',update);};
  },[filterContents]);
  function apply(next) {
    if(JSON.stringify(next)!==JSON.stringify(current.current)){current.current=next;onChange(next);}
  }
  function closeFilterMenu(restore=false) {
    const anchor=filterAnchor.current;
    setFilterMenu(null);
    if(restore)requestAnimationFrame(()=>anchor?.focus({preventScroll:true}));
  }
  function openQuickFilter(key, event, forceOpen=false) {
    if(!forceOpen&&filterMenu?.key===key){closeFilterMenu(false);return;}
    filterAnchor.current=event.currentTarget;
    setFilterMenu({key,animate:event.detail>0});
  }
  function pointAtFilters(event) {
    if(event.pointerType==='touch')return;
    const box=event.currentTarget.getBoundingClientRect();
    const x=event.clientX-box.left;
    const zone=88;
    const next={start:x<=zone,end:box.width-x<=zone};
    setFilterPoint(state=>state.start===next.start&&state.end===next.end?state:next);
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
  function applyMode(mode) {
    const active=current.current;
    const next={...active,mode};
    if(mode!==active.mode){next.budget=mode==='rent'?28000:7500000;next.minBudget=0;}
    apply(next);
  }
  function applyCriterion(id) {
    const active=current.current;
    const opened=filterMenu?.key?.startsWith('criterion:')?filterMenu.key.slice('criterion:'.length):'';
    const criteria=active.criteria||[];
    const next=opened&&opened!==id
      ? criteria.includes(id)?criteria.filter(item=>item!==opened):criteria.map(item=>item===opened?id:item)
      : criteria.includes(id)?criteria.filter(item=>item!==id):[...criteria,id];
    apply({...active,criteria:next});
  }
  const stepper=(key,min,max,fallback,labels)=>{
    const value=key==='baths'?(search.baths||1):key==='parking'?search.parking:search.beds;
    const set=next=>apply({...current.current,[key]:next});
    return <div className="home-bed-stepper"><button type="button" className="home-step" disabled={value<=min} aria-label={labels[0]} onClick={()=>set(Math.max(min,value-1))}><img src="/assets/home-evolution/minus.svg" alt=""/></button><output aria-live="polite">{value}+</output><button type="button" className="home-step" disabled={value>=max} aria-label={labels[1]} onClick={()=>set(Math.min(max,value+1))}><img src="/assets/home-evolution/plus.svg" alt=""/></button></div>;
  };
  return <>
    <section className="mora-bar" aria-label={say('Busca','Búsqueda')}>
      <div className="mora-bar-surface" aria-hidden="true"/>
      <div className="mora-collapsed">
        <LocationField variant="bar" places={places} onChange={next=>apply({...current.current,places:next})} say={say}
          label={say('Localização','Ubicación')} placeholder={say('Bairro, rua, metrô, escola…','Colonia, calle, metro, escuela…')}/>
        <div className="mora-filter-region" data-scroll-end={filterEdges.end}><div className="mora-filter-rail" onPointerMove={pointAtFilters} onPointerLeave={()=>setFilterPoint({start:false,end:false})}><div className="mora-filter-scroll" ref={scroll} role="group" aria-label={say('Filtros da busca; role para ver todos','Filtros de búsqueda; desplázate para ver todos')}>
          {filters.map(([key,label])=><button className="mora-filter" key={key} data-search-key={key} aria-haspopup={key==='beds'||key==='baths'||key==='parking'||key==='budget'?'dialog':'listbox'} aria-expanded={filterMenu?.key===key} onClick={event=>openQuickFilter(key,event)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();openQuickFilter(key,event,true);}}}><span>{label}</span><Chevron/></button>)}
        </div>{!filterEdges.start&&<button type="button" className={`mora-filter-nav is-prev${filterPoint.start?' is-shown':''}`} aria-label={say('Ver filtros anteriores','Ver filtros anteriores')} onClick={()=>revealFilters(-1)}><Chevron/></button>}{!filterEdges.end&&<button type="button" className={`mora-filter-nav is-next${filterPoint.end?' is-shown':''}`} aria-label={say('Ver mais filtros','Ver más filtros')} onClick={()=>revealFilters(1)}><Chevron/></button>}</div><button className="mora-more" onClick={()=>setAllFilters(true)}><img src={asset('tune')} alt=""/>{say('Mais filtros','Más filtros')}</button></div>
        {alert&&<button className={`btn-secondary mora-save ${alert.on?'is-on':''}`} aria-pressed={alert.on} onClick={alert.onToggle}>{alert.on?say('Busca salva','Búsqueda guardada'):say('Salvar busca','Guardar búsqueda')}</button>}
      </div>
      <HomePopover open={!!filterMenu} animate={filterMenu?.animate!==false} anchor={filterAnchor.current} label={quickFilterLabel(filterMenu?.key, say)} kind={quickFilterKind(filterMenu?.key)} variant={quickFilterVariant(filterMenu?.key)} onClose={restore=>closeFilterMenu(restore)}>
        {(filterMenu?.key==='mode'?OPERATIONS:filterMenu?.key==='propertyType'?PROPERTY_TYPES:[]).map(([option,ptLabel,esLabel])=><button type="button" className="home-option" role="option" aria-selected={option===(filterMenu.key==='mode'?search.mode:(search.propertyType||'apartment'))} key={option} onClick={()=>{if(filterMenu.key==='mode')applyMode(option);else apply({...current.current,propertyType:option});closeFilterMenu(true);}}>{say(ptLabel,esLabel)}</button>)}
        {filterMenu?.key?.startsWith('criterion:') && CRITERIA.map(item=><button type="button" className="home-option" role="option" aria-selected={(search.criteria||[]).includes(item.id)} key={item.id} onClick={()=>{applyCriterion(item.id);closeFilterMenu(true);}}>{criterionLabel(item.id,language)}</button>)}
        {filterMenu?.key==='beds' && stepper('beds',1,10,1,[say('Diminuir quartos','Reducir recámaras'),say('Aumentar quartos','Aumentar recámaras')])}
        {filterMenu?.key==='baths' && stepper('baths',1,10,1,[say('Diminuir banheiros','Reducir baños'),say('Aumentar banheiros','Aumentar baños')])}
        {filterMenu?.key==='parking' && stepper('parking',1,6,1,[say('Diminuir vagas','Reducir estacionamientos'),say('Aumentar vagas','Aumentar estacionamientos')])}
        {filterMenu?.key==='budget' && <BudgetPicker search={search} say={say} onChange={values=>apply({...current.current,...values})}/>}
      </HomePopover>
      <div className="mora-bar-divider" aria-hidden="true"/>
    </section>
    {allFilters&&<AllFilters search={search} onChange={apply} onClose={()=>setAllFilters(false)}/>}
  </>;
}
