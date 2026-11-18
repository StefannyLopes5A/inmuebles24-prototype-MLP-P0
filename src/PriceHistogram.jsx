import React, {useId, useRef, useState} from 'react';
import {priceRangeAtBar, priceRangeEdge, selectedPriceBars} from './priceRange.js';

export function PriceHistogram({bins, heights, min, max, money, say, onChange}) {
  const bars = useRef(null), handles = useRef({}), gesture = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [keyboardEdge, setKeyboardEdge] = useState(null);
  const help = useId();
  const {first, last} = selectedPriceBars(bins, min, max);
  const ceiling = bins.at(-1).max;

  function barAt(clientX, rect) {
    return Math.max(0, Math.min(bins.length - 1, Math.floor((clientX - rect.left) / rect.width * bins.length)));
  }
  function move(event) {
    const drag = gesture.current;
    if (!drag || event.pointerId !== drag.id) return;
    const index = barAt(event.clientX, drag.rect);
    if (index === drag.index) return;
    drag.index = index;
    onChange(priceRangeAtBar(bins, drag.min, drag.max, drag.edge, index));
  }
  function start(event) {
    if (!event.isPrimary || event.button !== 0 || gesture.current) return;
    event.preventDefault();
    const rect = bars.current.getBoundingClientRect();
    const index = barAt(event.clientX, rect);
    const edge = priceRangeEdge((event.clientX - rect.left) / rect.width * bins.length, {first, last});
    gesture.current = {id:event.pointerId, edge, rect, min, max, index};
    event.currentTarget.setPointerCapture(event.pointerId);
    handles.current[edge].focus({preventScroll:true});
    setKeyboardEdge(null);
    setDragging(edge);
    // Grabbing an existing boundary does not round a manually typed amount.
    if (index !== (edge === 'min' ? first : last)) onChange(priceRangeAtBar(bins, min, max, edge, index));
  }
  function finish(event) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keydown(event, edge) {
    setKeyboardEdge(edge);
    const direction = {ArrowLeft:-1, ArrowDown:-1, ArrowRight:1, ArrowUp:1, PageDown:-5, PageUp:5}[event.key];
    if (direction === undefined && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? bins.length - 1 : (edge === 'min' ? first : last) + direction;
    onChange(priceRangeAtBar(bins, min, max, edge, index));
  }
  return <div className="price-histogram price-histogram-interactive" role="group" aria-label={say('Distribuição ilustrativa por preço. Laranja indica a faixa escolhida.', 'Distribución ilustrativa por precio. Naranja indica el rango elegido.')} data-dragging={dragging || undefined} onPointerDown={start} onPointerMove={move} onPointerUp={event => {move(event);finish(event);}} onPointerCancel={finish} onLostPointerCapture={finish}>
    <span className="sr-only" id={help}>{say('Arraste as extremidades ou clique fora da faixa para ampliá-la. Use as setas para ajustar o limite em foco.', 'Arrastra los extremos o haz clic fuera del rango para ampliarlo. Usa las flechas para ajustar el límite enfocado.')}</span>
    <div className="price-histogram-bars" ref={bars}>
      {bins.map((bin, index) => <span key={index} className={`price-histogram-bar${bin.min < max && bin.max > min ? ' in-range' : ''}`} style={{height:`${heights[index] / 114 * 100}%`, '--h':heights[index] / 114}} title={`${money(bin.min)} – ${money(bin.max)}`} aria-hidden="true"/>)}
      {['min', 'max'].map(edge => <button key={edge} ref={el => {handles.current[edge] = el;}} type="button" role="slider" className="price-range-handle" data-edge={edge} data-keyboard-focus={keyboardEdge === edge || undefined} onFocus={() => setKeyboardEdge(edge)} onBlur={() => setKeyboardEdge(null)} aria-label={edge === 'min' ? say('Preço mínimo', 'Precio mínimo') : say('Preço máximo', 'Precio máximo')} aria-describedby={help} aria-orientation="horizontal" aria-valuemin={edge === 'min' ? 0 : min} aria-valuemax={edge === 'min' ? max : Math.max(ceiling, max)} aria-valuenow={edge === 'min' ? min : max} aria-valuetext={money(edge === 'min' ? min : max)} style={{left:`${Math.min(1, (edge === 'min' ? min : max) / ceiling) * 100}%`}} onKeyDown={event => keydown(event, edge)}/>)}
    </div>
  </div>;
}
