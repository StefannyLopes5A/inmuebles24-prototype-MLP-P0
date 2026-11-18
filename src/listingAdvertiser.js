// Prototype identity: names, handles and Google ratings may be invented, but stay stable per advertiser.
const GENERIC = /^anunciante (en|no) inmuebles24$/i;
const DEMO_NAMES = [
  'Casa Nativa Inmobiliaria', 'Altura Bienes Raíces', 'Punto Norte Inmuebles', 'Habitat Roma',
  'Ciudad Viva Propiedades', 'Lumen Inmobiliaria', 'Terra Urbana', 'Vértice Bienes Raíces',
  'Nido Propiedades', 'Barrio Alto Real Estate', 'Patio Central Inmuebles', 'Umbral Desarrollos',
];
// Stand-in avatars for invented names only. They are not verified catalog logos.
const DEMO_LOGOS = {
  'Casa Nativa Inmobiliaria': '/assets/agencies/casa-nativa-inmobiliaria.jpg',
  'Altura Bienes Raíces': '/assets/agencies/altura-bienes-raices.png',
  'Punto Norte Inmuebles': '/assets/agencies/punto-norte-inmuebles.jpg',
  'Habitat Roma': '/assets/agencies/habitat-roma.png',
  'Ciudad Viva Propiedades': '/assets/agencies/ciudad-viva-propiedades.png',
  'Lumen Inmobiliaria': '/assets/agencies/lumen-inmobiliaria.png',
  'Terra Urbana': '/assets/agencies/terra-urbana.webp',
  'Vértice Bienes Raíces': '/assets/agencies/vertice-bienes-raices.jpg',
  'Nido Propiedades': '/assets/agencies/nido-propiedades.jpg',
  'Barrio Alto Real Estate': '/assets/agencies/barrio-alto-real-estate.png',
  'Patio Central Inmuebles': '/assets/agencies/patio-central-inmuebles.jpg',
  'Umbral Desarrollos': '/assets/agencies/umbral-desarrollos.png',
};

export function seed(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.codePointAt(0), 16777619);
  return value >>> 0;
}

export const advertiserHandle = name => `@${String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) || 'anunciante'}`;

export const advertiserInitials = name => String(name).split(/\s+/).filter(word => /^[\p{L}\d]/u.test(word)).slice(0, 2).map(word => word[0].toUpperCase()).join('');

export function advertiserFor(home, evidence = []) {
  const match = evidence.find(item => String(item.listingId) === String(home.listingId));
  const published = home.broker && !GENERIC.test(home.broker.trim()) ? home.broker.trim() : null;
  const name = match?.advertiser || published || DEMO_NAMES[seed(home.id) % DEMO_NAMES.length];
  const logo = match?.file || (published && home.brokerLogo) || DEMO_LOGOS[name] || null;
  const n = seed(name.toLowerCase());
  return {
    name,
    handle: advertiserHandle(name),
    initials: advertiserInitials(name),
    logo,
    service: /desarrol|developer|desarrollos/i.test(name) ? 'developer' : 'agency',
    rating: Number((4.4 + (n % 6) / 10).toFixed(1)),
    reviews: 40 + (n % 340),
    verified: n % 7 !== 0,
    // Advertisers on Domi answer WhatsApp within minutes; the rest report a typical reply time.
    domi: (n >>> 3) % 10 !== 0,
    replyHours: 1 + ((n >>> 5) % 5),
  };
}

