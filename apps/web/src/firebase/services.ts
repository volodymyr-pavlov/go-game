// When VITE_FIREBASE_* is not set, the build has no Firebase code at all.

import type { Session } from './auth.ts';
import type { GameSync } from '@go-game/client/rooms.ts';
import type { Leaderboard } from '@go-game/client/leaderboard.ts';

/** What a site with accounts has: sign-in from Firebase, and the leaderboard and online rooms from the game server. */
export interface Firebase {
  session: Session;
  leaderboard: Leaderboard;
  sync: GameSync;
}

export async function createFirebase(): Promise<Firebase | null> {
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) return null;
  const { firebaseConfig, connectAuth } = await import('./config.ts');
  const config = firebaseConfig();
  if (config === null) return null;
  const [
    { FirebaseSession },
    { ApiClient },
    { TurnstileChallenge },
    { ApiPlayers },
    { ServerLeaderboard },
    { ServerGameSync },
  ] = await Promise.all([
    import('./auth.ts'),
    import('@go-game/client/client.ts'),
    import('@go-game/client/turnstile.ts'),
    import('@go-game/client/players.ts'),
    import('@go-game/client/leaderboard.ts'),
    import('@go-game/client/rooms.ts'),
  ]);
  const auth = connectAuth(config);
  // Without a Turnstile site key the writes carry no token. Only a game server in development takes them.
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const challenge = siteKey ? new TurnstileChallenge(siteKey).token : null;
  const client = new ApiClient(async () => (await auth).idToken(), undefined, challenge);
  const players = new ApiPlayers(client);
  const session = new FirebaseSession(auth, players);
  return { session, leaderboard: new ServerLeaderboard(players, session), sync: new ServerGameSync(client) };
}
