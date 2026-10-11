import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BLACK, WHITE } from '@go-game/core/board.ts';
import { initialPosition } from '@go-game/core/rules.ts';
import { scoreBoard } from '@go-game/core/scoring.ts';
import { illegalMoveMessage, playerLabel, resultReason } from './format.ts';
import { ResultKind } from '@go-game/core/game.ts';
import { IllegalReason } from '@go-game/core/rules.ts';

const position = initialPosition();

test('result reasons name the loser or the margin', () => {
  const score = scoreBoard(position.board);
  assert.equal(resultReason({ kind: ResultKind.RESIGNATION, winner: BLACK, resigned: WHITE }, score), 'White resigned');
  assert.equal(
    resultReason({ kind: ResultKind.TIMEOUT, winner: WHITE, timedOut: BLACK }, score),
    'Black ran out of time',
  );
  assert.equal(
    resultReason({ kind: ResultKind.SCORE, winner: WHITE, score }, score),
    'Both players passed. Wins by 6.5 points with area scoring.',
  );
});

test('every illegal reason has wording', () => {
  assert.equal(illegalMoveMessage(IllegalReason.KO), 'Ko rule: you cannot retake right away');
  assert.equal(illegalMoveMessage(IllegalReason.SUICIDE), 'Suicide is not allowed');
  assert.equal(illegalMoveMessage(IllegalReason.GAME_OVER), 'The game is over');
});

test('a seat is labelled with the engine or the remote player; the person here is "You" unless two people share the keyboard', () => {
  const you = { engine: null, remote: null };
  const bear = { engine: 'Bear', remote: null };
  const bob = { engine: null, remote: 'Bob' };
  assert.equal(playerLabel('White', bear, you), 'Bear');
  assert.equal(playerLabel('Black', you, bear), 'You');
  assert.equal(playerLabel('White', bob, you), 'Bob');
  assert.equal(playerLabel('Black', you, bob), 'You');
  assert.equal(playerLabel('Black', you, you), 'Black');
  assert.equal(playerLabel('White', you, you), 'White');
});
