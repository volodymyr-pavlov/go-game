import type { EngineFailurePort } from '@go-game/core/ports.ts';
import { byIdIn } from '../dom.ts';
import { ids } from '../ids.ts';

export class EngineNotice implements EngineFailurePort {
  private readonly _notice: HTMLElement;
  private readonly _detail: HTMLElement;

  /** `root` is the game page. */
  constructor(root: ParentNode) {
    this._notice = byIdIn(root, ids.engineError);
    this._detail = byIdIn(root, ids.engineErrorDetail);
  }

  public show(detail: string): void {
    this._detail.textContent = detail;
    this._notice.hidden = false;
  }

  public hide(): void {
    this._notice.hidden = true;
  }
}
