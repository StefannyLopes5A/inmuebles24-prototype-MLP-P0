import React,{useEffect,useId,useRef,useState} from 'react';

const FOCUSABLE='button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
const IDLE_MS=4000;

const VERSIONS=[
  {id:'mlp',name:'MLP version',url:'https://inmuebles24-mlp-p0.vercel.app/',host:'inmuebles24-mlp-p0.vercel.app',
    summary:'What ships first: the P0 scope of the H1 2027 roadmap.',
    bullets:['New header, footer, internal links and city guides for SEO','Multi-location search with autocomplete and quick filters','New house card, tags and listings carousel','Redesigned filter panel and save-search flow','Fair price signal on the card','Lead generation flow with confirmation']},
  {id:'vision',name:'End vision version',url:'https://i24-classifieds-v3.vercel.app/',host:'i24-classifieds-v3.vercel.app',
    summary:'The full target experience: the MLP plus the P1 and P2 roadmap items.',
    bullets:['Mora across the journey: guided search, neighborhood context and cost calculator','Mini listing panel and a map with Mora’s reading','Favorites folders, comparison, sharing and batch contact','Photo gallery by room and virtual tour','Mora analysis, offer comparison and progressive profiling']},
];

/** The prototype is the MLP on its own host and on localhost; anywhere else matches by hostname. */
function currentVersion() {
  const host=window.location.hostname;
  return VERSIONS.find(version=>version.host===host)?.id||'mlp';
}

const SwapIcon = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="6" cy="18" r="2"/>
  <circle cx="18" cy="6" r="2"/>
  <path d="M6 16v-6a4 4 0 0 1 4-4h4M12 3l3 3-3 3"/>
  <path d="M18 8v6a4 4 0 0 1-4 4h-4M12 15l-3 3 3 3"/>
</svg>;

/** Floating button that jumps between the MLP and the End vision prototypes. Sits above the guide button when there is one. */
export function VersionSwitcher({aboveGuide=false}) {
  const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(null),[idle,setIdle]=useState(false);
  const [current]=useState(currentVersion);
  const root=useRef(null),stage=useRef(null),fab=useRef(null);
  const id=useId();

  function hide(restoreFocus=true) {
    setOpen(false);setExpanded(null);
    if(restoreFocus)requestAnimationFrame(()=>fab.current?.focus({preventScroll:true}));
  }

  useEffect(()=>{
    if(!open)return;
    const frame=requestAnimationFrame(()=>stage.current?.querySelector('.pg-row')?.focus({preventScroll:true}));
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();return;}
      if(event.key!=='Tab')return;
      event.stopPropagation();
      const items=[...stage.current.querySelectorAll(FOCUSABLE)].filter(item=>item.getClientRects().length&&!item.closest('[inert]'));
      if(!items.length)return;
      const first=items[0],last=items[items.length-1];
      if(!stage.current.contains(document.activeElement)){event.preventDefault();first.focus();}
      else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    const press=event=>{if(!root.current?.contains(event.target))hide(false);};
    window.addEventListener('keydown',key,true);
    document.addEventListener('pointerdown',press,true);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',press,true);};
  },[open]);
  // Quiet for a few seconds and the button tucks into the left edge; hover or keyboard focus brings it back.
  useEffect(()=>{
    setIdle(false);
    if(open)return;
    const timer=setTimeout(()=>setIdle(true),IDLE_MS);
    return()=>clearTimeout(timer);
  },[open]);

  return <div ref={root} className="pg vs" data-open={open||undefined} data-idle={idle||undefined} data-above-guide={aboveGuide||undefined}>
    <button ref={fab} type="button" className="pg-fab vs-fab" aria-label="Switch prototype version" aria-haspopup="menu" aria-expanded={open} aria-controls={`${id}-stage`}
      onClick={()=>setOpen(true)} tabIndex={open?-1:0}>
      <SwapIcon/>
    </button>
    <section ref={stage} id={`${id}-stage`} className="pg-stage" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} inert={!open} aria-hidden={!open||undefined}>
      <header className="pg-head" style={{'--i':0}}>
        <div>
          <p className="pg-eyebrow">PROTOTYPE</p>
          <h2 className="pg-count" id={`${id}-title`}>Two versions</h2>
        </div>
        <button type="button" className="pg-close" aria-label="Close menu" onClick={()=>hide()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>
        </button>
      </header>
      <ol className="pg-index">
        {VERSIONS.map((version,index)=>{
          const isOpen=expanded===version.id,detail=`${id}-${version.id}`,here=version.id===current;
          return <li key={version.id} className="pg-item" style={{'--i':index+1}} data-expanded={isOpen||undefined}>
            <button type="button" className="pg-row" aria-expanded={isOpen} aria-controls={detail} onClick={()=>setExpanded(isOpen?null:version.id)}>
              <span className="pg-num">{String(index+1).padStart(2,'0')}</span>
              <span className="pg-title">{version.name}</span>
              <span className="pg-toggle" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
            </button>
            <div className="pg-detail" id={detail} inert={!isOpen}>
              <div className="pg-detail-inner">
                <p className="pg-body">{version.summary}</p>
                <ul className="vs-list">{version.bullets.map(bullet=><li key={bullet}>{bullet}</li>)}</ul>
                <div className="pg-actions">
                  {here
                    ? <button type="button" className="pg-pill" data-primary onClick={()=>hide()}>You are here</button>
                    : <a className="pg-pill" href={version.url} onClick={()=>hide(false)}>Open {version.name.toLowerCase()}</a>}
                </div>
              </div>
            </div>
          </li>;
        })}
      </ol>
    </section>
  </div>;
}
