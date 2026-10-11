import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { ApiClient } from '../client.ts';
import { ApiPlayers, PLAYER_REFRESH_MS } from '../players.ts';
import { ServerLeaderboard } from '../leaderboard.ts';
import type { Session } from '@go-game/core/session.ts';
import type { User } from '@go-game/core/user.ts';
import { ResultKind } from '@go-game/core/game.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function players(answer: (path: string, method: string, body: string | undefined) => Response) {
  const calls: string[] = [];
  const fetcher = (async (path: string, init: RequestInit) => {
    calls.push(`${init.method} ${path}${init.body ? ` ${init.body}` : ''}`);
    return answer(path, init.method ?? 'GET', init.body as string | undefined);
  }) as typeof fetch;
  return { repository: new ApiPlayers(new ApiClient(async () => 'tok', fetcher)), calls };
}

test('a player that has no entry is null', async () => {
  const { repository } = players(() => json({ error: 'No such player' }, 404));
  assert.equal(await repository.player('u1'), null);
});

test('the games of a player come with a date and a text id', async () => {
  const { repository, calls } = players(() =>
    json({
      games: [
        {
          id: 7,
          opponentName: 'Gopher',
          won: true,
          kind: ResultKind.SCORE,
          ratingBefore: 1000,
          ratingAfter: 1016,
          finishedAt: 5000,
        },
      ],
    }),
  );
  const [game] = await repository.history('u1');
  assert.deepEqual(calls, ['GET /api/players/u1/games']);
  assert.equal(game!.id, '7');
  assert.equal(game!.finishedAt?.getTime(), 5000);
});

test('a nickname, a game and a deletion go to the routes of the signed-in player', async () => {
  const { repository, calls } = players(() => new Response(null, { status: 204 }));
  await repository.claimNickname('Ann');
  await repository.saveGame({ playouts: 200, won: true, kind: ResultKind.SCORE });
  await repository.deletePlayer();
  assert.deepEqual(calls, [
    'PUT /api/me/nickname {"nickname":"Ann"}',
    'POST /api/me/games {"playouts":200,"won":true,"kind":1}',
    'DELETE /api/me',
  ]);
});

test('following a player loads at once and again on a timer, until stopped', async () => {
  let rating = 1000;
  const { repository } = players(() => json({ name: 'Ann', rating, wins: 0, losses: 0 }));
  const seen: (number | null)[] = [];
  const stop = repository.followPlayer(
    'u1',
    (player) => seen.push(player?.rating ?? null),
    () => undefined,
  );
  await vi.advanceTimersByTimeAsync(0);
  rating = 1016;
  await vi.advanceTimersByTimeAsync(PLAYER_REFRESH_MS);
  stop();
  await vi.advanceTimersByTimeAsync(PLAYER_REFRESH_MS * 2);
  assert.deepEqual(seen, [1000, 1016]);
});

test('a failed load is reported and the following goes on', async () => {
  let fail = true;
  const { repository } = players(() =>
    fail ? json({ error: 'Down' }, 500) : json({ name: 'Ann', rating: 1000, wins: 0, losses: 0 }),
  );
  const errors: string[] = [];
  const seen: string[] = [];
  const stop = repository.followPlayer(
    'u1',
    (player) => seen.push(player!.name),
    (message) => errors.push(message),
  );
  await vi.advanceTimersByTimeAsync(0);
  fail = false;
  await vi.advanceTimersByTimeAsync(PLAYER_REFRESH_MS);
  stop();
  assert.deepEqual(errors, ['Down']);
  assert.deepEqual(seen, ['Ann']);
});

function leaderboard(user: User | null) {
  const { repository, calls } = players(() => new Response(null, { status: 204 }));
  const session = { onUser: (listener: (user: User | null) => void) => listener(user) } as unknown as Session;
  const board = new ServerLeaderboard(repository, session);
  const errors: string[] = [];
  board.reportErrorsTo((message) => errors.push(message));
  return { board, calls, errors };
}

const nick: User = { uid: 'u1', nickname: 'Ann', isGuest: true, email: null };

test('a game against the engine is sent by a player with a nickname', async () => {
  const { board, calls } = leaderboard(nick);
  board.record({ won: true, kind: ResultKind.SCORE, playouts: 500, opponent: null });
  await vi.advanceTimersByTimeAsync(0);
  assert.deepEqual(calls, ['POST /api/me/games {"playouts":500,"won":true,"kind":1}']);
});

test('nothing is sent for a player without a nickname, or for an online game', async () => {
  const noName = leaderboard({ ...nick, nickname: null });
  noName.board.record({ won: true, kind: ResultKind.SCORE, playouts: 500, opponent: null });
  const online = leaderboard(nick);
  online.board.record({ won: true, kind: ResultKind.SCORE, playouts: null, opponent: { uid: 'u2', name: 'Bo' } });
  await vi.advanceTimersByTimeAsync(0);
  assert.deepEqual([...noName.calls, ...online.calls], []);
});
