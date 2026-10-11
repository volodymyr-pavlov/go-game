import assert from 'node:assert/strict';
import { test } from 'vitest';
import { Choice, parseChoice } from './choice.ts';

test('only the two answers are choices, saved as numbers', () => {
  assert.equal(parseChoice('1'), Choice.GRANTED);
  assert.equal(parseChoice('2'), Choice.DENIED);
  assert.equal(parseChoice('yes'), null);
  assert.equal(parseChoice('3'), null);
  assert.equal(parseChoice(null), null);
});

test('an answer that was saved as a word, before flags, still counts', () => {
  assert.equal(parseChoice('granted'), Choice.GRANTED);
  assert.equal(parseChoice('denied'), Choice.DENIED);
});
