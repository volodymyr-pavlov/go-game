// A player is only a nickname. Sign-in is anonymous. An email and password can be added, but are not required. There is no Google or other third-party login.

import { errorCode, messageOf } from '@go-game/core/errors.ts';
import type { Account, AuthApi } from './config.ts';
import { NICKNAME_MAX, NICKNAME_MIN, normalizeNickname } from '@go-game/core/nickname.ts';
import type { PlayerRepository } from '@go-game/client/players.ts';
import type { ErrorListener, Session } from '@go-game/core/session.ts';
import type { User } from '@go-game/core/user.ts';

export type { Session } from '@go-game/core/session.ts';
export type { User } from '@go-game/core/user.ts';

/** How long sign-in waits for the player record. After that it goes on with only the account data. */
export const REPORT_TIMEOUT_MS = 8_000;

export class FirebaseSession implements Session {
  private readonly _auth: Promise<AuthApi>;
  private readonly _players: PlayerRepository;
  private readonly _listeners = new Set<(user: User | null) => void>();
  private _onError: ErrorListener = () => undefined;
  private _user: User | null = null;
  private _started = false;
  private _settled = false;

  constructor(auth: Promise<AuthApi>, players: PlayerRepository) {
    this._auth = auth;
    this._players = players;
  }

  public onUser(listener: (user: User | null) => void): () => void {
    this._listeners.add(listener);
    if (this._settled) listener(this._user);
    if (!this._started) this._start();
    return () => this._listeners.delete(listener);
  }

  public reportErrorsTo(onError: ErrorListener): void {
    this._onError = onError;
  }

  public async signInAsGuest(): Promise<void> {
    const auth = await this._auth;
    const account = auth.currentAccount() ?? (await auth.signInAnonymously());
    await this._ensureReported(account);
  }

  public async claimNickname(nickname: string): Promise<void> {
    const name = normalizeNickname(nickname);
    if (name === null) throw new Error(`A nickname must have ${NICKNAME_MIN} to ${NICKNAME_MAX} characters`);
    const account = await this._signedIn();
    await this._players.claimNickname(name);
    this._emitChanged(account, { nickname: name });
  }

  public async linkEmail(email: string, password: string): Promise<void> {
    const auth = await this._auth;
    const account = await this._signedIn();
    await auth.linkEmail(email, password).catch(rethrowReadable);
    this._emitChanged(account, { isGuest: false, email });
  }

  public async signInWithEmail(email: string, password: string): Promise<void> {
    const auth = await this._auth;
    const account = await auth.signInWithEmail(email, password).catch(rethrowReadable);
    await this._ensureReported(account);
  }

  public async signOut(): Promise<void> {
    await (await this._auth).signOut();
  }

  public async deleteEntry(): Promise<void> {
    const auth = await this._auth;
    await this._signedIn();
    await this._players.deletePlayer();
    try {
      await auth.deleteAccount();
    } catch (error) {
      // Firebase asks for a fresh sign-in before it deletes an account with an email. Then the data is gone already, so we only sign out.
      await auth.signOut();
      if (errorCode(error) !== 'auth/requires-recent-login') throw error;
    }
  }

  private async _signedIn(): Promise<Account> {
    const account = (await this._auth).currentAccount();
    if (account === null) throw new Error('Sign in first');
    return account;
  }

  /** The first report waits for the player record. So a player who comes back is shown with their nickname from the start. */
  private _start(): void {
    this._started = true;
    this._auth.then((auth) => this._followAccount(auth)).catch((error) => this._reportUnreachable(error));
  }

  private _followAccount(auth: AuthApi): void {
    let stopPlayer: (() => void) | null = null;
    auth.onAccountChange((account) => {
      stopPlayer?.();
      stopPlayer = null;
      if (account === null) return this._emit(null);
      const signedIn = userOf(account);
      stopPlayer = this._players.followPlayer(
        account.uid,
        (player) => this._emit({ ...signedIn, ...this._sameAccount(account.uid), nickname: player?.name ?? null }),
        () => this._emit(signedIn),
      );
    });
  }

  /** Without Firebase there is nobody to sign in. The pages must not wait, so the visitor is reported as signed out. */
  private _reportUnreachable(error: unknown): void {
    this._onError(messageOf(error));
    this._emit(null);
  }

  /** Keeps the email and guest flag that linkEmail set, so a later update does not drop them. */
  private _sameAccount(uid: string): Partial<User> {
    return this._user?.uid === uid ? { isGuest: this._user.isGuest, email: this._user.email } : {};
  }

  private _emitChanged(account: Account, changes: Partial<User>): void {
    const known = this._user?.uid === account.uid ? this._user : null;
    this._emit({ ...(known ?? userOf(account)), ...changes });
  }

  private async _ensureReported(account: Account): Promise<void> {
    if (this._user?.uid === account.uid) return;
    if (!this._started) this._start();
    const reported = await this._awaitReport(account.uid, REPORT_TIMEOUT_MS);
    // When Firestore cannot be reached, it keeps trying in the background. Sign-in goes on with only the account data.
    if (!reported) this._emit(userOf(account));
  }

  private _awaitReport(uid: string, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const listener = (user: User | null) => {
        if (user?.uid === uid) finish(true);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      const finish = (reported: boolean) => {
        this._listeners.delete(listener);
        clearTimeout(timer);
        resolve(reported);
      };
      this._listeners.add(listener);
    });
  }

  private _emit(user: User | null): void {
    this._settled = true;
    this._user = user;
    for (const listener of this._listeners) listener(user);
  }
}

function userOf(account: Account): User {
  return { uid: account.uid, nickname: null, isGuest: account.isAnonymous, email: account.email };
}

const EMAIL_TAKEN = 'That email is already linked to another player';
const WRONG_LOGIN = 'Wrong email or password';

const AUTH_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': EMAIL_TAKEN,
  'auth/credential-already-in-use': EMAIL_TAKEN,
  'auth/invalid-email': 'That is not an email address',
  'auth/weak-password': 'The password must have at least 6 characters',
  'auth/invalid-credential': WRONG_LOGIN,
  'auth/wrong-password': WRONG_LOGIN,
  'auth/user-not-found': WRONG_LOGIN,
};

function rethrowReadable(error: unknown): never {
  throw new Error(AUTH_MESSAGES[errorCode(error)] ?? messageOf(error));
}
