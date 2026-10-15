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

const PauseGlyph = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx=".8"/><rect x="9.5" y="2.5" width="3" height="11" rx=".8"/></svg>;
const PlayGlyph = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4.5 2.6v10.8a.6.6 0 0 0 .9.5l8.6-5.4a.6.6 0 0 0 0-1L5.4 2.1a.6.6 0 0 0-.9.5Z"/></svg>;
const SoundGlyph = ({muted}) => <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M2.5 7v4h3l4 3.5v-11L5.5 7Z" fill="currentColor"/>
  {muted ? <path d="M12.5 7l4 4m0-4-4 4"/> : <path d="M12.5 6.2a4 4 0 0 1 0 5.6M14.6 4.2a7 7 0 0 1 0 9.6"/>}
</svg>;

/** Plays the tour muted and on loop while it is on screen; reduced motion starts it paused. */
export function useTour(video, src) {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion:reduce)').matches);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const el = video.current;
    if (!el || paused) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.play()?.then(() => setPlaying(true)).catch(() => {});
      else el.pause();
    }, {threshold:0.25});
    observer.observe(el);
    return () => { observer.disconnect(); el.pause(); };
  }, [paused, src, video]);
  useEffect(() => { if (video.current) video.current.muted = muted; }, [muted, video]);
  return {playing, paused, muted, togglePause: () => setPaused(!paused), toggleMute: () => setMuted(!muted)};
}

export function TourControls({tour, say}) {
  return <div className="pp-tour-controls">
    <button type="button" className="compare-back pp-tour-button" onClick={tour.togglePause} aria-label={tour.paused ? say('Reproduzir tour virtual', 'Reproducir tour virtual') : say('Pausar tour virtual', 'Pausar tour virtual')}>
      {tour.paused ? <PlayGlyph/> : <PauseGlyph/>}
    </button>
    <button type="button" className="compare-back pp-tour-button" onClick={tour.toggleMute} aria-pressed={!tour.muted} aria-label={tour.muted ? say('Ativar som', 'Activar sonido') : say('Desativar som', 'Silenciar')}>
      <SoundGlyph muted={tour.muted}/>
    </button>
  </div>;
}

function Mosaic({home, gallery, onOpen, say}) {
  const tiles = useMemo(() => mosaicPhotos(gallery), [gallery]);
  const video = useRef(null);
  const tour = useTour(video, gallery.video);
  const playing = tour.playing;
  return <div className="pp-mosaic" data-count={tiles.length}>
    {tiles.map((photo, i) => { const target = i === 0 && gallery.video ? 'tour' : photo.index; return <button key={photo.src} type="button" className="pp-tile" data-photo-index={target} onClick={event => onOpen(target, event.currentTarget)}
      aria-label={target === 'tour' ? say(`Ver tour virtual de ${home.street}`, `Ver tour virtual de ${home.street}`) : i === 0 ? say(`Ver fotos de ${home.street}`, `Ver fotos de ${home.street}`) : say(`Ver foto ${photo.index + 1} de ${gallery.photos.length}`, `Ver foto ${photo.index + 1} de ${gallery.photos.length}`)}>
      <img src={photo.src} alt={i === 0 ? home.imageAlt : ''} loading={i ? 'lazy' : 'eager'} decoding="async" draggable={false}/>
      {i === 0 && gallery.video && <video ref={video} className={`pp-tile-video${playing ? ' is-playing' : ''}`} src={gallery.video} muted loop playsInline preload="metadata" aria-hidden="true"/>}
    </button>; })}
    {gallery.video && <TourControls tour={tour} say={say}/>}
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

/** The tour loops muted while it is on screen; sound only starts when the person asks for it. */
function TourPlayer({src, poster, say}) {
  const video = useRef(null);
  const tour = useTour(video, src);
  return <div className="pp-tour" data-photo="tour" tabIndex={-1}>
    <video ref={video} className="pp-index-video" src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={say('Tour virtual do imóvel', 'Tour virtual del inmueble')}/>
    <TourControls tour={tour} say={say}/>
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
  const sections = useMemo(() => [
    ...(gallery.video ? [{id:'tour', es:'Tour virtual', pt:'Tour virtual', video:gallery.video, photos:[]}] : []),
    ...gallery.categories,
  ], [gallery]);

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
        <h2 className="pp-index-title">{say('Tour pelo imóvel', 'Recorrido por el inmueble')}</h2>
        <ul className="pp-index-previews">
          {sections.map(section => <li key={section.id}>
            <button type="button" className="pp-index-preview" aria-current={active === section.id ? 'true' : undefined} onClick={() => jump(section.id)}>
              <span className="pp-index-preview-photo">{section.video
                ? <><img src={ordered[0]?.src} alt=""/><span className="pp-index-play" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M4 2.5v9l7.5-4.5z"/></svg></span></>
                : <img src={section.photos[0].src} alt="" loading="lazy"/>}</span>
              <span className="pp-index-preview-label">{label(section)}</span>
            </button>
          </li>)}
        </ul>
        {sections.map(section => <section key={section.id} className="pp-index-section" data-category={section.id} aria-labelledby={`pp-cat-${section.id}`}>
          <h3 id={`pp-cat-${section.id}`} className={`pp-index-heading${active === section.id ? ' is-active' : ''}`}>{label(section)}</h3>
          {section.video
            ? <div className="pp-index-grid"><TourPlayer src={section.video} poster={ordered[0]?.src} say={say}/></div>
            : <div className="pp-index-grid">
              {section.photos.map((photo, i) => <button key={photo.src} type="button" data-photo={photo.index} className={`pp-index-photo${section.id === 'general' && i === 0 ? ' is-wide' : ''}`}
                onClick={event => openViewer(photo, event.currentTarget)}
                aria-label={say(`${label(section)}, foto ${i + 1} de ${section.photos.length}. Abrir em tela cheia`, `${label(section)}, foto ${i + 1} de ${section.photos.length}. Abrir en pantalla completa`)}>
                <img src={photo.src} alt={photo.index === 0 ? home.imageAlt : ''} loading={i < 3 || photo.index === focus ? 'eager' : 'lazy'} decoding="async" draggable={false}/>
              </button>)}
            </div>}
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
    trigger.current = element || document.activeElement;
    const from = photo ?? 0;
    const source = element?.closest?.('.pp-tile, .pp-strip-photo') || (photo == null ? document.querySelector('.pp-mosaic .pp-tile:first-child') : null);
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
