export const PROPERTY_TYPES = [
  ['apartment', 'Apartamento', 'Departamento'], ['house', 'Casa', 'Casa'],
  ['condominium', 'Casa em condomínio', 'Casa en condominio'], ['office', 'Escritório', 'Oficina'],
  ['commercial', 'Ponto comercial', 'Local comercial'], ['warehouse', 'Depósito comercial', 'Bodega comercial'],
  ['land', 'Terreno / Lote', 'Terreno / Lote'], ['industrial', 'Galpão industrial', 'Nave industrial'],
  ['any', 'Todos', 'Todos'],
];
export const OPERATIONS = [['rent', 'Alugar', 'Rentar'], ['buy', 'Comprar', 'Comprar'], ['development', 'Desenvolvimentos', 'Desarrollos'], ['auction', 'Liquidação', 'Remate']];
export const canStartSearch = choices => choices.mode === true && choices.propertyType === true;
export const foldSearchText = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function parseBudgetAmount(text, factor = 1) {
  const value = text.trim().replace(/^(?:MXN|USD)?\s*\$?\s*/i, '').replace(/\s*(?:MXN|USD)$/i, '');
  if (!value) return 0;
  const normalized = /^\d{1,3}(?:,\d{3})+$/.test(value) ? value.replaceAll(',', '')
    : /^\d{1,3}(?:\.\d{3})+$/.test(value) ? value.replaceAll('.', '')
      : /^\d+(?:[.,]\d{1,2})?$/.test(value) ? value.replace(',', '.') : '';
  return normalized ? Math.round(Number(normalized) * factor) : NaN;
}

/** Recognize only the two explicitly supported concepts. Preserve all other wording. */
export function detailTokens(text) {
  const pattern = /(?<![\p{L}\p{N}])(?:sem\s+mob[ií]lia|sin\s+muebles|n[aã]o\s+mobiliad[oa]|com\s+mob[ií]lia|mobiliad[oa]|amueblad[oa]|portaria\s+24\s*(?:horas|h)|porter[ií]a\s+24\s*(?:horas|h))(?![\p{L}\p{N}])/giu;
  return [...text.matchAll(pattern)].map(match => ({
    start:match.index, end:match.index + match[0].length, text:match[0],
    kind:/^(portaria|porter)/i.test(match[0]) ? 'security' : 'furnishing',
    value:/^(sem|sin|n[aã]o)/i.test(match[0]) ? 'unfurnished' : 'furnished',
  }));
}

export function priceDistribution(listings, mode, count = 30) {
  const prices = listings.filter(home => home.mode === mode).map(home => mode === 'rent' ? home.rent : home.price).filter(Number.isFinite);
  const step = mode === 'rent' ? 5000 : 500000;
  const ceiling = Math.max(step * count, Math.ceil(Math.max(0, ...prices) / (step * count)) * step * count);
  const width = ceiling / count;
  const bins = Array.from({length:count}, (_, index) => ({min:index * width, max:(index + 1) * width, count:0}));
  prices.forEach(price => bins[Math.min(count - 1, Math.floor(price / width))].count++);
  return {bins, ceiling, step};
}
