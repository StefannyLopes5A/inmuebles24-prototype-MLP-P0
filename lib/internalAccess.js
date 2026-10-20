/** Internal access gate: who may enter the published prototype, and the signed cookie that remembers it. */

export const ALLOWED_DOMAINS = ['quintoandar.com.br', 'quintoandar.com'];
export const SESSION_COOKIE = 'i24_access';
export const STATE_COOKIE = 'i24_oauth_state';
export const NEXT_COOKIE = 'i24_oauth_next';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const STATE_SECONDS = 10 * 60;
export const ACCESS_PAGE = '/acesso.html';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const VERSION = 'v1';

export function accessConfigured(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.AUTH_SECRET);
}

/** The whole part after the last `@` must be an allowed domain: no subdomains, no lookalike suffixes. */
export function allowedEmailDomain(email) {
  if (typeof email !== 'string') return null;
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at < 1 || at !== value.indexOf('@')) return null;
  const domain = value.slice(at + 1);
  return ALLOWED_DOMAINS.includes(domain) ? domain : null;
}

/**
 * Claims of an id_token received straight from Google's token endpoint over TLS.
 * `hd` must match the email domain so only Workspace accounts of the company pass,
 * not a personal Google account registered with a company address.
 */
export function checkGoogleClaims(claims, clientId, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!claims || typeof claims !== 'object') return {ok: false, reason: 'falha'};
  if (!GOOGLE_ISSUERS.includes(claims.iss)) return {ok: false, reason: 'falha'};
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!clientId || !audience.includes(clientId)) return {ok: false, reason: 'falha'};
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) return {ok: false, reason: 'falha'};
  if (claims.email_verified !== true && claims.email_verified !== 'true') return {ok: false, reason: 'dominio'};
  const domain = allowedEmailDomain(claims.email);
  if (!domain || typeof claims.hd !== 'string' || claims.hd.toLowerCase() !== domain) return {ok: false, reason: 'dominio'};
  return {ok: true};
}

export function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {return JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1])));} catch {return null;}
}

/** Only same-site paths survive the round trip through Google. */
export function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value.startsWith(ACCESS_PAGE) || value.startsWith('/api/auth/')) return '/';
  return value.slice(0, 2000);
}

/** The cookie holds only a version, an expiry and an HMAC; never the email. */
export async function signSession(secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const body = `${VERSION}.${nowSeconds + SESSION_SECONDS}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION || !/^\d+$/.test(parts[1])) return false;
  if (Number(parts[1]) <= nowSeconds) return false;
  let signature;
  try {signature = fromBase64Url(parts[2]);} catch {return false;}
  return crypto.subtle.verify('HMAC', await hmacKey(secret), signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
}

export function randomToken(bytes = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      try {return decodeURIComponent(part.slice(index + 1).trim());} catch {return null;}
    }
  }
  return null;
}

export function cookie(name, value, {maxAge, path = '/'} = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, 'HttpOnly', 'Secure', 'SameSite=Lax'];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

export function redirect(location, cookies = []) {
  const headers = new Headers({Location: location, 'Cache-Control': 'no-store'});
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, {status: 302, headers});
}

export function accessPage(origin, params = {}) {
  const url = new URL(ACCESS_PAGE, origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign', 'verify']);
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
