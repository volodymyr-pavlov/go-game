import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { FirebaseSession, REPORT_TIMEOUT_MS, type User } from '../auth.ts';
import type { Account, AuthApi, Unsubscribe } from '../config.ts';
import type {
  ErrorListener,
  GameEntry,
  PlayedGame,
  Player,
  PlayerRepository,
  RankedPlayer,
} from '@go-game/client/players.ts';

const ACCOUNT: Account = { uid: 'u1', isAnonymous: true, email: null };

const notUsed = () => Promise.reject(new Error('Not used in this test'));

class FakeAuth implements AuthApi {
  currentAccount(): Account | null {
    return null;
  }
  onAccountChange(listener: (account: Account | null) => void): Unsubscribe {
    queueMicrotask(() => listener(ACCOUNT));
    return () => undefined;
  }
  async signInAnonymously(): Promise<Account> {
    return ACCOUNT;
  }
  async idToken(): Promise<string | null> {
    return null;
  }
  signInWithEmail = notUsed;
  linkEmail = notUsed;
  signOut = notUsed;
  deleteAccount = notUsed;
}

class FakePlayers implements PlayerRepository {
  private readonly _listeners: ((player: Player | null) => void)[] = [];

  /** The player record arrives from the server. */
  arrives(name: string): void {
    for (const listener of this._listeners) listener({ name, rating: 1000, wins: 0, losses: 0 });
  }
  followPlayer(_uid: string, onPlayer: (player: Player | null) => void): Unsubscribe {
    this._listeners.push(onPlayer);
    return () => undefined;
  }
  followTop(_onTop: (players: readonly RankedPlayer[]) => void, _onError: ErrorListener): Unsubscribe {
    return () => undefined;
  }
  player(): Promise<Player | null> {
    return notUsed();
  }
  history(): Promise<PlayedGame[]> {
    return notUsed();
  }
  claimNickname(_name: string): Promise<void> {
    return notUsed();
  }
  saveGame(_game: GameEntry): Promise<void> {
    return notUsed();
  }
  deletePlayer(): Promise<void> {
    return notUsed();
  }
}

function session(auth: Promise<AuthApi> = Promise.resolve(new FakeAuth())) {
  const players = new FakePlayers();
  const subject = new FirebaseSession(auth, players);
  const reports: (User | null)[] = [];
  const errors: string[] = [];
  subject.reportErrorsTo((message) => errors.push(message));
  subject.onUser((user) => reports.push(user));
  return { session: subject, players, reports, errors };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('a sign-in resolves once the player document has been reported', async () => {
  const { session: subject, players, reports } = session();

  let signedIn = false;
  const signIn = subject.signInAsGuest().then(() => (signedIn = true));
  await vi.advanceTimersByTimeAsync(REPORT_TIMEOUT_MS - 1);
  assert.equal(signedIn, false);

  players.arrives('alice');
  await signIn;
  assert.deepEqual(reports, [{ uid: 'u1', nickname: 'alice', isGuest: true, email: null }]);

  await vi.advanceTimersByTimeAsync(REPORT_TIMEOUT_MS);
  assert.equal(reports.length, 1);
});

test('a sign-in goes on from the account alone when the player document never arrives', async () => {
  const { session: subject, reports } = session();

  const signIn = subject.signInAsGuest();
  await vi.advanceTimersByTimeAsync(REPORT_TIMEOUT_MS);
  await signIn;
  assert.deepEqual(reports, [{ uid: 'u1', nickname: null, isGuest: true, email: null }]);
});

test('a connection that fails is reported, and the visitor is shown as signed out', async () => {
  const { reports, errors } = session(Promise.reject(new Error('No network')));
  await vi.advanceTimersByTimeAsync(0);
  assert.deepEqual(errors, ['No network']);
  assert.deepEqual(reports, [null]);
});
