import {RANGES} from './torreOlmo.js';

const span = ([min, max]) => (min === max ? `${min}` : `${min}–${max}`);

/** The card's facts line for a development: ranges of m², bedrooms and parking over the available units. */
const many = ([min, max], one, several) => (min === max && max === 1 ? one : several);

export function developmentFacts(language = 'es-MX') {
  const pt = language === 'pt-BR';
  const parking = RANGES.parking[1];
  return [
    `${span(RANGES.size)} m²`,
    `${span(RANGES.beds)} ${pt ? many(RANGES.beds, 'quarto', 'quartos') : many(RANGES.beds, 'recámara', 'recámaras')}`,
    ...(parking > 0 ? [`${span(RANGES.parking)} ${pt ? many(RANGES.parking, 'vaga', 'vagas') : 'estac.'}`] : []),
  ];
}

export const developmentKind = language => (language === 'pt-BR' ? 'Unidades a partir de' : 'Unidades desde');
