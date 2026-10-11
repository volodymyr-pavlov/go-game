import {
  BLACK,
  EMPTY,
  WHITE,
  cellAt,
  cloneBoard,
  emptyBoard,
  groupAt,
  isOnBoard,
  neighborsOf,
  opponentOf,
  samePoint,
  type Board,
  type Point,
  type Stone,
} from './board.ts';
import { IllegalReason, type Move } from '@go-game/types/game.ts';

export { IllegalReason };
export type { Move };

export interface Position {
  board: Board;
  toPlay: Stone;
  /** The point that the ko rule blocks for the next move, when there is one. */
  koPoint: Point | null;
  captures: Record<Stone, number>;
  consecutivePasses: number;
}

export type PlayResult = { ok: true; position: Position; captured: Point[] } | { ok: false; reason: IllegalReason };

const PASSES_TO_FINISH = 2;

export function initialPosition(size?: number): Position {
  return {
    board: emptyBoard(size),
    toPlay: BLACK,
    koPoint: null,
    captures: { [BLACK]: 0, [WHITE]: 0 },
    consecutivePasses: 0,
  };
}

export function isFinished(position: Position): boolean {
  return position.consecutivePasses >= PASSES_TO_FINISH;
}

export function illegalReason(position: Position, point: Point): IllegalReason | null {
  const { board, toPlay, koPoint } = position;
  if (isFinished(position)) return IllegalReason.GAME_OVER;
  if (!isOnBoard(board, point)) return IllegalReason.OFF_BOARD;
  if (cellAt(board, point) !== EMPTY) return IllegalReason.OCCUPIED;
  if (samePoint(koPoint, point)) return IllegalReason.KO;
  if (isSuicide(board, point, toPlay)) return IllegalReason.SUICIDE;
  return null;
}

export function play(position: Position, point: Point): PlayResult {
  const reason = illegalReason(position, point);
  if (reason !== null) return { ok: false, reason };

  const stone = position.toPlay;
  const board = cloneBoard(position.board);
  board[point.x][point.y] = stone;
  const captured = removeCapturedNeighbors(board, point, opponentOf(stone));

  return {
    ok: true,
    captured,
    position: {
      board,
      toPlay: opponentOf(stone),
      koPoint: koPointAfter(board, point, captured),
      captures: { ...position.captures, [stone]: position.captures[stone] + captured.length },
      consecutivePasses: 0,
    },
  };
}

export function pass(position: Position): Position {
  return {
    ...position,
    toPlay: opponentOf(position.toPlay),
    koPoint: null,
    consecutivePasses: position.consecutivePasses + 1,
  };
}

function isSuicide(board: Board, point: Point, stone: Stone): boolean {
  const opponent = opponentOf(stone);
  for (const neighbor of neighborsOf(board, point)) {
    const cell = cellAt(board, neighbor);
    if (cell === EMPTY) return false;
    const { liberties } = groupAt(board, neighbor);
    if (cell === stone && liberties > 1) return false;
    if (cell === opponent && liberties === 1) return false;
  }
  return true;
}

function removeCapturedNeighbors(board: Board, point: Point, opponent: Stone): Point[] {
  const captured: Point[] = [];
  for (const neighbor of neighborsOf(board, point)) {
    if (cellAt(board, neighbor) !== opponent) continue;
    const group = groupAt(board, neighbor);
    if (group.liberties > 0) continue;
    for (const stone of group.stones) {
      board[stone.x][stone.y] = EMPTY;
      captured.push(stone);
    }
  }
  return captured;
}

/** Ko rule: when one stone captures exactly one stone and is then left with one free point, it may not be captured back on the very next move. */
function koPointAfter(board: Board, point: Point, captured: Point[]): Point | null {
  if (captured.length !== 1) return null;
  const group = groupAt(board, point);
  const isLoneStoneInAtari = group.stones.length === 1 && group.liberties === 1;
  return isLoneStoneInAtari ? captured[0] : null;
}
