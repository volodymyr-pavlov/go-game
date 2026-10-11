import assert from 'node:assert/strict';
import { test } from 'vitest';
import { nicknameKey, normalizeNickname } from './nickname.ts';

test('a nickname is trimmed and inner whitespace collapsed', () => {
  assert.equal(normalizeNickname('  Go   Master '), 'Go Master');
});

test('too short or too long nicknames are rejected', () => {
  assert.equal(normalizeNickname(' a '), null);
  assert.equal(normalizeNickname('x'.repeat(25)), null);
  assert.equal(normalizeNickname('x'.repeat(24)), 'x'.repeat(24));
});

test('nicknames are claimed case-insensitively', () => {
  assert.equal(nicknameKey('Go Master'), 'go master');
});
