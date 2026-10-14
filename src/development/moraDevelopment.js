import {DEVELOPMENT, MORA, UNITS, available} from './torreOlmo.js';

/** Mora's reading of a development, in the shape the mini-listing verdict reads. Nothing here is per apartment. */
export function developmentAnalysis({language = 'es-MX'} = {}) {
  const say = (br, es) => (language === 'pt-BR' ? br : es);
  const pick = item => ({id:item.icon, icon:item.icon, title:say(...item.title), note:say(...item.note)});
  const facts = [
    {...pick(MORA.pros[0]), polarity:'plus'},
    {...pick(MORA.pros[1]), polarity:'plus'},
    {...pick(MORA.cons[0]), polarity:'minus'},
  ];
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
