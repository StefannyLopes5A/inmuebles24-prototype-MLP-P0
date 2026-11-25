import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contactIntent, contactMessage, maskPhone, phonePrefix, contactRecipient, contactValidation, createContactReceipt, lockContactScroll} from '../src/contactFlow.js';
const inventory=JSON.parse(readFileSync(new URL('../src/real-listings.json',import.meta.url)));
const evidence=JSON.parse(readFileSync(new URL('../AGENCY-SOURCES.json',import.meta.url))).logos;
const first=inventory.find(home=>home.id==='buy-148816386');
const second=inventory.find(home=>home.id==='buy-150108941');
const search={mode:'buy',area:'Narvarte Poniente',budget:7500000,beds:2,note:'Trabajo en casa'};
const identity={name:'Ana García',email:'ana@example.com',phone:'+52 55 1234 5678'};

test('verified recipient uses the actual listing association, never a decorative logo or invented broker',()=>{
  assert.equal(contactRecipient(first,evidence).name,'Remax Interr');
  assert.equal(contactRecipient(second,evidence).name,'RAM HOUSE Agencia Inmobiliaria');
  const unknown={...first,listingId:'not-verified',broker:'Remax Interr',brokerLogo:first.brokerLogo};
  assert.equal(contactRecipient(unknown,evidence).verified,false);
  assert.equal(contactRecipient(unknown,evidence).logo,null);
  assert.match(contactRecipient(unknown,evidence,'pt-BR').name,/não confirmado/);
});

test('independently prepared second contact gets the second property, shared criteria and fresh question',()=>{
  const one=contactMessage({home:first,search,type:'question',question:'¿Tiene ventana?',language:'es-MX'});
  const two=contactMessage({home:second,search,type:'visit',language:'es-MX'});
  assert.match(one,/148816386/);
  assert.match(one,/¿Tiene ventana\?/);
  assert.match(two,/150108941/);
  assert.doesNotMatch(two,/148816386|¿Tiene ventana\?/);
  assert.doesNotMatch(two,/7,500,000|proponer horarios|Busco comprar/);
  assert.doesNotMatch(two,/agendada|confirmada|cita reservada/);
});

test('email and WhatsApp validate only the necessary chosen return channel',()=>{
  const message='Me interesa este departamento.';
  assert.deepEqual(contactValidation({profile:{name:'Ana',email:'ana@example.com'},channel:'email',message}),{});
  assert.deepEqual(contactValidation({profile:{name:'Ana',phone:'+52 55 1234 5678'},channel:'whatsapp',message}),{});
  assert.equal(contactValidation({profile:{name:'Ana',phone:'5512345678'},channel:'whatsapp',message}).phone,'phone');
  assert.equal(contactValidation({profile:{name:' ',email:'bad'},channel:'email',message:'hola'}).name,'name');
  assert.equal(contactValidation({profile:identity,channel:'other',message}).channel,'channel');
  assert.equal(contactValidation({profile:{name:'Ana',email:'ana@host'},channel:'email',message}).email,'email');
});

test('receipt binds one property and snapshots only the selected channel, without mutating reusable identity',()=>{
  const profile={...identity};
  const receipt=createContactReceipt({home:first,broker:'Remax Interr',intent:'visit',channel:'email',message:' Me interesa visitar el departamento. ',profile,id:'attempt-1',createdAt:'2026-09-29T12:00:00Z'});
  assert.deepEqual(receipt.profile,{name:'Ana García',email:'ana@example.com'});
  profile.name='Changed';
  assert.equal(receipt.profile.name,'Ana García');
  assert.equal(receipt.propertyId,first.id);
  assert.equal(receipt.simulated,true);
  assert.equal(receipt.intent,'visit');
  assert.equal(receipt.message,'Me interesa visitar el departamento.');
  assert.equal(contactIntent('question'),'message');
  assert.throws(()=>createContactReceipt({home:first,broker:'Remax',intent:'message',channel:'email',message:'short',profile}),/Invalid/);
});

test('the Portuguese draft is only the greeting for the listing',()=>{
  const text=contactMessage({home:first,search:{...search,areas:['Narvarte Poniente','Del Valle Centro']},language:'pt-BR'});
  assert.match(text,/^Olá, tenho interesse em .+ \(anúncio \d+\)\.$/);
  assert.doesNotMatch(text,/Narvarte Poniente, Del Valle Centro|7,500,000|Busco|Trabalho/);
});


test('nested detail and contact restore scroll regardless of unmount order',()=>{
  for(const reverse of [false,true]){
    const document={body:{style:{overflow:'auto'}}};
    const releaseDetail=lockContactScroll(document);
    const releaseContact=lockContactScroll(document);
    assert.equal(document.body.style.overflow,'hidden');
    const releases=reverse?[releaseContact,releaseDetail]:[releaseDetail,releaseContact];
    releases[0]();
    assert.equal(document.body.style.overflow,'hidden');
    releases[1]();
    assert.equal(document.body.style.overflow,'auto');
    releases[0]();
    assert.equal(document.body.style.overflow,'auto');
  }
});


test('the search preference and note no longer enter the draft',()=>{
  for (const language of ['pt-BR','es-MX']) for (const home of [first,second]) {
    const text=contactMessage({home,search:{...search,pref:'extra'},language});
    assert.doesNotMatch(text,/Prefiro|Prefiero|Trabalho|Trabajo/);
    assert.equal(text.split('\n').length,1);
  }
});

test('the default message is only the greeting; a question from the questions section follows on its own line',()=>{
  const plain=contactMessage({home:first,search:{mode:'buy'},language:'es-MX'});
  assert.match(plain,/^Hola, me interesa .+ \(anuncio 148816386\)\.$/);
  const asked=contactMessage({home:first,search:{...search,pref:'extra'},question:'¿Tiene ventana?',language:'es-MX'}).split('\n');
  assert.equal(asked.length,2);
  assert.doesNotMatch(asked[0],/Prefiero|busco|Trabajo/);
  assert.equal(asked[1],'¿Tiene ventana?');
});

test('the WhatsApp mask follows the language and its prefix rules',()=>{
  assert.equal(maskPhone('5512345678','es-MX'),'+52 55 1234 5678');
  assert.equal(maskPhone('+52 55 1234 5678','es-MX'),'+52 55 1234 5678');
  assert.equal(maskPhone('11912345678','pt-BR'),'+55 11 91234-5678');
  assert.equal(maskPhone('+55 11 91234-5678','pt-BR'),'+55 11 91234-5678');
  assert.equal(maskPhone('+52 5','es-MX'),'+52 5');
  assert.equal(maskPhone('+52 ','es-MX'),'');
  assert.equal(maskPhone('','pt-BR'),'');
  assert.equal(phonePrefix('es-MX'),'+52 ');
  assert.equal(phonePrefix('pt-BR'),'+55 ');
  assert.deepEqual(contactValidation({profile:{name:'Ana',phone:maskPhone('5512345678','es-MX')},channel:'whatsapp',message:'Me interesa este departamento.'}),{});
  assert.deepEqual(contactValidation({profile:{name:'Ana',phone:maskPhone('11912345678','pt-BR')},channel:'whatsapp',message:'Me interesa este departamento.'}),{});
});
