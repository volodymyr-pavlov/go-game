import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BLACK } from './board.ts';
import { scoreBoard } from './scoring.ts';
import { boardFrom } from './testing/diagram.ts';

test('area scoring counts stones, surrounded territory and komi', () => {
  const score = scoreBoard(boardFrom(['..X.O', '..X.O', '..X.O', '..X.O', '..XO.']));
  assert.equal(score.black.stones, 5);
  assert.equal(score.black.territory, 10);
  assert.equal(score.white.stones, 5);
  assert.equal(score.white.territory, 1);
  assert.equal(score.white.total, 12.5);
  assert.equal(score.winner, BLACK);
});

test('an empty region touching both colours is nobody’s territory', () => {
  const score = scoreBoard(boardFrom(['X....', '.....', '.....', '.....', '....O']));
  assert.equal(score.black.territory, 0);
  assert.equal(score.white.territory, 0);
});
