import { Container, Graphics, Sprite, type Ticker } from 'pixi.js';
import { BLACK, type Stone } from '@go-game/core/board.ts';
import type { LoadedTextures } from '../skins/SkinManager.ts';
import type { SkinColors } from '../skins/SkinTypes.ts';
import type { Pixel } from './Geometry.ts';

const STONE_RADIUS = 0.44; // of a cell
const POP_SCALE_PER_FRAME = 0.2;

/** How the current skin draws stones: with pictures when it has them, otherwise with shapes in its colors. */
export interface StoneLook {
  colors: SkinColors;
  textures: LoadedTextures | null;
}

interface Shine {
  offset: number;
  radius: number;
  alpha: number;
}

const BLACK_SHINE: Shine = { offset: 0.25, radius: 0.35, alpha: 0.4 };
const WHITE_SHINE: Shine = { offset: 0.2, radius: 0.3, alpha: 0.85 };
const WHITE_RIM_WIDTH = 1.5;

export class StoneView {
  public readonly stone: Stone;
  public readonly display = new Container();
  private readonly _graphics = new Graphics();
  private readonly _picture = new Sprite({ anchor: 0.5 });
  private readonly _ticker: Ticker;
  private _step: ((ticker: Ticker) => void) | null = null;

  constructor(stone: Stone, ticker: Ticker) {
    this.stone = stone;
    this._ticker = ticker;
    this.display.addChild(this._graphics, this._picture);
  }

  /** Puts the stone at `at` and draws it for a cell of `cellSize`, with the pictures or colours of `look`. */
  public layout(at: Pixel, cellSize: number, look: StoneLook): void {
    const radius = cellSize * STONE_RADIUS;
    const texture =
      look.textures === null ? null : this.stone === BLACK ? look.textures.stoneBlack : look.textures.stoneWhite;
    this._picture.visible = texture !== null;
    this._graphics.visible = texture === null;
    this._graphics.clear();
    if (texture !== null) {
      this._picture.texture = texture;
      this._picture.setSize(radius * 2, radius * 2);
    } else {
      drawStone(this._graphics, this.stone, radius, look.colors);
    }
    this.display.position.set(at.x, at.y);
  }

  public popIn(): void {
    this._animateScale(0, 1);
  }

  public popOut(): void {
    this._animateScale(1, 0, () => this.display.destroy({ children: true }));
  }

  private _animateScale(from: number, to: number, onDone?: () => void): void {
    this._stopAnimation();
    this.display.scale.set(from);
    const direction = Math.sign(to - from);
    const step = (ticker: Ticker) => {
      const next = this.display.scale.x + direction * POP_SCALE_PER_FRAME * ticker.deltaTime;
      const reached = direction > 0 ? next >= to : next <= to;
      this.display.scale.set(reached ? to : next);
      if (reached) {
        this._stopAnimation();
        onDone?.();
      }
    };
    this._step = step;
    this._ticker.add(step);
  }

  private _stopAnimation(): void {
    if (this._step === null) return;
    this._ticker.remove(this._step);
    this._step = null;
  }
}

function drawStone(graphics: Graphics, stone: Stone, radius: number, colors: SkinColors): void {
  if (stone === BLACK) {
    graphics.circle(0, 0, radius).fill(colors.blackStone);
    drawShine(graphics, radius, BLACK_SHINE, colors.blackShine);
  } else {
    graphics.circle(0, 0, radius).fill(colors.whiteStone).stroke({ width: WHITE_RIM_WIDTH, color: colors.whiteRim });
    drawShine(graphics, radius, WHITE_SHINE, colors.whiteShine);
  }
}

function drawShine(graphics: Graphics, radius: number, shine: Shine, color: number): void {
  const offset = -radius * shine.offset;
  graphics.circle(offset, offset, radius * shine.radius).fill({ color, alpha: shine.alpha });
}
