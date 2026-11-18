import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useReducedMotion} from 'motion/react';
import {propertyPhoto, listingPrice} from './data';
import {PRICE_BANDS} from './compareReading';
import {similarPriceRows} from './similarPrices';

const ARROW = {prev:'/assets/similar-prices/arrow-prev.svg', next:'/assets/similar-prices/arrow-next.svg'};

function compact(amount, compactMoney) {
  return compactMoney(amount).replace(/\.0k$/, 'k');
}

function formatDistance(meters) {
  if (meters < 1000) return `${meters} m`;
  const km = Math.round(meters / 100) / 10;
  return `${Number.isInteger(km) ? km.toFixed(0) : km} km`;
}

/** Where this m² sits among the columns. The zone position is already on the bar. */
function priceNote(row, rows, say) {
  const known = rows.filter(item => item.ppm2 != null).sort((a, b) => a.ppm2 - b.ppm2);
  const rank = known.findIndex(item => item.home.id === row.home.id);
  if (known.length < 2 || rank < 0) return '';
  if (rank === 0) return say(`O m² mais barato destes parecidos em ${row.area}.`, `El m² más barato de estos parecidos en ${row.area}.`);
  if (rank === known.length - 1) return say('O m² mais alto destes parecidos.', 'El m² más alto de estos parecidos.');
  if (rank === 1) return say('O segundo m² mais baixo destes parecidos.', 'El segundo m² más bajo de estos parecidos.');
  return say('O m² fica no meio destes parecidos.', 'Su m² queda en medio de estos parecidos.');
}

function deltaLabel(delta, say) {
  if (delta == null) return null;
  const pct = Math.round(Math.abs(delta) * 100);
  if (pct < 5) return {above:false, text:say('Na mediana da zona', 'En la mediana de la zona')};
  return delta < 0
    ? {above:false, text:`↓ ${pct}% ${say('abaixo da zona', 'abajo de la zona')}`}
    : {above:true, text:`↑ ${pct}% ${say('acima da zona', 'arriba de la zona')}`};
}

function PriceBar({band, position}) {
  if (!band || position == null) return null;
  return <span className="pp-peers-bar" aria-hidden="true">
    {PRICE_BANDS.map(item => <span key={item.id} className="pp-peers-band" data-band={item.id} style={{left:`${item.start * 100}%`, width:`${(item.end - item.start) * 100}%`}}>
      {item.id === band && <span className="pp-peers-fill"/>}
    </span>)}
    <span className="pp-peers-dot" data-band={band} style={{left:`${position * 100}%`}}/>
  </span>;
}

function Step({direction, disabled, label, onClick}) {
  const gray = disabled;
  const flip = direction === 'prev' ? !gray : gray;
  return <button type="button" className="pp-peers-step" disabled={disabled} aria-label={label} onClick={onClick}>
    <img src={gray ? ARROW.prev : ARROW.next} alt="" width="20" height="20" className={flip ? 'is-flip' : undefined}/>
  </button>;
}

const ROWS = [
  ['size', 'Superfície', 'Superficie', row => row.size == null ? null : `${row.size} m²`],
  ['type', 'Tipo', 'Tipo', () => null],
  ['beds', 'Quartos', 'Recámaras', row => row.beds],
  ['baths', 'Banheiros', 'Baños', row => row.baths],
  ['parking', 'Vagas', 'Estacionamiento', row => row.parking],
  ['distance', 'Distância', 'Distancia', row => row.current ? '' : formatDistance(row.meters)],
  ['street', 'Rua', 'Calle', row => row.street],
  ['area', 'Bairro', 'Colonia', row => row.area],
];

