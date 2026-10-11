import { createEngine } from '@go-game/bridge/createEngine.ts';
import { BOARD_SIZE } from '@go-game/core/board.ts';
import { EngineTurn } from '@go-game/core/EngineTurn.ts';
import type { Result } from '@go-game/core/game.ts';
import { GameLoop } from '@go-game/core/GameLoop.ts';
import { illegalMoveMessage } from '@go-game/core/illegalMoveMessage.ts';
import { OPPONENTS, type Opponent } from '@go-game/core/opponents.ts';
import type { Controls, Ports, StatusModel } from '@go-game/core/ports.ts';
import type { Score } from '@go-game/core/scoring.ts';
import { Mode } from '@go-game/types/game.ts';
import { GameScene } from './scenes/GameScene.ts';
import { SkinManager } from './skins/SkinManager.ts';

/** What an app wants to hear from the game, to show it in its own way. Every one is optional. */
export interface EngineGameHooks {
  onStatus?(status: StatusModel): void;
  onThinking?(opponent: string | null): void;
  onResult?(result: Result, score: Score): void;
  onResultClosed?(): void;
  onMessage?(message: string): void;
  /** A stone was played, by either side. */
  onStone?(): void;
}

export interface EngineGame {
  pass(): void;
  resign(): void;
  newGame(): void;
  dispose(): void;
}

/**
 * A game of a person against the engine on a board in `host`, with no page around it. The apps that are not the web
 * app, such as a Telegram Mini App or a YouTube Playable, put their own buttons and text around it through the hooks.
 * `host` must be in the document, because the board takes its size from it.
 */
export async function mountEngineGame(
  host: HTMLElement,
  hooks: EngineGameHooks = {},
  opponent: Opponent = OPPONENTS[0],
): Promise<EngineGame> {
  let loop: GameLoop | undefined;
  let controls: Controls | null = null;
  const scene = await GameScene.mount(
    host,
    BOARD_SIZE,
    { onHover: (point) => loop?.hover(point), onSelect: (point) => loop?.select(point) },
    new SkinManager(),
  );
  const ports: Ports = {
    scene,
    controls: {
      bind: (bound) => (controls = bound),
      mode: () => Mode.HUMAN_VS_ENGINE,
      playouts: () => opponent.playouts,
    },
    status: {
      render: (status) => hooks.onStatus?.(status),
      showThinking: (name) => hooks.onThinking?.(name),
      hideThinking: () => hooks.onThinking?.(null),
    },
    illegalMove: { show: (reason) => hooks.onMessage?.(illegalMoveMessage(reason)) },
    messages: { show: (message) => hooks.onMessage?.(message) },
    engineFailure: {
      show: (detail) => hooks.onMessage?.(`The engine could not answer. ${detail}`),
      hide: () => undefined,
    },
    result: {
      show: (result, score) => hooks.onResult?.(result, score),
      hide: () => hooks.onResultClosed?.(),
    },
    sound: { play: () => hooks.onStone?.() },
    results: { record: () => undefined },
  };
  const engine = new EngineTurn(createEngine);
  loop = new GameLoop(ports, engine);
  loop.start();
  return {
    pass: () => controls?.onPass(),
    resign: () => controls?.onResign(),
    newGame: () => controls?.onNewGame(),
    dispose: () => {
      loop?.stop();
      engine.dispose();
      scene.destroy();
    },
  };
}
