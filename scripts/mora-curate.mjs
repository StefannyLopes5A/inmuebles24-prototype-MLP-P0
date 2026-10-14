// Builds fixtures from curated text: one entry per listing in qa/mora/curated-buy.json with the description, the price reading
// and two questions. Fit, ruler label, badge, numbers, places and address come from the fact sheet, as in mora-generate.
// Usage: node scripts/mora-curate.mjs [--file qa/mora/curated-buy.json]
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {homes} from '../src/data.js';
import {factSheet} from '../src/moraFactSheet.js';
import {codeOwnedFields, validateFixture, validateSet} from '../src/moraValidate.js';

const LABEL = {
  opportunity:'Abajo del mercado', fair:'En la mediana de la zona', negotiable:'Con margen para negociar',
  above_market:'Arriba del mercado', review_before_visit:'Revisar antes de visitar',
};
const short = amount => amount >= 1e6 ? `$${+(amount / 1e6).toFixed(1)}M` : `$${+(amount / 1e3).toFixed(1)}k`;

function fitCriteria(sheet) {
  const label = {
    zone:item => item.status === 'met' ? `En ${item.value}` : `${sheet.listing.colonia}, fuera de tus zonas`,
    budget:item => item.status === 'met' ? `Bajo ${short(item.limit)}` : `Arriba de ${short(item.limit)}`,
    bedrooms:item => item.status === 'unknown' ? 'Recámaras, sin dato' : `${item.min}+ rec.`,
    nearMetro:item => item.status === 'unknown' ? 'Metro, sin dato' : `Metro a ${item.value} min`,
    furnished:item => item.status === 'unknown' ? 'Amueblado, sin dato' : item.basis === 'listing' ? 'Amueblado' : 'Amueblado, por las fotos',
    balcony:item => item.status === 'met' ? 'Con balcón'
      : item.feature === 'balcony' ? 'Balcón, por las fotos'
        : item.feature === 'terrace' ? 'Balcón, sin dato; tiene terraza' : 'Balcón, sin dato',
  };
  const criteria = sheet.fit.map(item => ({
    label:label[item.key](item),
    status:item.status === 'seen' ? (item.feature === 'terrace' ? 'unknown' : 'met') : item.status,
    source:item.source,
    ...(item.basis === 'photo_inference' ? {basis:'photo_inference'} : {}),
  }));
  return {metCount:criteria.filter(item => item.status === 'met').length, total:criteria.length, criteria};
}

function badge(market) {
  const pct = market.diffVsMedianPct;
  return `${pct < 0 ? '−' : pct > 0 ? '+' : ''}${Math.abs(pct)}% vs. parecidos`;
}

const arg = name => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : null;
};

const curated = JSON.parse(await readFile(arg('file') || 'qa/mora/curated-buy.json', 'utf8'));
await mkdir('src/data/mora-fixtures', {recursive:true});
const failed = [];
for (const [id, entry] of Object.entries(curated)) {
  const home = homes.find(item => item.id === id);
  if (!home) { failed.push({id, errors:[{rule:'listing', detail:'not in catalog'}]}); continue; }
  const sheet = factSheet(home);
  const output = codeOwnedFields({
    synthesis:entry.synthesis,
    fit:fitCriteria(sheet),
    insights:[{
      dimension:'market', text:entry.market, source:'market_data', confidence:'high',
      action:{type:'ask_agency', label:entry.action.label, payload:{question:entry.action.question}},
    }],
    marketRuler:{label:LABEL[sheet.market.classification], badge:badge(sheet.market)},
    conversationPrompts:entry.prompts,
    extractedTags:[],
  }, sheet);
  const fixture = {meta:{listingId:id, generatedBy:'curated', generatedAt:new Date().toISOString().slice(0, 10), persona:'gold.userContext', language:'es-MX'}, factSheet:sheet, output};
  await writeFile(`src/data/mora-fixtures/${id}.json`, `${JSON.stringify(fixture, null, 2)}\n`);
  const report = validateFixture(fixture);
  if (!report.ok) failed.push({id, errors:report.errors});
}

const all = await Promise.all((await readdir('src/data/mora-fixtures')).filter(name => name.endsWith('.json'))
  .map(async name => JSON.parse(await readFile(`src/data/mora-fixtures/${name}`, 'utf8'))));
const set = validateSet(all.map(item => ({id:item.meta.listingId, factSheet:item.factSheet, output:item.output})));
console.log(JSON.stringify({written:Object.keys(curated).length, fixtures:all.length, failed, set:set.errors}, null, 2));
if (failed.length || !set.ok) process.exitCode = 1;
