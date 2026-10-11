import { beforeEach, describe, expect, test } from 'vitest';
import { engineRating, ratingDelta } from '@go-game/core/elo.ts';
import { createApi, MIN_GAME_INTERVAL_MS } from './app.ts';
import { HttpError } from './http.ts';
import type { RoomGateway } from './rooms/gateway.ts';
import { PlayerDb } from './services/d1.ts';
import { createTestDb } from './testing/d1.ts';
import { ResultKind } from '@go-game/core/game.ts';

const START = 1_800_000_000_000;

let clock = START;
let api: (request: Request) => Promise<Response>;

/** Tokens are just the uid here. The real check is tested in auth.test.ts. */
const verify = async (token: string): Promise<string> => {
  if (!token.startsWith('uid-')) throw new Error('bad token');
  return token;
};

/** Rooms are tested with the Durable Objects on a real Worker. Here they only have to be reached, by the right player. */
class FakeRooms implements RoomGateway {
  public readonly calls: string[] = [];
  public async create(hostUid: string, hostName: string): Promise<string> {
    this.calls.push(`create ${hostUid} ${hostName}`);
    return 'room1';
  }
  public async listOpen(): Promise<{ id: string; hostUid: string; hostName: string; createdAt: number }[]> {
    return [{ id: 'room1', hostUid: 'uid-hana', hostName: 'Hana', createdAt: START }];
  }
  public async join(roomId: string, uid: string, name: string): Promise<void> {
    if (roomId === 'taken') throw new HttpError(409, 'That room is no longer open');
    this.calls.push(`join ${roomId} ${uid} ${name}`);
  }
  public async cancel(roomId: string, uid: string): Promise<void> {
    this.calls.push(`cancel ${roomId} ${uid}`);
  }
  public async connect(roomId: string, uid: string): Promise<Response> {
    this.calls.push(`connect ${roomId} ${uid}`);
    return new Response('connected');
  }
}

let rooms: FakeRooms;
let allowed: boolean;
let passesCheck: boolean;
const limitedKeys: string[] = [];

beforeEach(() => {
  clock = START;
  rooms = new FakeRooms();
  allowed = true;
  passesCheck = true;
  limitedKeys.length = 0;
  api = createApi({
    players: new PlayerDb(createTestDb()),
    rooms,
    verify,
    now: () => clock,
    limiter: async (key) => {
      limitedKeys.push(key);
      return allowed;
    },
    challenge: async () => passesCheck,
  });
});

function call(method: string, path: string, options: { as?: string; body?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.as) headers.Authorization = `Bearer ${options.as}`;
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  return api(new Request(`https://game.test${path}`, { method, headers, body }));
}

async function claim(uid: string, nickname: string): Promise<Response> {
  return call('PUT', '/api/me/nickname', { as: uid, body: { nickname } });
}

const engineGame = { playouts: 200, won: true, kind: ResultKind.SCORE };

describe('nicknames', () => {
  test('a new player gets a nickname and the starting rating', async () => {
    const response = await claim('uid-ann', '  Ann   Lee ');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'Ann Lee', rating: 1000, wins: 0, losses: 0 });
  });

  test('a nickname that is too short or not a string is refused', async () => {
    expect((await claim('uid-ann', 'A')).status).toBe(400);
    expect((await call('PUT', '/api/me/nickname', { as: 'uid-ann', body: { nickname: 7 } })).status).toBe(400);
    expect((await call('PUT', '/api/me/nickname', { as: 'uid-ann', body: [] })).status).toBe(400);
  });

  test('a taken nickname is refused whatever the case, and the loser keeps having none', async () => {
    await claim('uid-ann', 'Ann');
    const second = await claim('uid-bo', 'ANN');
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: 'That nickname is taken' });
    expect((await call('GET', '/api/players/uid-bo')).status).toBe(404);
  });

  test('a player can change the nickname, and the old one is free again', async () => {
    await claim('uid-ann', 'Ann');
    expect((await claim('uid-ann', 'Anna')).status).toBe(200);
    expect((await claim('uid-bo', 'Ann')).status).toBe(200);
  });

  test('keeping the same nickname is not a conflict, and the rating stays', async () => {
    await claim('uid-ann', 'Ann');
    await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame });
    const again = await claim('uid-ann', 'ann');
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ name: 'ann', wins: 1 });
  });
});

describe('sign-in', () => {
  test('a request with no token or a bad token is refused', async () => {
    expect((await call('PUT', '/api/me/nickname', { body: { nickname: 'Ann' } })).status).toBe(401);
    expect((await claim('stranger', 'Ann')).status).toBe(401);
  });
});

