import { BLACK, WHITE, type Stone } from '@go-game/core/board.ts';
import type { RemotePlayer } from '@go-game/core/ports.ts';
import type { OpenRoomJson, PlayedMove, RoomView } from '@go-game/types/api.ts';
import { RoomStatus } from '@go-game/types/protocol.ts';

export type { OpenRoomJson, PlayedMove, RoomView };
import type { User } from '@go-game/core/user.ts';

/** A room the way the pages see it, with its id and the moves in order. */
export interface Room extends RoomView {
  id: string;
}

export function toRoom(id: string, view: RoomView): Room {
  return { ...view, id, moves: [...view.moves].sort((a, b) => a.index - b.index) };
}

export function toOpenRoom({ id, hostUid, hostName, createdAt }: OpenRoomJson): Room {
  return {
    id,
    host: hostUid,
    hostName,
    guest: null,
    guestName: null,
    status: RoomStatus.OPEN,
    createdAt,
    moves: [],
    resignedBy: null,
    timedOutBy: null,
    turnStartedAt: createdAt,
  };
}

/** Who sits where in a match: the visitor, the colour they play, and the other player. */
export interface Seating {
  uid: string;
  seat: Stone;
  opponent: RemotePlayer;
}

/** Fails when the visitor is not in the room or the other seat is still empty. */
export function seatingOf(room: RoomView, user: User): Seating {
  if (room.host !== user.uid && room.guest !== user.uid) throw new Error('You are not in this room');
  if (room.guest === null) throw new Error('Nobody has joined yet');
  const seat: Stone = room.host === user.uid ? BLACK : WHITE;
  const opponent: RemotePlayer =
    seat === BLACK ? { uid: room.guest, name: room.guestName ?? 'Guest' } : { uid: room.host, name: room.hostName };
  return { uid: user.uid, seat, opponent };
}
