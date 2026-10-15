import {SIDES} from './buildingConfig.js';
import {DEVELOPMENT, MORA, UNITS, available} from './torreOlmo.js';
import {unitLine} from './units.js';

/** Mora's reading of a development, in the shape the mini-listing verdict reads. Nothing here is per apartment. */
export function developmentAnalysis({language = 'es-MX'} = {}) {
  const say = (br, es) => (language === 'pt-BR' ? br : es);
  const pick = (item, polarity) => ({id:item.icon, icon:item.icon, title:say(...item.title), note:say(...item.note), polarity});
  const facts = [...MORA.pros.map(item => pick(item, 'plus')), ...MORA.cons.map(item => pick(item, 'minus'))];
  const sentence = say(
    `Restam ${available.length} de ${UNITS.length} unidades. As do sul olham para o Parque Lincoln; o m² está acima da colônia.`,
    `Quedan ${available.length} de ${UNITS.length} unidades. Las del sur miran al Parque Lincoln; el m² está arriba de la colonia.`,
  );
  return {
    workingLines:[
      say(`Lendo as ${UNITS.length} unidades da ${DEVELOPMENT.name}…`, `Leyendo las ${UNITS.length} unidades de ${DEVELOPMENT.name}…`),
      say('Vendo o que cada fachada tem na frente…', 'Viendo qué tiene enfrente cada fachada…'),
    ],
    synthesis:sentence,
    verdict:{stance:'fair', sentence, facts, candidates:facts, question:null},
    dimensions:['price', 'surroundings'],
    modules:[],
    surroundings:null,
  };
}

const money = value => `$${Math.round(value).toLocaleString('en-US')}`;

/** Mora's reading of one unit against the inventory, same verdict shape as the development. */
export function unitAnalysis(unit, {language = 'es-MX'} = {}) {
  if (!unit) return null;
  const say = (br, es) => (language === 'pt-BR' ? br : es);
  const view = SIDES[unit.side] === 'norte' ? say('norte', 'norte') : say('sul', 'sur');
  const lines = unitLine(unit, say, money);
  const sentence = lines.join(' ');
  const high = unit.floor >= 8;
  const peers = available.filter(item => item.typology === unit.typology);
  const cheaper = peers.filter(item => item.id !== unit.id && item.perMeter < unit.perMeter).length;
  const facts = [
    {
      id:'view', icon:'view', polarity:high ? 'plus' : 'minus',
      title:say(`Vista ${view} no ${unit.floor}º andar`, `Vista ${view} en el piso ${unit.floor}`),
      note:high
        ? say('Do 8º andar para cima, nada alto fica na frente da fachada.', 'Del piso 8 hacia arriba, nada alto queda frente a la fachada.')
        : say('Abaixo do 8º andar, os prédios vizinhos entram na vista.', 'Debajo del piso 8, los edificios vecinos entran en la vista.'),
    },
    {
      id:'price', icon:'price', polarity:cheaper ? 'minus' : 'plus',
      title:say(`${money(unit.perMeter)} por m²`, `${money(unit.perMeter)} por m²`),
      note:cheaper
        ? say(`${cheaper} ${cheaper === 1 ? 'unidade disponível' : 'unidades disponíveis'} do tipo ${unit.typology} pedem menos por m².`, `${cheaper} ${cheaper === 1 ? 'unidad disponible' : 'unidades disponibles'} del tipo ${unit.typology} piden menos por m².`)
        : say(`É o m² mais baixo entre as disponíveis do tipo ${unit.typology}.`, `Es el m² más bajo entre las disponibles del tipo ${unit.typology}.`),
    },
  ];
  return {
    workingLines:[
      say(`Comparando a ${unit.id} com as outras disponíveis…`, `Comparando la ${unit.id} con las otras disponibles…`),
      say(`Vendo o que a fachada ${view} tem na frente…`, `Viendo qué tiene enfrente la fachada ${view}…`),
    ],
    synthesis:sentence,
    verdict:{stance:high && !cheaper ? 'good' : 'fair', sentence, facts, candidates:facts, question:null},
    dimensions:['price', 'surroundings'],
    modules:[],
    surroundings:null,
  };
}
