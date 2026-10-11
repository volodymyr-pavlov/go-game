import type { MiddlewareHandler } from 'hono';
import type { ApiDeps, AppEnv } from '../deps.ts';
import { HttpError } from '../http.ts';

/**
 * For a write that a script could repeat: at most so many a minute for each player and each `action`, and a Turnstile
 * token that passes. It runs after `authenticate`, so a caller who is not signed in does not use up a limit.
 */
export function guarded(deps: Pick<ApiDeps, 'limiter' | 'challenge'>, action: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!(await deps.limiter(`${action}:${c.get('uid')}`))) {
      throw new HttpError(429, 'Too many requests. Wait a little and try again');
    }
    if (!(await deps.challenge(c.req.raw))) {
      throw new HttpError(403, 'The check did not pass. Reload the page and try again');
    }
    await next();
  };
}
