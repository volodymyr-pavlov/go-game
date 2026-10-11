import type { MessagePort } from '@go-game/core/ports.ts';
import { byIdIn, hide, show } from '../dom.ts';
import { ids } from '../ids.ts';

const TOAST_MS = 2200;

/** The message line under the board. It shows why a move is not allowed, a failed save, or any other short message. */
export class Toast implements MessagePort {
  private readonly _toast: HTMLElement;
  private readonly _message: HTMLElement;
  private _timer: ReturnType<typeof setTimeout> | undefined;

  /** `root` is the game page. */
  constructor(root: ParentNode) {
    this._toast = byIdIn(root, ids.toast);
    this._message = byIdIn(root, ids.toastMessage);
  }

  public show(message: string): void {
    this._message.textContent = message;
    show(this._toast);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => hide(this._toast), TOAST_MS);
  }
}
