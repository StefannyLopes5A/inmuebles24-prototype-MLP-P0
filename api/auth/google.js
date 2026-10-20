import {NEXT_COOKIE, STATE_COOKIE, STATE_SECONDS, accessConfigured, accessPage, cookie, randomToken, redirect, safeNextPath} from '../../lib/internalAccess.js';

export function GET(request) {
  const url = new URL(request.url);
  if (!accessConfigured(process.env)) return redirect(accessPage(url.origin, {erro: 'config'}));
  const state = randomToken();
  const google = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  google.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email',
    state,
    hd: 'quintoandar.com.br',
    prompt: 'select_account',
  }).toString();
  return redirect(google.toString(), [
    cookie(STATE_COOKIE, state, {maxAge: STATE_SECONDS, path: '/api/auth'}),
    cookie(NEXT_COOKIE, safeNextPath(url.searchParams.get('next')), {maxAge: STATE_SECONDS, path: '/api/auth'}),
  ]);
}
