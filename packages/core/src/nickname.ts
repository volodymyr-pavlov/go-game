// The rules for nicknames. The form uses them, and firebase/firestore.rules repeats them.

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 24;

export function normalizeNickname(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length >= NICKNAME_MIN && name.length <= NICKNAME_MAX ? name : null;
}

/** The key a nickname is saved under. Case does not matter, so "Alice" and "alice" are the same name. */
export function nicknameKey(name: string): string {
  return name.toLowerCase();
}
