import React,{useEffect,useRef} from 'react';
import {Icon} from './App';
import {BudgetPicker} from './HomeSearch';
import {PROPERTY_TYPES,OPERATIONS} from './homeSearchModel';
import {CRITERIA,criterionLabel} from './searchCriteria';
import {areas} from './data';
import {prototypeResults} from './journey';
import {useLanguage} from './i18n';
import {lockContactScroll} from './contactFlow';

export function AllFilters({search,onChange,onClose,onSmartInput}) {
  const {language}=useLanguage(),pt=language==='pt-BR',say=(br,es)=>pt?br:es;
  const dialog=useRef(null),previous=useRef(document.activeElement);
  useEffect(()=>{const node=dialog.current;node.showModal();const unlock=lockContactScroll(document);return()=>{node.close();unlock();previous.current?.focus({preventScroll:true});};},[]);
  const apply=values=>onChange({...search,...values,ideaLabel:null});
  function toggleCriterion(id) {
    const current=search.criteria||[];
    const criteria=current.includes(id)?current.filter(value=>value!==id):[...current.filter(value=>!(id==='furnished'&&value==='unfurnished')&&!(id==='unfurnished'&&value==='furnished')),id];
    apply({criteria});
  }
  return <dialog className="all-filters-dialog" ref={dialog} aria-labelledby="all-filters-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialog.current){const box=dialog.current.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)onClose();}}}>
    <header><div><h2 id="all-filters-title">{say('Todos os filtros','Todos los filtros')}</h2><p>{say('Sua busca se atualiza a cada alteração.','Tu búsqueda se actualiza con cada cambio.')}</p></div><button className="icon-button" onClick={onClose} aria-label={say('Fechar filtros','Cerrar filtros')}><Icon name="close"/></button></header>
    <div className="all-filters-body">
      <fieldset><legend>{say('Operação','Operación')}</legend><div className="all-filter-options">{OPERATIONS.map(([id,br,es])=><button key={id} aria-pressed={search.mode===id} onClick={()=>apply({mode:id,...(id!==search.mode?{minBudget:0,budget:id==='buy'?7500000:28000}:{})})}>{say(br,es)}</button>)}</div></fieldset>
      <fieldset><legend>{say('Tipo de imóvel','Tipo de inmueble')}</legend><div className="all-filter-options">{PROPERTY_TYPES.map(([id,br,es])=><button key={id} aria-pressed={(search.propertyType||'apartment')===id} onClick={()=>apply({propertyType:id})}>{say(br,es)}</button>)}</div></fieldset>
      <fieldset><legend>{say('Quartos','Recámaras')}</legend><div className="all-filter-options">{[1,2,3,4,5].map(n=><button key={n} aria-pressed={search.beds===n} onClick={()=>apply({beds:n})}>{n}+</button>)}</div></fieldset>
      <fieldset><legend>{say('Faixa de preço','Rango de precio')}</legend><BudgetPicker search={search} onChange={apply} say={say}/></fieldset>
      <fieldset><legend>{say('Bairros','Barrios')}</legend><p>{say('Sem seleção: toda a Cidade do México.','Sin selección: toda Ciudad de México.')}</p><div className="all-filter-options">{areas.filter(area=>area!=='Ambas zonas').map(area=><button key={area} aria-pressed={search.areas.includes(area)} onClick={()=>{const next=search.areas.includes(area)?search.areas.filter(item=>item!==area):[...search.areas,area];apply({areas:next,area:next[0]||'Ambas zonas',address:''});}}>{area}</button>)}</div></fieldset>
      <label className="all-filter-address">{say('Rua ou endereço','Calle o dirección')}<input value={search.address} placeholder={say('Opcional','Opcional')} maxLength={160} onChange={event=>apply({address:event.target.value})}/></label>
      <label className="all-filter-switch"><span><strong>{say('Só com tour 3D','Solo con tour 3D')}</strong><small>{say('Empreendimentos que você percorre em 3D, unidade por unidade.','Desarrollos que recorres en 3D, unidad por unidad.')}</small></span><input type="checkbox" role="switch" checked={search.tour3d===true} onChange={event=>apply({tour3d:event.target.checked})}/></label>
      <fieldset><legend>{say('Mais detalhes','Más detalles')}</legend><div className="all-filter-options">{CRITERIA.map(item=><button key={item.id} aria-pressed={search.criteria?.includes(item.id)||false} onClick={()=>toggleCriterion(item.id)}>{criterionLabel(item.id,language)}</button>)}</div></fieldset>
      <button className="all-filter-natural" onClick={()=>{onClose();onSmartInput();}}><img src="/assets/mini-listing/mora.svg" alt=""/>{say('Não encontrou um filtro? Descreva o que procura.','¿No encuentras un filtro? Describe lo que buscas.')}<Icon name="arrow"/></button>
    </div>
    <footer role="status">{prototypeResults(search).length} {say('imóveis para explorar','inmuebles para explorar')}</footer>
  </dialog>;
}
