import { BLACK, EMPTY, WHITE, type Cell, type Point, type Stone } from '@go-game/types/game.ts';

export { BLACK, EMPTY, WHITE };
export type { Cell, Point, Stone };

export const BOARD_SIZE = 9;

/** The board is read as board[x][y]. Y grows from the top down. */
export type Board = Cell[][];

export interface Group {
  stones: Point[];
  liberties: number;
}

const ORTHOGONAL = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

export function emptyBoard(size = BOARD_SIZE): Board {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(EMPTY));
}

export function cloneBoard(board: Board): Board {
  return board.map((column) => [...column]);
}

export function sizeOf(board: Board): number {
  return board.length;
}

export function opponentOf(stone: Stone): Stone {
  return stone === BLACK ? WHITE : BLACK;
}

export function samePoint(a: Point | null, b: Point | null): boolean {
  return a !== null && b !== null && a.x === b.x && a.y === b.y;
}

export function isOnBoard(board: Board, { x, y }: Point): boolean {
  const size = sizeOf(board);
  return x >= 0 && x < size && y >= 0 && y < size;
}

export function cellAt(board: Board, { x, y }: Point): Cell {
  return board[x][y];
}

export function indexOf(size: number, { x, y }: Point): number {
  return x * size + y;
}

export function allPoints(board: Board): Point[] {
  const points: Point[] = [];
  for (let x = 0; x < sizeOf(board); x++) {
    for (let y = 0; y < sizeOf(board); y++) {
      points.push({ x, y });
    }
  }
  return points;
}

export function neighborsOf(board: Board, { x, y }: Point): Point[] {
  return ORTHOGONAL.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((point) => isOnBoard(board, point));
}

export function groupAt(board: Board, origin: Point): Group {
  const color = cellAt(board, origin);
  if (color === EMPTY) return { stones: [], liberties: 0 };

  const size = sizeOf(board);
  const seenStones = new Uint8Array(size * size);
  const seenLiberties = new Uint8Array(size * size);
  const stones: Point[] = [];
  let liberties = 0;

  const queue = [origin];
  seenStones[indexOf(size, origin)] = 1;

  while (queue.length > 0) {
    const current = queue.pop()!;
    stones.push(current);
    for (const next of neighborsOf(board, current)) {
      const index = indexOf(size, next);
      const cell = cellAt(board, next);
      if (cell === EMPTY && !seenLiberties[index]) {
        seenLiberties[index] = 1;
        liberties++;
      } else if (cell === color && !seenStones[index]) {
        seenStones[index] = 1;
        queue.push(next);
      }
    }
  }

  return { stones, liberties };
}
