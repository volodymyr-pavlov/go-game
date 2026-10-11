import { DurableObject } from 'cloudflare:workers';
import type { Move } from '@go-game/core/rules.ts';
import type { Env } from '../env.ts';
import { ClientMessageType, RoomStatus, ServerMessageType } from '@go-game/types/protocol.ts';
import { PLAYER_HEADER, SOCKET_PROTOCOL } from './protocol.ts';
import { OnlineGame, RoomError, TURN_TIMEOUT_MS, type RoomRecord } from './onlineGame.ts';
import { PlayerDb } from '../services/d1.ts';
import { OPEN_ROOM_MAX_AGE_MS, RoomDb } from '../services/d1.ts';
import { recordOnlineGame } from './results.ts';

const RECORD = 'room';
const ID = 'id';
const RECORDED = 'recorded';
/** A player who sends more messages than this in `FLOOD_WINDOW_MS` is disconnected. A game needs one message every few seconds. */
const FLOOD_LIMIT = 30;
const FLOOD_WINDOW_MS = 10_000;
const POLICY_VIOLATION = 1008;

/** Answers of the methods a Worker calls. An error crosses the call as text, because its class does not. */
export type Outcome = { ok: true } | { ok: false; message: string };

type ClientMessage =
  { type: typeof ClientMessageType.MOVE; index: number; move: Move } | { type: typeof ClientMessageType.RESIGN };

