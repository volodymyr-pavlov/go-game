import { INITIAL_RATING } from '@go-game/core/elo.ts';
import type { Player, RankedPlayer } from '@go-game/types/api.ts';
import type { ResultKind } from '@go-game/types/game.ts';

export type { Player, RankedPlayer };

/** A finished game the way it is saved. The ratings are the server's, not the browser's. */
export interface NewGame {
  /** The uid of the other player, or null for the engine. */
  opponent: string | null;
  opponentName: string;
  won: boolean;
  kind: ResultKind;
  ratingBefore: number;
  ratingAfter: number;
}

export interface PlayedGame extends NewGame {
  id: number;
  finishedAt: number;
}

export class NicknameTakenError extends Error {
  constructor() {
    super('That nickname is taken');
    this.name = 'NicknameTakenError';
  }
}

interface PlayerRow {
  uid: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
}

interface GameRow {
  id: number;
  opponent: string | null;
  opponent_name: string;
  won: number;
  kind: ResultKind;
  rating_before: number;
  rating_after: number;
  finished_at: number;
}

/** The players and their games in D1. Every query is written here, so the rest of the Worker never sees SQL. */
export class PlayerDb {
  private readonly _db: D1Database;

  constructor(db: D1Database) {
    this._db = db;
  }

  /** The `limit` best players by rating, then by wins. */
  public async top(limit: number): Promise<RankedPlayer[]> {
    const { results } = await this._db
      .prepare('SELECT uid, name, rating, wins, losses FROM players ORDER BY rating DESC, wins DESC LIMIT ?')
      .bind(limit)
      .all<PlayerRow>();
    return results.map((row) => ({ uid: row.uid, ...toPlayer(row) }));
  }

  public async find(uid: string): Promise<Player | null> {
    const row = await this._db
      .prepare('SELECT uid, name, rating, wins, losses FROM players WHERE uid = ?')
      .bind(uid)
      .first<PlayerRow>();
    return row === null ? null : toPlayer(row);
  }

  /** The `limit` games the player finished last, newest first. */
  public async history(uid: string, limit: number): Promise<PlayedGame[]> {
    const { results } = await this._db
      .prepare(
        `SELECT id, opponent, opponent_name, won, kind, rating_before, rating_after, finished_at
         FROM games WHERE uid = ? ORDER BY finished_at DESC, id DESC LIMIT ?`,
      )
      .bind(uid, limit)
      .all<GameRow>();
    return results.map(toPlayedGame);
  }

  public async lastGameAt(uid: string): Promise<number | null> {
    const row = await this._db
      .prepare('SELECT MAX(finished_at) AS at FROM games WHERE uid = ?')
      .bind(uid)
      .first<{ at: number | null }>();
    return row?.at ?? null;
  }

  /** Gives the nickname to the player, and frees the old one. A new player starts at the initial rating. Throws `NicknameTakenError` when another player has it. */
  public async claimNickname(uid: string, name: string, key: string, now: number): Promise<Player> {
    try {
      await this._db
        .prepare(
          `INSERT INTO players (uid, name, name_key, rating, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (uid) DO UPDATE SET name = excluded.name, name_key = excluded.name_key, updated_at = excluded.updated_at`,
        )
        .bind(uid, name, key, INITIAL_RATING, now)
        .run();
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw new NicknameTakenError();
      throw error;
    }
    return (await this.find(uid)) as Player;
  }

  /**
   * Saves the game and the player's new rating, one more win or loss, in one batch. Gives false, and saves nothing,
   * when the player's rating is no longer `ratingBefore`: another result was saved in the meantime.
   */
  public async saveGame(uid: string, game: NewGame, now: number): Promise<boolean> {
    const [update] = await this._db.batch([
      this._db
        .prepare(
          'UPDATE players SET rating = ?, wins = wins + ?, losses = losses + ?, updated_at = ? WHERE uid = ? AND rating = ?',
        )
        .bind(game.ratingAfter, game.won ? 1 : 0, game.won ? 0 : 1, now, uid, game.ratingBefore),
      this._db
        .prepare(
          `INSERT INTO games (uid, opponent, opponent_name, won, kind, rating_before, rating_after, finished_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
        )
        .bind(
          uid,
          game.opponent,
          game.opponentName,
          game.won ? 1 : 0,
          game.kind,
          game.ratingBefore,
          game.ratingAfter,
          now,
        ),
    ]);
    return update.meta.changes === 1;
  }

  /** Removes the player, their nickname and their games. */
  public async remove(uid: string): Promise<void> {
    await this._db.prepare('DELETE FROM players WHERE uid = ?').bind(uid).run();
  }
}

function toPlayer(row: PlayerRow): Player {
  return { name: row.name, rating: row.rating, wins: row.wins, losses: row.losses };
}

function toPlayedGame(row: GameRow): PlayedGame {
  return {
    id: row.id,
    opponent: row.opponent,
    opponentName: row.opponent_name,
    won: row.won === 1,
    kind: row.kind,
    ratingBefore: row.rating_before,
    ratingAfter: row.rating_after,
    finishedAt: row.finished_at,
  };
}

// The lobby's list of open rooms.

/** A room that can still be joined, the way the lobby lists it. */
export interface OpenRoom {
  id: string;
  hostUid: string;
  hostName: string;
  createdAt: number;
}

/** A room nobody joined in this time is not offered any more. The room itself cancels at the same time. */
export const OPEN_ROOM_MAX_AGE_MS = 10 * 60_000;

export class HostHasRoomError extends Error {
  constructor() {
    super('You already have an open room');
    this.name = 'HostHasRoomError';
  }
}

interface RoomRow {
  id: string;
  host_uid: string;
  host_name: string;
  created_at: number;
}

/** The lobby's list of open rooms, in D1. The games themselves live in the rooms' Durable Objects. */
export class RoomDb {
  private readonly _db: D1Database;

  constructor(db: D1Database) {
    this._db = db;
  }

  /** Adds the room. Throws `HostHasRoomError` when the host already has one that is open. */
  public async add(id: string, hostUid: string, hostName: string, now: number): Promise<void> {
    await this._purge(now);
    try {
      await this._db
        .prepare('INSERT INTO rooms (id, host_uid, host_name, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, hostUid, hostName, now)
        .run();
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) throw new HostHasRoomError();
      throw error;
    }
  }

  public async countOpen(now: number): Promise<number> {
    await this._purge(now);
    const row = await this._db.prepare('SELECT COUNT(*) AS n FROM rooms').first<{ n: number }>();
    return row?.n ?? 0;
  }

  public async remove(id: string): Promise<void> {
    await this._db.prepare('DELETE FROM rooms WHERE id = ?').bind(id).run();
  }

  /** The `limit` newest rooms that are not too old. */
  public async open(limit: number, now: number): Promise<OpenRoom[]> {
    await this._purge(now);
    const { results } = await this._db
      .prepare('SELECT id, host_uid, host_name, created_at FROM rooms ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all<RoomRow>();
    return results.map((row) => ({
      id: row.id,
      hostUid: row.host_uid,
      hostName: row.host_name,
      createdAt: row.created_at,
    }));
  }

  /** Deletes the rooms that are too old. Their Durable Objects cancel them at the same time. */
  private async _purge(now: number): Promise<void> {
    await this._db
      .prepare('DELETE FROM rooms WHERE created_at < ?')
      .bind(now - OPEN_ROOM_MAX_AGE_MS)
      .run();
  }
}
