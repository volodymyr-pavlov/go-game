import assert from 'node:assert/strict';
import { test } from 'vitest';
import { EngineTurn } from './EngineTurn.ts';
import { BLACK, WHITE, type Board, type Point, type Stone } from './board.ts';
import { GameLoop } from './GameLoop.ts';
import { Mode, ResultKind, type Result } from './game.ts';
import {
  RemoteEventType,
  type Controls,
  type ControlsPort,
  type Engine,
  type EngineFailurePort,
  type GameRecord,
  type IllegalMovePort,
  type Match,
  type MessagePort,
  type RemoteEvent,
  type ResultPort,
  type ResultSink,
  type ScenePort,
  type SoundPlayer,
  type StatusModel,
  type StatusPort,
  type Suggestion,
} from './ports.ts';
import { IllegalReason, type Position } from './rules.ts';
import type { Score } from './scoring.ts';
import { settled } from './testing/timers.ts';

class FakeScene implements ScenePort {
  public renders = 0;
  public lastMove: Point | null = null;
  public hover: Point | null = null;
  render(_board: Board, lastMove: Point | null): void {
    this.renders++;
    this.lastMove = lastMove;
  }
  showHover(point: Point | null, _stone: Stone): void {
    this.hover = point;
  }
}

class FakeControls implements ControlsPort {
  public controls!: Controls;
  public modeValue: Mode = Mode.HUMAN_VS_HUMAN;
  bind(controls: Controls): void {
    this.controls = controls;
  }
  mode(): Mode {
    return this.modeValue;
  }
  playouts(): number {
    return 10;
  }
}

class FakeStatus implements StatusPort {
  public last!: StatusModel;
  public thinking = false;
  render(status: StatusModel): void {
    this.last = status;
  }
  showThinking(): void {
    this.thinking = true;
  }
  hideThinking(): void {
    this.thinking = false;
  }
}

class FakeIllegalMove implements IllegalMovePort {
  public reasons: IllegalReason[] = [];
  show(reason: IllegalReason): void {
    this.reasons.push(reason);
  }
}

class FakeMessages implements MessagePort {
  public shown: string[] = [];
  show(message: string): void {
    this.shown.push(message);
  }
}

class FakeEngineFailure implements EngineFailurePort {
  public detail: string | null = null;
  show(detail: string): void {
    this.detail = detail;
  }
  hide(): void {
    this.detail = null;
  }
}

class FakeResult implements ResultPort {
  public shown: Result[] = [];
  show(result: Result, _score: Score): void {
    this.shown.push(result);
  }
  hide(): void {}
}

class FakeSound implements SoundPlayer {
  public plays = 0;
  play(): void {
    this.plays++;
  }
}

class ManualEngine implements Engine {
  public requests: Position[] = [];
  public disposed = 0;
  private _answer: ((suggestion: Suggestion) => void) | null = null;
  private _fail: ((error: Error) => void) | null = null;
  suggestMove(position: Position, _playouts: number): Promise<Suggestion> {
    this.requests.push(position);
    return new Promise((resolve, reject) => {
      this._answer = resolve;
      this._fail = reject;
    });
  }
  async answer(move: Point | null): Promise<void> {
    this._answer!({ move, winRate: 0.5, elapsedMs: 1 });
    await settled();
  }
  async fail(message: string): Promise<void> {
    this._fail!(new Error(message));
    await settled();
  }
  dispose(): void {
    this.disposed++;
  }
}

class FakeResults implements ResultSink {
  public records: GameRecord[] = [];
  record(game: GameRecord): void {
    this.records.push(game);
  }
}

class FakeMatch implements Match {
  public seat: Stone = BLACK;
  public opponent = { uid: 'bob', name: 'Bob' };
  public sent: { index: number; move: Point | null }[] = [];
  public resigned = false;
  /** When set, the server refuses every write with this message. */
  public refusal: string | null = null;
  private _listener: ((event: RemoteEvent) => void) | null = null;
  sendMove(index: number, move: Point | null): Promise<void> {
    this.sent.push({ index, move });
    return this._answer();
  }
  sendResign(): Promise<void> {
    this.resigned = true;
    return this._answer();
  }
  private _answer(): Promise<void> {
    return this.refusal === null ? Promise.resolve() : Promise.reject(new Error(this.refusal));
  }
  subscribe(listener: (event: RemoteEvent) => void): () => void {
    this._listener = listener;
    return () => (this._listener = null);
  }
  arrives(event: RemoteEvent): void {
    this._listener?.(event);
  }
}

