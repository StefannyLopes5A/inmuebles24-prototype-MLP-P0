import React, {useMemo} from 'react';
import {useLanguage} from './i18n.jsx';
import {normalizeSearch} from './journey.js';
import {relatedLinkChanges, relatedSearches} from './relatedSearches.js';
import {criterionLabel} from './searchCriteria.js';

const TITLE = 'Búsquedas en alza';
const SUBTITLE = 'Diferentes distribuciones para una nueva rutina.';
const CARD_NOTE = 'Más de 100,000 propiedades disponibles';
const CARD_CITY = 'Ciudad de México';
const CARD_IMAGE = '/assets/developments/torre-olmo/render-fachada.jpg';

const GROUPS = [
  {
    id: 'rent',
    title: 'Para rentar',
    links: [
      {label: 'Casas en renta en {city}', city: 'Guadalajara', area: 'Providencia', mode: 'rent', propertyType: 'house'},
      {label: 'Departamentos en renta en {city}', city: 'Monterrey', area: 'San Pedro Garza García', mode: 'rent', propertyType: 'apartment'},
      {label: 'Casas en renta en {city}', city: 'Puebla', area: 'Angelópolis', mode: 'rent', propertyType: 'house'},
      {label: 'Departamentos en renta en {city}', city: 'Querétaro', area: 'Juriquilla', mode: 'rent', propertyType: 'apartment'},
      {label: 'Casas en renta en {city}', city: 'Toluca', area: 'Toluca Centro', mode: 'rent', propertyType: 'house'},
      {label: 'Departamentos en renta en {city}', city: 'Ciudad de México', area: 'Roma Norte', mode: 'rent', propertyType: 'apartment'},
      {label: 'Casas en renta en {city}', city: 'Mérida', area: 'Centro Mérida', mode: 'rent', propertyType: 'house'},
    ],
  },
  {
    id: 'buy',
    title: 'Para comprar',
    links: [
      {label: 'Departamentos en venta en {city}', city: 'Ciudad de México', area: 'Roma Norte', mode: 'buy', propertyType: 'apartment'},
      {label: 'Casas en venta en {city}', city: 'Guadalajara', area: 'Providencia', mode: 'buy', propertyType: 'house'},
      {label: 'Departamentos en venta en {city}', city: 'Monterrey', area: 'San Pedro Garza García', mode: 'buy', propertyType: 'apartment'},
      {label: 'Casas en venta en {city}', city: 'Puebla', area: 'Angelópolis', mode: 'buy', propertyType: 'house'},
      {label: 'Departamentos en venta en {city}', city: 'Querétaro', area: 'Juriquilla', mode: 'buy', propertyType: 'apartment'},
      {label: 'Casas en venta en {city}', city: 'Toluca', area: 'Toluca Centro', mode: 'buy', propertyType: 'house'},
      {label: 'Departamentos en venta en {city}', city: 'Mérida', area: 'Centro Mérida', mode: 'buy', propertyType: 'apartment'},
    ],
  },
  {
    id: 'invest',
    title: 'Para invertir',
    links: [
      {label: 'Casas en venta en {city}', city: 'Monterrey', area: 'San Pedro Garza García', mode: 'buy', propertyType: 'house'},
      {label: 'Departamentos en venta en {city}', city: 'Guadalajara', area: 'Providencia', mode: 'buy', propertyType: 'apartment'},
      {label: 'Casas en venta en {city}', city: 'Querétaro', area: 'Juriquilla', mode: 'buy', propertyType: 'house'},
      {label: 'Departamentos en venta en {city}', city: 'Puebla', area: 'Angelópolis', mode: 'buy', propertyType: 'apartment'},
      {label: 'Casas en venta en {city}', city: 'Ciudad de México', area: 'Roma Norte', mode: 'buy', propertyType: 'house'},
      {label: 'Departamentos en venta en {city}', city: 'Toluca', area: 'Toluca Centro', mode: 'buy', propertyType: 'apartment'},
      {label: 'Casas en venta en {city}', city: 'Cancún', area: 'Centro Cancún', mode: 'buy', propertyType: 'house'},
    ],
  },
];

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

  return <section className="home-links" aria-labelledby="home-links-title">
    <h2 id="home-links-title">{t(TITLE)}</h2>
    <p>{t(SUBTITLE)}</p>
    <div className="home-links-grid">
      <article className="discovery-item">
        <div className="discovery-card">
          <button type="button" className="discovery-open" onClick={() => open({mode: 'buy', propertyType: 'apartment', area: 'Roma Norte'})}>
            <span className="discovery-media">
              <img src={CARD_IMAGE} alt="" loading="lazy"/>
              <span className="discovery-copy"><span>{t(CARD_NOTE)}</span><strong>{t(CARD_CITY)}</strong></span>
            </span>
          </button>
        </div>
      </article>
      <LinkColumns groups={evenColumns(GROUPS).map(group => ({
        id: group.id,
        title: t(group.title),
        items: group.links.map(link => ({
          id: link.label + link.city,
          label: t(link.label, {city: t(link.city)}),
          onClick: () => open(link),
        })),
      }))}/>
    </div>
  </section>;
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
        ? say(`${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'banheiros' : 'banheiro'} ${operation} em ${item.area}`, `${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'baños' : 'baño'} ${operation} en ${item.area}`)
        : say(`${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'quartos' : 'quarto'} ${operation} em ${item.area}`, `${cap(linkNoun)} de ${item.count} ${item.count > 1 ? 'recámaras' : 'recámara'} ${operation} en ${item.area}`),
      changes: item.changes,
    }))},
    {id: 'amenities', title: say('Por comodidades', 'Por amenidades'), items: amenities.map(item => {
      const amenity = item.kind === 'criterion' ? criterionLabel(item.criterion, language).toLocaleLowerCase(pt ? 'pt-BR' : 'es-MX') : null;
      return {
        id: item.id,
        label: item.kind === 'parking'
          ? say(`${cap(linkNoun)} com ${item.count} vaga${item.count > 1 ? 's' : ''} ${operation} em ${item.area}`, `${cap(linkNoun)} con ${item.count} estacionamiento${item.count > 1 ? 's' : ''} ${operation} en ${item.area}`)
          : say(`${cap(linkNoun)} com ${amenity} ${operation} em ${item.area}`, `${cap(linkNoun)} con ${amenity} ${operation} en ${item.area}`),
        changes: item.changes,
      };
    })},
    {id: 'nearby', title: say('Colônias próximas', 'Colonias próximas'), items: nearby.map(name => ({
      id: name,
      label: say(`${cap(linkNoun)} ${operation} em ${name}`, `${cap(linkNoun)} ${operation} en ${name}`),
      changes: {area: name, areas: [name]},
    }))},
  ].filter(group => group.items.length);
  const columns = groups;

  return <section className="home-links is-results" aria-labelledby="results-links-title">
    <h2 id="results-links-title">{say('Buscas relacionadas', 'Búsquedas relacionadas')}</h2>
    <p>{say(`Encontre ${noun} ${operation} por categorias`, `Encuentra ${noun} ${operation} por categorías`)}</p>
    <div className="home-links-grid">
      <article className="discovery-item">
        <div className="discovery-card">
          <button type="button" className="discovery-open" aria-label={say(`Ver ${card.title}`, `Ver ${card.title}`)} onClick={event => onOpen ? onOpen(card, event) : apply({area, areas: [area]})}>
            <span className="discovery-media">
              <img src={card.image} alt="" loading="lazy"/>
              <span className="discovery-copy"><span>{`${count} ${place} ${operation}`}</span><strong>{area}</strong></span>
            </span>
          </button>
        </div>
      </article>
      <LinkColumns groups={columns.map(group => ({
        ...group,
        items: group.items.map(item => ({...item, onClick: () => apply(item.changes)})),
      }))}/>
    </div>
  </section>;
}

function LinkColumns({groups}) {
  return <div className="home-links-cols">
    {groups.map(group => <div key={group.id}>
      <h3>{group.title}</h3>
      <ul>
        {group.items.map(item => <li key={item.id}>
          <button type="button" onClick={item.onClick}>{item.label}</button>
        </li>)}
      </ul>
    </div>)}
  </div>;
}

const cap = text => text ? text[0].toLocaleUpperCase('es-MX') + text.slice(1) : text;

/** Every column shows the same number of links: the shortest list sets the length. */
function evenColumns(groups) {
  const itemsOf = group => group.links || group.items;
  if (!groups.length) return groups;
  const count = Math.min(...groups.map(group => itemsOf(group).length));
  return groups.map(group => group.links ? {...group, links: group.links.slice(0, count)} : {...group, items: group.items.slice(0, count)});
}