/** One online game. It keeps the moves, checks them, tells both players, and saves the result when the game ends. */
export class RoomDo extends DurableObject<Env> {
  private _game: OnlineGame | null = null;
  /** The id the players know the room by. The Durable Object's own id is a different string. */
  private _roomId = '';
  private readonly _turnTimeoutMs: number;
  /** When each connection sent its latest messages. It starts empty again after the object has slept, which is harmless. */
  private readonly _recent = new WeakMap<WebSocket, number[]>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this._turnTimeoutMs = Number(env.TURN_TIMEOUT_MS) || TURN_TIMEOUT_MS;
    void ctx.blockConcurrencyWhile(async () => {
      const record = await ctx.storage.get<RoomRecord>(RECORD);
      if (record !== undefined) this._game = new OnlineGame(record, this._turnTimeoutMs);
      this._roomId = (await ctx.storage.get<string>(ID)) ?? '';
    });
  }

  public async open(roomId: string, uid: string, name: string, now: number): Promise<Outcome> {
    if (this._game !== null) return { ok: false, message: 'That room already exists' };
    this._roomId = roomId;
    await this.ctx.storage.put(ID, roomId);
    await this._save(OnlineGame.open(uid, name, now, this._turnTimeoutMs));
    return { ok: true };
  }

  public async join(uid: string, name: string): Promise<Outcome> {
    const game = this._game;
    if (game === null) return { ok: false, message: 'That room does not exist' };
    return this._try(async () => {
      game.join(uid, name, Date.now());
      await new RoomDb(this.env.DB).remove(this._roomId);
      await this._save(game);
    });
  }

  /** The host takes back a room nobody has joined. A room that is already gone counts as taken back. */
  public async cancel(uid: string): Promise<Outcome> {
    const game = this._game;
    if (game === null) return { ok: true };
    if (game.status !== RoomStatus.OPEN || game.record.host !== uid)
      return { ok: false, message: 'Only the host can cancel a room that is still open' };
    await this._discard();
    return { ok: true };
  }

  /** A player connects. The Worker has checked the token and put the uid in the header. */
  public override async fetch(request: Request): Promise<Response> {
    const uid = request.headers.get(PLAYER_HEADER);
    const game = this._game;
    if (uid === null || game === null) return new Response('No such room', { status: 404 });
    try {
      game.stoneOf(uid);
    } catch {
      return new Response('You are not in this room', { status: 403 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [uid]);
    server.send(JSON.stringify({ type: ServerMessageType.ROOM, room: game.view }));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': SOCKET_PROTOCOL },
    });
  }

  public override async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const [uid] = this.ctx.getTags(socket);
    const game = this._game;
    if (this._flooding(socket)) return socket.close(POLICY_VIOLATION, 'Too many messages');
    const message = typeof raw === 'string' ? parseMessage(raw) : null;
    if (uid === undefined || game === null) return;
    if (message === null)
      return socket.send(JSON.stringify({ type: ServerMessageType.ERROR, message: 'That message was not understood' }));
    const outcome = await this._try(async () => {
      if (message.type === ClientMessageType.MOVE) game.play(uid, message.index, message.move, Date.now());
      else game.resign(uid);
      await this._save(game);
      if (game.status === RoomStatus.FINISHED) await this._finish(game);
    });
    if (!outcome.ok) socket.send(JSON.stringify({ type: ServerMessageType.ERROR, message: outcome.message }));
  }

  /** A host who leaves while the room is still open takes it with them, so nobody joins an empty room. */
  public override async webSocketClose(socket: WebSocket): Promise<void> {
    const [uid] = this.ctx.getTags(socket);
    const game = this._game;
    if (game === null || game.status !== RoomStatus.OPEN || game.record.host !== uid) return;
    const stillHere = this.ctx.getWebSockets(uid).some((other) => other !== socket);
    if (!stillHere) await this._discard();
  }

  /** Two things wake the room: nobody joined it in time, or the player to move has used up the time. */
  public override async alarm(): Promise<void> {
    const game = this._game;
    if (game === null) return;
    if (game.status === RoomStatus.OPEN) return this._discard();
    if (game.expire(Date.now())) {
      await this._save(game);
      await this._finish(game);
    } else {
      await this._schedule(game);
    }
  }

  private _flooding(socket: WebSocket): boolean {
    const now = Date.now();
    const recent = (this._recent.get(socket) ?? []).filter((at) => now - at < FLOOD_WINDOW_MS);
    recent.push(now);
    this._recent.set(socket, recent);
    return recent.length > FLOOD_LIMIT;
  }

  private async _save(game: OnlineGame): Promise<void> {
    this._game = game;
    await this.ctx.storage.put(RECORD, game.record);
    await this._schedule(game);
    const message = JSON.stringify({ type: ServerMessageType.ROOM, room: game.view });
    for (const socket of this.ctx.getWebSockets()) socket.send(message);
  }

  /** One alarm at a time: the end of the waiting for a guest, then the end of each turn, and none when the game is over. */
  private async _schedule(game: OnlineGame): Promise<void> {
    const at = game.status === RoomStatus.OPEN ? game.record.createdAt + OPEN_ROOM_MAX_AGE_MS : game.deadline;
    if (at === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(at);
  }

  private async _finish(game: OnlineGame): Promise<void> {
    if (await this.ctx.storage.get<boolean>(RECORDED)) return;
    await recordOnlineGame(new PlayerDb(this.env.DB), game, Date.now());
    await this.ctx.storage.put(RECORDED, true);
  }

  private async _discard(): Promise<void> {
    await new RoomDb(this.env.DB).remove(this._roomId);
    for (const socket of this.ctx.getWebSockets()) socket.close(1000, 'The room was closed');
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this._game = null;
  }

  private async _try(work: () => Promise<void>): Promise<Outcome> {
    try {
      await work();
      return { ok: true };
    } catch (error) {
      if (error instanceof RoomError) return { ok: false, message: error.message };
      throw error;
    }
  }
}

function parseMessage(raw: string): ClientMessage | null {
  try {
    const message: unknown = JSON.parse(raw);
    if (typeof message !== 'object' || message === null) return null;
    const { type, index, move } = message as Record<string, unknown>;
    if (type === ClientMessageType.RESIGN) return { type };
    if (type !== ClientMessageType.MOVE || !Number.isInteger(index)) return null;
    if (move === null) return { type, index: index as number, move: null };
    const point = move as Record<string, unknown> | undefined;
    if (typeof point?.x !== 'number' || typeof point.y !== 'number') return null;
    return { type, index: index as number, move: { x: point.x, y: point.y } };
  } catch {
    return null;
  }
}
