import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {homes} from '../src/data.js';
import {factSheet} from '../src/moraFactSheet.js';
import {antiFixtures, goldFixtures, numbersIn, validateFixture, validateSet} from '../src/moraValidate.js';

const DIR = new URL('../src/data/mora-fixtures/', import.meta.url);
const fixtures = readdirSync(DIR).filter(name => name.endsWith('.json')).map(name => ({id:name.replace(/\.json$/, ''), ...JSON.parse(readFileSync(new URL(name, DIR), 'utf8'))}));
const rules = fixture => validateFixture(fixture).errors.map(item => item.rule);
const polanco = fixtures.find(item => item.id === 'buy-151031662');

test('golden examples pass and anti-examples fail', () => {
  for (const fixture of goldFixtures()) assert.deepEqual(validateFixture(fixture).errors, [], fixture.id);
  assert.ok(validateSet(goldFixtures()).ok);
  for (const fixture of antiFixtures()) {
    const found = rules(fixture);
    assert.ok(found.includes('photo-joined'), fixture.id);
    assert.ok(found.includes('repeats-synthesis'), fixture.id);
    assert.ok(found.includes('fit-missing'), fixture.id);
  }
  assert.ok(rules(antiFixtures()[0]).includes('se-parece'));
  assert.ok(rules(antiFixtures()[1]).includes('place-time'));
  assert.ok(rules(antiFixtures()[2]).includes('address'));
});

test('every fixture passes and its sheet is the one code computes today', () => {
  assert.ok(polanco, 'Polanco fixture');
  for (const fixture of fixtures) {
    assert.deepEqual(validateFixture(fixture).errors, [], fixture.id);
    const home = homes.find(item => item.id === fixture.meta.listingId);
    assert.deepEqual(fixture.factSheet, factSheet(home), `${fixture.id}: stale fact sheet, regenerate it`);
  }
  assert.ok(validateSet(fixtures).ok);
});

test('fixtures hold no credentials', () => {
  for (const fixture of fixtures) assert.doesNotMatch(JSON.stringify(fixture), /sk-[A-Za-z0-9]{10,}|api[_-]?key|bearer\s/i, fixture.id);
});

test('numbers are read with their written precision', () => {
  assert.deepEqual(numbersIn('$33.1k/m² y $7.5M').map(item => item.value), [33100, 7500000]);
  assert.deepEqual(numbersIn('Bajó $150,000 hace 7 días, −22%').map(item => item.value), [150000, 22, 7]);
});

test('each rule catches its own break', () => {
  const broken = output => rules({...polanco, output:{...polanco.output, ...output}});
  const [market, ...rest] = polanco.output.insights;
  assert.ok(broken({synthesis:'Cuesta 22% menos y por las fotos parece pedir obra.'}).includes('photo-joined'));
  assert.ok(broken({synthesis:Array(31).fill('palabra').join(' ')}).includes('synthesis-length'));
  assert.ok(broken({insights:[{...market, text:'Cuesta 30% menos por m² que parecidos.'}, ...rest]}).includes('number-not-in-sheet'));
  assert.ok(broken({insights:[market, {dimension:'neighborhood', text:'El Parque Lincoln queda a 5 min a pie.'}]}).includes('place-time'));
  assert.ok(broken({insights:[market, {dimension:'comparison', text:'Se parece a tu favorito en Cuauhtémoc 661.'}]}).includes('se-parece'));
  assert.ok(broken({insights:[market, {dimension:'photos', source:'photo_inference', text:'La cocina necesita obra.'}]}).includes('photo-hedge'));
  assert.ok(broken({insights:[{...market, action:{type:'x', label:'Información de precios de la zona completa'}}]}).includes('action-label'));
  assert.ok(broken({insights:[market, {...market}]}).includes('same-dimension'));
  assert.ok(broken({synthesis:'Excelente departamento en Polanco.'}).includes('forbidden'));
  assert.ok(broken({synthesis:'El Metro queda a 800 m.'}).includes('forbidden'));
  assert.ok(!broken({synthesis:'Bajó $5.7M hace 109 días.'}).includes('forbidden'), 'a price in millions is not a distance');
  assert.ok(broken({fit:null}).includes('fit-missing'));
  assert.ok(broken({marketRuler:{...polanco.output.marketRuler, median:40000}}).includes('ruler-number'));
  assert.equal(broken({insights:[...polanco.output.insights, {dimension:'neighborhood', text:'El Parque Lincoln queda a 2 min a pie.'}]}).length, 0, 'more insights is not an error');
  const twin = {...polanco, id:'twin'};
  assert.ok(validateSet([polanco, twin]).errors.some(item => item.rule === 'same-prompts'));
});
