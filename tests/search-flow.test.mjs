import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretSmartInput,smartDetailTokens,matchesCriteria,updateSearchNote,criteriaFromText} from '../src/searchCriteria.js';
import {normalizeSearch,matchingHomes,prototypeResults,spreadTourListings,journeyUrl,readJourney,expansionOptions,addArea} from '../src/journey.js';
import {areas} from '../src/data.js';
import {OPERATIONS,PROPERTY_TYPES} from '../src/homeSearchModel.js';

const initial=normalizeSearch({mode:'buy',areas:['Narvarte Poniente'],budget:10500000,minBudget:5500000,beds:2});
test('the prototype keeps at least ten desktop rows for every operation and property type, even with restrictive filters',()=>{
  for(const [mode] of OPERATIONS)for(const [propertyType] of PROPERTY_TYPES) {
    const search=normalizeSearch({...initial,mode,propertyType,budget:1,beds:10,address:'Endereço inexistente',criteria:['furnished','security','text:janela redonda']});
    const before=structuredClone(search),results=prototypeResults(search);
    assert.ok(results.length>=40,`${mode}/${propertyType}`);
    assert.equal(new Set(results.map(home=>home.id)).size,results.length);
    assert.ok(results.every(home=>home.mode===(mode==='rent'?'rent':'buy')));
    assert.deepEqual(search,before,'Suggestions must not rewrite the selected filters');
  }
});
test('prototype suggestions retain exact matches first and remain eligible for detail links and refresh',()=>{
  const exact=matchingHomes(initial),results=prototypeResults(initial);
  assert.deepEqual(results.slice(0,exact.length),exact);
  const none=normalizeSearch({...initial,criteria:['furnished','security']});
  const suggestion=prototypeResults(none)[0];
  assert.equal(matchesCriteria(suggestion,none.criteria),false);
  const state={page:'results',search:none,pref:'none',propertyId:suggestion.id};
  assert.deepEqual(readJourney(journeyUrl(state)),state);
  assert.deepEqual(prototypeResults(none).map(home=>home.id),prototypeResults(none).map(home=>home.id));
  const broad=normalizeSearch({...initial,areas:[],budget:51000000,minBudget:0,beds:1});
  assert.deepEqual(prototypeResults(broad),matchingHomes(broad),'A full catalog must not be truncated to the minimum');
});
test('home details become the same filters in results, including an existing shared link',()=>{
  const note='Precisa ter portaria 24h e ser mobiliado';
  const fromHome=normalizeSearch(updateSearchNote(initial,note));
  assert.deepEqual(fromHome.criteria,['furnished','security']);
  assert.deepEqual(readJourney(journeyUrl({page:'results',search:fromHome})).search,fromHome);
  const legacy=readJourney('/?view=results&mode=buy&areas=&budget=51000000&beds=2&type=apartment&minBudget=5500000&note=Precisa+ter+portaria+24h+e+ser+mobiliado');
  assert.deepEqual(legacy.search.criteria,fromHome.criteria);
  assert.deepEqual(legacy.search.areas,[]);assert.equal(legacy.search.budget,51000000);assert.equal(legacy.search.minBudget,5500000);
  assert.ok(matchingHomes(fromHome).every(home=>matchesCriteria(home,fromHome.criteria)));
});
test('removing the last home-derived filter survives refresh without reinterpreting the retained note',()=>{
  const fromHome=normalizeSearch(updateSearchNote(initial,'Mobiliado e portaria 24h'));
  for (const criteria of [['security'],[]]) {
    const edited=normalizeSearch({...fromHome,criteria});
    const loaded=readJourney(journeyUrl({page:'results',search:edited}));
    assert.deepEqual(loaded.search.criteria,criteria);
    assert.equal(loaded.search.note,fromHome.note);
  }
});
test('home input edits replace their own filters while retaining independent criteria',()=>{
  const furnished=updateSearchNote({...initial,criteria:['balcony']},'Com mobília e portaria 24h');
  assert.deepEqual(furnished.criteria,['balcony','furnished','security']);
  const edited=updateSearchNote(furnished,'Não mobiliado');
  assert.deepEqual(edited.criteria,['balcony','unfurnished']);
  assert.deepEqual(updateSearchNote(edited,'').criteria,['balcony']);
  assert.deepEqual(criteriaFromText('Qual apartamento mobiliado tem portaria 24h?'),[]);
});
test('a question containing location, rooms or budget never mutates search criteria',()=>{
  for(const input of ['Qual bairro tem 3 quartos até 8 milhões?','¿Hay algo hasta $8,000,000 en Roma Norte?','Como escolher um apartamento?','Qual mobiliado tem portaria 24h e varanda?']) {
    const result=interpretSmartInput(input,initial,'MXN',areas,20,true);
    assert.equal(result.kind,'question');assert.deepEqual(result.search,initial);
    assert.deepEqual(smartDetailTokens(input),[]);
  }
});
test('direct changes apply together and an operation change drops the incompatible price floor',()=>{
  const result=interpretSmartInput('Quiero rentar 3 recámaras en Roma Norte hasta $40,000',initial,'MXN',areas);
  assert.equal(result.kind,'filters');
  assert.deepEqual(result.search.areas,['Roma Norte']);assert.equal(result.search.beds,3);
  assert.equal(result.search.mode,'rent');assert.equal(result.search.budget,40000);assert.equal(result.search.minBudget,0);
});
test('home office is a preference needing qualification, while an explicit balcony filters evidence',()=>{
  const result=interpretSmartInput('Quero home office e varanda gourmet',initial,'MXN',areas);
  assert.equal(result.qualify,true);assert.equal(result.search.beds,2);
  assert.deepEqual(result.search.criteria,['gourmet']);
  assert.equal(smartDetailTokens('Quero home office e varanda gourmet').length,2);
  assert.equal(matchesCriteria({title:'Departamento',features:'2 recámaras'},['gourmet']),false);
  assert.equal(matchesCriteria({title:'Apartamento com varanda gourmet',features:''},['gourmet']),true);
});
test('unknown requests are preserved and search only captured text after committing',()=>{
  assert.equal(interpretSmartInput('Quero janela redonda',initial,'MXN',areas).kind,'draft');
  const result=interpretSmartInput('Quero janela redonda',initial,'MXN',areas,20,true);
  assert.deepEqual(result.search.criteria,['text:janela redonda']);
  assert.equal(matchesCriteria({title:'Janela redonda',features:''},result.search.criteria),true);
  assert.equal(matchesCriteria({title:'Apartamento',features:'',imageAlt:'Janela redonda'},result.search.criteria),false);
});
test('negative furnishing does not become furnished, and tokens preserve original offsets',()=>{
  const result=interpretSmartInput('Quero sem mobília',{...initial,criteria:['furnished']},'MXN',areas);
  assert.deepEqual(result.search.criteria,['unfurnished']);
  const input='Quiero home office y balcón con asador';
  for(const token of smartDetailTokens(input))assert.equal(input.slice(token.start,token.end),token.text);
  assert.equal(matchesCriteria({title:'Apartamento no amueblado',features:''},['furnished']),false);
});
test('deleting a token does not turn leftover request words into a new filter',()=>{
  for(const input of ['Quero ', 'Quiero', 'Quero e ', 'con']) {
    const result=interpretSmartInput(input,initial,'MXN',areas,20,true);
    assert.equal(result.kind,'empty');assert.deepEqual(result.search,initial);
  }
  assert.deepEqual(interpretSmartInput('comercial',initial,'MXN',areas,20,true).search.criteria,['text:comercial']);
});
test('criteria survive refresh and region suggestions preserve every active constraint',()=>{
  const search=normalizeSearch({...initial,criteria:['gourmet','text:terraza'],note:'home office'});
  assert.deepEqual(readJourney(journeyUrl({page:'results',search})).search,search);
  const suggestions=expansionOptions(initial);
  assert.ok(suggestions.length);
  const option=suggestions[0],expanded=addArea(initial,option.area);
  assert.equal(matchingHomes(expanded).length,option.total);
  assert.equal(expanded.budget,initial.budget);assert.equal(expanded.minBudget,initial.minBudget);assert.equal(expanded.beds,initial.beds);
  assert.deepEqual(addArea(search,option.area).criteria,search.criteria);
});
test('tour listings lead the first two rows without sitting next to each other',()=>{
  const items=Array.from({length:16},(_,index)=>({id:`h${index}`,video:index===7||index===9||index===12?'/v.mp4':undefined}));
  const ordered=spreadTourListings(items,4);
  const videos=ordered.flatMap((home,index)=>home.video?[index]:[]);
  assert.deepEqual(videos,[0,5,14]);
  assert.equal(Math.floor(videos[0]/4),0);
  assert.equal(Math.floor(videos[1]/4),1);
  assert.ok(videos.every((index,position)=>position===0||index-videos[position-1]>=2));
  assert.deepEqual(ordered.filter(home=>!home.video).map(home=>home.id),items.filter(home=>!home.video).map(home=>home.id));
  const narrow=spreadTourListings(items,2);
  const narrowVideos=narrow.flatMap((home,index)=>home.video?[index]:[]);
  assert.equal(Math.floor(narrowVideos[0]/2),0);
  assert.equal(Math.floor(narrowVideos[1]/2),1);
  assert.ok(narrowVideos.every((index,position)=>position===0||index-narrowVideos[position-1]>=2));
  assert.deepEqual(spreadTourListings(items,1).flatMap((home,index)=>home.video?[index]:[]),[0,2,4]);
});
