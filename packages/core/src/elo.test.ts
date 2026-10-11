import assert from 'node:assert/strict';
import { test } from 'vitest';
import { K, engineRating, expectedScore, ratingDelta } from './elo.ts';

test('equal players have even chances and move by half of K', () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.equal(ratingDelta(1000, 1000, true), K / 2);
  assert.equal(ratingDelta(1000, 1000, false), -K / 2);
});

test('an upset is worth more than an expected win', () => {
  assert.ok(ratingDelta(800, 1200, true) > ratingDelta(1200, 800, true));
  assert.ok(Math.abs(ratingDelta(0, 3000, false)) <= K);
});

test('harder opponents are rated higher', () => {
  assert.equal(engineRating(200), 900);
  assert.ok(engineRating(500) > engineRating(200));
  assert.ok(engineRating(1000) > engineRating(500));
});
