import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BLACK, WHITE } from './board.ts';
import { Game, IllegalMoveError, Mode, ResultKind } from './game.ts';
import { IllegalReason } from './rules.ts';

test('resignation names the opponent as winner regardless of score', () => {
  const game = new Game(Mode.HUMAN_VS_HUMAN);
  game.play({ x: 4, y: 4 });
  game.resign();
  assert.deepEqual(game.result, { kind: ResultKind.RESIGNATION, winner: BLACK, resigned: WHITE });
});

test('two consecutive passes finish the game by score', () => {
  const game = new Game(Mode.HUMAN_VS_HUMAN);
  game.play({ x: 4, y: 4 });
  game.pass();
  game.pass();
  assert.equal(game.result?.kind, ResultKind.SCORE);
  assert.equal(game.result?.winner, BLACK);
});

test('an illegal move is reported by illegalReason and rejected by play', () => {
  const game = new Game(Mode.HUMAN_VS_HUMAN);
  game.play({ x: 4, y: 4 });
  assert.equal(game.illegalReason({ x: 4, y: 4 }), IllegalReason.OCCUPIED);
  assert.throws(() => game.play({ x: 4, y: 4 }), IllegalMoveError);
  assert.equal(game.moveNumber, 1);
});

test('once the game is over, no move is legal, and playing one throws', () => {
  const game = new Game(Mode.HUMAN_VS_HUMAN);
  game.resign();
  assert.equal(game.illegalReason({ x: 4, y: 4 }), IllegalReason.GAME_OVER);
  assert.throws(() => game.play({ x: 4, y: 4 }), IllegalMoveError);
  assert.equal(game.moveNumber, 0);
});

test('playMove passes on null and plays a stone otherwise', () => {
  const game = new Game(Mode.HUMAN_VS_HUMAN);
  game.playMove({ x: 4, y: 4 });
  game.playMove(null);
  assert.deepEqual(
    game.history.map((turn) => turn.move),
    [{ x: 4, y: 4 }, null],
  );
});
