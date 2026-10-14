// Checks every Mora fixture against the rules, plus the golden examples (must pass) and anti-examples (must fail).
// With MORA_API_KEY, MORA_API_BASE and MORA_MODEL set, a second pass asks the model to judge each fixture against the guide's checklist.
// Writes qa/mora/validation-report.json and exits 1 when a fixture fails or the golden/anti expectations break.
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {antiFixtures, goldFixtures, validateFixture, validateSet} from '../src/moraValidate.js';

const DIR = 'src/data/mora-fixtures';
const CHECKLIST = [
  'A síntese interpreta, não descreve.',
  'Nenhum insight fala só de preço sem explicar o porquê.',
  'Os insights vêm de pelo menos duas dimensões diferentes além do preço.',
  'Pelo menos um insight usa algo que a pessoa disse ou fez (busca, conversa, favoritos).',
  'Toda inferência de foto usa "parece".',
  'Todo insight passa no teste "e daí?".',
  'Existe pelo menos uma ação concreta.',
  'Nenhuma frase de sistema ("lo que se puede verificar", "información no disponible").',
  'Nenhum adjetivo sem dado, nenhuma caracterização de moradores.',
];

async function judge(fixture) {
  const {MORA_API_KEY:key, MORA_API_BASE:base, MORA_MODEL:model} = process.env;
  if (!key || !base || !model) return {status:'skipped', reason:'MORA_API_KEY, MORA_API_BASE or MORA_MODEL not set'};
  const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method:'POST',
    headers:{'content-type':'application/json', authorization:`Bearer ${key}`},
    body:JSON.stringify({
      model, temperature:0, response_format:{type:'json_object'},
      messages:[
        {role:'system', content:`Você avalia análises da Mora. Para o checklist abaixo, responda só JSON {"approved": boolean, "reasons": string[]}, com um motivo por item reprovado.\n${CHECKLIST.map(item => `- ${item}`).join('\n')}`},
        {role:'user', content:JSON.stringify({factSheet:fixture.factSheet, output:fixture.output})},
      ],
    }),
  });
  if (!response.ok) return {status:'error', reason:`HTTP ${response.status}`};
  const verdict = JSON.parse((await response.json()).choices[0].message.content);
  return {status:verdict.approved ? 'approved' : 'rejected', reasons:verdict.reasons || []};
}

const files = (await readdir(DIR).catch(() => [])).filter(name => name.endsWith('.json')).sort();
const fixtures = await Promise.all(files.map(async name => {
  const data = JSON.parse(await readFile(`${DIR}/${name}`, 'utf8'));
  return {id:data.meta?.listingId || name.replace(/\.json$/, ''), ...data};
}));

const report = {fixtures:[], set:validateSet(fixtures), gold:[], anti:[]};
for (const fixture of fixtures) report.fixtures.push({id:fixture.id, generatedBy:fixture.meta?.generatedBy, ...validateFixture(fixture), judge:await judge(fixture)});
for (const fixture of goldFixtures()) report.gold.push({id:fixture.id, ...validateFixture(fixture)});
for (const fixture of antiFixtures()) report.anti.push({id:fixture.id, ...validateFixture(fixture)});

await mkdir('qa/mora', {recursive:true});
await writeFile('qa/mora/validation-report.json', `${JSON.stringify(report, null, 2)}\n`);

const line = (label, item, expectOk) => {
  const mark = item.ok === expectOk ? 'ok ' : 'XX ';
  console.log(`${mark}${label} ${item.id}: ${item.ok ? 'aprovado' : 'reprovado'}${item.judge ? ` · avaliador: ${item.judge.status}` : ''}`);
  for (const error of item.errors) console.log(`     - ${error.rule}: ${error.detail}`);
};
report.fixtures.forEach(item => line('fixture', item, true));
report.gold.forEach(item => line('ouro', item, true));
report.anti.forEach(item => line('anti', item, false));
console.log(`${report.set.ok ? 'ok ' : 'XX '}conjunto: ${report.set.errors.length} repetições entre imóveis`);
for (const error of report.set.errors) console.log(`     - ${error.rule}: ${error.detail}`);

const broken = report.fixtures.some(item => !item.ok || item.judge.status === 'rejected') || !report.set.ok
  || report.gold.some(item => !item.ok) || report.anti.some(item => item.ok);
process.exit(broken ? 1 : 0);
