import {discoveryEntrance} from './homeMotion';

const ease = 'cubic-bezier(.22,1,.36,1)';
const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
const collapseDuration = 520, sweepStart = 600, sweepDuration = 1200, itemDuration = 240;
let pendingHome = null;
let activeHome = null;

function visualCopy(node) {
  const clone = node.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  clone.inert = true; clone.setAttribute('aria-hidden', 'true');
  return clone;
}

export function captureHomeTransition() {
  activeHome?.(); pendingHome = null;
  const fold = document.querySelector('.home-firstfold');
  if (!fold || reduced()) return;
  const content = visualCopy(fold);
  // cloneNode does not preserve the position of the infinite inspiration rail.
  const originals = [...fold.querySelectorAll('*')], copies = [...content.querySelectorAll('*')];
  originals.forEach((el,index) => {if (el.scrollLeft) copies[index].dataset.snapshotScroll = el.scrollLeft;});
  pendingHome = {rect:fold.getBoundingClientRect(),content};
}

function loadSkeletonCards(root,play,cleanups,filtersEnd) {
  const grid = root.querySelector('.flow-grid');
  if (!grid) return;
  const wrappers = [...grid.querySelectorAll('.flow-result-item')];
  const visible = wrappers.filter(item => {const box=item.getBoundingClientRect();return box.top<innerHeight && box.bottom>0;});
  const wasBusy = grid.getAttribute('aria-busy'), wasInert = grid.inert;
  grid.classList.add('transition-skeleton-loading');
  grid.setAttribute('aria-busy','true'); grid.inert = true;
  const skeletons = wrappers.map(item => {
    const node = document.createElement('div');
    node.className = 'transition-house-skeleton'; node.setAttribute('aria-hidden','true');
    // Figma 587:13297; the real HouseCard remains underneath.
    node.innerHTML = `<div class="transition-skeleton-media">
      <span class="transition-skeleton-heart"><img src="/assets/figma-transition/heart-base.svg" alt=""><img src="/assets/figma-transition/heart-stroke.svg" alt=""></span>
      <div class="transition-skeleton-price"><span></span><span></span></div>
    </div><div class="transition-skeleton-meta"><div><span></span><span></span></div><span class="transition-skeleton-logo"></span></div>`;
    item.append(node); return node;
  });
  const start = collapseDuration * .35;
  const contentAt = Math.max(filtersEnd+500,start+900+Math.max(0,visible.length-1)*65);
  visible.forEach((item,index) => play(item,discoveryEntrance(),start+index*65,900));
  wrappers.forEach(item => play(item.querySelector('.discovery-item'),[{opacity:0},{opacity:1}],contentAt,200,{easing:'linear'}));
  skeletons.forEach(node => play(node,[{opacity:1},{opacity:0}],contentAt,200,{easing:'linear'}));
  cleanups.push(() => {
    skeletons.forEach(node => node.remove());
    grid.classList.remove('transition-skeleton-loading'); grid.inert = wasInert;
    if (wasBusy===null) grid.removeAttribute('aria-busy'); else grid.setAttribute('aria-busy',wasBusy);
    // Removing the temporary class must not replay the generic results entrance.
    wrappers.forEach(item => item.getAnimations().filter(a => a instanceof CSSAnimation && a.animationName==='flow-result-in').forEach(a => a.finish()));
  });
}

