// The nameplate under the opponent's portrait. It is a small wooden plate drawn with PixiJS, with the opponent's name
// on it. The colours come from the skin and change with it.

import { Graphics, Text } from 'pixi.js';
import { createSurface, type Surface } from '../app.ts';
import type { SkinSelection } from '../skins/SkinManager.ts';
import type { SkinColors } from '../skins/SkinTypes.ts';

const CORNER_RADIUS = 8;
const RIM_WIDTH = 3;
const FONT_SIZE = 15;
/** The space on each side of the name, and the smallest width of the plate for a short name. */
const PADDING_X = 8;
const MIN_WIDTH = 72;

/** Draws a small plate with a name on it. The plate takes its height from its host element. */
export class OpponentPlate {
  private readonly _surface: Surface;
  private readonly _skins: SkinSelection;
  private readonly _plate = new Graphics();
  private readonly _label: Text;
  private readonly _stopFollowingSkin: () => void;

  private constructor(surface: Surface, skins: SkinSelection) {
    this._surface = surface;
    this._skins = skins;
    this._label = new Text({
      text: '',
      style: {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: FONT_SIZE,
        fontWeight: '700',
        lineHeight: FONT_SIZE,
      },
    });
    surface.add(this._plate, this._label);
    this._stopFollowingSkin = skins.onChange(() => this._paint());
    this._paint();
  }

  public static async mount(host: HTMLElement, skins: SkinSelection): Promise<OpponentPlate> {
    // PixiJS measures the text only once. If the page font is still loading, it would keep the size of the fallback font.
    await document.fonts.ready;
    const surface = await createSurface(host, { width: MIN_WIDTH, height: host.clientHeight, background: null });
    return new OpponentPlate(surface, skins);
  }

  /**
   * Sets the name, makes the plate wider or narrower to fit it, and puts the letters in the middle of the plate.
   * The ascent and descent of the font alone would not center them.
   */
  public show(name: string): void {
    this._label.text = name;
    const bounds = this._label.getLocalBounds();
    const width = Math.max(MIN_WIDTH, Math.ceil(bounds.width) + PADDING_X * 2);
    if (width !== this._surface.width) {
      this._surface.resize(width, this._surface.height);
      this._paint();
    }
    this._label.anchor.set(0);
    this._label.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    this._label.position.set(width / 2, this._surface.height / 2);
  }

  public destroy(): void {
    this._stopFollowingSkin();
    this._surface.destroy();
  }

  private _paint(): void {
    const { colors } = this._skins.current;
    drawPlate(this._plate, this._surface.width, this._surface.height, colors);
    this._label.style.fill = colors.line;
  }
}

/** The rim is drawn inside the canvas, moved in by half its width, so the edge of the canvas does not cut it off. */
function drawPlate(graphics: Graphics, width: number, height: number, colors: SkinColors): void {
  const inset = RIM_WIDTH / 2;
  graphics.clear();
  graphics
    .roundRect(inset, inset, width - RIM_WIDTH, height - RIM_WIDTH, CORNER_RADIUS)
    .fill(colors.wood)
    .stroke({ width: RIM_WIDTH, color: colors.grain });
}
