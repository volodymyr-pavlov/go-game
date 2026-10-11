import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BLACK, EMPTY, WHITE } from './board.ts';
import { play, type Position } from './rules.ts';
import { positionFrom } from './testing/diagram.ts';
import { IllegalReason } from './rules.ts';

function mustPlay(position: Position, x: number, y: number) {
  const result = play(position, { x, y });
  assert.ok(result.ok, `expected ${x},${y} to be legal`);
  return result;
}

test('a stone with no liberties is captured and counted', () => {
  const position = positionFrom(['.X...', 'XOX..', '.....', '.....', '.....']);
  const result = mustPlay(position, 1, 2);
  assert.deepEqual(result.captured, [{ x: 1, y: 1 }]);
  assert.equal(result.position.board[1][1], EMPTY);
  assert.equal(result.position.captures[BLACK], 1);
});

test('suicide is illegal unless it captures', () => {
  const suicide = positionFrom(['.O...', 'O.O..', '.O...', '.....', '.....']);
  assert.deepEqual(play(suicide, { x: 1, y: 1 }), { ok: false, reason: IllegalReason.SUICIDE });

  const capturing = positionFrom(['.OX..', 'O.OX.', '.OX..', '.....', '.....']);
  const result = mustPlay(capturing, 1, 1);
  assert.equal(result.captured.length, 1);
});

test('occupied and off-board points are illegal', () => {
  const position = positionFrom(['X....', '.....', '.....', '.....', '.....']);
  assert.deepEqual(play(position, { x: 0, y: 0 }), { ok: false, reason: IllegalReason.OCCUPIED });
  assert.deepEqual(play(position, { x: 5, y: 0 }), { ok: false, reason: IllegalReason.OFF_BOARD });
});

test('simple ko forbids the immediate recapture only', () => {
  const position = positionFrom(['.....', '.XO..', 'X.XO.', '.XO..', '.....'], WHITE);
  const afterCapture = mustPlay(position, 1, 2).position;
  assert.deepEqual(afterCapture.koPoint, { x: 2, y: 2 });
  assert.deepEqual(play(afterCapture, { x: 2, y: 2 }), { ok: false, reason: IllegalReason.KO });

  const afterTenuki = mustPlay(mustPlay(afterCapture, 4, 4).position, 4, 0).position;
  assert.ok(play(afterTenuki, { x: 2, y: 2 }).ok);
});
