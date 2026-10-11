import type { Board, Point, Stone } from './board.ts';
import type { Mode, Result } from './game.ts';
import type { IllegalReason, Move, Position } from './rules.ts';
import type { Opponent } from './opponents.ts';
import type { Score } from './scoring.ts';

export interface Suggestion {
  move: Move;
  winRate: number;
  elapsedMs: number;
}

export interface Engine {
  suggestMove(position: Position, playouts: number): Promise<Suggestion>;
  dispose(): void;
}

export interface Controls {
  onPass(): void;
  onResign(): void;
  onNewGame(): void;
  onModeChange(mode: Mode): void;
  /** The opponent dropdown changed. The game goes on. Only the labels change. */
  onOpponentChange(): void;
}

export interface StatusModel {
  toPlay: Stone;
  captures: Record<Stone, number>;
  /** The name of the engine opponent (Gopher, Bear or Elephant) on that side. Null when a person plays that side. */
  blackEngine: string | null;
  whiteEngine: string | null;
  /** In an online game, the nickname of the other player on that side. Null in every other case. */
  blackName: string | null;
  whiteName: string | null;
  /** The engine opponent in this game. It is shown under the board. Null when two people play, at one keyboard or online. */
  opponent: Opponent | null;
  canPass: boolean;
  canResign: boolean;
}

export interface ScenePort {
  render(board: Board, lastMove: Point | null): void;
  showHover(point: Point | null, stone: Stone): void;
}

export interface ControlsPort {
  bind(controls: Controls): void;
  mode(): Mode;
  playouts(): number;
}

export interface StatusPort {
  render(status: StatusModel): void;
  /** Shows that `opponent` is looking for a move. */
  showThinking(opponent: string): void;
  hideThinking(): void;
}

export interface IllegalMovePort {
  show(reason: IllegalReason): void;
}

/** A short message for the player, such as a save that failed. */
export interface MessagePort {
  show(message: string): void;
}

/** The notice is hidden again when the next engine search works. */
export interface EngineFailurePort {
  show(detail: string): void;
  hide(): void;
}

export interface ResultPort {
  show(result: Result, score: Score): void;
  hide(): void;
}

export interface SoundPlayer {
  play(): void;
}

/** The other player in an online game. */
export interface RemotePlayer {
  uid: string;
  name: string;
}

export interface GameRecord {
  won: boolean;
  kind: Result['kind'];
  /** How strong the engine was, as its playout count. Null for an online game. */
  playouts: number | null;
  /** The other player in an online game. Null for a game against the engine. */
  opponent: RemotePlayer | null;
}

/** What the other player, or the server, tells the game. */
export const RemoteEventType = { MOVE: 1, RESIGN: 2, TIMEOUT: 4 } as const;
export type RemoteEventType = (typeof RemoteEventType)[keyof typeof RemoteEventType];

export type RemoteEvent =
  | { type: typeof RemoteEventType.MOVE; index: number; move: Move }
  | { type: typeof RemoteEventType.RESIGN; by: Stone }
  | { type: typeof RemoteEventType.TIMEOUT; by: Stone };

export interface Match {
  seat: Stone;
  opponent: RemotePlayer;
  /** Sends the visitor's move to the opponent. `index` is the number of the move, starting at 0. Rejects when the server refuses the move. */
  sendMove(index: number, move: Move): Promise<void>;
  sendResign(): Promise<void>;
  /** `onError` hears about a lost connection to the room. */
  subscribe(listener: (event: RemoteEvent) => void, onError: (message: string) => void): () => void;
}

export interface ResultSink {
  record(game: GameRecord): void;
}

export interface Ports {
  scene: ScenePort;
  controls: ControlsPort;
  status: StatusPort;
  illegalMove: IllegalMovePort;
  messages: MessagePort;
  engineFailure: EngineFailurePort;
  result: ResultPort;
  sound: SoundPlayer;
  results: ResultSink;
}
