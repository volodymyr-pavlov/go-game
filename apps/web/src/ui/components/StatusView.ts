import { BLACK, WHITE } from '@go-game/core/board.ts';
import { colourName } from '@go-game/core/notation.ts';
import type { StatusModel, StatusPort } from '@go-game/core/ports.ts';
import { byIdIn, hide, show } from '../dom.ts';
import { ids } from '../ids.ts';
import { playerLabel } from './format.ts';
import type { SkinSelection } from '@go-game/presentation/skins/SkinManager.ts';
import type { OpponentPlate } from '@go-game/presentation/views/OpponentPlate.ts';

const CARD_BASE =
  'go:flex-1 go:flex go:items-center go:gap-2.5 go:p-2 go:rounded-lg go:transition-all go:duration-300 go:border-2';
const ACTIVE_CARD = `${CARD_BASE} go:border-highlight/60 go:bg-highlight/10 go:card-shadow`;
const IDLE_CARD = `${CARD_BASE} go:border-transparent go:opacity-80`;

export class StatusView implements StatusPort {
  private readonly _root: ParentNode;
  private readonly _skins: SkinSelection;
  private readonly _plate: OpponentPlate;
  private readonly _stopFollowingSkin: () => void;
  private _last: StatusModel | null = null;

  /** `root` is the game page. The opponent's portrait comes from the skin, so the view redraws it when the skin changes; the plate under it carries the name. */
  constructor(root: ParentNode, skins: SkinSelection, plate: OpponentPlate) {
    this._root = root;
    this._skins = skins;
    this._plate = plate;
    this._stopFollowingSkin = skins.onChange(() => {
      if (this._last !== null) this._renderOpponent(this._last);
    });
  }

  public render(status: StatusModel): void {
    this._last = status;
    this._renderTurn(status);
    this._renderPlayers(status);
    this._renderOpponent(status);
    this._renderButtons(status);
  }

  public dispose(): void {
    this._stopFollowingSkin();
  }

  public showThinking(opponent: string): void {
    this._el(ids.thinkingText).textContent = `${opponent} is thinking...`;
    show(this._el(ids.thinkingOverlay));
  }

  public hideThinking(): void {
    hide(this._el(ids.thinkingOverlay));
  }

  private _el<T extends HTMLElement = HTMLElement>(id: string): T {
    return byIdIn<T>(this._root, id);
  }

  private _renderTurn({ toPlay }: StatusModel): void {
    this._el(ids.currentTurn).textContent = colourName(toPlay);
    this._el(ids.blackCard).className = toPlay === BLACK ? ACTIVE_CARD : IDLE_CARD;
    this._el(ids.whiteCard).className = toPlay === WHITE ? ACTIVE_CARD : IDLE_CARD;
  }

  private _renderPlayers({ blackEngine, whiteEngine, blackName, whiteName, captures }: StatusModel): void {
    const black = { engine: blackEngine, remote: blackName };
    const white = { engine: whiteEngine, remote: whiteName };
    this._el(ids.blackLabel).textContent = playerLabel(colourName(BLACK), black, white);
    this._el(ids.whiteLabel).textContent = playerLabel(colourName(WHITE), white, black);
    this._el(ids.blackScore).textContent = `${captures[BLACK]} captures`;
    this._el(ids.whiteScore).textContent = `${captures[WHITE]} captures`;
  }

  /** The opponent's portrait and name under the board; nothing when two people play or the skin has no portraits. */
  private _renderOpponent({ opponent }: StatusModel): void {
    const url = opponent === null ? undefined : this._skins.current.avatars?.[opponent.name];
    this._el(ids.opponentBadge).hidden = opponent === null || url === undefined;
    if (opponent === null || url === undefined) return;
    const avatar = this._el<HTMLImageElement>(ids.opponentAvatar);
    if (avatar.getAttribute('src') !== url) avatar.src = url;
    avatar.alt = opponent.name;
    this._plate.show(opponent.name);
  }

  private _renderButtons({ canPass, canResign }: StatusModel): void {
    this._el<HTMLButtonElement>(ids.passButton).disabled = !canPass;
    this._el<HTMLButtonElement>(ids.resignButton).disabled = !canResign;
  }
}
