import { messageOf } from './errors.ts';
import type { EngineTurn } from './EngineTurn.ts';
import { GameRecorder } from './GameRecorder.ts';
import { BLACK, WHITE, type Point, type Stone } from './board.ts';
import { Game, Mode } from './game.ts';
import { RemoteEventType, type Match, type Ports, type RemoteEvent, type StatusModel } from './ports.ts';
import { opponentFor, opponentName } from './opponents.ts';
import type { Move } from './rules.ts';

export class GameLoop {
  private readonly _ports: Ports;
  private readonly _engine: EngineTurn;
  private readonly _match: Match | null;
  private _game: Game;
  private readonly _recorder: GameRecorder;
  private _unsubscribe: (() => void) | null = null;

  /** When `match` is set, this loop runs one online game, and the mode dropdown is ignored. */
  constructor(ports: Ports, engine: EngineTurn, match: Match | null = null) {
    this._ports = ports;
    this._engine = engine;
    this._match = match;
    this._recorder = new GameRecorder(ports.results, match);
    this._game = this._createGame(ports.controls.mode());
    ports.controls.bind({
      onPass: () => this._pass(),
      onResign: () => this._resign(),
      onNewGame: () => this._newGame(ports.controls.mode()),
      onModeChange: (mode) => this._newGame(mode),
      onOpponentChange: () => ports.status.render(this._status()),
    });
  }

  public get game(): Game {
    return this._game;
  }

  public start(): void {
    this._refresh();
    this._unsubscribe ??=
      this._match?.subscribe(
        (event) => this._onRemote(event),
        (message) => this._ports.messages.show(message),
      ) ?? null;
    void this._letEnginePlay();
  }

