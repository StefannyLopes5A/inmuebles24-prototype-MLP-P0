import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {homes} from '../src/data.js';
import {moraAnalysis, resetMoraSession} from '../src/moraAnalysis.js';
import {fixtureApplies, withFixture} from '../src/moraFixture.js';

const fixture = JSON.parse(readFileSync(new URL('../src/data/mora-fixtures/buy-151031662.json', import.meta.url), 'utf8'));
const home = homes.find(item => item.id === 'buy-151031662');
const search = {mode:'buy', area:'Narvarte Poniente', areas:['Narvarte Poniente'], budget:7500000, minBudget:0, beds:2, criteria:[], note:''};
const options = {search, hasSearch:true, language:'es-MX'};

test('the fixture replaces only the description and the price widget', () => {
  resetMoraSession();
  const base = moraAnalysis(home, options);
  const read = withFixture(base, fixture, options);
  assert.equal(read.synthesis, fixture.output.synthesis);
  assert.equal(read.modules.length, base.modules.length);
  read.modules.forEach((module, i) => {
    if (module.kind !== 'opportunity') assert.equal(module, base.modules[i]);
  });
  const price = read.modules.find(module => module.kind === 'opportunity');
  assert.equal(price.support, fixture.output.insights.find(item => item.dimension === 'market').text);
  assert.deepEqual([price.ruler.p10, price.ruler.median, price.ruler.p90, price.ruler.value], [31100, 48600, 71000, 38000]);
  assert.deepEqual(price.metric, {value:'−22%', unit:'vs. parecidos'});
  assert.equal(read.workingLines, base.workingLines);
});

test('a fixture written for another search or language does not apply', () => {
  assert.ok(fixtureApplies(fixture, options));
  assert.equal(fixtureApplies(fixture, {...options, language:'pt-BR'}), false);
  assert.equal(fixtureApplies(fixture, {...options, search:{...search, areas:['Roma Norte']}}), false);
  assert.equal(fixtureApplies(fixture, {...options, hasSearch:false}), false);
});

test('a price drop reads as a sentence, not a signed amount', () => {
  const dropped = {...fixture, factSheet:{...fixture.factSheet, market:{...fixture.factSheet.market, priceHistory:[{daysAgo:7, change:-150000}]}}};
  const money = amount => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN', maximumFractionDigits:0}).format(amount);
  const price = withFixture(moraAnalysis(home, options), dropped, {...options, money}).modules.find(module => module.kind === 'opportunity');
  assert.deepEqual(price.metric, {value:'Bajó $150,000', unit:'hace 7 días'});
  for (const item of homes) {
    const module = moraAnalysis(item, options).modules.find(entry => entry.kind === 'opportunity');
    if (module?.metric) assert.doesNotMatch(module.metric.value, /^−\$/, item.id);
  }
});
