import { BLACK, WHITE, type Stone } from '@go-game/core/board.ts';
import { ClientMessageType } from '@go-game/types/protocol.ts';
import { RemoteEventType, type Match, type RemoteEvent, type RemotePlayer } from '@go-game/core/ports.ts';
import type { Move } from '@go-game/core/rules.ts';
import type { RoomView, Seating } from './room.ts';
import type { RoomSocket } from './roomSocket.ts';

/** An online game seen from one seat. The server keeps the game and checks every move. This only sends moves and hears the room. */
export class SocketMatch implements Match {
  public readonly seat: Stone;
  public readonly opponent: RemotePlayer;
  private readonly _socket: RoomSocket;

  constructor(socket: RoomSocket, seating: Seating) {
    this._socket = socket;
    this.seat = seating.seat;
    this.opponent = seating.opponent;
  }

  /** Finishes when the room shows the move, and fails when the server refuses it. */
  public sendMove(index: number, move: Move): Promise<void> {
    return this._request({ type: ClientMessageType.MOVE, index, move }, (room) =>
      room.moves.some((played) => played.index === index),
    );
  }

  public sendResign(): Promise<void> {
    return this._request({ type: ClientMessageType.RESIGN }, (room) => room.resignedBy !== null);
  }

  /**
   * Gives every move in the room to the listener, in order. The game loop skips the moves it already has.
   * Stopping the subscription ends the game for this player, so it closes the connection.
   */
  public subscribe(listener: (event: RemoteEvent) => void, onError: (message: string) => void): () => void {
    const stops = [
      this._socket.onRoom((room) => this._tell(room, listener)),
      this._socket.onTrouble(onError),
      this._socket.onClosed(() => onError('The room was closed')),
    ];
    return () => {
      for (const stop of stops) stop();
      this._socket.close();
    };
  }

  private _tell(room: RoomView, listener: (event: RemoteEvent) => void): void {
    for (const { index, move } of room.moves) listener({ type: RemoteEventType.MOVE, index, move });
    if (room.resignedBy !== null) listener({ type: RemoteEventType.RESIGN, by: seatOf(room, room.resignedBy) });
    if (room.timedOutBy !== null) listener({ type: RemoteEventType.TIMEOUT, by: seatOf(room, room.timedOutBy) });
  }

  private _request(message: Parameters<RoomSocket['send']>[0], done: (room: RoomView) => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const stopRoom = this._socket.onRoom((room) => {
        if (done(room)) settle(resolve);
      });
      const stopRefused = this._socket.onRefused((reason) => settle(() => reject(new Error(reason))));
      const settle = (finish: () => void): void => {
        stopRoom();
        stopRefused();
        finish();
      };
      try {
        this._socket.send(message);
      } catch (error) {
        settle(() => reject(error));
      }
    });
  }
}

function seatOf(room: RoomView, uid: string): Stone {
  return uid === room.host ? BLACK : WHITE;
}
