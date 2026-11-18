import React, {useEffect, useRef, useState} from 'react';
import {Icon} from './App.jsx';

export function useRailScroll(deps = []) {
  const rail = useRef(null);
  const [position, setPosition] = useState({start: true, end: false});
  function measure() {
    const el = rail.current;
    if (el) setPosition({start: el.scrollLeft < 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2});
  }
  function move(direction) {
    const el = rail.current;
    el?.scrollBy({left: direction * (el.clientWidth * .8), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }
  useEffect(() => {
    if (!rail.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(rail.current);
    measure();
    return () => observer.disconnect();
  }, deps);
  return {rail, position, measure, move};
}

export function RailHeading({title, subtitle, titleId, prevLabel, nextLabel, position, onMove, nextDisabled = false}) {
  return <div className="discovery-heading">
    <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
    <div className="rail-controls">
      <button className="icon-button" aria-label={prevLabel} disabled={position.start} onClick={() => onMove(-1)}><Icon name="back"/></button>
      <button className="icon-button" aria-label={nextLabel} disabled={position.end || nextDisabled} onClick={() => onMove(1)}><Icon name="arrow"/></button>
    </div>
  </div>;
}