/** Onda: clip the home into the bar, sweep its colors, then reveal the real cards. */
export function playHomeTransition(root) {
  let cancel = () => {};
  // Deferring consumption keeps the snapshot through StrictMode's setup/cleanup pass.
  const frame = requestAnimationFrame(() => {
    if (!pendingHome || reduced()) {pendingHome=null;return;}
    const from = pendingHome; pendingHome = null;
    const bar = root.querySelector('.mora-bar');
    if (!bar) return;
    const target = bar.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'transition-scene home-evolution'; layer.dataset.direction = 'Onda';
    layer.inert = true; layer.setAttribute('aria-hidden','true');
    const surface = document.createElement('div'); surface.className = 'transition-plane transition-collapse-mask';
    Object.assign(surface.style,{top:`${from.rect.top}px`,height:`${from.rect.height}px`});
    const content = from.content; content.classList.add('transition-old');
    Object.assign(content.style,{top:'0',width:`${from.rect.width}px`,height:`${from.rect.height}px`,borderBottomColor:'transparent'});
    surface.append(content);
    const divider = document.createElement('div'); divider.className = 'transition-divider';
    divider.style.top = `${from.rect.bottom-1}px`;
    const destination = visualCopy(bar); destination.classList.add('transition-destination');
    Object.assign(destination.style,{top:`${target.top}px`,left:`${target.left}px`,width:`${target.width}px`,height:`${target.height}px`});
    layer.append(surface,divider,destination); document.body.append(layer);
    content.querySelectorAll('[data-snapshot-scroll]').forEach(el => el.scrollLeft=Number(el.dataset.snapshotScroll));
    const liveOpacity = bar.style.opacity; bar.style.opacity = '0';
    const animations = [], cleanups = [];
    const play = (el,frames,delay=0,duration=240,options={}) => {
      if (!el) return;
      const animation = el.animate(frames,{delay,duration,easing:ease,fill:'both',...options});
      animations.push(animation); return animation;
    };
    const controls = [...destination.querySelectorAll('.mora-filter'),destination.querySelector('.mora-more'),destination.querySelector('.mora-smart-trigger')].filter(Boolean);
    const items = controls.map(button => {
      const inner = document.createElement('span'); inner.className = 'transition-control-content';
      inner.append(...button.childNodes); button.append(inner); return inner;
    });
    const positions = items.map(item => {
      const bounds = item.getBoundingClientRect();
      return Math.max(0,Math.min(1,(bounds.left+bounds.width/2-target.left)/target.width));
    });
    const rail = destination.querySelector('.mora-filter-scroll');
    rail.parentElement.dataset.scrollEnd = String(rail.scrollWidth-rail.clientWidth-rail.scrollLeft<=1);
    const firstContent = content.querySelector('.home-search h1').getBoundingClientRect().top-from.rect.top;
    const tuck = Math.max(0,target.height-firstContent+2);
    play(surface,[{clipPath:'inset(0px 0px 0px)',transform:'translateY(0)'},{clipPath:`inset(0px 0px ${from.rect.height-target.height}px)`,transform:`translateY(${target.top-from.rect.top}px)`}],0,collapseDuration);
    play(divider,[{transform:'translateY(0)'},{transform:`translateY(${target.bottom-from.rect.bottom}px)`}],0,collapseDuration);
    play(divider,[{visibility:'visible'},{visibility:'hidden'}],0,collapseDuration,{easing:'steps(1,end)'});
    play(content,[{transform:'translateY(0)'},{transform:`translateY(${tuck}px)`}],0,collapseDuration);
    play(destination,[{visibility:'hidden'},{visibility:'visible'}],0,collapseDuration,{easing:'steps(1,end)'});
    const wash = document.createElement('div'); wash.className = 'transition-bar-wash';
    const light = document.createElement('div'); light.className = 'transition-bar-sweep';
    light.style.width = `${target.width*3}px`; wash.append(light); destination.append(wash);
    play(light,[{transform:`translateX(${-target.width*3}px)`},{transform:`translateX(${target.width}px)`}],sweepStart,sweepDuration,{easing:'linear'});
    const revealAt = positions.map(position => sweepStart+(.5+position/4)*sweepDuration);
    items.forEach((item,index) => play(item,[{opacity:0,transform:'translateY(4px)',filter:'blur(2px)'},{opacity:1,transform:'none',filter:'blur(0)'}],revealAt[index],itemDuration));
    const filtersEnd = Math.max(sweepStart+sweepDuration,...revealAt.map(start => start+itemDuration));
    loadSkeletonCards(root,play,cleanups,filtersEnd);
    play(root.querySelector('.flow-results-heading'),[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'none'}],collapseDuration*.55,550);
    play(document.querySelector('.site-footer'),[{opacity:0},{opacity:1}],filtersEnd,200);
    let timer, closed = false;
    const media = matchMedia('(prefers-reduced-motion:reduce)');
    const startScroll = {x:scrollX,y:scrollY};
    // Navigation may dispatch a queued scroll event after already reaching (0, 0).
    const onScroll = () => {if (scrollX!==startScroll.x || scrollY!==startScroll.y) finish();};
    const finish = () => {
      if (closed) return; closed = true; clearTimeout(timer);
      animations.forEach(a => a.cancel()); cleanups.forEach(cleanup => cleanup());
      layer.remove(); bar.style.opacity = liveOpacity;
      window.removeEventListener('pointerdown',finish); window.removeEventListener('keydown',finish);
      window.removeEventListener('resize',finish); window.removeEventListener('scroll',onScroll);
      document.removeEventListener('visibilitychange',onVisibility); media.removeEventListener('change',finish);
      if (activeHome===finish) activeHome = null;
    };
    const onVisibility = () => {if (document.hidden) finish();};
    cancel = finish; activeHome = finish;
    timer = setTimeout(finish,Math.max(...animations.map(a => a.effect.getComputedTiming().endTime))+50);
    window.addEventListener('pointerdown',finish); window.addEventListener('keydown',finish);
    window.addEventListener('resize',finish); window.addEventListener('scroll',onScroll,{passive:true});
    document.addEventListener('visibilitychange',onVisibility); media.addEventListener('change',finish);
  });
  return () => {cancelAnimationFrame(frame);cancel();};
}

