import { Hono } from 'hono';
import type { ApiDeps, AppEnv } from '../deps.ts';
import { HttpError } from '../http.ts';
import { authenticate } from '../middleware/auth.ts';

/**
 * Telegram Stars, the money of Telegram Mini Apps. The routes are here so the Mini App has an address to call, but
 * nothing is for sale yet, so they refuse. What will be sold is not decided.
 */
export function starsRoutes(deps: ApiDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  /** Will give the link of an invoice for the caller, made with the bot's `createInvoiceLink`. */
  app.post('/api/stars/invoice', authenticate(deps), () => {
    throw new HttpError(501, 'Telegram Stars are not on sale yet');
  });

  /** Will take the bot's updates: the pre-checkout question and the payment that went through. */
  app.post('/api/stars/webhook', () => {
    throw new HttpError(501, 'Telegram Stars are not on sale yet');
  });

  return app;
}
