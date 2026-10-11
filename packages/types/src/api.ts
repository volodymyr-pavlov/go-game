// The contract of the game server: what each route takes and gives, and what a room and a player look like on the wire.

import type { Move, ResultKind } from './game.ts';
import type { ClientMessageType, RoomStatus, ServerMessageType } from './protocol.ts';

export interface Player {
  name: string;
  rating: number;
  wins: number;
  losses: number;
}

export interface RankedPlayer extends Player {
  uid: string;
}

/** A finished game as the server sends it in a player's history. */
export interface PlayedGameJson {
  id: number;
  opponentName: string;
  won: boolean;
  kind: ResultKind;
  ratingBefore: number;
  ratingAfter: number;
  finishedAt: number;
}

export interface PlayedMove {
  index: number;
  by: string;
  move: Move;
}

/** A room as the server sends it. */
export interface RoomView {
  host: string;
  hostName: string;
  guest: string | null;
  guestName: string | null;
  status: RoomStatus;
  createdAt: number;
  moves: PlayedMove[];
  resignedBy: string | null;
  /** The player who did not move in time. */
  timedOutBy: string | null;
  /** When the player to move got the turn. The server ends the game a few minutes later if no move comes. */
  turnStartedAt: number;
}

/** A room in the lobby's list, as the server sends it. Nobody has joined it yet. */
export interface OpenRoomJson {
  id: string;
  hostUid: string;
  hostName: string;
  createdAt: number;
}

/** What a page says to a room. */
export type ClientMessage =
  { type: typeof ClientMessageType.MOVE; index: number; move: Move } | { type: typeof ClientMessageType.RESIGN };

/** What a room says to a page. */
export type ServerMessage =
  { type: typeof ServerMessageType.ROOM; room: RoomView } | { type: typeof ServerMessageType.ERROR; message: string };

/** The result of a game against the engine, as the browser reports it. Online games are saved by their room. */
export interface EngineResultRequest {
  playouts: number;
  won: boolean;
  kind: typeof ResultKind.SCORE | typeof ResultKind.RESIGNATION;
}

export interface NicknameRequest {
  nickname: string;
}

export interface GameSavedResponse {
  ratingBefore: number;
  ratingAfter: number;
}

export interface CreatedRoomResponse {
  id: string;
}

export interface LeaderboardResponse {
  players: RankedPlayer[];
}

export interface GamesResponse {
  games: PlayedGameJson[];
}

export interface RoomsResponse {
  rooms: OpenRoomJson[];
}

/** The body of every refusal. `error` is written for the player. */
export interface ErrorResponse {
  error: string;
}
