import { SKINS } from '@go-game/presentation/skins/SkinRegistry.ts';
import type { SkinSelection } from '@go-game/presentation/skins/SkinManager.ts';
import type { SkinColors, SkinConfig, SkinId } from '@go-game/presentation/skins/SkinTypes.ts';
import { element, markup, ref } from '../dom.ts';

const CARD =
  'go:w-full go:text-left go:flex go:items-center go:gap-3 go:p-3 go:rounded-xl go:border go:bg-inset go:transition go:hover:bg-control-hover';
const CARD_IDLE = `${CARD} go:border-line`;
const CARD_SELECTED = `${CARD} go:border-highlight go:ring-1 go:ring-highlight/60`;

const CARD_MARKUP = `
<button type="button" class="${CARD_IDLE}">
  <span data-ref="swatch" class="go:relative go:shrink-0 go:w-12 go:h-12 go:rounded-lg go:border go:border-line-strong go:overflow-hidden"></span>
  <span class="go:flex-1 go:min-w-0">
    <span data-ref="name" class="go:block go:text-sm go:font-semibold go:text-fg"></span>
    <span data-ref="description" class="go:block go:text-xs go:text-fg-muted"></span>
  </span>
  <span data-ref="badge" class="go:shrink-0 go:text-[10px] go:font-bold go:uppercase go:tracking-wider go:text-accent">Selected</span>
</button>`;

/** Shows the skins as cards in the skin dialog. A click selects the skin at once, so the board behind the dialog changes. */
export class SkinSelectorModal {
  private readonly _cards = new Map<SkinId, { card: HTMLButtonElement; badge: HTMLElement }>();
  private readonly _stopFollowingSkin: () => void;

  constructor(host: HTMLElement, skins: SkinSelection, list: readonly SkinConfig[] = SKINS) {
    host.replaceChildren(...list.map((skin) => this._card(skin, skins)));
    this._mark(skins.current.id);
    this._stopFollowingSkin = skins.onChange((skin) => this._mark(skin.id));
  }

  public dispose(): void {
    this._stopFollowingSkin();
  }

  private _card(skin: SkinConfig, skins: SkinSelection): HTMLElement {
    const card = markup(CARD_MARKUP) as HTMLButtonElement;
    card.dataset.skin = skin.id;
    ref(card, 'name').textContent = skin.name;
    ref(card, 'description').textContent = skin.description;
    ref(card, 'swatch').append(...swatch(skin.colors));
    card.onclick = () => skins.select(skin.id);
    this._cards.set(skin.id, { card, badge: ref(card, 'badge') });
    return card;
  }

  private _mark(selected: SkinId): void {
    for (const [id, { card, badge }] of this._cards) {
      const chosen = id === selected;
      card.className = chosen ? CARD_SELECTED : CARD_IDLE;
      card.setAttribute('aria-pressed', String(chosen));
      badge.hidden = !chosen;
    }
  }
}

/** A tiny board: the wood color, one grid line each way, a black stone and a white stone. The colors are set from code, because the security policy of the page forbids inline styles. */
function swatch(colors: SkinColors): HTMLElement[] {
  const wood = element('span', 'go:absolute go:inset-0');
  wood.style.background = css(colors.wood);
  const line = element('span', 'go:absolute go:left-0 go:right-0 go:top-1/2 go:h-px');
  line.style.background = css(colors.line);
  const column = element('span', 'go:absolute go:top-0 go:bottom-0 go:left-1/2 go:w-px');
  column.style.background = css(colors.line);
  const black = element('span', 'go:absolute go:w-4 go:h-4 go:rounded-full go:left-1.5 go:top-1.5');
  black.style.background = css(colors.blackStone);
  const white = element('span', 'go:absolute go:w-4 go:h-4 go:rounded-full go:right-1.5 go:bottom-1.5 go:border');
  white.style.background = css(colors.whiteStone);
  white.style.borderColor = css(colors.whiteRim);
  return [wood, line, column, black, white];
}

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