const REVIEWERS = [
  ['Mariana G.', '#0f766e'], ['Luis R.', '#c2410c'], ['Sofía M.', '#6d28d9'], ['Andrés T.', '#be185d'],
  ['Paola V.', '#1d4ed8'], ['Jorge H.', '#b45309'], ['Daniela C.', '#047857'], ['Ricardo L.', '#7c3aed'],
  ['Camila S.', '#be123c'], ['Hugo P.', '#0e7490'], ['Elena V.', '#9a3412'], ['Mateo A.', '#4338ca'],
];
const REVIEW_AGES = [['há 2 semanas', 'hace 2 semanas'], ['há 1 mês', 'hace 1 mes'], ['há 3 semanas', 'hace 3 semanas'], ['há 2 meses', 'hace 2 meses'], ['há 4 meses', 'hace 4 meses']];
const CLOSED = {
  buy:['Comprei com eles e deu tudo certo. Me acompanharam da visita até o cartório.', 'Compré con ellos y todo salió bien. Me acompañaron de la visita al notario.'],
  rent:['Aluguei com eles e deu tudo certo. Explicaram os requisitos e a firma foi rápida.', 'Renté con ellos y salió bien. Me explicaron los requisitos y firmé rápido.'],
};
const PRAISE = [
  ['Atendimento ótimo. Tiraram minhas dúvidas no mesmo dia pelo WhatsApp.', 'Atención excelente. Resolvieron mis dudas el mismo día por WhatsApp.'],
  ['Muito profissionais e transparentes. Não me pressionaram e respeitaram meu orçamento.', 'Muy profesionales y transparentes. No me presionaron y respetaron mi presupuesto.'],
  ['O corretor foi pontual em todas as visitas e conhecia muito bem a colônia.', 'El asesor fue puntual en todas las visitas y conocía muy bien la colonia.'],
  ['Processo claro do início ao fim, sem surpresas nos custos. Eu voltaria a escolhê-los.', 'Todo el proceso fue claro, sin sorpresas en los gastos. Volvería a elegirlos.'],
];
// What each PRAISE review is about, short enough for a clause in Mora's sentence.
const PRAISE_TOPICS = [
  ['tiram as dúvidas no mesmo dia', 'resuelven dudas el mismo día'],
  ['não pressionam', 'no presionan'],
  ['conhecem bem o bairro', 'conocen bien la colonia'],
  ['não há surpresas nos custos', 'no hay sorpresas en los gastos'],
];
const MORE_PRAISE = [
  ['Responderam rápido e mandaram vídeos do imóvel antes da visita.', 'Respondieron rápido y me mandaron videos del inmueble antes de la visita.'],
  ['Tive um problema com a papelada e resolveram em dois dias. Muito atentos.', 'Tuve un problema con el papeleo y lo resolvieron en dos días. Muy atentos.'],
  ['Demoraram um pouco para confirmar a visita, mas depois tudo foi tranquilo.', 'Tardaron un poco en confirmar la visita, pero después todo fue tranquilo.'],
  ['Mostraram a colônia com calma e disseram o que valia a pena perguntar.', 'Me mostraron la colonia con calma y me dijeron qué valía la pena preguntar.'],
  ['Acompanharam cada mensagem e nada ficou sem resposta durante a busca.', 'Siguieron cada mensaje y nada quedó sin respuesta durante toda la búsqueda.'],
  ['Foram honestos sobre o que o anúncio não dizia. Isso me deu confiança.', 'Fueron honestos sobre lo que el anuncio no decía. Eso me dio confianza.'],
  ['Marcaram as visitas no horário combinado e me explicaram cada ambiente.', 'Agendaron las visitas a la hora acordada y me explicaron cada ambiente.'],
];

/** What the first service review shown in the panel praises, as `[br, es]`. */
export function advertiserHighlight(advertiser) {
  return PRAISE_TOPICS[seed(`${advertiser.name.toLowerCase()}:reviews`) % PRAISE.length];
}

/** Invented Google reviews, stable per advertiser: one closed deal for the listing's operation, then service. The panel shows three; the listing page shows six and reveals six more. */
export function advertiserReviews(advertiser, mode, count = 3) {
  const n = seed(`${advertiser.name.toLowerCase()}:reviews`);
  const service = [...PRAISE, ...MORE_PRAISE];
  const turn = n % service.length;
  const rest = [...service.slice(turn), ...service.slice(0, turn)];
  return [CLOSED[mode === 'rent' ? 'rent' : 'buy'], ...rest].slice(0, count).map((text, i) => {
    const [name, color] = REVIEWERS[(n + i) % REVIEWERS.length];
    return {
      name,
      color,
      age: REVIEW_AGES[((n >>> 2) + i) % REVIEW_AGES.length],
      stars: i % 5 === 2 ? 4 : 5,
      text,
    };
  });
}
