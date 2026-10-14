// Prints the fact sheet of a listing. With --gold <id>, also lists every field that differs from that golden example.
// Usage: node scripts/mora-fact-sheet.mjs --id buy-151031662 --gold gold-polanco-cocina
import {homes} from '../src/data.js';
import {factSheet} from '../src/moraFactSheet.js';
import gold from '../src/data/mora-gold.json' with {type:'json'};

const arg = name => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : null;
};

function flatten(value, prefix = '', out = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) flatten(item, prefix ? `${prefix}.${key}` : key, out);
  } else if (Array.isArray(value) && value.some(item => item && typeof item === 'object')) {
    value.forEach((item, i) => flatten(item, `${prefix}[${i}]`, out));
  } else out[prefix] = value;
  return out;
}

const id = arg('id');
const home = homes.find(item => item.id === id);
if (!home) {
  console.error(`Listing not found: ${id}`);
  process.exit(1);
}
const sheet = factSheet(home);
console.log(JSON.stringify(sheet, null, 2));

const goldId = arg('gold');
if (goldId) {
  const example = gold.examples.find(item => item.id === goldId);
  if (!example) {
    console.error(`Golden example not found: ${goldId}`);
    process.exit(1);
  }
  const ours = flatten(sheet), theirs = flatten(example.factSheet);
  const keys = [...new Set([...Object.keys(theirs), ...Object.keys(ours)])].sort();
  console.log(`\nDiff against ${goldId} (gold → computed):`);
  for (const key of keys) {
    const a = JSON.stringify(theirs[key]), b = JSON.stringify(ours[key]);
    if (a !== b) console.log(`  ${key}: ${a ?? '—'} → ${b ?? '—'}`);
  }
}