  public stop(): void {
    this._forgetPendingAnswer();
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  public hover(point: Point | null): void {
    this._ports.scene.showHover(this._humanMayPlay ? point : null, this._game.toPlay);
  }

  public select(point: Point): void {
    if (!this._humanMayPlay) return;
    const reason = this._game.illegalReason(point);
    if (reason !== null) {
      this._ports.illegalMove.show(reason);
      return;
    }
    this._playOwn(point);
  }

  private get _humanMayPlay(): boolean {
    return this._game.isHumanToPlay && !this._engine.thinking;
  }

  private _pass(): void {
    if (!this._humanMayPlay) return;
    this._playOwn(null);
  }

  /** Plays a move by the person at this computer. In an online game the move is also sent to the opponent. */
  private _playOwn(move: Move): void {
    const index = this._game.moveNumber;
    this._game.playMove(move);
    if (this._match !== null) this._report(this._match.sendMove(index, move));
    this._afterMove();
  }

  private _resign(): void {
    if (this._game.isOver) return;
    this._forgetPendingAnswer();
    this._giveUp();
    this._refresh();
    this._finishIfOver();
  }

  private _giveUp(): void {
    if (this._match === null) {
      this._game.resign();
      return;
    }
    this._report(this._match.sendResign());
    this._game.resignBy(this._match.seat);
  }

  /** In an online game the moves live on the server, so "new game" only draws the same game again. */
  private _newGame(mode: Mode): void {
    this._forgetPendingAnswer();
    if (this._match === null) {
      this._game = new Game(mode);
      this._recorder.reset();
    }
    this._ports.result.hide();
    this._refresh();
    void this._letEnginePlay();
  }

  private _createGame(mode: Mode): Game {
    return this._match === null ? new Game(mode) : new Game(Mode.ONLINE, this._match.seat);
  }

  /** Plays the opponent's moves in order. A move we already have, or one that comes at the wrong time, is ignored. */
  private _onRemote(event: RemoteEvent): void {
    if (event.type === RemoteEventType.RESIGN)
      this._onRemoteEnd(event.by === this._match?.seat, (game) => game.resignBy(event.by));
    else if (event.type === RemoteEventType.TIMEOUT) this._onRemoteEnd(false, (game) => game.timeoutBy(event.by));
    else this._onRemoteMove(event);
  }

  /**
   * The server says the game is over. When the player at this computer resigned, the game is already over here, so
   * `ownEnd` is true and nothing is done. A player who ran out of time only learns it from the server.
   */
  private _onRemoteEnd(ownEnd: boolean, end: (game: Game) => void): void {
    const game = this._game;
    if (game.isOver || ownEnd) return;
    end(game);
    this._refresh();
    this._finishIfOver();
  }

  private _onRemoteMove(event: Extract<RemoteEvent, { type: typeof RemoteEventType.MOVE }>): void {
    const game = this._game;
    if (event.index !== game.moveNumber || !game.isRemoteToPlay) return;
    if (event.move !== null && game.illegalReason(event.move) !== null) return;
    game.playMove(event.move);
    this._afterMove();
  }

  private _afterMove(): void {
    this._ports.sound.play();
    this._ports.scene.showHover(null, this._game.toPlay);
    this._refresh();
    this._finishIfOver();
    void this._letEnginePlay();
  }

  private async _letEnginePlay(): Promise<void> {
    if (!this._game.isEngineToPlay || this._engine.thinking) return;
    this._showThinking();
    try {
      const suggestion = await this._engine.ask(this._game.position, this._ports.controls.playouts());
      if (suggestion === null) return;
      this._hideThinking();
      this._ports.engineFailure.hide();
      this._playSuggested(suggestion.move);
    } catch (error) {
      this._hideThinking();
      this._ports.engineFailure.show(messageOf(error));
    }
  }

  /** The engine passes when it suggests a pass, or a move that is not allowed. */
  private _playSuggested(move: Point | null): void {
    const legal = move !== null && this._game.illegalReason(move) === null;
    this._game.playMove(legal ? move : null);
    this._afterMove();
  }

  /** The game goes on while the server answers. A refused or lost write is shown to the player. */
  private _report(sent: Promise<void>): void {
    sent.catch((error) => this._ports.messages.show(messageOf(error)));
  }

  private _forgetPendingAnswer(): void {
    this._engine.cancel();
    this._hideThinking();
  }

  private _showThinking(): void {
    this._ports.status.showThinking(this._opponentName);
    this._ports.status.render(this._status());
  }

  private _hideThinking(): void {
    this._ports.status.hideThinking();
    this._ports.status.render(this._status());
  }

  private _status(): StatusModel {
    const game = this._game;
    const blackEngine = this._engineNameOn(BLACK);
    const whiteEngine = this._engineNameOn(WHITE);
    return {
      toPlay: game.toPlay,
      captures: game.position.captures,
      blackEngine,
      whiteEngine,
      blackName: this._remoteNameOf(BLACK),
      whiteName: this._remoteNameOf(WHITE),
      opponent: blackEngine !== null || whiteEngine !== null ? opponentFor(this._ports.controls.playouts()) : null,
      canPass: this._humanMayPlay,
      canResign: !game.isOver,
    };
  }

  private _engineNameOn(stone: Stone): string | null {
    return this._game.isEngine(stone) ? this._opponentName : null;
  }

  /** The name of the opponent picked in the settings: Gopher, Bear or Elephant. */
  private get _opponentName(): string {
    return opponentName(this._ports.controls.playouts());
  }

  /** The nickname of the opponent in an online game. For other seats the views pick the label. */
  private _remoteNameOf(stone: Stone): string | null {
    return this._game.isRemote(stone) ? (this._match?.opponent.name ?? null) : null;
  }

  private _refresh(): void {
    const game = this._game;
    this._ports.scene.render(game.position.board, game.lastMove);
    this._ports.status.render(this._status());
  }

  private _finishIfOver(): void {
    const result = this._game.result;
    if (result === null) return;
    this._ports.result.show(result, this._game.score());
    this._recorder.recordOnce(this._game, () => this._ports.controls.playouts());
  }
}
