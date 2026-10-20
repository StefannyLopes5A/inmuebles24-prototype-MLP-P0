/**
 * Market questions Mora answers herself, with illustrative CDMX ranges: notary, guarantee and credit.
 * The same answer serves the listing chat (on the listing's price) and the search bar (on the budget).
 * None of it changes filters, and whether a listing accepts something is still for the agency to confirm.
 */
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const trim = value => String(Number(value.toFixed(1)));
const short = amount => amount >= 1e6 ? `$${trim(amount / 1e6)}M` : amount >= 1e3 ? `$${Math.round(amount / 1e3)}k` : `$${Math.round(amount)}`;
const range = (amount, low, high) => `${short(amount * low)}–${short(amount * high)} MXN`;

export const MARKET_TOPICS = ['notary', 'guarantee', 'credit'];

/** "Crédito Constructor" is a colonia, not a question about credit. */
export function marketTopic(text = '') {
  const folded = fold(text).replace(/credito constructor/g, '');
  if (/notari|escritur|cartorio|gastos? (?:de )?(?:cierre|compra)|ademas del precio|alem do preco/.test(folded)) return 'notary';
  if (/garantia|\baval\b|fiador|fianza|poliza juridica|seguro fianca|caucao/.test(folded)) return 'guarantee';
  if (/credito|hipotec|infonavit|fovissste|financ|enganche/.test(folded)) return 'credit';
  return null;
}

/** The suggestion chips that ask each topic, in the listing chat and the bar. */
export function marketQuestion(topic, language = 'es-MX') {
  const pt = language === 'pt-BR';
  return {
    notary:pt ? 'Quanto cobra o cartório?' : '¿Cuánto cobra el notario?',
    guarantee:pt ? 'Que garantia pedem?' : '¿Qué garantía piden?',
    credit:pt ? 'Posso comprar com financiamento?' : '¿Puedo comprar con crédito?',
  }[topic] || null;
}

/**
 * `{headline, detail, note, ask}`. `ask` means the answer depends on this listing, so the chat offers to send the
 * question to the agency. `price` is the listing's price or the search budget; `mode` is buy or rent.
 */
export function marketAnswer(topic, {mode = 'buy', price, language = 'es-MX', listing = false} = {}) {
  if (!MARKET_TOPICS.includes(topic)) return null;
  const pt = language === 'pt-BR', say = (br, es) => pt ? br : es;
  const amount = Number(price) > 0 ? Number(price) : null;
  const rent = mode === 'rent';
  const note = listing ? say('Referência ilustrativa', 'Referencia ilustrativa') : say('Referência ilustrativa · não muda seus filtros', 'Referencia ilustrativa · no cambia tus filtros');
  const basis = listing ? say('Neste preço', 'En este precio') : say('No seu orçamento', 'En tu presupuesto');
  if (topic === 'notary') return rent ? {
    headline:say('Para alugar, não há escritura em cartório.', 'Al rentar no se escritura ante notario.'),
    detail:say('O contrato se assina com a imobiliária ou o proprietário. Se um dia você comprar na CDMX, a escritura costuma ficar entre 4% e 7% do valor.', 'El contrato se firma con la inmobiliaria o el propietario. Si algún día compras en CDMX, escriturar suele costar entre 4% y 7% del valor.'),
    note, ask:false,
  } : {
    headline:say('Na CDMX, escriturar costuma custar entre 4% e 7% do valor.', 'En CDMX, escriturar suele costar entre 4% y 7% del valor.'),
    detail:amount
      ? say(`${basis} de ${short(amount)}, são uns ${range(amount, 0.04, 0.07)} entre cartório, imposto de aquisição e registro. O tabelião fecha o número.`, `${basis} de ${short(amount)}, son más o menos ${range(amount, 0.04, 0.07)} entre notario, impuesto de adquisición y registro. El notario cierra el número.`)
      : say('Somam cartório, imposto de aquisição e registro. O tabelião fecha o número.', 'Suman notario, impuesto de adquisición y registro. El notario cierra el número.'),
    note, ask:false,
  };
  if (topic === 'guarantee') return rent ? {
    headline:say('Na CDMX costumam pedir um fiador ou uma apólice jurídica, mais um mês de depósito.', 'En CDMX suelen pedir un aval o una póliza jurídica, más un mes de depósito.'),
    detail:amount
      ? say(`A apólice costuma custar de 35% a 50% de um aluguel por ano: com ${short(amount)} de aluguel, uns ${range(amount, 0.35, 0.5)}. Qual aceitam, a imobiliária define.`, `La póliza suele costar de 35% a 50% de una renta al año: con ${short(amount)} de renta, unos ${range(amount, 0.35, 0.5)}. Cuál aceptan lo define la inmobiliaria.`)
      : say('Qual aceitam, a imobiliária define.', 'Cuál aceptan lo define la inmobiliaria.'),
    note, ask:listing,
  } : {
    headline:say('Para comprar, não se pede fiador.', 'Al comprar no se pide aval.'),
    detail:say('Com financiamento, a garantia é o próprio imóvel, em hipoteca. À vista, se assina no cartório e não há garantia extra.', 'Con crédito, la garantía es el mismo inmueble, en hipoteca. De contado, se firma ante notario y no hay garantía extra.'),
    note, ask:false,
  };
  return rent ? {
    headline:say('Para alugar não se usa crédito hipotecário.', 'Para rentar no se usa crédito hipotecario.'),
    detail:amount
      ? say(`O que costumam pedir é comprovar renda de umas três vezes o aluguel: com ${short(amount)}, uns ${short(amount * 3)} MXN por mês.`, `Lo que suelen pedir es comprobar ingresos de unas tres veces la renta: con ${short(amount)}, unos ${short(amount * 3)} MXN al mes.`)
      : say('O que costumam pedir é comprovar renda de umas três vezes o aluguel.', 'Lo que suelen pedir es comprobar ingresos de unas tres veces la renta.'),
    note, ask:false,
  } : {
    headline:say('Sim, na CDMX se compra com financiamento bancário, Infonavit ou Fovissste.', 'Sí, en CDMX se compra con crédito bancario, Infonavit o Fovissste.'),
    detail:amount
      ? say(`A entrada costuma ir de 10% a 20%: ${basis.toLowerCase()} de ${short(amount)}, entre ${range(amount, 0.1, 0.2)}, mais a escritura.`, `El enganche suele ir de 10% a 20%: ${basis.toLowerCase()} de ${short(amount)}, entre ${range(amount, 0.1, 0.2)}, más la escrituración.`)
      : say('A entrada costuma ir de 10% a 20%, mais a escritura.', 'El enganche suele ir de 10% a 20%, más la escrituración.'),
    note, ask:listing,
  };
}
