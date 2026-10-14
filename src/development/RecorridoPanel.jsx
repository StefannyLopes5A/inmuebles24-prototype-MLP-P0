import React, {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {Glyph} from '../MoraInsight.jsx';
import {SIDES} from './buildingConfig.js';
import {AMENITIES, DEVELOPER, DEVELOPMENT, GALLERY, MORA, RANGES, TYPOLOGIES, UNITS, available, unitById} from './torreOlmo.js';
import {DEFAULT_FILTERS, PRICE_CAPS, filtersActive, groupByTypology, listedUnits, similarUnits, unitLine} from './units.js';

const ICONS = {
  back:'M15 18l-6-6 6-6',
  close:'M6 6l12 12M18 6 6 18',
  chevron:'M6 9l6 6 6-6',
  pin:'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  share:'M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  whatsapp:'M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20ZM9 8.8c0 3.3 2.9 6.2 6.2 6.2l1.3-1.4-1.9-1-1 .8a4.5 4.5 0 0 1-2.4-2.4l.8-1-1-1.9L9 8.8Z',
  cube:'M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4L12 2.8ZM4.3 7.6 12 12l7.7-4.4M12 12v9',
  check:'M5 12.5l4.5 4.5L19 7.5',
  zoom:'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.8-4.8M10.5 8v5M8 10.5h5',
  pool:'M3 17c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0M8 14V5a2 2 0 0 1 4 0M16 14V5a2 2 0 0 0-4 0M8 9h8',
  gym:'M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12',
  events:'M5 21V9l7-5 7 5v12M9 21v-6h6v6',
  lobby:'M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M10 21v-4h4v4M9 7h.01M15 7h.01M9 11h.01M15 11h.01',
  security:'M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6l-7-3Z',
  bike:'M6 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM18 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM6 14.5 9.5 8h5L18 14.5M12 14.5 9.5 8M14 5h2',
  pet:'M8.5 9a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM15.5 9a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM5 13a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 5 13ZM19 13a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2ZM12 12c-2.5 0-5 3.4-5 5.6 0 1.6 1.3 2.4 2.8 2.4 1 0 1.5-.5 2.2-.5s1.2.5 2.2.5c1.5 0 2.8-.8 2.8-2.4 0-2.2-2.5-5.6-5-5.6Z',
  laundry:'M5 3h14v18H5zM5 7h14M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM8 5h.01',
};

export function RIcon({name, size = 18}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]}/></svg>;
}

export const formatMoney = value => `$${Math.round(value).toLocaleString('en-US')}`;
const short = value => `$${(value / 1e6).toFixed(value % 1e6 ? 1 : 0)} M`;
const pick = (pair, say) => say(pair[0], pair[1]);
const orientationLabel = (unit, say) => SIDES[unit.side] === 'norte' ? say('Norte', 'Norte') : say('Sul', 'Sur');

export function statusLabel(status, say) {
  return {available:say('Disponível', 'Disponible'), reserved:say('Reservada', 'Apartado'), sold:say('Vendida', 'Vendido')}[status];
}

export function StatusPill({status, say}) {
  return <span className={`rp-status is-${status}`}><i aria-hidden="true"/>{statusLabel(status, say)}</span>;
}

const ease = [0.23, 1, 0.32, 1];
const swap = reduce => ({initial:{opacity:0, y:reduce ? 0 : 4}, animate:{opacity:1, y:0}, exit:{opacity:0, y:reduce ? 0 : -4}, transition:{duration:reduce ? 0.12 : 0.15, ease}});

