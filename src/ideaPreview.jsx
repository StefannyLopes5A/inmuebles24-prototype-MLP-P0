import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {areaLabel, listingPrice, propertyPhoto} from './data.js';
import {developmentFacts, developmentKind} from './development/listingFacts.js';
import {Icon} from './App.jsx';
import {bathCount, roomCount, useLanguage} from './i18n.jsx';
import {playIdeaPreview} from './homeMotion.js';

function ListingCopy({home: h}) {
  const {t, language, money, currency} = useLanguage();
  if (h.development) return <><span>{developmentKind(language)}</span><strong>{money(listingPrice(h))} <small>{currency}</small></strong><b>{h.street} · {h.area}</b><span>{developmentFacts(language).join(' · ')}</span></>;
  return <><span>{t(h.mode === 'buy' ? 'Venta' : 'Renta')} · {t('Departamento')}</span><strong>{money(listingPrice(h))} <small>{currency}{h.mode === 'rent' ? ' / ' + t('mes') : ''}</small></strong><b>{h.street} · {h.area}</b><span>{t(areaLabel(h))} · {roomCount(h.beds, language)} · {bathCount(h.baths, language)}</span></>;
}

export function usePropertyPreview(id = 'idea-property-preview') {
  const [preview, setPreview] = useState(null);
  const closeTimer = useRef();
  const popup = useRef(null);
  const trigger = useRef(null);
  const previewInput = useRef('hover');
  const previewMotion = useRef(null);
  const restoringFocus = useRef(false);

  function cancelClose() {clearTimeout(closeTimer.current);}
  function closeSoon() {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      const hovering = trigger.current?.matches(':hover') || popup.current?.matches(':hover');
      const keyboardFocus = previewInput.current === 'keyboard' && (document.activeElement === trigger.current || popup.current?.contains(document.activeElement));
      if (!hovering && !keyboardFocus) dismissPreview();
    }, 300);
  }
  function dismissPreview(restoreFocus = false, animate = previewInput.current !== 'keyboard') {
    cancelClose();
    if (restoreFocus) {restoringFocus.current = true; trigger.current?.focus({preventScroll: true}); restoringFocus.current = false;}
    if (animate && !matchMedia('(prefers-reduced-motion:reduce)').matches && !document.hidden) {
      setPreview(value => value ? {...value, closing: true, animate} : null);
    } else setPreview(null);
  }
  function show(home, event, input = 'hover') {
    cancelClose(); previewInput.current = input; trigger.current = event.currentTarget;
    const anchor = event.currentTarget.getBoundingClientRect(), width = Math.min(310, window.innerWidth - 32);
    setPreview({home, anchor, left: Math.max(16, Math.min(anchor.left - 65, window.innerWidth - width - 16)), top: anchor.bottom + 12, width, closing: false, animate: input !== 'keyboard'});
  }
  useLayoutEffect(() => {
    if (!preview || !popup.current) return;
    const height = popup.current.offsetHeight, {anchor} = preview;
    const above = anchor.top - height - 12;
    const top = Math.max(16, Math.min(above >= 16 ? above : anchor.bottom + 12, window.innerHeight - height - 16));
    popup.current.style.top = `${top}px`;
  }, [preview]);
  useLayoutEffect(() => {
    const panel = popup.current, previous = previewMotion.current;
    const style = panel && previous?.playState === 'running' ? getComputedStyle(panel) : null;
    const interrupted = style ? {opacity: style.opacity, transform: style.transform, filter: style.filter} : null;
    previewMotion.current = null; previous?.cancel();
    if (!preview || !panel) return;
    const animation = playIdeaPreview(panel, !preview.closing, preview.animate, preview.anchor, interrupted);
    previewMotion.current = animation;
    if (preview.closing) {
      if (!animation) {setPreview(null); return;}
      const finish = () => {
        if (previewMotion.current !== animation) return;
        previewMotion.current = null;
        setPreview(value => value?.closing ? null : value);
      };
      animation.finished.then(finish, finish);
    }
  }, [preview?.home.id, preview?.closing]);
  useEffect(() => {
    const close = () => dismissPreview(false, false);
    const key = e => {if (e.key === 'Escape' && popup.current) dismissPreview(true, false);};
    const outside = e => {if (popup.current && !popup.current.contains(e.target) && !trigger.current?.contains(e.target)) dismissPreview();};
    const scroll = e => {
      if (popup.current?.contains(e.target)) return;
      if (previewInput.current === 'keyboard' && trigger.current) {
        const anchor = trigger.current.getBoundingClientRect();
        setPreview(value => value ? {...value, anchor} : null);
      } else close();
    };
    window.addEventListener('resize', close); window.addEventListener('keydown', key); window.addEventListener('scroll', scroll, true); document.addEventListener('pointerdown', outside);
    return () => {cancelClose(); const animation = previewMotion.current; previewMotion.current = null; animation?.cancel(); window.removeEventListener('resize', close); window.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); document.removeEventListener('pointerdown', outside);};
  }, []);

  return {id, preview, popup, trigger, restoringFocus, show, closeSoon, cancelClose, dismissPreview};
}

