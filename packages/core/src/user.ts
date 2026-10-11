// The signed-in player as the pages see them. This module has no Firebase in it, so the navbar can use it on a site without accounts.

export interface User {
  uid: string;
  nickname: string | null;
  /** True until the player adds an email and a password. */
  isGuest: boolean;
  email: string | null;
}

/** The name other players see: the nickname, or "Guest" while the player has none. */
export function displayName(user: User): string {
  return user.nickname ?? 'Guest';
}
