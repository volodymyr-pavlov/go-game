import assert from 'node:assert/strict';
import { test } from 'vitest';
import { DEFAULT_OPPONENT, OPPONENTS, opponentFor, opponentName } from './opponents.ts';

test('the opponents have distinct names and playout counts, and the default is the weakest', () => {
  assert.equal(new Set(OPPONENTS.map((o) => o.name)).size, OPPONENTS.length);
  assert.equal(new Set(OPPONENTS.map((o) => o.playouts)).size, OPPONENTS.length);
  assert.equal(DEFAULT_OPPONENT, OPPONENTS[0]);
  assert.ok(OPPONENTS.every((o, i) => i === 0 || o.playouts > OPPONENTS[i - 1].playouts));
});

test('opponents are found by playout count, with a generic name for unknown counts', () => {
  assert.equal(opponentFor(500)?.name, 'Bear');
  assert.equal(opponentFor(7), null);
  assert.equal(opponentName(1000), 'Elephant');
  assert.equal(opponentName(null), 'Engine');
});
