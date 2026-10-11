import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';
import { ApiClient } from '../client.ts';
import type { RoomView } from '../room.ts';
import { RECONNECT_MS, type SocketFactory } from '../roomSocket.ts';
import { ServerGameSync } from '../rooms.ts';
import { BLACK, WHITE } from '@go-game/core/board.ts';
import { RemoteEventType, type RemoteEvent } from '@go-game/core/ports.ts';
import { ClientMessageType, RoomStatus, ServerMessageType } from '@go-game/types/protocol.ts';
import type { User } from '@go-game/core/user.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const hana: User = { uid: 'hana', nickname: 'Hana', isGuest: true, email: null };
const gus: User = { uid: 'gus', nickname: 'Gus', isGuest: true, email: null };

class FakeSocket {
  public readyState = 1;
  public sent: unknown[] = [];
  public closedWith: number | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onclose: ((event: { code: number }) => void) | null = null;
  public readonly path: string;
  public readonly protocols: string[];

  constructor(path: string, protocols: string[]) {
    this.path = path;
    this.protocols = protocols;
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }
  close(code: number): void {
    this.closedWith = code;
  }
  /** The server says something. */
  hear(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  /** The server drops the connection. */
  drop(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function view(over: Partial<RoomView> = {}): RoomView {
  return {
    host: 'hana',
    hostName: 'Hana',
    guest: 'gus',
    guestName: 'Gus',
    status: RoomStatus.PLAYING,
    createdAt: 1,
    moves: [],
    resignedBy: null,
    timedOutBy: null,
    turnStartedAt: 1,
    ...over,
  };
}

function setup() {
  const sockets: FakeSocket[] = [];
  const factory: SocketFactory = (path, protocols) => {
    const socket = new FakeSocket(path, protocols);
    sockets.push(socket);
    return socket as unknown as WebSocket;
  };
  const calls: string[] = [];
  const fetcher = (async (path: string, init: RequestInit) => {
    calls.push(`${init.method} ${path}`);
    if (path === '/api/rooms' && init.method === 'POST') return new Response('{"id":"r1"}', { status: 201 });
    if (path === '/api/rooms')
      return new Response(JSON.stringify({ rooms: [{ id: 'r1', hostUid: 'hana', hostName: 'Hana', createdAt: 5 }] }));
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const sync = new ServerGameSync(new ApiClient(async () => 'tok', fetcher), factory);
  return { sync, sockets, calls };
}

/** The connection is made after the token arrives, so the test lets that happen first. */
async function connected(sockets: FakeSocket[]): Promise<FakeSocket> {
  await vi.advanceTimersByTimeAsync(0);
  return sockets.at(-1)!;
}

test('a room is opened, joined, listed and closed through the game server', async () => {
  const { sync, calls } = setup();
  assert.equal(await sync.createRoom(hana), 'r1');
  await sync.joinRoom('r1', gus);
  await sync.closeRoom('r1', hana);
  const seen: string[] = [];
  const stop = sync.followOpenRooms(
    (rooms) => seen.push(...rooms.map((room) => `${room.id} ${room.host} ${room.status}`)),
    () => undefined,
  );
  await vi.advanceTimersByTimeAsync(0);
  stop();
  assert.deepEqual(calls, ['POST /api/rooms', 'POST /api/rooms/r1/join', 'DELETE /api/rooms/r1', 'GET /api/rooms']);
  assert.deepEqual(seen, [`r1 hana ${RoomStatus.OPEN}`]);
});

test('a match starts from the first state of the room, and each player sits in their colour', async () => {
  const { sync, sockets } = setup();
  const opening = sync.openMatch('r1', gus);
  const socket = await connected(sockets);
  assert.equal(socket.path, '/api/rooms/r1/socket');
  assert.deepEqual(socket.protocols, ['go-game', 'tok']);
  socket.hear({ type: ServerMessageType.ROOM, room: view() });
  const match = await opening;
  assert.equal(match.seat, WHITE);
  assert.deepEqual(match.opponent, { uid: 'hana', name: 'Hana' });
});

test('a player who is not in the room, or a room nobody joined, cannot start a match', async () => {
  const stranger = setup();
  const first = stranger.sync.openMatch('r1', { ...gus, uid: 'eve' });
  (await connected(stranger.sockets)).hear({ type: ServerMessageType.ROOM, room: view() });
  await assert.rejects(first, /not in this room/);

  const empty = setup();
  const second = empty.sync.openMatch('r1', hana);
  (await connected(empty.sockets)).hear({
    type: ServerMessageType.ROOM,
    room: view({ guest: null, guestName: null, status: RoomStatus.OPEN }),
  });
  await assert.rejects(second, /Nobody has joined/);
  assert.equal(empty.sockets[0]!.closedWith, 1000);
});

test('a move is sent, and it is done when the room shows it, or refused when the server says so', async () => {
  const { sync, sockets } = setup();
  const opening = sync.openMatch('r1', hana);
  const socket = await connected(sockets);
  socket.hear({ type: ServerMessageType.ROOM, room: view() });
  const match = await opening;

  const accepted = match.sendMove(0, { x: 4, y: 4 });
  assert.deepEqual(socket.sent, [{ type: ClientMessageType.MOVE, index: 0, move: { x: 4, y: 4 } }]);
  socket.hear({
    type: ServerMessageType.ROOM,
    room: view({ moves: [{ index: 0, by: 'hana', move: { x: 4, y: 4 } }] }),
  });
  await accepted;

  const refused = match.sendMove(1, null);
  socket.hear({ type: ServerMessageType.ERROR, message: 'It is not your turn' });
  await assert.rejects(refused, /not your turn/);
});

test('the listener hears every move and a resignation, with the colour of the one who resigned', async () => {
  const { sync, sockets } = setup();
  const opening = sync.openMatch('r1', hana);
  const socket = await connected(sockets);
  socket.hear({ type: ServerMessageType.ROOM, room: view() });
  const match = await opening;
  const events: RemoteEvent[] = [];
  match.subscribe(
    (event) => events.push(event),
    () => undefined,
  );
  socket.hear({
    type: ServerMessageType.ROOM,
    room: view({ moves: [{ index: 0, by: 'hana', move: null }], resignedBy: 'gus', status: RoomStatus.FINISHED }),
  });
  assert.deepEqual(events, [
    { type: RemoteEventType.MOVE, index: 0, move: null },
    { type: RemoteEventType.RESIGN, by: WHITE },
  ]);
});

test('stopping the subscription closes the connection', async () => {
  const { sync, sockets } = setup();
  const opening = sync.openMatch('r1', hana);
  const socket = await connected(sockets);
  socket.hear({ type: ServerMessageType.ROOM, room: view() });
  const stop = (await opening).subscribe(
    () => undefined,
    () => undefined,
  );
  stop();
  assert.equal(socket.closedWith, 1000);
});

test('a dropped connection is made again and the listener is told', async () => {
  const { sync, sockets } = setup();
  const opening = sync.openMatch('r1', hana);
  const first = await connected(sockets);
  first.hear({ type: ServerMessageType.ROOM, room: view() });
  const troubles: string[] = [];
  (await opening).subscribe(
    () => undefined,
    (message) => troubles.push(message),
  );

  first.drop(1006);
  assert.equal(troubles.length, 1);
  await vi.advanceTimersByTimeAsync(RECONNECT_MS);
  assert.equal(sockets.length, 2);
});

test('a room that the server closed tells the host who waits, and does not connect again', async () => {
  const { sync, sockets } = setup();
  const seen: (RoomStatus | null)[] = [];
  sync.followRoom(
    'r1',
    (room) => seen.push(room?.status ?? null),
    () => undefined,
  );
  const socket = await connected(sockets);
  socket.hear({ type: ServerMessageType.ROOM, room: view({ guest: null, guestName: null, status: RoomStatus.OPEN }) });
  socket.hear({ type: ServerMessageType.ROOM, room: view() });
  socket.drop(1000);
  await vi.advanceTimersByTimeAsync(RECONNECT_MS * 3);
  assert.deepEqual(seen, [RoomStatus.OPEN, RoomStatus.PLAYING, null]);
  assert.equal(sockets.length, 1);
});

test('a game lost on time is heard as a timeout of the colour that did not move', async () => {
  const { sync, sockets } = setup();
  const opening = sync.openMatch('r1', hana);
  const socket = await connected(sockets);
  socket.hear({ type: ServerMessageType.ROOM, room: view() });
  const match = await opening;
  const events: RemoteEvent[] = [];
  match.subscribe(
    (event) => events.push(event),
    () => undefined,
  );
  socket.hear({ type: ServerMessageType.ROOM, room: view({ status: RoomStatus.FINISHED, timedOutBy: 'hana' }) });
  assert.deepEqual(events, [{ type: RemoteEventType.TIMEOUT, by: BLACK }]);
});