describe('saving a game', () => {
  test('the server works out the rating from its own record', async () => {
    await claim('uid-ann', 'Ann');
    const response = await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame });
    const expected = 1000 + ratingDelta(1000, engineRating(200), true);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ratingBefore: 1000, ratingAfter: expected });
    expect(await (await call('GET', '/api/players/uid-ann')).json()).toEqual({
      name: 'Ann',
      rating: expected,
      wins: 1,
      losses: 0,
    });
  });

  test('a loss counts as a loss', async () => {
    await claim('uid-ann', 'Ann');
    await call('POST', '/api/me/games', {
      as: 'uid-ann',
      body: { ...engineGame, won: false, kind: ResultKind.RESIGNATION },
    });
    expect(await (await call('GET', '/api/players/uid-ann')).json()).toMatchObject({ wins: 0, losses: 1 });
  });

  test('a player without a nickname has nothing to save to', async () => {
    expect((await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame })).status).toBe(409);
  });

  test('a second result too soon is refused, and one after the wait is saved', async () => {
    await claim('uid-ann', 'Ann');
    await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame });
    clock += MIN_GAME_INTERVAL_MS - 1;
    expect((await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame })).status).toBe(429);
    clock += 1;
    expect((await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame })).status).toBe(201);
  });

  test('a result that a browser could not honestly send is refused', async () => {
    await claim('uid-ann', 'Ann');
    const bad = [
      { ...engineGame, playouts: 999_999 },
      { ...engineGame, won: 'yes' },
      { ...engineGame, kind: ResultKind.TIMEOUT },
      { ...engineGame, kind: 3 },
      { ...engineGame, kind: 'score' },
    ];
    for (const body of bad) expect((await call('POST', '/api/me/games', { as: 'uid-ann', body })).status).toBe(400);
  });
});

describe('reading', () => {
  test('the leaderboard is public and ordered by rating, then wins', async () => {
    for (const [uid, name] of [
      ['uid-a', 'Ann'],
      ['uid-b', 'Bo'],
      ['uid-c', 'Cy'],
    ])
      await claim(uid, name);
    await call('POST', '/api/me/games', { as: 'uid-b', body: engineGame });
    const body = (await (await call('GET', '/api/leaderboard')).json()) as { players: { name: string }[] };
    expect(body.players.map((player) => player.name)).toEqual(['Bo', 'Ann', 'Cy']);
  });

  test('a player has games only the player can read, newest first', async () => {
    await claim('uid-ann', 'Ann');
    await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame });
    clock += MIN_GAME_INTERVAL_MS;
    await call('POST', '/api/me/games', { as: 'uid-ann', body: { ...engineGame, won: false } });

    expect((await call('GET', '/api/players/uid-ann/games')).status).toBe(401);
    expect((await call('GET', '/api/players/uid-ann/games', { as: 'uid-bo' })).status).toBe(403);
    const { games } = (await (await call('GET', '/api/players/uid-ann/games', { as: 'uid-ann' })).json()) as {
      games: { won: boolean; opponentName: string; finishedAt: number }[];
    };
    expect(games.map((game) => game.won)).toEqual([false, true]);
    expect(games[0]).toMatchObject({ opponentName: 'Gopher', finishedAt: clock });
  });
});

describe('deleting', () => {
  test('a player is removed with their nickname and games, and the nickname is free', async () => {
    await claim('uid-ann', 'Ann');
    await call('POST', '/api/me/games', { as: 'uid-ann', body: engineGame });
    expect((await call('DELETE', '/api/me', { as: 'uid-ann' })).status).toBe(204);
    expect((await call('GET', '/api/players/uid-ann')).status).toBe(404);
    expect((await claim('uid-bo', 'Ann')).status).toBe(200);
  });
});

describe('the router', () => {
  test('an unknown path is 404 and a wrong method is 405', async () => {
    expect((await call('GET', '/api/nothing')).status).toBe(404);
    expect((await call('POST', '/api/leaderboard')).status).toBe(405);
  });
});

