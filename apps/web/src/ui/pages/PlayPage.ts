import { createEngine } from '@go-game/bridge/createEngine.ts';
import { EngineTurn } from '@go-game/core/EngineTurn.ts';
import { BOARD_SIZE } from '@go-game/core/board.ts';
import { GameLoop } from '@go-game/core/GameLoop.ts';
import { colourName } from '@go-game/core/notation.ts';
import type { Match, Ports, ResultSink } from '@go-game/core/ports.ts';
import { GameScene } from '@go-game/presentation/scenes/GameScene.ts';
import { OpponentPlate } from '@go-game/presentation/views/OpponentPlate.ts';
import { messageOf } from '@go-game/core/errors.ts';
import { EngineNotice } from '../components/EngineNotice.ts';
import { GameControls } from '../components/GameControls.ts';
import { illegalMoveMessage } from '../components/format.ts';
import { ResultModal } from '../components/ResultModal.ts';
import { SkinSelectorModal } from '../components/SkinSelectorModal.ts';
import { StatusView } from '../components/StatusView.ts';
import { Toast } from '../components/Toast.ts';
import type { AppContext } from '../context.ts';
import { byId, byIdIn, classes, markup, ref } from '../dom.ts';
import { ids } from '../ids.ts';
import type { Page, Params } from '../Router.ts';
import { hrefOf, routes } from '../routes.ts';
import { StoneSound } from '../StoneSound.ts';

const discardResults: ResultSink = { record: () => undefined };

export async function PlayPage(context: AppContext, params: Params): Promise<Page> {
  const roomId = params.room ?? null;
  let match: Match | null = null;
  if (roomId !== null) {
    try {
      match = await openMatch(context, roomId);
    } catch (error) {
      return failure(messageOf(error));
    }
  }

  const element = pageFromTemplate();
  const { skins } = context;
  const toast = new Toast(element);
  const skinSelector = new SkinSelectorModal(byIdIn(element, ids.skinList), skins);
  const sound = new StoneSound(skins);
  const leaderboard = context.firebase?.leaderboard ?? null;
  leaderboard?.reportErrorsTo((message) => toast.show(message));
  showOnlineNotice(byIdIn(element, ids.onlineNotice), match);

  let table: Teardown | null = null;
  let disposed = false;
  return {
    element,
    // The board and the plate take their size from the page, so they are made once the router has put the page in.
    mounted: async () => {
      const mounted = await startGame(element, context, match, {
        sound,
        toast,
        results: leaderboard ?? discardResults,
      });
      if (disposed) mounted.dispose();
      else table = mounted;
    },
    dispose: () => {
      disposed = true;
      table?.dispose();
      skinSelector.dispose();
      sound.dispose();
    },
  };
}

interface Teardown {
  dispose(): void;
}

interface SharedPorts {
  sound: StoneSound;
  toast: Toast;
  results: ResultSink;
}

/** Draws the board, wires the controls and starts the game loop. Everything it makes goes away with the returned `dispose`. */
async function startGame(
  page: HTMLElement,
  context: AppContext,
  match: Match | null,
  shared: SharedPorts,
): Promise<Teardown> {
  const { skins } = context;
  let loop: GameLoop | undefined;
  const scene = await GameScene.mount(
    byIdIn(page, ids.board),
    BOARD_SIZE,
    {
      onHover: (point) => loop?.hover(point),
      onSelect: (point) => loop?.select(point),
    },
    skins,
  );
  const plate = await OpponentPlate.mount(byIdIn(page, ids.opponentPlate), skins);
  const status = new StatusView(page, skins, plate);
  const ports: Ports = {
    scene,
    controls: new GameControls(page, match !== null),
    status,
    illegalMove: { show: (reason) => shared.toast.show(illegalMoveMessage(reason)) },
    messages: shared.toast,
    engineFailure: new EngineNotice(page),
    result: new ResultModal(page),
    sound: shared.sound,
    results: shared.results,
  };
  const engine = new EngineTurn(createEngine);
  loop = new GameLoop(ports, engine, match);
  loop.start();
  markReady(byIdIn(page, ids.board));
  return {
    dispose: () => {
      loop?.stop();
      engine.dispose();
      status.dispose();
      plate.destroy();
      scene.destroy();
    },
  };
}

/** The end-to-end tests wait for this: before it is set, a click on the board reaches no game loop. */
function markReady(board: HTMLElement): void {
  board.dataset.ready = 'true';
}

function pageFromTemplate(): HTMLElement {
  const template = byId<HTMLTemplateElement>(ids.gameTemplate);
  const root = template.content.firstElementChild?.cloneNode(true);
  if (!(root instanceof HTMLElement)) throw new Error('The game template is empty');
  return root;
}

async function openMatch(context: AppContext, roomId: string): Promise<Match> {
  const sync = context.firebase?.sync;
  if (!sync) throw new Error('Online play is not set up on this site');
  if (context.user === null) throw new Error('Sign in to play online');
  return sync.openMatch(roomId, context.user);
}

function showOnlineNotice(notice: HTMLElement, match: Match | null): void {
  notice.hidden = match === null;
  if (match !== null)
    notice.textContent = `Online game against ${match.opponent.name}. You play ${colourName(match.seat)}.`;
}

function failure(text: string): Page {
  const element = markup(
    `<section class="go:w-full go:max-w-xl go:mx-auto go:py-6"><p data-ref="text" class="${classes.placeholder}"></p><p class="go:text-center"><a href="${hrefOf(routes.lobby)}" class="${classes.link}">Back to the lobby</a></p></section>`,
  );
  ref(element, 'text').textContent = text;
  return { element };
}
