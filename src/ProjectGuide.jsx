import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {GUIDE_STOPS} from './guideStops.js';

const FOCUSABLE='button:not([disabled]),[href],input,select,textarea,[tabindex]:not([tabindex="-1"])';
/** The stage folds in 320 ms; the ring waits for it, and for lazy targets (the 3D tour, a delayed composer). */
const FOLD_MS=340, HUNT_MS=3200, RING_PAD=6, IDLE_MS=4000;

/** The house from the inmuebles24 logo, without the wordmark. */
function Mark() {
  return <svg viewBox="0 0 13.6 27.5" fill="#ff5500" aria-hidden="true">
    <path d="M0.500088 21.8495C-0.136222 22.0839 -0.174783 22.9842 0.438887 23.2733L2.86086 24.4157C3.04362 24.5018 3.25237 24.5103 3.44184 24.4395L9.19374 22.2868V18.6499L0.500088 21.8495Z"/>
    <path d="M6.84874 24.8675C6.21404 25.1045 6.17804 26.0039 6.79254 26.2912L9.19274 27.4149V23.9936L6.84874 24.8675Z"/>
    <path d="M13.5421 6.03634C13.5421 2.62444 10.758 -0.126758 7.37444 0.00454177C4.28354 0.124742 1.77182 2.69774 1.67457 5.84194C1.5857 8.70994 3.46614 11.1448 6.04404 11.8592V14.4868L0.523518 16.5193C-0.112782 16.7537 -0.151343 17.654 0.462317 17.943L2.8843 19.0854C3.06706 19.1715 3.27584 19.1801 3.46524 19.1093L9.19194 16.9668V11.8524C11.7003 11.1473 13.5429 8.81134 13.5429 6.03544L13.5421 6.03634ZM7.61254 8.87954C6.07754 8.87954 4.83344 7.61434 4.83344 6.05334C4.83344 4.49234 6.07754 3.22714 7.61254 3.22714C9.14754 3.22714 10.3916 4.49234 10.3916 6.05334C10.3916 7.61434 9.14754 8.87954 7.61254 8.87954Z"/>
  </svg>;
}

function visibleTarget(selector) {
  for (const node of document.querySelectorAll(selector)) {
    if (node.closest('[inert],[aria-hidden="true"]')) continue;
    const rect=node.getBoundingClientRect();
    if (rect.width>0&&rect.height>0) return node;
  }
  return null;
}

/** Draws once around the element where the redirect landed, following it while the page settles. */
function Ring({target,onDone}) {
  const ring=useRef(null);
  const radius=parseFloat(getComputedStyle(target).borderTopLeftRadius)||0;
  useLayoutEffect(()=>{
    let frame;
    const place=()=>{
      const el=ring.current;if(!el)return;
      const rect=target.getBoundingClientRect();
      const left=Math.max(4,rect.left-RING_PAD),top=Math.max(4,rect.top-RING_PAD);
      const right=Math.min(innerWidth-4,rect.right+RING_PAD),bottom=Math.min(innerHeight-4,rect.bottom+RING_PAD);
      el.style.transform=`translate(${left}px,${top}px)`;
      el.style.width=`${Math.max(0,right-left)}px`;el.style.height=`${Math.max(0,bottom-top)}px`;
      frame=requestAnimationFrame(place);
    };
    place();
    return()=>cancelAnimationFrame(frame);
  },[target]);
  return <div ref={ring} className="pg-ring" aria-hidden="true" onAnimationEnd={event=>{if(event.target===event.currentTarget)onDone();}}>
    <svg><rect width="100%" height="100%" rx={radius+RING_PAD} pathLength="1"/></svg>
  </div>;
}

