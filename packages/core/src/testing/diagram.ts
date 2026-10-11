import { BLACK, EMPTY, WHITE, type Board, type Cell, type Stone } from '../board.ts';
import { initialPosition, type Position } from '../rules.ts';

/** Builds a board from lines of text. `.` is an empty point, `X` is a black stone, `O` is a white stone. The first line is y = 0. */
export function boardFrom(rows: string[]): Board {
  const size = rows.length;
  const board: Board = Array.from({ length: size }, () => Array<Cell>(size).fill(EMPTY));
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      board[x][y] = char === 'X' ? BLACK : char === 'O' ? WHITE : EMPTY;
    });
  });
  return board;
}

export function positionFrom(rows: string[], toPlay: Stone = BLACK): Position {
  return { ...initialPosition(rows.length), board: boardFrom(rows), toPlay };
}
