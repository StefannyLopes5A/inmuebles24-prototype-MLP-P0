import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {Icon} from './App';
import {EASE_FADE} from './listingPanelMotion';
import {PhotoLightbox} from './PhotoLightbox';
import {canMorph, morphGallery, visible} from './heroMorph';

const FOCUSABLE = 'button:not([disabled]), [href], video[controls], [tabindex]:not([tabindex="-1"])';
function trap(event, container) {
  if (!container) return;
  const items = [...container.querySelectorAll(FOCUSABLE)].filter(item => item.getClientRects().length);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (!container.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export const GridIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><rect x="1" y="1" width="4" height="4" rx="1"/><rect x="6" y="1" width="4" height="4" rx="1"/><rect x="11" y="1" width="4" height="4" rx="1"/><rect x="1" y="6" width="4" height="4" rx="1"/><rect x="6" y="6" width="4" height="4" rx="1"/><rect x="11" y="6" width="4" height="4" rx="1"/><rect x="1" y="11" width="4" height="4" rx="1"/><rect x="6" y="11" width="4" height="4" rx="1"/><rect x="11" y="11" width="4" height="4" rx="1"/></svg>;

/** Five tiles for the page: the cover, then the first photo of each room so the mosaic shows variety. */
function mosaicPhotos(gallery) {
  const picked = [gallery.photos[0]];
  for (const category of gallery.categories) {
    const first = category.photos.find(photo => !picked.includes(photo));
    if (first && picked.length < 5) picked.push(first);
  }
  for (const photo of gallery.photos) if (picked.length < 5 && !picked.includes(photo)) picked.push(photo);
  return picked.filter(Boolean);
}

function Mosaic({home, gallery, onOpen, say}) {
  const tiles = useMemo(() => mosaicPhotos(gallery), [gallery]);
  return <div className="pp-mosaic" data-count={tiles.length}>
    {tiles.map((photo, i) => <button key={photo.src} type="button" className="pp-tile" data-photo-index={photo.index} onClick={event => onOpen(photo.index, event.currentTarget)}
      aria-label={i === 0 ? say(`Ver fotos de ${home.street}`, `Ver fotos de ${home.street}`) : say(`Ver foto ${photo.index + 1} de ${gallery.photos.length}`, `Ver foto ${photo.index + 1} de ${gallery.photos.length}`)}>
      <img src={photo.src} alt={i === 0 ? home.imageAlt : ''} loading={i ? 'lazy' : 'eager'} decoding="async" draggable={false}/>
    </button>)}
    <button type="button" className="pp-show-all" onClick={event => onOpen(null, event.currentTarget)}><GridIcon/>{say('Mostrar todas as fotos', 'Mostrar todas las fotos')}</button>
  </div>;
}

function Strip({home, gallery, onOpen, say}) {
  const [current, setCurrent] = useState(0);
  const strip = useRef(null);
  return <div className="pp-strip">
    <div ref={strip} className="pp-strip-track" onScroll={event => setCurrent(Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth)))}>
      {gallery.photos.map((photo, i) => <button key={photo.src} type="button" className="pp-strip-photo" data-photo-index={photo.index} onClick={event => onOpen(photo.index, event.currentTarget)}
        aria-label={say(`Ver foto ${i + 1} de ${gallery.photos.length}`, `Ver foto ${i + 1} de ${gallery.photos.length}`)}>
        <img src={photo.src} alt={i === 0 ? home.imageAlt : ''} loading={i < 2 ? 'eager' : 'lazy'} decoding="async" draggable={false}/>
      </button>)}
    </div>
    <span className="pp-strip-count" aria-hidden="true">{Math.min(current, gallery.photos.length - 1) + 1} / {gallery.photos.length}</span>
  </div>;
}

