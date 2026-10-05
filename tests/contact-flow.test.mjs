import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contactIntent, contactMessage, contactRecipient, contactValidation, createContactReceipt, lockContactScroll} from '../src/contactFlow.js';
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
  assert.match(two,/7,500,000 MXN/);
  assert.match(two,/proponer horarios/);
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

test('draft reflects expanded regions and original MXN without inventing workspace evidence',()=>{
  const text=contactMessage({home:first,search:{...search,areas:['Narvarte Poniente','Del Valle Centro']},type:'message',language:'pt-BR'});
  assert.match(text,/Narvarte Poniente, Del Valle Centro/);
  assert.match(text,/7,500,000 MXN/);
  assert.match(text,/Trabalho|Trabajo/);
  assert.doesNotMatch(text,/escritório confirmado|planta|janela confirmada/);
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


test('assistance preference travels to each draft as a seeker preference, in both languages',()=>{
  for (const [language,extra,open] of [['pt-BR',/Prefiro 3 ou mais quartos/,/gostaria de confirmar se a distribuição permite/],['es-MX',/Prefiero 3 o más recámaras/,/quisiera confirmar si la distribución lo permite/]]) {
    for (const home of [first,second]) {
      assert.match(contactMessage({home,search:{...search,pref:'extra'},language}),extra);
      assert.match(contactMessage({home,search:{...search,pref:'open'},language}),open);
      assert.doesNotMatch(contactMessage({home,search:{...search,pref:'none'},language}),extra);
    }
  }
});