export function RecorridoPanel(props) {
  const {say, view, onView, unitId, onBack, saved, onLike, onShare, onVisit, onMessage, collapsed, onCollapse, collapsible, modelFailed, reduce} = props;
  const unit = unitId ? unitById(unitId) : null;
  const tab = view === 'summary' ? 'summary' : 'units';
  return <aside className="rp-panel" data-collapsed={collapsed || undefined} aria-label={say('Painel do empreendimento', 'Panel del desarrollo')}>
    <div className="rp-body" inert={collapsed || undefined}>
      <div className="rp-scroll">
        <header className="rp-head">
          <button type="button" className="rp-back" onClick={onBack}><RIcon name="back" size={16}/>{say('Voltar aos resultados', 'Volver a resultados')}</button>
          <h1>{DEVELOPMENT.name}</h1>
          <p className="rp-area">{DEVELOPMENT.area}, {DEVELOPMENT.borough}</p>
          <ul className="rp-badges">
            {!modelFailed && <li className="is-tour"><RIcon name="cube" size={14}/>{say('Tour 3D', 'Tour 3D')}</li>}
            <li><RIcon name="check" size={14}/>{say('Empreendimento verificado', 'Desarrollo verificado')}</li>
            <li>{say('Entrega dez. 2027', 'Entrega dic. 2027')}</li>
          </ul>
          <div className="rp-tabs" role="tablist" aria-label={say('Seções', 'Secciones')}>
            <button type="button" role="tab" aria-selected={tab === 'summary'} onClick={() => onView('summary')}>{say('Resumo', 'Resumen')}</button>
            <button type="button" role="tab" aria-selected={tab === 'units'} onClick={() => onView('units')}>{say(`Unidades (${available.length} disponíveis)`, `Unidades (${available.length} disponibles)`)}</button>
          </div>
        </header>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={unit ? `unit-${unit.id}` : view} className="rp-content" role="tabpanel" {...swap(reduce)}>
            {unit ? <UnitView unit={unit} {...props}/> : view === 'summary' ? <SummaryView {...props}/> : <UnitsView {...props}/>}
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="rp-cta">
        <button type="button" className="rp-primary" onClick={onVisit}>{unit ? say(`Agendar visita à ${unit.id}`, `Agendar visita a la ${unit.id}`) : say('Agendar visita', 'Agendar visita')}</button>
        <div className="rp-cta-row">
          <button type="button" className="rp-secondary" onClick={onMessage}><RIcon name="whatsapp"/>{say('Falar com a incorporadora', 'Hablar con la desarrolladora')}</button>
          <button type="button" className="rp-icon" aria-pressed={saved} aria-label={saved ? say('Remover dos favoritos', 'Quitar de favoritos') : say('Salvar nos favoritos', 'Guardar en favoritos')} onClick={onLike}><RIcon name="heart"/></button>
          <button type="button" className="rp-icon" aria-label={say('Compartilhar', 'Compartir')} onClick={onShare}><RIcon name="share"/></button>
        </div>
      </footer>
    </div>
    {collapsible && <button type="button" className="rp-collapse" aria-expanded={!collapsed} onClick={onCollapse}
      aria-label={collapsed ? say('Mostrar painel', 'Mostrar panel') : say('Recolher painel', 'Contraer panel')}><RIcon name="back" size={16}/></button>}
    {collapsed && <button type="button" className="rp-spine" onClick={onCollapse} aria-hidden="true" tabIndex={-1}>{DEVELOPMENT.name}</button>}
  </aside>;
}