export function ProjectGuide({onAction, searchLayout='original'}) {
  const reduce=useReducedMotion();
  const [open,setOpen]=useState(false),[expanded,setExpanded]=useState(null);
  const [ring,setRing]=useState(null),[settling,setSettling]=useState(false),[idle,setIdle]=useState(false);
  const root=useRef(null),stage=useRef(null),fab=useRef(null),hunt=useRef({frame:0,timer:0});
  const id=useId();

  function stopHunt() {
    cancelAnimationFrame(hunt.current.frame);clearTimeout(hunt.current.timer);setRing(null);
  }
  function show() {stopHunt();setSettling(false);setOpen(true);}
  function hide(restoreFocus=true) {
    setOpen(false);
    if(restoreFocus)requestAnimationFrame(()=>fab.current?.focus({preventScroll:true}));
  }

  useEffect(()=>{
    if(!open)return;
    const frame=requestAnimationFrame(()=>stage.current?.querySelector('.pg-row')?.focus({preventScroll:true}));
    // Window capture runs before the panels' own document listeners, so Esc and Tab stay with the guide.
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
  useEffect(()=>()=>{cancelAnimationFrame(hunt.current.frame);clearTimeout(hunt.current.timer);},[]);
  // After a few quiet seconds the button tucks into the left edge; hover or keyboard focus brings it back.
  useEffect(()=>{
    setIdle(false);
    if(open||settling)return;
    const timer=setTimeout(()=>setIdle(true),IDLE_MS);
    return()=>clearTimeout(timer);
  },[open,settling]);

  function spotlight(selector) {
    const started=performance.now();
    const find=()=>{
      const target=visibleTarget(selector);
      if(!target){if(performance.now()-started<HUNT_MS)hunt.current.frame=requestAnimationFrame(find);return;}
      const rect=target.getBoundingClientRect();
      const offscreen=rect.bottom<0||rect.top>innerHeight;
      if(offscreen)target.scrollIntoView({block:'center',behavior:'smooth'});
      const wait=Math.max(0,FOLD_MS-(performance.now()-started))+(offscreen?480:0);
      hunt.current.timer=setTimeout(()=>setRing({target,key:performance.now()}),wait);
    };
    hunt.current.frame=requestAnimationFrame(find);
  }

  function act(action) {
    stopHunt();
    // The destination starts painting while the stage folds back into the button.
    hide(false);
    if(document.activeElement instanceof HTMLElement&&stage.current?.contains(document.activeElement))document.activeElement.blur();
    onAction(action.id);
    if(!reduce)setSettling(true);
    if(action.target&&!reduce)spotlight(action.target);
  }

  return <div ref={root} className="pg" data-open={open||undefined} data-idle={idle||undefined} data-project-guide="">
    <button ref={fab} type="button" className="pg-fab" aria-label="Open guide" aria-expanded={open} aria-controls={`${id}-stage`}
      data-settle={settling||undefined} onAnimationEnd={()=>setSettling(false)} onClick={show} tabIndex={open?-1:0}>
      <Mark/>
    </button>
    <section ref={stage} id={`${id}-stage`} className="pg-stage" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} inert={!open} aria-hidden={!open||undefined}>
      <header className="pg-head" style={{'--i':0}}>
        <div>
          <p className="pg-eyebrow">GUIDE</p>
          <h2 className="pg-count" id={`${id}-title`}>Ten stops</h2>
        </div>
        <button type="button" className="pg-close" aria-label="Close guide" onClick={()=>hide()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>
        </button>
      </header>
      <ol className="pg-index">
        {GUIDE_STOPS.map((stop,index)=>{
          const isOpen=expanded===stop.id,detail=`${id}-${stop.id}`;
          return <li key={stop.id} className="pg-item" style={{'--i':index+1}} data-expanded={isOpen||undefined}>
            <button type="button" className="pg-row" aria-expanded={isOpen} aria-controls={detail} onClick={()=>setExpanded(isOpen?null:stop.id)}>
              <span className="pg-num">{String(index+1).padStart(2,'0')}</span>
              <span className="pg-title">{stop.title}</span>
              <span className="pg-toggle" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
            </button>
            <div className="pg-detail" id={detail} inert={!isOpen}>
              <div className="pg-detail-inner">
                <p className="pg-body">{stop.body}</p>
                <div className="pg-actions">
                  {stop.actions.map((action,actionIndex)=><button type="button" key={action.id} className="pg-pill" data-primary={(action.layout?searchLayout===action.layout:actionIndex===0)||undefined} onClick={()=>act(action)}>{action.label}</button>)}
                </div>
              </div>
            </div>
          </li>;
        })}
      </ol>
    </section>
    {ring&&<Ring key={ring.key} target={ring.target} onDone={()=>setRing(null)}/>}
  </div>;
}
