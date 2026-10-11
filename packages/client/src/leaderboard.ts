// Results of a player without a nickname are not saved. There is no player entry to add them to.

import { ResultKind } from '@go-game/core/game.ts';
import type { GameRecord, ResultSink } from '@go-game/core/ports.ts';
import { messageOf } from '@go-game/core/errors.ts';
import type { Session } from '@go-game/core/session.ts';
import type { User } from '@go-game/core/user.ts';
import type { ErrorListener, PlayedGame, Player, PlayerRepository, RankedPlayer } from './players.ts';

export { TOP_COUNT, HISTORY_COUNT } from './players.ts';
export type { PlayedGame, Player, RankedPlayer } from './players.ts';

export interface Leaderboard extends ResultSink {
  followTop(onTop: (players: readonly RankedPlayer[]) => void, onError: ErrorListener): () => void;
  /** Follows the entry of one player. Gives null as long as the player has no nickname. */
  followPlayer(uid: string, onPlayer: (player: Player | null) => void, onError: ErrorListener): () => void;
  history(uid: string): Promise<PlayedGame[]>;
  /** Sets where a failed save is reported. The game loop never waits for the network. */
  reportErrorsTo(onError: ErrorListener): void;
}

export class ServerLeaderboard implements Leaderboard {
  private readonly _players: PlayerRepository;
  private _user: User | null = null;
  private _onError: ErrorListener = () => undefined;

  constructor(players: PlayerRepository, session: Session) {
    this._players = players;
    session.onUser((user) => (this._user = user));
  }

  public reportErrorsTo(onError: ErrorListener): void {
    this._onError = onError;
  }

  public followTop(onTop: (players: readonly RankedPlayer[]) => void, onError: ErrorListener): () => void {
    return this._players.followTop(onTop, onError);
  }

  public followPlayer(uid: string, onPlayer: (player: Player | null) => void, onError: ErrorListener): () => void {
    return this._players.followPlayer(uid, onPlayer, onError);
  }

  public history(uid: string): Promise<PlayedGame[]> {
    return this._players.history(uid);
  }

  /** An online game is saved by its room, so only a game against the engine is sent from here. */
  public record(game: GameRecord): void {
    const user = this._user;
    if (user === null || user.nickname === null || game.opponent !== null || game.playouts === null) return;
    if (game.kind === ResultKind.TIMEOUT) return; // only an online game can end that way
    this._players
      .saveGame({ playouts: game.playouts, won: game.won, kind: game.kind })
      .catch((error) => this._onError(messageOf(error)));
  }
}
