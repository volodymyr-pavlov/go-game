import { Hono } from 'hono';
import type { GamesResponse, LeaderboardResponse } from '@go-game/types/api.ts';
import type { ApiDeps, AppEnv } from '../deps.ts';
import { HttpError } from '../http.ts';
import { authenticate } from '../middleware/auth.ts';

export const TOP_COUNT = 25;
export const HISTORY_COUNT = 20;

/** The leaderboard and the players. Public reads need no sign-in. A player's games are private to them. */
export function leaderboardRoutes(deps: ApiDeps): Hono<AppEnv> {
  const { players } = deps;
  const app = new Hono<AppEnv>();

  app.get('/api/leaderboard', async (c) =>
    c.json({ players: await players.top(TOP_COUNT) } satisfies LeaderboardResponse),
  );

  app.get('/api/players/:uid', async (c) => {
    const player = await players.find(c.req.param('uid'));
    if (player === null) throw new HttpError(404, 'No such player');
    return c.json(player);
  });

  app.get('/api/players/:uid/games', authenticate(deps), async (c) => {
    const uid = c.req.param('uid');
    if (c.get('uid') !== uid) throw new HttpError(403, 'These games are not yours');
    return c.json({ games: await players.history(uid, HISTORY_COUNT) } satisfies GamesResponse);
  });

  return app;
}
