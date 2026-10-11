import { Mode, parseMode } from '@go-game/core/game.ts';
import { DEFAULT_OPPONENT, OPPONENTS, opponentFor } from '@go-game/core/opponents.ts';
import { SKINS } from '@go-game/presentation/skins/SkinRegistry.ts';
import type { Controls, ControlsPort } from '@go-game/core/ports.ts';
import { byIdIn } from '../dom.ts';
import { ids } from '../ids.ts';
import { bindModal } from './Modal.ts';

export class GameControls implements ControlsPort {
  private readonly _root: ParentNode;
  private readonly _online: boolean;
  private readonly _mode: HTMLSelectElement;
  private readonly _opponent: HTMLSelectElement;

  /** `root` is the game page. `online` is a game against a player on another computer, not one at this keyboard. An online game hides the mode dropdown and the new game button. */
  constructor(root: ParentNode, online: boolean) {
    this._root = root;
    this._online = online;
    this._mode = byIdIn<HTMLSelectElement>(root, ids.modeSelect);
    this._opponent = byIdIn<HTMLSelectElement>(root, ids.opponentSelect);
    fillOpponents(this._opponent);
  }

  public bind(controls: Controls): void {
    const root = this._root;
    byIdIn(root, ids.passButton).onclick = controls.onPass;
    byIdIn(root, ids.resignButton).onclick = controls.onResign;
    byIdIn(root, ids.resetButton).onclick = controls.onNewGame;
    byIdIn(root, ids.modalResetButton).onclick = controls.onNewGame;
    this._mode.onchange = () => controls.onModeChange(this.mode());
    this._opponent.onchange = () => controls.onOpponentChange();
    bindModal(root, ids.rulesButton, ids.rulesModal, [ids.rulesModalClose, ids.rulesModalCloseButton]);
    bindModal(root, ids.skinButton, ids.skinModal, [ids.skinModalClose, ids.skinModalCloseButton]);
    // With one skin there is nothing to pick. The button comes back when the registry has two.
    byIdIn(root, ids.skinRow).hidden = SKINS.length < 2;
    byIdIn(root, ids.modeField).hidden = this._online;
    byIdIn(root, ids.resetButton).hidden = this._online;
    byIdIn(root, ids.modalResetButton).hidden = this._online;
  }

  /** The dropdown holds only known modes. Any other value means the HTML is wrong, not the player. */
  public mode(): Mode {
    if (this._online) return Mode.ONLINE;
    const value = this._mode.value;
    const mode = parseMode(value);
    if (mode === null) throw new Error(`Unknown game mode "${value}"`);
    return mode;
  }

  /** The dropdown holds only the opponents from OPPONENTS. Any other value means the HTML is wrong, not the player. */
  public playouts(): number {
    const value = this._opponent.value;
    const opponent = opponentFor(Number(value));
    if (opponent === null) throw new Error(`Unknown opponent "${value}"`);
    return opponent.playouts;
  }
}

/** The opponent dropdown is filled from OPPONENTS, so the page and the code use the same names and playout counts. */
function fillOpponents(select: HTMLSelectElement): void {
  select.replaceChildren(
    ...OPPONENTS.map(({ name, playouts }) => {
      const option = document.createElement('option');
      option.value = String(playouts);
      option.textContent = name;
      option.selected = playouts === DEFAULT_OPPONENT.playouts;
      return option;
    }),
  );
}
