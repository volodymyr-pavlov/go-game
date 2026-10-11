// The players of the game, on the game server: the leaderboard, the nicknames and the games each player finished.

import { ApiClient, ApiError } from './client.ts';
import { poll } from './poll.ts';
import type { EngineResultRequest, Player, PlayedGameJson, RankedPlayer } from '@go-game/types/api.ts';
import type { ResultKind } from '@go-game/types/game.ts';
import type { ErrorListener } from '@go-game/core/session.ts';

export const TOP_COUNT = 25;
export const HISTORY_COUNT = 20;
/** How often the leaderboard is loaded again while a page shows it. */
export const TOP_REFRESH_MS = 10_000;
/** How often the entry of one player is loaded again while a page follows it. */
export const PLAYER_REFRESH_MS = 15_000;

export type { Player, RankedPlayer };

export interface PlayedGame {
  id: string;
  opponentName: string;
  won: boolean;
  kind: ResultKind;
  ratingBefore: number;
  ratingAfter: number;
  finishedAt: Date | null;
}

/** A game against the engine, as the browser reports it. The server works out the rating change. */
export type GameEntry = EngineResultRequest;

export type { ErrorListener };
type Unsubscribe = () => void;

export interface PlayerRepository {
  followTop(onTop: (players: readonly RankedPlayer[]) => void, onError: ErrorListener): Unsubscribe;
  /** Follows the entry of one player. Gives null as long as the player has no nickname. */
  followPlayer(uid: string, onPlayer: (player: Player | null) => void, onError: ErrorListener): Unsubscribe;
  player(uid: string): Promise<Player | null>;
  history(uid: string): Promise<PlayedGame[]>;
  /** Gives the nickname to the signed-in player and frees the old one. Fails when another player has it. */
  claimNickname(name: string): Promise<void>;
  saveGame(game: GameEntry): Promise<void>;
  /** Removes the signed-in player's entry, nickname and games. */
  deletePlayer(): Promise<void>;
}

export class ApiPlayers implements PlayerRepository {
  private readonly _client: ApiClient;

  constructor(client: ApiClient) {
    this._client = client;
  }

  public followTop(onTop: (players: readonly RankedPlayer[]) => void, onError: ErrorListener): Unsubscribe {
    return poll(() => this._top(), onTop, onError, TOP_REFRESH_MS);
  }

  public followPlayer(uid: string, onPlayer: (player: Player | null) => void, onError: ErrorListener): Unsubscribe {
    return poll(() => this.player(uid), onPlayer, onError, PLAYER_REFRESH_MS);
  }

  public async player(uid: string): Promise<Player | null> {
    try {
      return await this._client.get<Player>(`/api/players/${encodeURIComponent(uid)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  public async history(uid: string): Promise<PlayedGame[]> {
    const { games } = await this._client.send<{ games: PlayedGameJson[] }>(
      'GET',
      `/api/players/${encodeURIComponent(uid)}/games`,
    );
    return games.map((game) => ({ ...game, id: String(game.id), finishedAt: new Date(game.finishedAt) }));
  }

  public async claimNickname(name: string): Promise<void> {
    await this._client.send('PUT', '/api/me/nickname', { nickname: name }, { checked: true });
  }

  public async saveGame(game: GameEntry): Promise<void> {
    await this._client.send('POST', '/api/me/games', game);
  }

  public async deletePlayer(): Promise<void> {
    await this._client.send('DELETE', '/api/me');
  }

  private async _top(): Promise<RankedPlayer[]> {
    return (await this._client.get<{ players: RankedPlayer[] }>('/api/leaderboard')).players;
  }
}
