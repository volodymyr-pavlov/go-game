// @vitest-environment happy-dom
import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { ProfilePage } from '../ProfilePage.ts';
import { settled } from '@go-game/core/testing/timers.ts';
import { button, fakeContext, text } from './fakes.ts';
import { ResultKind } from '@go-game/core/game.ts';

afterEach(() => vi.unstubAllGlobals());

test('a signed-out visitor is pointed at the start page', () => {
  const { element } = ProfilePage(fakeContext());
  assert.ok(text(element, 'hint').includes('Sign in'));
});

test('the profile shows the record, the history and a chart of the rating', async () => {
  const context = fakeContext();
  context.session.emit({ uid: 'a', nickname: 'Alice', isGuest: true, email: null });
  context.leaderboard.players.set('a', { name: 'Alice', rating: 1032, wins: 2, losses: 1 });
  context.leaderboard.games = [
    {
      id: '3',
      opponentName: 'Bob',
      won: true,
      kind: ResultKind.RESIGNATION,
      ratingBefore: 1016,
      ratingAfter: 1032,
      finishedAt: null,
    },
    {
      id: '2',
      opponentName: 'Gopher',
      won: false,
      kind: ResultKind.SCORE,
      ratingBefore: 1030,
      ratingAfter: 1016,
      finishedAt: null,
    },
    {
      id: '1',
      opponentName: 'Bear',
      won: true,
      kind: ResultKind.SCORE,
      ratingBefore: 1000,
      ratingAfter: 1030,
      finishedAt: null,
    },
  ];
  const { element } = ProfilePage(context);
  await settled();
  assert.equal(text(element, 'name'), 'Alice');
  assert.equal(text(element, 'record'), 'Rating 1032 · 2 wins / 1 losses');
  const rows = element.querySelectorAll('[data-ref="games"] li');
  assert.equal(rows.length, 3);
  assert.ok(rows[0].textContent?.includes('Won vs Bob by resignation'));
  assert.ok(rows[0].textContent?.includes('+16 → 1032'));
  const chart = element.querySelector('[data-ref="chart"] svg');
  assert.ok(chart !== null);
  assert.equal(chart?.querySelector('polyline')?.getAttribute('points')?.split(' ').length, 3);
});

test('deleting the entry asks first, and nothing happens when the player declines', async () => {
  const context = fakeContext();
  context.session.emit({ uid: 'a', nickname: 'Alice', isGuest: true, email: null });
  const { element } = ProfilePage(context);
  vi.stubGlobal('confirm', () => false);
  button(element, 'delete').click();
  await settled();
  assert.equal(context.session.deletions, 0);
  assert.deepEqual(context.visited, []);
});

test('a confirmed deletion signs the player out and goes to the start page', async () => {
  const context = fakeContext();
  context.session.emit({ uid: 'a', nickname: 'Alice', isGuest: true, email: null });
  const { element } = ProfilePage(context);
  vi.stubGlobal('confirm', () => true);
  button(element, 'delete').click();
  await settled();
  assert.equal(context.session.deletions, 1);
  assert.equal(context.user, null);
  assert.deepEqual(context.visited, ['/']);
});

test('a failed deletion is shown and the button works again', async () => {
  const context = fakeContext();
  context.session.emit({ uid: 'a', nickname: 'Alice', isGuest: true, email: null });
  context.session.failWith = 'No network';
  const { element } = ProfilePage(context);
  vi.stubGlobal('confirm', () => true);
  button(element, 'delete').click();
  await settled();
  assert.equal(text(element, 'hint'), 'No network');
  assert.equal(button(element, 'delete').disabled, false);
});
