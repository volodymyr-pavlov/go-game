// The words of the game that every app, the packages and the game server share.

export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Stone = typeof BLACK | typeof WHITE;
export type Cell = typeof EMPTY | Stone;

export interface Point {
  x: number;
  y: number;
}

/** A move is a point on the board, or `null` for a pass. */
export type Move = Point | null;

/**
 * How a game is played, as flags. The bits of a colour mean that the engine plays that colour, so `Mode.HUMAN_VS_ENGINE`
 * (you play Black) is the White bit. `Mode.ONLINE` means a player on another computer plays the other colour.
 */
export const Mode = {
  HUMAN_VS_HUMAN: 0,
  ENGINE_VS_HUMAN: BLACK,
  HUMAN_VS_ENGINE: WHITE,
  ONLINE: 4,
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

/** How a game ended. */
export const ResultKind = { SCORE: 1, RESIGNATION: 2, TIMEOUT: 4 } as const;
export type ResultKind = (typeof ResultKind)[keyof typeof ResultKind];

/** Why a move is not allowed. `GAME_OVER` also covers a game that ended by resignation. Only `Game` knows about that. */
export const IllegalReason = { OFF_BOARD: 1, OCCUPIED: 2, KO: 4, SUICIDE: 8, GAME_OVER: 16 } as const;
export type IllegalReason = (typeof IllegalReason)[keyof typeof IllegalReason];
