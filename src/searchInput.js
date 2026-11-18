const fold = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapePattern = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// In either locale, a final group of one or two digits is a decimal fraction;
// groups of three are thousands. Multipliers also allow decimal shorthand (4,5 millones).
function parseAmount(raw) {
  const fraction = raw.match(/[.,](\d{1,2})$/);
  if (!fraction) return Number(raw.replace(/[.,]/g, ''));
  const decimalPosition = raw.length - fraction[0].length;
  const whole = raw.slice(0, decimalPosition).replace(/[.,]/g, '');
  return Number(`${whole || '0'}.${fraction[1]}`);
}

// Parse only explicit constraints. Unstructured context is preserved for the guide.
export function parseSearchInput(value, search, displayCurrency, areas, mxnPerUsd=20) {
  const normalized=fold(value);
  const area=areas.filter(name=>name!=='Ambas zonas').sort((a,b)=>b.length-a.length)
    .find(name=>new RegExp(`(?:^|[^a-z0-9])${escapePattern(fold(name))}(?=$|[^a-z0-9])`).test(normalized));
  const rooms=normalized.match(/(\d+)\+?\s*(?:recamaras?|quartos?|habitaciones?)/);
  const budget=normalized.match(/(?:\$|hasta|ate|menos de)\s*([\d.,]+)\s*(milhoes|milhao|millones|millon|mil|mi)?/);
  const operation=/\b(renta|rentar|alugar|aluguel)\b/.test(normalized)?'rent':/\b(compra|comprar|venta|venda)\b/.test(normalized)?'buy':null;
  let amount=null;
  if(budget){
    amount=parseAmount(budget[1]);
    if(budget[2])amount*=budget[2]==='mil'?1_000:1_000_000;
    if(amount&&(normalized.includes('usd')||(displayCurrency==='USD'&&!normalized.includes('mxn'))))amount*=mxnPerUsd;
  }
  const structured=Boolean(area||rooms||amount||operation);
  const next={...search,...(operation?{mode:operation,...(operation!==search.mode?{budget:operation==='buy'?4500000:28000}:{})}:{}),...(area?{area,address:''}:{}),...(rooms?{beds:Number(rooms[1])}:{}),...(amount>0?{budget:amount}:{}),note:structured?search.note:value.trim(),ideaLabel:null};
  return {search:next,structured,areaExplicit:Boolean(area)};
}