function SummaryView({say, onAmenity, onCityMode, onPhoto, modelFailed}) {
  const [more, setMore] = useState(false), [verified, setVerified] = useState(false);
  const description = pick(DEVELOPMENT.description, say);
  return <>
    <section className="rp-block rp-price">
      <p className="rp-price-main"><span>{say('A partir de', 'Desde')}</span> {formatMoney(RANGES.price[0])} MXN</p>
      <p className="rp-muted">{say(`Condomínio estimado a partir de ${formatMoney(DEVELOPMENT.maintenanceFrom)} MXN por mês`, `Mantenimiento estimado desde ${formatMoney(DEVELOPMENT.maintenanceFrom)} MXN al mes`)}</p>
    </section>
    <ul className="rp-block rp-keys">
      <li><strong>{say(`${available.length} de ${UNITS.length}`, `${available.length} de ${UNITS.length}`)}</strong><span>{say('disponíveis', 'disponibles')}</span></li>
      <li><strong>{RANGES.size[0]} {say('a', 'a')} {RANGES.size[1]} m²</strong><span>{say('por unidade', 'por unidad')}</span></li>
      <li><strong>{DEVELOPMENT.floors}</strong><span>{say('andares', 'pisos')}</span></li>
    </ul>
    <section className="rp-block rp-mora" aria-label="Mora">
      <p className="rp-eyebrow">{say('A favor', 'A favor')}</p>
      <ul>{MORA.pros.map(item => <li key={item.icon}><Glyph name={item.icon}/><span><b>{pick(item.title, say)}</b><small>{pick(item.note, say)}</small></span></li>)}</ul>
      <p className="rp-eyebrow is-con">{say('A considerar', 'A considerar')}</p>
      <ul>{MORA.cons.map(item => <li key={item.icon}><Glyph name={item.icon}/><span><b>{pick(item.title, say)}</b><small>{pick(item.note, say)}</small></span></li>)}</ul>
    </section>
    <section className="rp-block">
      <h2>{say('Amenidades', 'Amenidades')}</h2>
      <ul className="rp-amenities">{AMENITIES.map(item => <li key={item.id}>{item.anchor !== undefined && !modelFailed
        ? <button type="button" onClick={() => onAmenity(item)} title={say('Ver no prédio', 'Ver en el edificio')}><RIcon name={item.icon}/><span>{pick(item.name, say)}</span><span className="rp-amenity-pin"><RIcon name="pin" size={14}/></span></button>
        : <span><RIcon name={item.icon}/><span>{pick(item.name, say)}</span></span>}</li>)}</ul>
    </section>
    <section className="rp-block">
      <h2>{say('Galeria', 'Galería')}</h2>
      <ul className="rp-gallery">{GALLERY.map((item, index) => <li key={item.src}><button type="button" onClick={() => onPhoto(index)} aria-label={say(`Abrir imagem ${index + 1} de ${GALLERY.length}`, `Abrir imagen ${index + 1} de ${GALLERY.length}`)}>
        <img src={item.src} alt={pick(item.alt, say)} loading="lazy"/>{item.render && <span>{say('Render', 'Render')}</span>}</button></li>)}</ul>
    </section>
    <section className="rp-block">
      <h2>{say('Sobre o empreendimento', 'Acerca del desarrollo')}</h2>
      <p className={`rp-copy${more ? ' is-open' : ''}`}>{description}</p>
      <button type="button" className="rp-link" aria-expanded={more} onClick={() => setMore(value => !value)}>{more ? say('Mostrar menos', 'Mostrar menos') : say('Mostrar mais', 'Mostrar más')}</button>
    </section>
    <section className="rp-block">
      <h2>{say('Onde você vai morar', 'Dónde vas a vivir')}</h2>
      <ul className="rp-near">
        <li><Glyph name="transport"/><span><b>{say('Metrô Polanco', 'Metro Polanco')}</b><small>{say('10 min a pé', '10 min a pie')}</small></span></li>
        <li><Glyph name="green"/><span><b>Parque Lincoln</b><small>{say('4 min a pé', '4 min a pie')}</small></span></li>
        <li><Glyph name="education"/><span><b>{say('Kínder & Primaria Lafontaine', 'Kínder & Primaria Lafontaine')}</b><small>{say('4 min a pé', '4 min a pie')}</small></span></li>
      </ul>
      {!modelFailed && <button type="button" className="rp-secondary is-block" onClick={onCityMode}>{say('Ver na cidade', 'Ver en la ciudad')}</button>}
    </section>
    <section className="rp-block rp-developer">
      <img src={DEVELOPER.logo} alt="" width="48" height="48"/>
      <span><b>{DEVELOPER.name}</b><small>{say('Responsável pelas vendas', 'Responsable de las ventas')}</small><small>{say(`Mais ${DEVELOPER.otherProjects} empreendimentos no Inmuebles24`, `Más ${DEVELOPER.otherProjects} desarrollos en Inmuebles24`)}</small></span>
    </section>
    <section className="rp-block rp-verified">
      <button type="button" aria-expanded={verified} onClick={() => setVerified(value => !value)}><RIcon name="check"/><span>{say('Empreendimento verificado', 'Desarrollo verificado')}</span><RIcon name="chevron" size={16}/></button>
      {verified && <ul>
        <li>{say('Identidade da incorporadora', 'Identidad de la desarrolladora')}</li>
        <li>{say('Plantas por tipologia', 'Planos por tipología')}</li>
        <li>{say('Preços e disponibilidade em 14 out. 2026', 'Precios y disponibilidad al 14 oct. 2026')}</li>
        <li className="rp-muted">{say('Verificação simulada neste protótipo.', 'Verificación simulada en este prototipo.')}</li>
      </ul>}
    </section>
  </>;
}

