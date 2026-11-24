import React, {useEffect, useMemo, useState} from 'react';
import {RailHeading} from './DiscoveryRail.jsx';
import {useLanguage} from './i18n.jsx';
import {normalizeSearch} from './journey.js';
import {relatedLinkChanges, relatedSearches} from './relatedSearches.js';
import {criterionLabel} from './searchCriteria.js';

const TITLE = 'Búsquedas en alza';
const SUBTITLE = 'Diferentes distribuciones para una nueva rutina.';

const CITIES = [
  ['Ciudad de México', 'Roma Norte'], ['Guadalajara', 'Providencia'], ['Monterrey', 'San Pedro Garza García'], ['Puebla', 'Angelópolis'],
  ['Querétaro', 'Juriquilla'], ['Toluca', 'Toluca Centro'], ['Mérida', 'Centro Mérida'], ['Cancún', 'Centro Cancún'],
  ['Cuernavaca', 'Centro Cuernavaca'], ['Veracruz', 'Boca del Río'],
];
const NOUNS = {house: {rent: 'Casas en renta en {city}', buy: 'Casas en venta en {city}'}, apartment: {rent: 'Departamentos en renta en {city}', buy: 'Departamentos en venta en {city}'}};
/** Every city with both kinds of home, starting with `first` and rotated by `shift` so the three groups do not repeat each other. */
const group = (id, title, mode, first, shift = 0) => {
  const second = first === 'house' ? 'apartment' : 'house';
  const links = [first, second].flatMap(propertyType => CITIES.map(([city, area], index) => ({
    label: NOUNS[propertyType][mode], city: CITIES[(index + shift) % CITIES.length][0], area: CITIES[(index + shift) % CITIES.length][1], mode, propertyType,
  })));
  return {id, title, links};
};
// Six columns of three rows per group.
const GROUPS = [
  group('rent', 'Para rentar', 'rent', 'apartment'),
  group('buy', 'Para comprar', 'buy', 'house', 2),
  group('invest', 'Para invertir', 'buy', 'apartment', 5),
];

const LINKS_PER_GROUP = 18;
/** 3D illustrations for the pills of the related searches (Figma 13053:13292). */
const PILL_IMAGE = {traits: '/assets/internal-links/features-bed.jpg', amenities: '/assets/internal-links/amenities-pool.jpg', nearby: '/assets/internal-links/nearby-neighborhood.jpg'};

export function HomeInternalLinks({search, onSearch, onIntroDone, onChoose, onOpen, variant = 'home'}) {
  const {language, t} = useLanguage();
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const current = normalizeSearch(search);
  const key = JSON.stringify([current.mode, current.areas, current.propertyType]);
  const related = useMemo(() => variant === 'results' ? relatedSearches(search) : null, [variant, key]);

  function open(link) {
    onIntroDone?.();
    onChoose?.('template');
    onSearch?.({
      ...search,
      mode: link.mode,
      propertyType: link.propertyType,
      criteria: [],
      minBudget: 0,
      budget: link.mode === 'rent' ? 28000 : 7500000,
      area: link.area,
      areas: [link.area],
      address: '',
      beds: 2,
      fromIdea: false,
    });
  }

  if (variant === 'results') return <ResultsLinks related={related} search={search} onSearch={onSearch} onOpen={onOpen} say={say} pt={pt}/>;

  return <LinkTabs id="home-links-title" title={t(TITLE)} subtitle={t(SUBTITLE)} groups={evenColumns(GROUPS, LINKS_PER_GROUP).map(group => ({
    id: group.id,
    title: t(group.title),
    items: group.links.map(link => ({
      id: link.label + link.city,
      label: t(link.label.replace(' en {city}', '')),
      sub: t(link.city),
      onClick: () => open(link),
    })),
  }))}/>;
}

