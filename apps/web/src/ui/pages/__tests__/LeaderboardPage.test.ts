// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { LeaderboardPage } from '../LeaderboardPage.ts';
import { fakeContext, fakeContextWithoutFirebase, text } from './fakes.ts';

const players = [
  { uid: 'a', name: 'Alice', rating: 1210, wins: 9, losses: 2 },
  { uid: 'b', name: 'Bob', rating: 1000, wins: 1, losses: 1 },
];

test('players are listed by the order given, with rank, rating and record', () => {
  const context = fakeContext();
  context.leaderboard.top = players;
  const { element } = LeaderboardPage(context);
  const rows = [...element.querySelectorAll('[data-ref="list"] li')].slice(1);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    [...rows[0].children].map((cell) => cell.textContent),
    ['1', 'Alice', '1210', '9 / 2'],
  );
  assert.equal(text(element, 'hint'), '');
});

test('the visitor’s own row is marked', () => {
  const context = fakeContext();
  context.leaderboard.top = players;
  context.session.emit({ uid: 'b', nickname: 'Bob', isGuest: true, email: null });
  const { element } = LeaderboardPage(context);
  const rows = [...element.querySelectorAll('[data-ref="list"] li')].slice(1);
  assert.ok(rows[1].className.includes('highlight'));
  assert.ok(!rows[0].className.includes('amber'));
});

test('an empty board shows a placeholder, and live updates replace it', () => {
  const context = fakeContext();
  const page = LeaderboardPage(context);
  assert.ok(page.element.textContent?.includes('No games saved yet'));
  context.leaderboard.topListener?.(players);
  assert.equal(page.element.querySelectorAll('[data-ref="list"] li').length, 3);
  page.dispose?.();
  assert.equal(context.leaderboard.unsubscribed, 1);
});

test('without Firebase the page says so', () => {
  const { element } = LeaderboardPage(fakeContextWithoutFirebase());
  assert.equal(text(element, 'hint'), 'This site has no leaderboard.');
});
