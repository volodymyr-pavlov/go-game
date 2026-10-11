import { has } from '@go-game/types/flags.ts';
import { Mode, ResultKind } from '@go-game/types/game.ts';

export { Mode, ResultKind };
import { illegalMoveMessage } from './illegalMoveMessage.ts';
import { BLACK, opponentOf, type Point, type Stone } from './board.ts';
import {
  illegalReason,
  initialPosition,
  isFinished,
  pass,
  play,
  IllegalReason,
  type Move,
  type Position,
} from './rules.ts';
import { scorePosition, type Score } from './scoring.ts';

const MODES: readonly Mode[] = Object.values(Mode);

/** Reads the value of the mode dropdown, which is the number of the mode as text. */
export function parseMode(value: string): Mode | null {
  const mode = Number(value);
  return (MODES as readonly number[]).includes(mode) ? (mode as Mode) : null;
}

export interface Turn {
  player: Stone;
  move: Move;
  captured: number;
  position: Position;
}

export type Result =
  | { kind: typeof ResultKind.SCORE; winner: Stone; score: Score }
  | { kind: typeof ResultKind.RESIGNATION; winner: Stone; resigned: Stone }
  | { kind: typeof ResultKind.TIMEOUT; winner: Stone; timedOut: Stone };

export class IllegalMoveError extends Error {
  public readonly reason: IllegalReason;

  constructor(reason: IllegalReason) {
    super(illegalMoveMessage(reason));
    this.name = 'IllegalMoveError';
    this.reason = reason;
  }
}

export class Game {
  public readonly mode: Mode;
  /** The colour the visitor plays in an online game. Other modes do not use it. */
  public readonly seat: Stone;
  private _result: Result | null = null;
  private _turns: Turn[] = [];
  private _initial = initialPosition();

  constructor(mode: Mode, seat: Stone = BLACK) {
    this.mode = mode;
    this.seat = seat;
  }

  public get position(): Position {
    return this._turns.at(-1)?.position ?? this._initial;
  }

  public get history(): readonly Turn[] {
    return this._turns;
  }

  public get moveNumber(): number {
    return this._turns.length;
  }

  public get toPlay(): Stone {
    return this.position.toPlay;
  }

  public get lastMove(): Point | null {
    return this._turns.at(-1)?.move ?? null;
  }

  public get result(): Result | null {
    return this._result;
  }

  public get isOver(): boolean {
    return this._result !== null;
  }

  public isEngine(stone: Stone): boolean {
    return !has(this.mode, Mode.ONLINE) && has(this.mode, stone);
  }

  public isRemote(stone: Stone): boolean {
    return has(this.mode, Mode.ONLINE) && stone !== this.seat;
  }

  public get isEngineToPlay(): boolean {
    return !this.isOver && this.isEngine(this.toPlay);
  }

  public get isRemoteToPlay(): boolean {
    return !this.isOver && this.isRemote(this.toPlay);
  }

  public get isHumanToPlay(): boolean {
    return !this.isOver && !this.isEngine(this.toPlay) && !this.isRemote(this.toPlay);
  }

  public illegalReason(point: Point): IllegalReason | null {
    if (this.isOver) return IllegalReason.GAME_OVER;
    return illegalReason(this.position, point);
  }

  /** Plays a stone for the player to move. Throws `IllegalMoveError` when the move is not allowed, so call `illegalReason` first. */
  public play(point: Point): void {
    if (this.isOver) throw new IllegalMoveError(IllegalReason.GAME_OVER);
    const result = play(this.position, point);
    if (!result.ok) throw new IllegalMoveError(result.reason);
    this._turns.push({ player: this.toPlay, move: point, captured: result.captured.length, position: result.position });
  }

  /** Plays a stone, or passes when `move` is null. */
  public playMove(move: Move): void {
    if (move === null) this.pass();
    else this.play(move);
  }

  public pass(): void {
    if (this.isOver) return;
    this._turns.push({ player: this.toPlay, move: null, captured: 0, position: pass(this.position) });
    if (isFinished(this.position)) this._finishByScore();
  }

  public resign(): void {
    this.resignBy(this.toPlay);
  }

  /** `stone` gives up, even when it is not their turn. In an online game you can resign while you wait for the opponent. */
  public resignBy(stone: Stone): void {
    if (this.isOver) return;
    this._result = { kind: ResultKind.RESIGNATION, winner: opponentOf(stone), resigned: stone };
  }

  /** `stone` did not move in time, in an online game. The other player wins. */
  public timeoutBy(stone: Stone): void {
    if (this.isOver) return;
    this._result = { kind: ResultKind.TIMEOUT, winner: opponentOf(stone), timedOut: stone };
  }

  public score(): Score {
    return scorePosition(this.position);
  }

  private _finishByScore(): void {
    const score = this.score();
    this._result = { kind: ResultKind.SCORE, winner: score.winner, score };
  }
}
