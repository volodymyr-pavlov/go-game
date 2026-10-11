import { Hono } from 'hono';
import { engineRating, ratingDelta } from '@go-game/core/elo.ts';
import { OPPONENTS, opponentName } from '@go-game/core/opponents.ts';
import type { EngineResultRequest, GameSavedResponse } from '@go-game/types/api.ts';
import { ResultKind } from '@go-game/types/game.ts';
import type { ApiDeps, AppEnv } from '../deps.ts';
import { HttpError } from '../http.ts';
import { authenticate } from '../middleware/auth.ts';
import { bodyOf } from './auth.ts';

/** A player can save a result at most this often. */
export const MIN_GAME_INTERVAL_MS = 30_000;

/**
 * The result of a game against the engine, as the browser reports it. The engine runs in the browser, so the server
 * cannot check it. It works out the rating change itself, from its own record, so a browser cannot choose the points.
 */
export function matchRoutes(deps: ApiDeps): Hono<AppEnv> {
  const { players, now } = deps;
  const app = new Hono<AppEnv>();

  app.post('/api/me/games', authenticate(deps), async (c) => {
    const uid = c.get('uid');
    const result = engineResultOf(await bodyOf(c.req.raw));
    const player = await players.find(uid);
    if (player === null) throw new HttpError(409, 'Pick a nickname first');
    const last = await players.lastGameAt(uid);
    if (last !== null && now() - last < MIN_GAME_INTERVAL_MS) {
      throw new HttpError(429, 'Wait a little before the next result');
    }

    const ratingBefore = player.rating;
    const ratingAfter = ratingBefore + ratingDelta(ratingBefore, engineRating(result.playouts), result.won);
    const saved = await players.saveGame(
      uid,
      {
        opponent: null,
        opponentName: opponentName(result.playouts),
        won: result.won,
        kind: result.kind,
        ratingBefore,
        ratingAfter,
      },
      now(),
    );
    if (!saved) throw new HttpError(409, 'Another result was saved at the same time. Try again');
    return c.json({ ratingBefore, ratingAfter } satisfies GameSavedResponse, 201);
  });

  return app;
}

function engineResultOf(body: Record<string, unknown>): EngineResultRequest {
  const { playouts, won, kind } = body;
  if (!OPPONENTS.some((known) => known.playouts === playouts)) throw new HttpError(400, 'Unknown engine level');
  if (typeof won !== 'boolean') throw new HttpError(400, 'won must be true or false');
  // Only a game against the engine comes from a browser. A game lost on time is decided by a room, never reported.
  if (kind !== ResultKind.SCORE && kind !== ResultKind.RESIGNATION) {
    throw new HttpError(400, 'kind must be a score or a resignation');
  }
  return { playouts: playouts as number, won, kind };
}
