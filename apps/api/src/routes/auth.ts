import { Hono } from 'hono';
import { NICKNAME_MAX, NICKNAME_MIN, nicknameKey, normalizeNickname } from '@go-game/core/nickname.ts';
import type { ApiDeps, AppEnv } from '../deps.ts';
import { HttpError } from '../http.ts';
import { authenticate } from '../middleware/auth.ts';
import { guarded } from '../middleware/rateLimit.ts';
import { NicknameTakenError } from '../services/d1.ts';

/** A player is a nickname. These routes give one, change it, and remove the player with everything they have. */
export function authRoutes(deps: ApiDeps): Hono<AppEnv> {
  const { players, now } = deps;
  const app = new Hono<AppEnv>();

  app.put('/api/me/nickname', authenticate(deps), guarded(deps, 'nickname'), async (c) => {
    const { nickname } = await bodyOf(c.req.raw);
    if (typeof nickname !== 'string') throw new HttpError(400, 'nickname must be a string');
    const name = normalizeNickname(nickname);
    if (name === null) throw new HttpError(400, `A nickname must have ${NICKNAME_MIN} to ${NICKNAME_MAX} characters`);
    try {
      return c.json(await players.claimNickname(c.get('uid'), name, nicknameKey(name), now()));
    } catch (error) {
      if (error instanceof NicknameTakenError) throw new HttpError(409, error.message);
      throw error;
    }
  });

  app.delete('/api/me', authenticate(deps), async (c) => {
    await players.remove(c.get('uid'));
    return c.body(null, 204);
  });

  return app;
}

/** The JSON object of the request body, or a 400 that says so. */
export async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Not JSON. The error below is the same.
  }
  throw new HttpError(400, 'The request body must be a JSON object');
}
