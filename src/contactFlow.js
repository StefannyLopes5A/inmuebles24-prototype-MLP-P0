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

/** The draft is only the greeting for this listing. A question sent from the questions section follows it on its own line. */
export function contactMessage({home, question = '', language = 'es-MX'}) {
  const pt = language === 'pt-BR';
  const greeting = pt
    ? `Olá, tenho interesse em ${home.street}, ${home.area} (anúncio ${home.listingId}).`
    : `Hola, me interesa ${home.street}, ${home.area} (anuncio ${home.listingId}).`;
  return [greeting, question.trim()].filter(Boolean).join('\n').slice(0, 1400);
}

/** The WhatsApp mask of the listing contact card: +52 55 1234 5678 in Spanish, +55 11 91234-5678 in Portuguese. */
const PHONE = {es:{code:'52', groups:[2, 4, 4], join:[' ', ' ']}, pt:{code:'55', groups:[2, 5, 4], join:[' ', '-']}};
const phoneFormat = language => PHONE[language === 'pt-BR' ? 'pt' : 'es'];
export function maskPhone(value, language) {
  const {code, groups, join} = phoneFormat(language);
  const digits = String(value || '').replace(/\D/g, '');
  const rest = (digits.startsWith(code) ? digits.slice(code.length) : digits).slice(0, groups.reduce((sum, size) => sum + size, 0));
  if (!rest) return '';
  let at = 0;
  const parts = groups.map(size => { const part = rest.slice(at, at + size); at += size; return part; }).filter(Boolean);
  return `+${code} ${parts.map((part, index) => index ? `${join[index - 1]}${part}` : part).join('')}`;
}
export const phonePrefix = language => `+${phoneFormat(language).code} `;
export const phoneCodeLength = language => phoneFormat(language).code.length;


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