export function previewPhotoProps(home, api) {
  const open = !api.preview?.closing && api.preview?.home.id === home.id;
  return {
    'aria-expanded': open,
    'aria-controls': open ? api.id : undefined,
    onPointerDown: event => event.stopPropagation(),
    onPointerEnter: event => {if (event.pointerType !== 'touch') api.show(home, event);},
    onPointerLeave: event => {if (event.pointerType !== 'touch') api.closeSoon();},
    onFocus: event => {if (!api.restoringFocus.current && event.currentTarget.matches(':focus-visible')) api.show(home, event, 'keyboard');},
    onBlur: event => {if (!api.popup.current?.contains(event.relatedTarget)) api.closeSoon();},
    onKeyDown: event => {
      event.stopPropagation();
      if (event.key === 'ArrowDown') {event.preventDefault(); api.cancelClose(); requestAnimationFrame(() => api.popup.current?.querySelector('button')?.focus({preventScroll: true}));}
    },
    onClick: event => {event.stopPropagation(); api.show(home, event, event.detail ? 'click' : 'keyboard');},
  };
}

export function PropertyPreview({api, saved, onLike, onOpen}) {
  const {t} = useLanguage();
  const {preview, popup, trigger, cancelClose, closeSoon, dismissPreview} = api;
  if (!preview) return null;
  return createPortal(<section ref={popup} id={api.id} className="idea-property-preview" aria-label={t('Vista previa: ') + preview.home.street} data-open={!preview.closing} data-preview-motion={preview.animate} inert={preview.closing} aria-hidden={preview.closing || undefined} style={{left: preview.left, top: preview.top, width: preview.width}} onPointerEnter={cancelClose} onPointerLeave={event => {if (event.pointerType !== 'touch') closeSoon();}} onFocus={cancelClose} onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) closeSoon();}}>
    <span className="preview-visual" key={preview.home.id}><img className="preview-photo" src={propertyPhoto(preview.home)} alt={preview.home.imageAlt}/></span>
    <button className="preview-close icon-button" aria-label={t('Cerrar vista previa')} onClick={event => dismissPreview(true, event.detail > 0)}><Icon name="close" size={17}/></button>
    <div className="preview-copy"><ListingCopy home={preview.home}/></div>
    <div className="preview-actions">
      <button className="text-button" onClick={() => {onOpen?.(preview.home, {currentTarget: trigger.current}); dismissPreview(false, false);}}>{t('Ver inmueble')}<Icon name="arrow" size={17}/></button>
      <button className="icon-button" aria-label={t('Guardar ') + preview.home.street} aria-pressed={saved.includes(preview.home.id)} onClick={() => onLike?.(preview.home)}><Icon name="heart"/></button>
    </div>
  </section>, document.body);
}
