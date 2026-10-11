import { Mode, type Game } from './game.ts';
import type { Match, ResultSink } from './ports.ts';

/** Saves a finished game to the leaderboard one time only, even if its result is shown more than once. */
export class GameRecorder {
  private readonly _sink: ResultSink;
  private readonly _match: Match | null;
  private _recorded = false;

  constructor(sink: ResultSink, match: Match | null) {
    this._sink = sink;
    this._match = match;
  }

  /** A new game can be saved again. */
  public reset(): void {
    this._recorded = false;
  }

  /** A game against the engine or an online game is saved. A game between two people at one computer is not. */
  public recordOnce(game: Game, playouts: () => number): void {
    const result = game.result;
    if (this._recorded || game.mode === Mode.HUMAN_VS_HUMAN || result === null) return;
    this._recorded = true;
    const match = this._match;
    this._sink.record({
      won: match !== null ? result.winner === game.seat : !game.isEngine(result.winner),
      kind: result.kind,
      playouts: match !== null ? null : playouts(),
      opponent: match?.opponent ?? null,
    });
  }
}