/** Keep the visible edge continuous when an opening or closing is interrupted. */
export function measureBar(bar) {
  if (!bar) return null;
  return {height:(bar.querySelector('.mora-bar-surface')||bar).getBoundingClientRect().height};
}

export function animateBar(bar, before, enabled=true, onComplete=()=>{}, revealContent=true) {
  if (!bar || !before || !enabled || reduced()) {onComplete();return () => {};}
  const height=bar.getBoundingClientRect().height, delta=before.height-height;
  const expanding=delta<0, duration=expanding?260:200;
  const overflow=bar.style.overflow;
  // Reveal one finished layout. Individual filters never fly between the two arrangements.
  bar.style.overflow='visible';
  const animations=[];
  const play=(el,frames,options={})=>{if(el)animations.push(el.animate(frames,{duration,easing:'cubic-bezier(.25,1,.5,1)',fill:'both',...options}));};
  play(bar,[{clipPath:`inset(0 0 ${-delta}px)`},{clipPath:'inset(0)'}]);
  play(bar.querySelector('.mora-bar-surface'),[{transform:`scaleY(${before.height/height})`},{transform:'scaleY(1)'}]);
  play(bar.querySelector('.mora-bar-divider'),[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}]);
  play(bar.closest('.search-flow-page')?.querySelector('.flow-results-content'),[{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}]);
  if(revealContent)play(bar.querySelector('.mora-expanded, .mora-collapsed'),[{opacity:0,transform:`translateY(${expanding?6:0}px)`},{opacity:1,transform:'translateY(0)'}],{duration:expanding?180:140,delay:expanding?40:20});
  const media=matchMedia('(prefers-reduced-motion:reduce)');
  let timer,finished=false;
  const finish=(completed=false)=>{
    if(finished)return;finished=true;clearTimeout(timer);
    animations.forEach(a=>a.cancel());bar.style.overflow=overflow;
    media.removeEventListener('change',complete);window.removeEventListener('resize',complete);window.removeEventListener('keydown',complete);
    if(completed)onComplete();
  };
  const complete=()=>finish(true);
  media.addEventListener('change',complete);window.addEventListener('resize',complete);window.addEventListener('keydown',complete);
  Promise.all(animations.map(animation=>animation.finished)).then(complete,()=>{});
  timer=setTimeout(complete,duration+30);
  return ()=>finish();
}
