import {SOFT_MOTION} from './homeIntro.js';

// The selected Holofote direction, including Órbita ideas and Onda discovery.
// One controller owns the active home or results surface.
const ease = 'cubic-bezier(.22,1,.36,1)';
export const discoveryEntrance = () => [{opacity:0,transform:'translateY(48px) scale(.92)',filter:'blur(12px)'},{offset:.75,opacity:1,transform:'translateY(-4px) scale(1.02)',filter:'blur(0)'},{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'}];
const frames = {
  ink: () => [{opacity:0,transform:'translateY(2px)',filter:'blur(2px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],
  resultsInk: () => [{opacity:0,transform:'translateY(1px)'},{opacity:1,transform:'translateY(0)'}],
  heading: () => [{opacity:0,transform:'translateY(8px) scale(1.06)',filter:'blur(5px)'},{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'}],
  menu: () => [{opacity:0,transform:'translateY(10px) scale(.97)',filter:'blur(3px)'},{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'}],
  exit: () => [{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'},{opacity:0,transform:'translateY(-6px) scale(.985)',filter:'blur(2px)'}],
  row: () => [{opacity:0,transform:'translateY(12px)',filter:'blur(3px)'},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],
  chevron: () => [{opacity:0,transform:'translateX(-8px) scale(.7)',filter:'blur(2px)'},{opacity:1,transform:'translateX(0) scale(1)',filter:'blur(0)'}],
  idea: () => [{opacity:0,transform:'perspective(1200px) translateZ(-240px)',filter:'blur(6px)'},{opacity:1,transform:'perspective(1200px) translateZ(0)',filter:'blur(0)'}],
  discovery: discoveryEntrance,
  step: () => [{opacity:.65,transform:'scale(1.15)',filter:'blur(2px)'},{opacity:1,transform:'scale(1)',filter:'blur(0)'}],
  pill: () => [{opacity:0,translate:'0 8px',scale:.92,filter:'blur(4px)'},{opacity:1,translate:'0 0',scale:1,filter:'blur(0)'}],
};

let activeController = null;
export const playMenu = (...args) => activeController?.menu(...args);
export const playSelection = (...args) => activeController?.selection(...args);
export const playIdeaPreview = (...args) => activeController?.preview(...args) ?? null;

export function installHomeMotion(root) {
  const controller = createHomeMotion(root);
  activeController = controller;
  document.body.dataset.homeMotion = 'holofote';
  return () => {
    controller.dispose();
    if (activeController === controller) {
      activeController = null;
      delete document.body.dataset.homeMotion;
    }
  };
}

function createHomeMotion(root) {
  const animations = new Set(), pending = new Set(), sweeps = new Map();
  const seen = new WeakSet(), sections = new WeakSet(), observedSections = new WeakSet();
  const media = matchMedia('(prefers-reduced-motion:reduce)');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  let disposed = false, stage = -1, pointer = true;
  const enabled = () => !disposed && !media.matches && !document.hidden;

  function play(el, keyframes, duration=620, delay=0, finish) {
    if (!el || !enabled()) {finish?.(); return null;}
    const animation = el.animate(keyframes, {duration,delay,easing:ease,fill:'both'});
    animations.add(animation);
    animation.onfinish = () => {animation.cancel(); finish?.();};
    animation.oncancel = () => animations.delete(animation);
    return animation;
  }
  function nextFrame(fn) {
    const id = requestAnimationFrame(() => {pending.delete(id); if (enabled()) fn();});
    pending.add(id);
  }
  function sweepText(el, fromColor, speed=1) {
    if (!enabled() || !el?.isConnected) return;
    sweeps.get(el)?.();
    const base = getComputedStyle(el).color;
    const intro = el.closest('.home-word-control.just-morphed:not(.is-chosen)');
    const colors = {'--sweep-from':fromColor || base,'--sweep-to':intro ? getComputedStyle(intro).getPropertyValue('--home-suggested').trim() : base};
    const previous = Object.fromEntries(Object.keys(colors).map(key => [key,el.style.getPropertyValue(key)]));
    for (const [key,value] of Object.entries(colors)) el.style.setProperty(key,value);
    if (intro) el.classList.add('motion-intro-sweep');
    el.classList.add('motion-glyph-sweep');
    let animation, closed = false;
    const close = () => {
      if (closed) return;
      closed = true; animation?.cancel();
      el.classList.remove('motion-glyph-sweep','motion-intro-sweep');
      for (const [key,value] of Object.entries(previous)) {
        if (value) el.style.setProperty(key,value); else el.style.removeProperty(key);
      }
      sweeps.delete(el);
    };
    sweeps.set(el,close);
    animation = play(el,[
      {backgroundPosition:'100% 50%',filter:'drop-shadow(0 0 0px #ff550000)'},
      {offset:.35,filter:'drop-shadow(0 0 4px #07358f38)'},
      {offset:.65,filter:'drop-shadow(0 0 4px #ff553b38)'},
      {backgroundPosition:'0% 50%',filter:'drop-shadow(0 0 0px #ff550000)'},
    ],SOFT_MOTION.sweep/speed,0,close);
    animation?.effect.updateTiming({easing:'linear'});
  }
  function revealPills(card, cardDelay) {
    const pills = card.querySelectorAll('.home-pill');
    if (!pills.length) return;
    // The card lands first. Each pill then loads on its own.
    const start = cardDelay + 420;
    pills.forEach((pill, index) => play(pill, frames.pill(), 460, start + index * 150));
  }
  function revealCard(card,index,template=false) {
    const delay = index * 65;
    if (!template) {play(card,frames.discovery(),900,delay); revealPills(card, delay); return;}
    play(card,frames.idea(),1000,delay);
    play(card.querySelector('.idea-title'),frames.row(),650,delay+200);
    card.querySelectorAll('.idea-photo img').forEach((img,i) => play(img,[{transform:'scale(1.2)',filter:'brightness(.7)'},{transform:'scale(1)',filter:'brightness(1)'}],950,delay+i*75));
  }
  const scrollSection = '.idea-section,.discovery-section,.home-blog,.home-brokers,.home-links,.catalog-footer';
  // The guest promo is tall and already peeks into the first fold, so it waits until it has actually entered.
  const guestReveal = '.home-guest-promo-reveal';
  const revealCardSelector = '.idea-card,.discovery-item,.home-city,.neighborhood-item,.home-blog-feature,.home-blog-item,.home-links-cols>div,.home-brokers-fan,.home-brokers>p,.home-brokers-all,.home-guest-promo-join,.home-guest-promo-card,.catalog-footer-top,.catalog-footer-grid>div,.catalog-wordmark,.catalog-legal';
  function showSection(section) {
    if (sections.has(section) || stage < 3) return;
    sections.add(section); delete section.dataset.motionPending;
    const heading = section.querySelector('.discovery-heading, .home-blog-head') || section.querySelector(':scope > h2');
    play(heading,[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],550);
    // The whole list starts together. Cards past the fold still belong to this entrance.
    section.querySelectorAll(revealCardSelector).forEach((card,index) => revealCard(card,index));
  }
  function stages() {
    const next = Number(root.dataset.introStage);
    if (next === stage) return;
    stage = next;
    if (stage >= 3) document.querySelectorAll(`${scrollSection},${guestReveal}`).forEach(section => {
      const bounds = section.getBoundingClientRect();
      const limit = section.matches(guestReveal) ? innerHeight * 0.72 : innerHeight;
      if (bounds.top < limit && bounds.bottom > 0) showSection(section);
    });
  }
  function inspect(el) {
    if (!(el instanceof Element) || seen.has(el)) return;
    // Only the streamed results entrance has a faster clock; menus and selections keep theirs.
    const streamed = el.closest('[data-streamed-results]');
    const introSpeed = Number(streamed?.dataset.introSpeed) || 1;
    if (el.matches('.home-soft-word')) {
      seen.add(el);
      // Overlapping fades keep the faster results cadence soft and continuous.
      play(el,streamed ? frames.resultsInk() : frames.ink(),streamed ? 250 : SOFT_MOTION.fade,(Number(el.dataset.revealDelay)||0)/introSpeed)?.effect.updateTiming({easing:streamed ? 'cubic-bezier(.22,.61,.36,1)' : 'cubic-bezier(.25,.1,.25,1)'});
    } else if (el.matches('.home-word-control.just-morphed')) {
      seen.add(el); sweepText(el.querySelector('.home-choice-label'),undefined,introSpeed);
      const chevron = el.querySelector('.home-chevron'), motion = frames.chevron();
      motion[0].width = '0px'; motion.at(-1).width = getComputedStyle(chevron).width;
      play(chevron,motion,SOFT_MOTION.chevron/introSpeed,SOFT_MOTION.chevronDelay/introSpeed);
    } else if (el.matches('.detail-token.token-converted,.detail-token.token-selected,.home-choice-label.just-selected')) {
      seen.add(el);
      if ((pointer || el.matches('.token-converted')) && !el.closest('[data-next-selecting]')) sweepText(el.matches('.detail-token') ? el.querySelector('span') : el);
    } else if (el.matches('.home-bed-stepper output')) {
      seen.add(el); if (pointer) sweepText(el);
    } else if (el.matches('.home-start-slot[data-visible="true"]')) {
      seen.add(el); play(el,frames.heading(),700);
    }
  }
  const nodes = '.home-soft-word,.home-word-control.just-morphed,.detail-token.token-converted,.detail-token.token-selected,.home-choice-label.just-selected,.home-bed-stepper output,.home-start-slot[data-visible="true"]';
  const intersection = new IntersectionObserver(entries => entries.forEach(({target,isIntersecting}) => {if (isIntersecting) showSection(target);}),{threshold:.08});
  const guestIntersection = new IntersectionObserver(entries => entries.forEach(({target,isIntersecting}) => {if (isIntersecting) showSection(target);}),{threshold:0,rootMargin:'0px 0px -28% 0px'});
  function observeSection(section, observer = intersection) {
    if (observedSections.has(section)) return;
    observedSections.add(section);
    if (!media.matches) section.dataset.motionPending = 'true';
    observer.observe(section);
  }
  function visit(node) {
    if (!(node instanceof Element)) return;
    inspect(node); node.querySelectorAll(nodes).forEach(inspect);
    if (node.matches(scrollSection)) observeSection(node);
    node.querySelectorAll(scrollSection).forEach(section => observeSection(section));
    if (node.matches(guestReveal)) observeSection(node, guestIntersection);
    node.querySelectorAll(guestReveal).forEach(section => observeSection(section, guestIntersection));
  }
  // Expand actual inline space for the chevron; FLIP only line changes.
  const layoutPositions = new Map(), layoutMoves = new Map();
  const layoutNodes = [...root.querySelectorAll('.home-phrase-group,.home-detail-row')];
  const layout = new ResizeObserver(() => {
    const reading = root.querySelector('.home-sentence[aria-busy=true]');
    for (const el of layoutNodes) {
      const position = {x:el.offsetLeft,y:el.offsetTop}, previous = layoutPositions.get(el);
      layoutPositions.set(el,position);
      if (!reading || !previous || previous.y === position.y || !enabled()) continue;
      const ongoing = layoutMoves.get(el);
      const shift = ongoing ? new DOMMatrixReadOnly(getComputedStyle(el).transform) : {m41:0,m42:0};
      ongoing?.cancel();
      const animation = play(el,[{transform:`translate(${previous.x-position.x+shift.m41}px,${previous.y-position.y+shift.m42}px)`},{transform:'translate(0,0)'}],360,0,() => layoutMoves.delete(el));
      if (animation) layoutMoves.set(el,animation);
    }
  });
  for (const el of layoutNodes) {layoutPositions.set(el,{x:el.offsetLeft,y:el.offsetTop}); layout.observe(el);}
  const sentence = root.querySelector('.home-sentence');
  if (sentence) layout.observe(sentence);
  const mutation = new MutationObserver(records => {
    if (disposed) return;
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(visit);
      else if (record.target === root) stages();
      else if (record.target.matches('.home-start') && !record.target.disabled) play(record.target,frames.step(),550);
      else {
        if (record.target.matches('.home-word-control:not(.just-morphed)')) {
          const label = record.target.querySelector('.motion-intro-sweep');
          if (label) sweeps.get(label)?.();
        }
        inspect(record.target);
      }
    }
    for (const [el,close] of sweeps) if (!el.isConnected) close();
  });
  mutation.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-visible','data-intro-stage','disabled']});
  visit(root);
  document.querySelectorAll('.catalog-footer').forEach(section => observeSection(section));
  stages(); play(root.querySelector('.home-search h1'),frames.heading(),650);

  function resetCardHover(card) {
    delete card.dataset.motionHover;
    const surface = card.matches('.photo-stack,.region-fan') ? card : card.querySelector('.photo-stack,.discovery-media,.neighborhood-card');
    if (surface) surface.style.transform = '';
    card.querySelectorAll('.discovery-tags,.discovery-like').forEach(control => {control.style.translate = '';});
  }
  function stop() {
    for (const id of pending) cancelAnimationFrame(id);
    pending.clear();
    for (const animation of animations) animation.cancel();
    animations.clear(); layoutMoves.clear();
    for (const close of [...sweeps.values()]) close();
    root.querySelectorAll('.idea-card[data-motion-hover],.home-guest-promo-fan[data-motion-hover],.region-fan[data-motion-hover],.discovery-item[data-motion-hover],.neighborhood-item[data-motion-hover]').forEach(resetCardHover);
    root.querySelectorAll('[data-next-selecting]').forEach(el => delete el.dataset.nextSelecting);
  }
  function move(event) {
    if (!enabled() || !finePointer.matches) return;
    const card = event.target.closest('.idea-card,.home-guest-promo-fan,.region-fan,.home-evolution .discovery-item,.home-evolution .neighborhood-item');
    if (card && root.contains(card)) {
      const bounds = card.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const x = (event.clientX-bounds.left)/bounds.width-.5, y = (event.clientY-bounds.top)/bounds.height-.5;
      if (card.matches('.idea-card,.home-guest-promo-fan,.region-fan')) {
        const stack = card.matches('.home-guest-promo-fan,.region-fan') ? card : card.querySelector('.photo-stack');
        if (stack) stack.style.transform = `perspective(600px) rotateY(${x*18}deg) rotateX(${-y*12}deg) translateY(-6px) scale(1.06)`;
      }
      else if (card.matches('.neighborhood-item')) {
        const surface = card.querySelector('.neighborhood-card'), dx = x*9, dy = y*6;
        surface.style.transform = `translate(${dx}px,${dy}px) scale(1.05)`;
      } else {
        const photo = card.querySelector('.discovery-media'), dx = x*9, dy = y*6;
        // The photo scales from center 60%; fixed-size controls follow its top corners.
        const side = photo.offsetWidth*.05*.5, top = photo.offsetHeight*.05*.6;
        photo.style.transform = `translate(${dx}px,${dy}px) scale(1.05)`;
        const tags = card.querySelector('.discovery-tags');
        if (tags) tags.style.translate = `${dx-side}px ${dy-top}px`;
        const like = card.querySelector('.discovery-like');
        if (like) like.style.translate = `${dx+side}px ${dy-top}px`;
      }
      card.dataset.motionHover = 'true';
    }
  }
  function leave(event) {
    const card = event.target.closest('.idea-card,.home-guest-promo-fan,.region-fan,.home-evolution .discovery-item,.home-evolution .neighborhood-item');
    if (card && root.contains(card) && !card.contains(event.relatedTarget)) {
      resetCardHover(card);
    }
  }
  function clicked(event) {
    if (!event.detail || !enabled()) return;
    const step = event.target.closest('.home-step');
    if (step && !step.disabled) {
      play(step,frames.step(),400);
      const panel = step.closest('.home-popover');
      nextFrame(() => sweepText(panel?.querySelector('.home-bed-stepper output')));
    }
    const remove = event.target.closest('.detail-token button[aria-label]');
    if (remove) play(remove,frames.step(),400);
  }
  function keyboard(event) {
    pointer = false;
    if (['Tab','Escape','ArrowDown','ArrowUp','Enter',' '].includes(event.key)) stop();
    const section = event.target.closest(`${scrollSection},${guestReveal}`);
    if (section) {delete section.dataset.motionPending; sections.add(section);}
  }
  const down = () => {pointer = true;};
  const visibility = () => {if (document.hidden) stop();};
  const reduce = () => {if (media.matches) {stop(); document.querySelectorAll('[data-motion-pending]').forEach(el => delete el.dataset.motionPending);}};
  const listeners = [['pointermove',move],['pointerout',leave],['pointerdown',down,true],['click',clicked,true],['keydown',keyboard,true],['visibilitychange',visibility]];
  for (const [type,handler,capture] of listeners) document.addEventListener(type,handler,capture);
  window.addEventListener('resize',stop); media.addEventListener('change',reduce);

  return {
    preview(panel,open,motion,anchor,interrupted) {
      if (!panel || !motion || !enabled()) return null;
      const towardAnchor = panel.offsetTop >= anchor.bottom ? -1 : 1;
      const originX = Math.max(20,Math.min(panel.offsetWidth-20,anchor.left+anchor.width/2-panel.offsetLeft));
      panel.style.transformOrigin = `${originX}px ${towardAnchor < 0 ? 'top' : 'bottom'}`;
      const motionFrames = (open ? frames.menu : frames.exit)();
      if (open) motionFrames[0].transform = `translateY(${12*towardAnchor}px) scale(.95)`;
      else motionFrames.at(-1).transform = `translateY(${6*towardAnchor}px) scale(.97)`;
      if (interrupted) motionFrames[0] = interrupted;
      return play(panel,motionFrames,open ? 420 : 220);
    },
    menu(panel,open,motion) {
      if (!panel) return;
      const ongoing = panel.getAnimations(), style = getComputedStyle(panel);
      const interrupted = ongoing.length ? {opacity:style.opacity,transform:style.transform,filter:style.filter} : null;
      ongoing.forEach(animation => animation.cancel());
      if (!motion || !enabled()) return;
      const motionFrames = (open ? frames.menu : frames.exit)();
      if (interrupted) motionFrames[0] = interrupted;
      play(panel,motionFrames,open ? 420 : 220);
      if (open) {
        panel.querySelectorAll('.home-option,.home-step,.home-price-fields label').forEach((el,i) => play(el,frames.row(),440,Math.min(i,6)*65));
        panel.querySelectorAll('.price-histogram-bar').forEach((bar,i) => {
          bar.style.transformOrigin = 'center bottom';
          play(bar,[{opacity:.1,filter:'brightness(2.5)'},{opacity:1,filter:'brightness(1)'}],520,i*18);
        });
      }
    },
    selection(option,anchor) {
      if (!enabled() || !anchor) return;
      const fromColor = getComputedStyle(anchor).color;
      anchor.dataset.nextSelecting = 'true';
      nextFrame(() => {
        const el = anchor.querySelector('.home-choice-label') || root.querySelector('.detail-token.token-selected>span');
        if (el?.isConnected) {seen.add(el); sweepText(el,fromColor);}
        delete anchor.dataset.nextSelecting;
      });
    },
    dispose() {
      disposed = true; stop(); layout.disconnect(); mutation.disconnect(); intersection.disconnect(); guestIntersection.disconnect();
      document.querySelectorAll('[data-motion-pending]').forEach(el => delete el.dataset.motionPending);
      for (const [type,handler,capture] of listeners) document.removeEventListener(type,handler,capture);
      window.removeEventListener('resize',stop); media.removeEventListener('change',reduce);
    },
  };
}
