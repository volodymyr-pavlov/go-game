import { IllegalReason } from './rules.ts';

const MESSAGES: Record<IllegalReason, string> = {
  [IllegalReason.OFF_BOARD]: 'Outside the board',
  [IllegalReason.OCCUPIED]: 'That point is taken',
  [IllegalReason.KO]: 'Ko rule: you cannot retake right away',
  [IllegalReason.SUICIDE]: 'Suicide is not allowed',
  [IllegalReason.GAME_OVER]: 'The game is over',
};

/** Why a move is not allowed, in words for the player. The page and the game server both use it. */
export function illegalMoveMessage(reason: IllegalReason): string {
  return MESSAGES[reason];
}
