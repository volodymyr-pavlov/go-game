import { Hono } from 'hono';
import type { CreatedRoomResponse, RoomsResponse } from '@go-game/types/api.ts';
import type { ApiDeps, AppEnv } from '../deps.ts';
import { HttpError } from '../http.ts';
import { authenticate } from '../middleware/auth.ts';
import { guarded } from '../middleware/rateLimit.ts';

/** The lobby and the rooms. A game itself runs in the Durable Object of its room, behind the gateway. */
export function roomRoutes(deps: ApiDeps): Hono<AppEnv> {
  const { players, rooms } = deps;
  const app = new Hono<AppEnv>();

  /** The name other players see: the nickname, or "Guest" while the player has none. */
  const nameOf = async (uid: string): Promise<string> => (await players.find(uid))?.name ?? 'Guest';

  app.get('/api/rooms', authenticate(deps), async (c) =>
    c.json({ rooms: await rooms.listOpen() } satisfies RoomsResponse),
  );

  app.post('/api/rooms', authenticate(deps), guarded(deps, 'create'), async (c) => {
    const uid = c.get('uid');
    return c.json({ id: await rooms.create(uid, await nameOf(uid)) } satisfies CreatedRoomResponse, 201);
  });

  app.post('/api/rooms/:id/join', authenticate(deps), guarded(deps, 'join'), async (c) => {
    const uid = c.get('uid');
    await rooms.join(c.req.param('id'), uid, await nameOf(uid));
    return c.body(null, 204);
  });

  app.delete('/api/rooms/:id', authenticate(deps), async (c) => {
    await rooms.cancel(c.req.param('id'), c.get('uid'));
    return c.body(null, 204);
  });

  // A browser cannot set headers on a WebSocket, so the token comes as a second protocol, after "go-game".
  app.get(
    '/api/rooms/:id/socket',
    async (c, next) => {
      if (c.req.header('Upgrade') !== 'websocket') throw new HttpError(426, 'This address speaks WebSocket');
      await next();
    },
    authenticate(deps),
    (c) => rooms.connect(c.req.param('id'), c.get('uid'), c.req.raw),
  );

  return app;
}
