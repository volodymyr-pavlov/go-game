import { ResultKind, type Result } from '@go-game/core/game.ts';
import { colourName } from '@go-game/core/notation.ts';
import type { Score } from '@go-game/core/scoring.ts';

export { illegalMoveMessage } from '@go-game/core/illegalMoveMessage.ts';

/** Who plays one colour. Used by the status card. */
export interface Seat {
  /** The name of the engine (Gopher, Bear or Elephant) when it plays this colour. */
  engine: string | null;
  /** The nickname of the other player on this colour in an online game. */
  remote: string | null;
}

/**
 * Names the player of a colour. The engine gets its name, a player on another computer gets their nickname, and the
 * person at this keyboard is "You". When two people share the keyboard, the colour is used, because then nobody is "you".
 */
export function playerLabel(name: string, seat: Seat, other: Seat): string {
  if (seat.remote !== null) return seat.remote;
  if (seat.engine !== null) return seat.engine;
  const twoAtOneKeyboard = other.engine === null && other.remote === null;
  return twoAtOneKeyboard ? name : 'You';
}

const RESULT_KIND_NAMES: Record<ResultKind, string> = {
  [ResultKind.SCORE]: 'score',
  [ResultKind.RESIGNATION]: 'resignation',
  [ResultKind.TIMEOUT]: 'time',
};

/** How a game ended, as a word for the history list. */
export function resultKindName(kind: ResultKind): string {
  return RESULT_KIND_NAMES[kind];
}

export function resultReason(result: Result, score: Score): string {
  if (result.kind === ResultKind.RESIGNATION) return `${colourName(result.resigned)} resigned`;
  if (result.kind === ResultKind.TIMEOUT) return `${colourName(result.timedOut)} ran out of time`;
  const margin = Math.abs(score.black.total - score.white.total);
  return `Both players passed. Wins by ${margin} points with area scoring.`;
}
