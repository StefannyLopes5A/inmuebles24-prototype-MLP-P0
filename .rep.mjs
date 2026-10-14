import {homes} from './src/data.js';
import {moraAnalysis} from './src/moraAnalysis.js';
const sets={}; homes.forEach(h=>sets[h.photoSetId]=(sets[h.photoSetId]||0)+1);
console.log('photo sets', Object.keys(sets).length, 'shared', Object.values(sets).filter(n=>n>1).length);
const search={mode:'buy',areas:['Narvarte Poniente'],budget:7500000,minBudget:0,beds:2,criteria:[],note:''};
const shapes={};
for (const h of homes.filter(h=>h.mode==='buy')) { const s=moraAnalysis(h,{search}).synthesis.replace(/\$[\d,]+|\d+%?|en [A-ZÁÉÍÓÚ][^,;.:]+/g,'#'); shapes[s]=(shapes[s]||0)+1; }
console.log(Object.entries(shapes).sort((a,b)=>b[1]-a[1]).slice(0,8));
console.log(homes.map(h=>h.title).filter(t=>/roof|terraz|pent|jard|alberca|vista|amuebl|remodel|loft|balc|gimnas|seguridad|pet|mascot/i.test(t)).length, 'titles with feature words');
