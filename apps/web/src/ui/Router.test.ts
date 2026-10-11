import assert from 'node:assert/strict';
import { test } from 'vitest';
import { matchSegments } from './Router.ts';

test('a pattern matches its own segments and captures params', () => {
  assert.deepEqual(matchSegments(['game', ':room'], ['game', 'abc']), { room: 'abc' });
  assert.deepEqual(matchSegments([], []), {});
});

test('length and literal segments must agree', () => {
  assert.equal(matchSegments(['game', ':room'], ['game']), null);
  assert.equal(matchSegments(['lobby'], ['game']), null);
});
