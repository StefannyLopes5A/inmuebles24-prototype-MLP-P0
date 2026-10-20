import assert from 'node:assert/strict';
import test from 'node:test';
import {SESSION_COOKIE, SESSION_SECONDS, allowedEmailDomain, checkGoogleClaims, decodeJwtPayload, readCookie, safeNextPath, signSession, verifySession} from '../lib/internalAccess.js';
import middleware from '../middleware.js';
import {GET as callback} from '../api/auth/callback.js';

const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = 1_800_000_000;
const claims = overrides => ({iss: 'https://accounts.google.com', aud: CLIENT, exp: NOW + 600, email: 'pessoa.teste@quintoandar.com.br', email_verified: true, hd: 'quintoandar.com.br', ...overrides});

test('only the exact company domains pass, never a subdomain or a lookalike', () => {
  assert.equal(allowedEmailDomain('pessoa.teste@quintoandar.com.br'), 'quintoandar.com.br');
  assert.equal(allowedEmailDomain('  Pessoa.Teste@QuintoAndar.com  '), 'quintoandar.com');
  for (const email of ['pessoa@gmail.com', 'pessoa@quintoandar.com.br.evil.com', 'pessoa@evilquintoandar.com', 'pessoa@mail.quintoandar.com.br', 'quintoandar.com.br', 'a@b@quintoandar.com.br', '@quintoandar.com', null, 42]) {
    assert.equal(allowedEmailDomain(email), null, String(email));
  }
});

test('Google claims need issuer, audience, expiry, a verified email and the Workspace domain', () => {
  assert.deepEqual(checkGoogleClaims(claims(), CLIENT, NOW), {ok: true});
  assert.deepEqual(checkGoogleClaims(claims({email: 'pessoa.teste@quintoandar.com', hd: 'quintoandar.com'}), CLIENT, NOW), {ok: true});
  assert.equal(checkGoogleClaims(claims({iss: 'https://evil.test'}), CLIENT, NOW).reason, 'falha');
  assert.equal(checkGoogleClaims(claims({aud: 'other-client'}), CLIENT, NOW).reason, 'falha');
  assert.equal(checkGoogleClaims(claims({exp: NOW}), CLIENT, NOW).reason, 'falha');
  assert.equal(checkGoogleClaims(claims({email: 'pessoa@gmail.com', hd: undefined}), CLIENT, NOW).reason, 'dominio');
  assert.equal(checkGoogleClaims(claims({email_verified: false}), CLIENT, NOW).reason, 'dominio');
  assert.equal(checkGoogleClaims(claims({hd: undefined}), CLIENT, NOW).reason, 'dominio', 'a personal Google account with a company address');
  assert.equal(checkGoogleClaims(claims({hd: 'quintoandar.com'}), CLIENT, NOW).reason, 'dominio');
  assert.equal(checkGoogleClaims(null, CLIENT, NOW).reason, 'falha');
});

test('the id_token payload is read from the middle segment', () => {
  const payload = Buffer.from(JSON.stringify(claims())).toString('base64url');
  assert.equal(decodeJwtPayload(`header.${payload}.signature`).email, 'pessoa.teste@quintoandar.com.br');
  assert.equal(decodeJwtPayload('not-a-jwt'), null);
  assert.equal(decodeJwtPayload('a.%%%.c'), null);
});

test('the session cookie is signed, expires and carries no email', async () => {
  const token = await signSession('secret-a', NOW);
  assert.ok(!token.includes('@'));
  assert.equal(await verifySession(token, 'secret-a', NOW + 1), true);
  assert.equal(await verifySession(token, 'secret-b', NOW + 1), false);
  assert.equal(await verifySession(token, 'secret-a', NOW + SESSION_SECONDS), false);
  const [version, expiry, signature] = token.split('.');
  assert.equal(await verifySession(`${version}.${Number(expiry) + 1}.${signature}`, 'secret-a', NOW), false);
  assert.equal(await verifySession(undefined, 'secret-a', NOW), false);
  assert.equal(await verifySession(token, '', NOW), false);
});