function setUp(mode: Mode, match: Match | null = null) {
  const scene = new FakeScene();
  const controls = new FakeControls();
  controls.modeValue = mode;
  const status = new FakeStatus();
  const illegalMove = new FakeIllegalMove();
  const messages = new FakeMessages();
  const engineFailure = new FakeEngineFailure();
  const result = new FakeResult();
  const sound = new FakeSound();
  const engine = new ManualEngine();
  const results = new FakeResults();
  let started = 0;
  const engineTurn = new EngineTurn(() => {
    started++;
    return engine;
  });
  const loop = new GameLoop(
    {
      scene,
      controls,
      status,
      illegalMove,
      messages,
      engineFailure,
      result,
      sound,
      results,
    },
    engineTurn,
    match,
  );
  loop.start();
  return {
    scene,
    controls: () => controls.controls,
    status,
    illegalMove,
    messages,
    engineFailure,
    result,
    sound,
    engine,
    results,
    loop,
    engineStarts: () => started,
  };
}

test('a human move is played and the turn passes to the other colour', () => {
  const { loop, status } = setUp(Mode.HUMAN_VS_HUMAN);
  loop.select({ x: 4, y: 4 });
  assert.equal(loop.game.moveNumber, 1);
  assert.equal(loop.game.toPlay, WHITE);
  assert.equal(status.last.toPlay, WHITE);
});

test('a placed stone makes the stone sound once', () => {
  const { loop, sound } = setUp(Mode.HUMAN_VS_HUMAN);
  loop.select({ x: 4, y: 4 });
  assert.equal(sound.plays, 1);
});

test('a move renders the board once more, with the stone marked as the last move', () => {
  const { loop, scene } = setUp(Mode.HUMAN_VS_HUMAN);
  const before = scene.renders;
  loop.select({ x: 4, y: 4 });
  assert.equal(scene.renders, before + 1);
  assert.deepEqual(scene.lastMove, { x: 4, y: 4 });
});

test('an illegal move is reported and not played', () => {
  const { loop, illegalMove } = setUp(Mode.HUMAN_VS_HUMAN);
  loop.select({ x: 4, y: 4 });
  loop.select({ x: 4, y: 4 });
  assert.deepEqual(illegalMove.reasons, [IllegalReason.OCCUPIED]);
  assert.equal(loop.game.moveNumber, 1);
});

test('a two-player game never starts the engine', () => {
  const { loop, engineStarts, controls } = setUp(Mode.HUMAN_VS_HUMAN);
  loop.select({ x: 4, y: 4 });
  controls().onPass();
  assert.equal(engineStarts(), 0);
});

test('the engine answers after the human moves, and input is blocked meanwhile', async () => {
  const { loop, engine, status } = setUp(Mode.HUMAN_VS_ENGINE);
  loop.select({ x: 4, y: 4 });
  assert.ok(status.thinking);
  assert.equal(status.last.canPass, false);
  loop.select({ x: 5, y: 5 });
  assert.equal(loop.game.moveNumber, 1);

  await engine.answer({ x: 2, y: 2 });
  assert.ok(!status.thinking);
  assert.equal(loop.game.moveNumber, 2);
  assert.equal(loop.game.toPlay, BLACK);
});

test('an engine failure stops thinking and shows a persistent notice', async () => {
  const { loop, engine, status, engineFailure } = setUp(Mode.HUMAN_VS_ENGINE);
  loop.select({ x: 4, y: 4 });
  await engine.fail('engine crashed');
  assert.ok(!status.thinking);
  assert.equal(engineFailure.detail, 'engine crashed');
  assert.equal(status.last.canPass, false);
});

test('an answer arriving after a new game is ignored', async () => {
  const { loop, engine, controls, status } = setUp(Mode.HUMAN_VS_ENGINE);
  loop.select({ x: 4, y: 4 });
  controls().onNewGame();
  assert.equal(loop.game.moveNumber, 0);
  await engine.answer({ x: 2, y: 2 });
  assert.equal(loop.game.moveNumber, 0);
  assert.ok(!status.thinking);
});

test('the engine passes when its suggestion is illegal', async () => {
  const { loop, engine } = setUp(Mode.HUMAN_VS_ENGINE);
  loop.select({ x: 4, y: 4 });
  await engine.answer({ x: 4, y: 4 });
  assert.equal(loop.game.history[1].move, null);
});

test('the engine moves first in engine_vs_human', () => {
  const { engine, status } = setUp(Mode.ENGINE_VS_HUMAN);
  assert.equal(engine.requests.length, 1);
  assert.ok(status.thinking);
});

