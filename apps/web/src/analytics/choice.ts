import { storedValue } from '@go-game/client/storage.ts';

/** What the visitor answered to the consent bar. */
export const Choice = { GRANTED: 1, DENIED: 2 } as const;
export type Choice = (typeof Choice)[keyof typeof Choice];

export const STORAGE_KEY = 'analytics-consent';

/**
 * Reads the saved answer. Visitors who answered before flags were used have the words "granted" or "denied" saved, and
 * their answer stands. It is saved again as a number the next time they answer.
 */
export function parseChoice(value: string | null): Choice | null {
  if (value === Choice.GRANTED.toString() || value === 'granted') return Choice.GRANTED;
  if (value === Choice.DENIED.toString() || value === 'denied') return Choice.DENIED;
  return null;
}

const consent = storedValue(STORAGE_KEY, parseChoice);

export const storedChoice = consent.read;
export const storeChoice = consent.write;
export const clearChoice = consent.clear;
