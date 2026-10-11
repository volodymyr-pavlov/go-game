import { BLACK, type Point, type Stone } from './board.ts';

const COLUMN_LETTERS = 'ABCDEFGHJKLMNOPQRST'; // Go convention skips the letter I.

/** "Black" or "White", the way the colour is shown to the player. */
export function colourName(stone: Stone): string {
  return stone === BLACK ? 'Black' : 'White';
}

export function coordinateOf(point: Point, size: number): string {
  return `${COLUMN_LETTERS[point.x]}${size - point.y}`;
}
