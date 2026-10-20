import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../src/data.js';
import {selectableText, selectionAnswer, selectionLens} from '../src/selectionAsk.js';

const buy = homes.find(home => home.id === 'buy-148816386');
const rent = homes.find(home => home.mode === 'rent' && !home.development);

test('the question picks the lens before the selected text', () => {
  assert.equal(selectionLens({text:'a unos pasos del metro', question:'¿Está caro?'}), 'price');
  assert.equal(selectionLens({text:'a unos pasos del metro'}), 'distance');
  assert.equal(selectionLens({text:'$4,800,000'}), 'price');
  assert.equal(selectionLens({text:'Excelente oportunidad'}), 'jargon');
  assert.equal(selectionLens({text:'Con roof garden privado'}), 'attribute');
  assert.equal(selectionLens({text:'Muy amables', zone:'review'}), 'review');
  assert.equal(selectionLens({text:'Bienvenido'}), 'describe');
});

test('market questions reuse the illustrative ranges, per operation', () => {
  const sale = selectionAnswer({text:'$4,800,000', question:'¿Cuánto cobra el notario?', home:buy});
  assert.equal(sale.lens, 'notary');
  assert.match(sale.text, /4% y 7%/);
  assert.equal(sale.note, 'Referencia ilustrativa');
  const lease = selectionAnswer({text:'Renta', question:'¿Cuánto cobra el notario?', home:rent});
  assert.match(lease.text, /Al rentar no se escritura/);
  const loose = selectionAnswer({text:'Hola', question:'¿Qué garantía piden?'});
  assert.match(loose.note, /no cambia tus filtros/);
});

test('price and distance read the listing around the selection', () => {
  const price = selectionAnswer({text:'$4,800,000', question:'¿Está caro?', home:buy});
  assert.match(price.text, /Narvarte Poniente/);
  assert.match(price.text, /m²/);
  const steps = selectionAnswer({text:'a unos pasos del metro', home:buy});
  assert.equal(steps.lens, 'distance');
  assert.match(steps.text, /«a unos pasos»/);
  assert.match(steps.text, /min a pie/);
  const claimed = selectionAnswer({text:'la estación queda a 40 min a pie', home:buy});
  assert.match(claimed.text, /^El texto dice 40 min; por la ruta a pie/);
});

test('without a listing Mora says what she cannot tell', () => {
  const price = selectionAnswer({text:'$28,500', question:'¿Está caro?'});
  assert.match(price.text, /no sé de qué anuncio/);
  const loose = selectionAnswer({text:'Encuentra tu lugar'});
  assert.equal(loose.lens, 'describe');
  assert.match(loose.text, /no es un dato de un anuncio/);
  const offTopic = selectionAnswer({text:'Narvarte', question:'¿Llueve mucho en esta colonia?', home:buy});
  assert.equal(offTopic.lens, 'unknown');
  assert.match(offTopic.text, /no está en el anuncio/);
});

test('unknown listing facts stay to confirm, and the agency is offered instead', () => {
  const fee = selectionAnswer({text:'Mantenimiento', home:{...buy, fee:null}});
  assert.equal(fee.ask, true);
  assert.match(fee.text, /no publica el mantenimiento/);
  assert.equal(fee.chips[0], 'Preguntar a la inmobiliaria');
  const shown = selectionAnswer({text:'Mantenimiento al mes', around:'$4,000 MXN Mantenimiento al mes', home:{...buy, fee:null}});
  assert.match(shown.text, /muestra \$4,000.*no publica/);
  const agency = selectionAnswer({text:'Mantenimiento', question:'Preguntar a la inmobiliaria', home:buy});
  assert.equal(agency.lens, 'agency');
  assert.match(agency.text, /no se envía nada/);
});

test('every answer has two chips and a Portuguese pair', () => {
  for (const args of [{text:'$4,800,000', home:buy}, {text:'Hola'}, {text:'a unos pasos', home:buy}]) {
    const es = selectionAnswer(args), br = selectionAnswer({...args, language:'pt-BR'});
    assert.equal(es.chips.length, 2);
    assert.notEqual(es.text, br.text);
  }
});

test('selection length is bounded', () => {
  assert.equal(selectableText('a'), null);
  assert.equal(selectableText('  dos   palabras '), 'dos palabras');
  assert.equal(selectableText('x'.repeat(281)), null);
});