test('two passes end the game and show the result', () => {
  const { loop, controls, status, result } = setUp(Mode.HUMAN_VS_HUMAN);
  loop.select({ x: 4, y: 4 });
  controls().onPass();
  controls().onPass();
  assert.equal(result.shown.at(-1)?.kind, ResultKind.SCORE);
  assert.equal(status.last.canResign, false);
});

test('a resignation against the engine is recorded once as a loss', () => {
  const { results, controls } = setUp(Mode.HUMAN_VS_ENGINE);
  controls().onResign();
  controls().onResign();
  assert.deepEqual(results.records, [{ won: false, kind: ResultKind.RESIGNATION, playouts: 10, opponent: null }]);
});

test('a game the human wins on the score is recorded as a win', async () => {
  const { loop, engine, results, controls } = setUp(Mode.HUMAN_VS_ENGINE);
  loop.select({ x: 4, y: 4 });
  await engine.answer(null);
  controls().onPass();
  assert.equal(loop.game.isOver, true);
  assert.deepEqual(results.records, [{ won: true, kind: ResultKind.SCORE, playouts: 10, opponent: null }]);
});

test('a local two-player game is never recorded', () => {
  const { results, controls } = setUp(Mode.HUMAN_VS_HUMAN);
  controls().onResign();
  assert.deepEqual(results.records, []);
});

test('a new game can be recorded again', () => {
  const { results, controls } = setUp(Mode.HUMAN_VS_ENGINE);
  controls().onResign();
  controls().onNewGame();
  controls().onResign();
  assert.equal(results.records.length, 2);
});

test('an online move is sent, and the reply is applied only in turn', () => {
  const match = new FakeMatch();
  const { loop, status } = setUp(Mode.HUMAN_VS_HUMAN, match);
  assert.equal(loop.game.mode, Mode.ONLINE);
  loop.select({ x: 4, y: 4 });
  assert.deepEqual(match.sent, [{ index: 0, move: { x: 4, y: 4 } }]);
  assert.equal(status.last.canPass, false);
  assert.equal(status.last.whiteName, 'Bob');

  loop.select({ x: 5, y: 5 }); // not the visitor's turn
  assert.equal(loop.game.moveNumber, 1);
  match.arrives({ type: RemoteEventType.MOVE, index: 0, move: { x: 2, y: 2 } }); // already known
  match.arrives({ type: RemoteEventType.MOVE, index: 1, move: { x: 2, y: 2 } });
  assert.equal(loop.game.moveNumber, 2);
  assert.equal(loop.game.toPlay, BLACK);
});

test('a remote resignation ends the game and records a win', () => {
  const match = new FakeMatch();
  const { loop, results } = setUp(Mode.HUMAN_VS_HUMAN, match);
  match.arrives({ type: RemoteEventType.RESIGN, by: WHITE });
  assert.equal(loop.game.result?.kind, ResultKind.RESIGNATION);
  assert.deepEqual(results.records, [
    { won: true, kind: ResultKind.RESIGNATION, playouts: null, opponent: match.opponent },
  ]);
});

test('when the other player runs out of time, the game ends and records a win', () => {
  const match = new FakeMatch();
  const { loop, results } = setUp(Mode.HUMAN_VS_HUMAN, match);
  match.arrives({ type: RemoteEventType.TIMEOUT, by: WHITE });
  assert.equal(loop.game.result?.kind, ResultKind.TIMEOUT);
  assert.deepEqual(results.records, [
    { won: true, kind: ResultKind.TIMEOUT, playouts: null, opponent: match.opponent },
  ]);
});

test('when this player runs out of time, the server says so and the game is lost', () => {
  const match = new FakeMatch();
  const { loop, results } = setUp(Mode.HUMAN_VS_HUMAN, match);
  match.arrives({ type: RemoteEventType.TIMEOUT, by: BLACK });
  assert.equal(loop.game.result?.kind, ResultKind.TIMEOUT);
  assert.equal(results.records[0]?.won, false);
});

test('resigning online is sent even on the other side’s turn', () => {
  const match = new FakeMatch();
  const { loop, controls, results } = setUp(Mode.HUMAN_VS_HUMAN, match);
  loop.select({ x: 4, y: 4 });
  controls().onResign();
  assert.ok(match.resigned);
  assert.equal(results.records[0]?.won, false);
});

test('a move the server refuses is shown to the player', async () => {
  const match = new FakeMatch();
  match.refusal = 'The move was not accepted';
  const { loop, messages } = setUp(Mode.HUMAN_VS_HUMAN, match);
  loop.select({ x: 4, y: 4 });
  await settled();
  assert.deepEqual(messages.shown, ['The move was not accepted']);
});
