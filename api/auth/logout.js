import {SESSION_COOKIE, accessPage, cookie, redirect} from '../../lib/internalAccess.js';

export function GET(request) {
  return redirect(accessPage(new URL(request.url).origin), [cookie(SESSION_COOKIE, '', {maxAge: 0})]);
}
