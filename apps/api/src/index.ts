import { createApi } from './app.ts';
import { telegramVerifier } from './services/telegramInitData.ts';
import type { Challenge } from './services/turnstile.ts';
import { turnstileChallenge } from './services/turnstile.ts';
import { devTokenVerifier, firebaseTokenVerifier, type TokenVerifier } from './services/firebaseToken.ts';
import type { Env } from './env.ts';
import { DurableRooms } from './rooms/gateway.ts';
import { PlayerDb } from './services/d1.ts';
import { RoomDb } from './services/d1.ts';

export { RoomDo } from './rooms/roomDo.ts';
export type { Env } from './env.ts';

/** One verifier for the life of the isolate, so the Google keys it fetched are kept between requests. */
let verifier: TokenVerifier | null = null;

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    verifier ??= env.DEV_AUTH === '1' ? devTokenVerifier : firebaseTokenVerifier(env.FIREBASE_PROJECT_ID);
    return createApi({
      players: new PlayerDb(env.DB),
      rooms: new DurableRooms(env.ROOM, new RoomDb(env.DB), Date.now),
      verify: verifier,
      ...(env.TELEGRAM_BOT_TOKEN === undefined ? {} : { telegram: telegramVerifier(env.TELEGRAM_BOT_TOKEN) }),
      limiter: async (key) => (await env.LIMITER.limit({ key })).success,
      challenge: challengeOf(env),
      now: Date.now,
    })(request);
  },
} satisfies ExportedHandler<Env>;

/** Turnstile is required, unless this is `wrangler dev` (DEV_AUTH) with no secret. A deployed Worker with no secret refuses every checked write. */
function challengeOf(env: Env): Challenge {
  if (env.TURNSTILE_SECRET !== undefined) return turnstileChallenge(env.TURNSTILE_SECRET);
  const dev = env.DEV_AUTH === '1';
  return async () => dev;
}
