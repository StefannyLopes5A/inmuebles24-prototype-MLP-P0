import {NEXT_COOKIE, SESSION_COOKIE, SESSION_SECONDS, STATE_COOKIE, accessConfigured, accessPage, checkGoogleClaims, cookie, decodeJwtPayload, readCookie, redirect, safeNextPath, signSession} from '../../lib/internalAccess.js';

export async function GET(request) {
  const url = new URL(request.url);
  const cookies = request.headers.get('cookie');
  const clearOAuth = [cookie(STATE_COOKIE, '', {maxAge: 0, path: '/api/auth'}), cookie(NEXT_COOKIE, '', {maxAge: 0, path: '/api/auth'})];
  const fail = reason => redirect(accessPage(url.origin, {erro: reason}), clearOAuth);
  if (!accessConfigured(process.env)) return fail('config');

  const state = url.searchParams.get('state');
  const expected = readCookie(cookies, STATE_COOKIE);
  const code = url.searchParams.get('code');
  if (!code || !state || !expected || state !== expected) return fail('falha');

  let tokens;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) return fail('falha');
    tokens = await response.json();
  } catch {
    return fail('falha');
  }

  const verdict = checkGoogleClaims(decodeJwtPayload(tokens.id_token), process.env.GOOGLE_CLIENT_ID);
  if (!verdict.ok) return fail(verdict.reason);

  const session = await signSession(process.env.AUTH_SECRET);
  const next = safeNextPath(readCookie(cookies, NEXT_COOKIE));
  return redirect(new URL(next, url.origin).toString(), [...clearOAuth, cookie(SESSION_COOKIE, session, {maxAge: SESSION_SECONDS})]);
}
