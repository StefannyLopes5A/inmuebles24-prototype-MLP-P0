import React, {useRef, useState} from 'react';
import {HouseCard} from './Home';
import {useSay} from './Collaboration';
import {adjacentStage, BOARD_STAGES, stageFor, stageName} from './boardModel';

const HandIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V7.5a1.5 1.5 0 0 1 3 0V13c0 3-2 6-5.2 6H11c-2.4 0-4.2-1.2-5-3l-1.6-3.2a1.4 1.4 0 0 1 2.4-1.4L8 13"/></svg>;

/**
 * Five columns. On a wide screen a pointer that travels becomes a drag, so a tap still opens the card.
 * On a narrow screen a horizontal swipe moves the card to the neighboring column, in either direction,
 * and the last column wraps around to the first. Arrow keys move the focused card between columns.
 */
export function FolderBoard({homes, board, receipts = [], search, saved = [], onLike, onOpen, onMove}) {
  const {say} = useSay();
  const [over, setOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [notice, setNotice] = useState('');
  const suppress = useRef(false);
  const contacted = new Set(receipts.map(receipt => receipt.propertyId));
  const columns = BOARD_STAGES.map(stage => ({
    ...stage,
    name:stageName(stage, board.labels, say),
    homes:homes.filter(home => stageFor(home.id, board, contacted.has(home.id)) === stage.id),
  }));

  function move(home, stageId) {
    if (stageFor(home.id, board, contacted.has(home.id)) === stageId) return;
    onMove(home.id, stageId);
    const name = columns.find(column => column.id === stageId)?.name || stageName(BOARD_STAGES.find(stage => stage.id === stageId), board.labels, say);
    setNotice(say(`${home.street} ahora está en ${name}`, `${home.street} agora está em ${name}`));
    requestAnimationFrame(() => document.querySelector(`[data-home-id="${CSS.escape(home.id)}"] .discovery-open`)?.focus());
  }

  function revealColumn(stageId) {
    const column = document.querySelector(`[data-stage="${CSS.escape(stageId)}"]`);
    const rail = column?.closest('.board-rail');
    if (!column || !rail) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delta = column.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - column.clientWidth) / 2;
    rail.scrollTo({left:Math.max(0, rail.scrollLeft + delta), behavior:reduce ? 'auto' : 'smooth'});
  }

  function swipe(home, stageId, card, event) {
    const origin = {x:event.clientX, y:event.clientY};
    const pointerId = event.pointerId;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const columnName = id => columns.find(column => column.id === id)?.name || '';
    let mode = '', dx = 0, dir = 0, ghost = null, hint = null;
    const lift = () => {
      const box = card.getBoundingClientRect();
      ghost = card.firstElementChild.cloneNode(true);
      ghost.classList.add('board-ghost', 'board-swipe');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.querySelectorAll('button, a, input').forEach(node => node.setAttribute('tabindex', '-1'));
      ghost.style.width = `${box.width}px`;
      ghost.style.left = `${box.left}px`;
      ghost.style.top = `${box.top}px`;
      hint = document.createElement('span');
      hint.className = 'board-swipe-hint';
      hint.hidden = true;
      ghost.appendChild(hint);
      document.body.appendChild(ghost);
      setDragging(home.id);
      try {card.setPointerCapture(pointerId);} catch { /* the pointer may already be gone */ }
    };
    const place = () => {
      const shift = Math.max(-112, Math.min(112, dx));
      const tilt = reduce ? 0 : Math.max(-5, Math.min(5, shift / 24));
      ghost.style.transform = `translate3d(${shift}px, 0, 0) rotate(${tilt}deg)`;
    };
    const aim = next => {
      if (next === dir) return;
      dir = next;
      const id = adjacentStage(stageId, dir);
      hint.hidden = false;
      hint.textContent = `${dir > 0 ? '→' : '←'} ${columnName(id)}`;
      setOver(id);
    };
    const dropGhost = (shift, done) => {
      if (!ghost) {done?.(); return;}
      ghost.style.transition = reduce ? 'none' : 'transform 160ms ease';
      ghost.style.transform = `translate3d(${shift}px, 0, 0)`;
      const node = ghost;
      window.setTimeout(() => {node.remove(); if (ghost === node) ghost = null; done?.();}, reduce ? 0 : 160);
    };
    const drag = point => {
      dx = point.clientX - origin.x;
      const dy = point.clientY - origin.y;
      if (!mode) {
        if (Math.hypot(dx, dy) < 10) return;
        mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'swipe' : 'scroll';
        if (mode === 'scroll') {stop(); return;}
        lift();
      }
      if (mode !== 'swipe' || !ghost) return;
      place();
      if (Math.abs(dx) > 16) aim(dx > 0 ? 1 : -1);
      else if (dir) {dir = 0; hint.hidden = true; setOver(null);}
    };
    const finish = point => {
      stop();
      if (mode !== 'swipe') return;
      suppress.current = true;
      requestAnimationFrame(() => {suppress.current = false;});
      const distance = point.type === 'pointercancel' ? 0 : point.clientX - origin.x;
      const commit = Math.abs(distance) >= 56;
      const target = commit ? adjacentStage(stageId, distance > 0 ? 1 : -1) : '';
      dropGhost(commit ? (distance > 0 ? 140 : -140) : 0, () => {
        setDragging(null);
        setOver(null);
        if (!commit) return;
        move(home, target);
        requestAnimationFrame(() => revealColumn(target));
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', drag);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', drag);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  function track(home, stageId, event) {
    if (event.button > 0) return;
    const card = event.currentTarget;
    if (window.matchMedia('(max-width: 700px)').matches) {swipe(home, stageId, card, event); return;}
    const rail = card.closest('.board-rail');
    const origin = {x:event.clientX, y:event.clientY, moved:false};
    let ghost = null, offset = null, edge = 0, frame = 0;
    const columnAt = point => {
      if (ghost) ghost.style.visibility = 'hidden';
      const column = document.elementFromPoint(point.clientX, point.clientY)?.closest('[data-stage]');
      if (ghost) ghost.style.visibility = '';
      return column;
    };
    const place = point => {ghost.style.transform = `translate3d(${point.clientX - offset.x}px, ${point.clientY - offset.y}px, 0)`;};
    const scrollRail = () => {
      if (!edge || !rail) {frame = 0; return;}
      rail.scrollLeft += edge;
      frame = requestAnimationFrame(scrollRail);
    };
    const lift = point => {
      const box = card.getBoundingClientRect();
      offset = {x:point.clientX - box.left, y:point.clientY - box.top};
      ghost = card.firstElementChild.cloneNode(true);
      ghost.classList.add('board-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.querySelectorAll('button, a, input').forEach(node => node.setAttribute('tabindex', '-1'));
      ghost.style.width = `${box.width}px`;
      document.body.appendChild(ghost);
      place(point);
      requestAnimationFrame(() => ghost?.setAttribute('data-lifted', ''));
    };
    const drag = point => {
      if (!origin.moved && Math.hypot(point.clientX - origin.x, point.clientY - origin.y) < 8) return;
      if (!origin.moved) {origin.moved = true; setDragging(home.id); lift(point);}
      place(point);
      setOver(columnAt(point)?.dataset.stage || null);
      const bounds = rail?.getBoundingClientRect();
      edge = !bounds ? 0 : point.clientX < bounds.left + 48 ? -12 : point.clientX > bounds.right - 48 ? 12 : 0;
      if (edge && !frame) frame = requestAnimationFrame(scrollRail);
    };
    const finish = point => {
      window.removeEventListener('pointermove', drag);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      edge = 0;
      cancelAnimationFrame(frame);
      if (origin.moved) {
        suppress.current = true;
        requestAnimationFrame(() => {suppress.current = false;});
        const column = point.type === 'pointercancel' ? null : columnAt(point);
        if (column && column.dataset.stage !== stageId) move(home, column.dataset.stage);
      }
      ghost?.remove();
      ghost = null;
      setDragging(null);
      setOver(null);
    };
    window.addEventListener('pointermove', drag);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  return <div className="board-rail">
    <p className="sr-only" aria-live="polite">{notice}</p>
    {columns.map(column => <section key={column.id} className="board-column" data-stage={column.id} data-over={over === column.id || undefined} data-empty={!column.homes.length || undefined} aria-labelledby={`board-${column.id}`}>
      <h2 id={`board-${column.id}`}><span>{column.name}</span><span>{column.homes.length}</span></h2>
      {column.homes.length ? <ul className="board-cards">
        {column.homes.map(home => <li key={home.id} className="board-card" data-dragging={dragging === home.id || undefined}
          onPointerDown={event => track(home, column.id, event)}
          onDragStart={event => event.preventDefault()}
          onClickCapture={event => {if (suppress.current) {suppress.current = false; event.preventDefault(); event.stopPropagation();}}}
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const index = BOARD_STAGES.findIndex(stage => stage.id === column.id);
            const next = BOARD_STAGES[index + (event.key === 'ArrowRight' ? 1 : -1)];
            if (!next) return;
            event.preventDefault();
            move(home, next.id);
          }}>
          <HouseCard home={home} search={search} saved={saved.includes(home.id)} onLike={onLike} onOpen={onOpen}/>
        </li>)}
      </ul> : <div className="board-drop">
        <HandIcon/>
        <p><span className="board-drop-wide">{say('Arrastra aquí', 'Arraste aqui')}</span><span className="board-drop-narrow">{say('Desliza una tarjeta', 'Deslize um cartão')}</span></p>
      </div>}
    </section>)}
  </div>;
}
