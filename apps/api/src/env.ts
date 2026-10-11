import type { RoomDo } from './rooms/roomDo.ts';

export interface Env {
  DB: D1Database;
  /** Limits how often one player can write. See `ratelimits` in wrangler.jsonc. */
  LIMITER: RateLimit;
  ROOM: DurableObjectNamespace<RoomDo>;
  FIREBASE_PROJECT_ID: string;
  /** The token of the Telegram bot of the Mini App: `wrangler secret put TELEGRAM_BOT_TOKEN`. Without it, Telegram players cannot sign in. */
  TELEGRAM_BOT_TOKEN?: string;
  /** The secret of the Turnstile widget: `wrangler secret put TURNSTILE_SECRET`. Without it, only a Worker with DEV_AUTH runs. */
  TURNSTILE_SECRET?: string;
  /** Milliseconds a player has for a move. Set only to try the timeout in `wrangler dev`. Without it, the game uses TURN_TIMEOUT_MS. */
  TURN_TIMEOUT_MS?: string;
  /** Set only in the .env of `npm run cloudflare:dev`. It lets `wrangler dev` accept the token "dev-<uid>" instead of a Firebase token. */
  DEV_AUTH?: string;
}
