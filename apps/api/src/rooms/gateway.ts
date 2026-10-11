import { HttpError } from '../http.ts';
import { PLAYER_HEADER } from './protocol.ts';
import type { Outcome, RoomDo } from './roomDo.ts';
import { HostHasRoomError, type OpenRoom, type RoomDb } from '../services/d1.ts';

/** What the API needs from the online rooms. The Durable Objects sit behind it, so the API can be tested without them. */
export interface RoomGateway {
  /** Opens a room with the caller as host and gives its id. */
  create(hostUid: string, hostName: string): Promise<string>;
  listOpen(): Promise<OpenRoom[]>;
  /** Fails with an `HttpError` when the room is gone or someone else got there first. */
  join(roomId: string, uid: string, name: string): Promise<void>;
  cancel(roomId: string, uid: string): Promise<void>;
  /** Hands the WebSocket request of a player to the room. */
  connect(roomId: string, uid: string, request: Request): Promise<Response>;
}

export const OPEN_ROOMS_SHOWN = 20;
/** No more rooms than this can be open at once, in all. */
export const MAX_OPEN_ROOMS = 200;

export class DurableRooms implements RoomGateway {
  private readonly _rooms: DurableObjectNamespace<RoomDo>;
  private readonly _db: RoomDb;
  private readonly _now: () => number;

  constructor(rooms: DurableObjectNamespace<RoomDo>, db: RoomDb, now: () => number) {
    this._rooms = rooms;
    this._db = db;
    this._now = now;
  }

  public async create(hostUid: string, hostName: string): Promise<string> {
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
    const now = this._now();
    if ((await this._db.countOpen(now)) >= MAX_OPEN_ROOMS) {
      throw new HttpError(503, 'There are too many open rooms. Try again in a few minutes');
    }
    // The lobby's list comes first: its unique index is what keeps a player to one open room.
    try {
      await this._db.add(id, hostUid, hostName, now);
    } catch (error) {
      if (error instanceof HostHasRoomError) throw new HttpError(409, error.message);
      throw error;
    }
    try {
      refuse(await this._room(id).open(id, hostUid, hostName, now));
    } catch (error) {
      await this._db.remove(id);
      throw error;
    }
    return id;
  }

  public listOpen(): Promise<OpenRoom[]> {
    return this._db.open(OPEN_ROOMS_SHOWN, this._now());
  }

  public async join(roomId: string, uid: string, name: string): Promise<void> {
    refuse(await this._room(roomId).join(uid, name));
  }

  public async cancel(roomId: string, uid: string): Promise<void> {
    refuse(await this._room(roomId).cancel(uid));
  }

  public connect(roomId: string, uid: string, request: Request): Promise<Response> {
    const headers = new Headers(request.headers);
    headers.set(PLAYER_HEADER, uid);
    return this._room(roomId).fetch(new Request(request, { headers }));
  }

  private _room(id: string): DurableObjectStub<RoomDo> {
    return this._rooms.get(this._rooms.idFromName(id));
  }
}

function refuse(outcome: Outcome): void {
  if (!outcome.ok) throw new HttpError(409, outcome.message);
}