function Chip({pressed, onClick, children}) {
  return <button type="button" className="rp-chip" aria-pressed={pressed} onClick={onClick}>{children}</button>;
}

function UnitsView({say, filters, onFilters, sort, onSort, hoverId, onHoverUnit, onUnit, floorPick, onFloorPick}) {
  const list = listedUnits(filters, sort);
  const groups = groupByTypology(list);
  const [open, setOpen] = useState(() => new Set([groups[0]?.type.id]));
  const set = patch => onFilters({...filters, ...patch});
  const toggle = id => setOpen(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const total = filters.onlyAvailable ? available.length : UNITS.length;
  const floorUnits = floorPick ? UNITS.filter(unit => unit.floor === floorPick) : [];
  const rowProps = unit => ({onMouseEnter:() => onHoverUnit(unit.id), onMouseLeave:() => onHoverUnit(null), onFocus:() => onHoverUnit(unit.id), onBlur:() => onHoverUnit(null), onClick:() => onUnit(unit.id)});
  return <>
    <div className="rp-filters">
      <div className="rp-filter-row" role="group" aria-label={say('Quartos', 'Recámaras')}>
        <span>{say('Quartos', 'Recámaras')}</span>
        {[1, 2, 3].map(beds => <Chip key={beds} pressed={filters.beds === beds} onClick={() => set({beds:filters.beds === beds ? null : beds})}>{beds}</Chip>)}
      </div>
      <div className="rp-filter-row" role="group" aria-label={say('Preço', 'Precio')}>
        <span>{say('Preço', 'Precio')}</span>
        {PRICE_CAPS.map(cap => <Chip key={cap} pressed={filters.maxPrice === cap} onClick={() => set({maxPrice:filters.maxPrice === cap ? null : cap})}>{say(`Até ${short(cap)}`, `Hasta ${short(cap)}`)}</Chip>)}
      </div>
      <div className="rp-filter-row" role="group" aria-label={say('Vista', 'Vista')}>
        <span>{say('Vista', 'Vista')}</span>
        {SIDES.map(side => <Chip key={side} pressed={filters.view === side} onClick={() => set({view:filters.view === side ? null : side})}>{side === 'norte' ? 'Norte' : say('Sul', 'Sur')}</Chip>)}
      </div>
      <label className="rp-switch"><input type="checkbox" role="switch" checked={filters.onlyAvailable} onChange={event => set({onlyAvailable:event.target.checked})}/><span aria-hidden="true"/>{say('Só disponíveis', 'Solo disponibles')}</label>
      <div className="rp-count">
        <span aria-live="polite">{say(`${list.length} de ${total} unidades`, `${list.length} de ${total} unidades`)}</span>
        <label>{say('Ordenar', 'Ordenar')}
          <select value={sort} onChange={event => onSort(event.target.value)}>
            <option value="floor">{say('Andar', 'Piso')}</option><option value="price">{say('Preço', 'Precio')}</option><option value="size">m²</option>
          </select>
        </label>
      </div>
    </div>
    {floorPick && <section className="rp-floor-pick" aria-label={say(`Andar ${floorPick}`, `Piso ${floorPick}`)}>
      <header><b>{say(`Andar ${floorPick}`, `Piso ${floorPick}`)}</b><button type="button" className="rp-icon is-small" aria-label={say('Fechar', 'Cerrar')} onClick={() => onFloorPick(null)}><RIcon name="close" size={14}/></button></header>
      <ul className="rp-rows">{floorUnits.map(unit => <UnitRow key={unit.id} unit={unit} say={say} hovered={hoverId === unit.id} {...rowProps(unit)}/>)}</ul>
    </section>}
    {groups.length ? groups.map(({type, units}) => {
      const isOpen = open.has(type.id), prices = units.filter(unit => unit.status === 'available').map(unit => unit.price);
      return <section key={type.id} className="rp-type" data-open={isOpen || undefined}>
        <button type="button" className="rp-type-head" aria-expanded={isOpen} onClick={() => toggle(type.id)}>
          <img src={type.plan} alt="" width="56" height="56"/>
          <span><b>{say(`Tipo ${type.id} · ${type.beds} ${type.beds === 1 ? 'quarto' : 'quartos'} · ${type.size} m²`, `Tipo ${type.id} · ${type.beds} ${type.beds === 1 ? 'recámara' : 'recámaras'} · ${type.size} m²`)}</b>
            <small>{prices.length ? say(`${prices.length} ${prices.length === 1 ? 'disponível' : 'disponíveis'} · a partir de ${formatMoney(Math.min(...prices))}`, `${prices.length} ${prices.length === 1 ? 'disponible' : 'disponibles'} · desde ${formatMoney(Math.min(...prices))}`) : say('Nenhuma disponível', 'Ninguna disponible')}</small></span>
          <RIcon name="chevron" size={16}/>
        </button>
        {isOpen && <>
          <div className="rp-row is-head" aria-hidden="true"><span>{say('Unidade', 'Unidad')}</span><span>{say('Andar', 'Piso')}</span><span>{say('Vista', 'Vista')}</span><span>{say('Preço', 'Precio')}</span><span>{say('Status', 'Estado')}</span></div>
          <ul className="rp-rows">{units.map(unit => <UnitRow key={unit.id} unit={unit} say={say} hovered={hoverId === unit.id} {...rowProps(unit)}/>)}</ul>
        </>}
      </section>;
    }) : <div className="rp-empty">
      <p>{say('Nenhuma unidade corresponde aos seus filtros', 'Ninguna unidad coincide con tus filtros')}</p>
      <button type="button" className="rp-secondary" onClick={() => onFilters(DEFAULT_FILTERS)}>{say('Limpar filtros', 'Limpiar filtros')}</button>
    </div>}
    {filtersActive(filters) && groups.length > 0 && <button type="button" className="rp-link" onClick={() => onFilters({...DEFAULT_FILTERS, onlyAvailable:filters.onlyAvailable})}>{say('Limpar filtros', 'Limpiar filtros')}</button>}
  </>;
}

function UnitRow({unit, say, hovered, ...handlers}) {
  return <li><button type="button" className="rp-row" data-hovered={hovered || undefined} {...handlers}
    aria-label={`${say('Unidade', 'Unidad')} ${unit.id}, ${say('andar', 'piso')} ${unit.floor}, ${orientationLabel(unit, say)}, ${formatMoney(unit.price)}, ${statusLabel(unit.status, say)}`}>
    <b>{unit.id}</b><span>{unit.floor}</span><span>{orientationLabel(unit, say)}</span><span>{unit.status === 'sold' ? '—' : formatMoney(unit.price)}</span><StatusPill status={unit.status} say={say}/>
  </button></li>;
}

function UnitView({unit, say, onView, onUnit, onHoverUnit, onWindow, planOnSlab, onPlanOnSlab, onPhoto, modelFailed, hoverId}) {
  const type = TYPOLOGIES.find(item => item.id === unit.typology);
  const similar = similarUnits(unit);
  const specs = [
    say(`${unit.beds} ${unit.beds === 1 ? 'quarto' : 'quartos'}`, `${unit.beds} ${unit.beds === 1 ? 'recámara' : 'recámaras'}`),
    say(`${unit.baths} ${unit.baths === 1 ? 'banheiro' : 'banheiros'}`, `${unit.baths} ${unit.baths === 1 ? 'baño' : 'baños'}`),
    unit.parking ? say(`${unit.parking} vaga`, `${unit.parking} estac.`) : say('Sem vaga', 'Sin estac.'),
    `${unit.size} m²`,
    say(`Andar ${unit.floor}`, `Piso ${unit.floor}`),
    say(`Vista ${orientationLabel(unit, say).toLowerCase()}`, `Vista ${orientationLabel(unit, say).toLowerCase()}`),
  ];
  return <>
    <button type="button" className="rp-back is-inline" onClick={() => onView('units')}><RIcon name="back" size={16}/>{say('Unidades', 'Unidades')}</button>
    <section className="rp-block rp-unit-head">
      <h2>{say(`Unidade ${unit.id}`, `Unidad ${unit.id}`)}</h2><StatusPill status={unit.status} say={say}/>
    </section>
    {unit.status !== 'sold' && <section className="rp-block rp-price">
      <p className="rp-price-main">{formatMoney(unit.price)} MXN</p>
      <p className="rp-muted">{formatMoney(unit.perMeter)} / m²</p>
    </section>}
    <ul className="rp-block rp-specs">{specs.map(item => <li key={item}>{item}</li>)}</ul>
    <section className="rp-block rp-plan">
      <button type="button" className="rp-plan-image" onClick={() => onPhoto({src:unit.plan, alt:say(`Planta do tipo ${type.id}`, `Planta del tipo ${type.id}`)})} aria-label={say('Ampliar planta', 'Ampliar planta')}>
        <img src={unit.plan} alt={say(`Planta do tipo ${type.id}`, `Planta del tipo ${type.id}`)}/><span className="rp-plan-zoom"><RIcon name="zoom" size={16}/></span>
      </button>
      {!modelFailed && <label className="rp-switch"><input type="checkbox" role="switch" checked={planOnSlab} onChange={event => onPlanOnSlab(event.target.checked)}/><span aria-hidden="true"/>{say('Ver sobre o prédio', 'Ver sobre el edificio')}</label>}
    </section>
    {!modelFailed && <button type="button" className="rp-secondary is-block is-large" onClick={() => onWindow(unit)}><Glyph name="view" size={18}/>{say('Ver a vista daqui', 'Ver la vista desde aquí')}</button>}
    <section className="rp-block rp-mora-line" aria-label={say('Mora sobre esta unidade', 'Mora sobre esta unidad')}>
      <p className="rp-eyebrow">{say('Mora sobre esta unidade', 'Mora sobre esta unidad')}</p>
      {unitLine(unit, say, formatMoney).map(line => <p key={line}>{line}</p>)}
    </section>
    {similar.length > 0 && <section className="rp-block">
      <h2>{say('Unidades parecidas', 'Unidades similares')}</h2>
      <ul className="rp-similar">{similar.map(item => <li key={item.id}><button type="button" data-hovered={hoverId === item.id || undefined} onClick={() => onUnit(item.id)}
        onMouseEnter={() => onHoverUnit(item.id)} onMouseLeave={() => onHoverUnit(null)} onFocus={() => onHoverUnit(item.id)} onBlur={() => onHoverUnit(null)}>
        <b>{item.id}</b><small>{say(`Andar ${item.floor}`, `Piso ${item.floor}`)} · {orientationLabel(item, say)}</small><small>{formatMoney(item.price)}</small><StatusPill status={item.status} say={say}/>
      </button></li>)}</ul>
    </section>}
  </>;
}