describe('rooms', () => {
  test('every room route needs a sign-in', async () => {
    expect((await call('GET', '/api/rooms')).status).toBe(401);
    expect((await call('POST', '/api/rooms')).status).toBe(401);
    expect((await call('POST', '/api/rooms/room1/join')).status).toBe(401);
    expect((await call('DELETE', '/api/rooms/room1')).status).toBe(401);
  });

  test('a player opens a room under their nickname, or Guest without one', async () => {
    await claim('uid-ann', 'Ann');
    const response = await call('POST', '/api/rooms', { as: 'uid-ann' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'room1' });
    await call('POST', '/api/rooms', { as: 'uid-bo' });
    expect(rooms.calls).toEqual(['create uid-ann Ann', 'create uid-bo Guest']);
  });

  test('the lobby lists the open rooms', async () => {
    const response = await call('GET', '/api/rooms', { as: 'uid-ann' });
    expect(await response.json()).toEqual({
      rooms: [{ id: 'room1', hostUid: 'uid-hana', hostName: 'Hana', createdAt: START }],
    });
  });

  test('joining and cancelling reach the room, and a refusal comes back as it is', async () => {
    await claim('uid-bo', 'Bo');
    expect((await call('POST', '/api/rooms/room1/join', { as: 'uid-bo' })).status).toBe(204);
    expect((await call('DELETE', '/api/rooms/room1', { as: 'uid-bo' })).status).toBe(204);
    const refused = await call('POST', '/api/rooms/taken/join', { as: 'uid-bo' });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: 'That room is no longer open' });
    expect(rooms.calls).toEqual(['join room1 uid-bo Bo', 'cancel room1 uid-bo']);
  });

  test('a socket is for WebSocket requests only, and the token comes after the go-game protocol', async () => {
    expect((await call('GET', '/api/rooms/room1/socket', { as: 'uid-ann' })).status).toBe(426);

    const headers = { Upgrade: 'websocket', 'Sec-WebSocket-Protocol': 'go-game, uid-ann' };
    const socket = await api(new Request('https://game.test/api/rooms/room1/socket', { headers }));
    expect(await socket.text()).toBe('connected');
    expect(rooms.calls).toEqual(['connect room1 uid-ann']);

    const noToken = { Upgrade: 'websocket', 'Sec-WebSocket-Protocol': 'go-game' };
    expect((await api(new Request('https://game.test/api/rooms/room1/socket', { headers: noToken }))).status).toBe(401);
  });
});

describe('writes a script could repeat', () => {
  test('are limited for each player and each kind of write', async () => {
    await claim('uid-ann', 'Ann');
    await call('POST', '/api/rooms', { as: 'uid-ann' });
    await call('POST', '/api/rooms/room1/join', { as: 'uid-ann' });
    expect(limitedKeys).toEqual(['nickname:uid-ann', 'create:uid-ann', 'join:uid-ann']);
  });

  test('are refused with 429 when the player is over the limit, and nothing is done', async () => {
    allowed = false;
    expect((await claim('uid-ann', 'Ann')).status).toBe(429);
    expect((await call('POST', '/api/rooms', { as: 'uid-ann' })).status).toBe(429);
    expect((await call('POST', '/api/rooms/room1/join', { as: 'uid-ann' })).status).toBe(429);
    expect(rooms.calls).toEqual([]);
    allowed = true;
    expect((await call('GET', '/api/players/uid-ann')).status).toBe(404);
  });

  test('are refused with 403 when the Turnstile check does not pass, and nothing is done', async () => {
    passesCheck = false;
    expect((await claim('uid-ann', 'Ann')).status).toBe(403);
    expect((await call('POST', '/api/rooms', { as: 'uid-ann' })).status).toBe(403);
    expect((await call('POST', '/api/rooms/room1/join', { as: 'uid-ann' })).status).toBe(403);
    expect(rooms.calls).toEqual([]);
    expect((await call('GET', '/api/players/uid-ann')).status).toBe(404);
  });

  test('do not use up the limit of a caller who is not signed in', async () => {
    expect((await call('POST', '/api/rooms')).status).toBe(401);
    expect(limitedKeys).toEqual([]);
  });
});

describe('sign-in from Telegram', () => {
  test('a Mini App signs in with tma and its initData, and is a player of its own', async () => {
    const telegram = async (initData: string): Promise<string> => {
      if (initData !== 'good-init-data') throw new Error('not genuine');
      return 'tg:42';
    };
    const withTelegram = createApi({
      players: new PlayerDb(createTestDb()),
      rooms,
      verify,
      telegram,
      now: () => clock,
      limiter: async () => true,
      challenge: async () => true,
    });
    const put = (auth: string) =>
      withTelegram(
        new Request('https://game.test/api/me/nickname', {
          method: 'PUT',
          headers: { Authorization: auth },
          body: JSON.stringify({ nickname: 'Tele' }),
        }),
      );
    expect((await put('tma good-init-data')).status).toBe(200);
    expect((await put('tma forged')).status).toBe(401);
    expect(await (await withTelegram(new Request('https://game.test/api/players/tg:42'))).json()).toMatchObject({
      name: 'Tele',
    });
  });

  test('a server with no bot refuses tma', async () => {
    expect((await call('PUT', '/api/me/nickname', { as: 'x', body: { nickname: 'Tele' } })).status).toBe(401);
    const response = await api(
      new Request('https://game.test/api/me/nickname', { method: 'PUT', headers: { Authorization: 'tma anything' } }),
    );
    expect(response.status).toBe(401);
  });
});

describe('Telegram Stars', () => {
  test('are not on sale yet: the routes refuse with 501', async () => {
    expect((await call('POST', '/api/stars/invoice', { as: 'uid-ann' })).status).toBe(501);
    expect((await call('POST', '/api/stars/webhook')).status).toBe(501);
    expect((await call('POST', '/api/stars/invoice')).status).toBe(401);
  });
});
