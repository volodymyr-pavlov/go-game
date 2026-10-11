import type { MiddlewareHandler } from 'hono';
import { SOCKET_PROTOCOL } from '@go-game/types/protocol.ts';
import type { ApiDeps, AppEnv } from '../deps.ts';
import { HttpError } from '../http.ts';

/**
 * Finds out who is calling, and puts the uid in the context. There are two ways to sign in, and the header says which:
 * `Authorization: Bearer <Firebase ID token>` for the web app, and `Authorization: tma <initData>` for a Telegram Mini App.
 * A WebSocket cannot set headers, so it sends the Firebase token as the protocol after "go-game".
 */
export function authenticate(deps: Pick<ApiDeps, 'verify' | 'telegram'>): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('uid', await uidOf(c.req.raw, deps));
    await next();
  };
}

async function uidOf(request: Request, { verify, telegram }: Pick<ApiDeps, 'verify' | 'telegram'>): Promise<string> {
  const header = request.headers.get('Authorization') ?? '';
  try {
    if (header.startsWith('Bearer ')) return await verify(header.slice('Bearer '.length));
    if (header.startsWith('tma ') && telegram !== undefined) return await telegram(header.slice('tma '.length));
    const protocols = (request.headers.get('Sec-WebSocket-Protocol') ?? '').split(',').map((part) => part.trim());
    if (header === '' && protocols[0] === SOCKET_PROTOCOL && protocols[1]) return await verify(protocols[1]);
  } catch {
    throw new HttpError(401, 'Sign in again');
  }
  throw new HttpError(401, 'Sign in first');
}
