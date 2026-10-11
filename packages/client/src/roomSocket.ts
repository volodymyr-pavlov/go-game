import type { ApiClient } from './client.ts';
import type { RoomView } from './room.ts';
import type { ClientMessage, ServerMessage } from '@go-game/types/api.ts';
import { SOCKET_PROTOCOL, ServerMessageType } from '@go-game/types/protocol.ts';

export type { ClientMessage };

/** Makes a WebSocket to `path` on the address of the page. */
export type SocketFactory = (path: string, protocols: string[]) => WebSocket;

const pageSocket: SocketFactory = (path, protocols) => {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${scheme}//${window.location.host}${path}`, protocols);
};

const NORMAL_CLOSE = 1000;
const OPEN = 1;
export const RECONNECT_MS = 1500;
export const CONNECT_TIMEOUT_MS = 10_000;

type Listener<T> = (value: T) => void;

/**
 * The connection of one player to one room. It gives every state of the room to its listeners, and it connects again
 * when the connection drops. The server closes it with the normal code when the room is gone, and then `onClosed` is heard.
 */
export class RoomSocket {
  private readonly _client: ApiClient;
  private readonly _roomId: string;
  private readonly _factory: SocketFactory;
  private readonly _rooms = new Set<Listener<RoomView>>();
  private readonly _refusals = new Set<Listener<string>>();
  private readonly _troubles = new Set<Listener<string>>();
  private readonly _closings = new Set<Listener<void>>();
  private _socket: WebSocket | null = null;
  private _stopped = false;
  private _timer: ReturnType<typeof setTimeout> | undefined;

  constructor(client: ApiClient, roomId: string, factory: SocketFactory = pageSocket) {
    this._client = client;
    this._roomId = roomId;
    this._factory = factory;
  }

  /** Every state of the room, the first one right after the connection is made. */
  public onRoom(listener: Listener<RoomView>): () => void {
    return subscribe(this._rooms, listener);
  }

  /** The server refused a message of this player, for example a move that is not allowed. */
  public onRefused(listener: Listener<string>): () => void {
    return subscribe(this._refusals, listener);
  }

  /** The connection dropped. It is being made again. */
  public onTrouble(listener: Listener<string>): () => void {
    return subscribe(this._troubles, listener);
  }

  /** The server closed the room, so there is nothing to connect to. */
  public onClosed(listener: Listener<void>): () => void {
    return subscribe(this._closings, listener);
  }

  /** Gives the first state of the room, or fails when the room cannot be reached. */
  public connect(): Promise<RoomView> {
    return new Promise((resolve, reject) => {
      const stopRoom = this.onRoom((room) => finish(() => resolve(room)));
      const stopClosed = this.onClosed(() => finish(() => reject(new Error('That room is closed'))));
      const timer = setTimeout(() => finish(() => reject(new Error('Could not join the room'))), CONNECT_TIMEOUT_MS);
      const finish = (settle: () => void): void => {
        clearTimeout(timer);
        stopRoom();
        stopClosed();
        settle();
      };
      this._open().catch((error: unknown) => finish(() => reject(error)));
    });
  }

  public send(message: ClientMessage): void {
    if (this._socket?.readyState !== OPEN)
      throw new Error('The connection to the game was lost. Try again in a moment');
    this._socket.send(JSON.stringify(message));
  }

  public close(): void {
    this._stopped = true;
    clearTimeout(this._timer);
    this._socket?.close(NORMAL_CLOSE);
  }

  private async _open(): Promise<void> {
    const token = await this._client.token();
    if (this._stopped) return;
    const socket = this._factory(`/api/rooms/${encodeURIComponent(this._roomId)}/socket`, [SOCKET_PROTOCOL, token]);
    this._socket = socket;
    socket.onmessage = (event) => this._hear(String(event.data));
    socket.onclose = (event) => this._closed(socket, event.code);
  }

  private _hear(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === ServerMessageType.ROOM) for (const listener of this._rooms) listener(message.room);
    else if (message.type === ServerMessageType.ERROR) for (const listener of this._refusals) listener(message.message);
  }

  private _closed(socket: WebSocket, code: number): void {
    if (this._stopped || socket !== this._socket) return;
    if (code === NORMAL_CLOSE) {
      this._stopped = true;
      for (const listener of this._closings) listener();
      return;
    }
    for (const listener of this._troubles) listener('The connection to the game was lost. Trying again…');
    this._timer = setTimeout(() => void this._open().catch(() => this._closed(socket, 0)), RECONNECT_MS);
  }
}

function subscribe<T>(listeners: Set<Listener<T>>, listener: Listener<T>): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