export function GalleryIndex({home, gallery, focus, morph, closing, onClose, onClosed, say, language}) {
  const reduce = useReducedMotion();
  const pt = language === 'pt-BR';
  const shell = useRef(null), back = useRef(null);
  const [active, setActive] = useState(gallery.categories[0]?.id);
  const [viewer, setViewer] = useState(null);
  const ordered = useMemo(() => gallery.categories.flatMap(category => category.photos), [gallery]);
  const label = category => pt ? category.pt : category.es;
  const sections = gallery.categories;

  useLayoutEffect(() => {
    const root = document.documentElement, previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, []);

  useLayoutEffect(() => {
    const scroller = shell.current;
    const target = focus == null ? null : scroller?.querySelector(`[data-photo="${focus}"]`);
    if (target) {
      scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 96;
      target.focus({preventScroll:true});
    } else back.current?.focus({preventScroll:true});
  }, [focus]);

  useEffect(() => {
    const scroller = shell.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(entries => {
      const hit = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (hit) setActive(hit.target.dataset.category);
    }, {root:scroller, rootMargin:'-96px 0px -66% 0px'});
    scroller.querySelectorAll('.pp-index-section').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    const key = event => {
      if (viewer) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeViewer(); }
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') setViewer(current => current && {...current, index:Math.min(ordered.length - 1, Math.max(0, current.index + (event.key === 'ArrowRight' ? 1 : -1)))});
        else if (event.key === 'Tab') trap(event, document.querySelector('.pp-lightbox'));
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      else if (event.key === 'Tab') trap(event, shell.current);
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  });

  const indexPhoto = index => shell.current?.querySelector(`[data-photo="${ordered[index]?.index}"]`);
  function openViewer(photo, element) {
    const index = ordered.indexOf(photo);
    const morph = canMorph() && visible(element);
    const update = () => flushSync(() => setViewer({index, morph}));
    if (!morph) { update(); return; }
    morphGallery(element, update, () => document.querySelector('.pp-lightbox .lp-gallery-photo'), 'forward');
  }
  function closeViewer() {
    const index = viewer?.index;
    const refocus = () => requestAnimationFrame(() => indexPhoto(index)?.focus({preventScroll:true}));
    const lightbox = document.querySelector('.pp-lightbox');
    const source = lightbox?.querySelector('.lp-gallery-photo');
    const target = indexPhoto(index);
    if (target && !visible(target)) shell.current.scrollTop += target.getBoundingClientRect().top - shell.current.getBoundingClientRect().top - 96;
    if (!canMorph() || !visible(source) || !visible(target)) { setViewer(null); refocus(); return; }
    morphGallery(source, () => { lightbox.style.visibility = 'hidden'; flushSync(() => setViewer(null)); refocus(); }, () => indexPhoto(index), 'back');
  }
  function jump(id) {
    const section = shell.current?.querySelector(`[data-category="${id}"]`);
    if (!section) return;
    const top = section.getBoundingClientRect().top - shell.current.getBoundingClientRect().top + shell.current.scrollTop - 96;
    shell.current.scrollTo({top, behavior:reduce ? 'instant' : 'smooth'});
  }

  return createPortal(<>
    <motion.div ref={shell} className="pp-index" role="dialog" aria-modal="true" aria-label={say('Todas as fotos', 'Todas las fotos')}
      initial={morph ? false : {opacity:0}} animate={{opacity:closing ? 0 : 1}} transition={{duration:reduce ? 0.15 : 0.2, ease:EASE_FADE}}
      onAnimationComplete={() => { if (closing) onClosed(); }}>
      <div className="pp-index-bar">
        <button ref={back} type="button" className="pp-index-back" onClick={onClose} aria-label={say('Voltar ao anúncio', 'Volver al anuncio')}><Icon name="back" size={18}/></button>
      </div>
      <div className="pp-index-body">
        <h2 className="pp-index-title">{say('Fotos do imóvel', 'Fotos del inmueble')}</h2>
        <ul className="pp-index-previews">
          {sections.map(section => <li key={section.id}>
            <button type="button" className="pp-index-preview" aria-current={active === section.id ? 'true' : undefined} onClick={() => jump(section.id)}>
              <span className="pp-index-preview-photo"><img src={section.photos[0].src} alt="" loading="lazy"/></span>
              <span className="pp-index-preview-label">{label(section)}</span>
            </button>
          </li>)}
        </ul>
        {sections.map(section => <section key={section.id} className="pp-index-section" data-category={section.id} aria-labelledby={`pp-cat-${section.id}`}>
          <h3 id={`pp-cat-${section.id}`} className={`pp-index-heading${active === section.id ? ' is-active' : ''}`}>{label(section)}</h3>
          <div className="pp-index-grid">
              {section.photos.map((photo, i) => <button key={photo.src} type="button" data-photo={photo.index} className={`pp-index-photo${section.id === 'general' && i === 0 ? ' is-wide' : ''}`}
                onClick={event => openViewer(photo, event.currentTarget)}
                aria-label={say(`${label(section)}, foto ${i + 1} de ${section.photos.length}. Abrir em tela cheia`, `${label(section)}, foto ${i + 1} de ${section.photos.length}. Abrir en pantalla completa`)}>
                <img src={photo.src} alt={photo.index === 0 ? home.imageAlt : ''} loading={i < 3 || photo.index === focus ? 'eager' : 'lazy'} decoding="async" draggable={false}/>
              </button>)}
            </div>
        </section>)}
      </div>
    </motion.div>
    <AnimatePresence>{viewer && <PhotoLightbox key="viewer" className="pp-lightbox" crossfade morph={viewer.morph} copy={{say}}
      gallery={{photos:ordered.map(photo => photo.src), index:viewer.index, alt:home.imageAlt}}
      onIndex={index => setViewer({index, morph:viewer.morph})} onClose={closeViewer}/>}</AnimatePresence>
  </>, document.body);
}

/** Mosaic on the page; any photo opens the index by room, and a photo there opens the full-screen viewer. The opened photo morphs between both. */
export function ListingGallery({home, gallery, say, language, opener}) {
  const [open, setOpen] = useState(null);
  const trigger = useRef(null);
  function show(photo, element) {
    trigger.current = element?.closest?.('button') || element || document.activeElement;
    const from = photo ?? 0;
    const source = element?.closest?.('.pp-tile, .pp-strip-photo, .pp-room-photo') || element?.querySelector?.('.pp-room-photo') || (photo == null ? document.querySelector('.pp-mosaic .pp-tile:first-child') : null);
    const morph = canMorph() && visible(source);
    const update = () => flushSync(() => setOpen({focus:photo, from, morph}));
    if (!morph) { update(); return; }
    morphGallery(source, update, () => document.querySelector(`.pp-index [data-photo="${from}"]`), 'forward');
  }
  if (opener) opener.current = show;
  function hide() {
    const refocus = () => requestAnimationFrame(() => trigger.current?.focus({preventScroll:true}));
    const source = open && document.querySelector(`.pp-index [data-photo="${open.from}"]`);
    if (!canMorph() || !visible(source)) { setOpen(current => current && {...current, closing:true}); return; }
    morphGallery(source, () => { flushSync(() => setOpen(null)); refocus(); },
      () => [...document.querySelectorAll(`[data-photo-index="${open.from}"]`)].find(visible), 'back');
  }
  return <>
    <Mosaic home={home} gallery={gallery} onOpen={show} say={say}/>
    <Strip home={home} gallery={gallery} onOpen={show} say={say}/>
    {open && <GalleryIndex home={home} gallery={gallery} focus={open.focus} morph={open.morph} closing={open.closing} onClose={hide}
      onClosed={() => { setOpen(null); requestAnimationFrame(() => trigger.current?.focus({preventScroll:true})); }} say={say} language={language}/>}
  </>;
}