test('the return path stays on this site and never loops into the gate', () => {
  assert.equal(safeNextPath('/?view=results&mode=buy'), '/?view=results&mode=buy');
  for (const value of ['https://evil.test', '//evil.test', '/\\evil.test', '/acesso.html?erro=dominio', '/api/auth/google', null]) {
    assert.equal(safeNextPath(value), '/', String(value));
  }
});

test('cookies are read by exact name', () => {
  assert.equal(readCookie('a=1; i24_access=v1.2.x; b=3', SESSION_COOKIE), 'v1.2.x');
  assert.equal(readCookie('xi24_access=nope', SESSION_COOKIE), null);
  assert.equal(readCookie(null, SESSION_COOKIE), null);
});

async function withAccessEnv(run) {
  const saved = {...process.env}, savedFetch = globalThis.fetch;
  try {await run();} finally {
    globalThis.fetch = savedFetch;
    for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'AUTH_SECRET']) {
      if (key in saved) process.env[key] = saved[key]; else delete process.env[key];
    }
  }
}

test('the callback checks state, refuses other accounts and signs in a company account', () => withAccessEnv(async () => {
  Object.assign(process.env, {GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 'client-secret', AUTH_SECRET: 'secret-a'});
  const idToken = overrides => `h.${Buffer.from(JSON.stringify(claims({exp: Math.floor(Date.now() / 1000) + 600, ...overrides}))).toString('base64url')}.s`;
  const request = (state = 'abc') => new Request(`https://proto.test/api/auth/callback?code=c1&state=${state}`, {headers: {cookie: 'i24_oauth_state=abc; i24_oauth_next=%2F%3Fview%3Dresults'}});
  const location = response => new URL(response.headers.get('location'));

  let response = await callback(request('other'));
  assert.equal(location(response).searchParams.get('erro'), 'falha');

  globalThis.fetch = async () => Response.json({id_token: idToken({email: 'pessoa@gmail.com', hd: undefined})});
  response = await callback(request());
  assert.equal(location(response).searchParams.get('erro'), 'dominio');
  assert.ok(!response.headers.getSetCookie().some(value => value.startsWith(`${SESSION_COOKIE}=`)));

  let sent;
  globalThis.fetch = async (url, init) => {sent = {url, body: String(init.body)}; return Response.json({id_token: idToken()});};
  response = await callback(request());
  assert.equal(sent.url, 'https://oauth2.googleapis.com/token');
  assert.match(sent.body, /redirect_uri=https%3A%2F%2Fproto\.test%2Fapi%2Fauth%2Fcallback/);
  assert.equal(location(response).toString(), 'https://proto.test/?view=results');
  const session = response.headers.getSetCookie().find(value => value.startsWith(`${SESSION_COOKIE}=`));
  assert.match(session, /HttpOnly; Secure; SameSite=Lax; Max-Age=604800/);
  assert.equal(await verifySession(decodeURIComponent(session.split(';')[0].split('=')[1]), 'secret-a'), true);
}));

test('the middleware fails closed and lets a valid session through', () => withAccessEnv(async () => {
  {
    delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; delete process.env.AUTH_SECRET;
    let response = await middleware(new Request('https://proto.test/?view=results'));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://proto.test/acesso.html?erro=config');

    Object.assign(process.env, {GOOGLE_CLIENT_ID: CLIENT, GOOGLE_CLIENT_SECRET: 'client-secret', AUTH_SECRET: 'secret-a'});
    response = await middleware(new Request('https://proto.test/?view=results&mode=buy'));
    assert.equal(new URL(response.headers.get('location')).searchParams.get('next'), '/?view=results&mode=buy');

    response = await middleware(new Request('https://proto.test/', {headers: {cookie: `${SESSION_COOKIE}=forged`}}));
    assert.equal(response.status, 302);

    const token = await signSession('secret-a');
    response = await middleware(new Request('https://proto.test/', {headers: {cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}`}}));
    assert.equal(response.headers.get('x-middleware-next'), '1');
  }
}));
