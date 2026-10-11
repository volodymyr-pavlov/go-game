// The host plays Black and the guest plays White. The server keeps every game and checks every move.

import { ApiClient } from './client.ts';
import { poll } from './poll.ts';
import { seatingOf, toOpenRoom, toRoom, type OpenRoomJson, type Room, type RoomView } from './room.ts';
import { RoomSocket, type SocketFactory } from './roomSocket.ts';
import { SocketMatch } from './socketMatch.ts';
import type { Match } from '@go-game/core/ports.ts';
import type { User } from '@go-game/core/user.ts';

export type { Room, RoomView };

/** How often the list of open rooms is loaded again while the lobby shows it. */
export const OPEN_ROOMS_REFRESH_MS = 3_000;

export interface GameSync {
  createRoom(user: User): Promise<string>;
  /** Joins an open room as the guest. Fails when someone else got there first. */
  joinRoom(roomId: string, user: User): Promise<void>;
  followOpenRooms(onRooms: (rooms: readonly Room[]) => void, onError: (message: string) => void): () => void;
  /** Follows one room. Gives null when the room is closed. */
  followRoom(roomId: string, onRoom: (room: Room | null) => void, onError: (message: string) => void): () => void;
  /** Starts the match in a room the visitor is part of. Waits until both players are in. */
  openMatch(roomId: string, user: User): Promise<Match>;
  /** Deletes a room the visitor opened, as long as nobody has joined it. */
  closeRoom(roomId: string, user: User): Promise<void>;
}

export class ServerGameSync implements GameSync {
  private readonly _client: ApiClient;
  private readonly _sockets: SocketFactory | undefined;

  /** `sockets` makes the WebSockets. Tests give their own. */
  constructor(client: ApiClient, sockets?: SocketFactory) {
    this._client = client;
    this._sockets = sockets;
  }

  public async createRoom(_user: User): Promise<string> {
    return (await this._client.send<{ id: string }>('POST', '/api/rooms', undefined, { checked: true })).id;
  }

  public async joinRoom(roomId: string, _user: User): Promise<void> {
    await this._client.send('POST', `/api/rooms/${encodeURIComponent(roomId)}/join`, undefined, { checked: true });
  }

  public followOpenRooms(onRooms: (rooms: readonly Room[]) => void, onError: (message: string) => void): () => void {
    return poll(
      async () => (await this._client.send<{ rooms: OpenRoomJson[] }>('GET', '/api/rooms')).rooms.map(toOpenRoom),
      onRooms,
      onError,
      OPEN_ROOMS_REFRESH_MS,
    );
  }

  public followRoom(
    roomId: string,
    onRoom: (room: Room | null) => void,
    onError: (message: string) => void,
  ): () => void {
    const socket = new RoomSocket(this._client, roomId, this._sockets);
    socket.onRoom((view) => onRoom(toRoom(roomId, view)));
    socket.onClosed(() => onRoom(null));
    socket.onTrouble(onError);
    socket.connect().catch((error: unknown) => onError(error instanceof Error ? error.message : String(error)));
    return () => socket.close();
  }

  public async openMatch(roomId: string, user: User): Promise<Match> {
    const socket = new RoomSocket(this._client, roomId, this._sockets);
    try {
      return new SocketMatch(socket, seatingOf(await socket.connect(), user));
    } catch (error) {
      socket.close();
      throw error;
    }
  }

  public async closeRoom(roomId: string, _user: User): Promise<void> {
    await this._client.send('DELETE', `/api/rooms/${encodeURIComponent(roomId)}`);
  }
}