function ResultsLinks({related, search, onSearch, onOpen, say, pt}) {
  if (!related) return null;
  const {area, mode, house, count, card, traits, amenities, nearby} = related;
  const rent = mode === 'rent';
  const noun = house ? 'casas' : say('apartamentos', 'departamentos');
  const one = house ? say('casa', 'casa') : say('apartamento', 'departamento');
  const operation = rent ? say('para alugar', 'en renta') : say('à venda', 'en venta');
  const place = count === 1 ? one : noun;
  const language = pt ? 'pt-BR' : 'es';
  const linkNoun = say('apartamentos', 'departamentos');
  function apply(changes) {
    onSearch?.(relatedLinkChanges(search, changes));
    window.scrollTo({top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }
  const groups = [
    {id: 'traits', title: say('Por características', 'Por características'), items: traits.map(item => ({
      id: item.id,
      label: item.kind === 'baths'
        ? say(`${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'banheiros' : 'banheiro'}`, `${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'baños' : 'baño'}`)
        : say(`${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'quartos' : 'quarto'}`, `${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'recámaras' : 'recámara'}`),
      sub: item.area,
      changes: item.changes,
    }))},
    {id: 'amenities', title: say('Por comodidades', 'Por amenidades'), items: amenities.map(item => {
      const amenity = item.kind === 'criterion' ? criterionLabel(item.criterion, language).toLocaleLowerCase(pt ? 'pt-BR' : 'es-MX') : null;
      return {
        id: item.id,
        label: item.kind === 'parking'
          ? say(`${cap(linkNoun)} com ${item.count} vaga${item.count > 1 ? 's' : ''}`, `${cap(linkNoun)} con ${item.count} estacionamiento${item.count > 1 ? 's' : ''}`)
          : say(`${cap(linkNoun)} com ${amenity}`, `${cap(linkNoun)} con ${amenity}`),
        sub: item.area,
        changes: item.changes,
      };
    })},
    {id: 'nearby', title: say('Colônias próximas', 'Colonias próximas'), items: nearby.map(name => ({
      id: name,
      label: say(`${cap(linkNoun)} ${operation}`, `${cap(linkNoun)} ${operation}`),
      sub: name,
      changes: {area: name, areas: [name]},
    }))},
  ].filter(group => group.items.length);
  const columns = evenColumns(groups);

  return <LinkTabs id="results-links-title" className="is-results" title={say('Buscas relacionadas', 'Búsquedas relacionadas')}
    subtitle={say(`Encontre ${noun} ${operation} por categorias`, `Encuentra ${noun} ${operation} por categorías`)}
    groups={columns.map(group => ({...group, image: PILL_IMAGE[group.id], items: group.items.map(item => ({...item, onClick: () => apply(item.changes)}))}))}/>;
}

/** Section from Figma 13043:12944: heading with arrows, one pill per group, and the selected group's links in a grid. */
function LinkTabs({id, className = '', title, subtitle, groups}) {
  const {t} = useLanguage();
  const [index, setIndex] = useState(0);
  const signature = groups.map(group => group.id).join('|');
  useEffect(() => setIndex(0), [signature]);
  if (!groups.length) return null;
  const at = Math.min(index, groups.length - 1);
  const group = groups[at];
  return <section className={`home-links ${className}`.trim()} aria-labelledby={id}>
    <RailHeading titleId={id} title={title} subtitle={subtitle}
      prevLabel={t('Anterior: ') + title} nextLabel={t('Siguiente: ') + title}
      position={{start: at === 0, end: at === groups.length - 1}}
      onMove={direction => setIndex(Math.max(0, Math.min(groups.length - 1, at + direction)))}/>
    <div className="home-links-tabs" role="group" aria-label={title}>
      {groups.map((item, position) => <button key={item.id} type="button" className="home-pill home-city-tab"
        aria-pressed={position === at} onClick={() => setIndex(position)}>{item.image && <img className="home-city-tab-image" src={item.image} alt="" width="40" height="40" loading="lazy"/>}{item.title}</button>)}
    </div>
    <ul className="home-links-grid" key={group.id}>
      {group.items.map(item => <li key={item.id}>
        <button type="button" onClick={item.onClick}><strong>{item.label}</strong><span>{item.sub}</span></button>
      </li>)}
    </ul>
  </section>;
}

const cap = text => text ? text[0].toLocaleUpperCase('es-MX') + text.slice(1) : text;

/** Every column shows the same number of links: the shortest list sets the length, up to `limit`. */
function evenColumns(groups, limit) {
  const itemsOf = group => group.links || group.items;
  if (!groups.length) return groups;
  const count = Math.min(...groups.map(group => itemsOf(group).length), limit ?? Infinity);
  return groups.map(group => group.links ? {...group, links: group.links.slice(0, count)} : {...group, items: group.items.slice(0, count)});
}
