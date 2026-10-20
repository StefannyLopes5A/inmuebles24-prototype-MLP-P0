import {next} from '@vercel/functions';
import {SESSION_COOKIE, accessConfigured, accessPage, readCookie, redirect, verifySession} from './lib/internalAccess.js';

export const config = {
  matcher: ['/((?!acesso\\.html|api/auth/|favicon\\.svg|assets/figma-home/d0d59\\.svg).*)'],
};

/** Fails closed: without the secrets, nothing past the access page is served. */
export default async function middleware(request) {
  const url = new URL(request.url);
  if (!accessConfigured(process.env)) return redirect(accessPage(url.origin, {erro: 'config'}));
  if (await verifySession(readCookie(request.headers.get('cookie'), SESSION_COOKIE), process.env.AUTH_SECRET)) return next();
  return redirect(accessPage(url.origin, {next: url.pathname + url.search}));
}
