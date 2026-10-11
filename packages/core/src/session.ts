import type { User } from './user.ts';

export type ErrorListener = (message: string) => void;

/**
 * The signed-in player as the app sees them, whatever signs the player in. The Firebase session in the web app is one
 * implementation of it, and a Telegram one can be another.
 */
export interface Session {
  onUser(listener: (user: User | null) => void): () => void;
  /** Finishes only after the onUser listeners have heard about the sign-in. */
  signInAsGuest(): Promise<void>;
  /** Gives this nickname to the signed-in user and frees the old one. Fails when the name is taken or not valid. */
  claimNickname(nickname: string): Promise<void>;
  linkEmail(email: string, password: string): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Removes the leaderboard entry, the game records and the nickname claim, then the account itself. */
  deleteEntry(): Promise<void>;
  /** Sets where a failure to reach the sign-in service is reported. The visitor is shown as signed out in that case. */
  reportErrorsTo(onError: ErrorListener): void;
}
