// Contact is a local prototype receipt, never a broker delivery or verified identity.
export const contactIntent = type => type === 'visit' ? 'visit' : 'message';

export function contactRecipient(home, evidence = [], language = 'es-MX') {
  const match = evidence.find(item => String(item.listingId) === String(home.listingId));
  return match
    ? {name: match.advertiser, verified: true, logo: match.file}
    : {name: language === 'pt-BR' ? 'Anunciante deste imóvel · nome não confirmado' : 'Anunciante de este inmueble · nombre no confirmado', verified: false, logo: null};
}

export function normalizeContactProfile(profile = {}) {
  return {name: String(profile.name || '').trim(), email: String(profile.email || '').trim(), phone: String(profile.phone || '').trim()};
}

export function contactValidation({profile, channel, message}) {
  const data = normalizeContactProfile(profile);
  const errors = {};
  if (data.name.length < 2 || data.name.length > 80) errors.name = 'name';
  if (channel !== 'email' && channel !== 'whatsapp') errors.channel = 'channel';
  if (channel === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 120)) errors.email = 'email';
  if (channel === 'whatsapp' && (!/^\+[\d\s().-]+$/.test(data.phone) || data.phone.replace(/\D/g, '').length < 10 || data.phone.replace(/\D/g, '').length > 15)) errors.phone = 'phone';
  if (String(message || '').trim().length < 10 || String(message || '').length > 1400) errors.message = 'message';
  return errors;
}

export function contactMessage({home, search = {}, type, question = '', language = 'es-MX'}) {
  const pt = language === 'pt-BR';
  const intent = contactIntent(type);
  const action = intent === 'visit'
    ? (pt ? 'Tenho interesse em visitar' : 'Me interesa visitar')
    : (pt ? 'Tenho interesse em' : 'Me interesa');
  const price = new Intl.NumberFormat('es-MX', {maximumFractionDigits: 0}).format(search.budget || (home.mode === 'rent' ? home.rent : home.price));
  const operation = home.mode === 'rent' ? (pt ? 'alugar' : 'rentar') : (pt ? 'comprar' : 'comprar');
  const regions = (search.areas?.length ? search.areas : [search.area]).filter(area => area && area !== 'Ambas zonas');
  const location = regions.length ? regions.join(', ') : (pt ? 'Cidade do México' : 'Ciudad de México');
  const beds = search.beds || home.beds;
  const context = pt
    ? `Busco ${operation} em ${location}, até $${price} MXN, com pelo menos ${beds} ${beds === 1 ? 'quarto' : 'quartos'}.`
    : `Busco ${operation} en ${location}, hasta $${price} MXN, con al menos ${beds} ${beds === 1 ? 'recámara' : 'recámaras'}.`;
  const inquiry = question.trim() || (intent === 'visit'
    ? (pt ? 'Podem confirmar a disponibilidade e sugerir horários para uma visita?' : '¿Pueden confirmar la disponibilidad y proponer horarios para una visita?')
    : (pt ? 'Podem confirmar a disponibilidade e as condições do anúncio?' : '¿Pueden confirmar la disponibilidad y las condiciones del anuncio?'));
  const preference = search.pref === 'extra'
    ? (pt ? 'Prefiro 3 ou mais quartos para ter flexibilidade para trabalhar em casa.' : 'Prefiero 3 o más recámaras para tener flexibilidad para trabajar desde casa.')
    : search.pref === 'open'
      ? (pt ? 'Um espaço de trabalho na sala me atende; gostaria de confirmar se a distribuição permite.' : 'Me sirve un espacio de trabajo en la sala; quisiera confirmar si la distribución lo permite.')
      : '';
  const note = search.note?.trim();
  return `${pt ? 'Olá' : 'Hola'}, ${action.toLowerCase()} ${home.street}, ${home.area} (${pt ? 'anúncio' : 'anuncio'} ${home.listingId}).\n\n${context}${preference ? `\n${preference}` : ''}${note ? `\n${pt ? 'Também procuro' : 'También busco'}: ${note.slice(0, 300)}` : ''}\n\n${inquiry}`.slice(0, 1400);
}

export function createContactReceipt({home, broker, intent, channel, message, profile, id, createdAt}) {
  const errors = contactValidation({profile, channel, message});
  if (Object.keys(errors).length) throw new Error('Invalid contact draft');
  const data = normalizeContactProfile(profile);
  return {
    id: id || globalThis.crypto.randomUUID(),
    propertyId: home.id,
    broker,
    intent: contactIntent(intent),
    channel,
    message: message.trim(),
    // Only the selected return channel belongs to this simulated handoff.
    profile: channel === 'email' ? {name: data.name, email: data.email} : {name: data.name, phone: data.phone},
    createdAt: createdAt || new Date().toISOString(),
    simulated: true,
  };
}

const modalScrollLocks = new WeakMap();
// Nested native dialogs can unmount in either order when returning to results.
export function lockContactScroll(document) {
  let lock = modalScrollLocks.get(document);
  if (!lock) {
    lock = {count:0, previous:document.body.style.overflow};
    modalScrollLocks.set(document, lock);
  }
  lock.count += 1;
  document.body.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lock.count -= 1;
    if (lock.count === 0) {
      document.body.style.overflow = lock.previous;
      modalScrollLocks.delete(document);
    }
  };
}
