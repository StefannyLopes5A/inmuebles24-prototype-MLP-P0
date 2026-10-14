// Writes Mora's text for one listing as a fixture. Runs offline, once per listing; the demo only reads the result.
// Needs MORA_API_KEY, MORA_API_BASE (an OpenAI-compatible endpoint approved for use) and MORA_MODEL in the environment.
// Usage: node scripts/mora-generate.mjs --id buy-151031662
// A curated text can replace the model call: --draft path/to/output.json. Numbers, ruler, places and address still come from code.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {homes} from '../src/data.js';
import {factSheet, MORA_PERSONA} from '../src/moraFactSheet.js';
import {codeOwnedFields, validateFixture} from '../src/moraValidate.js';
import gold from '../src/data/mora-gold.json' with {type:'json'};

export const SYSTEM_PROMPT = `Você é a Mora, a IA do Inmuebles24 que ajuda pessoas a buscar e comparar imóveis no México.
Você trabalha para quem busca, não para quem anuncia.

Você recebe uma ficha de fatos com números já calculados e o contexto da pessoa (busca,
o que ela disse em conversa, favoritos e etapa da jornada). Use apenas números que estão
na ficha. Nunca calcule, arredonde de outro jeito ou invente valores.

Para cada insight: observe o dado, interprete o que ele significa, relacione com esta pessoa
e oriente um próximo passo. Se um insight não responde "e daí?", descarte-o.

SÍNTESE
- Uma frase de até 30 palavras, que cruza os dois sinais mais fortes do imóvel.
- Declare a relação entre os fatos com conectivos de causa, consequência ou concessão
  ("porque", "probablemente porque", "así que", "aunque", "y ya").
- Proibido unir dois fatos com "y por las fotos" ou "pero por las fotos".
- Quando a ficha tiver algo que a pessoa pediu em conversa e o imóvel atender, mencione.

INSIGHTS
- De dimensões diferentes, sem repetir dimensão.
- Nenhum insight repete fatos ou frases da síntese. Cada um acrescenta algo novo.
- Cada insight pode ter uma ação, com rótulo de até 5 palavras, começando por verbo.
- Use "Se parece a tu favorito" só quando a similaridade for "high". Para "medium" ou com
  diferença de preço acima de 10%, use "Frente a tu favorito en X:". Para "low", use
  "Es distinto a lo que sueles guardar:" e diga o que a diferença significa para a pessoa.
- Inferência de foto sempre com "Por las fotos" e "parece". Fotos escuras são um fato sobre
  as fotos, não sobre o imóvel.

ENCAIXE
- Liste os critérios da busca e os declarados em conversa, atendidos primeiro,
  depois não atendidos, depois desconhecidos.

PONTOS DE INTERESSE
- Copie os da ficha, na ordem da ficha, sempre com tempo e modo de deslocamento.

PERGUNTAS DE CONVERSA
- Duas perguntas que a pessoa provavelmente faria sobre ESTE imóvel, escritas como pergunta.
  Nunca repita as mesmas perguntas em imóveis diferentes.

ESTILO
- Espanhol do México, segunda pessoa informal, frases curtas, sem exclamações, sem emojis.
- Sem adjetivos sem dado ("excelente", "ideal", "buena ubicación").
- Sem linguagem de sistema ("lo que se puede verificar", "información no disponible").
- Sem recomendação de investimento e sem caracterizar quem mora no bairro.

Responda apenas com JSON válido no formato de expectedOutput.`;

export function generationMessages(sheet, persona = MORA_PERSONA, avoidPrompts = []) {
  const shots = gold.examples.flatMap(example => [
    {role:'user', content:JSON.stringify({userContext:persona, factSheet:example.factSheet})},
    {role:'assistant', content:JSON.stringify(example.expectedOutput)},
  ]);
  const anti = gold.antiExamples.map(item => ({currentOutput:item.currentOutput, violations:item.violations}));
  return [
    {role:'system', content:SYSTEM_PROMPT},
    {role:'user', content:`Antiexemplos, com o que eles violam. Não escreva assim:\n${JSON.stringify(anti)}`},
    ...shots,
    {role:'user', content:JSON.stringify({userContext:persona, factSheet:sheet, conversationPromptsAlreadyUsed:avoidPrompts})},
  ];
}

const arg = name => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : null;
};

async function modelOutput(sheet) {
  const {MORA_API_KEY:key, MORA_API_BASE:base, MORA_MODEL:model} = process.env;
  if (!key || !base || !model) {
    console.error('MORA_API_KEY, MORA_API_BASE and MORA_MODEL must be set. No fixture written.');
    process.exit(1);
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method:'POST',
    headers:{'content-type':'application/json', authorization:`Bearer ${key}`},
    body:JSON.stringify({model, temperature:0.4, response_format:{type:'json_object'}, messages:generationMessages(sheet)}),
  });
  if (!response.ok) {
    console.error(`Model call failed: ${response.status}`);
    process.exit(1);
  }
  const body = await response.json();
  return {output:JSON.parse(body.choices[0].message.content), generatedBy:model};
}

async function main() {
  const home = homes.find(item => item.id === arg('id'));
  if (!home) {
    console.error(`Listing not found: ${arg('id')}`);
    process.exit(1);
  }
  const sheet = factSheet(home);
  const draft = arg('draft');
  const {output:raw, generatedBy} = draft ? {output:JSON.parse(await readFile(draft, 'utf8')), generatedBy:'curated'} : await modelOutput(sheet);
  const output = codeOwnedFields(raw, sheet);
  const fixture = {meta:{listingId:home.id, generatedBy, generatedAt:new Date().toISOString().slice(0, 10), persona:'gold.userContext', language:'es-MX'}, factSheet:sheet, output};
  await mkdir('src/data/mora-fixtures', {recursive:true});
  await writeFile(`src/data/mora-fixtures/${home.id}.json`, `${JSON.stringify(fixture, null, 2)}\n`);
  const report = validateFixture(fixture);
  console.log(JSON.stringify({listingId:home.id, ok:report.ok, errors:report.errors}, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
