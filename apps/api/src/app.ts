import { Hono } from 'hono';
import type { ApiDeps, AppEnv } from './deps.ts';
import { HttpError } from './http.ts';
import { authRoutes } from './routes/auth.ts';
import { leaderboardRoutes } from './routes/leaderboard.ts';
import { matchRoutes } from './routes/match.ts';
import { roomRoutes } from './routes/rooms.ts';
import { starsRoutes } from './routes/stars.ts';

export { HISTORY_COUNT, TOP_COUNT } from './routes/leaderboard.ts';
export { MIN_GAME_INTERVAL_MS } from './routes/match.ts';

/** The JSON API under /api. */
export function createApp(deps: ApiDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.route('/', leaderboardRoutes(deps));
  app.route('/', authRoutes(deps));
  app.route('/', matchRoutes(deps));
  app.route('/', roomRoutes(deps));
  app.route('/', starsRoutes(deps));

  // A path that exists, asked with a method it has no route for, is 405, not 404.
  const paths = new Set(app.routes.map((route) => route.path).filter((path) => path.startsWith('/api')));
  for (const path of paths) {
    app.all(path, () => {
      throw new HttpError(405, 'Method not allowed');
    });
  }

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((error, c) => {
    if (error instanceof HttpError) return c.json({ error: error.message }, error.status as 400);
    console.error(error);
    return c.json({ error: 'Something went wrong' }, 500);
  });
  return app;
}

/** The API as a function of a request, the way a Worker and a test call it. */
export function createApi(deps: ApiDeps): (request: Request) => Promise<Response> {
  const app = createApp(deps);
  return async (request) => app.fetch(request);
}
