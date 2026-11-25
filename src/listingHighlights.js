import {marketFacts} from './moraAnalysis.js';
import {seed} from './listingAdvertiser.js';

const none = Object.freeze({drop:null, demand:null});

/**
 * The two highlights a result card can carry, stable per listing and independent of each other: a listing can have
 * a price drop, high demand, both, or neither. Developments keep their own treatment.
 * Figures are illustrative for the prototype (the same stable numbers Mora's readings use).
 */
export function listingHighlights(home) {
  if (!home || home.development) return none;
  const market = marketFacts(home);
  // The price history shows a cut for every listing; only about one in four earns the highlight.
  const drop = market.drop && seed(`drop|${home.id}`) % 4 === 0
    ? {amount:market.drop, pct:Math.max(1, Math.round(market.drop / (market.price + market.drop) * 100)), days:market.dropDays, price:market.price, was:market.price + market.drop, comparables:market.comparables, delta:market.delta}
    : null;
  return drop ? {drop, demand:null} : none;
}

const factor = value => value.toFixed(1).replace('.', ',');

/** Pill and tooltip copy. A tooltip is `[before, bold, after]` so the figure reads in bold. */
export function highlightCopy(highlights, {say, money}) {
  const {drop, demand} = highlights;
  return {
    drop: drop && {
      label:`${drop.pct}%`,
      tip:[say('Baixou ', 'Bajó '), say(`${drop.pct}% de preço`, `${drop.pct}% de precio`),
        say(` há ${drop.days} dias: de ${money(drop.was)} para ${money(drop.price)}.`, ` hace ${drop.days} días: de ${money(drop.was)} a ${money(drop.price)}.`)],
    },
    demand: demand && {
      label:say(`${factor(demand.factor)}x mais visualizações  •  ${demand.hours} horas`, `${factor(demand.factor)}x más visualizaciones  •  ${demand.hours} horas`),
      tip:[say('Alta competitividade: ', 'Alta competitividad: '), say(`${factor(demand.factor)}x mais visitas e favoritos`, `${factor(demand.factor)}x más visitas y favoritos`),
        say(` que o bairro em ${demand.hours} h.`, ` que el barrio en ${demand.hours} h.`)],
    },
  };
}

/** What the card says under the photo, built only from fields the listing publishes. */
export function listingSeo(home, language = 'es-MX') {
  const pt = language === 'pt-BR';
  const house = /\bcasa\b/i.test(home.title || '');
  const kind = pt ? (house ? 'Casa' : 'Apartamento') : (house ? 'Casa' : 'Departamento');
  const rent = home.mode === 'rent';
  const operation = pt ? (rent ? 'para alugar' : 'à venda') : (rent ? 'en renta' : 'en venta');
  const size = home.size >= 20 ? ` ${pt ? 'de' : 'de'} ${home.size} m²` : '';
  const place = home.street && home.street !== home.area ? `${home.street}, ${home.area}` : home.area;
  return `${kind} ${operation}${size} ${pt ? 'em' : 'en'} ${place}.`;
}
