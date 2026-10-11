import type { RoomGateway } from './rooms/gateway.ts';
import type { PlayerDb } from './services/d1.ts';
import type { TokenVerifier } from './services/firebaseToken.ts';
import type { TelegramVerifier } from './services/telegramInitData.ts';
import type { Challenge } from './services/turnstile.ts';

/** Says whether a player may do one more of this kind of write now. */
export type RateLimiter = (key: string) => Promise<boolean>;

/** Everything the routes need from the outside, so a test can give its own. */
export interface ApiDeps {
  players: PlayerDb;
  rooms: RoomGateway;
  limiter: RateLimiter;
  challenge: Challenge;
  /** Checks a Firebase ID token: the sign-in of the web app. */
  verify: TokenVerifier;
  /** Checks the initData of a Telegram Mini App. Missing when the server has no bot. */
  telegram?: TelegramVerifier;
  now(): number;
}

/** What a route can read from the context: who is calling, once the caller has been checked. */
export interface AppEnv {
  Variables: { uid: string };
}
