import { BLACK, WHITE, type Stone } from '@go-game/core/board.ts';
import { illegalMoveMessage } from '@go-game/core/illegalMoveMessage.ts';
import { Game, Mode, type Result } from '@go-game/core/game.ts';
import type { PlayedMove, RoomView } from '@go-game/types/api.ts';
import { RoomStatus } from '@go-game/types/protocol.ts';

export type { PlayedMove, RoomView };
import type { Move } from '@go-game/core/rules.ts';

/** A refusal the player is told about, such as a move that is not allowed. */
export class RoomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomError';
  }
}

/** What is kept between requests: everything else is worked out again from it. */
export type RoomRecord = Omit<RoomView, 'status'>;

/** How long a player has for a move. After that the game is lost on time, so a player who left does not hold the game for ever. */
export const TURN_TIMEOUT_MS = 5 * 60_000;

/**
 * The rules of one online game. The host plays Black and the guest plays White. Every move is checked here, with the
 * same rules as the browser has, so a browser cannot play out of turn, play an illegal move, or say who won.
 */
export class OnlineGame {
  private readonly _record: RoomRecord;
  private readonly _game = new Game(Mode.HUMAN_VS_HUMAN);
  private readonly _turnTimeoutMs: number;

  /** `turnTimeoutMs` is how long a player has for a move. Only a test or `wrangler dev` sets it. */
  constructor(record: RoomRecord, turnTimeoutMs = TURN_TIMEOUT_MS) {
    this._turnTimeoutMs = turnTimeoutMs;
    this._record = { ...record, moves: [...record.moves] };
    for (const { move } of record.moves) this._game.playMove(move);
    if (record.resignedBy !== null) this._game.resignBy(this._stoneOf(record.resignedBy));
    if (record.timedOutBy !== null) this._game.timeoutBy(this._stoneOf(record.timedOutBy));
  }

  public static open(host: string, hostName: string, createdAt: number, turnTimeoutMs = TURN_TIMEOUT_MS): OnlineGame {
    return new OnlineGame(
      {
        host,
        hostName,
        guest: null,
        guestName: null,
        createdAt,
        moves: [],
        resignedBy: null,
        timedOutBy: null,
        turnStartedAt: createdAt,
      },
      turnTimeoutMs,
    );
  }

  public get record(): RoomRecord {
    return { ...this._record, moves: [...this._record.moves] };
  }

  public get view(): RoomView {
    return { ...this.record, status: this.status };
  }

  public get status(): RoomStatus {
    if (this._game.isOver) return RoomStatus.FINISHED;
    return this._record.guest === null ? RoomStatus.OPEN : RoomStatus.PLAYING;
  }

  /** How the game ended, or null while it goes on. */
  public get result(): Result | null {
    return this._game.result;
  }

  /** When the game is lost on time if no move comes, or null when no game is being played. */
  public get deadline(): number | null {
    return this.status === RoomStatus.PLAYING ? this._record.turnStartedAt + this._turnTimeoutMs : null;
  }

  public join(uid: string, name: string, now: number): void {
    if (this.status !== RoomStatus.OPEN) throw new RoomError('That room is no longer open');
    if (uid === this._record.host) throw new RoomError('You opened this room');
    this._record.guest = uid;
    this._record.guestName = name;
    this._record.turnStartedAt = now;
  }

  /** `index` is the number of the move, so a move that arrives twice, or late, is refused. */
  public play(uid: string, index: number, move: Move, now: number): void {
    if (this.status !== RoomStatus.PLAYING) throw new RoomError('The game is not being played');
    const stone = this._stoneOf(uid);
    if (this._game.toPlay !== stone) throw new RoomError('It is not your turn');
    if (index !== this._game.moveNumber) throw new RoomError('The move was not accepted. The game has moved on.');
    if (move !== null) {
      const reason = this._game.illegalReason(move);
      if (reason !== null) throw new RoomError(illegalMoveMessage(reason));
    }
    this._game.playMove(move);
    this._record.moves.push({ index, by: uid, move });
    this._record.turnStartedAt = now;
  }

  /** A player can resign at any time in a game that is being played, also while it is the other player's turn. */
  public resign(uid: string): void {
    if (this.status !== RoomStatus.PLAYING) throw new RoomError('The game is not being played');
    this._game.resignBy(this._stoneOf(uid));
    this._record.resignedBy = uid;
  }

  /** Ends the game, in favour of the other player, when the player to move has used up the time. Gives true when it did. */
  public expire(now: number): boolean {
    const deadline = this.deadline;
    if (deadline === null || now < deadline) return false;
    const stone = this._game.toPlay;
    this._game.timeoutBy(stone);
    this._record.timedOutBy = stone === BLACK ? this._record.host : (this._record.guest as string);
    return true;
  }

  public stoneOf(uid: string): Stone {
    return this._stoneOf(uid);
  }

  private _stoneOf(uid: string): Stone {
    if (uid === this._record.host) return BLACK;
    if (uid === this._record.guest) return WHITE;
    throw new RoomError('You are not in this room');
  }
}
