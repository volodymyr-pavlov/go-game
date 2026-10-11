// Chinese scoring. Each side gets one point for every stone on the board and one for every empty point it surrounds. White also gets komi.

import {
  BLACK,
  EMPTY,
  WHITE,
  allPoints,
  cellAt,
  indexOf,
  neighborsOf,
  sizeOf,
  type Board,
  type Point,
  type Stone,
} from './board.ts';
import type { Position } from './rules.ts';

export const KOMI = 6.5;

export interface SideScore {
  stones: number;
  territory: number;
  total: number;
}

export interface Territory {
  point: Point;
  owner: Stone;
}

export interface Score {
  black: SideScore;
  white: SideScore;
  territory: Territory[];
  winner: Stone;
}

export function scorePosition(position: Position): Score {
  return scoreBoard(position.board);
}

export function scoreBoard(board: Board): Score {
  const territory = territoryOf(board);
  const stones = countStones(board);
  const black = sideScore(stones, territory, BLACK, 0);
  const white = sideScore(stones, territory, WHITE, KOMI);
  return { black, white, territory, winner: black.total > white.total ? BLACK : WHITE };
}

function countStones(board: Board): Record<Stone, number> {
  const stones = { [BLACK]: 0, [WHITE]: 0 };
  for (const point of allPoints(board)) {
    const cell = cellAt(board, point);
    if (cell !== EMPTY) stones[cell]++;
  }
  return stones;
}

function sideScore(stones: Record<Stone, number>, territory: Territory[], stone: Stone, bonus: number): SideScore {
  const owned = territory.filter((t) => t.owner === stone).length;
  return { stones: stones[stone], territory: owned, total: stones[stone] + owned + bonus };
}

/** An empty region that touches stones of only one colour belongs to that colour. */
function territoryOf(board: Board): Territory[] {
  const size = sizeOf(board);
  const visited = new Uint8Array(size * size);
  const territory: Territory[] = [];

  for (const origin of allPoints(board)) {
    if (cellAt(board, origin) !== EMPTY || visited[indexOf(size, origin)]) continue;
    const region = floodEmptyRegion(board, origin, visited);
    if (region.borders.size !== 1) continue;
    const owner = region.borders.has(BLACK) ? BLACK : WHITE;
    for (const point of region.points) territory.push({ point, owner });
  }

  return territory;
}

function floodEmptyRegion(board: Board, origin: Point, visited: Uint8Array): { points: Point[]; borders: Set<Stone> } {
  const size = sizeOf(board);
  const points: Point[] = [];
  const borders = new Set<Stone>();
  const queue = [origin];
  visited[indexOf(size, origin)] = 1;

  while (queue.length > 0) {
    const current = queue.pop()!;
    points.push(current);
    for (const next of neighborsOf(board, current)) {
      const cell = cellAt(board, next);
      if (cell !== EMPTY) {
        borders.add(cell);
        continue;
      }
      const index = indexOf(size, next);
      if (!visited[index]) {
        visited[index] = 1;
        queue.push(next);
      }
    }
  }

  return { points, borders };
}