/** Similar ads beside this one: photo, price per m² against the colonia, then the published facts. */
export function ListingSimilarPrices({home, money, compactMoney, currency, say, onOpen}) {
  const reduce = useReducedMotion();
  const scroller = useRef(null);
  const [edge, setEdge] = useState({start:true, end:false});
  const rows = useMemo(() => similarPriceRows(home), [home]);
  const pending = say('A confirmar', 'Por confirmar');
  const kind = say('Apartamento', 'Departamento');
  const operation = home.mode === 'rent' ? say('Aluguel', 'Renta') : say('Venda', 'Venta');

  function measure() {
    const el = scroller.current;
    if (!el) return;
    setEdge({start:el.scrollLeft < 2, end:el.scrollLeft + el.clientWidth >= el.scrollWidth - 2});
  }
  function move(direction) {
    const el = scroller.current;
    if (!el) return;
    const column = el.querySelector('.pp-peers-photo-cell');
    const width = column ? column.getBoundingClientRect().width : 234;
    el.scrollBy({left:direction * width, behavior:reduce ? 'instant' : 'smooth'});
  }
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [home.id]);

  if (rows.length < 2) return null;
  const cell = (row, value, {title, tall, last} = {}) => <div key={row.home.id} className={`pp-peers-cell${tall ? ' is-tall' : ''}${last ? ' is-last' : ''}`} title={title || undefined}>{value == null || value === '' ? pending : value}</div>;

  return <section className="pp-section pp-peers" aria-labelledby="pp-peers-title">
    <h2 id="pp-peers-title" className="pp-section-title">{say(`Preços de apartamentos parecidos perto de ${home.area}`, `Precios de departamentos parecidos cerca de ${home.area}`)}</h2>
    <p className="pp-section-sub">{say('Mesma operação e a mesma zona, quando o catálogo tem. O que o anúncio não publica fica por confirmar.', 'Misma operación y la misma zona, cuando el catálogo la tiene. Lo que el anuncio no publica queda por confirmar.')}</p>
    <div className="pp-peers-frame">
      <div ref={scroller} className="pp-peers-scroll" onScroll={measure} tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
        }}>
        <div className="pp-peers-grid" style={{gridTemplateColumns:`var(--pp-peers-label) repeat(${rows.length}, var(--pp-peers-col))`}}>
          <div className="pp-peers-nav">
            <Step direction="prev" disabled={edge.start} label={say('Anúncios anteriores', 'Anuncios anteriores')} onClick={() => move(-1)}/>
            <Step direction="next" disabled={edge.end} label={say('Próximos anúncios', 'Siguientes anuncios')} onClick={() => move(1)}/>
          </div>
          {rows.map(row => {
            const price = listingPrice(row.home);
            return <div key={row.home.id} className="pp-peers-photo-cell">
              <button type="button" className="pp-peers-photo" aria-current={row.current || undefined}
                onClick={() => { if (!row.current) onOpen?.(row.home); }}>
                <img src={propertyPhoto(row.home)} alt=""/>
                <span className="pp-peers-photo-copy">
                  <span>{operation} · {kind}</span>
                  <strong>{money(price)} {currency}{home.mode === 'rent' ? say(' / mês', ' / mes') : ''}</strong>
                </span>
                {row.current && <span className="sr-only">{say('Este imóvel', 'Este inmueble')}</span>}
              </button>
            </div>;
          })}

          <div className="pp-peers-label pp-peers-label-price">{say('Preço médio por m²', 'Precio medio por m²')}</div>
          {rows.map(row => {
            const delta = deltaLabel(row.delta, say);
            return <div key={row.home.id} className="pp-peers-price">
              <p className="pp-peers-price-kicker">{say('Preço por m²', 'Precio por m²')}</p>
              <div className="pp-peers-price-row">
                <strong>{row.ppm2 == null ? pending : compact(row.ppm2, compactMoney)}</strong>
                {row.best && <span className="pp-peers-best">{say('Melhor preço', 'Mejor precio')}</span>}
              </div>
              {delta && <p className={`pp-peers-delta${delta.above ? ' is-above' : ''}`}>{delta.text}</p>}
              <PriceBar band={row.band} position={row.position}/>
              {row.ppm2 != null && <p className="pp-peers-note">{priceNote(row, rows, say)}</p>}
            </div>;
          })}

          {ROWS.map(([id, pt, es, value]) => <React.Fragment key={id}>
            <div className={`pp-peers-label${id === 'street' ? ' is-tall' : ''}${id === 'area' ? ' is-last' : ''}`}>{say(pt, es)}</div>
            {rows.map(row => {
              const opts = {tall:id === 'street', last:id === 'area', title:id === 'street' ? row.home.street : undefined};
              if (id === 'type') return cell(row, kind, opts);
              if (id === 'distance' && row.current) return cell(row, say('Este imóvel', 'Este inmueble'), opts);
              return cell(row, value(row), opts);
            })}
          </React.Fragment>)}
        </div>
      </div>
    </div>
    <p className="pp-peers-source">{say('A distância sai da localização aproximada de cada anúncio.', 'La distancia sale de la ubicación aproximada de cada anuncio.')}</p>
  </section>;
}
